'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { LoadingBlock } from '@/components/states/async-state';
import { useAuth } from '@/lib/auth/auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/app';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router]);

  if (status === 'loading') {
    return <LoadingBlock label="Checking session…" />;
  }
  if (status !== 'authenticated') {
    return <LoadingBlock label="Redirecting to sign in…" />;
  }
  return <>{children}</>;
}
