/** Owner capability for publish. Not in the public URL, not a committed secret. */

export const OWNER_HEADER = "x-fenix-owner";
export const OWNER_STORAGE_KEY = "fenix.owner-id";
/** originalProjectId → publishedId. Same origin as the owner capability; never in the URL. */
export const PUBLISHED_MAP_KEY = "fenix.published-ids";
export const OWNER_ID_RE = /^[a-f0-9]{32,64}$/i;

export function parseOwnerId(raw: string | null | undefined): string | null {
  const id = String(raw || "").trim().toLowerCase();
  return OWNER_ID_RE.test(id) ? id : null;
}

export function ownerFromRequest(req: Request): string | null {
  return parseOwnerId(req.headers.get(OWNER_HEADER));
}

export function parseIfMatch(
  raw: string | null | undefined,
): { star: boolean; version?: number; hash?: string } | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (v === "*") return { star: true };
  const unquoted = v.replace(/^W\//, "").replace(/^"/, "").replace(/"$/, "");
  if (/^\d+$/.test(unquoted)) return { star: false, version: Number(unquoted) };
  if (/^[a-f0-9]{8,64}$/i.test(unquoted)) return { star: false, hash: unquoted.toLowerCase() };
  return null;
}

export function ifMatchSatisfied(
  match: { star: boolean; version?: number; hash?: string } | null,
  current: { version: number; hash: string },
): boolean {
  if (!match) return false;
  if (match.star) return true;
  if (match.version != null && match.version === current.version) return true;
  if (match.hash && match.hash === current.hash) return true;
  return false;
}
