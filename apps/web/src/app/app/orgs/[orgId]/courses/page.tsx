'use client';

import { normalizeOrgSlug } from '@lp/domain';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { CourseDto } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';
import { canAuthor } from '@/lib/roles';

export default function CoursesListPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  const role = memberships.find((m) => m.orgId === orgId)?.role ?? null;
  const router = useRouter();

  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listCourses(orgId);
      setCourses(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'forbidden') {
        setError('Authors and admins can manage courses. Open Learn instead.');
      } else {
        setError(errorMessage(err, 'Could not load courses'));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAuthor(role) && role != null) {
      router.replace(`/app/orgs/${orgId}/learn`);
      return;
    }
    void load();
  }, [orgId, role]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const course = await api.createCourse(orgId, {
        title: title.trim(),
        slug: normalizeOrgSlug(slug || title),
        description: description.trim(),
      });
      setCreateOpen(false);
      router.push(`/app/orgs/${orgId}/courses/${course.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) {
    return <ErrorState title="Courses unavailable" message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Courses</h1>
          <p>Manage course metadata and open the working-tree editor.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New course</Button>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          title="No courses"
          description="Create a course to get a main branch and empty working tree."
          action={<Button onClick={() => setCreateOpen(true)}>New course</Button>}
        />
      ) : (
        <div className="card-list">
          {courses.map((c) => (
            <div key={c.id} className="list-row">
              <div>
                <Link href={`/app/orgs/${orgId}/courses/${c.id}`}>
                  <strong>{c.title}</strong>
                </Link>
                <div className="meta-row">
                  <span>/{c.slug}</span>
                  <span>default: {c.defaultBranch}</span>
                  {c.publishedCommitId ? (
                    <span className="badge ok">Published</span>
                  ) : (
                    <span className="badge warn">Unpublished</span>
                  )}
                </div>
              </div>
              <div className="cta-row">
                <Link className="btn btn-secondary" href={`/app/orgs/${orgId}/courses/${c.id}`}>
                  Overview
                </Link>
                {c.publishedCommitId ? (
                  <Link className="btn btn-ghost" href={`/app/orgs/${orgId}/learn/${c.id}`}>
                    Preview
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen ? (
        <Modal
          title="New course"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-course" disabled={busy}>
                {busy ? 'Creating…' : 'Create'}
              </Button>
            </>
          }
        >
          <form id="create-course" className="form-grid" onSubmit={(e) => void onCreate(e)}>
            <label className="field">
              <span>Title</span>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>Slug</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(normalizeOrgSlug(e.target.value))}
                onFocus={() => {
                  if (!slug && title) setSlug(normalizeOrgSlug(title));
                }}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            {formError ? <p className="form-error">{formError}</p> : null}
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
