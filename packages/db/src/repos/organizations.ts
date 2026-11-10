import type { Organization, OrgMembership, OrgRole, OrgSettings, User } from '@lp/domain';
import { DEFAULT_ORG_SETTINGS } from '@lp/domain';
import { and, count, eq, isNull } from 'drizzle-orm';

import type { Db } from '../client.js';
import { mapMembership, mapOrganization, mapUser } from '../mappers.js';
import { orgMemberships, organizations, users } from '../schema.js';

export async function insertOrganization(
  db: Db,
  input: {
    id: string;
    slug: string;
    name: string;
    settings?: OrgSettings;
    ownerUserId: string;
  },
): Promise<{ org: Organization; membership: OrgMembership }> {
  const now = new Date();
  const settings = input.settings ?? DEFAULT_ORG_SETTINGS;

  return db.transaction(async (tx) => {
    const [orgRow] = await tx
      .insert(organizations)
      .values({
        id: input.id,
        slug: input.slug,
        name: input.name,
        settings,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .returning();
    if (!orgRow) {
      throw new Error('insertOrganization failed');
    }

    const [memRow] = await tx
      .insert(orgMemberships)
      .values({
        orgId: input.id,
        userId: input.ownerUserId,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!memRow) {
      throw new Error('insertOrganization membership failed');
    }

    return { org: mapOrganization(orgRow), membership: mapMembership(memRow) };
  });
}

export async function findOrganizationById(db: Db, id: string): Promise<Organization | null> {
  const [row] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
    .limit(1);
  return row ? mapOrganization(row) : null;
}

export async function findOrganizationBySlug(db: Db, slug: string): Promise<Organization | null> {
  const [row] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt)))
    .limit(1);
  return row ? mapOrganization(row) : null;
}

export async function listMembershipsForUser(
  db: Db,
  userId: string,
): Promise<Array<OrgMembership & { org: Organization }>> {
  const rows = await db
    .select({
      membership: orgMemberships,
      org: organizations,
    })
    .from(orgMemberships)
    .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
    .where(and(eq(orgMemberships.userId, userId), isNull(organizations.deletedAt)));

  return rows.map((r) => ({
    ...mapMembership(r.membership),
    org: mapOrganization(r.org),
  }));
}

export async function getMembership(
  db: Db,
  orgId: string,
  userId: string,
): Promise<OrgMembership | null> {
  const [row] = await db
    .select()
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)))
    .limit(1);
  return row ? mapMembership(row) : null;
}

export async function listMembers(
  db: Db,
  orgId: string,
): Promise<Array<{ membership: OrgMembership; user: User }>> {
  const rows = await db
    .select({
      membership: orgMemberships,
      user: users,
    })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(and(eq(orgMemberships.orgId, orgId), isNull(users.deletedAt)));

  return rows.map((r) => ({
    membership: mapMembership(r.membership),
    user: mapUser(r.user),
  }));
}

export async function addMembership(
  db: Db,
  input: { orgId: string; userId: string; role: OrgRole },
): Promise<OrgMembership> {
  const now = new Date();
  const [row] = await db
    .insert(orgMemberships)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error('addMembership failed');
  }
  return mapMembership(row);
}

export async function updateMembershipRole(
  db: Db,
  input: { orgId: string; userId: string; role: OrgRole },
): Promise<OrgMembership | null> {
  const [row] = await db
    .update(orgMemberships)
    .set({ role: input.role, updatedAt: new Date() })
    .where(and(eq(orgMemberships.orgId, input.orgId), eq(orgMemberships.userId, input.userId)))
    .returning();
  return row ? mapMembership(row) : null;
}

export async function removeMembership(
  db: Db,
  input: { orgId: string; userId: string },
): Promise<boolean> {
  const deleted = await db
    .delete(orgMemberships)
    .where(and(eq(orgMemberships.orgId, input.orgId), eq(orgMemberships.userId, input.userId)))
    .returning();
  return deleted.length > 0;
}

export async function countOwners(db: Db, orgId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.role, 'owner')));
  return Number(row?.value ?? 0);
}
