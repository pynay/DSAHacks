import { NextResponse } from "next/server";
import { getHotspotMeta, getZones } from "@/lib/zones";
import { observeHotspot } from "@/lib/hotspotState";
import {
  HotspotObservationError,
  parseHotspotObservation,
} from "@/lib/hotspotObservation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const observation = observeHotspot(parseHotspotObservation(await request.json()));
    const zones = await getZones();
    return NextResponse.json({ observation, zones, meta: getHotspotMeta() });
  } catch (error) {
    if (error instanceof HotspotObservationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
    }
    console.error("[/api/hotspots/observe] failed:", error);
    return NextResponse.json({ error: "Failed to assimilate hotspot observation" }, { status: 500 });
  }
}
