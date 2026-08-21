import { NextResponse } from "next/server";
import { getForecast } from "@/lib/forecastServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getForecast());
  } catch (err) {
    console.error("[/api/forecast] failed:", err);
    return NextResponse.json({ error: "Failed to load forecast" }, { status: 500 });
  }
}
