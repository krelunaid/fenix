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
const PALETTE_SHOTS = join(here, "fixtures/graphic/palette");
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-graphic-pipeline";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;

async function shot(page: Page, name: string, dir = SHOTS) {
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, name);
  await page.screenshot({ path: dest, fullPage: false });
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* CI without scorecard dir */
  }
  return dest;
}

type PaintFingerprint = { hist: number[]; mean: [number, number, number]; paints: number };

function fingerprintDistance(a: PaintFingerprint, b: PaintFingerprint): number {
  let hist = 0;
  const n = Math.max(a.hist.length, b.hist.length);
  for (let i = 0; i < n; i++) hist += Math.abs((a.hist[i] || 0) - (b.hist[i] || 0));
  const mean =
    Math.abs(a.mean[0] - b.mean[0]) + Math.abs(a.mean[1] - b.mean[1]) + Math.abs(a.mean[2] - b.mean[2]);
  return hist + mean * 6;
}

async function paintFingerprints(page: Page, selector: string): Promise<PaintFingerprint[]> {
  return page.evaluate(async (sel) => {
    const roots = [...document.querySelectorAll(sel)];
    const out: { hist: number[]; mean: [number, number, number]; paints: number }[] = [];
    for (const root of roots) {
      const svg = (root.tagName.toLowerCase() === "svg" ? root : root.querySelector("svg")) as SVGSVGElement | null;
      if (!svg) continue;
      const paints = new Set<string>();
      svg.querySelectorAll("*").forEach((n) => {
        for (const a of ["fill", "stroke"]) {
          const v = n.getAttribute(a);
          if (v && v !== "none") paints.add(v.toLowerCase());
        }
      });
      const xml = new XMLSerializer().serializeToString(svg);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
      });
      const hist = new Array(24).fill(0);
      let rS = 0;
      let gS = 0;
      let bS = 0;
      let n = 0;
      if (img) {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 36;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, 48, 36);
          const data = ctx.getImageData(0, 0, 48, 36).data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i]!;
            const g = data[i + 1]!;
            const b = data[i + 2]!;
            const a = data[i + 3]!;
            if (a < 16) continue;
            rS += r;
            gS += g;
            bS += b;
            n += 1;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const lum = (max + min) / 2;
            let hue = 0;
            if (max !== min) {
              const d = max - min;
              if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
              else if (max === g) hue = ((b - r) / d + 2) / 6;
              else hue = ((r - g) / d + 4) / 6;
            }
            const hi = Math.min(7, Math.floor(hue * 8));
            const li = lum < 85 ? 0 : lum < 170 ? 1 : 2;
            hist[hi * 3 + li] += 1;
          }
        }
      }
      out.push({
        hist,
        mean: n ? [rS / n, gS / n, bS / n] : [0, 0, 0],
        paints: paints.size,
      });
    }
    return out;
  }, selector);
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
                const looks = [...document.querySelectorAll(".look")].map((el) => {
                  const b = el.getBoundingClientRect();
                  const title = el.querySelector("h2")?.textContent || "";
                  const garment = el.querySelector("[data-garment]")?.getAttribute("data-garment") || "";
                  const h2 = el.querySelector("h2")?.getBoundingClientRect();
                  const parts = [...el.querySelectorAll("[data-part]")].map((n) => n.getAttribute("data-part") || "");
                  const legs = [...el.querySelectorAll("[data-part='leg']")].map((n) => {
                    try {
                      const box = (n as SVGGraphicsElement).getBBox();
                      return { x: box.x, w: box.width };
                    } catch {
                      return { x: 0, w: 0 };
                    }
                  });
                  const sil = el.querySelector(".sil")?.getBoundingClientRect();
                  const svg = el.querySelector("svg")?.getBoundingClientRect();
                  return {
                    h: b.height,
                    title,
                    garment,
                    parts,
                    legs,
                    titleH: h2?.height || 0,
                    titleW: h2?.width || 0,
                    titleTop: h2?.top || 0,
                    silBottom: sil?.bottom || 0,
                    silH: sil?.height || 0,
                    svgH: svg?.height || 0,
                    top: b.top,
                    left: b.left,
                    right: b.right,
                    bottom: b.bottom,
                  };
                });
                const tickets = [...document.querySelectorAll(".ticket")].map((el) => {
                  const title = el.querySelector("h2")?.textContent || "";
                  const dish = el.querySelector("[data-dish]")?.getAttribute("data-dish") || "";
                  const h2 = el.querySelector("h2")?.getBoundingClientRect();
                  return { title, dish, titleH: h2?.height || 0, titleW: h2?.width || 0 };
                });
                const plates = [...document.querySelectorAll("#lastre .plate")].map((el) => {
                  const title = el.querySelector("h2")?.textContent || "";
                  const scene = el.querySelector("[data-scene]")?.getAttribute("data-scene") || "";
                  const h2 = el.querySelector("h2")?.getBoundingClientRect();
                  const parts = [...el.querySelectorAll("[data-part]")].map((n) => n.getAttribute("data-part") || "");
                  return { title, scene, parts, titleH: h2?.height || 0, titleW: h2?.width || 0 };
                });
                let shoulderWaist = { shoulder: 0, waist: 0 };
                const shoulder = svg.querySelector("[data-part='shoulder']") as SVGGraphicsElement | null;
                const waist = svg.querySelector("[data-part='waist']") as SVGGraphicsElement | null;
                try {
                  if (shoulder) shoulderWaist.shoulder = shoulder.getBBox().width;
                  if (waist) shoulderWaist.waist = waist.getBBox().width;
                } catch {
                  /* not rendered */
                }
                const legs = [...svg.querySelectorAll("[data-part='leg']")].map((n) => {
                  try {
                    const b = (n as SVGGraphicsElement).getBBox();
                    return { x: b.x, w: b.width };
                  } catch {
                    return { x: 0, w: 0 };
                  }
                });
                const parent = svg.parentElement?.getBoundingClientRect();
                const box = svg.getBoundingClientRect();
                const sil = document.querySelector(".look .sil")?.getBoundingClientRect();
                const thumbs = [...document.querySelectorAll(".ticket .thumb")].map((el) => {
                  const b = el.getBoundingClientRect();
                  return { w: b.width, h: b.height };
                });
                const nav = document.querySelector("nav")?.getBoundingClientRect();
                const firstTitle = document.querySelector(".look h2, .ticket h2, #copertina h2, .plate h2")?.getBoundingClientRect();
                return {
                  ok: true as const,
                  parts,
                  garment,
                  dish: svg.querySelector("[data-dish]")?.getAttribute("data-dish") || "",
                  scenes,
                  paths,
                  paints: paints.size,
                  sleeveWider,
                  looks,
                  tickets,
                  plates,
                  shoulderWaist,
                  legs,
                  fillW: parent && parent.width ? box.width / parent.width : 0,
                  fillH: parent && parent.height ? box.height / parent.height : 0,
                  silH: sil?.height || 0,
                  viewH: window.innerHeight,
                  thumbs,
                  navTop: nav?.top || 0,
                  firstTitleBottom: firstTitle?.bottom || 0,
                  firstTitleH: firstTitle?.height || 0,
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
                  assert.ok(
                    (material.shoulderWaist?.shoulder || 0) > (material.shoulderWaist?.waist || 0) * 1.08,
                    `${fix.id}/${vp} coat shoulder ${material.shoulderWaist?.shoulder} vs waist ${material.shoulderWaist?.waist}`,
                  );
                }
                if (material.garment === "trousers" && (material.legs || []).length >= 2) {
                  const [a, b] = material.legs;
                  const left = a!.x <= b!.x ? a! : b!;
                  const right = a!.x <= b!.x ? b! : a!;
                  assert.ok(
                    right.x > left.x + left.w * 0.18,
                    `${fix.id}/${vp} trousers legs must leave a gap ${JSON.stringify(material.legs)}`,
                  );
                }
                const looks = material.looks || [];
                for (const look of looks) {
                  assert.ok(look.titleH >= 14 && look.titleW >= 48, `${fix.id}/${vp} look title unreadable ${look.title} ${look.titleW}x${look.titleH}`);
                  if (look.silBottom && look.titleTop) {
                    assert.ok(
                      look.titleTop + 1 >= look.silBottom - 8,
                      `${fix.id}/${vp} title overlay on ${look.garment} (title ${look.titleTop} sil ${look.silBottom})`,
                    );
                  }
                  const expected =
                    /cappotto/i.test(look.title) ? "coat"
                    : /abito|colonna/i.test(look.title) ? "dress"
                    : /pantalone/i.test(look.title) ? "trousers"
                    : /gonna/i.test(look.title) ? "skirt"
                    : "";
                  if (expected) {
                    assert.equal(look.garment, expected, `${fix.id}/${vp} ${look.title} -> ${look.garment}`);
                  }
                  if (look.garment === "trousers") {
                    assert.ok((look.parts || []).includes("seat"), `${fix.id}/${vp} trousers missing seat`);
                    assert.ok((look.parts || []).includes("drape"), `${fix.id}/${vp} trousers missing drape`);
                    if ((look.legs || []).length >= 2) {
                      const [a, b] = look.legs;
                      const left = a!.x <= b!.x ? a! : b!;
                      const right = a!.x <= b!.x ? b! : a!;
                      assert.ok(
                        right.x > left.x + left.w * 0.22,
                        `${fix.id}/${vp} trousers look legs gap ${JSON.stringify(look.legs)}`,
                      );
                    }
                  }
                  if (look.garment === "dress") {
                    assert.ok((look.parts || []).includes("hip") && (look.parts || []).includes("column"), `${fix.id}/${vp} dress parts`);
                  }
                }
                assert.ok(new Set(looks.map((l) => l.garment).filter(Boolean)).size >= Math.min(3, looks.length), `${fix.id}/${vp} garment diversity`);
                if (vp !== "M" && looks.length >= 2) {
                  const fps = await paintFingerprints(page, ".look .sil svg");
                  if (fps.length >= 2) {
                    for (let i = 0; i < fps.length; i++) {
                      for (let j = i + 1; j < fps.length; j++) {
                        const d = fingerprintDistance(fps[i]!, fps[j]!);
                        assert.ok(
                          d >= 28,
                          `${fix.id}/${vp} look ${i}/${j} look the same (dist ${d.toFixed(1)})`,
                        );
                      }
                    }
                  }
                }
                for (let i = 0; i < looks.length; i++) {
                  for (let j = i + 1; j < looks.length; j++) {
                    const a = looks[i]!;
                    const b = looks[j]!;
                    const overlap = !(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
                    if (overlap) {
                      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                      assert.ok(w * h < 24, `${fix.id}/${vp} look overlap ${w * h}`);
                    }
                  }
                }
                if (vp === "M") {
                  assert.ok(
                    (material.silH || 0) >= (material.viewH || 0) * 0.4,
                    `${fix.id}/M sil height ${material.silH} vs view ${material.viewH}`,
                  );
                }
                if (vp !== "M") {
                  if (looks.length >= 2) {
                    assert.ok(
                      looks[0]!.h > looks[1]!.h * 1.35,
                      `${fix.id}/${vp} featured look ${looks[0]!.h} vs ${looks[1]!.h}`,
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
                const tickets = material.tickets || [];
                assert.ok(tickets.length >= 4, `${fix.id}/${vp} tickets ${tickets.length}`);
                for (const t of tickets) {
                  assert.ok(t.titleH >= 14 && t.titleW >= 48, `${fix.id}/${vp} ticket title unreadable ${t.title}`);
                  const expected =
                    /ricciola/i.test(t.title) ? "ricciola"
                    : /gambero/i.test(t.title) ? "gambero"
                    : /ostrica/i.test(t.title) ? "ostrica"
                    : /tonno/i.test(t.title) ? "tonno"
                    : "";
                  if (expected) assert.equal(t.dish, expected, `${fix.id}/${vp} ${t.title} -> ${t.dish}`);
                }
                assert.equal(new Set(tickets.map((t) => t.dish)).size, tickets.length, `${fix.id}/${vp} dish diversity ${tickets.map((t) => t.dish)}`);
                if (vp !== "M") {
                  const fps = await paintFingerprints(page, ".ticket .thumb svg");
                  assert.ok(fps.length >= 4, `${fix.id}/${vp} ticket fingerprints ${fps.length}`);
                  for (let i = 0; i < fps.length; i++) {
                    for (let j = i + 1; j < fps.length; j++) {
                      const d = fingerprintDistance(fps[i]!, fps[j]!);
                      assert.ok(
                        d >= 48,
                        `${fix.id}/${vp} ticket ${i}/${j} look the same (dist ${d.toFixed(1)})`,
                      );
                    }
                  }
                }
              }
              if (fix.id === "atelier-carta") {
                assert.ok((material.scenes || []).length >= 1, `${fix.id}/${vp} scene`);
                const plates = material.plates || [];
                for (const p of plates) {
                  assert.ok(p.titleH >= 14 && p.titleW >= 40, `${fix.id}/${vp} plate title unreadable ${p.title} ${p.titleW}x${p.titleH}`);
                  const expected =
                    /pozzo/i.test(p.title) ? "pozzo"
                    : /olivo/i.test(p.title) ? "olivo"
                    : /fienile/i.test(p.title) ? "fienile"
                    : "";
                  if (expected) assert.equal(p.scene, expected, `${fix.id}/${vp} ${p.title} -> ${p.scene}`);
                  if (p.scene === "olivo") {
                    assert.ok((p.parts || []).includes("grove"), `${fix.id}/${vp} olivo missing grove`);
                    assert.ok((p.parts || []).includes("terrace"), `${fix.id}/${vp} olivo missing terrace`);
                    assert.equal((p.parts || []).includes("canopy"), false, `${fix.id}/${vp} olivo still a lollipop canopy`);
                  }
                }
                if (plates.length >= 3) {
                  assert.equal(new Set(plates.map((p) => p.scene)).size, plates.length, `${fix.id}/${vp} scene diversity`);
                }
                if (vp !== "M") {
                  const fps = await paintFingerprints(page, "#lastre .plate svg");
                  if (fps.length >= 2) {
                    for (let i = 0; i < fps.length; i++) {
                      for (let j = i + 1; j < fps.length; j++) {
                        const d = fingerprintDistance(fps[i]!, fps[j]!);
                        assert.ok(
                          d >= 36,
                          `${fix.id}/${vp} plate ${i}/${j} look the same (dist ${d.toFixed(1)})`,
                        );
                      }
                    }
                  }
                }
              }
              if (material.firstTitleH && material.navTop) {
                assert.ok(
                  material.firstTitleBottom <= material.navTop + 8 || material.firstTitleH >= 14,
                  `${fix.id}/${vp} title under nav`,
                );
              }
            }
            if (["locanda-pietra", "hotel-notte"].includes(fix.id)) {
              const rooms = await page.evaluate(() =>
                [...document.querySelectorAll(".room")].map((el) => {
                  const h2 = el.querySelector("h2")?.getBoundingClientRect();
                  return {
                    title: el.querySelector("h2")?.textContent || "",
                    room: el.querySelector("[data-room]")?.getAttribute("data-room") || "",
                    parts: [...el.querySelectorAll("[data-part]")].map((n) => n.getAttribute("data-part") || ""),
                    titleH: h2?.height || 0,
                    titleW: h2?.width || 0,
                  };
                }),
              );
              assert.ok(rooms.length >= 4, `${fix.id}/${vp} rooms ${rooms.length}`);
              for (const r of rooms) {
                assert.ok(r.titleH >= 14 && r.titleW >= 40, `${fix.id}/${vp} room title ${r.title} ${r.titleW}x${r.titleH}`);
                const expected = /pozzo/i.test(r.title)
                  ? "pozzo"
                  : /olivo/i.test(r.title)
                    ? "olivo"
                    : /fienile/i.test(r.title)
                      ? "fienile"
                      : /salice/i.test(r.title)
                        ? "salice"
                        : /champagne/i.test(r.title)
                          ? "champagne"
                          : /inchiostro/i.test(r.title)
                            ? "inchiostro"
                            : /attico/i.test(r.title)
                              ? "attico"
                              : /silenzio/i.test(r.title)
                                ? "silenzio"
                                : "";
                if (expected) assert.equal(r.room, expected, `${fix.id}/${vp} ${r.title} -> ${r.room}`);
              }
              assert.ok(new Set(rooms.map((r) => r.room).filter(Boolean)).size >= 4, `${fix.id}/${vp} room diversity`);
              if (vp !== "M") {
                const fps = await paintFingerprints(page, ".room .thumb svg");
                if (fps.length >= 2) {
                  for (let i = 0; i < fps.length; i++) {
                    for (let j = i + 1; j < fps.length; j++) {
                      const d = fingerprintDistance(fps[i]!, fps[j]!);
                      assert.ok(d >= 24, `${fix.id}/${vp} room ${i}/${j} look the same (dist ${d.toFixed(1)})`);
                    }
                  }
                }
              }
            }
            if (fix.id === "essenza-or" || fix.id === "essenza-ice") {
              const frags = await page.evaluate(() =>
                [...document.querySelectorAll(".fragrance")].map((el) => ({
                  title: el.querySelector("h2")?.textContent || "",
                  bottle: el.querySelector("[data-bottle]")?.getAttribute("data-bottle") || "",
                })),
              );
              assert.ok(frags.length >= 4, `${fix.id}/${vp} bottles ${frags.length}`);
              for (const f of frags) {
                const ice = fix.id === "essenza-ice";
                let expected = "";
                if (/nuit|sale adriatico/i.test(f.title)) expected = ice ? "sale" : "nuit";
                else if (/acqua|nebbia/i.test(f.title)) expected = ice ? "nebbia" : "acqua";
                else if (/fleur|pino/i.test(f.title)) expected = ice ? "pino" : "fleur";
                else if (/pelle|vetro/i.test(f.title)) expected = ice ? "vetro" : "pelle";
                if (expected) assert.equal(f.bottle, expected, `${fix.id}/${vp} ${f.title} -> ${f.bottle}`);
              }
              assert.ok(new Set(frags.map((f) => f.bottle).filter(Boolean)).size >= 4, `${fix.id}/${vp} bottle diversity`);
            }
            if (fix.id === "nord-desk") {
              const desk = await page.evaluate(() => {
                const sparks = [...document.querySelectorAll(".kpi .spark")].map((s) =>
                  [...s.querySelectorAll("i")].map((i) => (i as HTMLElement).style.height || "").join("|"),
                );
                const lanes = [...document.querySelectorAll("[data-lane]")].map((n) => n.getAttribute("data-lane") || "");
                const kpis = [...document.querySelectorAll("[data-kpi]")].map((n) => n.getAttribute("data-kpi") || "");
                return { sparks, lanes, kpis };
              });
              assert.ok(desk.sparks.length >= 3, `${fix.id}/${vp} sparks ${desk.sparks.length}`);
              assert.ok(new Set(desk.sparks).size >= 3, `${fix.id}/${vp} cloned sparks ${desk.sparks.join(" / ")}`);
              assert.equal(new Set(desk.lanes.filter(Boolean)).size, 4, `${fix.id}/${vp} lanes ${desk.lanes}`);
              assert.ok(desk.kpis.includes("book") && desk.kpis.includes("ticket"), `${fix.id}/${vp} kpi ${desk.kpis}`);
            }
            const tabs = page.locator("button[data-view]");
            if ((await tabs.count()) > 1) {
              await tabs.nth(1).click();
              await tabs.nth(0).click();
            }
            const interactable = page.locator(".btn, .deal, .look, .ticket, .room, .fragrance, .plate, .commit").first();
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
            if (vp === "M" && fix.grammar !== "ops-desk" && fix.grammar !== "magazine" && fix.grammar !== "source-timeline") {
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

  it("captures RepoVoci and five distant domains on D/T/M with distinct palettes", async () => {
    const { composeProduct } = await import("./compose-product.ts");
    const { PALETTE_CORPUS } = await import("../projects/palette-engine.ts");
    const ids = ["repo-voci", "clinica", "pulse", "carta-luce", "pastello", "segnale"];
    const rows = PALETTE_CORPUS.filter((r) => ids.includes(r.id));
    assert.equal(rows.length, 6);
    const browser = await launchChromium();
    const palettes: string[] = [];
    try {
      for (const row of rows) {
        const composed = composeProduct(row.brief);
        palettes.push(`${composed.tokens.palette.bg}:${composed.tokens.palette.accent}`);
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
            const src = prepareSrcDoc(composed.html, composed.tokens.palette, row.id, composed.grammar.kind);
            await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
            await waitForFenixReady(page, 8000);
            await shot(page, `${row.id}-${vp}.png`, PALETTE_SHOTS);
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            assert.ok(overflow <= 8, `${row.id}/${vp} overflow ${overflow}`);
            assert.equal(errors.length, 0, `${row.id}/${vp} ${errors.join(" | ")}`);
            if (row.id === "repo-voci") {
              assert.ok((await page.locator(".commit").count()) >= 3, `${row.id} commits`);
              assert.equal(await page.locator(".kpi").count(), 0);
              assert.ok((await page.locator("[data-repo-stage]").count()) >= 1);
            }
            const tabs = page.locator("button[data-view]");
            if ((await tabs.count()) > 1) {
              await tabs.nth(1).click();
              await tabs.nth(0).click();
            }
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
    assert.equal(new Set(palettes).size, palettes.length, palettes.join(" | "));
    mkdirSync(PALETTE_SHOTS, { recursive: true });
    writeFileSync(
      join(PALETTE_SHOTS, "manifest.json"),
      `${JSON.stringify({ files: palettes, note: "adaptive palette + anti-template D/T/M" }, null, 2)}\n`,
    );
  });
});
