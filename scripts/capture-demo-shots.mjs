#!/usr/bin/env node
/**
 * Capture craft fixture PNGs. Always waits for [data-fenix-ready].
 * No Fenix generation, no credits.
 *
 *   node --experimental-strip-types scripts/capture-demo-shots.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { screenshotWhenReady } from "./fenix-ready.mjs";
import { DEMOS } from "../src/lib/projects/demos.ts";
import { prepareSrcDoc } from "../src/lib/projects/color-scheme.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src/lib/projects/fixtures/shots");

const FRAMES = [
  ["catenaria", 1280, 800],
  ["catenaria", 390, 844],
  ["kiln", 1280, 800],
  ["kiln", 390, 844],
  ["grottaglie", 390, 844],
  ["grottaglie", 1280, 800],
  ["corvo", 390, 844],
  ["corvo", 1280, 800],
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const [id, width, height] of FRAMES) {
    const demo = DEMOS[id];
    if (!demo) throw new Error(`unknown demo ${id}`);
    const src = prepareSrcDoc(demo.html, demo.palette, id, demo.kind);
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
    const file = join(outDir, `${id}-${width}.png`);
    await screenshotWhenReady(page, file);
    await page.close();
    console.log("shot", file);
  }
} finally {
  await browser.close();
}
