import { createHmac, timingSafeEqual } from "node:crypto";
import { isNativePipelineStep, nativePipelineIntent } from "./steps.ts";
import { readReleaseJob } from "./store.ts";
import type { AdapterResult, PersistTrack, Platform, ReleaseStep, StoredReleaseJob, TrackState } from "./types.ts";

export type DispatchRequest = {
  jobId: string;
  platform: Platform;
  step: ReleaseStep;
  intentId: string;
  callbackUrl?: string;
};

export type DispatchPoll = {
  status: "queued" | "run" | "ok" | "err";
  artifact?: string;
  error?: string;
  runId?: string;
  workflowRunId?: string;
};

export type NativeDispatcher = {
  dispatch(req: DispatchRequest): Promise<{
    ok: boolean;
    runId?: string;
    workflowRunId?: string;
    error?: string;
  }>;
  poll(runId: string): Promise<DispatchPoll>;
};

export type CallbackSignParts = {
  jobId: string;
  platform: string;
  step: string;
  runId: string;
  status: string;
  artifactHash: string;
  ts: number;
  secret: string;
};

let testDispatcher: NativeDispatcher | null = null;

export function setNativeDispatcherForTest(d: NativeDispatcher | null) {
  testDispatcher = d;
}

export function shouldDispatchNative(
  platform: Platform,
  step: ReleaseStep,
  fixture: boolean,
): boolean {
  if (fixture) return false;
  if (platform === "web") return false;
  if (step !== "build" && step !== "sign" && step !== "upload") return false;
  if (process.env.FENIX_RELEASE_WORKER === platform) return false;
  if (process.env.FENIX_NATIVE_DISPATCH === "0") return false;
  if (process.env.NETLIFY || process.env.FENIX_NATIVE_DISPATCH === "1") return true;
  return false;
}

export function callbackSecret(): string | null {
  const s = process.env.FENIX_RELEASE_CALLBACK_SECRET?.trim() || "";
  return s.length >= 16 ? s : null;
}

export function callbackCanonical(parts: Omit<CallbackSignParts, "secret">): string {
  return [
    parts.jobId,
    parts.platform,
    parts.step,
    parts.runId,
    parts.status,
    parts.artifactHash,
    String(parts.ts),
  ].join("\n");
}

export function signReleaseCallback(parts: CallbackSignParts): string {
  return createHmac("sha256", parts.secret).update(callbackCanonical(parts)).digest("hex");
}

export function verifyReleaseCallback(
  parts: CallbackSignParts & { signature: string },
): boolean {
  const expected = signReleaseCallback(parts);
  const got = String(parts.signature || "").replace(/^sha256=/i, "");
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(got, "utf8"));
  } catch {
    return false;
  }
}

function workflowFor(platform: Platform): string {
  return platform === "ios" ? "release-ios.yml" : "release-android.yml";
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

type GhRun = {
  name?: string;
  display_title?: string;
  status?: string;
  conclusion?: string;
  id?: number;
};

function runMatchesIntent(run: GhRun, intent: string): boolean {
  const name = `${run.name || ""} ${run.display_title || ""}`;
  return Boolean(intent) && name.includes(intent);
}

function pollFromRun(run: GhRun, fallbackId: string): DispatchPoll {
  const workflowRunId = run.id ? String(run.id) : undefined;
  const runId = workflowRunId || fallbackId;
  if (run.status === "completed" && run.conclusion === "success") {
    return { status: "ok", runId, workflowRunId };
  }
  if (run.status === "completed") {
    return { status: "err", runId, workflowRunId, error: `Worker ${run.conclusion || "failed"}.` };
  }
  if (run.status === "queued" || run.status === "pending") {
    return { status: "queued", runId, workflowRunId };
  }
  return { status: "run", runId, workflowRunId };
}

export function githubDispatcher(): NativeDispatcher | null {
  const token =
    process.env.FENIX_RELEASE_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  const repo = process.env.FENIX_RELEASE_GITHUB_REPO?.trim() || process.env.GITHUB_REPOSITORY?.trim() || "";
  if (!token || !repo || !repo.includes("/")) return null;

  async function findRun(intent: string, workflowRunId?: string): Promise<GhRun | null> {
    if (workflowRunId && /^\d+$/.test(workflowRunId)) {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${workflowRunId}`, {
        headers: ghHeaders(token),
      });
      if (res.ok) return (await res.json().catch(() => null)) as GhRun | null;
    }
    const url = `https://api.github.com/repos/${repo}/actions/runs?event=workflow_dispatch&per_page=30`;
    const res = await fetch(url, { headers: ghHeaders(token) });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { workflow_runs?: GhRun[] };
    return (body.workflow_runs || []).find((r) => runMatchesIntent(r, intent)) || null;
  }

  return {
    async dispatch(req) {
      const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFor(req.platform)}/dispatches`;
      const res = await fetch(url, {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: process.env.FENIX_RELEASE_GITHUB_REF || "main",
          inputs: {
            job_id: req.jobId,
            platform: req.platform,
            step: "pipeline",
            intent_id: req.intentId,
          },
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Dispatch worker ${res.status}.` };
      }
      const found = await findRun(req.intentId);
      const workflowRunId = found?.id ? String(found.id) : undefined;
      return { ok: true, runId: `gha:${req.intentId}`, workflowRunId };
    },
    async poll(runId) {
      const intent = runId.replace(/^gha:/, "");
      const numeric = /^\d+$/.test(runId) ? runId : undefined;
      const found = await findRun(intent, numeric);
      if (!found) return { status: "queued", runId };
      return pollFromRun(found, runId);
    },
  };
}

