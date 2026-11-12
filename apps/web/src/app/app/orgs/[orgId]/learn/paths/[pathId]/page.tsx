'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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
  const { orgId, pathId } = useParams<{ orgId: string; pathId: string }>();
  const [path, setPath] = useState<PathDto | null>(null);
  const [nodes, setNodes] = useState<PathNodeDto[]>([]);
  const [progress, setProgress] = useState<PathProgressDto | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          // fall through to tree + enroll
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
    try {
      const result = await api.enrollPath(pathId);
      setCachedPathEnrollmentId(pathId, result.enrollment.id);
      setEnrollmentId(result.enrollment.id);
      setNodes(result.nodes);
      setProgress(result.progress);
      await loadProgress(result.enrollment.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setError('Already enrolled — refresh or clear cached enrollment.');
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
    try {
      const result = await api.completePathNode(enrollmentId, nodeId);
      setProgress(result.progress);
      setUnlocked(result.unlockedNodeIds);
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
          const open = unlockedSet.has(n.id);
          return (
            <li key={n.id}>
              <div className="list-row" style={{ padding: '0.5rem 0' }}>
                <div>
                  <strong>{n.title || n.sectionId}</strong>
                  <div className="meta-row">
                    {done ? (
                      <span className="badge ok">Done</span>
                    ) : open ? (
                      <span className="badge">Unlocked</span>
                    ) : (
                      <span className="badge warn">Locked</span>
                    )}
                    <span className="muted">{n.sectionId}</span>
                    <Link className="muted" href={`/app/orgs/${orgId}/learn/${n.courseId}`}>
                      Open course
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
            <Link href={`/app/orgs/${orgId}/learn`}>Learn</Link> / Paths
          </p>
          <h1>{path.title}</h1>
          <p>{path.description || 'Follow the lesson tree in order.'}</p>
        </div>
        {progress ? (
          <div className="meta-row">
            <span className="badge ok">{progress.percent}% complete</span>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => void onEnroll()}>
            {busy ? 'Enrolling…' : 'Enroll in path'}
          </Button>
        )}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {nodes.length === 0 ? (
        <EmptyState title="No lessons yet" description="This path has no nodes." />
      ) : (
        renderBranch(null, 0)
      )}
    </div>
  );
}
