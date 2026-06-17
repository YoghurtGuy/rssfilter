import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Reject private / loopback / link-local hosts to limit SSRF. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  return (
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  const policy = req.nextUrl.searchParams.get("r"); // "origin" or absent (= empty)

  if (!u || !/^https?:\/\//i.test(u)) {
    return new Response("Bad image url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return new Response("Forbidden host", { status: 403 });
  }

  const headers: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (rssfilter image proxy)",
    accept: "image/*,*/*;q=0.8",
  };
  // policy "empty" => send no Referer at all; "origin" => the image's own origin.
  if (policy === "origin") headers["referer"] = `${target.protocol}//${target.host}/`;

  let res: Response;
  try {
    res = await fetch(target.toString(), { headers, cache: "no-store" });
  } catch {
    return new Response("Image fetch failed", { status: 502 });
  }
  if (!res.ok || !res.body) {
    return new Response("Upstream image error", { status: 502 });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return new Response("Not an image", { status: 415 });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
