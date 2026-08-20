import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "jialiyou_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type AuthConfig = {
  username: string;
  password: string;
  secret: string;
};

export function getAuthConfig(): AuthConfig | null {
  const isDevelopment = process.env.NODE_ENV === "development";
  const username = process.env.AUTH_USERNAME ?? (isDevelopment ? "admin" : "");
  const password = process.env.AUTH_PASSWORD ?? (isDevelopment ? "jialiyou" : "");
  const secret = process.env.AUTH_SECRET ?? (isDevelopment ? "jialiyou-local-development-secret" : "");

  if (!username || !password || !secret) return null;
  return { username, password, secret };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyCredentials(username: string, password: string) {
  const config = getAuthConfig();
  if (!config) return false;
  return safeEqual(username, config.username) && safeEqual(password, config.password);
}

export function createSessionToken(username: string) {
  const config = getAuthConfig();
  if (!config || !safeEqual(username, config.username)) throw new Error("用户认证尚未配置");

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${Buffer.from(username).toString("base64url")}.${expiresAt}`;
  return `${payload}.${sign(payload, config.secret)}`;
}

export function verifySessionToken(token: string | undefined) {
  const config = getAuthConfig();
  if (!config || !token) return null;

  const [encodedUsername, expiresAtText, signature, ...rest] = token.split(".");
  if (!encodedUsername || !expiresAtText || !signature || rest.length) return null;

  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const payload = `${encodedUsername}.${expiresAtText}`;
  if (!safeEqual(signature, sign(payload, config.secret))) return null;

  try {
    const username = Buffer.from(encodedUsername, "base64url").toString("utf8");
    return safeEqual(username, config.username) ? username : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
