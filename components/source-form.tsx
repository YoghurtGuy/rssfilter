"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@heroui/react";
import { Field, TextAreaField, Toggle } from "./ui";
import { emptySourceInput, type RssSource, type SourceInput } from "@/lib/types";

function Section({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </div>
        <Toggle isSelected={enabled} onChange={onToggle} ariaLabel={title} />
      </div>
      {enabled && children ? (
        <div className="mt-5 flex flex-col gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          {children}
        </div>
      ) : null}
    </Card>
  );
}

export function SourceForm({ initial }: { initial?: RssSource }) {
  const router = useRouter();
  const [data, setData] = useState<SourceInput>(initial ?? emptySourceInput());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to update a nested section.
  function patch<K extends keyof SourceInput>(key: K, value: Partial<SourceInput[K]>) {
    setData((d) => ({ ...d, [key]: { ...(d[key] as object), ...value } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const url = initial ? `/api/sources/${initial.id}` : "/api/sources";
    const method = initial ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `请求失败（${res.status}）`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <Card.Header>
          <Card.Title>基本信息</Card.Title>
          <Card.Description>订阅名称与上游 RSS 地址。</Card.Description>
        </Card.Header>
        <Card.Content className="mt-4 flex flex-col gap-4">
          <Field
            label="名称"
            value={data.name}
            onChange={(v) => setData((d) => ({ ...d, name: v }))}
            placeholder="我的过滤订阅"
            isRequired
          />
          <Field
            label="源 RSS 地址"
            value={data.feedUrl}
            onChange={(v) => setData((d) => ({ ...d, feedUrl: v }))}
            placeholder="https://example.com/rss.xml"
            type="url"
            isRequired
          />
        </Card.Content>
      </Card>

      <Section
        title="LLM 过滤"
        description="用 LLM 过滤广告与低价值内容。"
        enabled={data.filter.enabled}
        onToggle={(v) => patch("filter", { enabled: v })}
      >
        <TextAreaField
          label="过滤规则"
          value={data.filter.criteria ?? ""}
          onChange={(v) => patch("filter", { criteria: v })}
          placeholder="赞助内容、抽奖、纯推广…"
        />
      </Section>

      <Section
        title="标题翻译"
        description="将条目标题翻译为目标语言。"
        enabled={data.translate.enabled}
        onToggle={(v) => patch("translate", { enabled: v })}
      >
        <Field
          label="目标语言"
          value={data.translate.targetLang ?? ""}
          onChange={(v) => patch("translate", { targetLang: v })}
          placeholder="中文 / English / 日本語"
        />
      </Section>

      <Section
        title="品牌替换"
        description="替换订阅的标题、网站链接和图标。"
        enabled={data.branding.enabled}
        onToggle={(v) => patch("branding", { enabled: v })}
      >
        <Field
          label="订阅标题"
          value={data.branding.title ?? ""}
          onChange={(v) => patch("branding", { title: v })}
        />
        <Field
          label="网站地址"
          value={data.branding.siteUrl ?? ""}
          onChange={(v) => patch("branding", { siteUrl: v })}
          type="url"
        />
        <Field
          label="图标地址"
          value={data.branding.iconUrl ?? ""}
          onChange={(v) => patch("branding", { iconUrl: v })}
          type="url"
        />
      </Section>

      <Section
        title="图片代理"
        description="通过代理加载图片以绕过防盗链。"
        enabled={data.imageProxy.enabled}
        onToggle={(v) => patch("imageProxy", { enabled: v })}
      >
        <Field
          label="自定义 Referer"
          value={data.imageProxy.referer ?? ""}
          onChange={(v) => patch("imageProxy", { referer: v })}
          placeholder="留空则不发送 Referer，例如 https://mp.weixin.qq.com/"
          type="url"
        />
      </Section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <Button variant="primary" isDisabled={saving} onPress={save}>
          {saving ? "保存中…" : initial ? "保存修改" : "创建源"}
        </Button>
        <Button variant="ghost" onPress={() => router.push("/")}>
          取消
        </Button>
      </div>
    </div>
  );
}
