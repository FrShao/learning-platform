'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireAuth } from './require-auth';
import { TopBar } from './top-bar';

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
    { href: '/app', label: 'Learn', exact: true },
    { href: '/app/account/lessons', label: 'Lessons', exact: true },
    { href: '/app/me', label: 'Library', exact: true },
    { href: '/app/me/courses', label: 'Courses' },
    { href: '/app/me/paths', label: 'Paths' },
  ];

  return (
    <div className="app-frame">
      <TopBar personal />
      <div className="app-body">
        <aside className="side-rail" aria-label="Personal library navigation">
          <nav className="primary-nav primary-nav-side" aria-label="Personal">
            {items.map((item) => {
              const active = isActive(pathname, item.href, item.exact === true);
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
          <p className="side-rail-hint">
            Personal courses and paths are owned by you — no organization required.
          </p>
          <p className="side-rail-hint">
            <Link href="/app/workspaces">Organizations →</Link>
          </p>
        </aside>
        <main className="app-main">{children}</main>
      </div>
      <div className="bottom-nav-wrap">
        <nav className="primary-nav primary-nav-bottom" aria-label="Personal">
          {items.map((item) => {
            const active = isActive(pathname, item.href, item.exact === true);
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
      </div>
    </div>
  );
}
