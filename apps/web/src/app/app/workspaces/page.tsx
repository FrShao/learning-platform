'use client';

import Link from 'next/link';

import { RequireAuth } from '@/components/layout/require-auth';
import { TopBar } from '@/components/layout/top-bar';
import { EmptyState } from '@/components/states/async-state';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel } from '@/lib/roles';

export default function WorkspacesPage() {
  return (
    <RequireAuth>
      <WorkspacesInner />
    </RequireAuth>
  );
}

function WorkspacesInner() {
  const { memberships } = useAuth();

  return (
    <div className="app-frame">
      <TopBar />
      <main className="app-main page">
        <div className="page-header">
          <div>
            <h1>Organizations</h1>
            <p>
              Organization management and authoring live here. Learning starts from{' '}
              <Link href="/app">home</Link>.
            </p>
          </div>
          <div className="cta-row">
            <Link className="btn btn-secondary" href="/app/account/lessons">
              Account lessons
            </Link>
            <Link className="btn btn-secondary" href="/app/me">
              Personal library
            </Link>
            <Link className="btn btn-primary" href="/app/orgs/new">
              Create organization
            </Link>
          </div>
        </div>
        <div className="card-list">
          <Link href="/app/me" className="list-row">
            <div>
              <strong>Personal library</strong>
              <div className="meta-row">
                <span>Courses and paths you own — no organization required</span>
              </div>
            </div>
            <span className="muted">Open →</span>
          </Link>
          {memberships.length === 0 ? (
            <EmptyState
              title="No organizations yet"
              description="Optional: create an organization to collaborate with a team."
              action={
                <Link className="btn btn-primary" href="/app/orgs/new">
                  Create organization
                </Link>
              }
            />
          ) : (
            memberships.map((m) => (
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
            ))
          )}
        </div>
      </main>
    </div>
  );
}
