'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { CourseDto, OrganizationDto } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';
import { canAuthor, canManageApiKeys } from '@/lib/roles';

export default function OrgHomePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  const role = memberships.find((m) => m.orgId === orgId)?.role ?? null;
  const author = canAuthor(role);

  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([api.getOrg(orgId), api.listCourses(orgId).catch(() => [] as CourseDto[])])
      .then(([orgData, courseData]) => {
        if (cancelled) return;
        setOrg(orgData);
        setCourses(courseData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load home'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const published = useMemo(() => courses.filter((c) => c.publishedCommitId != null), [courses]);
  const recent = useMemo(() => courses.slice(0, 5), [courses]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} />;
  if (!org) return <EmptyState title="Organization not found" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{org.name}</h1>
          <p>
            {author
              ? 'Jump into courses to edit working trees, or open Learn for the published catalog.'
              : 'Continue learning from published courses in this organization.'}
          </p>
        </div>
      </div>

      <div className="hub-grid">
        {author ? (
          <Link className="hub-tile" href={`/app/orgs/${orgId}/courses`}>
            <h3>Courses</h3>
            <p>Author working trees, commit, and publish.</p>
          </Link>
        ) : null}
        {author ? (
          <Link className="hub-tile" href={`/app/orgs/${orgId}/paths`}>
            <h3>Paths</h3>
            <p>Build ordered lesson trees across published courses.</p>
          </Link>
        ) : null}
        <Link className="hub-tile" href={`/app/orgs/${orgId}/learn`}>
          <h3>Learn</h3>
          <p>
            {published.length
              ? `${published.length} published course${published.length === 1 ? '' : 's'}`
              : 'Browse published courses'}
          </p>
        </Link>
        {!author ? (
          <Link className="hub-tile" href={`/app/orgs/${orgId}/progress`}>
            <h3>Progress</h3>
            <p>Resume enrollments remembered in this browser.</p>
          </Link>
        ) : null}
        {canManageApiKeys(role) ? (
          <Link className="hub-tile" href={`/app/orgs/${orgId}/settings/api-keys`}>
            <h3>API keys</h3>
            <p>Issue keys for external tools and integrations.</p>
          </Link>
        ) : null}
        {author ? (
          <Link className="hub-tile" href={`/app/orgs/${orgId}/settings`}>
            <h3>Settings</h3>
            <p>Members, keys, and organization details.</p>
          </Link>
        ) : null}
      </div>

      {author ? (
        <section className="stack">
          <div className="page-header">
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Recent courses</h2>
            <Button variant="secondary" render={<Link href={`/app/orgs/${orgId}/courses`} />}>
              View all
            </Button>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="No courses yet"
              description="Create a course to start a working tree on the main branch."
              action={
                <Button render={<Link href={`/app/orgs/${orgId}/courses`} />}>Go to courses</Button>
              }
            />
          ) : (
            <div className="card-list">
              {recent.map((c) => (
                <Link key={c.id} href={`/app/orgs/${orgId}/courses/${c.id}`} className="list-row">
                  <div>
                    <strong>{c.title}</strong>
                    <div className="meta-row">
                      <span>/{c.slug}</span>
                      {c.publishedCommitId ? (
                        <Badge
                          variant="secondary"
                          className="bg-[var(--accent-soft)] text-[var(--accent-deep)] border-0"
                        >
                          Published
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-700/20 bg-[#fff1d6] text-[var(--warn)]"
                        >
                          Unpublished
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="stack">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Published catalog</h2>
          {published.length === 0 ? (
            <EmptyState
              title="Nothing published yet"
              description="When an author publishes a course, it will show up here."
            />
          ) : (
            <div className="card-list">
              {published.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/app/orgs/${orgId}/learn/${c.id}`} className="list-row">
                  <strong>{c.title}</strong>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
