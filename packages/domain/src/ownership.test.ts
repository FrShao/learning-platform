import { describe, expect, it } from 'vitest';

import { DomainError } from './course/types.js';
import {
  canAuthorOwnedResource,
  canLearnOwnedResource,
  ownerOrgId,
  ownerUserId,
  resourceOwnerFromColumns,
} from './ownership.js';

describe('resourceOwnerFromColumns', () => {
  it('builds org owner', () => {
    expect(resourceOwnerFromColumns('org_1', null)).toEqual({ kind: 'org', orgId: 'org_1' });
  });

  it('builds user owner', () => {
    expect(resourceOwnerFromColumns(null, 'user_1')).toEqual({
      kind: 'user',
      userId: 'user_1',
    });
  });

  it('rejects both or neither', () => {
    expect(() => resourceOwnerFromColumns('org_1', 'user_1')).toThrow(DomainError);
    expect(() => resourceOwnerFromColumns(null, null)).toThrow(DomainError);
  });
});

describe('ownership ACL', () => {
  const userOwner = { kind: 'user' as const, userId: 'u1' };
  const orgOwner = { kind: 'org' as const, orgId: 'o1' };

  it('gives user owner full author control', () => {
    expect(canAuthorOwnedResource(userOwner, { userId: 'u1' })).toBe(true);
    expect(canAuthorOwnedResource(userOwner, { userId: 'u2' })).toBe(false);
  });

  it('requires author+ for org-owned authoring', () => {
    expect(canAuthorOwnedResource(orgOwner, { userId: 'u1', orgRole: 'author' })).toBe(true);
    expect(canAuthorOwnedResource(orgOwner, { userId: 'u1', orgRole: 'learner' })).toBe(false);
    expect(canAuthorOwnedResource(orgOwner, { userId: 'u1', orgRole: null })).toBe(false);
  });

  it('allows learning personal content for any authenticated user', () => {
    expect(canLearnOwnedResource(userOwner, { userId: 'u2' })).toBe(true);
  });

  it('requires enroll capability for org-owned learning', () => {
    expect(canLearnOwnedResource(orgOwner, { userId: 'u1', orgRole: 'learner' })).toBe(true);
    expect(canLearnOwnedResource(orgOwner, { userId: 'u1', orgRole: null })).toBe(false);
  });

  it('exposes convenience owner fields', () => {
    expect(ownerOrgId(orgOwner)).toBe('o1');
    expect(ownerUserId(orgOwner)).toBeNull();
    expect(ownerOrgId(userOwner)).toBeNull();
    expect(ownerUserId(userOwner)).toBe('u1');
  });
});
