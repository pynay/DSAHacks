'use client';

import { PackagePlus, Truck } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { reorderSuggestions, type Reorder } from '@/lib/warehouse';

export default function ReorderQueue({
  inventory,
  reorders,
  onApprove,
}: {
  inventory: InventoryItem[];
  reorders: Reorder[];
  onApprove: (itemId: string, qty: number) => void;
}) {
  const suggestions = reorderSuggestions(inventory).filter(
    // hide items that already have a pending reorder
    (s) => !reorders.some((r) => r.name === s.item.name),
  );

  return (
    <div className="flex h-72 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <PackagePlus size={16} className="text-emerald-700" /> Reorder queue
      </h2>
      <p className="text-xs text-slate-500">Items at or below their reorder threshold.</p>

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {reorders.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs">
            <span className="flex items-center gap-1.5 text-amber-800">
              <Truck size={12} /> {r.qty} {r.unit} {r.name}
            </span>
            <span className="shrink-0 text-amber-600">ETA {r.arriveDate.slice(5)}</span>
          </div>
        ))}

        {suggestions.map(({ item, suggestedQty }) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">{item.name}</div>
              <div className="text-[11px] text-slate-500">
                {item.quantity} {item.unit} left · suggest +{suggestedQty}
              </div>
            </div>
            <button
              onClick={() => onApprove(item.id, suggestedQty)}
              className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700"
            >
              Reorder
            </button>
          </div>
        ))}

        {suggestions.length === 0 && reorders.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">All stock above threshold.</p>
        )}
      </div>
    </div>
  );
}
