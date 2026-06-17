import { nanoid } from "nanoid";
import { redis } from "./kv";
import type { FeedLogEntry, RssSource, SourceInput } from "./types";

const INDEX_KEY = "sources:index";
const sourceKey = (id: string) => `source:${id}`;
const logKey = (id: string) => `log:${id}`;

/** Cap on stored per-item log entries per source. */
const MAX_LOGS = 200;
/** Log retention (seconds). */
const LOG_TTL = 60 * 60 * 24 * 30;

export async function listSources(): Promise<RssSource[]> {
  const ids = await redis.smembers(INDEX_KEY);
  if (!ids || ids.length === 0) return [];
  const sources = await Promise.all(
    ids.map((id) => redis.get<RssSource>(sourceKey(String(id)))),
  );
  return sources
    .filter((s): s is RssSource => s != null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSource(id: string): Promise<RssSource | null> {
  return (await redis.get<RssSource>(sourceKey(id))) ?? null;
}

export async function createSource(input: SourceInput): Promise<RssSource> {
  const now = Date.now();
  const source: RssSource = {
    ...input,
    id: nanoid(),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(sourceKey(source.id), source);
  await redis.sadd(INDEX_KEY, source.id);
  return source;
}

export async function updateSource(
  id: string,
  input: SourceInput,
): Promise<RssSource | null> {
  const existing = await getSource(id);
  if (!existing) return null;
  const updated: RssSource = {
    ...input,
    id: existing.id,
    version: existing.version + 1, // invalidates transform cache
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  await redis.set(sourceKey(id), updated);
  return updated;
}

export async function deleteSource(id: string): Promise<void> {
  await redis.del(sourceKey(id));
  await redis.srem(INDEX_KEY, id);
  await redis.del(logKey(id));
}

/**
 * Append per-item transform logs for a source (newest first), capped and TTL'd.
 * Latest entries appear at the head of the list.
 */
export async function appendLogs(
  id: string,
  entries: FeedLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const key = logKey(id);
  // lpush prepends in argument order, so push oldest-first to keep newest at the head.
  const payload = [...entries].reverse();
  await redis.lpush(key, ...payload);
  await redis.ltrim(key, 0, MAX_LOGS - 1);
  await redis.expire(key, LOG_TTL);
}

export async function getLogs(id: string): Promise<FeedLogEntry[]> {
  const raw = await redis.lrange<string | FeedLogEntry>(logKey(id), 0, -1);
  return raw
    .map((r) => {
      if (typeof r !== "string") return r as FeedLogEntry;
      try {
        return JSON.parse(r) as FeedLogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is FeedLogEntry => e != null);
}

export async function clearLogs(id: string): Promise<void> {
  await redis.del(logKey(id));
}
