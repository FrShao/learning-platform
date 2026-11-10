'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { CourseBranchDto, CourseCommitDto } from '@/lib/api/types';
import { errorMessage, shortId } from '@/lib/format';

export function CourseContextBar({
  orgId,
  courseId,
  branchName,
  branches,
  baseCommitId,
  dirty,
  onCommitted,
  onPublished,
}: {
  orgId: string;
  courseId: string;
  branchName: string;
  branches: CourseBranchDto[];
  baseCommitId: string | null;
  dirty: boolean;
  onCommitted?: (commit: CourseCommitDto) => void;
  onPublished?: () => void;
}) {
  const [commitOpen, setCommitOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommitId, setLastCommitId] = useState<string | null>(null);

  const base = `/app/orgs/${orgId}/courses/${courseId}`;

  async function handleCommit() {
    setBusy(true);
    setError(null);
    try {
      const commit = await api.commit(courseId, branchName, { message });
      setLastCommitId(commit.id);
      setCommitOpen(false);
      setMessage('');
      onCommitted?.(commit);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    const commitId =
      lastCommitId ?? branches.find((b) => b.name === branchName)?.headCommitId ?? baseCommitId;
    if (!commitId) {
      setError('No commit available to publish.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.publish(courseId, { commit_id: commitId });
      setPublishOpen(false);
      onPublished?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="course-context-bar">
        <div className="course-context-main">
          <label className="branch-picker">
            <span>Branch</span>
            <select
              value={branchName}
              onChange={(e) => {
                window.location.href = `${base}/edit/branches/${encodeURIComponent(e.target.value)}`;
              }}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <span className={dirty ? 'dirty-pill dirty' : 'dirty-pill clean'}>
            {dirty ? `Dirty vs ${shortId(baseCommitId)}` : `Clean · base ${shortId(baseCommitId)}`}
          </span>
        </div>
        <div className="course-context-actions">
          <Link
            className="btn btn-secondary"
            href={`${base}/diff/branches/${encodeURIComponent(branchName)}`}
          >
            Diff
          </Link>
          <Button variant="secondary" onClick={() => setCommitOpen(true)} disabled={!dirty}>
            Commit…
          </Button>
          <Button onClick={() => setPublishOpen(true)}>Publish</Button>
          <details className="overflow-menu">
            <summary className="btn btn-ghost">⋯</summary>
            <div className="dropdown-panel">
              <Link
                className="dropdown-item"
                href={`${base}/history?branch=${encodeURIComponent(branchName)}`}
              >
                History
              </Link>
              <Link className="dropdown-item" href={`${base}/branches`}>
                Branches
              </Link>
              <Link className="dropdown-item" href={base}>
                Overview
              </Link>
            </div>
          </details>
        </div>
      </div>

      {commitOpen ? (
        <Modal
          title="Commit changes"
          onClose={() => setCommitOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCommitOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleCommit()} disabled={busy || !message.trim()}>
                {busy ? 'Committing…' : 'Commit'}
              </Button>
            </>
          }
        >
          <p className="muted">Branch: {branchName}</p>
          <label className="field">
            <span>Message</span>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe this change"
              autoFocus
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
        </Modal>
      ) : null}

      {publishOpen ? (
        <Modal
          title="Publish course"
          onClose={() => setPublishOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handlePublish()} disabled={busy}>
                {busy ? 'Publishing…' : 'Publish to learners'}
              </Button>
            </>
          }
        >
          <p>
            Learners will see the selected commit
            {lastCommitId || baseCommitId ? ` (${shortId(lastCommitId ?? baseCommitId, 12)})` : ''}.
          </p>
          <p className="muted">
            Progress policy default is <strong>keep</strong> — existing learner progress stays keyed
            to the prior published commit.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
