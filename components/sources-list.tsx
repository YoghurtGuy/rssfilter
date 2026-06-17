"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Spinner } from "@heroui/react";
import type { RssSource } from "@/lib/types";

function badges(s: RssSource): string[] {
  const out: string[] = [];
  if (s.filter.enabled) out.push("过滤");
  if (s.translate.enabled) out.push("翻译");
  if (s.branding.enabled) out.push("品牌");
  if (s.imageProxy.enabled) out.push("图片代理");
  return out;
}

export function SourcesList() {
  const router = useRouter();
  const [sources, setSources] = useState<RssSource[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/sources");
    const data = await res.json();
    setSources(data.sources ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function feedUrl(id: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/feed/${id}`;
  }

  async function copy(id: string) {
    await navigator.clipboard.writeText(feedUrl(id));
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  }

  async function remove(id: string) {
    if (!confirm("确定删除这个源吗？")) return;
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    load();
  }

  if (!sources) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sources.length === 0 ? (
        <Card className="p-8 text-center text-zinc-500">
          还没有任何源。创建你的第一个过滤订阅。
        </Card>
      ) : (
        sources.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{s.name}</h3>
                <p className="truncate text-sm text-zinc-500">{s.feedUrl}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {badges(s).map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push(`/sources/${s.id}`)}
                >
                  编辑
                </Button>
                <Button size="sm" variant="danger" onPress={() => remove(s.id)}>
                  删除
                </Button>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-zinc-100 px-2 py-1.5 text-xs dark:bg-zinc-800">
                {feedUrl(s.id)}
              </code>
              <Button size="sm" variant="ghost" onPress={() => copy(s.id)}>
                {copied === s.id ? "已复制！" : "复制"}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
