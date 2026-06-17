import { NextResponse, type NextRequest } from "next/server";
import { deleteSource, getSource, updateSource } from "@/lib/store";
import { normalizeSourceInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ source });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 无效" }, { status: 400 });
  }
  const input = normalizeSourceInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "需要填写名称和有效的 http(s) 源地址" },
      { status: 400 },
    );
  }
  const source = await updateSource(id, input);
  if (!source) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json({ source });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteSource(id);
  return NextResponse.json({ ok: true });
}
