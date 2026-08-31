import { canPublishHtml, formatHtmlErrors, validatePublishable } from "./validate-html.ts";
import { kindFromPrompt, resolveProjectKind } from "./infer.ts";
import type { BuildStatus, Palette, ProjectKind } from "./types.ts";

export const STALE_BUILD_MS = 120_000;
export const RESUME_ERROR = "Rifinitura interrotta. Tocca Riprendi rifinitura.";

export type Recoverable = {
  id: string;
  status: BuildStatus;
  html: string;
  kind: ProjectKind;
  error?: string;
  updatedAt: number;
  buildLog?: string[];
  palette?: Palette;
  prompt?: string;
  requestedKind?: ProjectKind;
};

/** Solo resumePolish/runBuild (finishPolish) possono promuovere a ready. Mai lo stale. */
export function recoverPersistedProject<T extends Recoverable>(p: T, now = Date.now()): T {
  const kind = resolveProjectKind({
    stored: p.kind,
    requested: p.requestedKind,
    prompt: p.prompt,
  });
  const requestedKind = p.requestedKind ?? kindFromPrompt(p.prompt) ?? kind;
  const migrated = kind !== p.kind;

  let status = p.status;
  let error = p.error;
  if (p.status === "building" && !p.html) {
    status = "error";
    error = "Interrotto. Riprova.";
  } else if (p.status === "ready" && !p.html) {
    status = "error";
    error = "HTML assente.";
  } else if (p.html && (p.status === "ready" || p.status === "building")) {
    const report = validatePublishable(p.html, {
      kind,
      projectId: p.id,
      bg: p.palette?.bg,
    });
    if (!report.syntaxOk) {
      status = "error";
      error = formatHtmlErrors(report);
    } else if (p.status === "building" && now - p.updatedAt > STALE_BUILD_MS) {
      status = "error";
      error = RESUME_ERROR;
    } else if (p.status === "ready" && !report.ok) {
      status = "error";
      error = migrated ? RESUME_ERROR : formatHtmlErrors(report);
    } else if (migrated && !report.ok) {
      status = "error";
      error = RESUME_ERROR;
    }
  }
  return {
    ...p,
    kind,
    requestedKind,
    buildLog: p.buildLog ?? [],
    status,
    error,
  };
}

export function isPublishable(project: {
  status: string;
  html?: string;
  kind?: string;
  id?: string;
  prompt?: string;
  requestedKind?: string;
}) {
  if (project.status !== "ready" || !project.html) return false;
  const kind = resolveProjectKind({
    stored: project.kind as ProjectKind | undefined,
    requested: project.requestedKind as ProjectKind | undefined,
    prompt: project.prompt,
  });
  return canPublishHtml(project.html, kind, project.id ?? "preview");
}

export function needsResume(project: { html?: string; status?: string; error?: string }) {
  return Boolean(project.html && /riprendi/i.test(project.error || ""));
}
