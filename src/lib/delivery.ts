// Client-safe delivery constants, the shared zone type, and geo helpers.
// (No server/DuckDB imports here so it can be used from client components.)

export interface DeliveryZone {
  id: string;
  neighborhood: string;
  label: string;
  lng: number;
  lat: number;
  blocks: number;
  need: number; // dsdp_individuals (most recent counted individuals)
  requests: number; // 311 "Get It Done" requests
  observed: number; // 2014-2018 observed individuals
  violations: number; // 72-hour encampment enforcement reports
  tents?: number; // dsdp_tents (most recent digitized tent count)
  vehicles?: number; // dsdp_vehicles (most recent digitized vehicle count)
  custom?: boolean; // true for zones the user dropped on the map
  elevation?: number | null; // meters, from terrain query
}

// Food-bank depot the drones launch from (downtown SD staging hub, Little Italy edge).
export const DEPOT = { label: "Food bank depot", lng: -117.17, lat: 32.7245 };

export const MAP_DEFAULTS = {
  center: [-117.1565, 32.7128] as [number, number],
  zoom: 13.9,
  pitch: 56,
  bearing: -18,
};

// Great-circle distance in km.
export function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
