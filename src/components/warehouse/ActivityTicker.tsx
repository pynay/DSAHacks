'use client';

import { ArrowDownToLine, ArrowUpFromLine, PackagePlus, Trash2 } from 'lucide-react';
import type { SimEvent, EventKind } from '@/lib/warehouse';

const STYLE: Record<EventKind, { icon: typeof ArrowUpFromLine; color: string }> = {
  distribution: { icon: ArrowUpFromLine, color: 'text-sky-600' },
  donation: { icon: ArrowDownToLine, color: 'text-emerald-600' },
  spoilage: { icon: Trash2, color: 'text-red-600' },
  reorder: { icon: PackagePlus, color: 'text-amber-600' },
};

export default function ActivityTicker({ events }: { events: SimEvent[] }) {
  return (
    <div className="flex h-72 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Live activity</h2>
      <p className="text-xs text-slate-500">What the warehouse engine is doing.</p>

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {events.map((e) => {
          const { icon: Icon, color } = STYLE[e.kind];
          return (
            <div key={e.id} className="flex items-start gap-2 text-xs">
              <Icon size={13} className={`mt-0.5 shrink-0 ${color}`} />
              <span className="text-slate-600">{e.text}</span>
              <span className="ml-auto shrink-0 tabular-nums text-slate-400">{e.date.slice(5)}</span>
            </div>
          );
        })}

        {events.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">Press Run to start the engine.</p>
        )}
      </div>
    </div>
  );
}
