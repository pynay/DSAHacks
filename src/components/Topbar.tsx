'use client';

import { usePathname } from 'next/navigation';
import { NAV } from './Sidebar';

export default function Topbar() {
  const pathname = usePathname();
  const current = NAV.find((n) => pathname.startsWith(n.href));
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <header className="h-16 border-b border-stone-200 bg-white flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-stone-900">{current?.label ?? 'FoodBank'}</h1>
      <span className="text-sm text-stone-500">{today}</span>
    </header>
  );
}
