'use client';

import AppShell from './AppShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
