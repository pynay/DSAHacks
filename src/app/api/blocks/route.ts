import { NextResponse } from "next/server";
import { getBlocksNeed } from "@/lib/blocksNeed";

export const runtime = "nodejs";

// GET /api/blocks — census-block polygons tagged with predicted need, for the
// Response Map's block-level choropleth.
export async function GET() {
  try {
    return NextResponse.json(getBlocksNeed());
  } catch (err) {
    console.error("[/api/blocks] failed:", err);
    return NextResponse.json({ error: "Failed to load blocks" }, { status: 500 });
  }
}
