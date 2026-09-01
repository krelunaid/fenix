import { runAndroidStep } from "./android.ts";
import { runIosStep } from "./ios.ts";
import {
  appleConnected,
  appleCredentials,
  appleDistributionP12,
  appleTeamId,
  androidKeyAlias,
  androidKeyPassword,
  androidKeystoreBase64,
  androidKeystorePath,
  androidStorePassword,
  googleConnected,
  googleServiceAccount,
  netlifyConnected,
  releaseFixtureAllowed,
} from "./secrets.server.ts";
import { nextStep, STEP_ORDER } from "./steps.ts";
import type { AdapterResult, PersistTrack, Platform, ReleaseStep, StoredReleaseJob, TrackState } from "./types.ts";
import { runWebStep, type WebOwner } from "./web.ts";

export type { AdapterResult } from "./types.ts";
export type { PersistTrack } from "./types.ts";
export { nextStep, STEP_ORDER };

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
      p12: appleDistributionP12() || undefined,
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
      keystoreBase64: androidKeystoreBase64() || undefined,
      keyAlias: androidKeyAlias() || undefined,
      storePassword: androidStorePassword() || undefined,
      keyPassword: androidKeyPassword() || undefined,
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
