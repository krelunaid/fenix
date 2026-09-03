import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { chromium, type Browser } from "playwright";
import { DEMOS } from "./demos.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import {
  isLocalTestUrl,
  isPlaywrightChromiumCmdline,
  isPlaywrightChromiumProcess,
  isTransientLaunchError,
  launchChromium,
  launchChromiumWith,
  LAUNCH_TIMEOUT_MS,
  PUBLIC_TEST_BLOCK,
  sweepStaleChromium,
} from "./playwright-harness.ts";

const STUDIO_HEAD = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400">
</head><body>
<script>document.documentElement.setAttribute("data-parsed","1")</script>
<style>section.hidden.md\\:block{display:block}</style>
<section class="hidden md:block"><div class="pointer-events-none absolute inset-x-0 top-0 z-20">overlay</div></section>
<button type="button">Versioni</button>
</body></html>`;

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
  });

  it("retries only a transient launch after sweep, never an assertion", async () => {
    let launches = 0;
    let swept = 0;
    const fake = { isConnected: () => true } as unknown as Browser;
    const browser = await launchChromiumWith(
      async () => {
        launches += 1;
        if (launches === 1) throw new Error("Timeout 30000ms exceeded.");
        return fake;
      },
      { sweep: () => { swept += 1; } },
    );
    assert.equal(browser, fake);
    assert.equal(launches, 2);
    assert.equal(swept, 1);

    launches = 0;
    swept = 0;
    await assert.rejects(
      () =>
        launchChromiumWith(
          async () => {
            launches += 1;
            throw new assert.AssertionError({ message: "product gate" });
          },
          { sweep: () => { swept += 1; } },
        ),
      /product gate/,
    );
    assert.equal(launches, 1);
    assert.equal(swept, 0);
    assert.equal(isTransientLaunchError(new Error("Failed to launch browser")), true);
    assert.equal(isTransientLaunchError(new assert.AssertionError({ message: "no" })), false);
  });

  it("sweep kills playwright chrome pids and drops leftover profiles, never pid 1, self, ppid or bash", () => {
    const procDir = mkdtempSync(join(tmpdir(), "fenix-proc-"));
    const tmp = mkdtempSync(join(tmpdir(), "fenix-tmp-"));
    try {
      mkdirSync(join(procDir, "1"));
      writeFileSync(join(procDir, "1", "cmdline"), "init\0");
      writeFileSync(join(procDir, "1", "comm"), "init\n");
      mkdirSync(join(procDir, "79"));
      writeFileSync(
        join(procDir, "79", "cmdline"),
        "/root/.cache/ms-playwright/chromium-1194/chrome-headless-shell\0--ppid-trap\0",
      );
      writeFileSync(join(procDir, "79", "comm"), "chrome-headless-s\n");
      mkdirSync(join(procDir, "80"));
      writeFileSync(join(procDir, "80", "cmdline"), "node\0--test\0");
      writeFileSync(join(procDir, "80", "comm"), "node\n");
      mkdirSync(join(procDir, "81"));
      writeFileSync(
        join(procDir, "81", "cmdline"),
        "/root/.cache/ms-playwright/chromium-1194/chrome-headless-shell\0--headless=new\0",
      );
      writeFileSync(join(procDir, "81", "comm"), "chrome-headless-s\n");
      mkdirSync(join(procDir, "82"));
      writeFileSync(
        join(procDir, "82", "cmdline"),
        "/usr/bin/bash\0-c\0grep ms-playwright chrome-headless-shell\0",
      );
      writeFileSync(join(procDir, "82", "comm"), "bash\n");
      mkdirSync(join(tmp, "playwright_chromiumdev_profile-abc"));
      mkdirSync(join(tmp, "playwright-artifacts-xyz"));
      mkdirSync(join(tmp, "agent-browser-chrome-keep"));
      const killed: number[] = [];
      const out = sweepStaleChromium({
        procDir,
        tmpDir: tmp,
        selfPid: 80,
        ppid: 79,
        kill: (pid) => {
          killed.push(pid);
        },
      });
      assert.deepEqual(killed, [81]);
      assert.equal(out.killed, 1);
      assert.equal(out.removedDirs, 2);
      assert.equal(isPlaywrightChromiumCmdline("node --test"), false);
      assert.equal(
        isPlaywrightChromiumProcess(
          "/usr/bin/bash -c grep ms-playwright chrome-headless-shell",
          "bash",
        ),
        false,
      );
      assert.equal(
        isPlaywrightChromiumProcess(
          "/root/.cache/ms-playwright/chromium-1194/chrome-headless-shell --headless=new",
          "chrome-headless-s",
        ),
        true,
      );
    } finally {
      rmSync(procDir, { recursive: true, force: true });
      rmSync(tmp, { recursive: true, force: true });
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
