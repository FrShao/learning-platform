'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { RequireAuth } from '@/components/layout/require-auth';
import { TopBar } from '@/components/layout/top-bar';
import { EmptyState } from '@/components/states/async-state';
import { getLastOrgId } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel } from '@/lib/roles';

export default function OrgPickerPage() {
  return (
    <RequireAuth>
      <OrgPickerInner />
    </RequireAuth>
  );
}

function OrgPickerInner() {
  const { memberships } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const last = getLastOrgId();
    if (last && memberships.some((m) => m.orgId === last)) {
      router.replace(`/app/orgs/${last}`);
      return;
    }
    if (memberships.length === 1) {
      const only = memberships[0];
      if (only) router.replace(`/app/orgs/${only.orgId}`);
    }
  }, [memberships, router]);

  return (
    <div className="app-frame">
      <TopBar />
      <main className="app-main page">
        <div className="page-header">
          <div>
            <h1>Your organizations</h1>
            <p>Choose an organization to continue, or create a new one.</p>
          </div>
          <Link className="btn btn-primary" href="/app/orgs/new">
            Create organization
          </Link>
        </div>
        {memberships.length === 0 ? (
          <EmptyState
            title="No organizations yet"
            description="Create your first organization to start authoring or learning."
            action={
              <Link className="btn btn-primary" href="/app/orgs/new">
                Create organization
              </Link>
            }
          />
        ) : (
          <div className="card-list">
            {memberships.map((m) => (
              <Link key={m.orgId} href={`/app/orgs/${m.orgId}`} className="list-row">
                <div>
                  <strong>{m.org.name}</strong>
                  <div className="meta-row">
                    <span>/{m.org.slug}</span>
                    <span className="badge">{roleLabel(m.role)}</span>
                  </div>
                </div>
                <span className="muted">Open →</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
