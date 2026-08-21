'use client';

import type { InventoryItem } from '@/lib/types';
import { deriveStatus } from '@/lib/inventory';
import StatusPill from './StatusPill';
import { Minus, Plus } from 'lucide-react';

export default function InventoryTable({
  items,
  onAdjust,
  now,
}: {
  items: InventoryItem[];
  onAdjust: (id: string, delta: number) => void;
  now: Date;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="px-4 py-3 font-medium">Item</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Quantity</th>
            <th className="px-4 py-3 font-medium">Expires</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-stone-100 last:border-0 hover:bg-yellow-50/50">
              <td className="px-4 py-3 font-medium text-stone-900">{i.name}</td>
              <td className="px-4 py-3 text-stone-600">{i.category}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAdjust(i.id, -1)}
                    className="grid place-items-center w-6 h-6 rounded border border-stone-300 text-stone-500 hover:bg-stone-100"
                    aria-label={`Decrease ${i.name}`}
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-16 text-center tabular-nums">
                    {i.quantity} {i.unit}
                  </span>
                  <button
                    onClick={() => onAdjust(i.id, 1)}
                    className="grid place-items-center w-6 h-6 rounded border border-stone-300 text-stone-500 hover:bg-stone-100"
                    aria-label={`Increase ${i.name}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-stone-600">{i.expirationDate}</td>
              <td className="px-4 py-3 text-stone-600">{i.location}</td>
              <td className="px-4 py-3">
                <StatusPill status={deriveStatus(i, now)} />
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                No items match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
