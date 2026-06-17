"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@heroui/react";
import { Field } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "登录失败");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-5 py-10">
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-bold">RSS 过滤器</h1>
        <p className="mb-5 text-sm text-zinc-500">请输入密码以继续。</p>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field
            label="密码"
            type="password"
            value={password}
            onChange={setPassword}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" variant="primary" isDisabled={busy}>
            {busy ? "登录中…" : "登录"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
