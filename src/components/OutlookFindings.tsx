import type { OutlookPayload } from '@/lib/outlookServer';

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function signed(n: number): string {
  const r = Math.round(n);
  return r >= 0 ? `+${r.toLocaleString()}` : r.toLocaleString();
}

// Three tiles: the 12-month forecast headline, then the camping ban's
// immediate level change on counted units and on 311 reports. Per controller
// ruling OL-R3, the ban tiles headline the term='post' level change (the more
// defensible estimate) and show effect_12m only as a smaller secondary line
// with a counterfactual-trend caveat. No semantic red/green on effect sign —
// the sign of an "associated with" estimate isn't inherently good or bad.
export default function OutlookFindings({
  forecastLast,
  beatsNaiveThrough,
  its,
}: {
  forecastLast: { month: string; value: number; lo: number; hi: number } | undefined;
  beatsNaiveThrough: number;
  its: OutlookPayload['its'];
}) {
  const dsdp = its.dsdp_adjusted_total;
  const requests = its.gid_requests;
  const beats = beatsNaiveThrough >= 12;

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
            beats ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {beats
            ? `Beats seasonal-naive through horizon ${beatsNaiveThrough}`
            : 'Does not beat seasonal-naive — use the band'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Camping ban × counted units</h3>
        {dsdp ? (
          <>
            <div className="mt-1 text-2xl font-semibold text-slate-700">
              {signed(dsdp.post.estimate)}
              <span className="text-sm font-normal text-slate-500"> ({dsdp.post.pct}%)</span>
            </div>
            <div className="text-xs text-slate-500">
              {fmt(dsdp.post.lo)} to {fmt(dsdp.post.hi)} (95% CI) &middot; placebo {signed(dsdp.post.placebo)}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Counted units (DSDP published, multiplier-adjusted) shifted {signed(dsdp.post.estimate)} right
              after the ban &mdash; associated with, not caused by, the ban.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              12-month effect vs. a counterfactual that extends the 2021&ndash;23 trend:{' '}
              {signed(dsdp.effect12.estimate)} ({fmt(dsdp.effect12.lo)} to {fmt(dsdp.effect12.hi)}, placebo{' '}
              {signed(dsdp.effect12.placebo)})
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
              {signed(requests.post.estimate)}
              <span className="text-sm font-normal text-slate-500"> ({requests.post.pct}%)</span>
            </div>
            <div className="text-xs text-slate-500">
              {fmt(requests.post.lo)} to {fmt(requests.post.hi)} (95% CI) &middot; placebo{' '}
              {signed(requests.post.placebo)}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Reports {requests.post.estimate >= 0 ? 'rose' : 'fell'} right after the ban &mdash; a reporting
              signal, not a headcount.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              12-month effect vs. a counterfactual that extends the 2021&ndash;23 trend:{' '}
              {signed(requests.effect12.estimate)} ({fmt(requests.effect12.lo)} to {fmt(requests.effect12.hi)},
              placebo {signed(requests.effect12.placebo)})
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No ITS result available.</p>
        )}
      </div>
    </div>
  );
}
