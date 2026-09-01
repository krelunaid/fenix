import type {
  Project,
  ProjectActivity,
  ProjectActivityKind,
  ProjectActivityOutcome,
} from "./types";

export const MAX_PROJECT_ACTIVITY = 64;
const DEDUPE_MS = 2_000;
const METRIC_KEYS = new Set([
  "credits",
  "files",
  "revisions",
  "rows",
  "durable",
  "version",
  "conflicts",
]);
const ACTIVITY_KINDS = new Set<ProjectActivityKind>([
  "created",
  "build",
  "ready",
  "error",
  "refund",
  "data",
  "restore",
  "branch",
  "merge",
  "publish",
  "export",
  "import",
]);
const PROJECT_KINDS = new Set<Project["kind"]>([
  "landing",
  "app",
  "dashboard",
  "tool",
  "game",
  "site",
]);
const PROJECT_STATUSES = new Set<Project["status"]>([
  "draft",
  "building",
  "ready",
  "error",
]);

export type ActivityInput = {
  kind: ProjectActivityKind;
  outcome?: ProjectActivityOutcome;
  label: string;
  detail?: string;
  metrics?: Record<string, number | undefined>;
  at?: number;
  id?: string;
  dedupe?: string;
};

export type ProjectActivitySummary = {
  events: number;
  ok: number;
  err: number;
  run: number;
  info: number;
  credits: number;
  refunds: number;
};

export type ProjectDiagnostics = {
  schema: "fenix-diagnostics-v1";
  generatedAt: string;
  project: {
    kind: Project["kind"];
    status: Project["status"];
    files: number;
    revisions: number;
  };
  summary: ProjectActivitySummary;
  activity: Array<{
    at: number;
    kind: ProjectActivityKind;
    outcome: ProjectActivityOutcome;
    label: string;
    detail?: string;
    metrics?: ProjectActivity["metrics"];
  }>;
};

