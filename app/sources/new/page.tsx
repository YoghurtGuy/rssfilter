import { SourceForm } from "@/components/source-form";

export default function NewSourcePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">新建源</h1>
      <SourceForm />
    </main>
  );
}
