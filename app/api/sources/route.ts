import { NextResponse, type NextRequest } from "next/server";
import { createSource, listSources } from "@/lib/store";
import { normalizeSourceInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await listSources();
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
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
  const source = await createSource(input);
  return NextResponse.json({ source }, { status: 201 });
}