function hashText(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Defensive redaction for an evidence log that must be safe to persist and export. */
export function redactActivityText(value: unknown, max = 180): string {
  return String(value ?? "")
    .replace(
      /-----BEGIN[\s\S]{0,80}?PRIVATE KEY-----[\s\S]*?-----END[\s\S]{0,80}?PRIVATE KEY-----/gi,
      "[redacted-private-key]",
    )
    .replace(/\b(?:sk|xai|gh[opurs])-[A-Za-z0-9_-]{8,}\b/g, "[redacted-token]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(
      /\b(api[_ -]?key|authorization|password|secret|token)\b\s*[:=]\s*["']?[^\s,"'}]+/gi,
      "$1=[redacted]",
    )
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeMetrics(input?: Record<string, number | undefined>): ProjectActivity["metrics"] {
  if (!input) return undefined;
  const entries: [string, number][] = Object.entries(input)
    .flatMap(([key, value]): [string, number][] =>
      METRIC_KEYS.has(key) && Number.isFinite(value)
        ? [[key, Math.min(1_000_000_000, Math.max(0, Math.round(value!)))]]
        : [],
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? (Object.fromEntries(entries) as ProjectActivity["metrics"]) : undefined;
}

export function appendProjectActivity(project: Project, input: ActivityInput): Project {
  const at = Number.isFinite(input.at) ? Math.max(0, Math.round(input.at!)) : Date.now();
  const label = redactActivityText(input.label, 80) || "Attività";
  const detail = redactActivityText(input.detail, 180) || undefined;
  const outcome = input.outcome ?? "info";
  const metrics = safeMetrics(input.metrics);
  const key = redactActivityText(input.dedupe, 80) || `${input.kind}:${label}`;
  const previous = [...(project.activity ?? [])];
  const last = previous[previous.length - 1];
  const next: ProjectActivity = {
    id:
      redactActivityText(input.id, 80) ||
      `a-${at.toString(36)}-${hashText(`${key}:${detail || ""}`)}`,
    at,
    kind: input.kind,
    outcome,
    label,
    ...(detail ? { detail } : {}),
    ...(metrics ? { metrics } : {}),
  };
  if (
    last &&
    at >= last.at &&
    at - last.at <= DEDUPE_MS &&
    (input.dedupe
      ? last.id.endsWith(hashText(`${key}:${last.detail || ""}`))
      : last.kind === input.kind && last.label === label)
  ) {
    previous[previous.length - 1] = next;
  } else {
    previous.push(next);
  }
  return { ...project, activity: previous.slice(-MAX_PROJECT_ACTIVITY) };
}

export function listProjectActivity(project: Pick<Project, "activity">): ProjectActivity[] {
  return [...(project.activity ?? [])].sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
}

export function summarizeProjectActivity(
  project: Pick<Project, "activity">,
): ProjectActivitySummary {
  const summary: ProjectActivitySummary = {
    events: 0,
    ok: 0,
    err: 0,
    run: 0,
    info: 0,
    credits: 0,
    refunds: 0,
  };
  for (const item of project.activity ?? []) {
    summary.events += 1;
    const outcome: ProjectActivityOutcome =
      item.outcome === "ok" || item.outcome === "err" || item.outcome === "run"
        ? item.outcome
        : "info";
    summary[outcome] += 1;
    const credits = Number(item.metrics?.credits ?? 0);
    if (Number.isFinite(credits) && credits > 0) {
      summary.credits += Math.round(credits);
      if (item.kind === "refund") summary.refunds += Math.round(credits);
    }
  }
  return summary;
}

/**
 * Portable operational evidence for support and audits. It deliberately omits
 * project identity, name, prompt, messages, HTML, files, data and worker ids.
 */
export function projectDiagnostics(
  project: Pick<
    Project,
    "kind" | "status" | "html" | "files" | "revisions" | "activity"
  >,
  now = Date.now(),
): ProjectDiagnostics {
  const generatedAt = new Date(Number.isFinite(now) ? Math.max(0, now) : 0).toISOString();
  const activity = listProjectActivity(project).map((item) => {
    const label = redactActivityText(item.label, 80) || "Attività";
    const detail = redactActivityText(item.detail, 180) || undefined;
    const metrics = safeMetrics(item.metrics);
    const kind: ProjectActivityKind = ACTIVITY_KINDS.has(item.kind) ? item.kind : "error";
    const outcome: ProjectActivityOutcome =
      item.outcome === "ok" || item.outcome === "err" || item.outcome === "run"
        ? item.outcome
        : "info";
    return {
      at: Number.isFinite(item.at) ? Math.max(0, Math.round(item.at)) : 0,
      kind,
      outcome,
      label,
      ...(detail ? { detail } : {}),
      ...(metrics ? { metrics } : {}),
    };
  });
  return {
    schema: "fenix-diagnostics-v1",
    generatedAt,
    project: {
      kind: PROJECT_KINDS.has(project.kind) ? project.kind : "app",
      status: PROJECT_STATUSES.has(project.status) ? project.status : "error",
      files: project.files?.length ?? (project.html ? 1 : 0),
      revisions: project.revisions?.length ?? 0,
    },
    summary: summarizeProjectActivity({ activity: project.activity }),
    activity,
  };
}

export function serializeProjectDiagnostics(
  project: Parameters<typeof projectDiagnostics>[0],
  now = Date.now(),
): string {
  return `${JSON.stringify(projectDiagnostics(project, now), null, 2)}\n`;
}

export function formatActivityAge(at: number, now = Date.now()): string {
  const delta = Math.max(0, now - at);
  if (delta < 60_000) return "ora";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min fa`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(at);
}

export function activityHasOnlySafeKeys(item: ProjectActivity): boolean {
  const keys = Object.keys(item).sort();
  const allowed = ["at", "detail", "id", "kind", "label", "metrics", "outcome"];
  return (
    keys.every((key) => allowed.includes(key)) &&
    !/prompt|message|job|html|files|secret/i.test(keys.join(" "))
  );
}
