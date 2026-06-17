import { notFound } from "next/navigation";
import { LogsList } from "@/components/logs-list";
import { getSource } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SourceLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold">处理日志</h1>
      <p className="mb-6 truncate text-sm text-zinc-500">{source.name}</p>
      <LogsList sourceId={id} />
    </main>
  );
}
