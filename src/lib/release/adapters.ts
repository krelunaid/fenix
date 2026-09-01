import { runAndroidStep } from "./android.ts";
import { runIosStep } from "./ios.ts";
import {
  appleConnected,
  appleCredentials,
  appleTeamId,
  androidKeystorePath,
  googleConnected,
  googleServiceAccount,
  netlifyConnected,
  releaseFixtureAllowed,
} from "./secrets.server.ts";
import type { AdapterResult, PersistTrack, Platform, ReleaseStep, StoredReleaseJob, TrackState } from "./types.ts";
import { runWebStep, type WebOwner } from "./web.ts";

export type { AdapterResult } from "./types.ts";
export type { PersistTrack } from "./types.ts";

export type ReleaseAdapter = {
  platform: Platform;
  connected: () => boolean;
  run(
    step: ReleaseStep,
    job: StoredReleaseJob,
    track: TrackState,
    persist: PersistTrack,
  ): Promise<AdapterResult>;
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

export type WebUploadOwner = WebOwner;

export function createWebAdapter(access: WebUploadOwner): ReleaseAdapter {
  return {
    platform: "web",
    connected: netlifyConnected,
    run(step, job, track, persist) {
      return runWebStep(step, job, track, persist, access);
    },
  };
}

export const iosAdapter: ReleaseAdapter = {
  platform: "ios",
  connected: appleConnected,
  run(step, job, track, persist) {
    const creds = appleCredentials();
    const fixture = !creds && releaseFixtureAllowed();
    if (!creds && !fixture) {
      return Promise.resolve({
        ok: false,
        step: "preflight",
        fixture: false,
        error:
          "App Store Connect non è collegato. Sul server servono Issuer ID, Key ID e chiave API .p8 con ruolo App Manager o Admin. Non si incollano nel browser.",
      });
    }
    return runIosStep(step, job, track, persist, {
      fixture,
      creds,
      teamId: appleTeamId() || undefined,
    });
  },
};

export const androidAdapter: ReleaseAdapter = {
  platform: "android",
  connected: googleConnected,
  run(step, job, track, persist) {
    const json = googleServiceAccount();
    const fixture = !json && releaseFixtureAllowed();
    if (!json && !fixture) {
      return Promise.resolve({
        ok: false,
        step: "preflight",
        fixture: false,
        error:
          "Play Console non è collegata. Sul server serve il JSON del service account con ruolo Release Manager. Non si incolla nel browser.",
      });
    }
    return runAndroidStep(step, job, track, persist, {
      fixture,
      serviceJson: json,
      keystorePath: androidKeystorePath() || undefined,
    });
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
