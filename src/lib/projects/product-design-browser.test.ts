import assert from "node:assert/strict";
import { it } from "node:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { composeProduct } from "../ai/compose-product.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { isolatedPage, launchChromium } from "./playwright-harness.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";

it("renders shared system on distinct app and website seeds at four widths", async () => {
  const out = process.env.FENIX_DESIGN_SHOTS;
  if (out) mkdirSync(out, { recursive: true });
  const browser = await launchChromium();
  try {
    for (const [id, brief] of [
      ["barber", "kind=app barbiere prenotazioni stile iPhone"],
      ["perfume", "kind=app profumi gestione flaconi"],
      ["food-web", "kind=site sito web ristorante cucina stagionale"],
      ["portfolio-web", "kind=site sito web portfolio fotografo"],
    ]) {
      const result = composeProduct(brief);
      for (const width of [320, 390, 768, 1280]) {
        const page = await isolatedPage(browser, { viewport: { width, height: 844 } });
        const errors: string[] = [];
        page.on("pageerror", e => errors.push(e.message));
        try {
          await page.setContent(prepareSrcDoc(result.html, result.tokens.palette, `${id}-${width}`, result.grammar.kind), { waitUntil: "domcontentloaded" });
          await waitForFenixReady(page, 8000);
          await page.locator("#fx-splash").waitFor({ state: "hidden", timeout: 8000 });
          assert.deepEqual(errors, [], `${id}/${width}`);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          assert.equal(overflow, false, `${id}/${width} horizontal overflow`);
          if (out) await page.screenshot({ path: join(out, `${id}-${width}.png`) });
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
});
