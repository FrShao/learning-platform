'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { api } from '@/lib/api/client';
import type { CourseDto, PathDto } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';
import { canAuthor, roleLabel } from '@/lib/roles';

type OrgBundle = {
  orgId: string;
  orgName: string;
  roleLabel: string;
  courses: CourseDto[];
  paths: PathDto[];
};

export default function AccountLessonsPage() {
  const { memberships } = useAuth();
  const [personalCourses, setPersonalCourses] = useState<CourseDto[]>([]);
  const [personalPaths, setPersonalPaths] = useState<PathDto[]>([]);
  const [orgBundles, setOrgBundles] = useState<OrgBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const authorMemberships = memberships.filter((m) => canAuthor(m.role));

    void Promise.all([
      api.listPersonalCourses().catch(() => [] as CourseDto[]),
      api.listPersonalPaths().catch(() => [] as PathDto[]),
      ...authorMemberships.map(async (m) => {
        const [courses, paths] = await Promise.all([
          api.listCourses(m.orgId).catch(() => [] as CourseDto[]),
          api.listPaths(m.orgId).catch(() => [] as PathDto[]),
        ]);
        return {
          orgId: m.orgId,
          orgName: m.org.name,
          roleLabel: roleLabel(m.role),
          courses,
          paths,
        } satisfies OrgBundle;
      }),
    ])
      .then(([courses, paths, ...bundles]) => {
        if (cancelled) return;
        setPersonalCourses(courses as CourseDto[]);
        setPersonalPaths(paths as PathDto[]);
        setOrgBundles(bundles as OrgBundle[]);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load your lessons'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberships]);

  if (loading) return <LoadingBlock label="Loading managed lessons…" />;
  if (error) return <ErrorState message={error} />;

  const hasAnything =
    personalCourses.length > 0 ||
    personalPaths.length > 0 ||
    orgBundles.some((b) => b.courses.length > 0 || b.paths.length > 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Lessons</h1>
          <p>
            Manage lessons and paths you own, plus those owned by organizations where you can
            author. This is not the public catalog.
          </p>
        </div>
        <div className="cta-row">
          <Link className="btn btn-secondary" href="/app/me/courses">
            Personal courses
          </Link>
          <Link className="btn btn-secondary" href="/app/me/paths">
            Personal paths
          </Link>
          <Link className="btn btn-primary" href="/app/workspaces">
            Organizations
          </Link>
        </div>
      </div>

      {!hasAnything ? (
        <EmptyState
          title="No managed lessons yet"
          description="Create a personal course or path, or open an organization where you author."
          action={
            <div className="cta-row">
              <Link className="btn btn-primary" href="/app/me/courses">
                Create personal course
              </Link>
              <Link className="btn btn-secondary" href="/app/workspaces">
                Open organizations
              </Link>
            </div>
          }
        />
      ) : null}

      <section className="panel">
        <div className="page-header" style={{ marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Yours</h2>
          <Link className="btn btn-ghost" href="/app/me">
            Personal library →
          </Link>
        </div>
        {personalCourses.length === 0 && personalPaths.length === 0 ? (
          <p className="muted">No personal courses or paths yet.</p>
        ) : (
          <div className="card-list">
            {personalPaths.map((p) => (
              <Link key={p.id} href={`/app/me/paths/${p.id}`} className="list-row">
                <div>
                  <strong>{p.title}</strong>
                  <div className="meta-row">
                    <span>/{p.slug}</span>
                    <span className="badge">Path</span>
                    <span className="badge">You</span>
                  </div>
                </div>
                <span className="muted">Manage →</span>
              </Link>
            ))}
            {personalCourses.map((c) => (
              <Link key={c.id} href={`/app/me/courses/${c.id}`} className="list-row">
                <div>
                  <strong>{c.title}</strong>
                  <div className="meta-row">
                    <span>/{c.slug}</span>
                    <span className="badge">Lesson</span>
                    <span className="badge">You</span>
                    {c.publishedCommitId ? (
                      <span className="badge ok">Published</span>
                    ) : (
                      <span className="badge warn">Unpublished</span>
                    )}
                  </div>
                </div>
                <span className="muted">Manage →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {orgBundles.map((bundle) => (
        <section key={bundle.orgId} className="panel">
          <div className="page-header" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{bundle.orgName}</h2>
              <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                {bundle.roleLabel} · organization-owned content
              </p>
            </div>
            <div className="cta-row">
              <Link className="btn btn-ghost" href={`/app/orgs/${bundle.orgId}/courses`}>
                Courses
              </Link>
              <Link className="btn btn-ghost" href={`/app/orgs/${bundle.orgId}/paths`}>
                Paths
              </Link>
              <Link className="btn btn-secondary" href={`/app/orgs/${bundle.orgId}/settings`}>
                Settings
              </Link>
            </div>
          </div>
          {bundle.courses.length === 0 && bundle.paths.length === 0 ? (
            <p className="muted">No courses or paths in this organization yet.</p>
          ) : (
            <div className="card-list">
              {bundle.paths.map((p) => (
                <Link
                  key={p.id}
                  href={`/app/orgs/${bundle.orgId}/paths/${p.id}`}
                  className="list-row"
                >
                  <div>
                    <strong>{p.title}</strong>
                    <div className="meta-row">
                      <span>/{p.slug}</span>
                      <span className="badge">Path</span>
                    </div>
                  </div>
                  <span className="muted">Manage →</span>
                </Link>
              ))}
              {bundle.courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/orgs/${bundle.orgId}/courses/${c.id}`}
                  className="list-row"
                >
                  <div>
                    <strong>{c.title}</strong>
                    <div className="meta-row">
                      <span>/{c.slug}</span>
                      <span className="badge">Lesson</span>
                      {c.publishedCommitId ? (
                        <span className="badge ok">Published</span>
                      ) : (
                        <span className="badge warn">Unpublished</span>
                      )}
                    </div>
                  </div>
                  <span className="muted">Manage →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}

      {memberships.length > 0 && orgBundles.length === 0 ? (
        <p className="muted">
          You belong to organizations but do not have an authoring role. Organization settings and
          membership stay under <Link href="/app/workspaces">Organizations</Link>.
        </p>
      ) : null}
    </div>
  );
}
