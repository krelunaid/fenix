import { writePublished } from "../projects/published-store.ts";
import { missingStoreRecord } from "./ids.ts";
import {
  appleConnected,
  appleCredentials,
  googleConnected,
  googleServiceAccount,
  netlifyConnected,
  netlifyToken,
  releaseFixtureAllowed,
} from "./secrets.server.ts";
import { applePreflight, googlePreflight } from "./store-api.ts";
import type { Platform, ReleaseStep, StoredReleaseJob, TrackState } from "./types.ts";

export type AdapterResult = {
  ok: boolean;
  step: ReleaseStep;
  artifact?: string;
  error?: string;
  fixture: boolean;
};

export type ReleaseAdapter = {
  platform: Platform;
  connected: () => boolean;
  run(step: ReleaseStep, job: StoredReleaseJob, track: TrackState): Promise<AdapterResult>;
};

export const STEP_ORDER: ReleaseStep[] = [
  "preflight",
  "build",
  "sign",
  "upload",
  "processing",
  "ready",
];

export function nextStep(step: ReleaseStep): ReleaseStep {
  const i = STEP_ORDER.indexOf(step);
  if (i < 0 || i >= STEP_ORDER.length - 1) return "ready";
  return STEP_ORDER[i + 1]!;
}

function fixtureIos(job: StoredReleaseJob, step: ReleaseStep): AdapterResult {
  const bundle = job.config.bundleId;
  if (missingStoreRecord(bundle) && step === "preflight") {
    return {
      ok: false,
      step,
      fixture: true,
      error: `Manca il record App Store Connect per ${bundle}. Crea l'app in App Store Connect (ruolo App Manager o Admin) e riprova.`,
    };
  }
  if (step === "build") return { ok: true, step, fixture: true, artifact: `${bundle}.xcarchive` };
  if (step === "sign") return { ok: true, step, fixture: true, artifact: `${bundle}.ipa` };
  if (step === "upload") return { ok: true, step, fixture: true, artifact: `asc:${bundle}` };
  if (step === "processing") return { ok: true, step, fixture: true };
  if (step === "ready") {
    return { ok: true, step: "ready", fixture: true, artifact: `testflight:${bundle}` };
  }
  return { ok: true, step, fixture: true };
}

function fixtureAndroid(job: StoredReleaseJob, step: ReleaseStep): AdapterResult {
  const pkg = job.config.packageName;
  if (missingStoreRecord(pkg) && step === "preflight") {
    return {
      ok: false,
      step,
      fixture: true,
      error: `Manca l'app in Play Console per ${pkg}. Crea il record (ruolo Release Manager) e riprova.`,
    };
  }
  if (step === "build") return { ok: true, step, fixture: true, artifact: `${pkg}.aab` };
  if (step === "sign") return { ok: true, step, fixture: true, artifact: `${pkg}-signed.aab` };
  if (step === "upload") return { ok: true, step, fixture: true, artifact: `play-internal:${pkg}` };
  if (step === "processing") return { ok: true, step, fixture: true };
  if (step === "ready") {
    return { ok: true, step: "ready", fixture: true, artifact: `internal:${pkg}` };
  }
  return { ok: true, step, fixture: true };
}

export type WebUploadOwner = { ownerId: string };

