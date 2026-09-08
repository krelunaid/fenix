/**
 * Stateless, signed capability for the preview relay: base64url(jobId.owner.exp).sig
 * Signed with HMAC-SHA256 under the server-only AGENT_TOKEN. Lets the sandboxed
 * (opaque-origin) iframe reach its own preview without any identity header.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const PREVIEW_TOKEN_TTL_MS = 30 * 60_000;

function b64u(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", `fenix-preview:${secret}`).update(payload).digest("base64url");
}

export function mintPreviewToken(jobId: string, owner: string, secret: string, now = Date.now(), ttlMs = PREVIEW_TOKEN_TTL_MS): string {
  const payload = b64u(`${jobId}.${owner}.${now + ttlMs}`);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyPreviewToken(token: string, secret: string, now = Date.now()): { jobId: string; owner: string; exp: number } | null {
  const m = /^([A-Za-z0-9_-]{16,512})\.([A-Za-z0-9_-]{40,50})$/.exec(String(token || ""));
  if (!m) return null;
  const [, payload, sig] = m;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parts = Buffer.from(payload, "base64url").toString("utf8").split(".");
  if (parts.length !== 3) return null;
  const [jobId, owner, expRaw] = parts;
  const exp = Number(expRaw);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(jobId) || !/^[a-f0-9]{32,64}$/.test(owner) || !Number.isFinite(exp)) return null;
  if (exp < now) return null;
  return { jobId, owner, exp };
}
