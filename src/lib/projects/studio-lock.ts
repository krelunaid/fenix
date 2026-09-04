import { BUILD_STAGES, inferStage } from "./build-stages.ts";
import { validateProductHtml } from "./validate-html.ts";
import { hasActiveVisualJob, type VisualJobFields } from "./visual-job.ts";

export const STALE_JOB = "STALE_JOB";
export const LOCK_COPY = "Fenix sta creando";
export const EXIT_LABEL = "Torna agli studi";
export const LOCKED_CONTROLS = ["Codice", "Versioni", "Condividi", "Esporta", "Pubblica"] as const;

export type LockSnapshotFiles = { path: string; content: string }[];

export type Lockable = VisualJobFields & {
  html?: string;
  files?: LockSnapshotFiles;
  lastStableHtml?: string;
  lastStableFiles?: LockSnapshotFiles;
  buildEpoch?: number;
  buildLog?: string[];
  error?: string;
};

export function isStudioLocked(p: Lockable | undefined, now = Date.now()): boolean {
  if (!p) return false;
  if (p.status === "building") return true;
  return hasActiveVisualJob(p, now) && p.status !== "ready" && p.status !== "error";
}

export function lockStageLabel(steps: string[] = []): string {
  return BUILD_STAGES[inferStage(steps)] ?? BUILD_STAGES[0];
}

export function captureStableSnapshot(p: Lockable): {
  lastStableHtml?: string;
  lastStableFiles?: LockSnapshotFiles;
} {
  const html = String(p.html || "");
  if (html) {
    const report = validateProductHtml(html, { kind: undefined });
    if (report.syntaxOk) {
      return { lastStableHtml: html, lastStableFiles: p.files };
    }
  }
  if (p.lastStableHtml) {
    return { lastStableHtml: p.lastStableHtml, lastStableFiles: p.lastStableFiles };
  }
  return {};
}

export function restoreStablePatch(p: Lockable | undefined): {
  html?: string;
  files?: LockSnapshotFiles;
} {
  if (!p?.lastStableHtml) return {};
  return p.lastStableFiles
    ? { html: p.lastStableHtml, files: p.lastStableFiles }
    : { html: p.lastStableHtml };
}

export function isCurrentBuild(
  live: { buildEpoch?: number; visualJobId?: string } | undefined,
  epoch: number,
  jobId?: string,
  persisted?: { buildEpoch?: number; visualJobId?: string },
): boolean {
  if (!live) return false;
  if ((live.buildEpoch ?? 0) !== epoch) return false;
  if (jobId && live.visualJobId && live.visualJobId !== jobId) return false;
  if (persisted) {
    if (persisted.buildEpoch != null && persisted.buildEpoch !== epoch) return false;
    if (jobId && persisted.visualJobId && persisted.visualJobId !== jobId) return false;
  }
  return true;
}

export function readPersistedBuild(
  projectId: string,
  read: () => string | null = defaultPersistRead,
): { buildEpoch?: number; visualJobId?: string } | undefined {
  try {
    const raw = read();
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as {
      state?: { projects?: Array<{ id?: string; buildEpoch?: number; visualJobId?: string }> };
    };
    const project = parsed.state?.projects?.find((item) => item.id === projectId);
    if (!project) return undefined;
    return { buildEpoch: project.buildEpoch, visualJobId: project.visualJobId };
  } catch {
    return undefined;
  }
}

function defaultPersistRead(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("officina-projects");
  } catch {
    return null;
  }
}

export function nextBuildEpoch(current?: number): number {
  return (current ?? 0) + 1;
}

/** True when a node may keep focus while the creating lock is up. Back is the only exit. */
export function isLockFocusAllowed(
  target: EventTarget | { closest?: (sel: string) => unknown } | Node | null,
  lockRoot?: { contains(node: Node): boolean } | null,
): boolean {
  if (!target) return false;
  if (lockRoot && typeof (target as Node).nodeType === "number" && lockRoot.contains(target as Node)) {
    return true;
  }
  if (typeof (target as { closest?: unknown }).closest === "function") {
    return Boolean((target as { closest: (sel: string) => unknown }).closest(`[aria-label="${EXIT_LABEL}"]`));
  }
  return false;
}
