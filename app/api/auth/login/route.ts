import { NextResponse } from "next/server";
import { createSessionToken, getAuthConfig, SESSION_COOKIE, SESSION_MAX_AGE, verifyCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "认证尚未配置，请先设置 AUTH_USERNAME、AUTH_PASSWORD 和 AUTH_SECRET" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!verifyCredentials(username, password)) {
    return NextResponse.json({ error: "用户名或密码不正确" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const secure = forwardedProtocol ? forwardedProtocol === "https" : new URL(request.url).protocol === "https:";
  response.cookies.set(SESSION_COOKIE, createSessionToken(username), {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
