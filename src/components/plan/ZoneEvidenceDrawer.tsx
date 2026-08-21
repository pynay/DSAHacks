'use client';

import type { DeliveryZone } from '@/lib/delivery';
import type { OutlookPayload } from '@/lib/outlookServer';
import type { LedgerEvent } from '@/lib/store/types';

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

// 'YYYY-MM' -> 'Aug 2026'.
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export default function ZoneEvidenceDrawer({
  neighborhoodId,
  label,
  outlook,
  zones,
  ledger,
}: {
  neighborhoodId: string;
  label: string;
  outlook: OutlookPayload;
  zones: DeliveryZone[];
  ledger: LedgerEvent[];
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const rows = (outlook.byNeighborhood[neighborhoodId] ?? [])
    .filter((r) => r.month >= currentMonth)
    .slice(0, 6);
  const hotspots = zones.filter((z) => z.neighborhood === neighborhoodId && z.predicted);
  const hotspotIds = new Set(hotspots.map((z) => z.id));
  const recent = ledger
    .filter((e) => e.zoneId && hotspotIds.has(e.zoneId))
    .slice(0, 5);
  const dsdp = outlook.its.dsdp_adjusted_total;

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-700">{label}: monthly forecast (no downtown chart per-zone)</h4>
          <p className="text-[11px] text-slate-400">
            No per-neighborhood history is charted; these are the model&apos;s forecast months this zone&apos;s
            weekly need is spread from.
          </p>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-1 font-normal">Month</th>
                <th className="pb-1 font-normal">Value</th>
                <th className="pb-1 font-normal">80% band</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-1 text-slate-400">
                    No forecast rows for this zone.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.month} className="border-t border-slate-200 text-slate-600">
                  <td className="py-1">{monthLabel(r.month)}</td>
                  <td className="py-1">{fmt(r.value)}</td>
                  <td className="py-1">
                    {fmt(r.lo)}&ndash;{fmt(r.hi)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-700">Field &amp; operator history</h4>
          {hotspots.length === 0 && (
            <p className="mt-1 text-[11px] text-slate-400">No model hotspot lands in this neighborhood.</p>
          )}
          <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
            {recent.length === 0 && <li className="text-slate-400">No recent events.</li>}
            {recent.map((e) => (
              <li key={e.id}>
                <span className="text-slate-400">{new Date(e.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>{' '}
                {e.type.replace(/_/g, ' ')}
                {e.note ? ` — ${e.note}` : ''}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-700">Camping ban, downtown-wide</h4>
          {dsdp ? (
            <>
              <div className="mt-1 text-lg font-semibold text-slate-700">
                {dsdp.post.estimate >= 0 ? '+' : ''}
                {fmt(dsdp.post.estimate)} units
                <span className="ml-1 text-xs font-normal text-slate-500">({dsdp.post.pct >= 0 ? '+' : ''}{dsdp.post.pct}%)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Level change vs. the pre-ban trend, downtown total (not zone-specific) — associated with, not
                caused by, the ban.
              </p>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">No ITS result available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
