'use client';

import { Clock, Star } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { expiringSoon } from '@/lib/warehouse';

export default function ExpiringPanel({
  inventory,
  now,
  prioritized,
  onTogglePriority,
}: {
  inventory: InventoryItem[];
  now: Date;
  prioritized: string[];
  onTogglePriority: (id: string) => void;
}) {
  const rows = expiringSoon(inventory, now, 14);

  return (
    <div className="flex h-72 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <Clock size={16} className="text-amber-600" /> Expiring soon
      </h2>
      <p className="text-xs text-slate-500">Within 14 days. Star to ship first (FEFO).</p>

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {rows.map(({ item, daysLeft }) => {
          const starred = prioritized.includes(item.id);
          const urgent = daysLeft <= 3;
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{item.name}</div>
                <div className="text-[11px] text-slate-500">
                  {item.quantity} {item.unit} ·{' '}
                  <span className={urgent ? 'font-semibold text-red-600' : 'text-amber-600'}>
                    {daysLeft <= 0 ? 'expires today' : `${daysLeft}d left`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onTogglePriority(item.id)}
                title={starred ? 'Shipping first' : 'Ship this first'}
                className={`shrink-0 rounded-md p-1.5 transition ${starred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
              >
                <Star size={15} fill={starred ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}

        {rows.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Nothing expiring soon.</p>}
      </div>
    </div>
  );
}
