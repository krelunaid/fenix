/**
 * CSRF state + session cookie for GitHub App setup URL.
 * State is in the GitHub redirect; the cookie binds that state to this browser.
 * HMAC purposes differ so a cookie cannot be replayed as state.
 * https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { githubAppConfig } from "./secrets.server.ts";

const STATE_TTL_MS = 10 * 60 * 1000;

export const CONNECT_COOKIE_NAME = "fenix_gh";
export const CONNECT_COOKIE_PATH = "/api/github/callback";
export const CONNECT_COOKIE_MAX_AGE = 600;

export type ConnectState = {
  ownerHash: string;
  nonce: string;
  exp: number;
  returnTo: string;
};

export type ConnectCookie = {
  ownerHash: string;
  nonce: string;
  exp: number;
};

function hmacSecret(purpose: "state" | "cookie"): string | null {
  const cfg = githubAppConfig();
  if (!cfg) return null;
  return createHmac("sha256", `fenix-github-${purpose}`).update(cfg.privateKey).digest("hex");
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifyMac(raw: string, secret: string): string | null {
  const text = String(raw || "").trim();
  const dot = text.lastIndexOf(".");
  if (dot < 8) return null;
  const payload = text.slice(0, dot);
  const mac = text.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function safeReturnTo(raw: string | null | undefined): string {
  const p = String(raw || "/").trim() || "/";
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /:/.test(p)) return "/";
  return p.split("#")[0] || "/";
}

export function mintConnectState(
  ownerHash: string,
  returnTo?: string,
): { state: string; nonce: string; exp: number } | null {
  const secret = hmacSecret("state");
  if (!secret) return null;
  const nonce = randomBytes(16).toString("hex");
  const body: ConnectState = {
    ownerHash,
    nonce,
    exp: Date.now() + STATE_TTL_MS,
    returnTo: safeReturnTo(returnTo),
  };
  const payload = b64url(JSON.stringify(body));
  return { state: `${payload}.${sign(payload, secret)}`, nonce, exp: body.exp };
}

export function parseConnectState(raw: string | null | undefined): ConnectState | null {
  const secret = hmacSecret("state");
  if (!secret) return null;
  const payload = verifyMac(String(raw || ""), secret);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ConnectState;
    if (!parsed?.ownerHash || !parsed.nonce || !parsed.exp) return null;
    if (typeof parsed.ownerHash !== "string" || parsed.ownerHash.length < 32) return null;
    if (!/^[a-f0-9]{32}$/.test(parsed.nonce)) return null;
    if (Date.now() > Number(parsed.exp)) return null;
    return {
      ownerHash: parsed.ownerHash,
      nonce: parsed.nonce,
      exp: Number(parsed.exp),
      returnTo: safeReturnTo(parsed.returnTo),
    };
  } catch {
    return null;
  }
}

export function mintConnectCookie(ownerHash: string, nonce: string, exp: number): string | null {
  const secret = hmacSecret("cookie");
  if (!secret) return null;
  if (!/^[a-f0-9]{32}$/.test(nonce) || ownerHash.length < 32) return null;
  const payload = b64url(JSON.stringify({ ownerHash, nonce, exp }));
  return `${payload}.${sign(payload, secret)}`;
}

export function parseConnectCookie(raw: string | null | undefined): ConnectCookie | null {
  const secret = hmacSecret("cookie");
  if (!secret) return null;
  const payload = verifyMac(String(raw || ""), secret);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ConnectCookie;
    if (!parsed?.ownerHash || !parsed.nonce || !parsed.exp) return null;
    if (typeof parsed.ownerHash !== "string" || parsed.ownerHash.length < 32) return null;
    if (!/^[a-f0-9]{32}$/.test(parsed.nonce)) return null;
    if (Date.now() > Number(parsed.exp)) return null;
    return { ownerHash: parsed.ownerHash, nonce: parsed.nonce, exp: Number(parsed.exp) };
  } catch {
    return null;
  }
}

export function readConnectCookie(request: Request): string | null {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const slice = part.trim();
    if (!slice.startsWith(`${CONNECT_COOKIE_NAME}=`)) continue;
    const value = slice.slice(CONNECT_COOKIE_NAME.length + 1).trim();
    return value || null;
  }
  return null;
}

export function cookieMatchesState(cookie: ConnectCookie, state: ConnectState): boolean {
  return sameText(cookie.ownerHash, state.ownerHash) && sameText(cookie.nonce, state.nonce);
}

export function setConnectCookieHeader(value: string): string {
  return `${CONNECT_COOKIE_NAME}=${value}; Path=${CONNECT_COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=${CONNECT_COOKIE_MAX_AGE}`;
}

export function clearConnectCookieHeader(): string {
  return `${CONNECT_COOKIE_NAME}=; Path=${CONNECT_COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
