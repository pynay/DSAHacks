import { NextResponse } from "next/server";
import { detect, warmup } from "@/lib/eyepop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ ready: await warmup() });
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
    const result = await detect(bytes);
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (err) {
    console.error("[/api/eyepop/detect] failed:", err);
    return NextResponse.json({ error: "EyePop detect failed" }, { status: 500 });
  }
}
