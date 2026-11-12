'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel } from '@/lib/roles';

export function TopBar({
  orgId,
  orgName,
  personal,
}: {
  orgId?: string | undefined;
  orgName?: string | undefined;
  personal?: boolean | undefined;
}) {
  const { user, memberships, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);

  const currentRole = memberships.find((m) => m.orgId === orgId)?.role;
  const showSwitcher = Boolean(orgId) || personal;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <Link href={orgId ? `/app/orgs/${orgId}` : personal ? '/app/me' : '/app'} className="brand-mark">
          Learning<span>Platform</span>
        </Link>
        {showSwitcher ? (
          <div className="org-switcher">
            <button
              type="button"
              className="org-switcher-btn"
              aria-expanded={orgOpen}
              onClick={() => setOrgOpen((v) => !v)}
            >
              <span className="org-switcher-label">
                {personal ? 'Personal library' : (orgName ?? 'Organization')}
              </span>
              {!personal && currentRole ? (
                <span className="role-chip">{roleLabel(currentRole)}</span>
              ) : null}
              <span aria-hidden>▾</span>
            </button>
            {orgOpen ? (
              <div className="dropdown-panel">
                <Link
                  href="/app/me"
                  className={personal ? 'dropdown-item active' : 'dropdown-item'}
                  onClick={() => setOrgOpen(false)}
                >
                  <strong>Personal library</strong>
                  <span>Your courses & paths</span>
                </Link>
                {memberships.map((m) => (
                  <Link
                    key={m.orgId}
                    href={`/app/orgs/${m.orgId}`}
                    className={m.orgId === orgId ? 'dropdown-item active' : 'dropdown-item'}
                    onClick={() => setOrgOpen(false)}
                  >
                    <strong>{m.org.name}</strong>
                    <span>{roleLabel(m.role)}</span>
                  </Link>
                ))}
                <Link
                  href="/app/orgs/new"
                  className="dropdown-item"
                  onClick={() => setOrgOpen(false)}
                >
                  Create organization
                </Link>
                <Link href="/app" className="dropdown-item" onClick={() => setOrgOpen(false)}>
                  All organizations
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="top-bar-right">
        {user ? (
          <div className="user-menu">
            <button
              type="button"
              className="user-menu-btn"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user.name}
            </button>
            {menuOpen ? (
              <div className="dropdown-panel align-end">
                <div className="dropdown-meta">{user.email}</div>
                <Button
                  variant="ghost"
                  className="dropdown-item-btn"
                  onClick={() => {
                    signOut();
                    router.push('/login');
                  }}
                >
                  Sign out
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
