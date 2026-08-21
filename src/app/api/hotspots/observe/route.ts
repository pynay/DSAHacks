import { NextResponse } from "next/server";
import { getHotspotMeta, getZones } from "@/lib/zones";
import { observeHotspot, type HotspotObservationInput } from "@/lib/hotspotState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<HotspotObservationInput>;
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
      return NextResponse.json(
        { error: "lat/lng must be valid coordinates and count must be an integer from 0 to 5000" },
        { status: 400 },
      );
    }
    if (body.confidence !== undefined && (!finite(body.confidence) || body.confidence <= 0 || body.confidence > 1)) {
      return NextResponse.json({ error: "confidence must be greater than 0 and at most 1" }, { status: 400 });
    }
    if (body.coverage !== undefined && (!finite(body.coverage) || body.coverage < 0.05 || body.coverage > 1)) {
      return NextResponse.json({ error: "coverage must be between 0.05 and 1" }, { status: 400 });
    }
    if (body.radiusKm !== undefined && (!finite(body.radiusKm) || body.radiusKm < 0.03 || body.radiusKm > 2)) {
      return NextResponse.json({ error: "radiusKm must be between 0.03 and 2" }, { status: 400 });
    }
    if (body.observedAt !== undefined && Number.isNaN(Date.parse(body.observedAt))) {
      return NextResponse.json({ error: "observedAt must be an ISO-compatible timestamp" }, { status: 400 });
    }

    const observation = observeHotspot(body as HotspotObservationInput);
    const zones = await getZones();
    return NextResponse.json({ observation, zones, meta: getHotspotMeta() });
  } catch (error) {
    console.error("[/api/hotspots/observe] failed:", error);
    return NextResponse.json({ error: "Failed to assimilate hotspot observation" }, { status: 500 });
  }
}
