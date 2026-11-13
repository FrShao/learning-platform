'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { CourseDto, PathDto } from '@/lib/api/types';
import { listCachedEnrollments } from '@/lib/enrollment-cache';
import { errorMessage } from '@/lib/format';

export default function CatalogPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [paths, setPaths] = useState<PathDto[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEnrolledCount(listCachedEnrollments(orgId).length);
    void Promise.all([
      api.listCourses(orgId).catch(() => [] as CourseDto[]),
      api.listPaths(orgId).catch(() => [] as PathDto[]),
    ])
      .then(([courseData, pathData]) => {
        if (cancelled) return;
        const list = Array.isArray(courseData)
          ? courseData
          : ((courseData as { courses?: CourseDto[] }).courses ?? []);
        setCourses(list);
        setPaths(pathData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load catalog'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const published = useMemo(() => courses.filter((c) => c.publishedCommitId != null), [courses]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Learn</h1>
          <p>Published courses and learning paths in this organization.</p>
        </div>
        {enrolledCount > 0 ? (
          <Button variant="secondary" render={<Link href={`/app/orgs/${orgId}/progress`} />}>
            My progress ({enrolledCount})
          </Button>
        ) : null}
      </div>

      <section className="panel">
        <h2>Paths</h2>
        {paths.length === 0 ? (
          <EmptyState title="No paths" description="Authors can create ordered lesson journeys." />
        ) : (
          <div className="card-list">
            {paths.map((p) => (
              <Link key={p.id} href={`/app/orgs/${orgId}/learn/paths/${p.id}`} className="list-row">
                <div>
                  <strong>{p.title}</strong>
                  <div className="meta-row">
                    <span>/{p.slug}</span>
                    <Badge variant="secondary">Path</Badge>
                  </div>
                  {p.description ? <p className="muted">{p.description}</p> : null}
                </div>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Courses</h2>
        {published.length === 0 ? (
          <EmptyState
            title="No published courses"
            description="Only courses with a published commit appear in the catalog."
          />
        ) : (
          <div className="card-list">
            {published.map((c) => (
              <Link key={c.id} href={`/app/orgs/${orgId}/learn/${c.id}`} className="list-row">
                <div>
                  <strong>{c.title}</strong>
                  <div className="meta-row">
                    <span>/{c.slug}</span>
                    <Badge
                      variant="secondary"
                      className="bg-[var(--accent-soft)] text-[var(--accent-deep)] border-0"
                    >
                      Published
                    </Badge>
                  </div>
                  {c.description ? <p className="muted">{c.description}</p> : null}
                </div>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
