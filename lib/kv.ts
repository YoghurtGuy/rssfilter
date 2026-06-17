import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client. Vercel's "Upstash for Redis" Marketplace integration
 * injects KV_REST_API_URL / KV_REST_API_TOKEN; a direct Upstash integration
 * uses the UPSTASH_REDIS_REST_* names. Accept either.
 */
export const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
  token:
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});
