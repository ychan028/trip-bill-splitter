// Optional receipt parsing with Claude, called straight from the browser with a
// key each person pastes into the app. The key is kept in this device's
// localStorage only: never in the repo, never synced to Firebase.

const KEY = "anthropicApiKey";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string) {
  if (key) localStorage.setItem(KEY, key.trim());
  else localStorage.removeItem(KEY);
}

export interface ClaudeReceipt {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  total: number | null;
  category: string | null;
  items: { name: string; amount: number }[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "date", "currency", "total", "category", "items"],
  properties: {
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    currency: { type: ["string", "null"], description: "ISO 4217 code, e.g. EUR" },
    total: { type: ["number", "null"], description: "Final amount paid, including tax, excluding tip unless the tip was added to the bill" },
    category: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount"],
        properties: { name: { type: "string" }, amount: { type: "number" } },
      },
    },
  },
};

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function parseReceiptWithClaude(
  image: Blob,
  opts: { categories: string[]; country?: string },
): Promise<ClaudeReceipt> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key set");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 });

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await toBase64(image) } },
          {
            type: "text",
            text:
              `Extract this receipt. Use null for anything you can't read. ` +
              `Pick category from: ${opts.categories.join(", ")}. ` +
              `Infer currency from symbols, language and address if no code is printed.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The receipt couldn't be processed");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Empty response");
  return JSON.parse(text.text) as ClaudeReceipt;
}

export function describeClaudeError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  if (status === 401) return "API key was rejected. Check it in Trip → Receipt scanning.";
  if (status === 429) return "Rate limited by the API; try again in a minute.";
  if (status && status >= 500) return "The API is having trouble right now.";
  return (e as Error)?.message ?? String(e);
}
