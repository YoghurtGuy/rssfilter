import { redis } from "../kv";
import type { RssSource } from "../types";
import { classifyItems, translateTitles } from "../llm";
import { rewriteImages } from "./images";
import {
  buildFeed,
  contentFields,
  getItems,
  getItemTitle,
  getText,
  itemGuid,
  parseFeed,
  setItems,
  setItemTitle,
  setText,
  type XmlNode,
} from "./xml";

/** Cap LLM work per poll to stay within serverless time/cost limits. */
const MAX_LLM_ITEMS = 60;
/** Cache lifetime for per-item transform decisions (seconds). */
const CACHE_TTL = 60 * 60 * 24 * 7;

interface Decision {
  keep: boolean;
  /** Translated title, or null when translation is disabled. */
  title: string | null;
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function cacheKey(source: RssSource, guid: string): string {
  return `tf:${source.id}:${source.version}:${djb2(guid)}`;
}

/**
 * Transform an upstream feed per the source config. Always returns valid XML:
 * on any parse failure it returns the original feed unchanged (fail open).
 */
export async function transformFeed(
  xml: string,
  source: RssSource,
  baseUrl: string,
): Promise<string> {
  const feed = parseFeed(xml);
  if (!feed) return xml;

  const items = getItems(feed);
  const useLlm = source.filter.enabled || source.translate.enabled;

  const decisions = useLlm
    ? await computeDecisions(items, feed.format, source)
    : items.map<Decision>(() => ({ keep: true, title: null }));

  // 1. filter
  let kept = items;
  if (source.filter.enabled) {
    kept = items.filter((_, i) => decisions[i].keep);
  }

  // 2. translate (titles) — map decisions onto the kept subset
  if (source.translate.enabled) {
    const keptDecisions = items
      .map((it, i) => ({ it, d: decisions[i] }))
      .filter((_, i) => !source.filter.enabled || decisions[i].keep);
    for (const { it, d } of keptDecisions) {
      if (d.title) setItemTitle(it, d.title);
    }
  }

  // 3. branding (channel/feed level)
  if (source.branding.enabled) applyBranding(feed.container, feed.format, source);

  // 4. image proxy
  if (source.imageProxy.enabled) {
    const referer = source.imageProxy.referer;
    const fields = contentFields(feed.format);
    for (const it of kept) {
      for (const field of fields) {
        if (it[field] == null) continue;
        const html = getText(it[field]);
        const rewritten = rewriteImages(html, baseUrl, referer);
        if (rewritten !== html) setText(it, field, rewritten);
      }
    }
  }

  setItems(feed, kept);
  return buildFeed(feed.doc);
}

async function computeDecisions(
  items: XmlNode[],
  format: "rss" | "atom",
  source: RssSource,
): Promise<Decision[]> {
  const guids = items.map((it) => itemGuid(it, format));
  const keys = guids.map((g) => cacheKey(source, g));

  let cached: (Decision | null)[] = items.map(() => null);
  try {
    if (keys.length > 0) {
      cached = (await redis.mget(...keys)) as (Decision | null)[];
    }
  } catch {
    /* cache miss path below */
  }

  // Items that need fresh LLM work (cache miss), capped for cost/time.
  const missIdx = items
    .map((_, i) => i)
    .filter((i) => !cached[i])
    .slice(0, MAX_LLM_ITEMS);

  const keepByIdx = new Map<number, boolean>();
  const titleByIdx = new Map<number, string | null>();

  if (missIdx.length > 0) {
    if (source.filter.enabled) {
      const subset = missIdx.map((i) => ({
        title: getItemTitle(items[i]),
        summary: getText(items[i].description) || getText(items[i].summary),
      }));
      const keep = await classifyItems(subset, source.filter.criteria ?? "");
      missIdx.forEach((i, k) => keepByIdx.set(i, keep[k]));
    }
    if (source.translate.enabled) {
      const titles = missIdx.map((i) => getItemTitle(items[i]));
      const translated = await translateTitles(
        titles,
        source.translate.targetLang ?? "",
      );
      missIdx.forEach((i, k) => titleByIdx.set(i, translated[k]));
    }
  }

  const decisions: Decision[] = items.map((_, i) => {
    if (cached[i]) return cached[i] as Decision;
    return {
      keep: keepByIdx.get(i) ?? true,
      title: titleByIdx.has(i) ? titleByIdx.get(i)! : null,
    };
  });

  // Persist freshly computed decisions.
  await Promise.allSettled(
    missIdx.map((i) => redis.set(keys[i], decisions[i], { ex: CACHE_TTL })),
  );

  return decisions;
}

function applyBranding(
  container: XmlNode,
  format: "rss" | "atom",
  source: RssSource,
): void {
  const { title, siteUrl, iconUrl } = source.branding;

  if (title) setText(container, "title", title);

  if (format === "rss") {
    if (siteUrl) setText(container, "link", siteUrl);
    if (iconUrl) {
      // RSS channel <image><url>..</url><title/><link/></image>
      container.image = {
        url: iconUrl,
        title: title ?? getText(container.title),
        link: siteUrl ?? getText(container.link),
      };
    }
  } else {
    // Atom
    if (siteUrl) container.link = { "@_href": siteUrl };
    if (iconUrl) {
      container.icon = iconUrl;
      container.logo = iconUrl;
    }
  }
}
