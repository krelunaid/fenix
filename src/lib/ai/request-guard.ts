/**
 * Cheap, dependency-free request guards shared by the Edge Function and the
 * Nitro route for /api/build. They are defence in depth until per-user server
 * credits exist: a browser on another origin is refused outright; a scripted
 * client without browser headers is only bounded (shot size, create rules).
 */
export const MAX_SHOT_CHARS = 150_000;

export type GuardHeaders = { get(name: string): string | null };

export function rejectCrossOrigin(url: string, headers: GuardHeaders, extraOrigins: string[] = []): string | null {
  const self = new URL(url).origin;
  const allowed = new Set([self, ...extraOrigins.filter(Boolean)]);
  const origin = headers.get("origin");
  if (origin && !allowed.has(origin)) return "Origine non consentita.";
  const site = headers.get("sec-fetch-site");
  if (!origin && site && site !== "same-origin" && site !== "none") return "Richiesta cross-site rifiutata.";
  return null;
}

/** A screenshot is only meaningful on an edit of an existing document; cap it hard. */
export function sanitizeShot(shot: unknown, operation: unknown, html: string): string {
  if (typeof shot !== "string" || !shot.startsWith("data:image")) return "";
  if (operation === "create" || !html) return "";
  return shot.slice(0, MAX_SHOT_CHARS);
}
