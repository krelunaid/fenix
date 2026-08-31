import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  BEFORE_READY_ERROR,
  FENIX_READY_SELECTOR,
  FENIX_READY_SNIPPET,
  MARK_READY_JS,
  screenshotWhenReady,
  waitForFenixReady,
} from "./fenix-ready.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("capture-demo-shots waits for the ready marker and never shots on timeout", () => {
  const src = readFileSync(join(root, "scripts/capture-demo-shots.mjs"), "utf8");
  assert.match(src, /screenshotWhenReady/);
  assert.match(src, /fenix-ready/);
  assert.doesNotMatch(src, /waitForTimeout\(\s*\d+\s*\)/);
  assert.doesNotMatch(src, /page\.screenshot\(/);
});

test("worker visual shots wait for the ready marker when present", () => {
  const worker = readFileSync(join(root, "workers/visual/server.mjs"), "utf8");
  assert.match(worker, /data-fenix-ready/);
  assert.match(worker, /waitForSelector/);
});

test("screenshotWhenReady refuses a page captured before hydration", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fenix-ready-"));
  const out = join(dir, "too-soon.png");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(
      "<!DOCTYPE html><html><body><main>ancora vuoto</main></body></html>",
      { waitUntil: "domcontentloaded" },
    );
    await assert.rejects(
      () => screenshotWhenReady(page, out, 250),
      (err) => {
        assert.match(String(err.message || err), new RegExp(BEFORE_READY_ERROR));
        return true;
      },
    );
    const late = await browser.newPage({ viewport: { width: 390, height: 200 } });
    await late.setContent(
      `<!DOCTYPE html><html><body><script>${MARK_READY_JS};markReady();</script><p>pronto</p></body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    await screenshotWhenReady(late, out, 2000);
    const buf = readFileSync(out);
    assert.ok(buf.length > 200, "ready screenshot must have pixels");
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("waitForFenixReady resolves only after the attribute lands", async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<!DOCTYPE html><html><body><script>
        setTimeout(function(){ ${FENIX_READY_SNIPPET} }, 80);
      </script></body></html>`,
    );
    assert.equal(await page.$(FENIX_READY_SELECTOR), null);
    await waitForFenixReady(page, 2000);
    assert.ok(await page.$(FENIX_READY_SELECTOR));
  } finally {
    await browser.close();
  }
});
