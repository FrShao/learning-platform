'use client';

import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  basePath,
  onCommitted,
  onPublished,
}: {
  orgId?: string | null;
  courseId: string;
  branchName: string;
  branches: CourseBranchDto[];
  baseCommitId: string | null;
  dirty: boolean;
  /** Authoring base path, e.g. `/app/orgs/:orgId/courses/:courseId` or `/app/me/courses/:courseId`. */
  basePath?: string;
  onCommitted?: (commit: CourseCommitDto) => void;
  onPublished?: () => void;
}) {
  const [commitOpen, setCommitOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommitId, setLastCommitId] = useState<string | null>(null);

  const base =
    basePath ?? (orgId ? `/app/orgs/${orgId}/courses/${courseId}` : `/app/me/courses/${courseId}`);
  const showExtraNav = Boolean(orgId);

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
          <div className="branch-picker">
            <Label htmlFor="branch-select">Branch</Label>
            <Select
              value={branchName}
              onValueChange={(value) => {
                if (value == null) return;
                window.location.href = `${base}/edit/branches/${encodeURIComponent(value)}`;
              }}
            >
              <SelectTrigger id="branch-select" className="min-w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge
            variant={dirty ? 'outline' : 'secondary'}
            className={dirty ? 'dirty-pill dirty' : 'dirty-pill clean'}
          >
            {dirty ? `Dirty vs ${shortId(baseCommitId)}` : `Clean · base ${shortId(baseCommitId)}`}
          </Badge>
        </div>
        <div className="course-context-actions">
          {showExtraNav ? (
            <Button
              variant="secondary"
              render={<Link href={`${base}/diff/branches/${encodeURIComponent(branchName)}`} />}
            >
              Diff
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setCommitOpen(true)} disabled={!dirty}>
            Commit…
          </Button>
          <Button onClick={() => setPublishOpen(true)}>Publish</Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showExtraNav ? (
                <>
                  <DropdownMenuItem
                    render={
                      <Link href={`${base}/history?branch=${encodeURIComponent(branchName)}`} />
                    }
                  >
                    History
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href={`${base}/branches`} />}>
                    Branches
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem render={<Link href={base} />}>Overview</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <div className="field">
            <Label htmlFor="commit-message">Message</Label>
            <Input
              id="commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe this change"
              autoFocus
            />
          </div>
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
