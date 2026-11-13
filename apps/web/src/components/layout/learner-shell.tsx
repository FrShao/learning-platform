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

export function LearnerShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <LearnerShellInner>{children}</LearnerShellInner>
    </RequireAuth>
  );
}

function LearnerShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const items = [
    { href: '/app', label: 'Home', exact: true },
    { href: '/app/explore', label: 'Explore', exact: true },
    { href: '/app/account/lessons', label: 'Lessons', exact: true },
  ];

  return (
    <div className="app-frame">
      <TopBar learner />
      <div className="app-body">
        <aside className="side-rail" aria-label="Learner navigation">
          <nav className="primary-nav primary-nav-side" aria-label="Learner">
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
          <p className="side-rail-hint">Continue lessons you are taking, or explore the catalog.</p>
        </aside>
        <main className="app-main">{children}</main>
      </div>
      <div className="bottom-nav-wrap">
        <nav className="primary-nav primary-nav-bottom" aria-label="Learner">
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
