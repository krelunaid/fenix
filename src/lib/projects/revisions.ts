import { projectFiles, type ProjectFile } from "./files.ts";
import { uid } from "../utils.ts";
import type { Palette, Project, ProjectRevision, RevisionSource } from "./types.ts";

export const MAX_REVISIONS = 16;

const REVISION_KEYS = ["id", "at", "source", "label", "hash", "html", "files", "name", "tagline", "summary", "palette"] as const;

export type CommitMeta = {
  source: RevisionSource;
  label: string;
  at?: number;
  id?: string;
};

function fnv1a(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function revisionHash(input: { html: string; files: ProjectFile[]; name: string; palette: Palette }): string {
  const files = [...input.files]
    .map((f) => `${f.path}\n${f.content}`)
    .sort()
    .join("\n--\n");
  return fnv1a(`${input.name}\n${input.palette.bg}\n${input.palette.accent}\n${input.html}\n${files}`);
}

export function captureRevision(project: Pick<Project, "html" | "files" | "name" | "tagline" | "summary" | "palette">, meta: CommitMeta): ProjectRevision | null {
  const html = String(project.html || "").trim();
  if (!html) return null;
  const files = projectFiles({ html, files: project.files });
  const name = String(project.name || "Studio");
  const palette = project.palette;
  return {
    id: meta.id || uid(),
    at: meta.at || Date.now(),
    source: meta.source,
    label: meta.label.trim() || "Cottura",
    hash: revisionHash({ html, files, name, palette }),
    html,
    files,
    name,
    tagline: String(project.tagline || ""),
    summary: String(project.summary || ""),
    palette: { ...palette },
  };
}

export function listRevisions(project: Pick<Project, "revisions">): ProjectRevision[] {
  return [...(project.revisions || [])].sort((a, b) => b.at - a.at);
}

export function commitIfChanged(project: Project, meta: CommitMeta): Project {
  const next = captureRevision(project, meta);
  if (!next) return project;
  const prev = project.revisions || [];
  if (prev[prev.length - 1]?.hash === next.hash) {
    return project.revisionId ? project : { ...project, revisionId: prev[prev.length - 1]!.id };
  }
  const revisions = [...prev, next].slice(-MAX_REVISIONS);
  return { ...project, revisions, revisionId: next.id };
}

export function restoreProjectRevision(project: Project, revisionId: string): Project | null {
  const match = (project.revisions || []).find((r) => r.id === revisionId);
  if (!match) return null;
  if (project.revisionId === revisionId && project.html === match.html) return project;
  const saved = commitIfChanged(project, { source: "manual", label: "Prima del ripristino" });
  const applied: Project = {
    ...saved,
    html: match.html,
    files: match.files,
    name: match.name || saved.name,
    tagline: match.tagline,
    summary: match.summary,
    palette: { ...match.palette },
    status: "ready",
    error: undefined,
  };
  return commitIfChanged(applied, {
    source: "restore",
    label: `Ripristino · ${match.label}`,
  });
}

export function revisionHasOnlySafeKeys(rev: ProjectRevision): boolean {
  const keys = Object.keys(rev);
  return keys.every((k) => (REVISION_KEYS as readonly string[]).includes(k));
}

export function formatRevisionAge(at: number, now = Date.now()): string {
  const delta = Math.max(0, now - at);
  if (delta < 45_000) return "adesso";
  if (delta < 90_000) return "1 min fa";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} min fa`;
  if (delta < 48 * 3_600_000) return `${Math.round(delta / 3_600_000)} h fa`;
  return `${Math.round(delta / 86_400_000)} g fa`;
}
