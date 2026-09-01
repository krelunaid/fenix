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
import {
  canTakeLease,
  claimReleaseKey,
  publicReleaseJob,
  readReleaseJob,
  waitReleaseByKey,
  withLease,
  writeReleaseJob,
} from "./store.ts";
import type {
  PersistTrack,
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

/** One key → one job id. Concurrent POSTs cannot mint a second UUID. */
export function jobIdFromKey(key: string): string {
  const h = key.replace(/[^a-f0-9]/gi, "").toLowerCase().padEnd(32, "0").slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function htmlHash(html: string): string {
  return createHash("sha256").update(html).digest("hex").slice(0, 16);
}

/** Only a 32+ hex digest may replace the computed key. UI headers are not keys. */
function asHexKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return /^[a-f0-9]{32,}$/.test(t) ? t : null;
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

function snapTracks(job: StoredReleaseJob): string {
  return job.platforms
    .map((p) => {
      const t = job.tracks[p];
      return `${p}:${t?.step}:${t?.status}:${t?.uploads}:${t?.provider?.uploadId || t?.provider?.deployId || ""}`;
    })
    .join("|");
}

export async function tickReleaseJob(
  job: StoredReleaseJob,
  access: WebUploadOwner,
  leaseToken?: string,
): Promise<StoredReleaseJob> {
  if (job.status === "ok") return job;
  const token = leaseToken || randomUUID();
  let current = withLease(job, token);
  for (const platform of current.platforms) {
    const start = current.tracks[platform] || emptyTrack(platform);
    if (start.status === "ok") continue;
    if (start.status === "err") {
      current.status = "err";
      current.error = start.error;
      current.step = start.step;
      return writeReleaseJob(current);
    }
    const blocked = gatePlatform(platform);
    if (blocked && (start.step === "connect" || start.step === "configure" || start.step === "preflight")) {
      start.status = "err";
      start.error = blocked;
      current.tracks[platform] = start;
      current.status = "err";
      current.error = blocked;
      current.step = "connect";
      appendLog(current, `${platform}: ${blocked}`);
      return writeReleaseJob(current);
    }
    if (start.step === "connect" || start.step === "configure") {
      start.step = "preflight";
      start.status = "run";
      current.tracks[platform] = start;
      current.status = "run";
      appendLog(current, `${platform}: preflight`);
      current = await writeReleaseJob(current);
    }
    const held = current.tracks[platform] || start;
    const persist: PersistTrack = async (patch) => {
      const prev = current.tracks[platform] || held;
      const merged: TrackState = {
        ...prev,
        ...patch,
        provider: { ...prev.provider, ...patch.provider },
      };
      current.tracks[platform] = merged;
      current = withLease(await writeReleaseJob(current), token);
      const saved = current.tracks[platform] || merged;
      Object.assign(held, saved);
      held.provider = { ...saved.provider };
      current.tracks[platform] = held;
      return held;
    };
    const adapter = adapterFor(platform, access);
    const stepNow = held.step;
    let result;
    try {
      result = await adapter.run(stepNow, current, held, persist);
    } catch (err) {
      const message = redactSecrets(err instanceof Error ? err.message : "errore");
      held.status = "err";
      held.error = message;
      current.tracks[platform] = held;
      current.status = "err";
      current.error = message;
      current.step = held.step;
      appendLog(current, `${platform}: ${message}`);
      return writeReleaseJob(current);
    }
    if (!result.ok) {
      held.status = "err";
      held.error = result.error;
      current.tracks[platform] = held;
      current.status = "err";
      current.error = result.error;
      current.step = held.step;
      appendLog(current, `${platform}: ${result.error || "errore"}`);
      return writeReleaseJob(current);
    }
    held.fixture = result.fixture;
    held.artifact = result.artifact || held.artifact;
    if (held.step === "upload" && !result.reconciled) held.uploads += 1;
    if (result.pending) {
      current.tracks[platform] = held;
      current.status = "run";
      current.step = held.step;
      appendLog(current, `${platform}: ${held.step} in attesa del provider`);
      return writeReleaseJob(current);
    }
    const nxt = nextStep(held.step);
    appendLog(
      current,
      `${platform}: ${held.step}${result.fixture ? " (banco di prova)" : ""}${result.reconciled ? " (già fatto)" : ""} → ${nxt}`,
    );
    held.step = nxt;
    if (nxt === "ready") {
      held.status = "ok";
      appendLog(
        current,
        platform === "ios"
          ? `${platform}: TestFlight raggiungibile. La store pubblica resta in review.`
          : platform === "android"
            ? `${platform}: canale internal raggiungibile. La scheda pubblica resta in review.`
            : `${platform}: production Netlify.`,
      );
    } else {
      held.status = "run";
    }
    current.tracks[platform] = held;
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
  leaseToken?: string,
): Promise<StoredReleaseJob> {
  const token = leaseToken || randomUUID();
  let current = job;
  for (let i = 0; i < maxTicks; i++) {
    if (current.status === "ok" || current.status === "err") return current;
    const before = snapTracks(current);
    current = await tickReleaseJob(current, access, token);
    if (current.status === "run" && snapTracks(current) === before) return current;
  }
  return current;
}

async function continueJob(
  job: StoredReleaseJob,
  access: { ownerId: string },
): Promise<PublicReleaseJob | { error: string; status: number }> {
  if (job.ownerHash !== hashOwner(access.ownerId)) {
    return { error: "Non sei il titolare di questo job.", status: 403 };
  }
  const token = randomUUID();
  if (job.status === "ok") return publicReleaseJob(job);
  if (job.status !== "err" && !canTakeLease(job, token)) {
    return publicReleaseJob(job);
  }
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
  }
  const saved = await writeReleaseJob(withLease(job, token));
  const done = await runReleaseToIdle(saved, access, 24, token);
  return publicReleaseJob(done);
}

export async function resumeReleaseJob(
  id: string,
  access: { ownerId: string },
): Promise<PublicReleaseJob | { error: string; status: number }> {
  const job = await readReleaseJob(id);
  if (!job) return { error: "Job non trovato.", status: 404 };
  return continueJob(job, access);
}

const createsInflight = new Map<string, Promise<PublicReleaseJob | { error: string; status: number }>>();

export function resetReleaseCreatesForTest() {
  createsInflight.clear();
}

async function createReleaseJobUnlocked(
  raw: ReleaseInput,
  access: { ownerId: string; idempotencyKey?: string | null },
  key: string,
  parsed: {
    name: string;
    tagline: string;
    kind: string;
    summary: string;
    palette: StoredReleaseJob["palette"];
    html: string;
  },
  platforms: Platform[],
  bundle: string,
  pkg: string,
  siteName: string,
  h: string,
): Promise<PublicReleaseJob | { error: string; status: number }> {
  const ownerHash = hashOwner(access.ownerId);
  const id = jobIdFromKey(key);
  const claim = await claimReleaseKey(key, id);
  if (!claim.won) {
    const existing = (await waitReleaseByKey(key)) || (await readReleaseJob(claim.id));
    if (!existing) return { error: "Job in creazione. Riprova.", status: 409 };
    return continueJob(existing, access);
  }

  const already = await readReleaseJob(id);
  if (already) return continueJob(already, access);

  const tracks = {} as StoredReleaseJob["tracks"];
  for (const p of PLATFORMS) tracks[p] = emptyTrack(p);
  const now = Date.now();
  const token = randomUUID();
  const job: StoredReleaseJob = {
    id,
    projectId: String(raw.projectId || "").trim(),
    ownerHash,
    platforms,
    status: "run",
    step: "connect",
    log: ["Partito. Controllo HTML e record."],
    tracks,
    config: { bundleId: bundle, packageName: pkg, siteName, appName: parsed.name },
    htmlHash: h,
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
    kind: parseKind(parsed.kind) || parsed.kind,
    name: parsed.name,
    tagline: parsed.tagline,
    summary: parsed.summary,
    html: parsed.html,
    palette: parsed.palette,
  };
  const saved = await writeReleaseJob(withLease(job, token));
  const done = await runReleaseToIdle(saved, access, 24, token);
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
  const computed = releaseIdempotencyKey({
    ownerHash,
    projectId,
    platforms,
    htmlHash: h,
    bundleId: bundle,
    packageName: pkg,
  });
  const override = asHexKey(raw.idempotencyKey) || asHexKey(access.idempotencyKey);
  const key = override || computed;

  const pending = createsInflight.get(key);
  if (pending) return pending;
  const work = createReleaseJobUnlocked(
    raw,
    access,
    key,
    parsed,
    platforms,
    bundle,
    pkg,
    siteName,
    h,
  );
  createsInflight.set(key, work);
  try {
    return await work;
  } finally {
    queueMicrotask(() => {
      /* keep resolved promise so a late twin joins */
    });
  }
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
  if (job.status === "run") return continueJob(job, access);
  return publicReleaseJob(job);
}

export function releaseAccounts() {
  return accountsSnapshot();
}
