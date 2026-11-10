'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { PrimaryNav } from './primary-nav';
import { RequireAuth } from './require-auth';
import { TopBar } from './top-bar';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { api, setLastOrgId } from '@/lib/api/client';
import type { OrganizationDto } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';
import { canAuthor } from '@/lib/roles';

export function OrgShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <OrgShellInner>{children}</OrgShellInner>
    </RequireAuth>
  );
}

function OrgShellInner({ children }: { children: ReactNode }) {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { memberships } = useAuth();
  const membership = useMemo(
    () => memberships.find((m) => m.orgId === orgId) ?? null,
    [memberships, orgId],
  );
  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLastOrgId(orgId);
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .getOrg(orgId)
      .then((data) => {
        if (!cancelled) setOrg(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'forbidden') {
          setError('You do not have access to this organization.');
        } else {
          setError(errorMessage(err, 'Could not load organization.'));
        }
        setOrg(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const role = membership?.role ?? null;
  const showAuthorNav = canAuthor(role);

  return (
    <div className="app-frame">
      <TopBar orgId={orgId} orgName={org?.name ?? membership?.org.name} />
      <div className="app-body">
        <aside className="side-rail" aria-label="Organization navigation">
          <PrimaryNav orgId={orgId} role={role} variant="side" />
          {showAuthorNav ? (
            <p className="side-rail-hint">
              Authoring mode uses working trees, commits, and publish.
            </p>
          ) : (
            <p className="side-rail-hint">Learning mode shows published courses only.</p>
          )}
        </aside>
        <main className="app-main">
          {loading ? <LoadingBlock label="Loading organization…" /> : null}
          {!loading && error ? (
            <ErrorState title="Organization unavailable" message={error} />
          ) : null}
          {!loading && !error && !org ? (
            <EmptyState
              title="Organization not found"
              description="Check the link or pick another org."
            />
          ) : null}
          {!loading && !error && org ? children : null}
        </main>
      </div>
      <div className="bottom-nav-wrap">
        <PrimaryNav orgId={orgId} role={role} variant="bottom" />
      </div>
    </div>
  );
}
