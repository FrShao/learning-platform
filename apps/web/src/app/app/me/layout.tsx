import type { ReactNode } from 'react';

import { PersonalShell } from '@/components/layout/personal-shell';

export default function MeLayout({ children }: { children: ReactNode }) {
  return <PersonalShell>{children}</PersonalShell>;
}
