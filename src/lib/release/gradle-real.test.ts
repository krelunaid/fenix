import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  GRADLE_VERSION,
  GRADLE_WRAPPER_JAR_SHA256,
  assertGradleWrapperJar,
  ensureVendoredGradleWrapperJar,
  gradleWrapperJarSha256,
} from "./gradle-wrapper.ts";

describe("real Gradle 8.7 on Linux", () => {
  it("vendors a wrapper jar whose SHA-256 matches the pin", () => {
    try {
      const path = ensureVendoredGradleWrapperJar();
      assert.equal(existsSync(path), true);
      const bytes = readFileSync(path);
      assert.equal(gradleWrapperJarSha256(bytes), GRADLE_WRAPPER_JAR_SHA256);
      assert.equal(assertGradleWrapperJar(bytes).ok, true);
    } catch (err) {
      if (process.env.GITHUB_ACTIONS) throw err;
    }
  });

  it("invokes a real gradle command, not a stub script", () => {
    let version: string;
    try {
      version = execFileSync("gradle", ["--version"], {
        encoding: "utf8",
        timeout: 60_000,
        env: process.env,
      });
    } catch {
      if (process.env.GITHUB_ACTIONS) {
        throw new Error("gradle assente su CI (setup-gradle 8.7 richiesto).");
      }
      return;
    }
    assert.match(version, new RegExp(`Gradle ${GRADLE_VERSION}`));
    const dir = mkdtempSync(join(tmpdir(), "fenix-gradle-real-"));
    try {
      writeFileSync(join(dir, "settings.gradle"), `rootProject.name = "fenix-real"\n`);
      writeFileSync(
        join(dir, "build.gradle"),
        `tasks.register("fenixPing") { doLast { println "FENIX_GRADLE_OK" } }\n`,
      );
      const ping = execFileSync("gradle", ["fenixPing", "--quiet", "--no-daemon"], {
        cwd: dir,
        encoding: "utf8",
        timeout: 90_000,
        env: process.env,
      });
      assert.match(ping, /FENIX_GRADLE_OK/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
