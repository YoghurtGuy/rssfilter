import { parse } from "node-html-parser";
import { getText, type ParsedFeed, type XmlNode } from "./xml";

const FETCH_TIMEOUT_MS = 5000;
const ICON_REL_RE = /(?:^|\s)(?:shortcut\s+icon|icon|apple-touch-icon|apple-touch-icon-precomposed)(?:\s|$)/i;
const PRIMARY_ICON_REL_RE = /(?:^|\s)(?:shortcut\s+icon|icon)(?:\s|$)/i;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function safeUrl(value: string, base?: string): string | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function asNodeArray(v: unknown): XmlNode[] {
  if (v == null) return [];
  return Array.isArray(v) ? (v as XmlNode[]) : [v as XmlNode];
}

export function feedHasIcon(feed: ParsedFeed): boolean {
  if (feed.format === "rss") {
    return Boolean(getText(feed.container.image?.url));
  }
  return Boolean(getText(feed.container.icon) || getText(feed.container.logo));
}

export function siteUrlFromFeed(feed: ParsedFeed): string | null {
  if (feed.format === "rss") {
    const link = getText(feed.container.link);
    return link && isHttpUrl(link) ? link : null;
  }

  for (const link of asNodeArray(feed.container.link)) {
    const href = typeof link === "object" ? link?.["@_href"] : "";
    const rel = typeof link === "object" ? String(link?.["@_rel"] ?? "") : "";
    if (typeof href === "string" && href && (!rel || rel === "alternate")) {
      const url = safeUrl(href);
      if (url) return url;
    }
  }
  return null;
}

function iconHrefFromHtml(html: string, siteUrl: string): string | null {
  const root = parse(html);
  let fallback: string | null = null;
  for (const link of root.querySelectorAll("link")) {
    const rel = link.getAttribute("rel") ?? "";
    if (!ICON_REL_RE.test(rel)) continue;

    const href = link.getAttribute("href")?.trim();
    if (!href) continue;

    const resolved = safeUrl(href, siteUrl);
    if (!resolved) continue;

    if (PRIMARY_ICON_REL_RE.test(rel)) return resolved;
    fallback ??= resolved;
  }
  return fallback;
}

export async function discoverFaviconUrl(siteUrl: string): Promise<string | null> {
  const normalized = safeUrl(siteUrl);
  if (!normalized) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(normalized, {
      headers: {
        "user-agent": "Mozilla/5.0 (rssfilter favicon discovery)",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const html = await res.text();
    return iconHrefFromHtml(html, normalized) ?? new URL("/favicon.ico", normalized).toString();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function ensureFeedIcon(feed: ParsedFeed, iconUrl: string): void {
  if (!iconUrl || feedHasIcon(feed)) return;

  if (feed.format === "rss") {
    feed.container.image = {
      url: iconUrl,
      title: getText(feed.container.title),
      link: getText(feed.container.link),
    };
  } else {
    feed.container.icon = iconUrl;
    feed.container.logo = iconUrl;
  }
}
