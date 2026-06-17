import { notFound } from "next/navigation";
import { SourceForm } from "@/components/source-form";
import { getSource } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">编辑源</h1>
      <SourceForm initial={source} />
    </main>
  );
}
