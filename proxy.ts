import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

/** Paths reachable without auth: public feeds, image proxy, and the login flow. */
const PUBLIC_PREFIXES = ["/api/feed", "/api/img", "/login", "/api/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await verifyToken(token)) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static files (with extensions).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
