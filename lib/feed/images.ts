import { parse } from "node-html-parser";

/** Build the public proxy URL for one image. */
export function proxyUrl(
  baseUrl: string,
  target: string,
  referer: string,
): string {
  const params = new URLSearchParams({ u: target });
  if (referer) params.set("ref", referer);
  return `${baseUrl}/api/img?${params.toString()}`;
}

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Rewrite every absolute http(s) <img src> in an HTML fragment to route through
 * our image proxy. Relative/data URLs are left untouched. Returns the original
 * string unchanged if it contains no rewritable images.
 */
export function rewriteImages(
  html: string,
  baseUrl: string,
  referer: string,
): string {
  if (!html || !html.includes("<img")) return html;
  let changed = false;
  const root = parse(html);
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (src && isHttp(src)) {
      img.setAttribute("src", proxyUrl(baseUrl, src, referer));
      // Drop srcset so readers don't bypass the proxy via responsive variants.
      if (img.getAttribute("srcset")) img.removeAttribute("srcset");
      changed = true;
    }
  }
  return changed ? root.toString() : html;
}
