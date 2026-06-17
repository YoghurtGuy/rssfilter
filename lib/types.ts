export interface RssSource {
  /** nanoid; appears in the public feed URL (/api/feed/<id>). */
  id: string;
  name: string;
  /** Upstream RSS/Atom URL to fetch and transform. */
  feedUrl: string;

  /** LLM ad / low-value filtering. */
  filter: {
    enabled: boolean;
    /** Natural-language description of what to drop. */
    criteria?: string;
  };

  /** LLM title translation. */
  translate: {
    enabled: boolean;
    /** e.g. "Chinese", "English", "zh-CN". */
    targetLang?: string;
  };

  /** Feed branding override (channel-level). */
  branding: {
    enabled: boolean;
    title?: string;
    siteUrl?: string;
    iconUrl?: string;
  };

  /** Image proxy to defeat hotlink protection. */
  imageProxy: {
    enabled: boolean;
    /**
     * Custom Referer sent when fetching the original image. Empty string sends
     * NO Referer header. Set it to the article/site URL the image is embedded
     * in (e.g. https://mp.weixin.qq.com/) to satisfy hotlink protection.
     */
    referer: string;
  };

  /** Bumped on every edit; invalidates the per-item transform cache. */
  version: number;
  createdAt: number;
  updatedAt: number;
}

/** One per-item record of what the transform pipeline did to an RSS item. */
export interface FeedLogEntry {
  /** When the item was processed (ms). */
  ts: number;
  /** Stable item identity (guid/id/link/title). */
  guid: string;
  /** Original (pre-translation) title. */
  title: string;
  link: string;
  /** Whether the item made it into the output feed. */
  kept: boolean;
  /** Filtering was enabled and this item was dropped. */
  filtered: boolean;
  /** Short reason the item was dropped (only when filtered out). */
  reason: string | null;
  /** Translated title, when translation produced one. */
  translatedTitle: string | null;
  /** Number of <img> in the item content rewritten to the proxy. */
  imagesProxied: number;
  /** Source config version this decision was made under. */
  version: number;
}

/** Fields a client supplies when creating/updating a source. */
export type SourceInput = Omit<
  RssSource,
  "id" | "version" | "createdAt" | "updatedAt"
>;

export function emptySourceInput(): SourceInput {
  return {
    name: "",
    feedUrl: "",
    filter: { enabled: false, criteria: "" },
    translate: { enabled: false, targetLang: "" },
    branding: { enabled: false, title: "", siteUrl: "", iconUrl: "" },
    imageProxy: { enabled: false, referer: "" },
  };
}
