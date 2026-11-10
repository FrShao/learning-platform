'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { SettingsNav } from '@/components/layout/settings-nav';
import { useAuth } from '@/lib/auth/auth-context';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships } = useAuth();
  const role = memberships.find((m) => m.orgId === orgId)?.role ?? null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Organization configuration and access controls.</p>
        </div>
      </div>
      <div className="settings-layout">
        <SettingsNav orgId={orgId} role={role} />
        <div>{children}</div>
      </div>
    </div>
  );
}
