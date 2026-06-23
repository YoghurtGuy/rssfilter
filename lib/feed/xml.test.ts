import { expect, test } from "bun:test";
import { buildFeed, parseFeed } from "./xml";

test("buildFeed preserves RSS attribute values that look boolean", () => {
  const parsed = parseFeed(
    '<rss><channel><item><title>A</title><guid isPermaLink="true">https://example.com/a</guid></item></channel></rss>',
  );

  if (!parsed) throw new Error("fixture did not parse");

  const out = buildFeed(parsed.doc);

  expect(out).toContain('isPermaLink="true"');
  expect(out).not.toContain("<guid isPermaLink>");
});
