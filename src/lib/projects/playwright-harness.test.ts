import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { DEMOS } from "./demos.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { isLocalTestUrl, launchChromium, PUBLIC_TEST_BLOCK } from "./playwright-harness.ts";

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
