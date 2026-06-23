import { afterEach, expect, test } from "bun:test";
import {
  discoverFaviconUrl,
  ensureFeedIcon,
  feedHasIcon,
  siteUrlFromFeed,
} from "./favicon";
import { parseFeed } from "./xml";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function parsed(xml: string) {
  const feed = parseFeed(xml);
  if (!feed) throw new Error("fixture did not parse");
  return feed;
}

test("discovers an icon link and resolves it against the site URL", async () => {
  globalThis.fetch = (async () =>
    new Response('<link rel="icon" href="/favicon.png">', {
      headers: { "content-type": "text/html" },
    })) as typeof fetch;

  await expect(discoverFaviconUrl("https://example.com/blog")).resolves.toBe(
    "https://example.com/favicon.png",
  );
});

test("discovers shortcut and apple touch icons, preferring normal icon links", async () => {
  globalThis.fetch = (async () =>
    new Response(
      '<link rel="apple-touch-icon" href="/apple.png"><link rel="shortcut icon" href="//cdn.example.com/favicon.ico">',
      { headers: { "content-type": "text/html" } },
    )) as typeof fetch;

  await expect(discoverFaviconUrl("https://example.com")).resolves.toBe(
    "https://cdn.example.com/favicon.ico",
  );
});

test("falls back to the origin favicon when no icon link exists", async () => {
  globalThis.fetch = (async () =>
    new Response("<html><title>No icon</title></html>", {
      headers: { "content-type": "text/html" },
    })) as typeof fetch;

  await expect(discoverFaviconUrl("https://example.com/path")).resolves.toBe(
    "https://example.com/favicon.ico",
  );
});

test("fails open when favicon discovery cannot fetch the site", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network");
  }) as typeof fetch;

  await expect(discoverFaviconUrl("https://example.com")).resolves.toBeNull();
});

test("detects existing RSS and Atom feed icons", () => {
  expect(
    feedHasIcon(parsed("<rss><channel><image><url>https://e/icon.png</url></image></channel></rss>")),
  ).toBe(true);
  expect(
    feedHasIcon(parsed('<feed xmlns="http://www.w3.org/2005/Atom"><icon>https://e/icon.png</icon></feed>')),
  ).toBe(true);
  expect(feedHasIcon(parsed("<rss><channel><title>No icon</title></channel></rss>"))).toBe(false);
});

test("derives site URLs from RSS and Atom containers", () => {
  expect(
    siteUrlFromFeed(parsed("<rss><channel><link>https://example.com/site</link></channel></rss>")),
  ).toBe("https://example.com/site");
  expect(
    siteUrlFromFeed(
      parsed(
        '<feed xmlns="http://www.w3.org/2005/Atom"><link rel="self" href="https://example.com/feed.xml"/><link rel="alternate" href="https://example.com/"/></feed>',
      ),
    ),
  ).toBe("https://example.com/");
});

test("injects RSS image and Atom icon/logo only when missing", () => {
  const rss = parsed("<rss><channel><title>T</title><link>https://example.com</link></channel></rss>");
  ensureFeedIcon(rss, "https://example.com/favicon.png");
  expect(rss.container.image).toEqual({
    url: "https://example.com/favicon.png",
    title: "T",
    link: "https://example.com",
  });

  const atom = parsed('<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title></feed>');
  ensureFeedIcon(atom, "https://example.com/favicon.png");
  expect(atom.container.icon).toBe("https://example.com/favicon.png");
  expect(atom.container.logo).toBe("https://example.com/favicon.png");

  const existing = parsed(
    "<rss><channel><image><url>https://old/icon.png</url></image></channel></rss>",
  );
  ensureFeedIcon(existing, "https://example.com/favicon.png");
  expect(existing.container.image.url).toBe("https://old/icon.png");
});
