import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-block" role="status">
      <div className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-block empty">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block error">
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
