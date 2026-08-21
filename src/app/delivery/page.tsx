"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Package, Plus } from "lucide-react";
import { DEPOT, haversineKm, type DeliveryZone } from "@/lib/delivery";
import { useZones } from "@/lib/useZones";

// mapbox-gl touches window on import, so load the map client-side only.
const DeliveryMap = dynamic(() => import("@/components/DeliveryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-stone-100 text-sm text-stone-500">Loading map…</div>,
});

export default function DeliveryPage() {
  const { zones: baseZones, meta, error } = useZones();
  const [custom, setCustom] = useState<DeliveryZone[]>([]);
  const zones = useMemo(() => [...baseZones, ...custom], [baseZones, custom]);

  function addZone(lngLat: { lng: number; lat: number }) {
    const id = `custom-${Date.now()}`;
    setCustom((prev) => [
      ...prev,
      {
        id,
        neighborhood: "custom",
        label: `Drop ${prev.length + 1}`,
        lng: lngLat.lng,
        lat: lngLat.lat,
        blocks: 0,
        need: 0,
        requests: 0,
        observed: 0,
        violations: 0,
        custom: true,
        elevation: null,
      },
    ]);
    // Resolve the drop's ground elevation server-side.
    fetch(`/api/elevation?lng=${lngLat.lng}&lat=${lngLat.lat}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.elevation != null) {
          setCustom((prev) => prev.map((z) => (z.id === id ? { ...z, elevation: d.elevation } : z)));
        }
      })
      .catch(() => {});
  }

  const sorted = useMemo(() => [...zones].sort((a, b) => Number(b.need) - Number(a.need)), [zones]);
  const totalNeed = useMemo(() => zones.reduce((s, z) => s + z.need, 0), [zones]);
  const totalKm = useMemo(() => zones.reduce((s, z) => s + haversineKm(DEPOT, z), 0), [zones]);
  const elevs = zones.map((z) => z.elevation).filter((e): e is number => e != null);
  const elevRange = elevs.length ? `${Math.round(Math.min(...elevs))}–${Math.round(Math.max(...elevs))} m` : "—";
  const maxNeed = Math.max(...zones.map((z) => z.need), 1);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Map */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-stone-200 shadow-sm">
        <DeliveryMap zones={zones} onAddZone={addZone} />
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-stone-600 shadow">
          <div className="mb-1 font-medium text-stone-800">Legend</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-red-600" /> high need</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-amber-400" /> lower need</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-cyan-400" /> custom drop</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-[3px] bg-yellow-600" /> depot</div>
          <div className="mt-1 text-stone-400">click the map to add a drop</div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="flex w-80 shrink-0 flex-col rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 p-4">
          <h2 className="font-semibold text-stone-900">Delivery zones</h2>
          <p className="text-xs text-stone-500">
            Movable block-level hotspots from the selected ensemble, ready for drone feedback.
          </p>
          {meta && (
            <p className={`mt-2 rounded-md px-2 py-1.5 text-[11px] ${meta.stale_source_warning ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
              {meta.model.replaceAll("_", " ")} · source {meta.source_date}
              {meta.observations ? ` · ${meta.observations} live observation${meta.observations === 1 ? "" : "s"}` : ""}
              {meta.stale_source_warning ? " · stale source: verify by drone before dispatch" : ""}
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-yellow-50 py-2">
              <div className="text-lg font-semibold text-stone-900">{zones.length}</div>
              <div className="text-[11px] text-stone-500">zones</div>
            </div>
            <div className="rounded-lg bg-yellow-50 py-2">
              <div className="text-lg font-semibold text-stone-900">{totalNeed}</div>
              <div className="text-[11px] text-stone-500">total need</div>
            </div>
            <div className="rounded-lg bg-yellow-50 py-2">
              <div className="text-lg font-semibold text-stone-900">{totalKm.toFixed(1)}</div>
              <div className="text-[11px] text-stone-500">spoke km</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span className="flex items-center gap-1"><Package size={12} /> {DEPOT.label}</span>
            <span>elev {elevRange}</span>
          </div>
        </div>

        {error && <div className="p-4 text-sm text-red-600">{error}</div>}

        <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
          {sorted.map((z) => {
            const km = haversineKm(DEPOT, z).toFixed(2);
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
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
                  <span>{z.predicted ? "predicted visible" : "need"} {z.need}</span>
                  <span>{z.requests} reqs</span>
                  {!z.custom && <span>{z.tents ?? 0} tents</span>}
                  {!z.custom && <span>{z.vehicles ?? 0} veh</span>}
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
