#!/usr/bin/env node
/**
 * Native release worker. Runs on macOS (iOS/Xcode) or Linux (Android/Gradle).
 * Reads the job from Postgres, executes one step, posts a signed callback.
 * Secrets stay in the runner env. Never log PEM, passwords, or tokens.
 */
import { readReleaseJob, writeReleaseJob } from "../../src/lib/release/store.ts";
import { runIosStep } from "../../src/lib/release/ios.ts";
import { runAndroidStep } from "../../src/lib/release/android.ts";
import { appleCredentials, appleTeamId, androidKeyAlias, androidKeyPassword, androidKeystorePath, androidStorePassword, googleServiceAccount } from "../../src/lib/release/secrets.server.ts";
import { callbackSecret, signReleaseCallback } from "../../src/lib/release/dispatch.ts";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1] || "") : "";
}

const jobId = arg("job");
const platform = arg("platform") || "ios";
const step = arg("step") || "build";
const intent = arg("intent") || `${jobId}:${platform}:${step}`;

if (!jobId) {
  console.error("usage: run.mjs --job <id> --platform ios|android --step <step>");
  process.exit(2);
}

const job = await readReleaseJob(jobId);
if (!job) {
  console.error("job not found");
  process.exit(1);
}

const track = job.tracks[platform] || {
  platform,
  step,
  status: "run",
  fixture: false,
  uploads: 0,
  provider: { intentId: intent },
};

const persist = async (patch) => {
  const next = {
    ...track,
    ...patch,
    provider: { ...track.provider, ...patch.provider },
  };
  Object.assign(track, next);
  job.tracks[platform] = track;
  await writeReleaseJob(job);
  return track;
};

let result;
if (platform === "ios") {
  result = await runIosStep(step, job, track, persist, {
    fixture: false,
    creds: appleCredentials(),
    teamId: appleTeamId() || undefined,
  });
} else {
  result = await runAndroidStep(step, job, track, persist, {
    fixture: false,
    serviceJson: googleServiceAccount(),
    keystorePath: androidKeystorePath() || undefined,
    keyAlias: androidKeyAlias() || undefined,
    storePassword: androidStorePassword() || undefined,
    keyPassword: androidKeyPassword() || undefined,
  });
}

const status = result.ok ? (result.pending ? "run" : "ok") : "err";
const secret = callbackSecret();
const callbackUrl = process.env.FENIX_RELEASE_CALLBACK_URL;
if (secret && callbackUrl) {
  const runId = track.provider?.runId || `gha:${intent}`;
  const signature = signReleaseCallback({ jobId, runId, status, secret });
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
    }),
  });
}

if (!result.ok) {
  console.error(result.error || "worker failed");
  process.exit(1);
}
