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
            const iconMetrics = await page.evaluate(() => {
              const svgs = [...document.querySelectorAll("nav svg")];
              return svgs.map((node) => {
                const el = node as SVGSVGElement;
                const r = el.getBoundingClientRect();
                const parent = el.parentElement?.getBoundingClientRect();
                let bbox = { x: 0, y: 0, width: 0, height: 0 };
                try {
                  const b = el.getBBox();
                  bbox = { x: b.x, y: b.y, width: b.width, height: b.height };
                } catch {
                  /* not rendered */
                }
                const cs = getComputedStyle(el);
                return {
                  w: r.width,
                  h: r.height,
                  display: cs.display,
                  overflowRight: parent ? r.right - parent.right : 0,
                  overflowBottom: parent ? r.bottom - parent.bottom : 0,
                  overflowLeft: parent ? parent.left - r.left : 0,
                  overflowTop: parent ? parent.top - r.top : 0,
                  bbox,
                  viewBox: el.getAttribute("viewBox"),
                  join: el.getAttribute("stroke-linejoin"),
                };
              });
            });
            assert.doesNotMatch(fix.html, /M5 19l7-14 7 14/);
            const visibleIcons = iconMetrics.filter((m) => m.display !== "none" && m.w > 0 && m.h > 0);
            if (visibleIcons.length > 0) {
              const sizes = visibleIcons.map((m) => Math.max(m.w, m.h));
              const max = Math.max(...sizes);
              const min = Math.min(...sizes);
              assert.ok(
                max / min <= 1.35,
                `${fix.id}/${vp} nav icon size ratio ${max.toFixed(1)}/${min.toFixed(1)}`,
              );
              for (const m of visibleIcons) {
                assert.ok(m.w <= 26 && m.h <= 26, `${fix.id}/${vp} nav icon oversized ${m.w.toFixed(1)}x${m.h.toFixed(1)}`);
                assert.ok(m.w >= 16 && m.h >= 16, `${fix.id}/${vp} nav icon tiny ${m.w.toFixed(1)}x${m.h.toFixed(1)}`);
                assert.ok(m.overflowRight <= 1.5, `${fix.id}/${vp} icon overflow right ${m.overflowRight}`);
                assert.ok(m.overflowBottom <= 1.5, `${fix.id}/${vp} icon overflow bottom ${m.overflowBottom}`);
                assert.ok(m.overflowLeft <= 1.5, `${fix.id}/${vp} icon overflow left ${m.overflowLeft}`);
                assert.ok(m.overflowTop <= 1.5, `${fix.id}/${vp} icon overflow top ${m.overflowTop}`);
                assert.equal(m.viewBox, "0 0 24 24", `${fix.id}/${vp} viewBox`);
                assert.equal(m.join, "round", `${fix.id}/${vp} linejoin`);
                assert.ok(m.bbox.x >= -1.2 && m.bbox.y >= -1.2, `${fix.id}/${vp} bbox origin ${m.bbox.x},${m.bbox.y}`);
                assert.ok(
                  m.bbox.x + m.bbox.width <= 25.2 && m.bbox.y + m.bbox.height <= 25.2,
                  `${fix.id}/${vp} bbox ${m.bbox.width}x${m.bbox.height} at ${m.bbox.x},${m.bbox.y}`,
                );
              }
            }
            if (["vesti-inchiostro", "vesti-osso", "crudo-mare", "atelier-carta"].includes(fix.id)) {
              const material = await page.evaluate(() => {
                const svg = document.querySelector(".sil svg, .hero svg, .plate svg") as SVGSVGElement | null;
                if (!svg) return { ok: false as const };
                const parts = [...svg.querySelectorAll("[data-part]")].map((n) => n.getAttribute("data-part") || "");
                const garment = svg.querySelector("[data-garment]")?.getAttribute("data-garment") || "";
                const scenes = [...svg.querySelectorAll("[data-scene]")].map((n) => n.getAttribute("data-scene") || "");
                const paths = svg.querySelectorAll("path").length;
                const paints = new Set<string>();
                svg.querySelectorAll("*").forEach((n) => {
                  for (const a of ["fill", "stroke"]) {
                    const v = n.getAttribute(a);
                    if (v && v !== "none") paints.add(v);
                  }
                });
                let sleeveWider = false;
                const sleeve = svg.querySelector("[data-part='sleeve']") as SVGGraphicsElement | null;
                const body = svg.querySelector("[data-part='body']") as SVGGraphicsElement | null;
                try {
                  if (sleeve && body) sleeveWider = sleeve.getBBox().width >= body.getBBox().width * 0.92;
                } catch {
                  /* not rendered */
                }
                const looks = [...document.querySelectorAll(".look")].map((el) => el.getBoundingClientRect().height);
                const parent = svg.parentElement?.getBoundingClientRect();
                const box = svg.getBoundingClientRect();
                const sil = document.querySelector(".look .sil")?.getBoundingClientRect();
                const thumbs = [...document.querySelectorAll(".ticket .thumb")].map((el) => {
                  const b = el.getBoundingClientRect();
                  return { w: b.width, h: b.height };
                });
                return {
                  ok: true as const,
                  parts,
                  garment,
                  scenes,
                  paths,
                  paints: paints.size,
                  sleeveWider,
                  looks,
                  fillW: parent && parent.width ? box.width / parent.width : 0,
                  fillH: parent && parent.height ? box.height / parent.height : 0,
                  silH: sil?.height || 0,
                  viewH: window.innerHeight,
                  thumbs,
                };
              });
              assert.equal(material.ok, true, `${fix.id}/${vp} material svg`);
              assert.ok((material.paths || 0) >= 12, `${fix.id}/${vp} paths ${material.paths}`);
              assert.ok((material.paints || 0) >= 8, `${fix.id}/${vp} paints ${material.paints}`);
              assert.ok((material.fillW || 0) >= 0.92, `${fix.id}/${vp} svg fillW ${material.fillW}`);
              assert.ok((material.fillH || 0) >= 0.88, `${fix.id}/${vp} svg fillH ${material.fillH}`);
              if (fix.id.startsWith("vesti")) {
                assert.ok(
                  ["coat", "dress", "trousers", "skirt"].includes(material.garment || ""),
                  `${fix.id}/${vp} garment ${material.garment}`,
                );
                assert.ok(
                  (material.parts || []).includes("lapel") || (material.parts || []).includes("seam"),
                  `${fix.id}/${vp} parts`,
                );
                if (material.garment === "coat") {
                  assert.equal(material.sleeveWider, true, `${fix.id}/${vp} sleeves must add width beyond the body tube`);
                }
                if (vp === "M") {
                  assert.ok(
                    (material.silH || 0) >= (material.viewH || 0) * 0.4,
                    `${fix.id}/M sil height ${material.silH} vs view ${material.viewH}`,
                  );
                }
                if (vp !== "M") {
                  const looks = material.looks || [];
                  if (looks.length >= 2) {
                    assert.ok(
                      looks[0]! > looks[1]! * 1.35,
                      `${fix.id}/${vp} featured look ${looks[0]} vs ${looks[1]}`,
                    );
                  }
                }
              }
              if (fix.id === "crudo-mare") {
                for (const part of ["plate", "flesh", "citrus", "herb"]) {
                  assert.ok((material.parts || []).includes(part), `${fix.id}/${vp} missing ${part}`);
                }
                for (const thumb of material.thumbs || []) {
                  assert.ok(
                    Math.min(thumb.w, thumb.h) >= 72,
                    `${fix.id}/${vp} ticket thumb ${thumb.w}x${thumb.h}`,
                  );
                }
              }
              if (fix.id === "atelier-carta") {
                assert.ok((material.scenes || []).length >= 1, `${fix.id}/${vp} scene`);
              }
            }
            const tabs = page.locator("button[data-view]");
            if ((await tabs.count()) > 1) {
              await tabs.nth(1).click();
              await tabs.nth(0).click();
            }
            const interactable = page.locator(".btn, .deal, .look, .ticket, .room, .fragrance, .plate").first();
            if ((await interactable.count()) > 0) {
              await interactable.hover();
              const hovered = await interactable.evaluate((el) => el.matches(":hover"));
              assert.equal(hovered, true, `${fix.id}/${vp} hover`);
              const box = await interactable.boundingBox();
              if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                const pressed = await interactable.evaluate(
                  (el) => el.matches(":active") || Boolean(el.querySelector(":active")),
                );
                await page.mouse.up();
                assert.equal(pressed, true, `${fix.id}/${vp} pressed`);
              }
            }
            assert.equal(await page.locator("#load").count(), 1);
            await page.evaluate(() => {
              const n = document.getElementById("load");
              if (n) n.hidden = false;
            });
            assert.equal(await page.locator("#load").isVisible(), true, `${fix.id}/${vp} loading`);
            await page.evaluate(() => {
              const n = document.getElementById("load");
              if (n) n.hidden = true;
            });
            const primary = page.locator("[data-act='advance'], [data-act='wear']").first();
            if ((await primary.count()) > 0) {
              await primary.click();
              await page.waitForFunction(
                () => document.documentElement.getAttribute("data-fenix-flash") === "ok",
                null,
                { timeout: 4000 },
              );
            }
            if (fix.id === "essenza-or" && vp === "D") {
              await page.locator("button[data-view]").nth(2).click();
              for (let i = 0; i < 8; i++) {
                const del = page.locator("[data-act=del]").first();
                if ((await del.count()) === 0) break;
                await del.click();
              }
              await page.locator(".state-empty").waitFor({ timeout: 4000 });
            }
            assert.equal(errors.length, 0, `${fix.id}/${vp} console after interact ${errors.join(" | ")}`);
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
              const nav = await page.evaluate(() => {
                const el = document.querySelector("nav");
                if (!el) return { pos: "none", bottom: 0 };
                const s = getComputedStyle(el);
                return { pos: s.position, bottom: Math.round(el.getBoundingClientRect().bottom) };
              });
              assert.notEqual(nav.pos, "fixed", `${fix.id}/D nav should not be a phone tabbar (${nav.pos})`);
            }
            if (vp === "M" && fix.grammar !== "ops-desk" && fix.grammar !== "magazine") {
              const nav = await page.evaluate(() => {
                const el = document.querySelector("nav");
                if (!el) return { pos: "none", bottom: 0, vh: 0 };
                const r = el.getBoundingClientRect();
                return { pos: getComputedStyle(el).position, bottom: Math.round(r.bottom), vh: window.innerHeight };
              });
              assert.ok(
                nav.pos === "sticky" || nav.pos === "fixed" || nav.bottom >= nav.vh - 80,
                `${fix.id}/M tabbar should sit at the bottom (${nav.pos} bottom=${nav.bottom} vh=${nav.vh})`,
              );
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
