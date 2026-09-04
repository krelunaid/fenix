import { ENTRYPOINT, ingestProjectFiles, projectFiles, type ProjectFile } from "./files.ts";
import { uid } from "../utils.ts";
import type { Palette, Project, ProjectRevision, RevisionSource } from "./types.ts";

export const MAX_REVISIONS = 16;

const REVISION_KEYS = [
  "id",
  "at",
  "source",
  "label",
  "hash",
  "html",
  "files",
  "name",
  "tagline",
  "summary",
  "palette",
] as const;

export type CommitMeta = {
  source: RevisionSource;
  label: string;
  at?: number;
  id?: string;
};

export type BranchMergeConflict = {
  path: string;
  reason: "both-changed" | "invalid-tree" | "missing-entrypoint";
};

export type BranchMergeResult =
  | {
      ok: true;
      project: Project;
      changed: string[];
      baseRevisionId: string;
    }
  | {
      ok: false;
      reason: "not-a-branch" | "wrong-source" | "missing-base" | "conflict";
      conflicts: BranchMergeConflict[];
    };

function fnv1a(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function revisionHash(input: {
  html: string;
  files: ProjectFile[];
  name: string;
  palette: Palette;
}): string {
  const files = [...input.files]
    .map((f) => `${f.path}\n${f.content}`)
    .sort()
    .join("\n--\n");
  return fnv1a(
    `${input.name}\n${input.palette.bg}\n${input.palette.accent}\n${input.html}\n${files}`,
  );
}

export function captureRevision(
  project: Pick<Project, "html" | "files" | "name" | "tagline" | "summary" | "palette">,
  meta: CommitMeta,
): ProjectRevision | null {
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

/**
 * Fork one immutable cottura into a clean project branch. Code and files move
 * together; chat, app data, worker state and deploy identity intentionally do not.
 */
export function branchProjectRevision(
  project: Project,
  revisionId: string,
  meta: { id?: string; at?: number } = {},
): Project | null {
  const match = (project.revisions || []).find((revision) => revision.id === revisionId);
  if (!match) return null;
  const at = meta.at ?? Date.now();
  const branch: Project = {
    id: meta.id || uid(),
    name: `${match.name || project.name} · ramo`,
    tagline: match.tagline,
    prompt: project.prompt,
    kind: project.kind,
    requestedKind: project.requestedKind || project.kind,
    summary: match.summary,
    direction: project.direction,
    palette: { ...match.palette },
    html: match.html,
    files: match.files.map((file) => ({ ...file })),
    messages: [],
    buildLog: [],
    status: "ready",
    createdAt: at,
    updatedAt: at,
    branchFrom: { projectId: project.id, revisionId: match.id },
  };
  return commitIfChanged(branch, {
    source: "manual",
    label: `Ramo · ${match.label}`,
    at,
  });
}

function fileMap(files: ProjectFile[]): Map<string, string> {
  return new Map(files.map((file) => [file.path, file.content]));
}

/**
 * Merge a branch tree back into its source with a deterministic three-way merge.
 * Files changed only on one side are accepted, identical edits converge, and a
 * path changed differently on both sides fails closed without a partial merge.
 * Operational state (data, chat, jobs and deploy identity) always stays on source.
 */
export function mergeProjectBranch(
  source: Project,
  branch: Project,
  meta: { at?: number; id?: string } = {},
): BranchMergeResult {
  const ancestry = branch.branchFrom;
  if (!ancestry) {
    return { ok: false, reason: "not-a-branch", conflicts: [] };
  }
  if (ancestry.projectId !== source.id) {
    return { ok: false, reason: "wrong-source", conflicts: [] };
  }
  const base = (source.revisions || []).find((revision) => revision.id === ancestry.revisionId);
  if (!base) {
    return { ok: false, reason: "missing-base", conflicts: [] };
  }

  const safeBase = ingestProjectFiles(base.files, { html: base.html });
  const safeSource = ingestProjectFiles(source.files, { html: source.html });
  const safeBranch = ingestProjectFiles(branch.files, { html: branch.html });
  const invalid = [...safeBase.rejected, ...safeSource.rejected, ...safeBranch.rejected];
  if (invalid.length) {
    return {
      ok: false,
      reason: "conflict",
      conflicts: invalid.map((item) => ({ path: item.path, reason: "invalid-tree" })),
    };
  }

  const baseFiles = fileMap(safeBase.files);
  const sourceFiles = fileMap(safeSource.files);
  const branchFiles = fileMap(safeBranch.files);
  const paths = [
    ...new Set([...baseFiles.keys(), ...sourceFiles.keys(), ...branchFiles.keys()]),
  ].sort((a, b) => a.localeCompare(b));
  const conflicts: BranchMergeConflict[] = [];
  const merged: ProjectFile[] = [];
  const changed: string[] = [];

  for (const path of paths) {
    const before = baseFiles.get(path);
    const current = sourceFiles.get(path);
    const incoming = branchFiles.get(path);
    let content: string | undefined;
    if (incoming === before) content = current;
    else if (current === before || current === incoming) content = incoming;
    else {
      conflicts.push({ path, reason: "both-changed" });
      continue;
    }
    if (content !== undefined) merged.push({ path, content });
    if (content !== current) changed.push(path);
  }

  if (conflicts.length) return { ok: false, reason: "conflict", conflicts };
  if (!merged.some((file) => file.path === ENTRYPOINT)) {
    return {
      ok: false,
      reason: "conflict",
      conflicts: [{ path: ENTRYPOINT, reason: "missing-entrypoint" }],
    };
  }
  const checked = ingestProjectFiles(merged);
  if (checked.rejected.length || checked.files.length !== merged.length) {
    return {
      ok: false,
      reason: "conflict",
      conflicts: checked.rejected.map((item) => ({
        path: item.path,
        reason: "invalid-tree",
      })),
    };
  }
  const html = checked.files.find((file) => file.path === ENTRYPOINT)!.content;
  const next = commitIfChanged(
    {
      ...source,
      html,
      files: checked.files,
      status: "ready",
      error: undefined,
      updatedAt: meta.at ?? Date.now(),
    },
    {
      source: "manual",
      label: `Unione · ${branch.name}`,
      at: meta.at,
      id: meta.id,
    },
  );
  return {
    ok: true,
    project: next,
    changed,
    baseRevisionId: base.id,
  };
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