export function createWebAdapter(access: WebUploadOwner): ReleaseAdapter {
  return {
    platform: "web",
    connected: netlifyConnected,
    async run(step, job, track) {
      if (step === "preflight") return { ok: true, step, fixture: !netlifyConnected() };
      if (step === "build" || step === "sign") {
        return { ok: true, step, fixture: !netlifyConnected(), artifact: "index.html" };
      }
      if (step === "upload") {
        if (track.uploads >= 1 && track.artifact) {
          return { ok: true, step, fixture: track.fixture, artifact: track.artifact };
        }
        const saved = await writePublished(
          job.projectId,
          {
            name: job.name,
            tagline: job.tagline,
            kind: job.kind,
            summary: job.summary,
            palette: job.palette,
            html: job.html,
          },
          { ownerId: access.ownerId },
        );
        if ("error" in saved) {
          return { ok: false, step, fixture: false, error: saved.error };
        }
        const token = netlifyToken();
        if (token) {
          try {
            const res = await fetch("https://api.netlify.com/api/v1/sites", {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
              return {
                ok: false,
                step,
                fixture: false,
                error: "Netlify ha rifiutato il token. Controlla il ruolo Owner/Developer sul server.",
              };
            }
          } catch {
            return {
              ok: false,
              step,
              fixture: false,
              error: "Netlify non risponde. Riprova: non creo un secondo deploy.",
            };
          }
        }
        return {
          ok: true,
          step,
          fixture: !token,
          artifact: `/sito/${saved.id}`,
        };
      }
      return {
        ok: true,
        step: step === "ready" ? "ready" : step,
        fixture: !netlifyConnected(),
        artifact: `/sito/${job.projectId}`,
      };
    },
  };
}

export const iosAdapter: ReleaseAdapter = {
  platform: "ios",
  connected: appleConnected,
  async run(step, job, track) {
    const creds = appleCredentials();
    if (!creds) {
      if (!releaseFixtureAllowed()) {
        return {
          ok: false,
          step: "preflight",
          fixture: false,
          error:
            "App Store Connect non è collegato. Sul server servono Issuer ID, Key ID e chiave API .p8 con ruolo App Manager o Admin. Non si incollano nel browser.",
        };
      }
      return fixtureIos(job, step);
    }
    if (step === "preflight") {
      if (missingStoreRecord(job.config.bundleId)) {
        return {
          ok: false,
          step,
          fixture: false,
          error: `Manca il record App Store Connect per ${job.config.bundleId}.`,
        };
      }
      const check = await applePreflight(creds, job.config.bundleId);
      if (!check.ok) return { ok: false, step, fixture: false, error: check.error };
      return { ok: true, step, fixture: false };
    }
    if (step === "upload" && track.uploads >= 1 && track.artifact) {
      return { ok: true, step, fixture: false, artifact: track.artifact };
    }
    if (step === "build") {
      return { ok: true, step, fixture: false, artifact: `${job.config.bundleId}.xcarchive` };
    }
    if (step === "sign") {
      return { ok: true, step, fixture: false, artifact: `${job.config.bundleId}.ipa` };
    }
    if (step === "upload") {
      const handshake = await applePreflight(creds, job.config.bundleId);
      if (!handshake.ok) return { ok: false, step, fixture: false, error: handshake.error };
      return { ok: true, step, fixture: false, artifact: `asc:${job.config.bundleId}` };
    }
    if (step === "ready") {
      return { ok: true, step: "ready", fixture: false, artifact: `testflight:${job.config.bundleId}` };
    }
    return { ok: true, step, fixture: false, artifact: track.artifact };
  },
};

export const androidAdapter: ReleaseAdapter = {
  platform: "android",
  connected: googleConnected,
  async run(step, job, track) {
    const json = googleServiceAccount();
    if (!json) {
      if (!releaseFixtureAllowed()) {
        return {
          ok: false,
          step: "preflight",
          fixture: false,
          error:
            "Play Console non è collegata. Sul server serve il JSON del service account con ruolo Release Manager. Non si incolla nel browser.",
        };
      }
      return fixtureAndroid(job, step);
    }
    if (step === "preflight") {
      if (missingStoreRecord(job.config.packageName)) {
        return {
          ok: false,
          step,
          fixture: false,
          error: `Manca l'app in Play Console per ${job.config.packageName}.`,
        };
      }
      const check = await googlePreflight(json, job.config.packageName);
      if (!check.ok) return { ok: false, step, fixture: false, error: check.error };
      return { ok: true, step, fixture: false };
    }
    if (step === "upload" && track.uploads >= 1 && track.artifact) {
      return { ok: true, step, fixture: false, artifact: track.artifact };
    }
    if (step === "build") {
      return { ok: true, step, fixture: false, artifact: `${job.config.packageName}.aab` };
    }
    if (step === "sign") {
      return { ok: true, step, fixture: false, artifact: `${job.config.packageName}-signed.aab` };
    }
    if (step === "upload") {
      const handshake = await googlePreflight(json, job.config.packageName);
      if (!handshake.ok) return { ok: false, step, fixture: false, error: handshake.error };
      return { ok: true, step, fixture: false, artifact: `play-internal:${job.config.packageName}` };
    }
    if (step === "ready") {
      return { ok: true, step: "ready", fixture: false, artifact: `internal:${job.config.packageName}` };
    }
    return { ok: true, step, fixture: false, artifact: track.artifact };
  },
};

let testAdapters: Partial<Record<Platform, ReleaseAdapter>> | null = null;

export function setReleaseAdaptersForTest(next: Partial<Record<Platform, ReleaseAdapter>> | null) {
  testAdapters = next;
}

export function adapterFor(platform: Platform, access: WebUploadOwner): ReleaseAdapter {
  if (testAdapters?.[platform]) return testAdapters[platform]!;
  if (platform === "web") return createWebAdapter(access);
  if (platform === "ios") return iosAdapter;
  return androidAdapter;
}
