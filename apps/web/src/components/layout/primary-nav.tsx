'use client';

import type { OrgRole } from '@lp/domain';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { canAuthor } from '@/lib/roles';

function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  return pathname.startsWith(`${href}/`);
}

export function PrimaryNav({
  orgId,
  role,
  variant,
}: {
  orgId: string;
  role: OrgRole | null;
  variant: 'side' | 'bottom';
}) {
  const pathname = usePathname();
  const author = canAuthor(role);

  const items = [
    { href: '/app', label: 'Learn home', match: 'exact' as const },
    { href: `/app/orgs/${orgId}`, label: 'Org hub', match: 'exact' as const },
    ...(author
      ? [
          { href: `/app/orgs/${orgId}/courses`, label: 'Courses', match: 'prefix' as const },
          { href: `/app/orgs/${orgId}/paths`, label: 'Paths', match: 'prefix' as const },
        ]
      : []),
    { href: `/app/orgs/${orgId}/learn`, label: 'Org catalog', match: 'prefix' as const },
    ...(!author
      ? [{ href: `/app/orgs/${orgId}/progress`, label: 'Progress', match: 'prefix' as const }]
      : []),
    ...(author || role === 'admin' || role === 'owner'
      ? [{ href: `/app/orgs/${orgId}/settings`, label: 'Settings', match: 'prefix' as const }]
      : []),
  ];

  return (
    <nav className={`primary-nav primary-nav-${variant}`} aria-label="Primary">
      {items.map((item) => {
        const active =
          item.match === 'exact'
            ? pathname === item.href
            : isActive(pathname, item.href) &&
              !(item.href.endsWith('/courses') && pathname.includes('/learn'));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'nav-link active' : 'nav-link'}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
