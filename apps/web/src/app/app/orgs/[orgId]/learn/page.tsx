'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { api } from '@/lib/api/client';
import type { CourseDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function CatalogPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .listCourses(orgId)
      .then((data) => {
        if (!cancelled) {
          setCourses(data);
          setError(null);
        }
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
          <p>Published courses available in this organization.</p>
        </div>
      </div>

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
                  <span className="badge ok">Published</span>
                </div>
                {c.description ? <p className="muted">{c.description}</p> : null}
              </div>
              <span className="muted">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
