import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { redactSecrets } from "./redact.ts";

export type RunResult = { ok: boolean; code: number; stdout: string; stderr: string };

export type CommandRunner = (
  file: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
) => Promise<RunResult>;

let customRunner: CommandRunner | null = null;

export function setReleaseCommandRunnerForTest(fn: CommandRunner | null) {
  customRunner = fn;
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Deterministic stand-in for xcodebuild / gradle / altool when credentials are absent. */
export async function fixtureCommand(
  file: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
): Promise<RunResult> {
  const base = file.split(/[/\\]/).pop() || file;
  const cwd = opts?.cwd || process.cwd();
  if (base === "xcodebuild" && args.includes("archive")) {
    const archive = argValue(args, "-archivePath") || join(cwd, "Fenix.xcarchive");
    mkdirSync(archive, { recursive: true });
    writeFileSync(join(archive, "Info.plist"), "<plist/>");
    return { ok: true, code: 0, stdout: `ARCHIVE_OK ${archive}`, stderr: "" };
  }
  if (base === "xcodebuild" && args.includes("-exportArchive")) {
    const out = argValue(args, "-exportPath") || join(cwd, "export");
    mkdirSync(out, { recursive: true });
    const ipa = join(out, "Fenix.ipa");
    writeFileSync(ipa, "PK");
    return { ok: true, code: 0, stdout: `EXPORT_OK ${ipa}`, stderr: "" };
  }
  if (base === "altool" || (base === "xcrun" && args[0] === "altool")) {
    return { ok: true, code: 0, stdout: "UPLOAD_OK altool fixture", stderr: "" };
  }
  if (base === "gradle" || base === "gradlew" || args.includes("bundleRelease")) {
    const aab = join(cwd, "app/build/outputs/bundle/release/app-release.aab");
    mkdirSync(dirname(aab), { recursive: true });
    writeFileSync(aab, "aab");
    return { ok: true, code: 0, stdout: `BUNDLE_OK ${aab}`, stderr: "" };
  }
  if (base === "jarsigner" || base === "apksigner") {
    const idx = args.indexOf("-signedjar");
    const signed = idx >= 0 ? args[idx + 1] : join(cwd, "signed.aab");
    mkdirSync(dirname(signed), { recursive: true });
    writeFileSync(signed, "aab-signed");
    return { ok: true, code: 0, stdout: `SIGN_OK ${signed}`, stderr: "" };
  }
  return { ok: true, code: 0, stdout: `OK ${base}`, stderr: "" };
}

export async function realCommand(
  file: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
): Promise<RunResult> {
  return await new Promise((resolve) => {
    const env = opts?.env ? { ...process.env, ...opts.env } : process.env;
    const child = spawn(file, args, {
      cwd: opts?.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({
        ok: false,
        code: 127,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(err.message),
      });
    });
    child.on("close", (code) => {
      const n = code ?? 1;
      resolve({
        ok: n === 0,
        code: n,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr),
      });
    });
  });
}

export function runCommand(
  file: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
): Promise<RunResult> {
  if (customRunner) return customRunner(file, args, opts);
  return realCommand(file, args, opts);
}
