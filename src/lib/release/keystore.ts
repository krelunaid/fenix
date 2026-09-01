import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function looksLikeBase64Blob(value: string): boolean {
  const t = value.trim();
  if (t.length < 80) return false;
  if (/[/\\]/.test(t) && t.length < 400) return false;
  if (existsSync(t) && !t.includes("\n")) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(t);
}

export function decodeKeystoreBytes(raw: string): Buffer {
  const cleaned = raw.replace(/\s+/g, "");
  const buf = Buffer.from(cleaned, "base64");
  if (buf.length < 32) throw new Error("Keystore Android vuoto o non decodificabile.");
  return buf;
}

/**
 * Resolve a usable keystore path on an ephemeral runner.
 * Prefer ANDROID_KEYSTORE_BASE64 (binary secret). A PATH secret on a fresh
 * hosted runner does not exist — treat a long base64-looking value as the blob.
 * Never log bytes or passwords.
 */
export function resolveKeystoreSource(opts: {
  path?: string | null;
  base64?: string | null;
}): { kind: "file"; path: string } | { kind: "bytes"; bytes: Buffer } | { kind: "missing" } {
  const b64 = String(opts.base64 || "").trim();
  if (b64) return { kind: "bytes", bytes: decodeKeystoreBytes(b64) };
  const path = String(opts.path || "").trim();
  if (!path) return { kind: "missing" };
  if (existsSync(path)) return { kind: "file", path };
  if (looksLikeBase64Blob(path)) return { kind: "bytes", bytes: decodeKeystoreBytes(path) };
  return { kind: "missing" };
}

export async function withAndroidKeystore<T>(
  opts: { path?: string | null; base64?: string | null },
  fn: (keystorePath: string) => Promise<T>,
): Promise<T> {
  const src = resolveKeystoreSource(opts);
  if (src.kind === "missing") {
    throw new Error(
      "Manca il keystore di upload Android sul server (ANDROID_KEYSTORE_BASE64, oppure un file esistente in ANDROID_KEYSTORE_PATH). Non si inventa un certificato.",
    );
  }
  if (src.kind === "file") return fn(src.path);
  const dir = mkdtempSync(join(tmpdir(), "fenix-ks-"));
  const file = join(dir, "upload.keystore");
  try {
    writeFileSync(file, src.bytes, { mode: 0o600 });
    chmodSync(file, 0o600);
    chmodSync(dir, 0o700);
    return await fn(file);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
