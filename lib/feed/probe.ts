import { getText, parseFeed } from "./xml";

export type FeedProbeResult =
  | { ok: true; title: string }
  | { ok: false; error: string };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function probeFeedUrl(feedUrl: string): Promise<FeedProbeResult> {
  const url = feedUrl.trim();
  if (!isHttpUrl(url)) {
    return { ok: false, error: "需要有效的 http(s) 源地址" };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
  } catch {
    return { ok: false, error: "无法拉取源" };
  }

  if (!res.ok) {
    return { ok: false, error: `源返回 ${res.status}` };
  }

  const xml = await res.text();
  const feed = parseFeed(xml);
  if (!feed) {
    return { ok: false, error: "无法解析 RSS/Atom 源" };
  }

  return { ok: true, title: getText(feed.container.title).trim() };
}
