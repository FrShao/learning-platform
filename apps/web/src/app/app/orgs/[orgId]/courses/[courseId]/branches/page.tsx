'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { CourseBranchDto, CourseDto } from '@/lib/api/types';
import { errorMessage, shortId } from '@/lib/format';

export default function BranchesPage() {
  const { orgId, courseId } = useParams<{ orgId: string; courseId: string }>();
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [branches, setBranches] = useState<CourseBranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [fromCommit, setFromCommit] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, b] = await Promise.all([api.getCourse(courseId), api.listBranches(courseId)]);
      setCourse(c);
      setBranches(b);
      const defaultHead =
        b.find((x) => x.name === c.defaultBranch)?.headCommitId ?? b[0]?.headCommitId ?? '';
      setFromCommit(defaultHead ?? '');
    } catch (err) {
      setError(errorMessage(err, 'Could not load branches'));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!fromCommit) {
      setFormError('from_commit_id is required');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.createBranch(courseId, { name: name.trim(), from_commit_id: fromCommit });
      setCreateOpen(false);
      setName('');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(branchName: string) {
    if (!window.confirm(`Delete branch “${branchName}”?`)) return;
    try {
      await api.deleteBranch(courseId, branchName);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete branch'));
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && branches.length === 0) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Branches</h1>
          <p>{course ? course.title : 'Course branches'}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New branch</Button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {branches.length === 0 ? (
        <EmptyState title="No branches" description="The API returned an empty branch list." />
      ) : (
        <div className="card-list">
          {branches.map((b) => {
            const isDefault = course?.defaultBranch === b.name;
            return (
              <div key={b.name} className="list-row">
                <div>
                  <strong>{b.name}</strong>
                  <div className="meta-row">
                    <span>head {shortId(b.headCommitId)}</span>
                    {isDefault ? <span className="badge ok">Default</span> : null}
                  </div>
                </div>
                <div className="cta-row">
                  <Link
                    className="btn btn-secondary"
                    href={`/app/orgs/${orgId}/courses/${courseId}/edit/branches/${encodeURIComponent(b.name)}`}
                  >
                    Checkout
                  </Link>
                  {!isDefault ? (
                    <Button variant="danger" onClick={() => void onDelete(b.name)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen ? (
        <Modal
          title="Create branch"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-branch" disabled={busy}>
                Create
              </Button>
            </>
          }
        >
          <form id="create-branch" className="form-grid" onSubmit={(e) => void onCreate(e)}>
            <label className="field">
              <span>Name</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>From commit id</span>
              <input required value={fromCommit} onChange={(e) => setFromCommit(e.target.value)} />
            </label>
            {formError ? <p className="form-error">{formError}</p> : null}
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
