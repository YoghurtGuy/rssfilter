import { redis } from "../kv";
import { appendLogs } from "../store";
import type { FeedLogEntry, LlmLogDetail, RssSource } from "../types";
import { classifyItems, translateTitles } from "../llm";
import { rewriteImagesWithCount } from "./images";
import { discoverFaviconUrl, ensureFeedIcon, feedHasIcon, siteUrlFromFeed } from "./favicon";
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
  /** Short reason the item was dropped by the filter, or null. */
  reason: string | null;
  filterLlm: LlmLogDetail;
  translateLlm: LlmLogDetail;
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function cacheKey(source: RssSource, guid: string): string {
  return `tf:${source.id}:${source.version}:${djb2(guid)}`;
}

function disabledLlmDetail(kind: "filter" | "translate"): LlmLogDetail {
  return {
    model: "",
    called: false,
    cacheHit: false,
    parsed: false,
    status: "disabled",
    raw: null,
    structured:
      kind === "filter"
        ? { keep: true, reason: null }
        : { translatedTitle: null },
  };
}

function cacheHit(detail: LlmLogDetail): LlmLogDetail {
  return { ...detail, cacheHit: true, status: "cache-hit" };
}

function cachedFallback(kind: "filter" | "translate", d: Decision): LlmLogDetail {
  return {
    ...disabledLlmDetail(kind),
    cacheHit: true,
    status: "cache-hit",
    structured:
      kind === "filter"
        ? { keep: d.keep, reason: d.reason }
        : { translatedTitle: d.title },
  };
}

function normalizeCachedDecision(d: Decision): Decision {
  return {
    keep: d.keep,
    title: d.title ?? null,
    reason: d.reason ?? null,
    filterLlm: d.filterLlm ? cacheHit(d.filterLlm) : cachedFallback("filter", d),
    translateLlm: d.translateLlm
      ? cacheHit(d.translateLlm)
      : cachedFallback("translate", d),
  };
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
  // Original (pre-translation) titles, captured before any mutation.
  const originalTitles = items.map((it) => getItemTitle(it));
  // Per-item count of proxied images, keyed by item node.
  const imgCount = new Map<XmlNode, number>();

  // Always compute decisions: this populates the per-item cache that doubles as
  // the "first seen at this version" signal driving logging, even when neither
  // filter nor translate is enabled (then no LLM call is made).
  const { decisions, freshIdx } = await computeDecisions(
    items,
    feed.format,
    source,
  );

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

  // 3. favicon discovery (channel/feed level)
  if (!source.branding.iconUrl && !feedHasIcon(feed)) {
    const siteUrl = siteUrlFromFeed(feed);
    if (siteUrl) {
      const iconUrl = await discoverFaviconUrl(siteUrl);
      if (iconUrl) ensureFeedIcon(feed, iconUrl);
    }
  }

  // 4. branding (channel/feed level)
  if (source.branding.enabled) applyBranding(feed.container, feed.format, source);

  // 5. image proxy
  if (source.imageProxy.enabled) {
    const referer = source.imageProxy.referer;
    const fields = contentFields(feed.format);
    for (const it of kept) {
      for (const field of fields) {
        if (it[field] == null) continue;
        const html = getText(it[field]);
        const { html: rewritten, count } = rewriteImagesWithCount(
          html,
          baseUrl,
          referer,
        );
        if (count > 0) {
          setText(it, field, rewritten);
          imgCount.set(it, (imgCount.get(it) ?? 0) + count);
        }
      }
    }
  }

  // Record one log entry per freshly-processed item. Fail open: never let a
  // logging error affect the returned feed.
  if (freshIdx.length > 0) {
    const entries: FeedLogEntry[] = freshIdx.map((i) => {
      const it = items[i];
      const kept_ = !source.filter.enabled || decisions[i].keep;
      return {
        ts: Date.now(),
        guid: itemGuid(it, feed.format),
        title: originalTitles[i],
        link: getText(it.link?.["@_href"] ?? it.link),
        kept: kept_,
        filtered: source.filter.enabled && !decisions[i].keep,
        reason: decisions[i].reason,
        translatedTitle:
          kept_ && source.translate.enabled ? decisions[i].title : null,
        imagesProxied: imgCount.get(it) ?? 0,
        version: source.version,
        llm: {
          filter: decisions[i].filterLlm,
          translate: decisions[i].translateLlm,
        },
      };
    });
    try {
      await appendLogs(source.id, entries);
    } catch {
      /* logging is best-effort */
    }
  }

  setItems(feed, kept);
  return buildFeed(feed.doc);
}

async function computeDecisions(
  items: XmlNode[],
  format: "rss" | "atom",
  source: RssSource,
): Promise<{ decisions: Decision[]; freshIdx: number[] }> {
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

  // Items seen for the first time at this version (cache miss), capped for cost/time.
  // This set also drives logging: each item is logged once per config version.
  const missIdx = items
    .map((_, i) => i)
    .filter((i) => !cached[i])
    .slice(0, MAX_LLM_ITEMS);

  const keepByIdx = new Map<number, boolean>();
  const reasonByIdx = new Map<number, string | null>();
  const titleByIdx = new Map<number, string | null>();
  const filterLlmByIdx = new Map<number, LlmLogDetail>();
  const translateLlmByIdx = new Map<number, LlmLogDetail>();

  if (missIdx.length > 0) {
    if (source.filter.enabled) {
      const subset = missIdx.map((i) => ({
        title: getItemTitle(items[i]),
        summary: getText(items[i].description) || getText(items[i].summary),
      }));
      const response = await classifyItems(subset, source.filter.criteria ?? "");
      missIdx.forEach((i, k) => {
        const result = response.results[k];
        keepByIdx.set(i, result.keep);
        reasonByIdx.set(i, result.reason);
        filterLlmByIdx.set(i, {
          model: response.model,
          called: response.called,
          cacheHit: false,
          parsed: response.parsed,
          status: response.status,
          raw: response.raw,
          error: response.error,
          structured: { keep: result.keep, reason: result.reason },
        });
      });
    }
    if (source.translate.enabled) {
      const titles = missIdx.map((i) => getItemTitle(items[i]));
      const response = await translateTitles(
        titles,
        source.translate.targetLang ?? "",
      );
      missIdx.forEach((i, k) => {
        const translatedTitle = response.results[k];
        titleByIdx.set(i, translatedTitle);
        translateLlmByIdx.set(i, {
          model: response.model,
          called: response.called,
          cacheHit: false,
          parsed: response.parsed,
          status: response.status,
          raw: response.raw,
          error: response.error,
          structured: {
            originalTitle: titles[k],
            translatedTitle,
          },
        });
      });
    }
  }

  const decisions: Decision[] = items.map((_, i) => {
    if (cached[i]) return normalizeCachedDecision(cached[i] as Decision);
    return {
      keep: keepByIdx.get(i) ?? true,
      title: titleByIdx.has(i) ? titleByIdx.get(i)! : null,
      reason: reasonByIdx.get(i) ?? null,
      filterLlm: source.filter.enabled
        ? (filterLlmByIdx.get(i) ?? disabledLlmDetail("filter"))
        : disabledLlmDetail("filter"),
      translateLlm: source.translate.enabled
        ? (translateLlmByIdx.get(i) ?? disabledLlmDetail("translate"))
        : disabledLlmDetail("translate"),
    };
  });

  // Persist freshly computed decisions.
  await Promise.allSettled(
    missIdx.map((i) => redis.set(keys[i], decisions[i], { ex: CACHE_TTL })),
  );

  return { decisions, freshIdx: missIdx };
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
