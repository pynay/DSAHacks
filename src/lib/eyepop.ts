// Server-only. Runs EyePop.ai's VLM on an image to flag spoiling food, so a
// food bank can catch bad donations at intake. Uses a transient pop with the
// public image-contents VLM ability + an inline prompt (no saved ability
// needed). The worker connection is cached for the process lifetime.
import { EyePop, TransientPopId, PopComponentType } from "@eyepop.ai/eyepop";

const PROMPT =
  "You are a food-bank intake inspector examining a donated food item. " +
  "Reply with exactly one label: 'fresh' if the food looks safe to distribute, " +
  "'spoiled' if there is visible mold, rot, heavy bruising, sliminess, or strong discoloration, " +
  "or 'no food' if the image contains no food. One label only.";

export interface FoodResult {
  label: "fresh" | "spoiled" | "no food" | "unknown";
  rawLabel: string; // exactly what the VLM returned
  category?: string;
  confidence: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let epPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEndpoint(): Promise<any> {
  if (!epPromise) {
    epPromise = (async () => {
      const key = process.env.EYEPOP_SECRET_KEY;
      if (!key) throw new Error("EYEPOP_SECRET_KEY not set");
      const ep = EyePop.workerEndpoint({ auth: { apiKey: key }, popId: TransientPopId.Transient });
      await ep.connect();
      // With a food-freshness VLM ability (create one in the EyePop dashboard and
      // set EYEPOP_FOOD_ABILITY_UUID) this returns fresh/spoiled. Otherwise the
      // public image-contents model identifies the item on the live camera.
      const abilityUuid = process.env.EYEPOP_FOOD_ABILITY_UUID;
      const inference = abilityUuid
        ? { type: PopComponentType.INFERENCE, id: 1, abilityUuid }
        : { type: PopComponentType.INFERENCE, id: 1, ability: "eyepop.image-contents:latest" };
      await ep.changePop({ components: [inference] });
      return ep;
    })().catch((e) => {
      epPromise = null;
      throw e;
    });
  }
  return epPromise;
}

function normalize(label: string): FoodResult["label"] {
  const l = label.toLowerCase();
  if (l.includes("spoil") || l.includes("rot") || l.includes("mold") || l.includes("bad")) return "spoiled";
  if (l.includes("no food") || l.includes("not food") || l.includes("none")) return "no food";
  if (l.includes("fresh") || l.includes("good") || l.includes("safe")) return "fresh";
  return "unknown";
}

// Pre-connect the worker so the first real check isn't slow.
export async function warmup(): Promise<boolean> {
  try {
    await getEndpoint();
    return true;
  } catch {
    return false;
  }
}

export async function checkFood(bytes: Uint8Array): Promise<FoodResult> {
  const run = async () => {
    const ep = await getEndpoint();
    const results = await ep.process({
      source: { stream: bytes, mimeType: "image/jpeg", size: bytes.length },
      componentParams: [{ componentId: 1, values: { prompts: [{ prompt: PROMPT }] } }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const r of results as AsyncIterable<any>) {
      const c = r?.classes?.[0];
      const rawLabel = String(c?.classLabel ?? c?.category ?? "unknown");
      return { label: normalize(rawLabel), rawLabel, category: c?.category, confidence: Number(c?.confidence ?? 0) };
    }
    return { label: "unknown" as const, rawLabel: "no response", confidence: 0 };
  };
  try {
    return await run();
  } catch {
    epPromise = null; // drop a dead connection and retry once
    return await run();
  }
}
