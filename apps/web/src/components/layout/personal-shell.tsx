'use client';

import { BookOpen, Building2, Compass, Home, Library, Route } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireAuth } from './require-auth';
import { TopBar } from './top-bar';

import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PersonalShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <PersonalShellInner>{children}</PersonalShellInner>
    </RequireAuth>
  );
}

function PersonalShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const items = [
    { href: '/app', label: 'Learn', exact: true, icon: Compass },
    { href: '/app/account/lessons', label: 'Lessons', exact: true, icon: Library },
    { href: '/app/me', label: 'Library', exact: true, icon: Home },
    { href: '/app/me/courses', label: 'Courses', icon: BookOpen },
    { href: '/app/me/paths', label: 'Paths', icon: Route },
  ];

  return (
    <div className="app-frame">
      <TopBar personal />
      <div className="app-body">
        <aside className="side-rail" aria-label="Personal library navigation">
          <nav className="primary-nav primary-nav-side" aria-label="Personal">
            {items.map((item) => {
              const active = isActive(pathname, item.href, item.exact === true);
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
          <p className="side-rail-hint">
            Personal courses and paths are owned by you — no organization required.
          </p>
          <p className="side-rail-hint">
            <Link
              href="/app/workspaces"
              className="inline-flex items-center gap-1 font-semibold text-primary"
            >
              Organizations
              <Building2 className="size-3.5" aria-hidden />
            </Link>
          </p>
        </aside>
        <main className="app-main">{children}</main>
      </div>
      <div className="bottom-nav-wrap">
        <nav className="primary-nav primary-nav-bottom" aria-label="Personal">
          {items.map((item) => {
            const active = isActive(pathname, item.href, item.exact === true);
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
      </div>
    </div>
  );
}
