// Client-safe delivery constants, the shared zone type, and geo helpers.
// (No server/DuckDB imports here so it can be used from client components.)

export interface DeliveryZone {
  id: string;
  neighborhood: string;
  label: string;
  lng: number;
  lat: number;
  blocks: number;
  need: number; // model prior or posterior visible-person estimate
  requests: number; // 311 "Get It Done" requests
  observed: number; // 2014-2018 observed individuals
  violations: number; // 72-hour encampment enforcement reports
  tents?: number; // dsdp_tents (most recent digitized tent count)
  vehicles?: number; // dsdp_vehicles (most recent digitized vehicle count)
  custom?: boolean; // true for zones the user dropped on the map
  elevation?: number | null; // meters, from terrain query
  predicted?: boolean; // true when position/need came from the hotspot model
  confidence?: "historical-prior" | "drone-updated";
  model?: string;
  sourceDate?: string;
  targetMonth?: string;
  lastObservedAt?: string;
  feedbackObservations?: number;
}

export interface HotspotMeta {
  model: string;
  components?: Record<string, number>;
  source: string;
  source_date: string;
  target_month: string;
  forecast_role?: "historical_next_observation_prior";
  operational_gate?: "field_verification_required";
  generated_on: string;
  stale_source_warning: boolean;
  modern_panel_backtest?: {
    folds: number;
    model_mae: number;
    naive_mae: number;
    model_poisson_deviance: number;
    naive_poisson_deviance: number;
  };
  observations?: number;
  latest_observation?: string | null;
}

// Operations base for the sensing mission (downtown SD, Little Italy edge).
export const DEPOT = { label: "Drone operations base", lng: -117.17, lat: 32.7245 };

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
