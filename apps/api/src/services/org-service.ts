import { randomUUID } from 'node:crypto';

import type { DbClient } from '@lp/db';
import {
  addMembership,
  countOwners,
  findApiKeyById,
  findOrganizationById,
  findOrganizationBySlug,
  findUserByEmail,
  getMembership,
  insertApiKey,
  insertOrganization,
  listApiKeysForOrg,
  listMembers,
  removeMembership,
  revokeApiKey,
  updateMembershipRole,
} from '@lp/db';
import {
  API_KEY_SCOPES,
  canAssignRole,
  canChangeSoleOwner,
  canManageMemberRole,
  isValidOrgSlug,
  normalizeEmail,
  normalizeOrgSlug,
  ORG_ROLES,
  roleHasCapability,
  type ApiKey,
  type ApiKeyScope,
  type Organization,
  type OrgMembership,
  type OrgRole,
  type User,
} from '@lp/domain';
import {
  apiKeyDisplayPrefix,
  generateApiKeySecret,
  hashApiKey,
} from '@lp/domain/api-key-crypto';

import { conflict, forbidden, notFound, validation } from '../errors.js';

function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
}

function isApiKeyScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value);
}

export class OrgService {
  constructor(private readonly client: DbClient) {}

  async createOrg(
    actor: User,
    input: { slug: string; name: string },
  ): Promise<{ org: Organization; membership: OrgMembership }> {
    if (!input.name || input.name.trim().length < 1 || input.name.trim().length > 200) {
      throw validation('Name must be 1–200 characters');
    }
    if (!isValidOrgSlug(input.slug)) {
      throw validation('Invalid organization slug');
    }
    const slug = normalizeOrgSlug(input.slug);
    const existing = await findOrganizationBySlug(this.client.db, slug);
    if (existing) {
      throw conflict('Organization slug already taken');
    }
    return insertOrganization(this.client.db, {
      id: randomUUID(),
      slug,
      name: input.name.trim(),
      ownerUserId: actor.id,
    });
  }

  async getOrg(actor: User, orgId: string): Promise<Organization> {
    const org = await findOrganizationById(this.client.db, orgId);
    if (!org) {
      throw notFound('Organization not found');
    }
    const membership = await getMembership(this.client.db, orgId, actor.id);
    if (!membership) {
      throw forbidden('Not a member of this organization');
    }
    return org;
  }

  async listMembers(
    actor: User,
    orgId: string,
  ): Promise<Array<{ membership: OrgMembership; user: User }>> {
    await this.requireMembership(actor.id, orgId);
    return listMembers(this.client.db, orgId);
  }

  async addMember(
    actor: User,
    orgId: string,
    input: { email: string; role: string },
  ): Promise<{ membership: OrgMembership; user: User }> {
    const actorMembership = await this.requireCapability(actor.id, orgId, 'manage_members');
    if (!isOrgRole(input.role)) {
      throw validation('Invalid role');
    }
    if (!canAssignRole(actorMembership.role, input.role)) {
      throw forbidden('Cannot assign this role');
    }
    const email = normalizeEmail(input.email);
    const user = await findUserByEmail(this.client.db, email);
    if (!user) {
      throw notFound('User not found for email');
    }
    const existing = await getMembership(this.client.db, orgId, user.id);
    if (existing) {
      throw conflict('User is already a member');
    }
    const membership = await addMembership(this.client.db, {
      orgId,
      userId: user.id,
      role: input.role,
    });
    return { membership, user };
  }

  async patchMemberRole(
    actor: User,
    orgId: string,
    targetUserId: string,
    role: string,
  ): Promise<OrgMembership> {
    const actorMembership = await this.requireCapability(actor.id, orgId, 'manage_members');
    if (!isOrgRole(role)) {
      throw validation('Invalid role');
    }
    const target = await getMembership(this.client.db, orgId, targetUserId);
    if (!target) {
      throw notFound('Membership not found');
    }
    if (!canManageMemberRole(actorMembership.role, target.role)) {
      throw forbidden('Cannot change this member');
    }
    if (!canAssignRole(actorMembership.role, role)) {
      throw forbidden('Cannot assign this role');
    }
    if (target.role === 'owner' && role !== 'owner') {
      const owners = await countOwners(this.client.db, orgId);
      if (!canChangeSoleOwner({ targetRole: 'owner', ownerCount: owners, action: 'demote' })) {
        throw conflict('Cannot demote the sole owner');
      }
    }
    const updated = await updateMembershipRole(this.client.db, {
      orgId,
      userId: targetUserId,
      role,
    });
    if (!updated) {
      throw notFound('Membership not found');
    }
    return updated;
  }

