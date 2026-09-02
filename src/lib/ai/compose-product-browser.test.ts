import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isolatedPage, isBlockedPublicNetworkError, launchChromium } from "../projects/playwright-harness.ts";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import {
  auditGraphicQuality,
  collectRenderedGraphic,
  GRAPHIC_SCORE_THRESHOLD,
} from "../projects/graphic-quality.ts";
import { evaluateContract, planContract, blocksPublish } from "./build-contract.ts";
import { loadPipelineFixtures, runGraphicPipeline } from "./compose-product.ts";
import { loadLegacyGraphicFixtures } from "./graphic-fixtures.ts";
import { EXTERNAL_BENCHMARK, runBlindTrial } from "../projects/blind-visual-benchmark.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(here, "fixtures/graphic/pipeline");
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-graphic-pipeline";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;

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

describe("graphic pipeline visual QA D/T/M", () => {
  it("paints six hard briefs plus dual directions, scores them, and records a blind rubric", async () => {
    const fixtures = loadPipelineFixtures();
    assert.ok(fixtures.length >= 10);
    const browser = await launchChromium();
    const manifest: {
      threshold: number;
      files: { name: string; sha256: string; bytes: number; score: number; ok: boolean; grammar: string }[];
      external: typeof EXTERNAL_BENCHMARK.declaration;
    } = { threshold: GRAPHIC_SCORE_THRESHOLD, files: [], external: EXTERNAL_BENCHMARK.declaration };
    try {
      for (const fix of fixtures) {
        const kind = fix.kind || "app";
        const contract = planContract(fix.brief);
        for (const [vp, viewport] of VIEWPORTS) {
          const page = await isolatedPage(browser, { viewport });
          const errors: string[] = [];
          page.on("pageerror", (err) => {
            if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
          });
          page.on("console", (msg) => {
            if (msg.type() === "error" && !isBlockedPublicNetworkError(msg.text())) errors.push(msg.text());
          });
          try {
            const src = prepareSrcDoc(fix.html, fix.palette, fix.id, kind);
            await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
            await waitForFenixReady(page, 8000);
            const rendered = await page.evaluate(collectRenderedGraphic);
            rendered.consoleErrors = errors.length;
            const report = auditGraphicQuality(fix.html, { brief: fix.brief, kind, rendered });
            const evaluation = evaluateContract({
              html: fix.html,
              files: [{ path: "index.html", content: fix.html }],
              contract,
              kind,
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
              grammar: fix.grammar,
            });
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            assert.ok(overflow <= 8, `${fix.id}/${vp} overflow ${overflow}`);
            assert.equal(errors.length, 0, `${fix.id}/${vp} console ${errors.join(" | ")}`);
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
            assert.equal(blocksPublish(fix.html, kind, undefined, fix.brief), "");
            assert.ok(rendered.headingCount >= 1, `${fix.id} heading`);
            assert.ok(rendered.deadRatio < 0.58, `${fix.id} dead ${rendered.deadRatio}`);
            const title = await page.evaluate(() => document.title);
            assert.ok(title.length > 2, `${fix.id} title`);
            if (vp === "D") {
              const appWidth = await page.evaluate(() => {
                const app = document.querySelector(".app") as HTMLElement | null;
                return app ? Math.round(app.getBoundingClientRect().width) : 0;
              });
              assert.ok(appWidth >= 1000, `${fix.id} desktop app width ${appWidth}`);
            }
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
    const palettes = fixtures.map((f) => f.palette.bg.toLowerCase());
    assert.ok(new Set(palettes).size >= 8, `grounds ${[...new Set(palettes)].join(",")}`);
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(join(SHOTS, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.equal(manifest.files.length, fixtures.length * VIEWPORTS.length);

    const fail = loadLegacyGraphicFixtures().find((f) => f.id === "essenza-fail")!;
    const gold = fixtures.find((f) => f.id === "essenza-or")!;
    const trial = runBlindTrial({
      briefId: "essenza",
      brief: gold.brief,
      left: { id: fail.id, html: fail.html },
      right: { id: gold.id, html: gold.html },
    });
    writeFileSync(join(SHOTS, "blind-trial.json"), `${JSON.stringify({ trial, external: EXTERNAL_BENCHMARK }, null, 2)}\n`);
    assert.equal(trial.labels.A, "Candidate A");
    assert.equal(EXTERNAL_BENCHMARK.available, false);
    assert.equal(EXTERNAL_BENCHMARK.declaration, "benchmark esterno non disponibile");
    const pipeline = runGraphicPipeline(gold.brief);
    assert.equal(pipeline.qa.ok, true);
  });
});
