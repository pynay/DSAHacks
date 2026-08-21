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
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold tracking-tight text-[#071a2b]">{current?.label ?? 'Parsel'}</h1>
      <span className="text-sm text-slate-500">{today}</span>
    </header>
  );
}
