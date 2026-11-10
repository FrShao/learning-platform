import type { OrgRole } from '@lp/domain';

export function canAuthor(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'author';
}

export function canManageMembers(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageApiKeys(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function roleLabel(role: OrgRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'author':
      return 'Author';
    case 'learner':
      return 'Learner';
  }
}
