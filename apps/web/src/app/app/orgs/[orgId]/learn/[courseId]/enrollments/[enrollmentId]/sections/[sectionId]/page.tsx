'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type {
  CourseDto,
  CourseSectionDto,
  CourseTreeDto,
  FormAttemptResultDto,
  LearnerProgressDto,
} from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function SectionReaderPage() {
  const { orgId, courseId, enrollmentId, sectionId } = useParams<{
    orgId: string;
    courseId: string;
    enrollmentId: string;
    sectionId: string;
  }>();

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [tree, setTree] = useState<CourseTreeDto | null>(null);
  const [progress, setProgress] = useState<LearnerProgressDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attemptResults, setAttemptResults] = useState<Record<string, FormAttemptResultDto>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, published, p] = await Promise.all([
        api.getCourse(courseId),
        api.getPublished(courseId),
        api.getProgress(enrollmentId),
      ]);
      setCourse(c);
      setTree(published);
      setProgress(p);
    } catch (err) {
      setError(errorMessage(err, 'Could not load section'));
    } finally {
      setLoading(false);
    }
  }, [courseId, enrollmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () => (tree ? [...tree.sections].sort((a, b) => a.order - b.order) : []),
    [tree],
  );

  const section: CourseSectionDto | null = sections.find((s) => s.id === sectionId) ?? null;

  const completed = new Set(progress?.completedSectionIds ?? []);
  const sequential = true; // default; org settings may refine later

  function isLocked(s: CourseSectionDto): boolean {
    if (!sequential || !progress) return false;
    const prior = sections.filter((x) => x.order < s.order);
    return prior.some((x) => !completed.has(x.id));
  }

  const locked = section ? isLocked(section) : false;

  async function submitForm(blockId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.submitFormAttempt(enrollmentId, blockId, {});
      setAttemptResults((prev) => ({ ...prev, [blockId]: result }));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function markComplete() {
    setBusy(true);
    setActionError(null);
    try {
      const p = await api.completeSection(enrollmentId, sectionId);
      setProgress(p);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!section) return <EmptyState title="Section not found in published tree" />;

  const versionMismatch =
    course?.publishedCommitId &&
    progress?.publishedCommitId &&
    course.publishedCommitId !== progress.publishedCommitId;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{section.title}</h1>
          <p>
            {course?.title ?? 'Course'} · Progress {progress?.percent ?? 0}%
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/app/orgs/${orgId}/learn/${courseId}`}>
          Course detail
        </Link>
      </div>

      {versionMismatch ? (
        <div className="panel">
          <strong>Course updated</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Your progress is for an earlier published version.
          </p>
        </div>
      ) : null}

      <div className="reader-layout">
        <nav className="stepper panel" aria-label="Sections">
          {sections.map((s) => {
            const done = completed.has(s.id);
            const current = s.id === sectionId;
            const lock = isLocked(s);
            const className = [
              'step',
              current ? 'current' : '',
              done ? 'done' : '',
              lock ? 'locked' : '',
            ]
              .filter(Boolean)
              .join(' ');
            if (lock) {
              return (
                <div key={s.id} className={className}>
                  ○ {s.title}
                </div>
              );
            }
            return (
              <Link
                key={s.id}
                className={className}
                href={`/app/orgs/${orgId}/learn/${courseId}/enrollments/${enrollmentId}/sections/${s.id}`}
              >
                {done ? '✓' : '●'} {s.title}
              </Link>
            );
          })}
        </nav>

        <article className="reader-measure">
          {locked ? (
            <EmptyState
              title="Section locked"
              description="Finish earlier sections first (sequential progress is on)."
              action={(() => {
                const firstIncomplete = sections.find((s) => !completed.has(s.id));
                return firstIncomplete ? (
                  <Link
                    className="btn btn-secondary"
                    href={`/app/orgs/${orgId}/learn/${courseId}/enrollments/${enrollmentId}/sections/${firstIncomplete.id}`}
                  >
                    Go to next incomplete
                  </Link>
                ) : null;
              })()}
            />
          ) : (
            <>
              {section.blocks.length === 0 ? (
                <EmptyState title="No blocks in this section" />
              ) : (
                <div className="stack">
                  {section.blocks.map((b) => (
                    <div key={b.id} className="block-card" style={{ background: 'var(--foam)' }}>
                      <div className="meta-row">
                        <span className="badge">{b.type}</span>
                      </div>
                      {b.type === 'text' ? (
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                          {b.markdown}
                        </div>
                      ) : null}
                      {b.type === 'image' ? (
                        <p style={{ marginTop: '0.5rem' }}>
                          Image asset <code>{b.assetId}</code>
                          {b.caption ? ` — ${b.caption}` : ''}
                        </p>
                      ) : null}
                      {b.type === 'graph' ? (
                        <pre className="code-pre" style={{ marginTop: '0.5rem' }}>
                          {b.source}
                        </pre>
                      ) : null}
                      {b.type === 'form' ? (
                        <div className="stack" style={{ marginTop: '0.5rem' }}>
                          <strong>{b.title}</strong>
                          <p className="muted" style={{ margin: 0 }}>
                            Pass rule: {b.passRule}. Full question UI lands in a later slice; submit
                            sends an empty answers shell for wiring.
                          </p>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void submitForm(b.id)}
                          >
                            Submit attempt
                          </Button>
                          {attemptResults[b.id] ? (
                            <p>
                              Result: passed={String(attemptResults[b.id]?.passed)} score=
                              {String(attemptResults[b.id]?.score)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {actionError ? <p className="form-error">{actionError}</p> : null}

              <div className="sticky-actions">
                <Button
                  onClick={() => void markComplete()}
                  disabled={busy || completed.has(sectionId)}
                >
                  {completed.has(sectionId) ? 'Completed' : busy ? 'Saving…' : 'Mark complete'}
                </Button>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
