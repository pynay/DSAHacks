import { NextResponse } from "next/server";
import { getCommonsStats } from "@/lib/commonsStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCommonsStats());
  } catch (err) {
    console.error("[/api/commons] failed:", err);
    return NextResponse.json({ error: "Failed to load commons stats" }, { status: 500 });
  }
}
