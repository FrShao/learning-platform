'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { CourseDto, CourseTreeDto, LearnerProgressDto } from '@/lib/api/types';
import { rememberEnrollment } from '@/lib/enrollment-cache';
import { errorMessage } from '@/lib/format';

export default function LearnerCourseDetailPage() {
  const { orgId, courseId } = useParams<{ orgId: string; courseId: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [published, setPublished] = useState<CourseTreeDto | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LearnerProgressDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    } catch (err) {
      setError(errorMessage(err, 'Could not load course'));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      const enrollment = await api.enroll(courseId);
      rememberEnrollment(orgId, enrollment.id);
      setEnrollmentId(enrollment.id);
      const p = await api.getProgress(enrollment.id).catch(() => null);
      setProgress(p);
      const first =
        p?.currentSectionId ?? published?.sections.slice().sort((a, b) => a.order - b.order)[0]?.id;
      if (first) {
        router.push(
          `/app/orgs/${orgId}/learn/${courseId}/enrollments/${enrollment.id}/sections/${first}`,
        );
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
          <Link className="btn btn-secondary" href={`/app/orgs/${orgId}/learn`}>
            Back to catalog
          </Link>
        }
      />
    );
  }

  const sections = published?.sections.slice().sort((a, b) => a.order - b.order) ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{course.title}</h1>
          <p>{course.description || 'Published course overview.'}</p>
        </div>
        <Button onClick={() => void enroll()} disabled={busy}>
          {busy ? 'Enrolling…' : enrollmentId ? 'Open enrollment' : 'Enroll'}
        </Button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {progress ? (
        <div className="panel">
          <strong>Progress {progress.percent}%</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Resume at section {progress.currentSectionId ?? '—'}
          </p>
          {progress.currentSectionId ? (
            <div style={{ marginTop: '0.75rem' }}>
              <Link
                className="btn btn-secondary"
                href={`/app/orgs/${orgId}/learn/${courseId}/enrollments/${progress.enrollmentId}/sections/${progress.currentSectionId}`}
              >
                Resume
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
            {sections.map((s) => (
              <div key={s.id} className="list-row">
                <div>
                  <strong>
                    {s.order + 1}. {s.title}
                  </strong>
                  <div className="meta-row">
                    <span>/{s.slug}</span>
                    <span>{s.blocks.length} blocks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
