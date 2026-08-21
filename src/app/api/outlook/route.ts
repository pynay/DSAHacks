import { NextResponse } from "next/server";
import { getOutlook } from "@/lib/outlookServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getOutlook());
  } catch (err) {
    console.error("[/api/outlook] failed:", err);
    return NextResponse.json({ error: "Failed to load outlook" }, { status: 500 });
  }
}
