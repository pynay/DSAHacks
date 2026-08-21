import { NextResponse } from "next/server";
import { elevationMeters } from "@/lib/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lng = Number(searchParams.get("lng"));
  const lat = Number(searchParams.get("lat"));
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return NextResponse.json({ error: "lng and lat must be valid coordinates" }, { status: 400 });
  }
  const elevation = await elevationMeters(lng, lat);
  return NextResponse.json({ elevation });
}
