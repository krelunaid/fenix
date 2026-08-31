import { canPublishHtml, formatHtmlErrors, validatePublishable } from "./validate-html.ts";
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
};

/** Solo resumePolish/runBuild (finishPolish) possono promuovere a ready. Mai lo stale. */
export function recoverPersistedProject<T extends Recoverable>(p: T, now = Date.now()): T {
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
      kind: p.kind,
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
      error = formatHtmlErrors(report);
    }
  }
  return {
    ...p,
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
}) {
  if (project.status !== "ready" || !project.html) return false;
  return canPublishHtml(project.html, project.kind, project.id ?? "preview");
}

export function needsResume(project: { html?: string; status?: string; error?: string }) {
  return Boolean(project.html && /riprendi/i.test(project.error || ""));
}
