import type { SourceInput } from "./types";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Build a clean SourceInput from arbitrary request JSON, or null if invalid. */
export function normalizeSourceInput(body: unknown): SourceInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;

  const name = str(b.name);
  const feedUrl = str(b.feedUrl);
  if (!name || !/^https?:\/\//i.test(feedUrl)) return null;

  return {
    name,
    feedUrl,
    filter: {
      enabled: Boolean(b.filter?.enabled),
      criteria: str(b.filter?.criteria),
    },
    translate: {
      enabled: Boolean(b.translate?.enabled),
      targetLang: str(b.translate?.targetLang),
    },
    branding: {
      enabled: Boolean(b.branding?.enabled),
      title: str(b.branding?.title),
      siteUrl: str(b.branding?.siteUrl),
      iconUrl: str(b.branding?.iconUrl),
    },
    imageProxy: {
      enabled: Boolean(b.imageProxy?.enabled),
      referer: str(b.imageProxy?.referer),
    },
  };
}
