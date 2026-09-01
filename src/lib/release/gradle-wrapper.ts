import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Gradle 8.7 wrapper jar (Apache-2.0). SHA-256 of the vendored bytes. */
export const GRADLE_VERSION = "8.7";
export const GRADLE_WRAPPER_JAR_SHA256 =
  "cb0da6751c2b753a16ac168bb354870ebb1e162e9083f116729cec9c781156b8";
export const GRADLE_WRAPPER_JAR_URL =
  "https://raw.githubusercontent.com/gradle/gradle/v8.7.0/gradle/wrapper/gradle-wrapper.jar";

export function vendorGradleWrapperJarPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../workers/release/vendor/gradle-wrapper.jar");
}

export function gradleWrapperJarSha256(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertGradleWrapperJar(bytes: Uint8Array | Buffer): { ok: true } | { ok: false; error: string } {
  if (bytes.byteLength < 10_000) {
    return { ok: false, error: "gradle-wrapper.jar troppo piccolo." };
  }
  const sha = gradleWrapperJarSha256(bytes);
  if (sha !== GRADLE_WRAPPER_JAR_SHA256) {
    return { ok: false, error: "gradle-wrapper.jar non coincide con lo SHA-256 atteso." };
  }
  return { ok: true };
}

export function readVendoredGradleWrapperJar(): Buffer | null {
  const path = vendorGradleWrapperJarPath();
  if (!existsSync(path)) return null;
  try {
    const bytes = readFileSync(path);
    const check = assertGradleWrapperJar(bytes);
    return check.ok ? bytes : null;
  } catch {
    return null;
  }
}

export function downloadGradleWrapperJar(): Buffer {
  const dest = join(tmpdir(), "fenix-gradle-wrapper.jar");
  execFileSync("curl", ["-fsSL", GRADLE_WRAPPER_JAR_URL, "-o", dest], { timeout: 60_000 });
  const bytes = readFileSync(dest);
  const check = assertGradleWrapperJar(bytes);
  if (!check.ok) throw new Error(check.error);
  return bytes;
}

export function loadGradleWrapperJar(): Buffer {
  return readVendoredGradleWrapperJar() || downloadGradleWrapperJar();
}

/** Copy the verified wrapper jar next to gradle-wrapper.properties. */
export function installGradleWrapperJar(wrapperDir: string, bytes?: Buffer | null): string {
  mkdirSync(wrapperDir, { recursive: true });
  const dest = join(wrapperDir, "gradle-wrapper.jar");
  const payload = bytes || loadGradleWrapperJar();
  const check = assertGradleWrapperJar(payload);
  if (!check.ok) throw new Error(check.error);
  writeFileSync(dest, payload);
  return dest;
}

export function copyGradleWrapperJar(src: string, destDir: string): string {
  const bytes = readFileSync(src);
  const check = assertGradleWrapperJar(bytes);
  if (!check.ok) throw new Error(check.error);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, "gradle-wrapper.jar");
  copyFileSync(src, dest);
  return dest;
}
