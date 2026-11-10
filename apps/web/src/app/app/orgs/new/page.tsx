'use client';

import { isValidOrgSlug, normalizeOrgSlug } from '@lp/domain';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { RequireAuth } from '@/components/layout/require-auth';
import { TopBar } from '@/components/layout/top-bar';
import { Button } from '@/components/ui/button';
import { api, setLastOrgId } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';

export default function CreateOrgPage() {
  return (
    <RequireAuth>
      <CreateOrgInner />
    </RequireAuth>
  );
}

function CreateOrgInner() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeOrgSlug(slug || name);
    if (!isValidOrgSlug(normalized)) {
      setError('Slug must be 2–64 characters (letters, numbers, hyphens).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const org = await api.createOrg({ name: name.trim(), slug: normalized });
      setLastOrgId(org.id);
      await refresh();
      router.replace(`/app/orgs/${org.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create organization'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-frame">
      <TopBar />
      <main className="app-main page" style={{ maxWidth: 520 }}>
        <div className="page-header">
          <div>
            <h1>Create organization</h1>
            <p>You become the owner. Slugs are unique and URL-safe.</p>
          </div>
        </div>
        <form className="panel form-grid" onSubmit={(e) => void onSubmit(e)}>
          <label className="field">
            <span>Name</span>
            <input
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(normalizeOrgSlug(e.target.value));
              }}
            />
          </label>
          <label className="field">
            <span>Slug</span>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(normalizeOrgSlug(e.target.value))}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="cta-row">
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
            <Link className="btn btn-ghost" href="/app">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
