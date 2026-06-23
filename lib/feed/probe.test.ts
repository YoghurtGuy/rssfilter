import { afterEach, expect, test } from "bun:test";
import { probeFeedUrl } from "./probe";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("reads the original title from an RSS feed", async () => {
  globalThis.fetch = (async () =>
    new Response(
      "<rss><channel><title>Example RSS</title><item><title>A</title></item></channel></rss>",
      { status: 200 },
    )) as typeof fetch;

  await expect(probeFeedUrl("https://example.com/rss.xml")).resolves.toEqual({
    ok: true,
    title: "Example RSS",
  });
});

test("reads the original title from an Atom feed", async () => {
  globalThis.fetch = (async () =>
    new Response(
      '<feed xmlns="http://www.w3.org/2005/Atom"><title>Example Atom</title><entry><title>A</title></entry></feed>',
      { status: 200 },
    )) as typeof fetch;

  await expect(probeFeedUrl("https://example.com/feed.atom")).resolves.toEqual({
    ok: true,
    title: "Example Atom",
  });
});

test("rejects non-http feed URLs before fetching", async () => {
  let fetches = 0;
  globalThis.fetch = (async () => {
    fetches++;
    return new Response("");
  }) as typeof fetch;

  await expect(probeFeedUrl("file:///tmp/feed.xml")).resolves.toEqual({
    ok: false,
    error: "需要有效的 http(s) 源地址",
  });
  expect(fetches).toBe(0);
});

test("reports fetch failures and non-successful responses as unavailable", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network");
  }) as typeof fetch;

  await expect(probeFeedUrl("https://example.com/rss.xml")).resolves.toEqual({
    ok: false,
    error: "无法拉取源",
  });

  globalThis.fetch = (async () =>
    new Response("Not found", { status: 404 })) as typeof fetch;

  await expect(probeFeedUrl("https://example.com/missing.xml")).resolves.toEqual({
    ok: false,
    error: "源返回 404",
  });
});

test("reports non RSS or Atom XML as unavailable", async () => {
  globalThis.fetch = (async () =>
    new Response("<html><title>No feed</title></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })) as typeof fetch;

  await expect(probeFeedUrl("https://example.com/")).resolves.toEqual({
    ok: false,
    error: "无法解析 RSS/Atom 源",
  });
});

test("keeps a feed available when the original title is empty", async () => {
  globalThis.fetch = (async () =>
    new Response("<rss><channel><item><title>A</title></item></channel></rss>", {
      status: 200,
    })) as typeof fetch;

  await expect(probeFeedUrl("https://example.com/rss.xml")).resolves.toEqual({
    ok: true,
    title: "",
  });
});
