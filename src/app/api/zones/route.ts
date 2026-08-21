import { NextResponse } from "next/server";
import { getZones } from "@/lib/zones";

// Native DuckDB bindings + filesystem reads: must run on the Node runtime, at
// request time (never during static prerender).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const zones = await getZones();
    return NextResponse.json({ zones });
  } catch (err) {
    console.error("[/api/zones] failed:", err);
    return NextResponse.json({ error: "Failed to load delivery zones" }, { status: 500 });
  }
}
