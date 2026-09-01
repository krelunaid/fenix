import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandRunner } from "./runner.ts";

export type AppleCreds = { issuerId: string; keyId: string; privateKey: string };

export type AppleAuthCtx = {
  env: Record<string, string>;
  keyPath: string;
  keysDir: string;
  authArgs: string[];
};

export type IosP12 = {
  p12Base64?: string | null;
  p12Password?: string | null;
  profileBase64?: string | null;
};

export function xcodeAuthArgs(creds: AppleCreds, keyPath: string): string[] {
  return [
    "-allowProvisioningUpdates",
    "-authenticationKeyPath",
    keyPath,
    "-authenticationKeyID",
    creds.keyId,
    "-authenticationKeyIssuerID",
    creds.issuerId,
  ];
}

function writeP8(creds: AppleCreds): { dir: string; keyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fenix-asc-"));
  chmodSync(dir, 0o700);
  const keyPath = join(dir, `AuthKey_${creds.keyId}.p8`);
  writeFileSync(keyPath, creds.privateKey.replace(/\\n/g, "\n").trim() + "\n", { mode: 0o600 });
  chmodSync(keyPath, 0o600);
  return { dir, keyPath };
}

function cleanup(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** Materialize AuthKey_{keyId}.p8 for Transporter/altool/xcodebuild. Always unlink. Never log. */
export async function withAppleApiKey<T>(
  creds: AppleCreds,
  fn: (ctx: AppleAuthCtx) => Promise<T>,
): Promise<T> {
  const { dir, keyPath } = writeP8(creds);
  try {
    return await fn({
      env: { API_PRIVATE_KEYS_DIR: dir },
      keyPath,
      keysDir: dir,
      authArgs: xcodeAuthArgs(creds, keyPath),
    });
  } finally {
    cleanup(dir);
  }
}

function decodeB64(raw: string): Buffer {
  const cleaned = raw.replace(/\s+/g, "");
  const buf = Buffer.from(cleaned, "base64");
  if (buf.length < 16) throw new Error("Materiale di firma iOS vuoto o non decodificabile.");
  return buf;
}

/**
 * p8 always. Optional P12 + provisioning profile installed into a throwaway
 * keychain and removed in finally. Never logs password or PEM.
 */
export async function withIosCodeSign<T>(
  creds: AppleCreds,
  p12: IosP12 | undefined,
  run: CommandRunner | undefined,
  fn: (ctx: AppleAuthCtx) => Promise<T>,
): Promise<T> {
  const hasP12 = Boolean(p12?.p12Base64 && p12.p12Password);
  if (!hasP12) return withAppleApiKey(creds, fn);
  const { dir, keyPath } = writeP8(creds);
  const p12Path = join(dir, "dist.p12");
  const keychain = join(dir, "fenix.keychain-db");
  const keychainPassword = `tmp-${creds.keyId}`;
  let profileDest: string | null = null;
  try {
    writeFileSync(p12Path, decodeB64(String(p12!.p12Base64)), { mode: 0o600 });
    chmodSync(p12Path, 0o600);
    if (p12?.profileBase64) {
      const profiles = join(homedir(), "Library/MobileDevice/Provisioning Profiles");
      try {
        const { mkdirSync } = await import("node:fs");
        mkdirSync(profiles, { recursive: true });
      } catch {
        /* ignore */
      }
      profileDest = join(profiles, `fenix-${creds.keyId}.mobileprovision`);
      writeFileSync(profileDest, decodeB64(p12.profileBase64), { mode: 0o600 });
    }
    if (run) {
      const quiet = { env: { API_PRIVATE_KEYS_DIR: dir } };
      await run("security", ["create-keychain", "-p", keychainPassword, keychain], quiet);
      await run("security", ["set-keychain-settings", "-lut", "21600", keychain], quiet);
      await run(
        "security",
        ["import", p12Path, "-k", keychain, "-P", String(p12!.p12Password), "-T", "/usr/bin/codesign", "-T", "/usr/bin/security"],
        quiet,
      );
      await run("security", ["list-keychains", "-d", "user", "-s", keychain], quiet);
      await run(
        "security",
        ["set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", keychainPassword, keychain],
        quiet,
      );
    }
    return await fn({
      env: {
        API_PRIVATE_KEYS_DIR: dir,
        FENIX_KEYCHAIN: keychain,
      },
      keyPath,
      keysDir: dir,
      authArgs: xcodeAuthArgs(creds, keyPath),
    });
  } finally {
    if (run && existsSync(keychain)) {
      try {
        await run("security", ["delete-keychain", keychain]);
      } catch {
        /* ignore */
      }
    }
    if (profileDest) {
      try {
        rmSync(profileDest, { force: true });
      } catch {
        /* ignore */
      }
    }
    cleanup(dir);
  }
}
