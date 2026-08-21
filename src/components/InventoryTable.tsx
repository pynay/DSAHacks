'use client';

import { useState, useMemo } from 'react';
import type { InventoryItem } from '@/lib/types';
import { deriveStatus, daysUntil } from '@/lib/inventory';
import StatusPill from './StatusPill';
import { ChevronDown, ChevronUp, Minus, Plus, Star } from 'lucide-react';

type SortKey = 'name' | 'quantity' | 'days';

function SortHeader({
  label,
  sortKey,
  activeSort,
  ascending,
  onSort,
  className = '',
}: {
  label: string;
  sortKey?: SortKey;
  activeSort: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  if (!sortKey) return <th className={`px-4 py-3 font-medium ${className}`}>{label}</th>;
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {activeSort === sortKey && (ascending ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </button>
    </th>
  );
}

export default function InventoryTable({
  items,
  onAdjust,
  now,
  prioritized = [],
}: {
  items: InventoryItem[];
  onAdjust: (id: string, delta: number) => void;
  now: Date;
  prioritized?: string[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortKey === 'name') return dir * a.name.localeCompare(b.name);
      if (sortKey === 'quantity') return dir * (a.quantity - b.quantity);
      return dir * (daysUntil(a.expirationDate, now) - daysUntil(b.expirationDate, now));
    });
  }, [items, sortKey, asc, now]);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <SortHeader label="Item" sortKey="name" activeSort={sortKey} ascending={asc} onSort={toggle} />
            <SortHeader label="Category" activeSort={sortKey} ascending={asc} onSort={toggle} />
            <SortHeader label="Quantity" sortKey="quantity" activeSort={sortKey} ascending={asc} onSort={toggle} />
            <SortHeader label="Days left" sortKey="days" activeSort={sortKey} ascending={asc} onSort={toggle} />
            <SortHeader label="Location" activeSort={sortKey} ascending={asc} onSort={toggle} />
            <SortHeader label="Status" activeSort={sortKey} ascending={asc} onSort={toggle} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((i) => {
            const days = daysUntil(i.expirationDate, now);
            const daysColor = i.quantity <= 0 ? 'text-slate-300' : days <= 3 ? 'text-red-600' : days <= 14 ? 'text-amber-600' : 'text-slate-500';
            return (
              <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <span className="flex items-center gap-1.5">
                    {prioritized.includes(i.id) && <Star size={12} className="text-amber-500" fill="currentColor" />}
                    {i.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{i.category}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAdjust(i.id, -1)}
                      className="grid h-6 w-6 place-items-center rounded border border-slate-300 text-slate-500 hover:bg-slate-100"
                      aria-label={`Decrease ${i.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-16 text-center tabular-nums">
                      {i.quantity} {i.unit}
                    </span>
                    <button
                      onClick={() => onAdjust(i.id, 1)}
                      className="grid h-6 w-6 place-items-center rounded border border-slate-300 text-slate-500 hover:bg-slate-100"
                      aria-label={`Increase ${i.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </td>
                <td className={`px-4 py-3 tabular-nums ${daysColor}`}>
                  {i.quantity <= 0 ? 'N/A' : days <= 0 ? 'expired' : `${days}d`}
                </td>
                <td className="px-4 py-3 text-slate-600">{i.location}</td>
                <td className="px-4 py-3">
                  <StatusPill status={deriveStatus(i, now)} />
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No items match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
