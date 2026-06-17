import type { NextRequest } from "next/server";
import { getSource } from "@/lib/store";
import { transformFeed } from "@/lib/feed/pipeline";
import { getBaseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) return new Response("Feed not found", { status: 404 });

  let upstream: string;
  try {
    const res = await fetch(source.feedUrl, {
      headers: { "user-agent": "rssfilter/1.0 (+https://github.com)" },
      // Let upstream caches help; the route itself is force-dynamic.
      cache: "no-store",
    });
    if (!res.ok) return new Response("Upstream feed error", { status: 502 });
    upstream = await res.text();
  } catch {
    return new Response("Upstream feed fetch failed", { status: 502 });
  }

  let body = upstream;
  try {
    body = await transformFeed(upstream, source, getBaseUrl(req));
  } catch {
    body = upstream; // fail open: never break a subscriber's reader
  }

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
