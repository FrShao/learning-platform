'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ProgressMeter } from '@/components/learner/progress-meter';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { PathDto, PathNodeDto, PathProgressDto } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';
import { getCachedPathEnrollmentId, setCachedPathEnrollmentId } from '@/lib/path-enrollment-cache';

function childrenOf(nodes: PathNodeDto[], parentId: string | null): PathNodeDto[] {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export default function PathLearnerPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const [path, setPath] = useState<PathDto | null>(null);
  const [nodes, setNodes] = useState<PathNodeDto[]>([]);
  const [progress, setProgress] = useState<PathProgressDto | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const completedSet = useMemo(() => new Set(progress?.completedNodeIds ?? []), [progress]);

  async function loadProgress(enrollId: string) {
    const data = await api.getPathProgress(enrollId);
    setPath(data.path);
    setNodes(data.nodes);
    setProgress(data.progress);
    setUnlocked(data.unlockedNodeIds);
    setEnrollmentId(data.enrollment.id);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cached = getCachedPathEnrollmentId(pathId);
      if (cached) {
        try {
          await loadProgress(cached);
          return;
        } catch {
          // fall through
        }
      }
      const tree = await api.getPathTree(pathId);
      setPath(tree.path);
      setNodes(tree.nodes);
      setProgress(null);
      setUnlocked([]);
      setEnrollmentId(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load path'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pathId]);

  async function onEnroll() {
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const result = await api.enrollPath(pathId);
      setCachedPathEnrollmentId(pathId, result.enrollment.id);
      setEnrollmentId(result.enrollment.id);
      setNodes(result.nodes);
      setProgress(result.progress);
      await loadProgress(result.enrollment.id);
      setFlash('Enrolled — start with the first unlocked lesson.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setError('Already enrolled — open home to resume.');
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  async function onComplete(nodeId: string) {
    if (!enrollmentId) return;
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const result = await api.completePathNode(enrollmentId, nodeId);
      setProgress(result.progress);
      setUnlocked(result.unlockedNodeIds);
      setFlash(
        result.progress.percent === 100
          ? 'Path complete.'
          : 'Lesson marked complete — newly unlocked steps are ready.',
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function renderBranch(parentId: string | null, depth: number) {
    const kids = childrenOf(nodes, parentId);
    if (kids.length === 0) return null;
    return (
      <ul className="path-tree" style={{ marginLeft: depth === 0 ? 0 : 16 }}>
        {kids.map((n) => {
          const done = completedSet.has(n.id);
          const open = unlockedSet.has(n.id) || !enrollmentId;
          return (
            <li key={n.id}>
              <div className="list-row path-node-row">
                <div>
                  <strong>{n.title || n.sectionId}</strong>
                  <div className="meta-row">
                    {done ? (
                      <span className="badge ok">Done</span>
                    ) : open && enrollmentId ? (
                      <span className="badge">Unlocked</span>
                    ) : enrollmentId ? (
                      <span className="badge warn">Locked</span>
                    ) : (
                      <span className="badge">Lesson</span>
                    )}
                    <Link className="muted" href={`/app/learn/courses/${n.courseId}`}>
                      Open lesson
                    </Link>
                  </div>
                </div>
                {enrollmentId && open && !done ? (
                  <Button disabled={busy} onClick={() => void onComplete(n.id)}>
                    Mark complete
                  </Button>
                ) : null}
              </div>
              {renderBranch(n.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  if (loading) return <LoadingBlock />;
  if (error && !path) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!path) return <EmptyState title="Path not found" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted">
            <Link href="/app">Home</Link> / Paths
          </p>
          <h1>{path.title}</h1>
          <p>{path.description || 'Follow the lesson tree in order.'}</p>
        </div>
        {progress ? (
          <div style={{ minWidth: 180 }}>
            <ProgressMeter
              percent={progress.percent}
              label={`Path progress ${progress.percent}%`}
            />
          </div>
        ) : (
          <Button disabled={busy} onClick={() => void onEnroll()}>
            {busy ? 'Enrolling…' : 'Enroll in path'}
          </Button>
        )}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {flash ? <p className="form-success">{flash}</p> : null}

      {nodes.length === 0 ? (
        <EmptyState title="No lessons yet" description="This path has no nodes." />
      ) : (
        <section className="panel">{renderBranch(null, 0)}</section>
      )}
    </div>
  );
}
