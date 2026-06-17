/**
 * Minimal OpenAI-compatible chat client. Works with any provider exposing the
 * /chat/completions endpoint (OpenAI, DeepSeek, local servers, ...) via env:
 *   OPENAI_BASE_URL  (default https://api.openai.com/v1)
 *   OPENAI_API_KEY
 *   OPENAI_MODEL     (default gpt-4o-mini)
 *
 * Every public function FAILS OPEN: on any error it returns a result that leaves
 * the feed unchanged, so a transformed feed never breaks because the LLM is down.
 */

const BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const API_KEY = process.env.OPENAI_API_KEY ?? "";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export interface ClassifyItem {
  title: string;
  summary?: string;
}

export interface ClassifyResult {
  /** true = keep the item; false = drop it. */
  keep: boolean;
  /** Short reason the item was dropped, or null when kept. */
  reason: string | null;
}

async function chat(system: string, user: string): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** Pull the first JSON array out of a model response (tolerates code fences/prose). */
function parseJsonArray(text: string | null): unknown[] | null {
  if (!text) return null;
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Decide which items to keep, with a short reason for each dropped item.
 * Returns one result per input item, in order.
 * Fails open: keeps everything (no reason) if the LLM is unavailable or misbehaves.
 */
export async function classifyItems(
  items: ClassifyItem[],
  criteria: string,
): Promise<ClassifyResult[]> {
  const keepAll: ClassifyResult[] = items.map(() => ({
    keep: true,
    reason: null,
  }));
  if (items.length === 0) return keepAll;

  const list = items
    .map(
      (it, i) =>
        `${i}. ${it.title}${it.summary ? `\n   ${it.summary.slice(0, 280)}` : ""}`,
    )
    .join("\n");

  const system =
    "You filter RSS feed items. The user describes what counts as an ad or " +
    "low-value content. Return ONLY a JSON array of objects for the items that " +
    'should be REMOVED, each as {"i": <integer index>, "reason": "<short reason ' +
    'in the feed\'s language>"}. If nothing should be removed, return [].';
  const user = `Removal criteria: ${criteria || "advertisements and low-value content"}\n\nItems:\n${list}`;

  const arr = parseJsonArray(await chat(system, user));
  if (!arr) return keepAll;

  const reasonByIdx = new Map<number, string | null>();
  for (const entry of arr) {
    if (entry == null || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const i = typeof o.i === "number" ? o.i : Number(o.i);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
    const reason = typeof o.reason === "string" && o.reason.trim() ? o.reason.trim() : null;
    reasonByIdx.set(i, reason);
  }

  return items.map((_, i) =>
    reasonByIdx.has(i)
      ? { keep: false, reason: reasonByIdx.get(i) ?? null }
      : { keep: true, reason: null },
  );
}

/**
 * Translate titles into targetLang, preserving order/count.
 * Fails open: returns the original titles if the LLM is unavailable.
 */
export async function translateTitles(
  titles: string[],
  targetLang: string,
): Promise<string[]> {
  if (titles.length === 0) return titles;

  const system =
    `Translate each RSS title into ${targetLang || "the target language"}. ` +
    "Return ONLY a JSON array of strings, same length and order as the input. " +
    "Do not add commentary. Keep proper nouns/code untranslated when natural.";
  const user = JSON.stringify(titles);

  const arr = parseJsonArray(await chat(system, user));
  if (!arr || arr.length !== titles.length) return titles;
  return arr.map((t, i) => (typeof t === "string" && t.trim() ? t : titles[i]));
}
