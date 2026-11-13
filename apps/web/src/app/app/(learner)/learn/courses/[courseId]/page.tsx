'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ProgressMeter } from '@/components/learner/progress-meter';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/types';
import type { CourseDto, CourseTreeDto, LearnerProgressDto } from '@/lib/api/types';
import { getCachedEnrollmentId, rememberEnrollment } from '@/lib/enrollment-cache';
import { errorMessage } from '@/lib/format';

export default function LearnerCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [published, setPublished] = useState<CourseTreeDto | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LearnerProgressDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProgress = useCallback(
    async (enrollId: string, orgId: string | null) => {
      const p = await api.getProgress(enrollId);
      setEnrollmentId(enrollId);
      setProgress(p);
      rememberEnrollment(orgId, enrollId, courseId);
      return p;
    },
    [courseId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await api.getCourse(courseId);
      setCourse(c);
      if (!c.publishedCommitId) {
        setPublished(null);
        return;
      }
      const tree = await api.getPublished(courseId);
      setPublished(tree);

      const cached = getCachedEnrollmentId(c.orgId, courseId);
      if (cached) {
        try {
          await loadProgress(cached, c.orgId);
        } catch {
          setEnrollmentId(null);
          setProgress(null);
        }
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not load course'));
    } finally {
      setLoading(false);
    }
  }, [courseId, loadProgress]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enrollOrResume() {
    setBusy(true);
    setError(null);
    try {
      let enrollId = enrollmentId;
      let p = progress;
      const orgId = course?.orgId ?? null;

      if (!enrollId) {
        try {
          const result = await api.enroll(courseId);
          enrollId = result.enrollment.id;
          rememberEnrollment(orgId, enrollId, courseId);
          setEnrollmentId(enrollId);
          p = result.progress;
          if (p) setProgress(p);
        } catch (err) {
          if (err instanceof ApiError && err.code === 'conflict') {
            const details = err.details as { enrollmentId?: string } | undefined;
            if (details?.enrollmentId) {
              enrollId = details.enrollmentId;
              rememberEnrollment(orgId, enrollId, courseId);
              p = await loadProgress(enrollId, orgId);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }

      if (!p && enrollId) {
        p = await loadProgress(enrollId, orgId);
      }

      const first =
        p?.currentSectionId ?? published?.sections.slice().sort((a, b) => a.order - b.order)[0]?.id;
      if (enrollId && first) {
        router.push(`/app/learn/courses/${courseId}/enrollments/${enrollId}/sections/${first}`);
      }
    } catch (err) {
      setError(errorMessage(err, 'Enrollment failed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && !course) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!course) return <EmptyState title="Course not found" />;

  if (!course.publishedCommitId) {
    return (
      <EmptyState
        title="Not published"
        description="This course has no published commit yet."
        action={
          <Link className="btn btn-secondary" href="/app/explore">
            Back to explore
          </Link>
        }
      />
    );
  }

  const sections = published?.sections.slice().sort((a, b) => a.order - b.order) ?? [];
  const completed = new Set(progress?.completedSectionIds ?? []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted">
            <Link href="/app">Home</Link> / Lesson
          </p>
          <h1>{course.title}</h1>
          <p>{course.description || 'Published lesson overview.'}</p>
        </div>
        <Button onClick={() => void enrollOrResume()} disabled={busy}>
          {busy
            ? 'Opening…'
            : enrollmentId
              ? progress?.percent === 100
                ? 'Review lesson'
                : 'Continue'
              : 'Enroll & start'}
        </Button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {progress ? (
        <div className="panel">
          <div className="meta-row" style={{ justifyContent: 'space-between' }}>
            <strong>Your progress</strong>
            <span className="badge ok">
              {completed.size}/{sections.length} sections
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <ProgressMeter percent={progress.percent} />
          </div>
          {progress.currentSectionId ? (
            <div style={{ marginTop: '0.85rem' }}>
              <Link
                className="btn btn-secondary"
                href={`/app/learn/courses/${courseId}/enrollments/${progress.enrollmentId}/sections/${progress.currentSectionId}`}
              >
                Resume current section
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Outline</h2>
        {sections.length === 0 ? (
          <EmptyState title="No sections in published tree" />
        ) : (
          <div className="card-list">
            {sections.map((s) => {
              const done = completed.has(s.id);
              const current = progress?.currentSectionId === s.id;
              return (
                <div key={s.id} className="list-row">
                  <div>
                    <strong>
                      {s.order + 1}. {s.title}
                    </strong>
                    <div className="meta-row">
                      <span>/{s.slug}</span>
                      <span>{s.blocks.length} blocks</span>
                      {done ? <span className="badge ok">Done</span> : null}
                      {current && !done ? <span className="badge">Current</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
