'use client';

import type { OrgRole } from '@lp/domain';
import {
  BookOpen,
  Compass,
  GraduationCap,
  Home,
  LineChart,
  Route,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { canAuthor } from '@/lib/roles';
import { cn } from '@/lib/utils';

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

  const items: { href: string; label: string; match: 'exact' | 'prefix'; icon: LucideIcon }[] = [
    { href: '/app', label: 'Learn home', match: 'exact', icon: Compass },
    { href: `/app/orgs/${orgId}`, label: 'Org hub', match: 'exact', icon: Home },
    ...(author
      ? [
          {
            href: `/app/orgs/${orgId}/courses`,
            label: 'Courses',
            match: 'prefix' as const,
            icon: BookOpen,
          },
          {
            href: `/app/orgs/${orgId}/paths`,
            label: 'Paths',
            match: 'prefix' as const,
            icon: Route,
          },
        ]
      : []),
    {
      href: `/app/orgs/${orgId}/learn`,
      label: 'Org catalog',
      match: 'prefix',
      icon: GraduationCap,
    },
    ...(!author
      ? [
          {
            href: `/app/orgs/${orgId}/progress`,
            label: 'Progress',
            match: 'prefix' as const,
            icon: LineChart,
          },
        ]
      : []),
    ...(author || role === 'admin' || role === 'owner'
      ? [
          {
            href: `/app/orgs/${orgId}/settings`,
            label: 'Settings',
            match: 'prefix' as const,
            icon: Settings,
          },
        ]
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
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('nav-link', active && 'active')}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
