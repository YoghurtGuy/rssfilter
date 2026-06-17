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

import type { LlmLogError, LlmLogStatus } from "./types";

const BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const API_KEY = process.env.OPENAI_API_KEY ?? "";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_RAW_CHARS = 4000;

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

export interface LlmCallInfo {
  model: string;
  called: boolean;
  parsed: boolean;
  status: LlmLogStatus;
  raw: string | null;
  error?: LlmLogError | null;
}

export interface ClassifyResponse extends LlmCallInfo {
  results: ClassifyResult[];
}

export interface TranslateResponse extends LlmCallInfo {
  results: string[];
}

function truncateRaw(raw: string | null): string | null {
  if (!raw || raw.length <= MAX_RAW_CHARS) return raw;
  return `${raw.slice(0, MAX_RAW_CHARS)}\n…[truncated]`;
}

async function chat(system: string, user: string): Promise<LlmCallInfo> {
  if (!API_KEY) {
    return {
      model: MODEL,
      called: false,
      parsed: false,
      status: "fail-open",
      raw: null,
      error: { message: "OPENAI_API_KEY is not configured" },
    };
  }

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
    if (!res.ok) {
      const body = truncateRaw(await res.text().catch(() => null));
      return {
        model: MODEL,
        called: true,
        parsed: false,
        status: "request-error",
        raw: null,
        error: {
          message: `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`,
          httpStatus: res.status,
          responseStatusText: res.statusText,
          responseBody: body,
        },
      };
    }
    const data = await res.json();
    return {
      model: MODEL,
      called: true,
      parsed: false,
      status: "success",
      raw: truncateRaw(data?.choices?.[0]?.message?.content ?? null),
    };
  } catch (err) {
    return {
      model: MODEL,
      called: true,
      parsed: false,
      status: "request-error",
      raw: null,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
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
): Promise<ClassifyResponse> {
  const keepAll: ClassifyResult[] = items.map(() => ({
    keep: true,
    reason: null,
  }));
  if (items.length === 0) {
    return {
      results: keepAll,
      model: MODEL,
      called: false,
      parsed: true,
      status: "success",
      raw: null,
    };
  }

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

  const info = await chat(system, user);
  const arr = parseJsonArray(info.raw);
  if (!arr) {
    return {
      ...info,
      results: keepAll,
      parsed: false,
      status: info.status === "success" ? "parse-error" : info.status,
    };
  }

  const reasonByIdx = new Map<number, string | null>();
  for (const entry of arr) {
    if (entry == null || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const i = typeof o.i === "number" ? o.i : Number(o.i);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
    const reason =
      typeof o.reason === "string" && o.reason.trim()
        ? o.reason.trim()
        : null;
    reasonByIdx.set(i, reason);
  }

  return {
    ...info,
    results: items.map((_, i) =>
      reasonByIdx.has(i)
        ? { keep: false, reason: reasonByIdx.get(i) ?? null }
        : { keep: true, reason: null },
    ),
    parsed: true,
    status: "success",
  };
}

/**
 * Translate titles into targetLang, preserving order/count.
 * Fails open: returns the original titles if the LLM is unavailable.
 */
export async function translateTitles(
  titles: string[],
  targetLang: string,
): Promise<TranslateResponse> {
  if (titles.length === 0) {
    return {
      results: titles,
      model: MODEL,
      called: false,
      parsed: true,
      status: "success",
      raw: null,
    };
  }

  const system =
    `Translate each RSS title into ${targetLang || "the target language"}. ` +
    "Return ONLY a JSON array of strings, same length and order as the input. " +
    "Do not add commentary. Keep proper nouns/code untranslated when natural.";
  const user = JSON.stringify(titles);

  const info = await chat(system, user);
  const arr = parseJsonArray(info.raw);
  if (!arr || arr.length !== titles.length) {
    return {
      ...info,
      results: titles,
      parsed: false,
      status: info.status === "success" ? "parse-error" : info.status,
    };
  }

  return {
    ...info,
    results: arr.map((t, i) =>
      typeof t === "string" && t.trim() ? t : titles[i],
    ),
    parsed: true,
    status: "success",
  };
}
