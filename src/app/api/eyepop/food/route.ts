import { NextResponse } from "next/server";
import { checkFood, warmup } from "@/lib/eyepop";

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
    const { image } = await req.json();
    if (typeof image !== "string") {
      return NextResponse.json({ error: "image (base64 data URL) required" }, { status: 400 });
    }
    const b64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
    const bytes = new Uint8Array(Buffer.from(b64, "base64"));
    const started = Date.now();
    const result = await checkFood(bytes);
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (err) {
    console.error("[/api/eyepop/food] failed:", err);
    return NextResponse.json({ error: "EyePop check failed" }, { status: 500 });
  }
}
