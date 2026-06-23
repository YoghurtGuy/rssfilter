import { XMLParser, XMLBuilder } from "fast-xml-parser";

/**
 * Object-mode parse/build for RSS 2.0 and Atom. Object mode (not preserveOrder)
 * keeps mutation simple; element order within a channel/item is not significant
 * to feed readers. Unknown channel/item fields are preserved on round-trip.
 */

const XML_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  // Keep these as arrays even when there is a single one, so mutation is uniform.
  isArray: (name: string) => name === "item" || name === "entry",
} as const;

const parser = new XMLParser(XML_OPTS);
const builder = new XMLBuilder({
  ...XML_OPTS,
  format: false,
  suppressEmptyNode: false,
  suppressBooleanAttributes: false,
});

export type FeedFormat = "rss" | "atom";
// A loose object tree from fast-xml-parser.
export type XmlNode = Record<string, any>;

export interface ParsedFeed {
  doc: XmlNode;
  format: FeedFormat;
  /** rss: channel object; atom: feed object. Branding + items live here. */
  container: XmlNode;
}

export function parseFeed(xml: string): ParsedFeed | null {
  let doc: XmlNode;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  if (doc?.rss?.channel) {
    return { doc, format: "rss", container: doc.rss.channel };
  }
  if (doc?.feed) {
    return { doc, format: "atom", container: doc.feed };
  }
  return null;
}

export function buildFeed(doc: XmlNode): string {
  return builder.build(doc);
}

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Read text from a node that may be a string, number, or { "#text" | "#cdata" }. */
export function getText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    const o = node as XmlNode;
    if ("#cdata" in o) return String(o["#cdata"]);
    if ("#text" in o) return String(o["#text"]);
  }
  return "";
}

/** Write text into parent[field], preserving an existing CDATA/attribute wrapper. */
export function setText(parent: XmlNode, field: string, value: string): void {
  const cur = parent[field];
  if (cur && typeof cur === "object" && !Array.isArray(cur)) {
    if ("#cdata" in cur) cur["#cdata"] = value;
    else cur["#text"] = value;
  } else {
    parent[field] = value;
  }
}

export function getItems(feed: ParsedFeed): XmlNode[] {
  return feed.format === "rss"
    ? asArray<XmlNode>(feed.container.item)
    : asArray<XmlNode>(feed.container.entry);
}

export function setItems(feed: ParsedFeed, items: XmlNode[]): void {
  if (feed.format === "rss") feed.container.item = items;
  else feed.container.entry = items;
}

export function getItemTitle(item: XmlNode): string {
  return getText(item.title);
}

export function setItemTitle(item: XmlNode, value: string): void {
  if (item.title == null) item.title = value;
  else setText(item, "title", value);
}

/** A stable identity for caching transform decisions across polls. */
export function itemGuid(item: XmlNode, format: FeedFormat): string {
  if (format === "rss") {
    return getText(item.guid) || getText(item.link) || getText(item.title);
  }
  return getText(item.id) || getText(item.title);
}

/** HTML-bearing fields whose <img> tags should be proxied. */
const RSS_CONTENT_FIELDS = ["content:encoded", "description"];
const ATOM_CONTENT_FIELDS = ["content", "summary"];

export function contentFields(format: FeedFormat): string[] {
  return format === "rss" ? RSS_CONTENT_FIELDS : ATOM_CONTENT_FIELDS;
}
