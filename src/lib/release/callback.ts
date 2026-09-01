import { createHash } from "node:crypto";
import { nextStep, STEP_ORDER } from "./steps.ts";
import { verifyReleaseCallback } from "./dispatch.ts";
import { readReleaseJob, writeReleaseJobIfStep } from "./store.ts";
import type { Platform, ProviderIds, ReleaseStep, StoredReleaseJob, TrackState } from "./types.ts";
import { PLATFORMS } from "./types.ts";

export const CALLBACK_MAX_AGE_MS = 15 * 60 * 1000;

export type ReleaseCallbackBody = {
  jobId: string;
  platform: Platform;
  step: ReleaseStep;
  runId: string;
  status: "ok" | "err" | "run";
  artifact?: string;
  error?: string;
  ts: number;
  artifactHash: string;
  workflowRunId?: string;
  signature: string;
  secret: string;
};

export function artifactHashOf(artifact?: string | null): string {
  return createHash("sha256")
    .update(String(artifact || ""), "utf8")
    .digest("hex");
}

export function isPlatform(value: unknown): value is Platform {
  return (PLATFORMS as readonly string[]).includes(String(value || ""));
}

export function isReleaseStep(value: unknown): value is ReleaseStep {
  return (STEP_ORDER as readonly string[]).includes(String(value || "")) ||
    value === "connect" ||
    value === "configure";
}

function stepIndex(step: ReleaseStep): number {
  const i = STEP_ORDER.indexOf(step);
  return i < 0 ? -1 : i;
}

export function runIdMatches(track: TrackState, body: Pick<ReleaseCallbackBody, "runId" | "workflowRunId">): boolean {
  const intent = track.provider?.intentId || "";
  const storedRun = track.provider?.runId || "";
  const storedWf = track.provider?.workflowRunId || "";
  const runId = String(body.runId || "");
  const wf = String(body.workflowRunId || "");
  if (!runId) return false;
  if (intent && (runId === intent || runId === `gha:${intent}`)) return true;
  if (storedRun && runId === storedRun) return true;
  if (storedWf && (runId === storedWf || wf === storedWf)) return true;
  if (wf && storedWf && wf === storedWf) return true;
  if (wf && !storedWf && (runId === intent || runId === storedRun || runId === `gha:${intent}`)) return true;
  return false;
}

export type CallbackApply =
  | { ok: true; applied: boolean; ignored?: "replay" | "stale" | "mismatch" | "pending" }
  | { ok: false; error: string; status: number };

function patchTrack(job: StoredReleaseJob, platform: Platform, track: TrackState): StoredReleaseJob {
  job.tracks[platform] = track;
  job.updatedAt = Date.now();
  if (track.status === "err") {
    job.status = "err";
    job.error = track.error;
    job.step = track.step;
  } else {
    const steps = job.platforms.map((p) => job.tracks[p]?.step || "connect");
    const order = ["connect", "configure", ...STEP_ORDER];
    let minI = order.length;
    let min: ReleaseStep = "ready";
    for (const s of steps) {
      const i = order.indexOf(s);
      if (i >= 0 && i < minI) {
        minI = i;
        min = s as ReleaseStep;
      }
    }
    job.step = min;
    const allOk = job.platforms.every((p) => job.tracks[p]?.status === "ok");
    job.status = allOk ? "ok" : "run";
    if (allOk) job.step = "ready";
  }
  return job;
}

export function decideCallback(job: StoredReleaseJob, body: ReleaseCallbackBody): CallbackApply & { track?: TrackState } {
  if (Math.abs(Date.now() - Number(body.ts || 0)) > CALLBACK_MAX_AGE_MS) {
    return { ok: false, error: "Callback scaduta.", status: 401 };
  }
  const expectedHash = artifactHashOf(body.artifact);
  if (body.artifactHash && body.artifactHash !== expectedHash) {
    return { ok: false, error: "Hash artifact non valido.", status: 401 };
  }
  if (
    !verifyReleaseCallback({
      jobId: body.jobId,
      platform: body.platform,
      step: body.step,
      runId: body.runId,
      status: body.status,
      artifactHash: body.artifactHash || expectedHash,
      ts: body.ts,
      signature: body.signature,
      secret: body.secret,
    })
  ) {
    return { ok: false, error: "Firma callback non valida.", status: 401 };
  }
  const track = job.tracks[body.platform];
  if (!track) return { ok: false, error: "Piattaforma assente nel job.", status: 400 };
  if (!runIdMatches(track, body)) {
    return { ok: true, applied: false, ignored: "mismatch", track };
  }
  const currentI = stepIndex(track.step);
  const bodyI = stepIndex(body.step);
  if (bodyI < 0) return { ok: true, applied: false, ignored: "stale", track };
  if (currentI > bodyI) return { ok: true, applied: false, ignored: "replay", track };
  if (track.step !== body.step) return { ok: true, applied: false, ignored: "stale", track };
  return { ok: true, applied: true, track };
}

export function applyCallbackToJob(job: StoredReleaseJob, body: ReleaseCallbackBody, track: TrackState): StoredReleaseJob {
  const provider: ProviderIds = {
    ...track.provider,
    runId: track.provider?.runId || body.runId,
    workflowRunId: body.workflowRunId || track.provider?.workflowRunId,
  };
  if (body.status === "run") {
    track.provider = { ...provider, inflight: track.provider?.inflight || "dispatch" };
    if (body.artifact) track.artifact = body.artifact;
    return patchTrack(job, body.platform, track);
  }
  if (body.status === "err") {
    track.status = "err";
    track.error = body.error || "Worker native fallito.";
    track.provider = { ...provider, inflight: undefined };
    if (body.artifact) track.artifact = body.artifact;
    return patchTrack(job, body.platform, track);
  }
  track.artifact = body.artifact || track.artifact;
  track.error = undefined;
  track.provider = { ...provider, inflight: undefined };
  const nxt = nextStep(body.step);
  track.step = nxt;
  if (body.step === "upload") track.uploads = Math.max(track.uploads, 1);
  track.status = nxt === "ready" ? "ok" : "run";
  return patchTrack(job, body.platform, track);
}

export async function applyReleaseCallback(body: ReleaseCallbackBody): Promise<CallbackApply> {
  const job = await readReleaseJob(body.jobId);
  if (!job) return { ok: false, error: "Job non trovato.", status: 404 };
  const decision = decideCallback(job, body);
  if (!decision.ok) return decision;
  if (!decision.applied) return { ok: true, applied: false, ignored: decision.ignored };
  const next = applyCallbackToJob(job, body, decision.track!);
  const written = await writeReleaseJobIfStep(next, body.platform, body.step);
  if (!written.applied) {
    const again = decideCallback(written.saved, body);
    const ignored = again.ok ? again.ignored || "replay" : "replay";
    return { ok: true, applied: false, ignored };
  }
  return { ok: true, applied: true };
}
