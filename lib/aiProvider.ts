import "server-only";

export type AiMessage = { role: "system" | "user"; content: string | { type: string; text?: string; image_url?: { url: string } }[] };

export function aiConfiguration(purpose: "text" | "receipt" = "text") {
  const provider = process.env.IRIXS_AI_PROVIDER || "groq";
  const key = process.env.IRIXS_AI_API_KEY || (provider === "groq" ? process.env.GROQ_API_KEY : undefined);
  const base = provider === "groq" ? "https://api.groq.com/openai/v1" : process.env.IRIXS_AI_BASE_URL?.replace(/\/$/, "");
  const model = (purpose === "receipt" ? process.env.IRIXS_RECEIPT_AI_MODEL : undefined) || process.env.IRIXS_AI_MODEL || (provider === "groq" ? "qwen/qwen3.8-27b" : "");
  const enabled = provider !== "disabled" && !(purpose === "receipt" && process.env.IRIXS_RECEIPT_AI_ENABLED === "false");
  return { provider, key, base, model, configured: enabled && Boolean(key && base && model), label: provider === "groq" ? "Groq · demoprovider" : provider === "disabled" ? "Uitgeschakeld" : "Eigen AI-provider" };
}

// De rest van de applicatie werkt met JSON en metadata, zonder provider-specifieke code.
// Een nieuwe leverancier kan hier achter hetzelfde contract worden aangesloten.
export async function completeJson(messages: AiMessage[], options: { purpose?: "text" | "receipt"; tokens?: number; temperature?: number } = {}) {
  const config = aiConfiguration(options.purpose);
  if (!config.configured) throw new Error("AI is niet geconfigureerd.");
  const url = new URL(`${config.base}/chat/completions`);
  if (url.protocol !== "https:") throw new Error("De AI-provider moet HTTPS gebruiken.");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout(25_000), body: JSON.stringify({ model: config.model, messages, response_format: { type: "json_object" }, temperature: options.temperature ?? 0.1, max_completion_tokens: options.tokens ?? 3500 }) });
  if (!response.ok) throw new Error(`De AI-provider gaf status ${response.status}. Controleer provider, model en configuratie.`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("De AI-provider gaf geen JSON-resultaat terug.");
  return JSON.parse(content) as unknown;
}
