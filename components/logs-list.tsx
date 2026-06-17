"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Spinner } from "@heroui/react";
import type { FeedLogEntry } from "@/lib/types";

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(ts);
  }
}

export function LogsList({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [logs, setLogs] = useState<FeedLogEntry[] | null>(null);

  async function load() {
    const res = await fetch(`/api/sources/${sourceId}/logs`);
    const data = await res.json();
    setLogs(data.logs ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  async function clear() {
    if (!confirm("确定清空这个源的所有日志吗？")) return;
    await fetch(`/api/sources/${sourceId}/logs`, { method: "DELETE" });
    load();
  }

  if (!logs) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const dropped = logs.filter((l) => l.filtered).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          共 {logs.length} 条{dropped > 0 ? ` · 丢弃 ${dropped} 条` : ""}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onPress={() => router.push("/")}>
            返回
          </Button>
          {logs.length > 0 && (
            <Button size="sm" variant="danger" onPress={clear}>
              清空日志
            </Button>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <Card className="p-8 text-center text-zinc-500">
          还没有日志。被读取器拉取（或访问 feed 链接）一次后，这里会显示每条 RSS 的处理记录。
        </Card>
      ) : (
        logs.map((l, i) => (
          <Card key={`${l.guid}-${l.ts}-${i}`} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    l.filtered ? "text-zinc-400 line-through" : ""
                  }`}
                >
                  {l.title || "(无标题)"}
                </p>
                {l.translatedTitle && (
                  <p className="mt-0.5 truncate text-sm text-zinc-500">
                    → {l.translatedTitle}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  l.filtered
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {l.filtered ? "丢弃" : "保留"}
              </span>
            </div>

            {l.filtered && l.reason && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                原因：{l.reason}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
              <span>{formatTime(l.ts)}</span>
              {l.imagesProxied > 0 && <span>图片代理 {l.imagesProxied}</span>}
              {l.link && (
                <a
                  href={l.link}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-zinc-400 underline hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  原文
                </a>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
