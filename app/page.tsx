import { SourcesList } from "@/components/sources-list";
import { HeaderActions } from "@/components/header-actions";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">RSS 过滤器</h1>
          <p className="text-sm text-zinc-500">
            为每个 RSS 源单独配置过滤、翻译、品牌替换与图片代理。
          </p>
        </div>
        <HeaderActions />
      </header>
      <SourcesList />
    </main>
  );
}
