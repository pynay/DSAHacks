"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from "geojson";
import { DEPOT, MAP_DEFAULTS, haversineKm, type DeliveryZone } from "@/lib/delivery";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function zonesFC(zones: DeliveryZone[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [z.lng, z.lat] },
      properties: { id: z.id, label: z.label, need: z.need, custom: !!z.custom },
    })),
  };
}

function spokesFC(zones: DeliveryZone[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[DEPOT.lng, DEPOT.lat], [z.lng, z.lat]] },
      properties: { custom: !!z.custom },
    })),
  };
}

export default function DeliveryMap({
  zones,
  onAddZone,
  drone = null,
  zoom,
  needCenter = null,
  centerTrail = [],
}: {
  zones: DeliveryZone[];
  onAddZone: (lngLat: { lng: number; lat: number }) => void;
  drone?: { lng: number; lat: number; headingDeg: number } | null;
  zoom?: number;
  needCenter?: [number, number] | null; // predicted need centroid for the selected month
  centerTrail?: [number, number][]; // centroids across the forecast horizon
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const droneMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Keep latest props reachable from stable map event handlers.
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const addRef = useRef(onAddZone);
  addRef.current = onAddZone;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: MAP_DEFAULTS.center,
      zoom: zoom ?? MAP_DEFAULTS.zoom,
      pitch: MAP_DEFAULTS.pitch,
      bearing: MAP_DEFAULTS.bearing,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("style.load", () => {
      // 3D terrain + sky.
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      map.addLayer({
        id: "sky",
        type: "sky",
        paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0, 90], "sky-atmosphere-sun-intensity": 8 },
      });

      // 3D building extrusions.
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", ["get", "extrude"], "true"],
        type: "fill-extrusion",
        // Keep buildings rendered when zoomed out a little (so the drone stays
        // on a populated map as it flies the route).
        minzoom: 10,
        paint: {
          // Taller buildings read lighter, so the 3D massing pops on the dark base.
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0,
            "#3a3a46",
            80,
            "#565667",
            200,
            "#6b6b80",
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.92,
        },
      });

      // Empty sources, filled by the sync effect.
      map.addSource("spokes", { type: "geojson", data: spokesFC([]) });
      map.addSource("zones", { type: "geojson", data: zonesFC([]) });

      map.addLayer({
        id: "spokes-line",
        type: "line",
        source: "spokes",
        paint: {
          "line-color": ["case", ["get", "custom"], "#22d3ee", "#f59e0b"],
          "line-width": 2,
          "line-opacity": 0.7,
          "line-dasharray": [1.6, 1.1],
        },
      });
      map.addLayer({
        id: "zones-circle",
        type: "circle",
        source: "zones",
        paint: {
          "circle-radius": ["case", ["get", "custom"], 10, ["interpolate", ["linear"], ["get", "need"], 0, 7, 320, 34]],
          "circle-color": [
            "case",
            ["get", "custom"],
            "#22d3ee",
            ["interpolate", ["linear"], ["get", "need"], 0, "#fcd34d", 80, "#f59e0b", 200, "#ef4444", 320, "#b91c1c"],
          ],
          "circle-opacity": 0.82,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "zones-label",
        type: "symbol",
        source: "zones",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: { "text-color": "#f5f5f4", "text-halo-color": "#1c1917", "text-halo-width": 1.2 },
      });

      // Predicted need-center trail (how the forecast moves the center of need).
      map.addSource("needtrail", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "needtrail-line",
        type: "line",
        source: "needtrail",
        paint: { "line-color": "#d946ef", "line-width": 2.5, "line-dasharray": [1, 1.2], "line-opacity": 0.85 },
      });

      // Depot marker.
      const el = document.createElement("div");
      el.style.cssText =
        "width:26px;height:26px;border-radius:7px;background:#ca8a04;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font-size:14px";
      el.textContent = "▣";
      el.title = DEPOT.label;
      new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([DEPOT.lng, DEPOT.lat]).addTo(map);

      readyRef.current = true;
      syncData();
    });

    // Click: popup on an existing zone, otherwise drop a new zone.
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ["zones-circle"] });
      if (hits.length) {
        const p = (hits[0].properties ?? {}) as { id?: string; label?: string };
        const z = zonesRef.current.find((x) => x.id === p.id);
        const dist = z ? haversineKm(DEPOT, z).toFixed(2) : "?";
        const elev = z?.elevation != null ? `${Math.round(z.elevation)} m` : "—";
        new mapboxgl.Popup({ offset: 14, closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:12px/1.4 Inter,sans-serif;color:#1c1917">
               <b>${p.label}</b><br/>
               ${z?.predicted ? "predicted visible" : "need"} ${z?.need ?? "?"} · ${z?.requests ?? "?"} 311 reqs<br/>
               ${z?.tents ?? 0} tents · ${z?.vehicles ?? 0} vehicles<br/>
               ${z?.confidence === "drone-updated" ? "drone-updated" : z?.predicted ? "model estimate" : "current data"}<br/>
               ${dist} km from depot · elev ${elev}
             </div>`,
          )
          .addTo(map);
        return;
      }
      addRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    map.on("mouseenter", "zones-circle", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "zones-circle", () => (map.getCanvas().style.cursor = ""));

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // `zoom` is an initial-map option; changing it must not recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync zone/spoke data + query elevations whenever zones change.
  function syncData() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const zs = zonesRef.current;
    (map.getSource("zones") as mapboxgl.GeoJSONSource | undefined)?.setData(zonesFC(zs));
    (map.getSource("spokes") as mapboxgl.GeoJSONSource | undefined)?.setData(spokesFC(zs));
  }

  useEffect(() => {
    syncData();
  }, [zones]);

  // Live drone marker: created once, then glides to each new position.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!drone) {
      droneMarkerRef.current?.remove();
      droneMarkerRef.current = null;
      return;
    }
    if (!droneMarkerRef.current) {
      const el = document.createElement("div");
      // Outer element gets the position transition so movement glides.
      el.style.cssText = "transition:transform .65s linear";
      el.innerHTML =
        '<div style="width:30px;height:30px;border-radius:50%;background:#22d3ee;border:2px solid #fff;box-shadow:0 0 14px #22d3ee;display:grid;place-items:center;color:#083344;font-size:17px">✈</div>';
      droneMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center", rotationAlignment: "map" })
        .setLngLat([drone.lng, drone.lat])
        .addTo(map);
    }
    droneMarkerRef.current.setLngLat([drone.lng, drone.lat]);
    const inner = droneMarkerRef.current.getElement().firstElementChild as HTMLElement | null;
    if (inner) inner.style.transform = `rotate(${drone.headingDeg}deg)`;
  }, [drone]);

  // Predicted need-center trail line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("needtrail") as mapboxgl.GeoJSONSource | undefined;
    src?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: centerTrail }, properties: {} });
  }, [centerTrail]);

  // Predicted need-center marker (pulsing), glides between forecast months.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!needCenter) {
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      return;
    }
    if (!centerMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "transition:transform .5s ease";
      el.innerHTML =
        '<div style="width:20px;height:20px;border-radius:50%;background:#d946ef;border:2px solid #fff;box-shadow:0 0 0 6px rgba(217,70,239,.28)"></div>';
      centerMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(needCenter).addTo(map);
    }
    centerMarkerRef.current.setLngLat(needCenter);
  }, [needCenter]);

  if (!TOKEN) {
    return (
      <div className="grid h-full place-items-center bg-stone-100 text-sm text-stone-500">
        Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to load the map.
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full" />;
}
