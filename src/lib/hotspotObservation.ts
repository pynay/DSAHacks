import type { HotspotObservationInput } from "./hotspotState";

export class HotspotObservationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "HotspotObservationError";
  }
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validate and narrow untrusted JSON before it reaches the assimilation model. */
export function parseHotspotObservation(value: unknown): HotspotObservationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HotspotObservationError("request body must be a JSON object");
  }

  const body = value as Record<string, unknown>;
  if (
    !finite(body.lat) ||
    body.lat < -90 ||
    body.lat > 90 ||
    !finite(body.lng) ||
    body.lng < -180 ||
    body.lng > 180 ||
    !finite(body.count) ||
    body.count < 0 ||
    body.count > 5000 ||
    !Number.isInteger(body.count)
  ) {
    throw new HotspotObservationError(
      "lat/lng must be valid coordinates and count must be an integer from 0 to 5000",
    );
  }
  if (
    body.confidence !== undefined &&
    (!finite(body.confidence) || body.confidence <= 0 || body.confidence > 1)
  ) {
    throw new HotspotObservationError("confidence must be greater than 0 and at most 1");
  }
  if (
    body.coverage !== undefined &&
    (!finite(body.coverage) || body.coverage < 0.05 || body.coverage > 1)
  ) {
    throw new HotspotObservationError("coverage must be between 0.05 and 1");
  }
  if (
    body.radiusKm !== undefined &&
    (!finite(body.radiusKm) || body.radiusKm < 0.03 || body.radiusKm > 2)
  ) {
    throw new HotspotObservationError("radiusKm must be between 0.03 and 2");
  }
  if (
    body.observedAt !== undefined &&
    (typeof body.observedAt !== "string" || Number.isNaN(Date.parse(body.observedAt)))
  ) {
    throw new HotspotObservationError("observedAt must be an ISO-compatible timestamp");
  }

  return {
    lat: body.lat,
    lng: body.lng,
    count: body.count,
    ...(body.confidence === undefined ? {} : { confidence: body.confidence }),
    ...(body.coverage === undefined ? {} : { coverage: body.coverage }),
    ...(body.radiusKm === undefined ? {} : { radiusKm: body.radiusKm }),
    ...(body.observedAt === undefined ? {} : { observedAt: body.observedAt }),
  };
}
