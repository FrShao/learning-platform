'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { LoadingBlock } from '@/components/states/async-state';

export default function SettingsIndexPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/app/orgs/${orgId}/settings/general`);
  }, [orgId, router]);

  return <LoadingBlock label="Opening settings…" />;
}
