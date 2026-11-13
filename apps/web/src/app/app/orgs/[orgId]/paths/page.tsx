'use client';

import { normalizeOrgSlug } from '@lp/domain';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/client';
import type { PathDto } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';
import { canAuthor } from '@/lib/roles';

export default function PathsListPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  const role = memberships.find((m) => m.orgId === orgId)?.role ?? null;
  const router = useRouter();

  const [paths, setPaths] = useState<PathDto[]>([]);
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
      const data = await api.listPaths(orgId);
      setPaths(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'forbidden') {
        setError('Authors and admins can manage paths. Open Learn instead.');
      } else {
        setError(errorMessage(err, 'Could not load paths'));
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
      const path = await api.createPath(orgId, {
        title: title.trim(),
        slug: normalizeOrgSlug(slug || title),
        description: description.trim(),
      });
      setCreateOpen(false);
      router.push(`/app/orgs/${orgId}/paths/${path.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) {
    return <ErrorState title="Paths unavailable" message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Paths</h1>
          <p>Ordered learning journeys made of published course lessons.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New path</Button>
      </div>

      {paths.length === 0 ? (
        <EmptyState
          title="No paths"
          description="Create a path, then attach course sections as a tree of lessons."
          action={<Button onClick={() => setCreateOpen(true)}>New path</Button>}
        />
      ) : (
        <div className="card-list">
          {paths.map((p) => (
            <div key={p.id} className="list-row">
              <div>
                <Link href={`/app/orgs/${orgId}/paths/${p.id}`}>
                  <strong>{p.title}</strong>
                </Link>
                <div className="meta-row">
                  <span>/{p.slug}</span>
                </div>
                {p.description ? <p className="muted">{p.description}</p> : null}
              </div>
              <div className="cta-row">
                <Button
                  variant="secondary"
                  render={<Link href={`/app/orgs/${orgId}/paths/${p.id}`} />}
                >
                  Edit tree
                </Button>
                <Button
                  variant="ghost"
                  render={<Link href={`/app/orgs/${orgId}/learn/paths/${p.id}`} />}
                >
                  Learner view
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen ? (
        <Modal
          title="New path"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-path" disabled={busy}>
                {busy ? 'Creating…' : 'Create'}
              </Button>
            </>
          }
        >
          <form id="create-path" className="form-grid" onSubmit={(e) => void onCreate(e)}>
            <div className="field">
              <Label htmlFor="create-title">Title</Label>
              <Input
                id="create-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="create-slug">Slug</Label>
              <Input
                id="create-slug"
                required
                value={slug}
                onChange={(e) => setSlug(normalizeOrgSlug(e.target.value))}
                onFocus={() => {
                  if (!slug && title) setSlug(normalizeOrgSlug(title));
                }}
              />
            </div>
            <div className="field">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {formError ? <p className="form-error">{formError}</p> : null}
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
