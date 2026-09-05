#!/usr/bin/env node
/**
 * v5 proofs: water vs marketplace vs shop — shared slots, distinct palettes.
 * composeProduct + prepareSrcDoc + Playwright. No live Grok.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeProduct } from "../src/lib/ai/compose-product.ts";
import { prepareSrcDoc } from "../src/lib/projects/color-scheme.ts";
import { formatPrefix } from "../src/lib/projects/infer.ts";
import { isolatedPage, launchChromium } from "../src/lib/projects/playwright-harness.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/checkpoints/2026-09-05/apple-craft-v5");
const artDir = "/opt/cursor/artifacts/apple-craft-v5";
mkdirSync(outDir, { recursive: true });
mkdirSync(artDir, { recursive: true });

function prepare(brief, id) {
  const product = composeProduct(brief);
  let html = prepareSrcDoc(product.html, product.tokens.palette, id, "app");
  html = html.replace("if(window.Fenix&&window.Fenix.load){", "if(false&&window.Fenix&&window.Fenix.load){");
  html = html.replace("<html ", '<html data-fx-splash="hold" ');
  return html;
}

const water = prepare(
  formatPrefix("app") +
    "NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple. Sfondo #F3F5F8, accento #0A2F6B.",
  "nordacqua-v5",
);
const market = prepare(
  formatPrefix("app") + "Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.",
  "vicina-v5",
);
const shop = prepare(
  formatPrefix("app") + "Emporio Luce: negozio di lampade da tavolo, stile Apple.",
  "emporio-v5",
);

async function shot(page, name) {
  const file = join(outDir, name);
  const buf = await page.screenshot({ type: "png" });
  writeFileSync(file, buf);
  try {
    writeFileSync(join(artDir, name), buf);
  } catch {
    /* artifacts volume can flake; repo proofs are enough */
  }
  console.log("shot", file);
}

async function boot(page, html, count) {
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    document.documentElement.removeAttribute("data-fx-splash");
    const splash = document.getElementById("fx-splash");
    if (splash) splash.setAttribute("hidden", "");
  });
  await page.waitForFunction(
    (n) => {
      const el = document.querySelector(".home-count");
      return el && el.getAttribute("data-count") === String(n);
    },
    String(count),
    { timeout: 20000 },
  );
  await page.waitForTimeout(200);
}

const browser = await launchChromium();
try {
  const waterPage = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
  await boot(waterPage, water, 5);
  await shot(waterPage, "01-water-home.png");
  await waterPage.close();

  const marketPage = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
  await boot(marketPage, market, 4);
  await shot(marketPage, "02-market-home.png");
  await marketPage.locator("nav.tabs button").nth(2).click();
  await marketPage.waitForSelector(".list-pane .fx-task", { timeout: 8000 });
  await marketPage.waitForTimeout(160);
  await shot(marketPage, "03-market-activity.png");
  await marketPage.close();

  const shopPage = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
  await boot(shopPage, shop, 2);
  await shot(shopPage, "04-shop-home.png");
  await shopPage.close();
} finally {
  await browser.close();
}
