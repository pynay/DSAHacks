'use client';

import AppShell from './AppShell';
import { InventoryProvider } from '@/context/InventoryProvider';
import { usePathname } from 'next/navigation';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <InventoryProvider>
      {pathname === '/' ? children : <AppShell>{children}</AppShell>}
    </InventoryProvider>
  );
}
