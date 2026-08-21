'use client';

import { usePathname } from 'next/navigation';
import { Database, RotateCcw } from 'lucide-react';
import { NAV } from './Sidebar';
import { useInventory } from '@/context/InventoryProvider';

export default function Topbar() {
  const pathname = usePathname();
  const current = NAV.find((n) => pathname.startsWith(n.href));
  const { loadDemo, resetDemo } = useInventory();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold tracking-tight text-[#071a2b]">{current?.label ?? 'Parsel'}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">{today}</span>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-1 text-xs">
          <button
            onClick={loadDemo}
            title="Seed 8 weeks of demo inventory, donations, and distributions"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <Database size={13} /> Load demo data
          </button>
          <button
            onClick={resetDemo}
            title="Clear all demo data"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>
    </header>
  );
}
