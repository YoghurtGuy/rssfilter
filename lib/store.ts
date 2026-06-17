import { nanoid } from "nanoid";
import { redis } from "./kv";
import type { RssSource, SourceInput } from "./types";

const INDEX_KEY = "sources:index";
const sourceKey = (id: string) => `source:${id}`;

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
}
