import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { chromium, type Browser } from "playwright";
import { DEMOS } from "./demos.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import {
  isLocalTestUrl,
  isTransientLaunchError,
  launchChromium,
  launchChromiumWith,
  LAUNCH_TIMEOUT_MS,
  pidOwningDir,
  PUBLIC_TEST_BLOCK,
  resolveInsideRoot,
  RETRY_BACKOFF_MS,
  sweepOwnedLaunch,
} from "./playwright-harness.ts";

const STUDIO_HEAD = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400">
</head><body>
<script>document.documentElement.setAttribute("data-parsed","1")</script>
<style>section.hidden.md\\:block{display:block}</style>
<section class="hidden md:block"><div class="pointer-events-none absolute inset-x-0 top-0 z-20">overlay</div></section>
<button type="button">Versioni</button>
</body></html>`;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("playwright harness isolates public network", () => {
  it("allows loopback and data URLs, blocks CDN and Railway", () => {
    assert.equal(isLocalTestUrl("http://127.0.0.1:8081/studio/p"), true);
    assert.equal(isLocalTestUrl("http://localhost:8081/__worker/jobs/x"), true);
    assert.equal(isLocalTestUrl("data:text/html,ok"), true);
    assert.equal(isLocalTestUrl("about:blank"), true);
    assert.equal(isLocalTestUrl("ws://127.0.0.1:8081/?token=1"), true);
    assert.equal(isLocalTestUrl("https://fonts.googleapis.com/css2?family=Manrope"), false);
    assert.equal(isLocalTestUrl("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"), false);
    assert.equal(isLocalTestUrl("https://fenix-production-d9f5.up.railway.app/jobs/x"), false);
    assert.match("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", PUBLIC_TEST_BLOCK);
  });

  it("setContent of a product fixture does not wait on jsdelivr or Google Fonts", async () => {
    const src = prepareSrcDoc(DEMOS.kiln.html, DEMOS.kiln.palette, "harness-kiln", DEMOS.kiln.kind);
    assert.match(src, /jsdelivr/);
    assert.match(src, /fonts\.googleapis/);
    const browser = await launchChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const seen: string[] = [];
      page.on("request", (req) => seen.push(req.url()));
      const started = Date.now();
      await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 4000 });
      await waitForFenixReady(page, 4000);
      assert.ok(Date.now() - started < 4000, "lifecycle waited on a public origin");
      assert.ok(
        seen.some((url) => /jsdelivr|fonts\.googleapis/.test(url)),
        `expected intercepted CDN, got ${seen.slice(0, 6).join(" · ")}`,
      );
      await page.close();
    } finally {
      await browser.close();
    }
  });

  it("unisolated hung Google Fonts blocks studio chrome; isolate unblocks overlay and Versioni", async () => {
    const raw = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const stuck = await raw.newPage({ viewport: { width: 1280, height: 800 } });
      await stuck.route(/fonts\.googleapis\.com/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await route.abort("timedout");
      });
      const started = Date.now();
      await assert.rejects(
        () => stuck.setContent(STUDIO_HEAD, { waitUntil: "domcontentloaded", timeout: 1500 }),
        /Timeout/i,
      );
      assert.ok(Date.now() - started >= 1400, "unisolated navigation returned before the font hang");
      await stuck.close();
    } finally {
      await raw.close();
    }

    const browser = await launchChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const started = Date.now();
      await page.setContent(STUDIO_HEAD, { waitUntil: "domcontentloaded", timeout: 4000 });
      assert.ok(Date.now() - started < 4000, "isolated studio chrome waited on Google Fonts");
      await page
        .locator("section.hidden.md\\:block .pointer-events-none.absolute.inset-x-0.top-0.z-20")
        .waitFor({ timeout: 2000 });
      await page.getByRole("button", { name: /^Versioni$/ }).click({ timeout: 2000 });
      await page.close();
    } finally {
      await browser.close();
    }
  });
});

describe("playwright harness bounds Chromium spawn", () => {
  it("keeps launch timeout finite and no higher than Playwright's default", () => {
    assert.equal(LAUNCH_TIMEOUT_MS, 30_000);
    assert.ok(LAUNCH_TIMEOUT_MS > 0);
    assert.ok(RETRY_BACKOFF_MS > 0);
    assert.ok(RETRY_BACKOFF_MS <= 200);
  });

  it("retries only a transient launch after bounded backoff, never an assertion", async () => {
    let launches = 0;
    let cleaned = 0;
    const fake = { isConnected: () => true } as unknown as Browser;
    const started = Date.now();
    const browser = await launchChromiumWith(
      async () => {
        launches += 1;
        if (launches === 1) throw new Error("Timeout 30000ms exceeded.");
        return fake;
      },
      { onTransient: () => { cleaned += 1; }, backoffMs: 40 },
    );
    assert.equal(browser, fake);
    assert.equal(launches, 2);
    assert.equal(cleaned, 1);
    assert.ok(Date.now() - started >= 40, "transient retry skipped backoff");

    launches = 0;
    cleaned = 0;
    await assert.rejects(
      () =>
        launchChromiumWith(
          async () => {
            launches += 1;
            throw new assert.AssertionError({ message: "product gate" });
          },
          { onTransient: () => { cleaned += 1; } },
        ),
      /product gate/,
    );
    assert.equal(launches, 1);
    assert.equal(cleaned, 0);
    assert.equal(isTransientLaunchError(new Error("Failed to launch browser")), true);
    assert.equal(isTransientLaunchError(new assert.AssertionError({ message: "no" })), false);
  });

  it("cleans only owned pid/dir; a foreign Playwright profile and process survive", async () => {
    const host = mkdtempSync(join(tmpdir(), "fenix-host-"));
    const root = mkdtempSync(join(host, "fenix-playwright-"));
    const foreignDir = join(host, "playwright_chromiumdev_profile-foreign");
    mkdirSync(foreignDir);
    const sentinel = join(foreignDir, "sentinel.txt");
    writeFileSync(sentinel, "foreign-keep");
    const ownedDir = join(root, "owned-stale");
    mkdirSync(ownedDir);
    writeFileSync(join(ownedDir, "junk"), "stale");
    const sleeper = ["-e", "setTimeout(() => {}, 30000)"];
    const foreign = spawn(process.execPath, sleeper, { stdio: "ignore" });
    const ownedProc = spawn(process.execPath, sleeper, { stdio: "ignore" });
    const foreignPid = foreign.pid;
    const ownedPid = ownedProc.pid;
    try {
      assert.ok(foreignPid && ownedPid);
      const killed: number[] = [];
      const out = sweepOwnedLaunch(
        { token: "owned-1", pid: ownedPid, dir: ownedDir, root },
        {
          selfPid: process.pid,
          ppid: process.ppid,
          kill: (pid, signal) => {
            killed.push(pid);
            process.kill(pid, signal);
          },
        },
      );
      assert.deepEqual(killed, [ownedPid]);
      assert.equal(out.killed, true);
      assert.equal(out.removed, true);
      assert.equal(existsSync(ownedDir), false);
      assert.equal(existsSync(foreignDir), true);
      assert.equal(readFileSync(sentinel, "utf8"), "foreign-keep");
      assert.equal(alive(foreignPid), true);
      const deadline = Date.now() + 1000;
      while (alive(ownedPid) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.equal(alive(ownedPid), false);
      assert.equal(
        pidOwningDir(
          "/tmp/fenix-playwright/run/owned-token",
          [
            { pid: 1, args: "init /tmp/fenix-playwright/run/owned-token" },
            { pid: 80, args: "node --test" },
            {
              pid: 81,
              args: "/root/.cache/ms-playwright/chromium/chrome-headless-shell --user-data-dir=/tmp/fenix-playwright/run/owned-token",
            },
            {
              pid: 82,
              args: "/root/.cache/ms-playwright/chromium/chrome-headless-shell --user-data-dir=/tmp/playwright_chromiumdev_profile-foreign",
            },
          ],
          { selfPid: 80, ppid: 79 },
        ),
        81,
      );
    } finally {
      try {
        if (foreignPid) process.kill(foreignPid, "SIGKILL");
      } catch {
        /* gone */
      }
      try {
        if (ownedPid) process.kill(ownedPid, "SIGKILL");
      } catch {
        /* already swept */
      }
      rmSync(host, { recursive: true, force: true });
    }
  });

  it("path traversal and symlinks cannot leave the dedicated Fenix root", () => {
    const host = mkdtempSync(join(tmpdir(), "fenix-esc-"));
    const root = join(host, "root");
    const outside = join(host, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(outside, "keep"), "secret");
    mkdirSync(join(root, "owned"));
    writeFileSync(join(root, "owned", "junk"), "stale");
    symlinkSync(outside, join(root, "escape"));
    try {
      assert.throws(() => resolveInsideRoot(root, join(root, "..", "outside", "keep")), /escapes/);
      assert.throws(() => resolveInsideRoot(root, join(root, "escape")), /escapes/);
      assert.throws(() => resolveInsideRoot(root, join(root, "escape", "keep")), /escapes/);
      assert.throws(
        () =>
          sweepOwnedLaunch({
            token: "esc-1",
            pid: 0,
            dir: join(root, "..", "outside"),
            root,
          }),
        /escapes/,
      );
      assert.throws(
        () =>
          sweepOwnedLaunch({
            token: "esc-2",
            pid: 0,
            dir: join(root, "escape"),
            root,
          }),
        /escapes/,
      );
      assert.equal(readFileSync(join(outside, "keep"), "utf8"), "secret");
      const cleaned = sweepOwnedLaunch({
        token: "esc-3",
        pid: 0,
        dir: join(root, "owned"),
        root,
      });
      assert.equal(cleaned.removed, true);
      assert.equal(existsSync(join(root, "owned")), false);
      assert.equal(existsSync(join(outside, "keep")), true);
    } finally {
      rmSync(host, { recursive: true, force: true });
    }
  });

  it("second launch after close is a new isolated browser, not a hung spawn", async () => {
    const first = await launchChromium();
    const page = await first.newPage();
    await page.setContent("<!DOCTYPE html><html><body>ok</body></html>", {
      waitUntil: "domcontentloaded",
      timeout: 4000,
    });
    await first.close();
    const second = await launchChromium();
    try {
      assert.notEqual(second, first);
      const next = await second.newPage();
      await next.setContent("<!DOCTYPE html><html><body>again</body></html>", {
        waitUntil: "domcontentloaded",
        timeout: 4000,
      });
      await next.close();
    } finally {
      await second.close();
    }
  });
});
