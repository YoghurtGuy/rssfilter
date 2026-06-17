import type { NextRequest } from "next/server";

/**
 * Absolute origin for building proxy URLs that RSS readers fetch from their own
 * context. Prefers APP_BASE_URL, else the forwarded host/proto, else req origin.
 */
export function getBaseUrl(req: NextRequest): string {
  const fromEnv = process.env.APP_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  return req.nextUrl.origin;
}
