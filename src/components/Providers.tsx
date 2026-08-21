'use client';

import AppShell from './AppShell';
import { InventoryProvider } from '@/context/InventoryProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <AppShell>{children}</AppShell>
    </InventoryProvider>
  );
}
