import { afterEach, expect, mock, test } from "bun:test";

mock.module("../kv", () => ({
  redis: {
    mget: async () => [],
    set: async () => null,
  },
}));
mock.module("../store", () => ({
  appendLogs: async () => null,
}));

const { transformFeed } = await import("./pipeline");

const originalFetch = globalThis.fetch;
const baseSource = {
  id: "src",
  name: "Source",
  feedUrl: "https://feed.example/rss.xml",
  filter: { enabled: false, criteria: "" },
  translate: { enabled: false, targetLang: "" },
  branding: { enabled: false, title: "", siteUrl: "", iconUrl: "" },
  imageProxy: { enabled: false, referer: "" },
  version: 1,
  createdAt: 0,
  updatedAt: 0,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("transformFeed injects a discovered RSS favicon when the feed has no image", async () => {
  let fetches = 0;
  globalThis.fetch = (async () => {
    fetches++;
    return new Response('<link rel="icon" href="/favicon.png">');
  }) as typeof fetch;

  const out = await transformFeed(
    "<rss><channel><title>T</title><link>https://example.com</link><item><title>A</title></item></channel></rss>",
    baseSource,
    "https://rssfilter.example",
  );

  expect(fetches).toBe(1);
  expect(out).toContain("<image><url>https://example.com/favicon.png</url>");
});

test("transformFeed injects discovered Atom icon and logo", async () => {
  globalThis.fetch = (async () =>
    new Response('<link rel="icon" href="https://cdn.example.com/icon.ico">')) as typeof fetch;

  const out = await transformFeed(
    '<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title><link rel="alternate" href="https://example.com/"/><entry><title>A</title></entry></feed>',
    baseSource,
    "https://rssfilter.example",
  );

  expect(out).toContain("<icon>https://cdn.example.com/icon.ico</icon>");
  expect(out).toContain("<logo>https://cdn.example.com/icon.ico</logo>");
});

test("transformFeed does not discover when the feed already has an RSS image", async () => {
  globalThis.fetch = (async () => {
    throw new Error("should not fetch");
  }) as typeof fetch;

  const out = await transformFeed(
    "<rss><channel><title>T</title><link>https://example.com</link><image><url>https://old/icon.png</url></image><item><title>A</title></item></channel></rss>",
    baseSource,
    "https://rssfilter.example",
  );

  expect(out).toContain("<url>https://old/icon.png</url>");
});

test("transformFeed keeps manual branding icon as highest priority", async () => {
  globalThis.fetch = (async () => {
    throw new Error("should not fetch");
  }) as typeof fetch;

  const out = await transformFeed(
    "<rss><channel><title>T</title><link>https://example.com</link><item><title>A</title></item></channel></rss>",
    {
      ...baseSource,
      branding: {
        enabled: true,
        title: "Manual",
        siteUrl: "https://manual.example",
        iconUrl: "https://manual.example/icon.png",
      },
    },
    "https://rssfilter.example",
  );

  expect(out).toContain("<url>https://manual.example/icon.png</url>");
  expect(out).not.toContain("https://example.com/favicon.ico");
});
