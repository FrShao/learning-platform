'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ProgressMeter } from '@/components/learner/progress-meter';
import { EmptyState, LoadingBlock } from '@/components/states/async-state';
import { api } from '@/lib/api/client';
import type { CourseDto, LearnerProgressDto } from '@/lib/api/types';
import { listCachedEnrollments } from '@/lib/enrollment-cache';
import { errorMessage } from '@/lib/format';

type ProgressRow = {
  enrollmentId: string;
  progress: LearnerProgressDto | null;
  course: CourseDto | null;
  error: string | null;
};

export default function ProgressPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ids = listCachedEnrollments(orgId);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all(
      ids.map(async (enrollmentId) => {
        try {
          const progress = await api.getProgress(enrollmentId);
          const course = progress.courseId
            ? await api.getCourse(progress.courseId).catch(() => null)
            : null;
          return { enrollmentId, progress, course, error: null } satisfies ProgressRow;
        } catch (err) {
          return {
            enrollmentId,
            progress: null,
            course: null,
            error: errorMessage(err, 'Could not load progress'),
          } satisfies ProgressRow;
        }
      }),
    ).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) return <LoadingBlock />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My progress</h1>
          <p>
            Shows enrollments remembered in this browser. A list-enrollments API is not available
            yet, so this hub cannot discover enrollments from other devices.
          </p>
        </div>
        <Link className="btn btn-secondary" href={`/app/orgs/${orgId}/learn`}>
          Browse catalog
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No enrollments in this browser"
          description="Enroll from a course detail page to start tracking progress here."
          action={
            <Link className="btn btn-primary" href={`/app/orgs/${orgId}/learn`}>
              Go to Learn
            </Link>
          }
        />
      ) : (
        <div className="card-list">
          {rows.map((row) => (
            <div key={row.enrollmentId} className="list-row">
              <div style={{ flex: 1 }}>
                <strong>
                  {row.course?.title ?? `Enrollment ${row.enrollmentId.slice(0, 8)}…`}
                </strong>
                {row.progress ? (
                  <div style={{ marginTop: '0.55rem', maxWidth: 280 }}>
                    <ProgressMeter percent={row.progress.percent} />
                    <div className="meta-row" style={{ marginTop: '0.4rem' }}>
                      <span>
                        {row.progress.completedSectionIds.length} section
                        {row.progress.completedSectionIds.length === 1 ? '' : 's'} done
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="form-error" style={{ margin: '0.35rem 0 0' }}>
                    {row.error}
                  </p>
                )}
              </div>
              {row.progress?.currentSectionId ? (
                <Link
                  className="btn btn-secondary"
                  href={`/app/orgs/${orgId}/learn/${row.progress.courseId}/enrollments/${row.enrollmentId}/sections/${row.progress.currentSectionId}`}
                >
                  Resume
                </Link>
              ) : row.progress?.courseId ? (
                <Link
                  className="btn btn-ghost"
                  href={`/app/orgs/${orgId}/learn/${row.progress.courseId}`}
                >
                  Open
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
