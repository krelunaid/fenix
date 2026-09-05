#!/usr/bin/env node
/**
 * Deterministic NordAcqua proofs for apple-craft-v3.
 * composeProduct + prepareSrcDoc + Playwright. No live Grok.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeProduct } from "../src/lib/ai/compose-product.ts";
import { prepareSrcDoc } from "../src/lib/projects/color-scheme.ts";
import { formatPrefix } from "../src/lib/projects/infer.ts";
import { glossyWaterMarkSvg } from "../src/lib/projects/premium-mark.ts";
import { isolatedPage, launchChromium } from "../src/lib/projects/playwright-harness.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/checkpoints/2026-09-05/apple-craft-v3");
const artDir = "/opt/cursor/artifacts/apple-craft-v3";
mkdirSync(outDir, { recursive: true });
mkdirSync(artDir, { recursive: true });

const brief =
  formatPrefix("app") +
  "NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple. Sfondo #F3F5F8, accento #0A2F6B.";

const product = composeProduct(brief);
let html = prepareSrcDoc(product.html, product.tokens.palette, "nordacqua-v3", "app");
html = html.replace("if(window.Fenix&&window.Fenix.load){", "if(false&&window.Fenix&&window.Fenix.load){");
html = html.replace("<html ", '<html data-fx-splash="hold" ');

const mark = glossyWaterMarkSvg("nordacqua-v3", product.tokens.palette);
const iconPage = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><style>
html,body{margin:0;height:100%;background:#f4f6f8;display:grid;place-items:center}
.card{display:grid;place-items:center;gap:14px}
svg{width:168px;height:168px;filter:drop-shadow(0 18px 28px rgba(10,18,32,.22))}
p{margin:0;font:700 22px/1.1 ui-sans-serif,system-ui,sans-serif;color:#121c2d;letter-spacing:-.03em}
</style></head><body><div class="card">${mark}<p>NordAcqua</p></div></body></html>`;

async function shot(page, name) {
  const file = join(outDir, name);
  await page.screenshot({ path: file, type: "png" });
  writeFileSync(join(artDir, name), await page.screenshot({ type: "png" }));
  console.log("shot", file);
}

const browser = await launchChromium();
try {
  const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForSelector("#fx-splash", { state: "visible", timeout: 8000 });
  await shot(page, "06-splash.png");

  await page.evaluate(() => {
    document.documentElement.removeAttribute("data-fx-splash");
    const splash = document.getElementById("fx-splash");
    if (splash) splash.setAttribute("hidden", "");
  });
  await page.waitForFunction(
    () => {
      const n = document.querySelector(".home-count");
      return n && n.getAttribute("data-count") === "5";
    },
    { timeout: 12000 },
  );
  await page.waitForTimeout(200);
  await shot(page, "01-home.png");

  const tabs = page.locator("nav.tabs button");
  await tabs.nth(4).click();
  await page.waitForSelector(".fx-table", { timeout: 8000 });
  await page.waitForTimeout(160);
  await shot(page, "02-gestione.png");

  await tabs.nth(2).click();
  await page.waitForSelector(".fx-record", { timeout: 8000 });
  await page.waitForTimeout(160);
  await shot(page, "03-storico.png");

  await tabs.nth(3).click();
  await page.waitForSelector(".fx-metric", { timeout: 8000 });
  await page.waitForTimeout(160);
  await shot(page, "04-statistiche.png");

  await page.setContent(iconPage, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(120);
  await shot(page, "05-icon.png");
  await page.close();
} finally {
  await browser.close();
}
