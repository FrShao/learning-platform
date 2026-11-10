'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingBlock } from '@/components/states/async-state';
import { api } from '@/lib/api/client';
import type { OrganizationDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function SettingsGeneralPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .getOrg(orgId)
      .then((data) => {
        if (!cancelled) {
          setOrg(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} />;
  if (!org) return <EmptyState title="Organization not found" />;

  const settings = org.settings;

  return (
    <div className="panel stack">
      <div>
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>General</h2>
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Read-only for now — organization updates are not exposed by the API yet.
        </p>
      </div>
      <div className="form-grid">
        <div className="field">
          <span>Name</span>
          <input value={org.name} readOnly />
        </div>
        <div className="field">
          <span>Slug</span>
          <input value={org.slug} readOnly />
        </div>
        <div className="field">
          <span>Enforce sequential progress</span>
          <input
            value={settings ? String(settings.enforceSequentialProgress) : 'default (true)'}
            readOnly
          />
        </div>
        <div className="field">
          <span>Republish progress policy</span>
          <input value={settings?.republishProgressPolicy ?? 'keep'} readOnly />
        </div>
      </div>
    </div>
  );
}
