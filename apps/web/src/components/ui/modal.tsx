'use client';

import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Controlled dialog wrapper kept for existing call sites. */
export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-lg">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">{children}</div>
        {footer ? <DialogFooter className="border-0 bg-transparent">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
