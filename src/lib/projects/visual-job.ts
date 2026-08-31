import type { BuildStatus } from "./types.ts";

/** Worker keeps finished jobs ~30 min. Stop treating one as live before that. */
export const VISUAL_JOB_TTL_MS = 20 * 60 * 1000;
export const JOB_STILL_RUNNING = "JOB_STILL_RUNNING";

export type VisualJobStatus = "run" | "ok" | "err";

export type VisualJobFields = {
  visualJobId?: string;
  visualJobStatus?: VisualJobStatus;
  visualJobStartedAt?: number;
  status?: BuildStatus;
  updatedAt?: number;
};

export function hasActiveVisualJob(p: VisualJobFields, now = Date.now()): boolean {
  const id = p.visualJobId?.trim();
  if (!id) return false;
  if (p.visualJobStatus && p.visualJobStatus !== "run") return false;
  const started = p.visualJobStartedAt || p.updatedAt || 0;
  if (!started) return true;
  return now - started < VISUAL_JOB_TTL_MS;
}

export function isJobSentinelError(error?: string): boolean {
  return /\bJOB_STILL_RUNNING\b/.test(String(error || ""));
}

const LIVE_JOB_LOG =
  /^(Partito|In coda|Motore visivo ancora in corso|Motore visivo in sottofondo)$/i;

export function dropLiveJobLogs(log: string[] = []): string[] {
  return log.filter((s) => !LIVE_JOB_LOG.test(String(s).trim()));
}

export function visualJobPatch(
  id: string,
  status: VisualJobStatus = "run",
  startedAt?: number,
): VisualJobFields {
  return {
    visualJobId: id,
    visualJobStatus: status,
    visualJobStartedAt: startedAt ?? Date.now(),
  };
}

export function clearVisualJobPatch(): VisualJobFields {
  return {
    visualJobId: undefined,
    visualJobStatus: undefined,
    visualJobStartedAt: undefined,
  };
}
