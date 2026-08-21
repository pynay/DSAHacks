'use client';

// Neighborhood x month need heatmap (311 homelessness requests). Sequential
// single-hue ramp (light -> deep amber) encodes magnitude; rows are ordered by
// total need. Row labels give identity, so color is never the only channel.
function fmtMonth(m: string): string {
  const [, mo] = m.split('-');
  return ['', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][Number(mo)];
}

function ramp(t: number): string {
  // #fff7ed (amber-50) -> #9a3412 (orange-800)
  const a = [255, 247, 237];
  const b = [154, 52, 18];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function NeedHeatmap({
  months,
  rows,
}: {
  months: string[];
  rows: { label: string; values: number[] }[];
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));

  return (
    <div className="text-xs">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <div className="w-24 shrink-0 truncate text-right font-medium text-slate-600">{r.label}</div>
            <div className="flex flex-1 gap-[2px]">
              {r.values.map((v, i) => (
                <div
                  key={i}
                  title={`${r.label} · ${months[i]}: ${Math.round(v)} 311 requests`}
                  className="h-6 flex-1 rounded-[2px] transition-transform hover:scale-y-110"
                  style={{ background: ramp(v / max) }}
                />
              ))}
            </div>
          </div>
        ))}
        {/* month axis */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="w-24 shrink-0" />
          <div className="flex flex-1 gap-[2px] text-[9px] text-slate-400">
            {months.map((m, i) => (
              <div key={i} className="flex-1 text-center">
                {i === 0 || i === months.length - 1 || Number(m.split('-')[1]) === 1 ? fmtMonth(m) : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* legend */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
        <span>fewer</span>
        <div
          className="h-2 w-24 rounded-full"
          style={{ background: `linear-gradient(90deg, ${ramp(0.05)}, ${ramp(1)})` }}
        />
        <span>more 311 requests</span>
      </div>
    </div>
  );
}
