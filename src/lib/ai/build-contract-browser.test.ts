import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { loadContractFixtures } from "./contract-fixtures.ts";
import { evaluateContract, planContract } from "./build-contract.ts";

const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-quality";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;

function launch() {
  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

async function shot(page: Page, name: string) {
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* CI without the scorecard dir is fine */
  }
}

describe("contract fixtures in the browser D/T/M", () => {
  it("console zero, no horizontal overflow, focusable controls on 3 families", async () => {
    const fixtures = loadContractFixtures();
    const browser = await launch();
    try {
      for (const fix of fixtures) {
        const evaluation = evaluateContract({
          html: fix.html,
          files: fix.files,
          contract: planContract(fix.brief),
        });
        assert.equal(evaluation.ok, true, `${fix.id} static`);
        for (const [vp, viewport] of VIEWPORTS) {
          const page = await browser.newPage({ viewport });
          const errors: string[] = [];
          page.on("pageerror", (err) => errors.push(String(err)));
          page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
          });
          const src = prepareSrcDoc(fix.html, fix.palette, fix.id, evaluation.kind);
          await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
          await waitForFenixReady(page, 8000);
          const metrics = await page.evaluate(() => {
            const doc = document.documentElement;
            const control = document.querySelector<HTMLElement>("button, a, input, [tabindex]");
            if (control) control.focus();
            const focused = document.activeElement;
            const cs = focused instanceof HTMLElement ? getComputedStyle(focused) : null;
            const box = focused instanceof HTMLElement ? focused.getBoundingClientRect() : null;
            return {
              overflowX: Math.max(0, doc.scrollWidth - window.innerWidth),
              focusTag: focused && focused !== document.body ? focused.tagName : "",
              target: box ? Math.min(box.width, box.height) : 0,
              outline: cs ? cs.outlineStyle : "",
            };
          });
          assert.deepEqual(errors, [], `${fix.id} ${vp}: ${errors.join(" · ")}`);
          assert.ok(metrics.overflowX <= 8, `${fix.id} ${vp} overflow ${metrics.overflowX}`);
          assert.ok(metrics.focusTag, `${fix.id} ${vp} nessun controllo focusabile`);
          await shot(page, `${fix.id}-${vp}.png`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
});
