import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  playCommitInternal,
  playGetInternalTrack,
  playInsertEdit,
  playUploadBundle,
} from "./deploy-api.ts";
import { missingStoreRecord } from "./ids.ts";
import { materializeAndroid } from "./native.ts";
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
    commands?: CommandRunner;
  },
): Promise<AdapterResult> {
  const fixture = opts.fixture;
  const run = runner(fixture, opts.commands);
  const pkg = job.config.packageName;

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
    if (existsSync(aab)) {
      await persist({ provider: { ...track.provider, aabPath: aab } });
      return { ok: true, step, fixture, artifact: aab, reconciled: true };
    }
    await persist({
      provider: { ...track.provider, aabPath: aab, intentId: `${job.id}:android:bundle`, inflight: "bundle" },
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
    await persist({ provider: { ...track.provider, aabPath: aab, inflight: undefined } });
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
    if (!fixture && !opts.keystorePath) {
      return {
        ok: false,
        step,
        fixture: false,
        error: "Manca il keystore di upload Android sul server. Non si inventa un certificato.",
      };
    }
    await persist({ provider: { ...track.provider, inflight: "sign" } });
    const result = await run("jarsigner", ["-signedjar", signed, aab, "upload"]);
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
    if (
      track.provider?.inflight === "play-commit" &&
      track.provider.editId &&
      track.provider.versionCode
    ) {
      const committed = await playCommitInternal(
        opts.serviceJson,
        pkg,
        track.provider.editId,
        track.provider.versionCode,
      );
      if (!committed.ok) return { ok: false, step, fixture: false, error: committed.error };
      const uploadId = `play-internal:${pkg}:${track.provider.editId}`;
      await persist({
        provider: { ...track.provider, uploadId, inflight: undefined },
      });
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
    await persist({ provider: { ...track.provider, editId: edit.id, inflight: "play-upload" } });
    const uploaded = await playUploadBundle(
      opts.serviceJson,
      pkg,
      edit.id,
      bytes,
      track.provider?.versionCode,
    );
    if (!uploaded.ok) return { ok: false, step, fixture: false, error: uploaded.error };
    if (!uploaded.id) return { ok: false, step, fixture: false, error: "Play Console ha caricato un AAB senza versionCode." };
    await persist({
      provider: { ...track.provider, editId: edit.id, versionCode: uploaded.id, inflight: "play-commit" },
    });
    const committed = await playCommitInternal(opts.serviceJson, pkg, edit.id, uploaded.id);
    if (!committed.ok) return { ok: false, step, fixture: false, error: committed.error };
    const uploadId = `play-internal:${pkg}:${edit.id}`;
    await persist({
      provider: { ...track.provider, uploadId, editId: edit.id, inflight: undefined },
    });
    return { ok: true, step, fixture: false, artifact: uploadId };
  }

  if (step === "processing") {
    if (fixture) return { ok: true, step, fixture };
    if (!opts.serviceJson) {
      return { ok: false, step, fixture: false, error: "Service account Play assente sul processing." };
    }
    const poll = await playGetInternalTrack(opts.serviceJson, pkg);
    if (!poll.ok) return { ok: false, step, fixture: false, error: poll.error };
    const state = (poll.state || "").toLowerCase();
    if (state === "draft" || state === "pending") {
      return { ok: true, step, fixture: false, pending: true };
    }
    return { ok: true, step, fixture: false, artifact: `internal:${pkg}` };
  }

  if (step === "ready") {
    return { ok: true, step: "ready", fixture, artifact: `internal:${pkg}` };
  }

  return { ok: true, step, fixture };
}
