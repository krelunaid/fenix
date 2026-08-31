import type { Palette, ProjectKind } from "./types.ts";

export const PUBLISHED_STORE = "fenix-sites";
export const MAX_PUBLISHED_HTML = 4_500_000;
export const PUBLISHED_ID_RE = /^[a-z0-9][a-z0-9._-]{7,79}$/i;

export type PublishedSnapshot = {
  id: string;
  name: string;
  tagline: string;
  kind: ProjectKind;
  summary: string;
  palette: Palette;
  html: string;
  version: number;
  hash: string;
  publishedAt: number;
};

/** Server-only. ownerHash is never returned on public GET. */
export type StoredSnapshot = PublishedSnapshot & {
  ownerHash?: string;
};

export type PublishInput = {
  name?: unknown;
  tagline?: unknown;
  kind?: unknown;
  summary?: unknown;
  palette?: unknown;
  html?: unknown;
};

export type PublishAccess = {
  ownerId: string;
  ifMatch?: string | null;
};

const KINDS: ProjectKind[] = ["landing", "app", "dashboard", "tool", "game", "site"];

export function isPublishedId(id: string) {
  return PUBLISHED_ID_RE.test(String(id || "").trim());
}

export function snapshotHash(html: string, kind: string, name: string) {
  const text = `${kind}\n${name}\n${html}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

function asKind(value: unknown): ProjectKind | null {
  return KINDS.includes(value as ProjectKind) ? (value as ProjectKind) : null;
}

function asPalette(value: unknown): Palette | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const hex = (k: string, fallback: string) =>
    typeof rec[k] === "string" && /^#[0-9a-f]{3,8}$/i.test(rec[k] as string)
      ? (rec[k] as string)
      : fallback;
  return {
    bg: hex("bg", "#ffffff"),
    surface: hex("surface", "#f7f4ee"),
    fg: hex("fg", "#1c1712"),
    muted: hex("muted", "#6e5648"),
    accent: hex("accent", "#b85c38"),
    line: hex("line", "#d7c4b0"),
  };
}

export function parsePublishInput(raw: PublishInput): {
  name: string;
  tagline: string;
  kind: ProjectKind;
  summary: string;
  palette: Palette;
  html: string;
} | { error: string } {
  const html = typeof raw.html === "string" ? raw.html : "";
  if (html.trim().length < 80) return { error: "HTML assente o troppo corto." };
  if (html.length > MAX_PUBLISHED_HTML) return { error: "HTML troppo grande per la pubblicazione." };
  const kind = asKind(raw.kind);
  if (!kind) return { error: "Formato sconosciuto." };
  const palette = asPalette(raw.palette);
  if (!palette) return { error: "Palette assente." };
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : "Sito";
  const tagline = typeof raw.tagline === "string" ? raw.tagline.trim().slice(0, 160) : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 400) : "";
  return { name, tagline, kind, summary, palette, html };
}

export function isPublishedSnapshot(value: unknown): value is StoredSnapshot {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    isPublishedId(rec.id) &&
    typeof rec.html === "string" &&
    rec.html.length >= 80 &&
    typeof rec.name === "string" &&
    typeof rec.hash === "string" &&
    typeof rec.version === "number" &&
    asKind(rec.kind) !== null
  );
}
