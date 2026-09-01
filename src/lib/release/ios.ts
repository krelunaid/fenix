import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appleListLatestBuild } from "./deploy-api.ts";
import { missingStoreRecord } from "./ids.ts";
import { materializeIos } from "./native.ts";
import { fixtureCommand, runCommand, type CommandRunner } from "./runner.ts";
import { applePreflight } from "./store-api.ts";
import type { AdapterResult, PersistTrack, StoredReleaseJob, TrackState } from "./types.ts";

function runner(fixture: boolean, override?: CommandRunner): CommandRunner {
  if (override) return override;
  if (fixture) return fixtureCommand;
  return runCommand;
}

export async function runIosStep(
  step: TrackState["step"],
  job: StoredReleaseJob,
  track: TrackState,
  persist: PersistTrack,
  opts: {
    fixture: boolean;
    creds: { issuerId: string; keyId: string; privateKey: string } | null;
    teamId?: string;
    commands?: CommandRunner;
  },
): Promise<AdapterResult> {
  const fixture = opts.fixture;
  const run = runner(fixture, opts.commands);
  const bundle = job.config.bundleId;

  if (step === "preflight") {
    if (missingStoreRecord(bundle)) {
      return {
        ok: false,
        step,
        fixture,
        error: `Manca il record App Store Connect per ${bundle}. Crea l'app in App Store Connect (ruolo App Manager o Admin) e riprova.`,
      };
    }
    if (!fixture && opts.creds) {
      const check = await applePreflight(opts.creds, bundle);
      if (!check.ok) return { ok: false, step, fixture: false, error: check.error };
      if (check.appId) await persist({ provider: { ...track.provider, appId: check.appId } });
    }
    return { ok: true, step, fixture };
  }

  if (step === "build") {
    const { root } = materializeIos(job, opts.teamId);
    const archivePath = join(root, `${bundle}.xcarchive`);
    await persist({ provider: { ...track.provider, archivePath, intentId: `${job.id}:ios:archive` } });
    const result = await run(
      "xcodebuild",
      [
        "-project",
        join(root, "Fenix.xcodeproj"),
        "-scheme",
        "Fenix",
        "-destination",
        "generic/platform=iOS",
        "-archivePath",
        archivePath,
        "archive",
      ],
      { cwd: root },
    );
    if (!result.ok) {
      return {
        ok: false,
        step,
        fixture,
        error: fixture
          ? "Archivio iOS di prova non creato."
          : "xcodebuild archive non è riuscito. Serve un worker macOS con Xcode (ruolo App Manager).",
      };
    }
    return { ok: true, step, fixture, artifact: archivePath };
  }

  if (step === "sign") {
    const root = materializeIos(job, opts.teamId).root;
    const archivePath = track.provider?.archivePath || join(root, `${bundle}.xcarchive`);
    const exportPath = join(root, "export");
    if (!fixture && !opts.teamId) {
      return {
        ok: false,
        step,
        fixture: false,
        error: "Manca il Team ID Apple sul server per esportare l'IPA.",
      };
    }
    await persist({ provider: { ...track.provider, archivePath } });
    const result = await run(
      "xcodebuild",
      [
        "-exportArchive",
        "-archivePath",
        archivePath,
        "-exportPath",
        exportPath,
        "-exportOptionsPlist",
        join(root, "ExportOptions.plist"),
      ],
      { cwd: root },
    );
    if (!result.ok) {
      return {
        ok: false,
        step,
        fixture,
        error: fixture
          ? "Export IPA di prova non creato."
          : "xcodebuild -exportArchive non è riuscito. Controlla certificati e Team ID.",
      };
    }
    const ipaPath = join(exportPath, "Fenix.ipa");
    await persist({ provider: { ...track.provider, ipaPath } });
    return { ok: true, step, fixture, artifact: ipaPath };
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
    if (!fixture && opts.creds && track.provider?.appId && track.provider?.intentId) {
      const existing = await appleListLatestBuild(opts.creds, track.provider.appId);
      if (existing.ok && existing.id) {
        await persist({
          provider: { ...track.provider, uploadId: existing.id, buildId: existing.id },
        });
        return { ok: true, step, fixture: false, artifact: existing.id, reconciled: true };
      }
    }
    const ipaPath = track.provider?.ipaPath;
    if (!ipaPath && !fixture) {
      return { ok: false, step, fixture: false, error: "IPA assente. Riprendi dalla firma." };
    }
    const intent = track.provider?.intentId || `${job.id}:ios:upload`;
    await persist({ provider: { ...track.provider, intentId: intent } });
    if (!fixture && opts.creds) {
      const result = await run("xcrun", [
        "altool",
        "--upload-app",
        "-f",
        ipaPath || "Fenix.ipa",
        "-t",
        "ios",
        "--apiKey",
        opts.creds.keyId,
        "--apiIssuer",
        opts.creds.issuerId,
      ]);
      if (!result.ok) {
        return {
          ok: false,
          step,
          fixture: false,
          error: "Upload TestFlight non riuscito. Nessun secondo invio finché non riprendi.",
        };
      }
    } else {
      const result = await run("xcrun", [
        "altool",
        "--upload-app",
        "-f",
        ipaPath || "Fenix.ipa",
        "-t",
        "ios",
      ]);
      if (!result.ok) {
        return { ok: false, step, fixture, error: "Upload TestFlight di prova non riuscito." };
      }
    }
    const uploadId = `asc:${bundle}:${intent}`;
    await persist({ provider: { ...track.provider, uploadId } });
    return { ok: true, step, fixture, artifact: uploadId };
  }

  if (step === "processing") {
    if (fixture) return { ok: true, step, fixture };
    if (!opts.creds) {
      return { ok: false, step, fixture: false, error: "Chiavi Apple assenti sul processing." };
    }
    const appId = track.provider?.appId;
    if (!appId) return { ok: true, step, fixture: false };
    const poll = await appleListLatestBuild(opts.creds, appId);
    if (!poll.ok) return { ok: false, step, fixture: false, error: poll.error };
    const state = (poll.state || "").toUpperCase();
    if (state === "PROCESSING" || state === "VALIDATING") {
      return { ok: true, step, fixture: false, pending: true, artifact: poll.id };
    }
    if (state === "FAILED" || state === "INVALID") {
      return { ok: false, step, fixture: false, error: "App Store Connect ha rifiutato il build." };
    }
    if (poll.id) await persist({ provider: { ...track.provider, buildId: poll.id } });
    return { ok: true, step, fixture: false, artifact: poll.id };
  }

  if (step === "ready") {
    return { ok: true, step: "ready", fixture, artifact: `testflight:${bundle}` };
  }

  return { ok: true, step, fixture };
}

export function readIpaBytes(path: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(path));
  } catch {
    return null;
  }
}
