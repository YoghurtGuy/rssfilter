"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Pagination, Spinner } from "@heroui/react";
import type { FeedLogEntry } from "@/lib/types";

const PAGE_SIZE = 20;

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(ts);
  }
}

/** Page numbers to render, collapsing long ranges with "ellipsis". */
function pageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  if (page > 3) pages.push("ellipsis");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function LogsList({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [logs, setLogs] = useState<FeedLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  async function load(p: number) {
    const res = await fetch(
      `/api/sources/${sourceId}/logs?page=${p}&pageSize=${PAGE_SIZE}`,
    );
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
  }

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, page]);

  async function clear() {
    if (!confirm("确定清空这个源的所有日志吗？")) return;
    await fetch(`/api/sources/${sourceId}/logs`, { method: "DELETE" });
    if (page === 1) load(1);
    else setPage(1);
  }

  if (!logs) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">共 {total} 条</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onPress={() => router.push("/")}>
            返回
          </Button>
          {total > 0 && (
            <Button size="sm" variant="danger" onPress={clear}>
              清空日志
            </Button>
          )}
        </div>
      </div>

      {total === 0 ? (
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
              {l.filtered && l.reason && (
                <span className="text-red-600 dark:text-red-400">
                  原因：{l.reason}
                </span>
              )}
            </div>
          </Card>
        ))
      )}

      {totalPages > 1 && (
        <Pagination className="w-full">
          <Pagination.Summary>
            第 {startItem}-{endItem} 条 / 共 {total} 条
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={page === 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Pagination.PreviousIcon />
                <span>上一页</span>
              </Pagination.Previous>
            </Pagination.Item>
            {pageNumbers(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <Pagination.Item key={`ellipsis-${i}`}>
                  <Pagination.Ellipsis />
                </Pagination.Item>
              ) : (
                <Pagination.Item key={p}>
                  <Pagination.Link
                    isActive={p === page}
                    onPress={() => setPage(p)}
                  >
                    {p}
                  </Pagination.Link>
                </Pagination.Item>
              ),
            )}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={page === totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span>下一页</span>
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      )}
    </div>
  );
}
