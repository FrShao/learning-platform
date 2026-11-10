import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth/auth-context';

import './globals.css';

export const metadata: Metadata = {
  title: 'Learning Platform',
  description: 'Author and take versioned courses',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
