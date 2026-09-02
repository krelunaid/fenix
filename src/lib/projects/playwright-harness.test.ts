import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMOS } from "./demos.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import {
  isolateFromPublicNetwork,
  isLocalTestUrl,
  launchChromium,
  PUBLIC_TEST_BLOCK,
} from "./playwright-harness.ts";

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
      await isolateFromPublicNetwork(page);
      const blocked: string[] = [];
      page.on("requestfailed", (req) => blocked.push(req.url()));
      const started = Date.now();
      await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 4000 });
      await waitForFenixReady(page, 4000);
      assert.ok(Date.now() - started < 4000, "lifecycle waited on a public origin");
      assert.ok(
        blocked.some((url) => /jsdelivr|fonts\.googleapis/.test(url)),
        `expected blocked CDN, got ${blocked.slice(0, 6).join(" · ")}`,
      );
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
