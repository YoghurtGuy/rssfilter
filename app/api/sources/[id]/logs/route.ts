import { NextResponse, type NextRequest } from "next/server";
import { clearLogs, getLogs, getSource } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const logs = await getLogs(id);
  return NextResponse.json({ logs });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await clearLogs(id);
  return NextResponse.json({ ok: true });
}
