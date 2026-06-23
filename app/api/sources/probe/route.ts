import { NextResponse, type NextRequest } from "next/server";
import { probeFeedUrl } from "@/lib/feed/probe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const result = await probeFeedUrl(url);
  return NextResponse.json(result);
}
