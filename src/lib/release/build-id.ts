import type { StoredReleaseJob } from "./types.ts";

/** Unix-seconds of createdAt: monotonic across jobs, deterministic for one job. */
export function buildNumberFromJob(job: Pick<StoredReleaseJob, "createdAt">): number {
  const n = Math.floor(Number(job.createdAt) / 1000);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 2_100_000_000);
}

export function assignBuildNumbers(job: StoredReleaseJob): StoredReleaseJob {
  const n = buildNumberFromJob(job);
  job.config.iosBuildNumber = job.config.iosBuildNumber || String(n);
  job.config.androidVersionCode = job.config.androidVersionCode || n;
  job.config.versionName = job.config.versionName || "1.0";
  return job;
}

export function iosIdentity(job: StoredReleaseJob): { versionName: string; build: string } {
  assignBuildNumbers(job);
  return {
    versionName: job.config.versionName || "1.0",
    build: job.config.iosBuildNumber || String(buildNumberFromJob(job)),
  };
}

export function androidVersionCode(job: StoredReleaseJob): string {
  assignBuildNumbers(job);
  return String(job.config.androidVersionCode || buildNumberFromJob(job));
}
