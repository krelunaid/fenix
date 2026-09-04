import { OWNER_HEADER } from "./publish-owner.ts";
import { getOwnerCapability } from "./publish-client.ts";

export type AppInviteRole = "viewer" | "editor";
export type AppInvite = {
  id: string;
  role: AppInviteRole;
  label: string;
  createdAt: number;
  expiresAt: number;
};

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || fallback);
  return body;
}

function ownerHeaders(): HeadersInit {
  return { [OWNER_HEADER]: getOwnerCapability() };
}

export async function loadAppInvites(siteId: string): Promise<AppInvite[]> {
  const res = await fetch(`/api/app-access/${encodeURIComponent(siteId)}`, {
    cache: "no-store",
    headers: ownerHeaders(),
  });
  return (await parse<{ invites: AppInvite[] }>(res, "Inviti non disponibili.")).invites;
}

export async function createAppInviteLink(
  siteId: string,
  role: AppInviteRole,
): Promise<{ invite: AppInvite; url: string }> {
  const label = role === "editor" ? "Può modificare" : "Sola lettura";
  const res = await fetch(`/api/app-access/${encodeURIComponent(siteId)}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify({ op: "create", role, label }),
  });
  const created = await parse<{ invite: AppInvite; token: string }>(res, "Invito non creato.");
  return {
    invite: created.invite,
    url: `${window.location.origin}/sito/${encodeURIComponent(siteId)}#fenix-access=${created.token}`,
  };
}

export async function revokeAppInviteLink(siteId: string, id: string): Promise<void> {
  const res = await fetch(`/api/app-access/${encodeURIComponent(siteId)}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify({ op: "revoke", id }),
  });
  await parse<{ ok: true }>(res, "Invito non revocato.");
}

/** Consume a fragment capability once, scrub it before any public-site fetch,
 * and let the server keep it only in a scoped HttpOnly cookie. */
export async function exchangeAppInviteFromFragment(
  siteId: string,
): Promise<{ role: AppInviteRole } | null> {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("fenix-access") || "";
  if (!token) return null;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  const res = await fetch(`/api/app-access/${encodeURIComponent(siteId)}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "exchange", token }),
  });
  return parse<{ role: AppInviteRole }>(res, "Invito non valido.");
}
