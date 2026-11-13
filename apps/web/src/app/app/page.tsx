'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { RequireAuth } from '@/components/layout/require-auth';
import { TopBar } from '@/components/layout/top-bar';
import { EmptyState } from '@/components/states/async-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    // Do not auto-redirect when the user has no orgs — personal library is available.
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
            <h1>Where to work</h1>
            <p>Use your personal library without an org, or open an organization.</p>
          </div>
          <div className="cta-row">
            <Button variant="secondary" render={<Link href="/app/me" />}>
              Personal library
            </Button>
            <Button render={<Link href="/app/orgs/new" />}>Create organization</Button>
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
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
          {memberships.length === 0 ? (
            <EmptyState
              title="No organizations yet"
              description="Optional: create an organization to collaborate with a team."
              action={<Button render={<Link href="/app/orgs/new" />}>Create organization</Button>}
            />
          ) : (
            memberships.map((m) => (
              <Link key={m.orgId} href={`/app/orgs/${m.orgId}`} className="list-row">
                <div>
                  <strong>{m.org.name}</strong>
                  <div className="meta-row">
                    <span>/{m.org.slug}</span>
                    <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
