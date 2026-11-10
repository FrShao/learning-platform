'use client';

import type { OrgRole } from '@lp/domain';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import type { OrgMemberDto } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';
import { canManageMembers, roleLabel } from '@/lib/roles';

const ROLES: OrgRole[] = ['owner', 'admin', 'author', 'learner'];

export default function MembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  const role = memberships.find((m) => m.orgId === orgId)?.role ?? null;
  const router = useRouter();

  const [members, setMembers] = useState<OrgMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<OrgRole>('learner');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMembers(orgId);
      setMembers(data);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'forbidden' || err.status === 403)) {
        setError('You do not have permission to manage members.');
      } else {
        setError(errorMessage(err, 'Could not load members'));
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (role && !canManageMembers(role)) {
      router.replace(`/app/orgs/${orgId}/learn`);
      return;
    }
    void load();
  }, [orgId, role, router, load]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.addMember(orgId, { email: email.trim(), role: newRole });
      setEmail('');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRoleChange(userId: string, next: OrgRole) {
    try {
      await api.updateMember(orgId, userId, { role: next });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRemove(userId: string) {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.removeMember(orgId, userId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <LoadingBlock />;
  if (error && members.length === 0)
    return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack">
      {error ? <p className="form-error">{error}</p> : null}

      <form className="panel form-grid" onSubmit={(e) => void onAdd(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add member</h2>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Role</span>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as OrgRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        {formError ? <p className="form-error">{formError}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add member'}
        </Button>
      </form>

      {members.length === 0 ? (
        <EmptyState title="No members returned" />
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <strong>{m.name}</strong>
                    <div className="muted">{m.email}</div>
                  </td>
                  <td>
                    <select
                      value={m.role}
                      onChange={(e) => void onRoleChange(m.userId, e.target.value as OrgRole)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Button variant="danger" onClick={() => void onRemove(m.userId)}>
                      Remove
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
