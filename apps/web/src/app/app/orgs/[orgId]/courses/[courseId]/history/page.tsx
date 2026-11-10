'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { CourseCommitDto, CourseDto } from '@/lib/api/types';
import { errorMessage, formatDate, shortId } from '@/lib/format';

function HistoryInner() {
  const { orgId, courseId } = useParams<{ orgId: string; courseId: string }>();
  const search = useSearchParams();
  const branch = search.get('branch') || 'main';

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [commits, setCommits] = useState<CourseCommitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, list] = await Promise.all([
        api.getCourse(courseId),
        api.listCommits(courseId, branch),
      ]);
      setCourse(c);
      setCommits(list);
    } catch (err) {
      setError(errorMessage(err, 'Could not load history'));
    } finally {
      setLoading(false);
    }
  }, [courseId, branch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(commitId: string) {
    setBusy(true);
    setPublishError(null);
    try {
      await api.publish(courseId, { commit_id: commitId });
      setPublishId(null);
      await load();
    } catch (err) {
      setPublishError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Commit history</h1>
          <p>
            Branch <strong>{branch}</strong>
            {course ? ` · ${course.title}` : ''}
          </p>
        </div>
        <div className="cta-row">
          <Link
            className="btn btn-secondary"
            href={`/app/orgs/${orgId}/courses/${courseId}/edit/branches/${encodeURIComponent(branch)}`}
          >
            Editor
          </Link>
          <Link className="btn btn-ghost" href={`/app/orgs/${orgId}/courses/${courseId}`}>
            Overview
          </Link>
        </div>
      </div>

      {commits.length === 0 ? (
        <EmptyState
          title="No commits yet"
          description="Commit from the editor or diff view to start history."
        />
      ) : (
        <div className="card-list">
          {commits.map((c) => {
            const published = course?.publishedCommitId === c.id;
            return (
              <div key={c.id} className="list-row">
                <div>
                  <strong>{c.message}</strong>
                  <div className="meta-row">
                    <span>{shortId(c.id, 12)}</span>
                    <span>{formatDate(c.createdAt)}</span>
                    {published ? <span className="badge ok">Published</span> : null}
                  </div>
                </div>
                <div className="cta-row">
                  <Link
                    className="btn btn-secondary"
                    href={`/app/orgs/${orgId}/courses/${courseId}/commits/${c.id}`}
                  >
                    Snapshot
                  </Link>
                  <Button variant="ghost" onClick={() => setPublishId(c.id)}>
                    Publish
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {publishId ? (
        <Modal
          title="Publish course"
          onClose={() => setPublishId(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPublishId(null)}>
                Cancel
              </Button>
              <Button onClick={() => void publish(publishId)} disabled={busy}>
                {busy ? 'Publishing…' : 'Publish to learners'}
              </Button>
            </>
          }
        >
          <p>
            Learners will see commit <code>{shortId(publishId, 12)}</code>.
          </p>
          <p className="muted">Progress policy default: keep.</p>
          {publishError ? <p className="form-error">{publishError}</p> : null}
        </Modal>
      ) : null}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <HistoryInner />
    </Suspense>
  );
}
