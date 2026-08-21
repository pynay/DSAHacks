import type { ActivityEntry } from '@/lib/dashboard';
import { HandHeart, Truck } from 'lucide-react';

export default function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((e) => {
        const Icon = e.kind === 'donation' ? HandHeart : Truck;
        const tone = e.kind === 'donation' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-100 text-orange-700';
        return (
          <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 py-3">
            <span className={`grid place-items-center w-8 h-8 rounded-lg ${tone}`}>
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900">{e.title}</div>
              <div className="text-xs text-slate-500">{e.subtitle}</div>
            </div>
            <span className="text-xs text-slate-400">{e.date}</span>
          </li>
        );
      })}
      {entries.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No activity yet.</li>}
    </ul>
  );
}
