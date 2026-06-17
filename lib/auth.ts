/**
 * Single-user auth: a password (APP_PASSWORD) exchanged for an HMAC-signed
 * cookie. Uses Web Crypto so the same code runs in Edge middleware and Node
 * route handlers. Set APP_SECRET to a random string; it falls back to the
 * password if unset.
 */

export const COOKIE_NAME = "rssf_auth";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const PAYLOAD = "authenticated";

function secret(): string {
  return process.env.APP_SECRET || process.env.APP_PASSWORD || "";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return toHex(sig);
}

export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  // Length-independent compare is overkill here, but cheap and correct.
  if (!expected || password.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function makeToken(): Promise<string> {
  return `v1.${await hmac(PAYLOAD, secret())}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token || !token.startsWith("v1.") || !secret()) return false;
  const expected = await makeToken();
  return token === expected;
}
