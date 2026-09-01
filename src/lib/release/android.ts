import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { androidVersionCode } from "./build-id.ts";
import {
  playCommitInternal,
  playGetInternalTrack,
  playInsertEdit,
  playUploadBundle,
} from "./deploy-api.ts";
import { dispatchOrPoll, shouldDispatchNative } from "./dispatch.ts";
import { missingStoreRecord } from "./ids.ts";
import { materializeAndroid, validateAndroidProject } from "./native.ts";
import { fixtureCommand, runCommand, type CommandRunner } from "./runner.ts";
import { googlePreflight } from "./store-api.ts";
import type { AdapterResult, PersistTrack, StoredReleaseJob, TrackState } from "./types.ts";

function runner(fixture: boolean, override?: CommandRunner): CommandRunner {
  if (override) return override;
  if (fixture) return fixtureCommand;
  return runCommand;
}

export async function runAndroidStep(
  step: TrackState["step"],
  job: StoredReleaseJob,
  track: TrackState,
  persist: PersistTrack,
  opts: {
    fixture: boolean;
    serviceJson: string | null;
    keystorePath?: string;
    keyAlias?: string;
    storePassword?: string;
    keyPassword?: string;
    commands?: CommandRunner;
  },
): Promise<AdapterResult> {
  const fixture = opts.fixture;
  if (shouldDispatchNative("android", step, fixture)) {
    return dispatchOrPoll("android", step, job, track, persist);
  }
  const run = runner(fixture, opts.commands);
  const pkg = job.config.packageName;
  const versionCode = androidVersionCode(job);

  if (step === "preflight") {
    if (missingStoreRecord(pkg)) {
      return {
        ok: false,
        step,
        fixture,
        error: `Manca l'app in Play Console per ${pkg}. Crea il record (ruolo Release Manager) e riprova.`,
      };
    }
    if (!fixture && opts.serviceJson) {
      const check = await googlePreflight(opts.serviceJson, pkg);
      if (!check.ok) return { ok: false, step, fixture: false, error: check.error };
    }
    return { ok: true, step, fixture };
  }

  if (step === "build") {
    const { root, aab } = materializeAndroid(job);
    const manifest = readFileSync(join(root, "app/src/main/AndroidManifest.xml"), "utf8");
    const appGradle = readFileSync(join(root, "app/build.gradle"), "utf8");
    const javaPath = join(root, "app/src/main/java", pkg.split(".").join("/"), "MainActivity.java");
    const valid = validateAndroidProject({
      root,
      packageName: pkg,
      versionCode: Number(versionCode),
      manifest,
      appGradle,
      mainActivity: existsSync(javaPath) ? readFileSync(javaPath, "utf8") : "",
      mainActivityPath: javaPath,
    });
    if (!valid.ok) return { ok: false, step, fixture, error: valid.error };
    if (existsSync(aab)) {
      await persist({ provider: { ...track.provider, aabPath: aab, versionCode } });
      return { ok: true, step, fixture, artifact: aab, reconciled: true };
    }
    await persist({
      provider: {
        ...track.provider,
        aabPath: aab,
        intentId: `${job.id}:android:bundle`,
        inflight: "bundle",
        versionCode,
      },
    });
    const result = await run("gradle", ["bundleRelease"], { cwd: root });
    if (!result.ok) {
      const alt = await run(join(root, "gradlew"), ["bundleRelease"], { cwd: root });
      if (!alt.ok) {
        return {
          ok: false,
          step,
          fixture,
          error: fixture
            ? "AAB di prova non creato."
            : "Gradle bundleRelease non è riuscito. Serve l'SDK Android sul worker di firma.",
        };
      }
    }
    await persist({ provider: { ...track.provider, aabPath: aab, inflight: undefined, versionCode } });
    return { ok: true, step, fixture, artifact: aab };
  }

  if (step === "sign") {
    const aab = track.provider?.aabPath || materializeAndroid(job).aab;
    const signed = aab.replace(/\.aab$/, "-signed.aab");
    if (existsSync(signed)) {
      await persist({
        provider: { ...track.provider, signedAabPath: signed, aabPath: aab },
      });
      return { ok: true, step, fixture, artifact: signed, reconciled: true };
    }
    if (!fixture) {
      if (!opts.keystorePath || !opts.keyAlias || !opts.storePassword || !opts.keyPassword) {
        return {
          ok: false,
          step,
          fixture: false,
          error:
            "Manca il keystore di upload Android sul server (path, alias, store password, key password). Non si inventa un certificato.",
        };
      }
    }
    await persist({ provider: { ...track.provider, inflight: "sign" } });
    const args = fixture
      ? ["-signedjar", signed, aab, opts.keyAlias || "upload"]
      : [
          "-keystore",
          opts.keystorePath!,
          "-storepass",
          opts.storePassword!,
          "-keypass",
          opts.keyPassword!,
          "-signedjar",
          signed,
          aab,
          opts.keyAlias!,
        ];
    const result = await run("jarsigner", args);
    if (!result.ok && !fixture) {
      return {
        ok: false,
        step,
        fixture: false,
        error: "Firma AAB non riuscita. Controlla il keystore sul server.",
      };
    }
    const artifact = existsSync(signed) ? signed : aab;
    await persist({
      provider: {
        ...track.provider,
        signedAabPath: artifact,
        aabPath: aab,
        inflight: undefined,
      },
    });
    return { ok: true, step, fixture, artifact };
  }

  if (step === "upload") {
    if (track.provider?.uploadId) {
      return {
        ok: true,
        step,
        fixture,
        artifact: track.artifact || track.provider.uploadId,
        reconciled: true,
      };
    }
    if (fixture) {
      if (track.provider?.inflight === "upload") {
        const uploadId = `play-internal:${pkg}:${job.id}`;
        await persist({ provider: { ...track.provider, uploadId, inflight: undefined } });
        return { ok: true, step, fixture, artifact: uploadId, reconciled: true };
      }
      await persist({ provider: { ...track.provider, inflight: "upload" } });
      const uploadId = `play-internal:${pkg}:${job.id}`;
      await persist({ provider: { ...track.provider, uploadId, inflight: undefined } });
      return { ok: true, step, fixture, artifact: uploadId };
    }
    if (!opts.serviceJson) {
      return { ok: false, step, fixture: false, error: "Service account Play assente." };
    }
    const aabPath = track.provider?.signedAabPath || track.provider?.aabPath;
    if (!aabPath) return { ok: false, step, fixture: false, error: "AAB assente. Riprendi dalla compilazione." };
    await persist({
      provider: { ...track.provider, versionCode: track.provider?.versionCode || versionCode },
    });
    const expected = track.provider?.versionCode || versionCode;
    if (track.provider?.inflight === "play-commit" && track.provider.editId && expected) {
      const committed = await playCommitInternal(opts.serviceJson, pkg, track.provider.editId, expected);
      if (!committed.ok) return { ok: false, step, fixture: false, error: committed.error };
      const uploadId = `play-internal:${pkg}:${expected}`;
      await persist({
        provider: { ...track.provider, uploadId, inflight: undefined, versionCode: expected },
      });
      return { ok: true, step, fixture: false, artifact: uploadId, reconciled: true };
    }
    const already = await playGetInternalTrack(opts.serviceJson, pkg, expected);
    if (already.ok && already.state === "completed" && already.id) {
      const uploadId = `play-internal:${pkg}:${expected}`;
      await persist({ provider: { ...track.provider, uploadId, versionCode: expected, inflight: undefined } });
      return { ok: true, step, fixture: false, artifact: uploadId, reconciled: true };
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(aabPath));
    } catch {
      return { ok: false, step, fixture: false, error: "AAB non leggibile sul worker." };
    }
    const edit = await playInsertEdit(opts.serviceJson, pkg, track.provider?.editId);
    if (!edit.ok) return { ok: false, step, fixture: false, error: edit.error };
    if (!edit.id) return { ok: false, step, fixture: false, error: "Play Console ha aperto un edit senza id." };
    await persist({
      provider: { ...track.provider, editId: edit.id, inflight: "play-upload", versionCode: expected },
    });
    const uploaded = await playUploadBundle(opts.serviceJson, pkg, edit.id, bytes, expected);
    if (!uploaded.ok) return { ok: false, step, fixture: false, error: uploaded.error };
    if (!uploaded.id) return { ok: false, step, fixture: false, error: "Play Console ha caricato un AAB senza versionCode." };
    await persist({
      provider: {
        ...track.provider,
        editId: edit.id,
        versionCode: uploaded.id,
        inflight: "play-commit",
      },
    });
    const committed = await playCommitInternal(opts.serviceJson, pkg, edit.id, uploaded.id);
    if (!committed.ok) return { ok: false, step, fixture: false, error: committed.error };
    const uploadId = `play-internal:${pkg}:${uploaded.id}`;
    await persist({
      provider: { ...track.provider, uploadId, editId: edit.id, inflight: undefined, versionCode: uploaded.id },
    });
    return { ok: true, step, fixture: false, artifact: uploadId };
  }

  if (step === "processing") {
    if (fixture) return { ok: true, step, fixture };
    if (!opts.serviceJson) {
      return { ok: false, step, fixture: false, error: "Service account Play assente sul processing." };
    }
    const poll = await playGetInternalTrack(opts.serviceJson, pkg, versionCode);
    if (!poll.ok) return { ok: false, step, fixture: false, error: poll.error };
    const state = (poll.state || "").toLowerCase();
    if (state === "draft" || state === "pending" || !poll.id) {
      return { ok: true, step, fixture: false, pending: true };
    }
    return { ok: true, step, fixture: false, artifact: `internal:${pkg}:${versionCode}` };
  }

  if (step === "ready") {
    return { ok: true, step: "ready", fixture, artifact: `internal:${pkg}` };
  }

  return { ok: true, step, fixture };
}