function dispatcher(): NativeDispatcher | null {
  if (testDispatcher) return testDispatcher;
  return githubDispatcher();
}

export function pipelineAlreadyDispatched(track: TrackState): boolean {
  return track.provider?.inflight === "dispatch" || Boolean(track.provider?.runId);
}

export async function dispatchOrPoll(
  platform: Platform,
  step: ReleaseStep,
  job: StoredReleaseJob,
  track: TrackState,
  persist: PersistTrack,
): Promise<AdapterResult> {
  const intent = track.provider?.intentId || nativePipelineIntent(job.id, platform);
  const d = dispatcher();
  if (!d) {
    return {
      ok: false,
      step,
      fixture: false,
      error:
        platform === "ios"
          ? "Serve un worker macOS (GitHub Actions macos-latest o runner Xcode). Vedi workers/release/README.md."
          : "Serve un worker Linux con JDK e Android SDK. Vedi workers/release/README.md.",
    };
  }

  const pollId = track.provider?.workflowRunId || track.provider?.runId || "";

  if (pipelineAlreadyDispatched(track) && pollId) {
    const poll = await d.poll(pollId);
    const live = (await readReleaseJob(job.id)) || job;
    const liveTrack = live.tracks[platform] || track;
    const workflowRunId = poll.workflowRunId || liveTrack.provider?.workflowRunId;
    if (poll.status === "ok") {
      const stillNative = isNativePipelineStep(liveTrack.step);
      await persist({
        provider: {
          ...liveTrack.provider,
          runId: liveTrack.provider?.runId || poll.runId || pollId,
          workflowRunId,
          inflight: stillNative ? "dispatch" : undefined,
        },
      });
      if (stillNative && liveTrack.step !== step) {
        return {
          ok: true,
          step,
          fixture: false,
          pending: true,
          artifact: liveTrack.artifact,
        };
      }
      return {
        ok: true,
        step,
        fixture: false,
        artifact: poll.artifact || liveTrack.artifact,
        reconciled: true,
      };
    }
    if (poll.status === "err") {
      await persist({
        provider: {
          ...liveTrack.provider,
          inflight: undefined,
          runId: "",
          workflowRunId: workflowRunId || liveTrack.provider?.workflowRunId,
        },
      });
      return { ok: false, step, fixture: false, error: poll.error || "Worker native fallito." };
    }
    if (workflowRunId && workflowRunId !== track.provider?.workflowRunId) {
      await persist({
        provider: {
          ...track.provider,
          intentId: intent,
          inflight: "dispatch",
          runId: track.provider?.runId,
          workflowRunId,
        },
      });
    }
    return { ok: true, step, fixture: false, pending: true, artifact: liveTrack.artifact };
  }

  await persist({
    provider: { ...track.provider, intentId: intent, inflight: "dispatch" },
  });
  const sent = await d.dispatch({
    jobId: job.id,
    platform,
    step: "build",
    intentId: intent,
    callbackUrl: process.env.FENIX_RELEASE_CALLBACK_URL,
  });
  if (!sent.ok) {
    await persist({
      provider: { ...track.provider, intentId: intent, inflight: undefined },
    });
    return { ok: false, step, fixture: false, error: sent.error || "Dispatch worker fallito." };
  }
  await persist({
    provider: {
      ...track.provider,
      intentId: intent,
      runId: sent.runId || `gha:${intent}`,
      workflowRunId: sent.workflowRunId,
      inflight: "dispatch",
    },
  });
  return { ok: true, step, fixture: false, pending: true };
}
