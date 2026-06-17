import { NextResponse, type NextRequest } from "next/server";
import { clearLogs, getLogs, getSource } from "@/lib/store";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(sp.get("pageSize")) || DEFAULT_PAGE_SIZE)),
  );
  const { logs, total } = await getLogs(id, (page - 1) * pageSize, pageSize);
  return NextResponse.json({ logs, total, page, pageSize });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await clearLogs(id);
  return NextResponse.json({ ok: true });
}
