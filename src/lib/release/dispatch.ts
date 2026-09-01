import { createHmac, timingSafeEqual } from "node:crypto";
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
};

export type NativeDispatcher = {
  dispatch(req: DispatchRequest): Promise<{ ok: boolean; runId?: string; error?: string }>;
  poll(runId: string): Promise<DispatchPoll>;
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

export function signReleaseCallback(parts: {
  jobId: string;
  runId: string;
  status: string;
  secret: string;
}): string {
  return createHmac("sha256", parts.secret)
    .update(`${parts.jobId}:${parts.runId}:${parts.status}`)
    .digest("hex");
}

export function verifyReleaseCallback(parts: {
  jobId: string;
  runId: string;
  status: string;
  signature: string;
  secret: string;
}): boolean {
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

export function githubDispatcher(): NativeDispatcher | null {
  const token =
    process.env.FENIX_RELEASE_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  const repo = process.env.FENIX_RELEASE_GITHUB_REPO?.trim() || process.env.GITHUB_REPOSITORY?.trim() || "";
  if (!token || !repo || !repo.includes("/")) return null;
  return {
    async dispatch(req) {
      const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFor(req.platform)}/dispatches`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: process.env.FENIX_RELEASE_GITHUB_REF || "main",
          inputs: {
            job_id: req.jobId,
            platform: req.platform,
            step: req.step,
            intent_id: req.intentId,
          },
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Dispatch worker ${res.status}.` };
      }
      return { ok: true, runId: `gha:${req.intentId}` };
    },
    async poll(runId) {
      const intent = runId.replace(/^gha:/, "");
      const url = `https://api.github.com/repos/${repo}/actions/runs?per_page=20`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) return { status: "run", runId };
      const body = (await res.json().catch(() => ({}))) as {
        workflow_runs?: { name?: string; status?: string; conclusion?: string; id?: number }[];
      };
      const run = (body.workflow_runs || []).find((r) => (r.name || "").includes(intent));
      if (!run) return { status: "queued", runId };
      if (run.status === "completed" && run.conclusion === "success") return { status: "ok", runId };
      if (run.status === "completed") {
        return { status: "err", runId, error: `Worker ${run.conclusion || "failed"}.` };
      }
      return { status: "run", runId };
    },
  };
}

function dispatcher(): NativeDispatcher | null {
  if (testDispatcher) return testDispatcher;
  return githubDispatcher();
}

export async function dispatchOrPoll(
  platform: Platform,
  step: ReleaseStep,
  job: StoredReleaseJob,
  track: TrackState,
  persist: PersistTrack,
): Promise<AdapterResult> {
  const intent = track.provider?.intentId || `${job.id}:${platform}:${step}`;
  const runId = track.provider?.runId || `gha:${intent}`;
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
  if (track.provider?.inflight === "dispatch" && track.provider.runId) {
    const poll = await d.poll(track.provider.runId);
    if (poll.status === "ok") {
      await persist({
        provider: { ...track.provider, inflight: undefined, runId: poll.runId || track.provider.runId },
      });
      return { ok: true, step, fixture: false, artifact: poll.artifact, reconciled: true };
    }
    if (poll.status === "err") {
      return { ok: false, step, fixture: false, error: poll.error || "Worker native fallito." };
    }
    return { ok: true, step, fixture: false, pending: true, artifact: track.artifact };
  }
  await persist({
    provider: { ...track.provider, intentId: intent, runId, inflight: "dispatch" },
  });
  const sent = await d.dispatch({
    jobId: job.id,
    platform,
    step,
    intentId: intent,
    callbackUrl: process.env.FENIX_RELEASE_CALLBACK_URL,
  });
  if (!sent.ok) return { ok: false, step, fixture: false, error: sent.error || "Dispatch worker fallito." };
  await persist({
    provider: {
      ...track.provider,
      intentId: intent,
      runId: sent.runId || runId,
      inflight: "dispatch",
    },
  });
  return { ok: true, step, fixture: false, pending: true };
}
