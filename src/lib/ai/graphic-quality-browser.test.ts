import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import {
  auditGraphicQuality,
  collectRenderedGraphic,
  GRAPHIC_SCORE_THRESHOLD,
} from "../projects/graphic-quality.ts";
import { evaluateContract, planContract, blocksPublish } from "./build-contract.ts";
import { loadGraphicFixtures } from "./graphic-fixtures.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(here, "fixtures/graphic/shots");
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-graphic";
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
  mkdirSync(SHOTS, { recursive: true });
  const dest = join(SHOTS, name);
  await page.screenshot({ path: dest, fullPage: false });
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* CI without scorecard dir */
  }
  return dest;
}

describe("graphic quality visual QA D/T/M", () => {
  it("scores painted screens: Essenza fails, three products pass with distinct identities", async () => {
    const fixtures = loadGraphicFixtures();
    const browser = await launch();
    const manifest: {
      threshold: number;
      files: { name: string; sha256: string; bytes: number; score: number; ok: boolean }[];
    } = { threshold: GRAPHIC_SCORE_THRESHOLD, files: [] };
    try {
      for (const fix of fixtures) {
        const contract = planContract(fix.brief);
        for (const [vp, viewport] of VIEWPORTS) {
          const page = await browser.newPage({ viewport });
          const errors: string[] = [];
          page.on("pageerror", (err) => errors.push(String(err)));
          page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
          });
          const src = prepareSrcDoc(fix.html, fix.palette, fix.id, "app");
          await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
          await waitForFenixReady(page, 8000);
          if (fix.id === "essenza-fail") {
            const list = page.locator('button[data-view="list"]');
            if (await list.count()) await list.click();
          }
          const rendered = await page.evaluate(collectRenderedGraphic);
          rendered.consoleErrors = errors.length;
          const report = auditGraphicQuality(fix.html, {
            brief: fix.brief,
            kind: "app",
            rendered,
          });
          const evaluation = evaluateContract({
            html: fix.html,
            files: [{ path: "index.html", content: fix.html }],
            contract,
            kind: "app",
            brief: fix.brief,
            rendered,
          });
          const dest = await shot(page, `${fix.id}-${vp}.png`);
          const buf = await page.screenshot({ type: "png" });
          const st = statSync(dest);
          manifest.files.push({
            name: `${fix.id}-${vp}.png`,
            sha256: createHash("sha256").update(buf).digest("hex"),
            bytes: st.size,
            score: report.score,
            ok: report.ok,
          });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          assert.ok(overflow <= 8, `${fix.id}/${vp} overflow ${overflow}`);
          assert.equal(errors.length, 0, `${fix.id}/${vp} console ${errors.join(" | ")}`);
          if (fix.mustPass) {
            const tabs = page.locator("button[data-view]");
            if ((await tabs.count()) > 1) {
              await tabs.nth(1).click();
              await tabs.nth(0).click();
            }
            assert.equal(
              report.ok,
              true,
              `${fix.id}/${vp} ${report.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(" · ")}`,
            );
            assert.ok(report.score >= GRAPHIC_SCORE_THRESHOLD, `${fix.id} score ${report.score}`);
            assert.equal(evaluation.ok, true, `${fix.id}/${vp} contract`);
            assert.equal(blocksPublish(fix.html, "app", undefined, fix.brief), "");
            assert.ok(rendered.headingCount >= 1, `${fix.id} heading`);
            assert.ok(rendered.deadRatio < 0.78, `${fix.id} dead ${rendered.deadRatio}`);
          } else {
            assert.equal(report.ok, false, "Essenza must not pass visual QA");
            assert.equal(evaluation.checks.find((c) => c.id === "graphic")?.ok, false);
            assert.match(blocksPublish(fix.html, "app", undefined, fix.brief), /graphic|empty|skeletal|generic/i);
          }
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
    const palettes = fixtures.filter((f) => f.mustPass).map((f) => f.palette.bg.toLowerCase());
    assert.equal(new Set(palettes).size, 3, "three distinct grounds");
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(join(SHOTS, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.equal(manifest.files.length, fixtures.length * VIEWPORTS.length);
  });
});
