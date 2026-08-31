import type { Palette, ProjectKind } from "./types.ts";
import type { PublishedSnapshot } from "./published.ts";

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
  const res = await fetch(`/api/sites/${encodeURIComponent(input.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      name: input.name,
      tagline: input.tagline ?? "",
      kind: input.kind,
      summary: input.summary ?? "",
      palette: input.palette,
      html: input.html,
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as PublishedSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || "Pubblicazione rifiutata.");
  }
  return payload;
}
