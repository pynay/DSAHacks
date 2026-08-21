'use client';

import AppShell from './AppShell';
import { InventoryProvider } from '@/context/InventoryProvider';
import { usePathname } from 'next/navigation';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The landing page and the (demo) login screen render full-bleed, without the
  // console chrome (sidebar + topbar).
  const chromeless = pathname === '/' || pathname === '/login';

  return (
    <InventoryProvider>
      {chromeless ? children : <AppShell>{children}</AppShell>}
    </InventoryProvider>
  );
}
