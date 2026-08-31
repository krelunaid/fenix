import { OWNER_HEADER, OWNER_ID_RE, OWNER_STORAGE_KEY } from "./publish-owner.ts";
import type { Palette, ProjectKind } from "./types.ts";
import type { PublishedSnapshot } from "./published.ts";

export function getOwnerCapability(): string {
  const mint = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  try {
    const existing = localStorage.getItem(OWNER_STORAGE_KEY);
    if (existing && OWNER_ID_RE.test(existing)) return existing.toLowerCase();
    const id = mint();
    localStorage.setItem(OWNER_STORAGE_KEY, id);
    return id;
  } catch {
    return mint();
  }
}

export function isLegacyImmutableError(error: string) {
  return /senza titolare:\s*immutabile/i.test(error);
}

export async function loadPublished(id: string): Promise<PublishedSnapshot | null> {
  const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Non riesco a leggere il sito pubblicato.");
  return (await res.json()) as PublishedSnapshot;
}

export async function publishSnapshot(input: {
  id: string;
  name: string;
  tagline?: string;
  kind: ProjectKind;
  summary?: string;
  palette: Palette;
  html: string;
}): Promise<PublishedSnapshot> {
  const owner = getOwnerCapability();
  const body = JSON.stringify({
    name: input.name,
    tagline: input.tagline ?? "",
    kind: input.kind,
    summary: input.summary ?? "",
    palette: input.palette,
    html: input.html,
  });

  async function put(id: string, ifMatch?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [OWNER_HEADER]: owner,
    };
    if (ifMatch) headers["If-Match"] = ifMatch;
    return fetch(`/api/sites/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      cache: "no-store",
      body,
    });
  }

  const current = await loadPublished(input.id);
  let id = input.id;
  let res = await put(id, current ? `"${current.version}"` : undefined);
  if (res.status === 409) {
    const payload = (await res.clone().json().catch(() => ({}))) as { error?: string };
    if (isLegacyImmutableError(String(payload.error || ""))) {
      id = crypto.randomUUID();
      res = await put(id);
    }
  }
  const payload = (await res.json().catch(() => ({}))) as PublishedSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || "Pubblicazione rifiutata.");
  }
  return payload;
}
