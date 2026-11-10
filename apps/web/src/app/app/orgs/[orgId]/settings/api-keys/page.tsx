'use client';

import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { ApiKeyCreatedDto, ApiKeyDto, ApiKeyScope } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage, formatDate } from '@/lib/format';
import { canManageApiKeys } from '@/lib/roles';

const ALL_SCOPES: ApiKeyScope[] = [
  'courses:read',
  'courses:write',
  'courses:publish',
  'assets:write',
  'members:read',
];

export default function ApiKeysPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  const role = memberships.find((m) => m.orgId === orgId)?.role ?? null;
  const router = useRouter();

  const [keys, setKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['courses:read']);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<ApiKeyCreatedDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listApiKeys(orgId);
      setKeys(data);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'forbidden' || err.status === 403)) {
        setError('You do not have permission to manage API keys.');
      } else {
        setError(errorMessage(err, 'Could not load API keys'));
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (role && !canManageApiKeys(role)) {
      router.replace(`/app/orgs/${orgId}/learn`);
      return;
    }
    void load();
  }, [orgId, role, router, load]);

  function toggleScope(scope: ApiKeyScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (scopes.length === 0) {
      setFormError('Select at least one scope.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const key = await api.createApiKey(orgId, { name: name.trim(), scopes });
      setCreated(key);
      setName('');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(keyId: string) {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await api.revokeApiKey(orgId, keyId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && keys.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack">
      {error ? <p className="form-error">{error}</p> : null}

      {created ? (
        <div className="panel stack">
          <strong>Copy this secret now</strong>
          <p className="muted" style={{ margin: 0 }}>
            It will not be shown again. Store it somewhere safe.
          </p>
          <div className="secret-once">{created.secret}</div>
          <Button variant="secondary" onClick={() => setCreated(null)}>
            Done
          </Button>
        </div>
      ) : null}

      <form className="panel form-grid" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create API key</h2>
        <p className="muted" style={{ margin: 0 }}>
          Keys grant scoped access for external tools and integrations.
        </p>
        <label className="field">
          <span>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <span>Scopes</span>
          <div className="stack" style={{ marginTop: '0.35rem' }}>
            {ALL_SCOPES.map((scope) => (
              <label key={scope} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                <code>{scope}</code>
              </label>
            ))}
          </div>
        </fieldset>
        {formError ? <p className="form-error">{formError}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create key'}
        </Button>
      </form>

      {keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create a key with scopes such as courses:write or courses:publish."
        />
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>
                    <strong>{k.name}</strong>
                  </td>
                  <td>
                    <code>{k.prefix}</code>
                  </td>
                  <td>{k.scopes.join(', ')}</td>
                  <td>{formatDate(k.lastUsedAt)}</td>
                  <td>
                    <Button variant="danger" onClick={() => void onRevoke(k.id)}>
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
