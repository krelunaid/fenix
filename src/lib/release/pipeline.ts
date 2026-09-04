import type { IosP12 } from "./apple-key.ts";
import { runAndroidStep } from "./android.ts";
import { runIosStep } from "./ios.ts";
import { isNativePipelineStep, nextStep } from "./steps.ts";
import type { AdapterResult, PersistTrack, ReleaseStep, StoredReleaseJob, TrackState } from "./types.ts";

export { isNativePipelineStep, nativePipelineIntent, NATIVE_PIPELINE_STEPS } from "./steps.ts";

export type NativePipelineOpts = {
  fixture: boolean;
  ios?: {
    creds: { issuerId: string; keyId: string; privateKey: string } | null;
    teamId?: string;
    p12?: IosP12;
  };
  android?: {
    serviceJson: string | null;
    keystorePath?: string;
    keystoreBase64?: string;
    keyAlias?: string;
    storePassword?: string;
    keyPassword?: string;
  };
};

export type NativePipelineHooks = {
  onStep?: (step: ReleaseStep, result: AdapterResult, track: TrackState) => Promise<void> | void;
};

/**
 * Run build → sign → upload on THIS runner. If a later step is requested but
 * the local artifact is missing (ephemeral runner B), restart from build.
 */
export async function runNativePipeline(
  platform: "ios" | "android",
  job: StoredReleaseJob,
  track: TrackState,
  persist: PersistTrack,
  opts: NativePipelineOpts,
  hooks?: NativePipelineHooks,
): Promise<AdapterResult> {
  let step: ReleaseStep = isNativePipelineStep(track.step) ? track.step : "build";
  if (platform === "ios") {
    const archiveOk = Boolean(track.provider?.archivePath);
    const ipaOk = Boolean(track.provider?.ipaPath);
    if (step === "sign" && !archiveOk) step = "build";
    if (step === "upload" && !ipaOk) step = archiveOk ? "sign" : "build";
  } else {
    const aabOk = Boolean(track.provider?.aabPath);
    const signedOk = Boolean(track.provider?.signedAabPath);
    if (step === "sign" && !aabOk) step = "build";
    if (step === "upload" && !signedOk) step = aabOk ? "sign" : "build";
  }
  let last: AdapterResult = { ok: true, step, fixture: opts.fixture };
  while (isNativePipelineStep(step)) {
    track.step = step;
    track.status = "run";
    await persist({ step, status: "run" });
    last =
      platform === "ios"
        ? await runIosStep(step, job, track, persist, {
            fixture: opts.fixture,
            creds: opts.ios?.creds || null,
            teamId: opts.ios?.teamId,
            p12: opts.ios?.p12,
            local: true,
          })
        : await runAndroidStep(step, job, track, persist, {
            fixture: opts.fixture,
            serviceJson: opts.android?.serviceJson || null,
            keystorePath: opts.android?.keystorePath,
            keystoreBase64: opts.android?.keystoreBase64,
            keyAlias: opts.android?.keyAlias,
            storePassword: opts.android?.storePassword,
            keyPassword: opts.android?.keyPassword,
            local: true,
          });
    await hooks?.onStep?.(step, last, track);
    if (!last.ok) return last;
    if (last.pending) return last;
    const nxt = nextStep(step);
    track.step = nxt;
    track.status = nxt === "ready" ? "ok" : "run";
    track.artifact = last.artifact || track.artifact;
    await persist({
      step: nxt,
      status: track.status,
      artifact: track.artifact,
      provider: { ...track.provider, inflight: undefined },
    });
    if (!isNativePipelineStep(nxt)) return { ...last, step: nxt };
    step = nxt;
  }
  return last;
}
