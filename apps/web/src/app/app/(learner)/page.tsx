'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { CatalogLists } from '@/components/learner/catalog-lists';
import { ProgressMeter } from '@/components/learner/progress-meter';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { api } from '@/lib/api/client';
import type {
  CourseDto,
  CourseEnrollmentRowDto,
  PathDto,
  PathEnrollmentRowDto,
} from '@/lib/api/types';
import { rememberEnrollment } from '@/lib/enrollment-cache';
import { errorMessage } from '@/lib/format';
import { setCachedPathEnrollmentId } from '@/lib/path-enrollment-cache';

export default function LearnerHomePage() {
  const [catalogCourses, setCatalogCourses] = useState<CourseDto[]>([]);
  const [catalogPaths, setCatalogPaths] = useState<PathDto[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollmentRowDto[]>([]);
  const [pathEnrollments, setPathEnrollments] = useState<PathEnrollmentRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([api.getCatalog(), api.getMyEnrollments()])
      .then(([catalog, enrollments]) => {
        if (cancelled) return;
        setCatalogCourses(catalog.courses);
        setCatalogPaths(catalog.paths);
        setCourseEnrollments(enrollments.courses);
        setPathEnrollments(enrollments.paths);
        for (const row of enrollments.courses) {
          rememberEnrollment(row.enrollment.orgId, row.enrollment.id, row.enrollment.courseId);
        }
        for (const row of enrollments.paths) {
          setCachedPathEnrollmentId(row.enrollment.pathId, row.enrollment.id);
        }
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load your home'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enrolled = courseEnrollments.length > 0 || pathEnrollments.length > 0;

  const enrolledCourseIds = useMemo(
    () => new Set(courseEnrollments.map((r) => r.enrollment.courseId)),
    [courseEnrollments],
  );
  const enrolledPathIds = useMemo(
    () => new Set(pathEnrollments.map((r) => r.enrollment.pathId)),
    [pathEnrollments],
  );

  const exploreCourses = useMemo(
    () => catalogCourses.filter((c) => !enrolledCourseIds.has(c.id)),
    [catalogCourses, enrolledCourseIds],
  );
  const explorePaths = useMemo(
    () => catalogPaths.filter((p) => !enrolledPathIds.has(p.id)),
    [catalogPaths, enrolledPathIds],
  );

  if (loading) return <LoadingBlock label="Loading your lessons…" />;
  if (error) return <ErrorState message={error} />;

  if (!enrolled) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Learn</h1>
            <p>Publicly available lessons and paths you can start right away.</p>
          </div>
          <Link className="btn btn-secondary" href="/app/explore">
            Explore
          </Link>
        </div>
        <CatalogLists courses={catalogCourses} paths={catalogPaths} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your lessons</h1>
          <p>Only what you are enrolled in. Explore to discover more.</p>
        </div>
        <Link className="btn btn-primary" href="/app/explore">
          Explore
        </Link>
      </div>

      <section className="panel">
        <h2>Paths</h2>
        {pathEnrollments.length === 0 ? (
          <EmptyState title="No path enrollments" description="Explore to find a path to take." />
        ) : (
          <div className="card-list">
            {pathEnrollments.map((row) => (
              <Link
                key={row.enrollment.id}
                href={`/app/learn/paths/${row.enrollment.pathId}`}
                className="list-row"
              >
                <div>
                  <strong>{row.path?.title ?? 'Path'}</strong>
                  <div className="meta-row">
                    {row.path ? <span>/{row.path.slug}</span> : null}
                    <span className="badge">Path</span>
                  </div>
                  {row.progress ? <ProgressMeter percent={row.progress.percent} /> : null}
                </div>
                <span className="muted">Continue →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Lessons</h2>
        {courseEnrollments.length === 0 ? (
          <EmptyState
            title="No lesson enrollments"
            description="Explore to enroll in a published lesson."
          />
        ) : (
          <div className="card-list">
            {courseEnrollments.map((row) => {
              const courseId = row.enrollment.courseId;
              const href =
                row.progress?.currentSectionId != null
                  ? `/app/learn/courses/${courseId}/enrollments/${row.enrollment.id}/sections/${row.progress.currentSectionId}`
                  : `/app/learn/courses/${courseId}`;
              return (
                <Link key={row.enrollment.id} href={href} className="list-row">
                  <div>
                    <strong>{row.course?.title ?? 'Lesson'}</strong>
                    <div className="meta-row">
                      {row.course ? <span>/{row.course.slug}</span> : null}
                      <span className="badge ok">Enrolled</span>
                    </div>
                    {row.progress ? <ProgressMeter percent={row.progress.percent} /> : null}
                  </div>
                  <span className="muted">Continue →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {exploreCourses.length + explorePaths.length > 0 ? (
        <p className="muted">
          {exploreCourses.length + explorePaths.length} more available in{' '}
          <Link href="/app/explore">Explore</Link>.
        </p>
      ) : null}
    </div>
  );
}
