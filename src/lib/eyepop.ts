// Server-only EyePop.ai vision for food intake.
//   - detect():   fast object detection (~1s) for the live camera feed.
//   - checkFood(): VLM fresh/spoiled verdict (~10-15s), on demand. Uses a
//     food-freshness ability if EYEPOP_FOOD_ABILITY_UUID is set, else the
//     public image-contents model (which identifies the item).
// Worker endpoints are cached per ability for the process lifetime.
import { EyePop, TransientPopId, PopComponentType } from "@eyepop.ai/eyepop";

const FRESH_PROMPT =
  "You are a food-bank intake inspector examining a donated food item. " +
  "Reply with exactly one label: 'fresh', 'spoiled', or 'no food'. " +
  "Choose 'spoiled' if there is visible mold, rot, heavy bruising, sliminess, or strong discoloration.";

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
      const apiKey = process.env.EYEPOP_SECRET_KEY;
      if (!apiKey) throw new Error("EYEPOP_SECRET_KEY not set");
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runOnce(inference: Inference, bytes: Uint8Array, componentParams?: any): Promise<Inference | null> {
  const attempt = async () => {
    const ep = await getEndpoint(inference);
    const results = await ep.process({
      source: { stream: bytes, mimeType: "image/jpeg", size: bytes.length },
      ...(componentParams ? { componentParams } : {}),
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
  } catch {
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

export interface FoodResult {
  label: "fresh" | "spoiled" | "no food" | "unknown";
  rawLabel: string;
  category?: string;
  confidence: number;
}

function normalize(label: string): FoodResult["label"] {
  const l = label.toLowerCase();
  if (l.includes("spoil") || l.includes("rot") || l.includes("mold") || l.includes("bad")) return "spoiled";
  if (l.includes("no food") || l.includes("not food") || l.includes("none")) return "no food";
  if (l.includes("fresh") || l.includes("good") || l.includes("safe")) return "fresh";
  return "unknown";
}

export async function checkFood(bytes: Uint8Array): Promise<FoodResult> {
  const abilityUuid = process.env.EYEPOP_FOOD_ABILITY_UUID;
  const inference: Inference = abilityUuid ? { abilityUuid } : { ability: "eyepop.image-contents:latest" };
  const params = [{ componentId: 1, values: { prompts: [{ prompt: FRESH_PROMPT }] } }];
  const r = await runOnce(inference, bytes, params);
  const c = r?.classes?.[0];
  const rawLabel = String(c?.classLabel ?? c?.category ?? "unknown");
  return { label: normalize(rawLabel), rawLabel, category: c?.category, confidence: Number(c?.confidence ?? 0) };
}
