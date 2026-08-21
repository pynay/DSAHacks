import { NextResponse } from "next/server";
import { getHotspotMeta, getZones } from "@/lib/zones";

// Native DuckDB bindings + filesystem reads: must run on the Node runtime, at
// request time (never during static prerender).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const zones = await getZones();
    let meta = null;
    try {
      meta = getHotspotMeta();
    } catch {
      // Static neighborhood-centroid fallback has no model metadata.
    }
    return NextResponse.json({ zones, meta });
  } catch (err) {
    console.error("[/api/zones] failed:", err);
    return NextResponse.json({ error: "Failed to load delivery zones" }, { status: 500 });
  }
}
