import type { OutlookPayload } from '@/lib/outlookServer';

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function signed(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r.toLocaleString()}` : r.toLocaleString();
}

function signedPct(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r}%` : `${r}%`;
}

// 'YYYY-MM' -> 'Aug 2023'.
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

// Three tiles: the 12-month forecast headline, then the camping ban's
// immediate level change on counted units and on 311 reports. Per controller
// ruling OL-R3, the ban tiles headline the term='post' level change (the least
// trend-dependent estimate — the gap vs. the pre-ban trend projected to T0, not
// an observed month-over-month change) and show effect_12m only as a smaller
// secondary line with a counterfactual-trend caveat. No semantic red/green on
// effect sign — the sign of an "associated with" estimate isn't inherently good
// or bad.
export default function OutlookFindings({
  forecastLast,
  beatsNaiveThrough,
  beatsLastValueFrom,
  its,
  t0,
}: {
  forecastLast: { month: string; value: number; lo: number; hi: number } | undefined;
  beatsNaiveThrough: number;
  beatsLastValueFrom: number;
  its: OutlookPayload['its'];
  t0: string;
}) {
  const dsdp = its.dsdp_adjusted_total;
  const requests = its.gid_requests;
  const beatsSN = beatsNaiveThrough > 0;
  // Amber whenever the model only beats naive persistence (last value) from some horizon
  // past 1 — i.e. there's a stretch of near-term horizons where it offers no edge over
  // just carrying the last published value forward.
  const lvWarn = beatsLastValueFrom > 1;
  const t0Label = monthLabel(t0);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">12-month outlook</h3>
        {forecastLast ? (
          <>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {fmt(forecastLast.value)}
              <span className="text-sm font-normal text-slate-500"> counted units</span>
            </div>
            <div className="text-xs text-slate-500">
              {fmt(forecastLast.lo)}–{fmt(forecastLast.hi)} (80% band), {forecastLast.month}
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No forecast available.</p>
        )}
        <p
          className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
            lvWarn ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {beatsSN
            ? `Beats seasonal-naive through horizon ${beatsNaiveThrough}`
            : 'Does not beat seasonal-naive'}
          {beatsLastValueFrom > 1
            ? `; beats naive persistence (last value) only from horizon ${beatsLastValueFrom} — at 1–${
                beatsLastValueFrom - 1
              } month${beatsLastValueFrom - 1 > 1 ? 's' : ''} use the band`
            : beatsLastValueFrom === 1
              ? '; beats naive persistence (last value) at every horizon'
              : '; never beats naive persistence (last value) — use the band'}
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          Bands are summed across neighborhoods and are therefore wider than a true 80% interval for the
          downtown total.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Camping ban × counted units</h3>
        {dsdp ? (
          <>
            <div className="mt-1 text-2xl font-semibold text-slate-700">
              {signed(dsdp.post.estimate)} units
              <span className="text-sm font-normal text-slate-500"> ({signedPct(dsdp.post.pct)})</span>
            </div>
            <div className="text-xs text-slate-500">
              {fmt(dsdp.post.lo)} to {fmt(dsdp.post.hi)} (95% CI) &middot; placebo {signed(dsdp.post.placebo)}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Counted units (DSDP published, multiplier-adjusted) are an estimated {signed(dsdp.post.estimate)}{' '}
              units {dsdp.post.estimate < 0 ? 'lower' : 'higher'} than the pre-ban trend projected for{' '}
              {t0Label} ({signedPct(dsdp.post.pct)} of the pre-ban average monthly count) &mdash; associated
              with, not caused by, the ban.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              12-month effect vs. a counterfactual that extends the 2021&ndash;23 trend:{' '}
              {signed(dsdp.effect12.estimate)} ({fmt(dsdp.effect12.lo)} to {fmt(dsdp.effect12.hi)}, placebo{' '}
              {signed(dsdp.effect12.placebo)})
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              HAC 95% CIs read as roughly 85&ndash;90% in samples of ~60 months.
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No ITS result available.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Camping ban × 311 reports</h3>
        {requests ? (
          <>
            <div className="mt-1 text-2xl font-semibold text-slate-700">
              {signed(requests.post.estimate)} reports/month
              <span className="text-sm font-normal text-slate-500"> ({signedPct(requests.post.pct)})</span>
            </div>
            <div className="text-xs text-slate-500">
              {fmt(requests.post.lo)} to {fmt(requests.post.hi)} (95% CI) &middot; placebo{' '}
              {signed(requests.post.placebo)}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Reports are an estimated {signed(requests.post.estimate)} reports/month{' '}
              {requests.post.estimate < 0 ? 'lower' : 'higher'} than the pre-ban trend projected for {t0Label}{' '}
              ({signedPct(requests.post.pct)} of the pre-ban average monthly count) &mdash; a reporting signal,
              not a headcount.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              12-month effect vs. a counterfactual that extends the 2021&ndash;23 trend:{' '}
              {signed(requests.effect12.estimate)} ({fmt(requests.effect12.lo)} to {fmt(requests.effect12.hi)},
              placebo {signed(requests.effect12.placebo)})
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              HAC 95% CIs read as roughly 85&ndash;90% in samples of ~60 months.
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No ITS result available.</p>
        )}
      </div>
    </div>
  );
}
