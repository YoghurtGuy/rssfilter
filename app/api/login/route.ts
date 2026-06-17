import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  checkPassword,
  makeToken,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "请求无效" }, { status: 400 });
  }

  if (!process.env.APP_PASSWORD) {
    return NextResponse.json(
      { error: "服务器未配置 APP_PASSWORD" },
      { status: 500 },
    );
  }
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await makeToken(), {
    httpOnly: true,
    // Secure cookies are rejected over http://localhost; only require it in prod.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
