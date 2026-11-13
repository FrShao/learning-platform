'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { CourseBranchDto, CourseDto, WorkingTreeDto } from '@/lib/api/types';
import { errorMessage, shortId } from '@/lib/format';

export default function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [branches, setBranches] = useState<CourseBranchDto[]>([]);
  const [tree, setTree] = useState<WorkingTreeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const courseData = await api.getCourse(courseId);
      const branchData = await api.listBranches(courseId).catch(() => [] as CourseBranchDto[]);
      setCourse(courseData);
      setBranches(branchData);
      const branch = courseData.defaultBranch || 'main';
      const treeData = await api.getWorkingTree(courseId, branch).catch(() => null);
      setTree(treeData);
    } catch (err) {
      setError(errorMessage(err, 'Could not load course'));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publishHead() {
    const branch = branches.find((b) => b.name === course?.defaultBranch) ?? branches[0];
    const commitId = branch?.headCommitId;
    if (!commitId) {
      setPublishError('No branch head commit to publish yet. Commit from the editor first.');
      return;
    }
    setBusy(true);
    setPublishError(null);
    try {
      await api.publish(courseId, { commit_id: commitId });
      setPublishOpen(false);
      await load();
    } catch (err) {
      setPublishError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!course) return <EmptyState title="Course not found" />;

  const branch = course.defaultBranch || 'main';
  const editHref = `/app/me/courses/${courseId}/edit/branches/${encodeURIComponent(branch)}`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{course.title}</h1>
          <p>{course.description || 'No description yet.'}</p>
          <div className="meta-row" style={{ marginTop: '0.65rem' }}>
            <span>/{course.slug}</span>
            <span>default branch: {course.defaultBranch}</span>
            {course.publishedCommitId ? (
              <Badge
                variant="secondary"
                className="bg-[var(--accent-soft)] text-[var(--accent-deep)] border-0"
              >
                Published {shortId(course.publishedCommitId)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-700/20 bg-[#fff1d6] text-[var(--warn)]"
              >
                Unpublished
              </Badge>
            )}
          </div>
        </div>
        <div className="cta-row">
          <Button render={<Link href={editHref} />}>Open editor</Button>
          <Button variant="secondary" onClick={() => setPublishOpen(true)}>
            Publish…
          </Button>
        </div>
      </div>

      {!course.publishedCommitId ? (
        <div className="panel">
          <strong>Not published yet.</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Learners only see a course after you publish a commit.
          </p>
        </div>
      ) : null}

      <div className="hub-grid">
        <Link className="hub-tile" href={editHref}>
          <h3>Editor</h3>
          <p>Edit the working tree on {branch}.</p>
        </Link>
        <div className="hub-tile">
          <h3>Branches</h3>
          <p>
            {branches.length || '—'} branch{branches.length === 1 ? '' : 'es'} on this course
          </p>
        </div>
      </div>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Outline (working tree)</h2>
        {!tree || tree.dirtyTree.sections.length === 0 ? (
          <EmptyState
            title="No sections yet"
            description="Open the editor and add sections to the working tree."
            action={
              <Button variant="secondary" render={<Link href={editHref} />}>
                Open editor
              </Button>
            }
          />
        ) : (
          <div className="card-list">
            {tree.dirtyTree.sections
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
      </section>

      {publishOpen ? (
        <Modal
          title="Publish course"
          onClose={() => setPublishOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void publishHead()} disabled={busy}>
                {busy ? 'Publishing…' : 'Publish to learners'}
              </Button>
            </>
          }
        >
          <p>Publishes the current default-branch head commit to learners.</p>
          <p className="muted">Progress policy default: keep prior learner progress pins.</p>
          {publishError ? <p className="form-error">{publishError}</p> : null}
        </Modal>
      ) : null}
    </div>
  );
}
