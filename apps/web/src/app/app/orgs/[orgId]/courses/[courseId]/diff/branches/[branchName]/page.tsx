'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { CourseContextBar } from '@/components/course/course-context-bar';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { CourseBranchDto, DiffDto, WorkingTreeDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function DiffPage() {
  const { orgId, courseId, branchName } = useParams<{
    orgId: string;
    courseId: string;
    branchName: string;
  }>();
  const decodedBranch = decodeURIComponent(branchName);

  const [diff, setDiff] = useState<DiffDto | null>(null);
  const [tree, setTree] = useState<WorkingTreeDto | null>(null);
  const [branches, setBranches] = useState<CourseBranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discardBusy, setDiscardBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, t, b] = await Promise.all([
        api.getDiff(courseId, decodedBranch),
        api.getWorkingTree(courseId, decodedBranch).catch(() => null),
        api.listBranches(courseId).catch(() => [] as CourseBranchDto[]),
      ]);
      setDiff(d);
      setTree(t);
      setBranches(b);
    } catch (err) {
      setError(errorMessage(err, 'Could not load diff'));
    } finally {
      setLoading(false);
    }
  }, [courseId, decodedBranch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function discard() {
    if (!tree?.baseCommitId) {
      setError('No base commit to restore.');
      return;
    }
    if (!window.confirm('Discard all dirty changes and restore the base commit snapshot?')) {
      return;
    }
    setDiscardBusy(true);
    try {
      const baseTree = await api.getCommitTree(courseId, tree.baseCommitId);
      await api.putWorkingTree(courseId, decodedBranch, baseTree);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Discard failed'));
    } finally {
      setDiscardBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && !diff) return <ErrorState message={error} onRetry={() => void load()} />;

  const clean =
    diff?.clean === true || (diff?.hunks && Array.isArray(diff.hunks) && diff.hunks.length === 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Diff</h1>
          <p>
            Dirty working tree vs base commit on <strong>{decodedBranch}</strong>.
          </p>
        </div>
        <Button
          variant="ghost"
          render={
            <Link
              href={`/app/orgs/${orgId}/courses/${courseId}/edit/branches/${encodeURIComponent(decodedBranch)}`}
            />
          }
        >
          Back to editor
        </Button>
      </div>

      <CourseContextBar
        orgId={orgId}
        courseId={courseId}
        branchName={decodedBranch}
        branches={branches.length ? branches : [{ name: decodedBranch, headCommitId: null }]}
        baseCommitId={diff?.baseCommitId ?? tree?.baseCommitId ?? null}
        dirty={!clean}
        onCommitted={() => void load()}
      />

      {error ? <p className="form-error">{error}</p> : null}

      {clean ? (
        <EmptyState title="No changes" description="The working tree matches the base commit." />
      ) : (
        <div className="stack">
          {diff?.summary ? <p>{diff.summary}</p> : null}
          <pre className="diff-pre">{JSON.stringify(diff, null, 2)}</pre>
          <div className="cta-row">
            <Button variant="danger" disabled={discardBusy} onClick={() => void discard()}>
              {discardBusy ? 'Discarding…' : 'Discard all changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
