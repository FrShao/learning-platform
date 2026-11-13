'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { CourseCommitDto, CourseTreeDto } from '@/lib/api/types';
import { errorMessage, formatDate, shortId } from '@/lib/format';

export default function CommitSnapshotPage() {
  const { orgId, courseId, commitId } = useParams<{
    orgId: string;
    courseId: string;
    commitId: string;
  }>();

  const [commit, setCommit] = useState<CourseCommitDto | null>(null);
  const [tree, setTree] = useState<CourseTreeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, t] = await Promise.all([
        api.getCommit(courseId, commitId),
        api.getCommitTree(courseId, commitId),
      ]);
      setCommit(c);
      setTree(t);
    } catch (err) {
      setError(errorMessage(err, 'Could not load commit snapshot'));
    } finally {
      setLoading(false);
    }
  }, [courseId, commitId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    setBusy(true);
    setActionError(null);
    try {
      await api.publish(courseId, { commit_id: commitId });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function createBranch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await api.createBranch(courseId, { name: branchName.trim(), from_commit_id: commitId });
      setBranchOpen(false);
      window.location.href = `/app/orgs/${orgId}/courses/${courseId}/branches`;
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!commit || !tree) return <EmptyState title="Snapshot not found" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Commit snapshot</h1>
          <p>
            {commit.message} · {shortId(commit.id, 12)} · {formatDate(commit.createdAt)}
          </p>
        </div>
        <div className="cta-row">
          <Button onClick={() => void publish()} disabled={busy}>
            Publish this
          </Button>
          <Button variant="secondary" onClick={() => setBranchOpen(true)}>
            Branch from here
          </Button>
          <Button
            variant="ghost"
            render={<Link href={`/app/orgs/${orgId}/courses/${courseId}/history`} />}
          >
            History
          </Button>
        </div>
      </div>

      {actionError ? <p className="form-error">{actionError}</p> : null}

      <div className="panel">
        <p className="muted" style={{ marginTop: 0 }}>
          Read-only tree at this commit. Learner progress endpoints are not used here.
        </p>
        {tree.sections.length === 0 ? (
          <EmptyState title="Empty snapshot" />
        ) : (
          <div className="card-list">
            {tree.sections
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => (
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
      </div>

      {branchOpen ? (
        <Modal
          title="Create branch"
          onClose={() => setBranchOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBranchOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="branch-form" disabled={busy || !branchName.trim()}>
                Create
              </Button>
            </>
          }
        >
          <form id="branch-form" className="form-grid" onSubmit={(e) => void createBranch(e)}>
            <label className="field">
              <span>Branch name</span>
              <input required value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            </label>
            <p className="muted">from commit {shortId(commitId, 12)}</p>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
