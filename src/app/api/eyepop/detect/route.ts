import { NextResponse } from "next/server";
import { detect, warmup } from "@/lib/eyepop";
import { decodeImagePayload, ImagePayloadError } from "@/lib/imagePayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ ready: await warmup() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { image?: unknown };
    const bytes = decodeImagePayload(body?.image);
    const started = Date.now();
    const result = await detect(bytes);
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (err) {
    if (err instanceof ImagePayloadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
    }
    console.error("[/api/eyepop/detect] failed:", err);
    return NextResponse.json({ error: "EyePop detect failed" }, { status: 500 });
  }
}