  async removeMember(actor: User, orgId: string, targetUserId: string): Promise<void> {
    const actorMembership = await this.requireCapability(actor.id, orgId, 'manage_members');
    const target = await getMembership(this.client.db, orgId, targetUserId);
    if (!target) {
      throw notFound('Membership not found');
    }
    if (!canManageMemberRole(actorMembership.role, target.role)) {
      throw forbidden('Cannot remove this member');
    }
    if (target.role === 'owner') {
      const owners = await countOwners(this.client.db, orgId);
      if (!canChangeSoleOwner({ targetRole: 'owner', ownerCount: owners, action: 'remove' })) {
        throw conflict('Cannot remove the sole owner');
      }
    }
    const removed = await removeMembership(this.client.db, { orgId, userId: targetUserId });
    if (!removed) {
      throw notFound('Membership not found');
    }
  }

  async createApiKey(
    actor: User,
    orgId: string,
    input: { name: string; scopes: string[] },
  ): Promise<{ key: ApiKey; secret: string }> {
    await this.requireCapability(actor.id, orgId, 'manage_api_keys');
    if (!input.name || input.name.trim().length < 1 || input.name.trim().length > 100) {
      throw validation('Name must be 1–100 characters');
    }
    if (!Array.isArray(input.scopes) || input.scopes.length === 0) {
      throw validation('scopes must be a non-empty array');
    }
    const scopes: ApiKeyScope[] = [];
    for (const s of input.scopes) {
      if (!isApiKeyScope(s)) {
        throw validation(`Invalid scope: ${s}`);
      }
      if (!scopes.includes(s)) {
        scopes.push(s);
      }
    }

    const existing = await listApiKeysForOrg(this.client.db, orgId);
    const name = input.name.trim();
    if (existing.some((k) => k.revokedAt === null && k.name === name)) {
      throw conflict('An active API key with this name already exists');
    }

    const secret = generateApiKeySecret();
    const key = await insertApiKey(this.client.db, {
      id: randomUUID(),
      orgId,
      name,
      keyHash: hashApiKey(secret),
      prefix: apiKeyDisplayPrefix(secret),
      scopes,
      createdBy: actor.id,
    });
    return { key, secret };
  }

  async listApiKeys(actor: User, orgId: string): Promise<ApiKey[]> {
    await this.requireCapability(actor.id, orgId, 'manage_api_keys');
    return listApiKeysForOrg(this.client.db, orgId);
  }

  async revokeApiKey(actor: User, orgId: string, keyId: string): Promise<ApiKey> {
    await this.requireCapability(actor.id, orgId, 'manage_api_keys');
    const existing = await findApiKeyById(this.client.db, orgId, keyId);
    if (!existing) {
      throw notFound('API key not found');
    }
    if (existing.revokedAt) {
      throw conflict('API key already revoked');
    }
    const revoked = await revokeApiKey(this.client.db, { orgId, keyId });
    if (!revoked) {
      throw notFound('API key not found');
    }
    return revoked;
  }

  private async requireMembership(userId: string, orgId: string): Promise<OrgMembership> {
    const org = await findOrganizationById(this.client.db, orgId);
    if (!org) {
      throw notFound('Organization not found');
    }
    const membership = await getMembership(this.client.db, orgId, userId);
    if (!membership) {
      throw forbidden('Not a member of this organization');
    }
    return membership;
  }

  private async requireCapability(
    userId: string,
    orgId: string,
    capability: Parameters<typeof roleHasCapability>[1],
  ): Promise<OrgMembership> {
    const membership = await this.requireMembership(userId, orgId);
    if (!roleHasCapability(membership.role, capability)) {
      throw forbidden('Insufficient role');
    }
    return membership;
  }
}
