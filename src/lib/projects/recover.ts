import { canPublishHtml, formatHtmlErrors, validatePublishable } from "./validate-html.ts";
import { isPhoneKind, kindFromPrompt, resolveProjectKind } from "./infer.ts";
import type { BuildStatus, Palette, ProjectKind } from "./types.ts";
import {
  clearVisualJobPatch,
  hasActiveVisualJob,
  type VisualJobStatus,
} from "./visual-job.ts";
import { polishDashboardHtml } from "./dashboard-crud.ts";
import { replaceAppleTabIcons, rewriteIosWidgetHome } from "./craft-icons.ts";

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
  visualJobId?: string;
  visualJobStatus?: VisualJobStatus;
  visualJobStartedAt?: number;
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
  const html = isPhoneKind(kind)
    ? rewriteIosWidgetHome(replaceAppleTabIcons(p.html))
    : kind === "dashboard"
      ? polishDashboardHtml(p.html)
      : p.html;
  const jobLive = hasActiveVisualJob(p, now);

  let status = p.status;
  let error = p.error;
  let visualJobId = p.visualJobId;
  let visualJobStatus = p.visualJobStatus;
  let visualJobStartedAt = p.visualJobStartedAt;

  const dropJob = () => {
    visualJobId = undefined;
    visualJobStatus = undefined;
    visualJobStartedAt = undefined;
  };

  if (p.status === "building" && !p.html) {
    status = "error";
    error = "Interrotto. Riprova.";
    dropJob();
  } else if (p.status === "ready" && !p.html) {
    status = "error";
    error = "HTML assente.";
    dropJob();
  } else if (html && (p.status === "ready" || p.status === "building")) {
    const report = validatePublishable(html, {
      kind,
      projectId: p.id,
      bg: p.palette?.bg,
    });
    if (!report.syntaxOk) {
      status = "error";
      error = formatHtmlErrors(report);
      dropJob();
    } else if (p.status === "building" && jobLive) {
      status = "building";
      error = undefined;
    } else if (p.status === "building" && p.visualJobId && !jobLive) {
      status = "error";
      error = RESUME_ERROR;
      dropJob();
    } else if (p.status === "building" && now - p.updatedAt > STALE_BUILD_MS) {
      status = "error";
      error = RESUME_ERROR;
      dropJob();
    } else if (p.status === "ready" && !report.ok) {
      status = "error";
      error = migrated ? RESUME_ERROR : formatHtmlErrors(report);
      dropJob();
    } else if (migrated && !report.ok) {
      status = "error";
      error = RESUME_ERROR;
      dropJob();
    }
  }

  const cleared = status !== "building" ? clearVisualJobPatch() : {};
  return {
    ...p,
    html,
    kind,
    requestedKind,
    buildLog: p.buildLog ?? [],
    status,
    error,
    visualJobId: status === "building" ? visualJobId : cleared.visualJobId,
    visualJobStatus: status === "building" ? visualJobStatus : cleared.visualJobStatus,
    visualJobStartedAt: status === "building" ? visualJobStartedAt : cleared.visualJobStartedAt,
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
