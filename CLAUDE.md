# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted RSS proxy/filter built on Next.js, deployed to Vercel. It fetches an
upstream RSS/Atom feed, transforms it according to per-source settings, and serves the
rewritten feed at a stable URL that the user subscribes to in their reader.

Four transforms, each toggleable per source:
1. **LLM filtering** — drop ads / low-value items using an LLM judgment over item title + summary.
2. **Title translation** — translate item titles via LLM into a target language.
3. **Branding override** — replace the feed's title, site link, and icon/image.
4. **Image proxy** — rewrite each `<img src>` in item content to point at our proxy
   endpoint (with the real image URL passed as a param). The proxy then fetches the
   original image server-side with the `Referer` header **emptied by default** or set to
   the per-source custom Referer URL, defeating hotlink protection, and streams the bytes
   back. The reader only ever sees the proxy URL.

All four are configured per RSS source from the frontend; there is no global on/off.

## Stack & key decisions

- **Package manager: Bun.** Use `bun` / `bunx` for everything — never `npm`/`yarn`/`pnpm`.
- **Next.js 16 (App Router, Turbopack)** + React 19, deployed to **Vercel**.
- **UI: HeroUI v3** (`@heroui/react` + `@heroui/styles`) on **Tailwind v4**, CSS-first.
  - `app/globals.css` does `@import "tailwindcss";` then `@import "@heroui/styles";`. There is
    **no `tailwind.config.js`** and **no `HeroUIProvider`** — v3 removed the provider.
  - HeroUI v3 is built on React Aria: components are **compound** (`Card.Header`, `Switch.Control`/
    `Switch.Thumb`, `TextField` wrapping `Label` + `Input`). Buttons use `onPress`, not `onClick`,
    and `variant` is one of `primary | secondary | ghost | danger`. Reusable wrappers that hide the
    compound boilerplate live in `components/ui.tsx` — prefer extending those over re-deriving the API.
- **Storage: Upstash Redis** via `@upstash/redis` (Vercel KV is deprecated → Marketplace
  "Upstash for Redis"). Single client in `lib/kv.ts` reads `KV_REST_API_URL`/`KV_REST_API_TOKEN`
  (or `UPSTASH_REDIS_REST_*`). No SQL, no filesystem persistence. Keys: `source:<id>` → source JSON,
  `sources:index` → set of ids, `tf:<id>:<version>:<hash>` → cached per-item transform decision.
- **LLM: OpenAI-compatible API** (`lib/llm.ts`). Env `OPENAI_BASE_URL` / `OPENAI_API_KEY` /
  `OPENAI_MODEL`; any compatible provider works. Every LLM function **fails open**.
- **Single-user / self-hosted.** Password (`APP_PASSWORD`) → HMAC-signed cookie (`lib/auth.ts`).
  `proxy.ts` (Next 16's renamed middleware) gates config pages + `/api/sources*`; `/api/feed/*`
  and `/api/img` stay public. Feed URLs are unguessable nanoids.

## Commands

```bash
bun install            # install dependencies
bun run dev            # local dev server (next dev)
bun run build          # production build (runs tsc + eslint; the real CI gate)
bun run start          # serve production build
bun run lint           # eslint only
```

> There is no test runner wired up yet. `bun run build` type-checks and lints the whole
> project, so run it after non-trivial changes. To sanity-check the pure pipeline without
> KV/LLM, write a throwaway `bun run x.ts` that calls `transformFeed` with `filter`/`translate`
> disabled (those are the only steps that touch KV/LLM).

## Architecture & file map

The serving path (public) and the config path (auth-gated) are separate concerns.

- **Feed serving** — `app/api/feed/[id]/route.ts`: load source from KV → fetch upstream →
  `transformFeed` → emit `application/rss+xml`. Fails open to the raw upstream feed on any error.
- **Transform pipeline** — `lib/feed/pipeline.ts` orchestrates parse → filter → translate →
  branding → image-proxy → serialize, reading which steps to run from the source config.
  - `lib/feed/xml.ts` — RSS/Atom parse/build (object mode) + accessors (`getText`/`setText`,
    `getItems`, `itemGuid`, `contentFields`). Round-trips arbitrary feed fields.
  - `lib/feed/images.ts` — rewrites `<img src>` in content HTML to the proxy URL (drops `srcset`).
  - Filter+translate decisions are cached in KV keyed by `guid + source.version`; LLM work is
    capped at `MAX_LLM_ITEMS` per poll.
- **Image proxy** — `app/api/img/route.ts`: server-side fetch of the target image with no
  `Referer` by default, or the per-source custom Referer carried as `?ref=...`; streams bytes
  back. Has an SSRF host blocklist.
- **Config API** — `app/api/sources/route.ts` (GET list / POST create) and `.../[id]/route.ts`
  (GET/PUT/DELETE). Input is normalized via `lib/validate.ts`. `lib/store.ts` is the only KV gateway.
- **Config UI** — `app/page.tsx` (list, client `components/sources-list.tsx`), `app/sources/new`
  + `app/sources/[id]` (both render `components/source-form.tsx`), `app/login/page.tsx`.
- **Auth** — `lib/auth.ts` + `app/api/login/route.ts` + `proxy.ts`.

## Things that bite in this architecture

- **Serverless = no persistence and time/size limits.** Anything that must survive a request
  goes to KV. Long LLM batch calls can exceed Vercel function timeouts — batch/limit items
  per feed fetch and fail open (return the un-transformed item) rather than dropping the feed.
- **LLM cost & latency on every feed poll.** Readers poll frequently; transforming every item
  every poll is expensive. Cache transform results (keyed by item guid + config version) in KV.
- **Feed validity is non-negotiable.** A subscriber's reader breaks if the output isn't valid
  RSS/Atom. Preserve required elements; when a transform fails, degrade to passthrough.
- **Referer policy is the whole point of the image proxy** — default to sending **no**
  `Referer` when fetching the original image; allow each source to provide a custom Referer
  URL (often the article site, e.g. `https://mp.weixin.qq.com/`). Get this wrong and hotlink
  protection still blocks the images.
