import { createHash, randomUUID } from "node:crypto";
import { hashOwner } from "../projects/published-store.ts";
import { isPublishedId, parsePublishInput } from "../projects/published.ts";
import { adapterFor, nextStep, STEP_ORDER, type WebUploadOwner } from "./adapters.ts";
import {
  suggestedBundleId,
  suggestedPackageName,
  validateBundleId,
  validatePackageName,
} from "./ids.ts";
import { accountsSnapshot, gateHtml, gatePlatform, parseKind } from "./preflight.ts";
import { redactSecrets } from "./redact.ts";
import { publicReleaseJob, readReleaseByKey, readReleaseJob, writeReleaseJob } from "./store.ts";
import type {
  Platform,
  PublicReleaseJob,
  ReleaseInput,
  ReleaseStep,
  StoredReleaseJob,
  TrackState,
} from "./types.ts";
import { PLATFORMS } from "./types.ts";

function asPlatforms(value: unknown): Platform[] {
  const list = Array.isArray(value) ? value : ["web"];
  const out: Platform[] = [];
  for (const item of list) {
    const p = String(item || "").toLowerCase();
    if ((PLATFORMS as readonly string[]).includes(p) && !out.includes(p as Platform)) {
      out.push(p as Platform);
    }
  }
  return out.length ? out : ["web"];
}

function emptyTrack(platform: Platform): TrackState {
  return {
    platform,
    step: "connect",
    status: "queued",
    fixture: false,
    uploads: 0,
  };
}

export function releaseIdempotencyKey(parts: {
  ownerHash: string;
  projectId: string;
  platforms: Platform[];
  htmlHash: string;
  bundleId: string;
  packageName: string;
}): string {
  const text = [
    parts.ownerHash,
    parts.projectId,
    [...parts.platforms].sort().join(","),
    parts.htmlHash,
    parts.bundleId,
    parts.packageName,
  ].join("|");
  return createHash("sha256").update(text).digest("hex");
}

function htmlHash(html: string): string {
  return createHash("sha256").update(html).digest("hex").slice(0, 16);
}

function appendLog(job: StoredReleaseJob, line: string) {
  const text = redactSecrets(line).trim();
  if (!text) return;
  if (job.log[job.log.length - 1] === text) return;
  job.log.push(text);
}

function jobStep(job: StoredReleaseJob): ReleaseStep {
  const steps = job.platforms.map((p) => job.tracks[p]?.step || "connect");
  const order = ["connect", "configure", "preflight", ...STEP_ORDER];
  let min: ReleaseStep = "ready";
  let minI = order.length;
  for (const s of steps) {
    const i = order.indexOf(s);
    if (i >= 0 && i < minI) {
      minI = i;
      min = s as ReleaseStep;
    }
  }
  return min;
}

export async function tickReleaseJob(
  job: StoredReleaseJob,
  access: WebUploadOwner,
): Promise<StoredReleaseJob> {
  if (job.status === "ok") return job;
  let current = job;
  for (const platform of current.platforms) {
    const track = current.tracks[platform] || emptyTrack(platform);
    if (track.status === "ok") continue;
    if (track.status === "err") {
      current.status = "err";
      current.error = track.error;
      current.step = track.step;
      return writeReleaseJob(current);
    }
    const blocked = gatePlatform(platform);
    if (blocked && (track.step === "connect" || track.step === "configure" || track.step === "preflight")) {
      track.status = "err";
      track.error = blocked;
      current.tracks[platform] = track;
      current.status = "err";
      current.error = blocked;
      current.step = "connect";
      appendLog(current, `${platform}: ${blocked}`);
      return writeReleaseJob(current);
    }
    if (track.step === "connect" || track.step === "configure") {
      track.step = "preflight";
      track.status = "run";
      current.tracks[platform] = track;
      current.status = "run";
      appendLog(current, `${platform}: preflight`);
      current = await writeReleaseJob(current);
    }
    const adapter = adapterFor(platform, access);
    const running = current.tracks[platform]!;
    const result = await adapter.run(running.step, current, running);
    if (!result.ok) {
      running.status = "err";
      running.error = result.error;
      current.tracks[platform] = running;
      current.status = "err";
      current.error = result.error;
      current.step = running.step;
      appendLog(current, `${platform}: ${result.error || "errore"}`);
      return writeReleaseJob(current);
    }
    running.fixture = result.fixture;
    running.artifact = result.artifact || running.artifact;
    if (running.step === "upload") running.uploads += 1;
    const nxt = nextStep(running.step);
    appendLog(
      current,
      `${platform}: ${running.step}${result.fixture ? " (banco di prova)" : ""} → ${nxt}`,
    );
    running.step = nxt;
    if (nxt === "ready") {
      running.status = "ok";
      appendLog(
        current,
        platform === "ios"
          ? `${platform}: TestFlight raggiungibile. La store pubblica resta in review.`
          : platform === "android"
            ? `${platform}: canale internal raggiungibile. La scheda pubblica resta in review.`
            : `${platform}: production Netlify.`,
      );
    } else {
      running.status = "run";
    }
    current.tracks[platform] = running;
    current.status = "run";
    current.step = jobStep(current);
    current = await writeReleaseJob(current);
  }
  const allOk = current.platforms.every((p) => current.tracks[p]?.status === "ok");
  if (allOk) {
    current.status = "ok";
    current.step = "ready";
    current.error = undefined;
    appendLog(current, "Tutte le piattaforme scelte sono pronte.");
    current = await writeReleaseJob(current);
  }
  return current;
}

