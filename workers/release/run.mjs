#!/usr/bin/env node
/**
 * Native release worker. Runs the full iOS or Android FSM (build → sign → upload)
 * on THIS runner, persists provider IDs after each side effect, posts signed callbacks.
 * Secrets stay in the runner env. Never log PEM, passwords, or tokens.
 */
import { artifactHashOf } from "../../src/lib/release/callback.ts";
import { callbackSecret, signReleaseCallback } from "../../src/lib/release/dispatch.ts";
import { runNativePipeline } from "../../src/lib/release/pipeline.ts";
import {
  androidKeyAlias,
  androidKeyPassword,
  androidKeystoreBase64,
  androidKeystorePath,
  androidStorePassword,
  appleCredentials,
  appleDistributionP12,
  appleTeamId,
  googleServiceAccount,
} from "../../src/lib/release/secrets.server.ts";
import { readReleaseJob, writeReleaseJob } from "../../src/lib/release/store.ts";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1] || "") : "";
}

const jobId = arg("job");
const platform = arg("platform") || "ios";
const intent = arg("intent") || `${jobId}:${platform}:native`;
const workflowRunId = process.env.GITHUB_RUN_ID && /^\d+$/.test(process.env.GITHUB_RUN_ID)
  ? process.env.GITHUB_RUN_ID
  : undefined;

if (!jobId) {
  console.error("usage: run.mjs --job <id> --platform ios|android --intent <intent>");
  process.exit(2);
}

const job = await readReleaseJob(jobId);
if (!job) {
  console.error("job not found");
  process.exit(1);
}

const track = job.tracks[platform] || {
  platform,
  step: "build",
  status: "run",
  fixture: false,
  uploads: 0,
  provider: { intentId: intent },
};
track.provider = {
  ...track.provider,
  intentId: track.provider?.intentId || intent,
  runId: track.provider?.runId || `gha:${intent}`,
  workflowRunId: workflowRunId || track.provider?.workflowRunId,
};

const persist = async (patch) => {
  const live = (await readReleaseJob(jobId)) || job;
  const prev = live.tracks[platform] || track;
  const next = {
    ...prev,
    ...patch,
    provider: { ...prev.provider, ...patch.provider },
  };
  Object.assign(track, next);
  track.provider = { ...next.provider };
  live.tracks[platform] = track;
  Object.assign(job, live);
  job.tracks[platform] = track;
  await writeReleaseJob(live);
  return track;
};

await persist({
  provider: {
    ...track.provider,
    intentId: intent,
    runId: track.provider.runId || `gha:${intent}`,
    workflowRunId: workflowRunId || track.provider.workflowRunId,
  },
});

async function sendCallback(step, result) {
  const secret = callbackSecret();
  const callbackUrl = process.env.FENIX_RELEASE_CALLBACK_URL;
  if (!secret || !callbackUrl) return;
  const status = result.ok ? (result.pending ? "run" : "ok") : "err";
  const runId = track.provider?.runId || `gha:${intent}`;
  const ts = Date.now();
  const artifactHash = artifactHashOf(result.artifact);
  const signature = signReleaseCallback({
    jobId,
    platform,
    step,
    runId,
    status,
    artifactHash,
    ts,
    secret,
  });
  await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-fenix-release-signature": `sha256=${signature}`,
    },
    body: JSON.stringify({
      jobId,
      runId,
      platform,
      step,
      status,
      artifact: result.artifact,
      error: result.error,
      ts,
      artifactHash,
      workflowRunId: workflowRunId || track.provider?.workflowRunId,
    }),
  });
}

const result = await runNativePipeline(
  platform === "android" ? "android" : "ios",
  job,
  track,
  persist,
  platform === "android"
    ? {
        fixture: false,
        android: {
          serviceJson: googleServiceAccount(),
          keystorePath: androidKeystorePath() || undefined,
          keystoreBase64: androidKeystoreBase64() || undefined,
          keyAlias: androidKeyAlias() || undefined,
          storePassword: androidStorePassword() || undefined,
          keyPassword: androidKeyPassword() || undefined,
        },
      }
    : {
        fixture: false,
        ios: {
          creds: appleCredentials(),
          teamId: appleTeamId() || undefined,
          p12: appleDistributionP12() || undefined,
        },
      },
  { onStep: sendCallback },
);

if (!result.ok) {
  console.error(result.error || "worker failed");
  process.exit(1);
}
