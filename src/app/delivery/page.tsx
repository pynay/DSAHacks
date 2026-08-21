"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Plane, Plus, TrendingUp } from "lucide-react";
import { DEPOT, haversineKm, type DeliveryZone } from "@/lib/delivery";
import { useZones } from "@/lib/useZones";

const DeliveryMap = dynamic(() => import("@/components/DeliveryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-stone-100 text-sm text-stone-500">Loading map…</div>,
});

interface Series {
  months: string[];
  hoods: Record<string, { last: number; values: number[] }>;
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  return `${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mo)]} '${y.slice(2)}`;
}

export default function DeliveryPage() {
  const { zones: baseZones, meta, error } = useZones();
  const [custom, setCustom] = useState<DeliveryZone[]>([]);
  const [series, setSeries] = useState<Series | null>(null);
  const [step, setStep] = useState(0); // 0 = now, 1..3 = forecast months

  useEffect(() => {
    fetch("/api/forecast")
      .then((r) => r.json())
      .then((d) => d.series && setSeries(d.series))
      .catch(() => {});
  }, []);

  // Context multiplier for a neighborhood at a horizon step (from the ML 311 forecast).
  const ratioAt = (neighborhood: string, s: number) => {
    if (s === 0 || !series?.hoods[neighborhood] || !series.hoods[neighborhood].last) return 1;
    return series.hoods[neighborhood].values[s - 1] / series.hoods[neighborhood].last;
  };

  // Scale block-model demand as a clearly labeled 311-pressure scenario.
  const predictedBase = useMemo(
    () => baseZones.map((z) => ({ ...z, need: Math.max(0, Math.round(z.need * ratioAt(z.neighborhood, step))) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseZones, series, step],
  );
  const zones = useMemo(() => [...predictedBase, ...custom], [predictedBase, custom]);

  // Need-weighted scenario centroid for a step, and the full trail.
  const centroidAt = (s: number): [number, number] | null => {
    const zs = baseZones
      .map((z) => ({ lng: z.lng, lat: z.lat, need: z.need * ratioAt(z.neighborhood, s) }))
      .filter((z) => z.need > 0);
    const tot = zs.reduce((a, z) => a + z.need, 0);
    if (!tot) return null;
    return [zs.reduce((a, z) => a + z.lng * z.need, 0) / tot, zs.reduce((a, z) => a + z.lat * z.need, 0) / tot];
  };
  const trail = useMemo(
    () => [0, 1, 2, 3].map(centroidAt).filter((c): c is [number, number] => !!c),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseZones, series],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const needCenter = useMemo(() => centroidAt(step), [baseZones, series, step]);

  // Fastest-rising 311 neighborhood at the selected horizon = a target to verify.
  const hotspot = useMemo(() => {
    if (step === 0 || !series) return null;
    let best: { zone: DeliveryZone; pct: number } | null = null;
    for (const z of baseZones) {
      const r = ratioAt(z.neighborhood, step);
      if (r > (best ? 1 + best.pct / 100 : 1.0001)) best = { zone: z, pct: Math.round((r - 1) * 100) };
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseZones, series, step]);

  function addZone(lngLat: { lng: number; lat: number }) {
    const id = `custom-${Date.now()}`;
    setCustom((prev) => [
      ...prev,
      { id, neighborhood: "custom", label: `Drop ${prev.length + 1}`, lng: lngLat.lng, lat: lngLat.lat, blocks: 0, need: 0, requests: 0, observed: 0, violations: 0, custom: true, elevation: null },
    ]);
    fetch(`/api/elevation?lng=${lngLat.lng}&lat=${lngLat.lat}`)
      .then((r) => r.json())
      .then((d) => d.elevation != null && setCustom((prev) => prev.map((z) => (z.id === id ? { ...z, elevation: d.elevation } : z))))
      .catch(() => {});
  }

  const sorted = useMemo(() => [...zones].sort((a, b) => b.need - a.need), [zones]);
  const totalNeed = useMemo(() => zones.reduce((s, z) => s + z.need, 0), [zones]);
  const totalKm = useMemo(() => zones.reduce((s, z) => s + haversineKm(DEPOT, z), 0), [zones]);
  const maxNeed = Math.max(...zones.map((z) => z.need), 1);
  const horizonLabels = ["Now", ...(series?.months ?? []).map(fmtMonth)];

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="relative flex-1 overflow-hidden rounded-xl border border-stone-200 shadow-sm">
        <DeliveryMap zones={zones} onAddZone={addZone} needCenter={needCenter} centerTrail={trail} />
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-stone-600 shadow">
          <div className="mb-1 font-medium text-stone-800">Legend</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-red-600" /> high need</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-amber-400" /> lower need</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-fuchsia-500" /> scenario center</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-[3px] bg-yellow-600" /> depot</div>
          <div className="mt-1 text-stone-400">{step === 0 ? "current estimate · click to add a drop" : `311 scenario: ${horizonLabels[step]}`}</div>
        </div>
      </div>

      <aside className="flex w-80 shrink-0 flex-col rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 p-4">
          <h2 className="font-semibold text-stone-900">Delivery zones</h2>
          <p className="text-xs text-stone-500">
            Movable block hotspots from the selected ensemble, with a 311-pressure scenario and
            live drone feedback.
          </p>
          {meta && (
            <p className={`mt-2 rounded-md px-2 py-1.5 text-[11px] ${meta.stale_source_warning ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
              {meta.model.replaceAll("_", " ")} · source {meta.source_date}
              {meta.observations ? ` · ${meta.observations} live observation${meta.observations === 1 ? "" : "s"}` : ""}
              {meta.stale_source_warning ? " · stale source: verify by drone before dispatch" : ""}
            </p>
          )}

          {/* Forecast horizon */}
          <div className="mt-3">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-stone-500">
              <TrendingUp size={12} /> 311 pressure scenario
            </div>
            <div className="flex overflow-hidden rounded-lg border border-stone-300 text-[11px]">
              {horizonLabels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  disabled={i > 0 && !series}
                  className={`flex-1 px-1.5 py-1.5 font-medium disabled:opacity-40 ${step === i ? "bg-yellow-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-stone-400">
              Scales hotspot demand by forecast request pressure; it is not a person-count forecast.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-yellow-50 py-2">
              <div className="text-lg font-semibold text-stone-900">{zones.length}</div>
              <div className="text-[11px] text-stone-500">zones</div>
            </div>
            <div className="rounded-lg bg-yellow-50 py-2">
              <div className="text-lg font-semibold text-stone-900">{totalNeed}</div>
              <div className="text-[11px] text-stone-500">{step === 0 ? "total need" : "scenario need"}</div>
            </div>
            <div className="rounded-lg bg-yellow-50 py-2">
              <div className="text-lg font-semibold text-stone-900">{totalKm.toFixed(1)}</div>
              <div className="text-[11px] text-stone-500">spoke km</div>
            </div>
          </div>

          {hotspot && (
            <div className="mt-3 rounded-lg bg-orange-50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-orange-800">Rising request pressure</div>
              <div className="mt-0.5 text-sm font-semibold text-orange-900">
                {hotspot.zone.label} ↑{hotspot.pct}% by {horizonLabels[step]}
              </div>
              <p className="mt-0.5 text-[11px] text-orange-700">
                The 311 forecast suggests increasing pressure here. Verify on the ground before pre-positioning food.
              </p>
              <Link
                href="/drone"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
              >
                <Plane size={13} /> Dispatch drone to check
              </Link>
            </div>
          )}
        </div>

        {error && <div className="p-4 text-sm text-red-600">{error}</div>}

        <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
          {sorted.map((z) => {
            const km = haversineKm(DEPOT, z).toFixed(2);
            const base = baseZones.find((b) => b.id === z.id);
            const delta = step > 0 && base && !z.custom ? z.need - base.need : 0;
            const pct = Math.min(100, (z.need / maxNeed) * 100);
            return (
              <li key={z.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                    {z.custom ? <Plus size={13} className="text-cyan-500" /> : <MapPin size={13} className="text-red-500" />}
                    {z.label}
                  </span>
                  <span className="text-xs text-stone-500">{km} km</span>
                </div>
                {!z.custom && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
                  <span>
                    {z.predicted ? "visible estimate" : "need"} {z.need}
                    {delta !== 0 && (
                      <span className={delta > 0 ? "text-orange-600" : "text-emerald-600"}>
                        {" "}
                        {delta > 0 ? "↑" : "↓"}
                        {Math.abs(delta)}
                      </span>
                    )}
                  </span>
                  <span>{z.requests} reqs</span>
                  {!z.custom && <span>{z.tents ?? 0} tents</span>}
                  <span>elev {z.elevation != null ? `${Math.round(z.elevation)} m` : "—"}</span>
                  {z.lastObservedAt && <span>updated {new Date(z.lastObservedAt).toLocaleString()}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
