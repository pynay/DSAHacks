import type { ZoneEvidence } from '@/lib/plan/evidence';

// Semantic colors, deliberately separate from the app's navy/emerald accent:
// slate = model only, emerald = fresh field verification, amber = stale,
// violet = an operator override is active.
const TONE: Record<ZoneEvidence['kind'], string> = {
  historical: 'bg-slate-100 text-slate-600',
  verified: 'bg-emerald-100 text-emerald-800',
  stale: 'bg-amber-100 text-amber-800',
  overridden: 'bg-violet-100 text-violet-800',
};

export default function EvidenceChip({ evidence }: { evidence: ZoneEvidence }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[evidence.kind]}`}
    >
      {evidence.label}
    </span>
  );
}
