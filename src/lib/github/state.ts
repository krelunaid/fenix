/**
 * CSRF state for GitHub App setup URL. Session/owner-bound, HMAC, single-use.
 * https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { githubAppConfig } from "./secrets.server.ts";

const STATE_TTL_MS = 10 * 60 * 1000;

export type ConnectState = {
  ownerHash: string;
  nonce: string;
  exp: number;
  returnTo: string;
};

function stateSecret(): string | null {
  const cfg = githubAppConfig();
  if (!cfg) return null;
  return createHmac("sha256", "fenix-github-state").update(cfg.privateKey).digest("hex");
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function safeReturnTo(raw: string | null | undefined): string {
  const p = String(raw || "/").trim() || "/";
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /:/.test(p)) return "/";
  return p.split("#")[0] || "/";
}

export function mintConnectState(ownerHash: string, returnTo?: string): { state: string; nonce: string } | null {
  const secret = stateSecret();
  if (!secret) return null;
  const nonce = randomBytes(16).toString("hex");
  const body: ConnectState = {
    ownerHash,
    nonce,
    exp: Date.now() + STATE_TTL_MS,
    returnTo: safeReturnTo(returnTo),
  };
  const payload = b64url(JSON.stringify(body));
  return { state: `${payload}.${sign(payload, secret)}`, nonce };
}

export function parseConnectState(raw: string | null | undefined): ConnectState | null {
  const secret = stateSecret();
  if (!secret) return null;
  const text = String(raw || "").trim();
  const dot = text.lastIndexOf(".");
  if (dot < 8) return null;
  const payload = text.slice(0, dot);
  const mac = text.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
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
