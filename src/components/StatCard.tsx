import type { LucideIcon } from 'lucide-react';

const TONES = {
  default: 'bg-yellow-100 text-yellow-700',
  warn: 'bg-orange-100 text-orange-700',
  danger: 'bg-red-100 text-red-700',
} as const;

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">{label}</span>
        <span className={`grid place-items-center w-8 h-8 rounded-lg ${TONES[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
    </div>
  );
}