export async function runReleaseToIdle(
  job: StoredReleaseJob,
  access: WebUploadOwner,
  maxTicks = 24,
): Promise<StoredReleaseJob> {
  let current = job;
  for (let i = 0; i < maxTicks; i++) {
    if (current.status === "ok" || current.status === "err") return current;
    current = await tickReleaseJob(current, access);
  }
  return current;
}

export async function resumeReleaseJob(
  id: string,
  access: { ownerId: string },
): Promise<PublicReleaseJob | { error: string; status: number }> {
  const job = await readReleaseJob(id);
  if (!job) return { error: "Job non trovato.", status: 404 };
  if (job.ownerHash !== hashOwner(access.ownerId)) {
    return { error: "Non sei il titolare di questo job.", status: 403 };
  }
  if (job.status === "ok") return publicReleaseJob(job);
  if (job.status === "err") {
    for (const p of job.platforms) {
      const t = job.tracks[p];
      if (t?.status === "err") {
        t.status = "run";
        t.error = undefined;
        if (t.step === "ready") t.step = "upload";
        job.tracks[p] = t;
      }
    }
    job.status = "run";
    job.error = undefined;
    appendLog(job, "Riprendo dall'ultimo passo riuscito. Nessun secondo upload se è già andato.");
    const saved = await writeReleaseJob(job);
    const done = await runReleaseToIdle(saved, access);
    return publicReleaseJob(done);
  }
  const done = await runReleaseToIdle(job, access);
  return publicReleaseJob(done);
}

export async function createReleaseJob(
  raw: ReleaseInput,
  access: { ownerId: string; idempotencyKey?: string | null },
): Promise<PublicReleaseJob | { error: string; status: number }> {
  const ownerHash = hashOwner(access.ownerId);
  const parsed = parsePublishInput({
    name: raw.name,
    tagline: raw.tagline,
    kind: raw.kind,
    summary: raw.summary,
    palette: raw.palette,
    html: raw.html,
  });
  if ("error" in parsed) return { error: parsed.error, status: 400 };
  const kind = parseKind(parsed.kind) || parsed.kind;
  const projectId = String(raw.projectId || "").trim();
  if (!isPublishedId(projectId)) return { error: "Identità progetto non valida.", status: 400 };
  const htmlGate = gateHtml(parsed.html, kind, projectId, parsed.palette);
  if (!htmlGate.ok) return { error: htmlGate.error, status: 422 };
  const platforms = asPlatforms(raw.platforms);
  const bundle =
    typeof raw.bundleId === "string" && raw.bundleId.trim()
      ? validateBundleId(raw.bundleId)
      : suggestedBundleId(parsed.name);
  if (typeof bundle !== "string") return { error: bundle.error, status: 400 };
  const pkg =
    typeof raw.packageName === "string" && raw.packageName.trim()
      ? validatePackageName(raw.packageName)
      : suggestedPackageName(parsed.name);
  if (typeof pkg !== "string") return { error: pkg.error, status: 400 };
  const siteName =
    typeof raw.siteName === "string" && raw.siteName.trim()
      ? raw.siteName.trim().slice(0, 80)
      : parsed.name;
  const h = htmlHash(parsed.html);
  const key =
    (typeof raw.idempotencyKey === "string" && raw.idempotencyKey.trim().length >= 16
      ? raw.idempotencyKey.trim().toLowerCase()
      : null) ||
    (access.idempotencyKey && access.idempotencyKey.trim().length >= 16
      ? access.idempotencyKey.trim().toLowerCase()
      : null) ||
    releaseIdempotencyKey({
      ownerHash,
      projectId,
      platforms,
      htmlHash: h,
      bundleId: bundle,
      packageName: pkg,
    });

  const existing = await readReleaseByKey(key);
  if (existing && existing.ownerHash === ownerHash) {
    if (existing.status === "ok" || existing.status === "run") {
      const live = existing.status === "run" ? await runReleaseToIdle(existing, access) : existing;
      return publicReleaseJob(live);
    }
    if (existing.status === "err") {
      return resumeReleaseJob(existing.id, access);
    }
  }

  const tracks = {} as StoredReleaseJob["tracks"];
  for (const p of PLATFORMS) tracks[p] = emptyTrack(p);
  const now = Date.now();
  const job: StoredReleaseJob = {
    id: randomUUID(),
    projectId,
    ownerHash,
    platforms,
    status: "queued",
    step: "connect",
    log: ["Partito. Controllo HTML e record."],
    tracks,
    config: { bundleId: bundle, packageName: pkg, siteName, appName: parsed.name },
    htmlHash: h,
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
    kind,
    name: parsed.name,
    tagline: parsed.tagline,
    summary: parsed.summary,
    html: parsed.html,
    palette: parsed.palette,
  };
  const saved = await writeReleaseJob(job);
  const done = await runReleaseToIdle(saved, access);
  return publicReleaseJob(done);
}

export async function loadReleaseJob(
  id: string,
  access: { ownerId: string },
): Promise<PublicReleaseJob | { error: string; status: number }> {
  const job = await readReleaseJob(id);
  if (!job) return { error: "Job non trovato.", status: 404 };
  if (job.ownerHash !== hashOwner(access.ownerId)) {
    return { error: "Non sei il titolare di questo job.", status: 403 };
  }
  if (job.status === "run") {
    const done = await runReleaseToIdle(job, access);
    return publicReleaseJob(done);
  }
  return publicReleaseJob(job);
}

export function releaseAccounts() {
  return accountsSnapshot();
}
