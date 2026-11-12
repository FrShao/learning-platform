'use client';

import { normalizeOrgSlug } from '@lp/domain';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api/client';
import type { PathDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function PersonalPathsPage() {
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
      setPaths(await api.listPersonalPaths());
    } catch (err) {
      setError(errorMessage(err, 'Could not load personal paths'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const path = await api.createPersonalPath({
        title: title.trim(),
        slug: normalizeOrgSlug(slug || title),
        description: description.trim(),
      });
      setCreateOpen(false);
      router.push(`/app/me/paths/${path.id}`);
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
          <h1>Personal paths</h1>
          <p>Owned by you. Creating does not require an organization.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New path</Button>
      </div>

      {paths.length === 0 ? (
        <EmptyState
          title="No personal paths"
          description="Create a path, then attach published course sections as lessons."
          action={<Button onClick={() => setCreateOpen(true)}>New path</Button>}
        />
      ) : (
        <div className="card-list">
          {paths.map((p) => (
            <div key={p.id} className="list-row">
              <div>
                <Link href={`/app/me/paths/${p.id}`}>
                  <strong>{p.title}</strong>
                </Link>
                <div className="meta-row">
                  <span>/{p.slug}</span>
                </div>
              </div>
              <div className="cta-row">
                <Link className="btn btn-secondary" href={`/app/me/paths/${p.id}`}>
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen ? (
        <Modal
          title="New personal path"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-personal-path" disabled={busy}>
                {busy ? 'Creating…' : 'Create'}
              </Button>
            </>
          }
        >
          <form id="create-personal-path" className="form-grid" onSubmit={(e) => void onCreate(e)}>
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
