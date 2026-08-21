import { NextResponse } from "next/server";
import { checkFood, warmup } from "@/lib/eyepop";
import { decodeImagePayload, ImagePayloadError } from "@/lib/imagePayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Warm-up: the client calls this when the camera starts so the EyePop worker
// is connected before the first check.
export async function GET() {
  const ready = await warmup();
  return NextResponse.json({ ready });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { image?: unknown };
    const bytes = decodeImagePayload(body?.image);
    const started = Date.now();
    const result = await checkFood(bytes);
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (err) {
    if (err instanceof ImagePayloadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
    }
    console.error("[/api/eyepop/food] failed:", err);
    return NextResponse.json({ error: "EyePop check failed" }, { status: 500 });
  }
}
