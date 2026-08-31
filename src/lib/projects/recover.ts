import { canPublishHtml, formatHtmlErrors, validatePublishable } from "./validate-html.ts";
import { isPhoneKind, kindFromPrompt, resolveProjectKind } from "./infer.ts";
import type { BuildStatus, Palette, ProjectKind } from "./types.ts";
import {
  clearVisualJobPatch,
  dropLiveJobLogs,
  hasActiveVisualJob,
  isJobSentinelError,
  uniqueLogs,
  type VisualJobStatus,
} from "./visual-job.ts";
import { polishDashboardHtml, shouldRepairDashboard } from "./dashboard-crud.ts";
import { replaceAppleTabIcons, rewriteIosWidgetHome, stripPhoneChromeFromSite, ensureMainElementId } from "./craft-icons.ts";
import { repairLeakedCss } from "./color-scheme.ts";

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

function htmlRecoveryError(
  html: string,
  kind: ProjectKind,
  projectId: string,
  bg?: string,
): string | undefined {
  const report = validatePublishable(html, { kind, projectId, bg });
  if (report.ok) return undefined;
  return formatHtmlErrors(report) || undefined;
}

/** Solo resumePolish/runBuild (finishPolish) possono promuovere a ready. Mai lo stale. */
export function recoverPersistedProject<T extends Recoverable>(p: T, now = Date.now()): T {
  const kind = resolveProjectKind({
    stored: p.kind,
    requested: p.requestedKind,
    prompt: p.prompt,
  });
  const requestedKind = p.requestedKind ?? kindFromPrompt(p.prompt) ?? kind;
  const migrated = kind !== p.kind;
  // Never rewrite building/error HTML: overlay and Riprendi must see the persisted fixture.
  let html = p.html;
  if (p.status === "ready" && p.html) {
    html = repairLeakedCss(
      ensureMainElementId(
        isPhoneKind(kind)
          ? rewriteIosWidgetHome(replaceAppleTabIcons(p.html))
          : shouldRepairDashboard(p.html, kind)
            ? polishDashboardHtml(p.html, kind)
            : kind === "site" || kind === "landing"
              ? stripPhoneChromeFromSite(p.html)
              : p.html,
      ),
    );
  }
  const jobLive = hasActiveVisualJob(p, now);

  let status = p.status;
  let error = p.error;
  let visualJobId = p.visualJobId;
  let visualJobStatus = p.visualJobStatus;
  let visualJobStartedAt = p.visualJobStartedAt;
  let buildLog = uniqueLogs(p.buildLog ?? []);

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
  } else if (html && jobLive && p.visualJobId && p.status !== "ready") {
    const report = validatePublishable(html, {
      kind,
      projectId: p.id,
      bg: p.palette?.bg,
    });
    if (report.syntaxOk) {
      status = "building";
      error = undefined;
    } else {
      status = "error";
      error = formatHtmlErrors(report);
      dropJob();
    }
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

  if (status === "error") {
    dropJob();
    if (isJobSentinelError(error) || !String(error || "").trim()) {
      const fromHtml = html ? htmlRecoveryError(html, kind, p.id, p.palette?.bg) : undefined;
      error = fromHtml || (html ? RESUME_ERROR : "Interrotto. Riprova.");
    }
    if (p.visualJobId || isJobSentinelError(p.error)) {
      buildLog = dropLiveJobLogs(buildLog);
    }
  }

  const cleared = status !== "building" ? clearVisualJobPatch() : {};
  return {
    ...p,
    html,
    kind,
    requestedKind,
    buildLog,
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
