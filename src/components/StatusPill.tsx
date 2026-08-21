import type { Status } from '@/lib/types';

const STYLES: Record<Status, string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  Low: 'bg-amber-100 text-amber-800',
  Expiring: 'bg-orange-100 text-orange-800',
  Out: 'bg-red-100 text-red-800',
};

export default function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
