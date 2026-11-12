'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { CourseDto, PathDto, PathNodeDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

function childrenOf(nodes: PathNodeDto[], parentId: string | null): PathNodeDto[] {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function TreeBranch({
  nodes,
  parentId,
  depth,
  onDelete,
}: {
  nodes: PathNodeDto[];
  parentId: string | null;
  depth: number;
  onDelete: (nodeId: string) => void;
}) {
  const kids = childrenOf(nodes, parentId);
  if (kids.length === 0) return null;
  return (
    <ul className="path-tree" style={{ marginLeft: depth === 0 ? 0 : 16 }}>
      {kids.map((n) => (
        <li key={n.id}>
          <div className="list-row" style={{ padding: '0.5rem 0' }}>
            <div>
              <strong>{n.title || n.sectionId}</strong>
              <div className="meta-row">
                <span>section {n.sectionId}</span>
                <span className="muted">{n.courseId.slice(0, 8)}…</span>
              </div>
            </div>
            <Button variant="ghost" onClick={() => onDelete(n.id)}>
              Delete
            </Button>
          </div>
          <TreeBranch nodes={nodes} parentId={n.id} depth={depth + 1} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}

export default function PathEditorPage() {
  const { orgId, pathId } = useParams<{ orgId: string; pathId: string }>();
  const [path, setPath] = useState<PathDto | null>(null);
  const [nodes, setNodes] = useState<PathNodeDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [parentId, setParentId] = useState<string>('');
  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [nodeTitle, setNodeTitle] = useState('');

  const publishedCourses = useMemo(
    () => courses.filter((c) => c.publishedCommitId != null),
    [courses],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tree, courseList] = await Promise.all([
        api.getPathTree(pathId),
        api.listCourses(orgId).catch(() => [] as CourseDto[]),
      ]);
      setPath(tree.path);
      setNodes(tree.nodes);
      // listCourses may return wrapped or raw depending on client; normalize
      const list = Array.isArray(courseList)
        ? courseList
        : ((courseList as { courses?: CourseDto[] }).courses ?? []);
      setCourses(list);
      if (!courseId && list[0]) setCourseId(list[0].id);
    } catch (err) {
      setError(errorMessage(err, 'Could not load path'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orgId, pathId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const next = await api.addPathNode(pathId, {
        parentId: parentId || null,
        courseId,
        sectionId: sectionId.trim(),
        title: nodeTitle.trim() || null,
      });
      setNodes(next);
      setSectionId('');
      setNodeTitle('');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(nodeId: string) {
    setBusy(true);
    setFormError(null);
    try {
      const next = await api.deletePathNode(pathId, nodeId);
      setNodes(next);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!path) return <EmptyState title="Path not found" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted">
            <Link href={`/app/orgs/${orgId}/paths`}>Paths</Link> / {path.slug}
          </p>
          <h1>{path.title}</h1>
          <p>{path.description || 'Attach published course sections as a lesson tree.'}</p>
        </div>
        <Link className="btn btn-secondary" href={`/app/orgs/${orgId}/learn/paths/${pathId}`}>
          Learner view
        </Link>
      </div>

      <section className="panel">
        <h2>Tree</h2>
        {nodes.length === 0 ? (
          <EmptyState
            title="Empty path"
            description="Add a root node that references a published course section."
          />
        ) : (
          <TreeBranch
            nodes={nodes}
            parentId={null}
            depth={0}
            onDelete={(id) => void onDelete(id)}
          />
        )}
      </section>

      <section className="panel">
        <h2>Add node</h2>
        <form className="form-grid" onSubmit={(e) => void onAdd(e)}>
          <label className="field">
            <span>Parent</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Root</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title || n.sectionId}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Course</span>
            <select required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="" disabled>
                Select course
              </option>
              {publishedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Section id</span>
            <input
              required
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder="sec_…"
            />
          </label>
          <label className="field">
            <span>Title override (optional)</span>
            <input value={nodeTitle} onChange={(e) => setNodeTitle(e.target.value)} />
          </label>
          {formError ? <p className="form-error">{formError}</p> : null}
          <Button type="submit" disabled={busy || !courseId}>
            {busy ? 'Saving…' : 'Add node'}
          </Button>
        </form>
      </section>
    </div>
  );
}
