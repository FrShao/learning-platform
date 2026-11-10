'use client';

import type { OrgRole } from '@lp/domain';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { canManageApiKeys, canManageMembers } from '@/lib/roles';

export function SettingsNav({ orgId, role }: { orgId: string; role: OrgRole | null }) {
  const pathname = usePathname();
  const items = [
    { href: `/app/orgs/${orgId}/settings/general`, label: 'General' },
    ...(canManageMembers(role)
      ? [{ href: `/app/orgs/${orgId}/settings/members`, label: 'Members' }]
      : []),
    ...(canManageApiKeys(role)
      ? [{ href: `/app/orgs/${orgId}/settings/api-keys`, label: 'API keys' }]
      : []),
  ];

  return (
    <nav className="settings-nav" aria-label="Settings">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'settings-link active' : 'settings-link'}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
