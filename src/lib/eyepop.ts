// Server-only EyePop.ai vision for the live drone camera feed.
//   - detect():  fast object detection (~1s) on a single JPEG frame.
//   - warmup():  pre-connect the detection endpoint so the first frame is fast.
// Worker endpoints are cached per ability for the process lifetime.
import { EyePop, TransientPopId, PopComponentType } from "@eyepop.ai/eyepop";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Inference = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const endpoints = new Map<string, Promise<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEndpoint(inference: Inference): Promise<any> {
  const key = JSON.stringify(inference);
  let p = endpoints.get(key);
  if (!p) {
    p = (async () => {
      const configuredKey = process.env.EYEPOP_SECRET_KEY ?? process.env.EYEPOP_API_KEY;
      if (!configuredKey) throw new Error("EYEPOP_SECRET_KEY or EYEPOP_API_KEY not set");
      // EyePop's issued prefix is lowercase. Normalize the common copy/paste
      // variant without ever rewriting or exposing the configured secret.
      const apiKey = configuredKey.startsWith('Eyp_') ? `eyp_${configuredKey.slice(4)}` : configuredKey;
      const ep = EyePop.workerEndpoint({ auth: { apiKey }, popId: TransientPopId.Transient });
      await ep.connect();
      await ep.changePop({ components: [{ type: PopComponentType.INFERENCE, id: 1, ...inference }] });
      return ep;
    })().catch((e) => {
      endpoints.delete(key);
      throw e;
    });
    endpoints.set(key, p);
  }
  return p;
}

async function runOnce(inference: Inference, bytes: Uint8Array): Promise<Inference | null> {
  const attempt = async () => {
    const ep = await getEndpoint(inference);
    const results = await ep.process({
      source: { stream: bytes, mimeType: "image/jpeg", size: bytes.length },
    });
    for await (const r of results as AsyncIterable<Inference>) return r;
    return null;
  };
  try {
    return await attempt();
  } catch {
    endpoints.delete(JSON.stringify(inference)); // drop a dead connection, retry once
    return await attempt();
  }
}

export interface DetectedObject {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DetectResult {
  objects: DetectedObject[];
  sourceWidth: number;
  sourceHeight: number;
}

const DETECT_ABILITY = { ability: "eyepop.common-objects:latest" };

export async function warmup(): Promise<boolean> {
  try {
    await getEndpoint(DETECT_ABILITY);
    return true;
  } catch (error) {
    console.warn('[eyepop] warmup failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function detect(bytes: Uint8Array): Promise<DetectResult> {
  const r = await runOnce(DETECT_ABILITY, bytes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objs: any[] = r?.objects ?? [];
  return {
    objects: objs.map((o) => ({
      label: String(o.classLabel ?? "object"),
      confidence: Number(o.confidence ?? 0),
      x: Number(o.x ?? 0),
      y: Number(o.y ?? 0),
      width: Number(o.width ?? 0),
      height: Number(o.height ?? 0),
    })),
    sourceWidth: Number(r?.source_width ?? 0),
    sourceHeight: Number(r?.source_height ?? 0),
  };
}
