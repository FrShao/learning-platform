'use client';

import { CheckCircle2, CircleDot, Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AssetPreview } from '@/components/course/asset-preview';
import { FormAttemptPanel } from '@/components/learner/form-attempt-panel';
import { ProgressMeter } from '@/components/learner/progress-meter';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type {
  AnswerValueDto,
  CourseDto,
  CourseSectionDto,
  CourseTreeDto,
  FormAttemptResultDto,
  LearnerProgressDto,
} from '@/lib/api/types';
import { rememberEnrollment } from '@/lib/enrollment-cache';
import { errorMessage } from '@/lib/format';
import { describeGraphBlock, resolveFormSpec } from '@/lib/learner/form-blocks';

function LearnerAssetImage({ assetId, alt }: { assetId: string; alt?: string }) {
  return alt !== undefined ? (
    <AssetPreview assetId={assetId} alt={alt} className="asset-preview" />
  ) : (
    <AssetPreview assetId={assetId} className="asset-preview" />
  );
}

export default function SectionReaderPage() {
  const { orgId, courseId, enrollmentId, sectionId } = useParams<{
    orgId: string;
    courseId: string;
    enrollmentId: string;
    sectionId: string;
  }>();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [tree, setTree] = useState<CourseTreeDto | null>(null);
  const [progress, setProgress] = useState<LearnerProgressDto | null>(null);
  const [orgSequential, setOrgSequential] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attemptResults, setAttemptResults] = useState<Record<string, FormAttemptResultDto>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, published, p, org] = await Promise.all([
        api.getCourse(courseId),
        api.getPublished(courseId),
        api.getProgress(enrollmentId),
        api.getOrg(orgId).catch(() => null),
      ]);
      setCourse(c);
      setTree(published);
      setProgress(p);
      rememberEnrollment(orgId, enrollmentId, courseId);
      setOrgSequential(org?.settings?.enforceSequentialProgress ?? true);
    } catch (err) {
      setError(errorMessage(err, 'Could not load section'));
    } finally {
      setLoading(false);
    }
  }, [courseId, enrollmentId, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () => (tree ? [...tree.sections].sort((a, b) => a.order - b.order) : []),
    [tree],
  );

  const section: CourseSectionDto | null = sections.find((s) => s.id === sectionId) ?? null;
  const sectionIndex = section ? sections.findIndex((s) => s.id === section.id) : -1;
  const nextSection = sectionIndex >= 0 ? (sections[sectionIndex + 1] ?? null) : null;

  const completed = new Set(progress?.completedSectionIds ?? []);

  function isLocked(s: CourseSectionDto): boolean {
    if (!orgSequential || !progress) return false;
    const prior = sections.filter((x) => x.order < s.order);
    return prior.some((x) => !completed.has(x.id));
  }

  const locked = section ? isLocked(section) : false;
  const formsPassed = useMemo(() => {
    if (!section) return true;
    const formBlocks = section.blocks.filter((b) => b.type === 'form');
    if (formBlocks.length === 0) return true;
    return formBlocks.every((b) => attemptResults[b.id]?.passed === true);
  }, [section, attemptResults]);

  async function submitForm(blockId: string, answers: AnswerValueDto[]) {
    setBusy(true);
    setActionError(null);
    setCompleteMessage(null);
    try {
      const result = await api.submitFormAttempt(enrollmentId, blockId, answers);
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
    setCompleteMessage(null);
    try {
      const p = await api.completeSection(enrollmentId, sectionId);
      setProgress(p);
      setCompleteMessage(
        p.percent === 100
          ? 'Course complete — nice work.'
          : nextSection
            ? 'Section complete. Continue to the next lesson when ready.'
            : 'Section complete.',
      );
      if (nextSection && p.completedSectionIds.includes(sectionId)) {
        // stay on page so learner sees feedback; next CTA below
      }
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

  const sectionDone = completed.has(sectionId);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted">
            <Link href={`/app/orgs/${orgId}/learn/${courseId}`}>{course?.title ?? 'Course'}</Link>
            {' / '}
            Lesson {sectionIndex + 1}
          </p>
          <h1>{section.title}</h1>
          <div style={{ marginTop: '0.65rem', maxWidth: 320 }}>
            <ProgressMeter percent={progress?.percent ?? 0} />
          </div>
        </div>
        <Button variant="ghost" render={<Link href={`/app/orgs/${orgId}/learn/${courseId}`} />}>
          Course outline
        </Button>
      </div>

      {versionMismatch ? (
        <div className="panel banner-warn">
          <strong>Course updated</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Your progress is for an earlier published version. You can keep working on that
            snapshot.
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
                  <span className="inline-flex items-center gap-2">
                    <Lock className="size-3.5 opacity-70" aria-hidden />
                    {s.title}
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={s.id}
                className={className}
                href={`/app/orgs/${orgId}/learn/${courseId}/enrollments/${enrollmentId}/sections/${s.id}`}
              >
                {done ? (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {s.title}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CircleDot className="size-3.5" aria-hidden />
                    {s.title}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <article className="reader-measure">
          {locked ? (
            <EmptyState
              title="Section locked"
              description={
                orgSequential
                  ? 'Finish earlier sections first — sequential progress is required for this organization.'
                  : 'This section is locked.'
              }
              action={(() => {
                const firstIncomplete = sections.find((s) => !completed.has(s.id) && !isLocked(s));
                return firstIncomplete ? (
                  <Button
                    variant="secondary"
                    render={
                      <Link
                        href={`/app/orgs/${orgId}/learn/${courseId}/enrollments/${enrollmentId}/sections/${firstIncomplete.id}`}
                      />
                    }
                  >
                    Go to next available
                  </Button>
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
                    <div key={b.id} className="block-card learner-block">
                      {b.type === 'text' ? <div className="prose-block">{b.markdown}</div> : null}
                      {b.type === 'image' ? (
                        <figure className="image-block">
                          {b.alt !== undefined ? (
                            <LearnerAssetImage assetId={b.assetId} alt={b.alt} />
                          ) : (
                            <LearnerAssetImage assetId={b.assetId} />
                          )}
                          {b.caption ? <figcaption>{b.caption}</figcaption> : null}
                        </figure>
                      ) : null}
                      {b.type === 'graph' ? (
                        <pre className="code-pre">{describeGraphBlock(b)}</pre>
                      ) : null}
                      {b.type === 'form' ? (
                        <FormAttemptPanel
                          form={resolveFormSpec(b)}
                          busy={busy}
                          result={attemptResults[b.id] ?? null}
                          onSubmit={(answers) => submitForm(b.id, answers)}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {actionError ? <p className="form-error">{actionError}</p> : null}
              {completeMessage ? <p className="form-success">{completeMessage}</p> : null}

              <div className="sticky-actions">
                <Button
                  onClick={() => void markComplete()}
                  disabled={busy || sectionDone || (!formsPassed && !sectionDone)}
                >
                  {sectionDone
                    ? 'Completed'
                    : busy
                      ? 'Saving…'
                      : formsPassed
                        ? 'Mark complete'
                        : 'Pass all forms to continue'}
                </Button>
                {sectionDone && nextSection ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.push(
                        `/app/orgs/${orgId}/learn/${courseId}/enrollments/${enrollmentId}/sections/${nextSection.id}`,
                      )
                    }
                  >
                    Next: {nextSection.title}
                  </Button>
                ) : null}
                {sectionDone && !nextSection ? (
                  <Button
                    variant="secondary"
                    render={<Link href={`/app/orgs/${orgId}/learn/${courseId}`} />}
                  >
                    Back to course
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
