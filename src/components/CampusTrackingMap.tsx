"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from "geojson";
import { GEISEL, HDSI, PERSON_SPOTS } from "@/lib/campusMission";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function lineFC(coords: [number, number][]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }],
  };
}

// A labeled endpoint pin (Geisel / HDSI).
function addEndpoint(map: mapboxgl.Map, pt: { lng: number; lat: number; label: string }, glyph: string, color: string) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;align-items:center;gap:6px;transform:translateY(-2px)";
  el.innerHTML =
    `<span style="width:22px;height:22px;border-radius:6px;background:${color};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font-size:12px">${glyph}</span>` +
    `<span style="font:600 11px/1 Inter,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);white-space:nowrap">${pt.label}</span>`;
  new mapboxgl.Marker({ element: el, anchor: "left" }).setLngLat([pt.lng, pt.lat]).addTo(map);
}

// A pulsing drop-zone marker (delivery target) placed at HDSI.
function makeDropZoneEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;align-items:center;gap:6px";
  el.innerHTML =
    '<span style="position:relative;width:26px;height:26px;display:grid;place-items:center">' +
    '<span class="animate-ping" style="position:absolute;inset:0;border-radius:50%;background:rgba(16,185,129,.45)"></span>' +
    '<span style="position:relative;width:26px;height:26px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font-size:13px">▣</span>' +
    "</span>" +
    '<span style="font:700 11px/1 Inter,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);white-space:nowrap">Delivery drop-off</span>';
  return el;
}

// A single detected-person marker.
function makePersonEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:24px;height:24px;border-radius:50%;background:#34d399;border:2px solid #fff;box-shadow:0 0 8px rgba(52,211,153,.85);display:grid;place-items:center;font-size:13px;line-height:1";
  el.textContent = "👤";
  el.title = "EyePop-detected person";
  return el;
}

// Focused UCSD map for the Geisel -> HDSI tracking mission. Self-contained (its
// own Mapbox instance) so it stays independent of the downtown delivery map.
export default function CampusTrackingMap({
  drone = null,
  peopleCount = 0,
  dropZone = false,
}: {
  drone?: { lng: number; lat: number; headingDeg: number } | null;
  peopleCount?: number; // EyePop-detected people to plot in the HDSI courtyard
  dropZone?: boolean; // show the delivery drop-off indicator at HDSI
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const droneMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const peopleMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const dropZoneMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [(GEISEL.lng + HDSI.lng) / 2, (GEISEL.lat + HDSI.lat) / 2],
      zoom: 15.6,
      pitch: 58,
      bearing: 26,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("style.load", () => {
      map.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
      map.addLayer({ id: "sky", type: "sky", paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0, 90], "sky-atmosphere-sun-intensity": 8 } });

      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", ["get", "extrude"], "true"],
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["get", "height"], 0, "#3a3a46", 40, "#4c4c5c", 90, "#61617a"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.9,
        },
      });

      // Planned route (full, dashed) and the flown portion (solid emerald).
      map.addSource("route", { type: "geojson", data: lineFC([[GEISEL.lng, GEISEL.lat], [HDSI.lng, HDSI.lat]]) });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 3, "line-opacity": 0.5, "line-dasharray": [1.4, 1.1] },
      });
      map.addSource("flown", { type: "geojson", data: lineFC([[GEISEL.lng, GEISEL.lat]]) });
      map.addLayer({
        id: "flown-line",
        type: "line",
        source: "flown",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#34d399", "line-width": 4, "line-opacity": 0.95 },
      });

      addEndpoint(map, GEISEL, "▲", "#059669");
      addEndpoint(map, HDSI, "◉", "#f97316");

      readyRef.current = true;
      map.fitBounds(
        new mapboxgl.LngLatBounds([GEISEL.lng, GEISEL.lat], [GEISEL.lng, GEISEL.lat]).extend([HDSI.lng, HDSI.lat]),
        { padding: { top: 96, bottom: 110, left: 90, right: 90 }, maxZoom: 16.4, pitch: 58, bearing: 26, duration: 0 },
      );
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Drone marker glides to each new position; the flown line trails behind it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!drone) {
      droneMarkerRef.current?.remove();
      droneMarkerRef.current = null;
      if (readyRef.current) {
        (map.getSource("flown") as mapboxgl.GeoJSONSource | undefined)?.setData(lineFC([[GEISEL.lng, GEISEL.lat]]));
      }
      return;
    }
    if (!droneMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "transition:transform .12s linear";
      el.innerHTML =
        '<div style="width:30px;height:30px;border-radius:50%;background:#22d3ee;border:2px solid #fff;box-shadow:0 0 14px #22d3ee;display:grid;place-items:center;color:#083344;font-size:17px">✈</div>';
      droneMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center", rotationAlignment: "map" })
        .setLngLat([drone.lng, drone.lat])
        .addTo(map);
    }
    droneMarkerRef.current.setLngLat([drone.lng, drone.lat]);
    const inner = droneMarkerRef.current.getElement().firstElementChild as HTMLElement | null;
    if (inner) inner.style.transform = `rotate(${drone.headingDeg}deg)`;
    if (readyRef.current) {
      (map.getSource("flown") as mapboxgl.GeoJSONSource | undefined)?.setData(
        lineFC([[GEISEL.lng, GEISEL.lat], [drone.lng, drone.lat]]),
      );
    }
  }, [drone]);

  // Detected-person markers, reconciled only when the count changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const want = Math.max(0, Math.min(PERSON_SPOTS.length, peopleCount));
    const markers = peopleMarkersRef.current;
    while (markers.length > want) markers.pop()?.remove();
    while (markers.length < want) {
      const spot = PERSON_SPOTS[markers.length];
      markers.push(new mapboxgl.Marker({ element: makePersonEl(), anchor: "center" }).setLngLat([spot.lng, spot.lat]).addTo(map));
    }
  }, [peopleCount]);

  // Delivery drop-off indicator at HDSI.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!dropZone) {
      dropZoneMarkerRef.current?.remove();
      dropZoneMarkerRef.current = null;
      return;
    }
    if (!dropZoneMarkerRef.current) {
      dropZoneMarkerRef.current = new mapboxgl.Marker({ element: makeDropZoneEl(), anchor: "left", offset: [0, 24] })
        .setLngLat([HDSI.lng, HDSI.lat])
        .addTo(map);
    }
  }, [dropZone]);

  if (!TOKEN) {
    return (
      <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-500">
        Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to load the map.
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full" />;
}
