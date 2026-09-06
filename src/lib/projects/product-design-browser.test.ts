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
      ["salon-web", "kind=site sito web barbiere stile iPhone"],
      ["hotel-web", "kind=site sito web hotel"],
      ["collection-web", "kind=site sito web profumi"],
    ]) {
      const result = composeProduct(brief);
      for (const width of [320, 390, 768, 1280]) {
        const page = await isolatedPage(browser, { viewport: { width, height: 844 } });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        try {
          await page.setContent(
            prepareSrcDoc(
              result.html,
              result.tokens.palette,
              `${id}-${width}`,
              result.grammar.kind,
            ),
            { waitUntil: "domcontentloaded" },
          );
          await waitForFenixReady(page, 8000);
          await page.locator("#fx-splash").waitFor({ state: "hidden", timeout: 8000 });
          assert.deepEqual(errors, [], `${id}/${width}`);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert.equal(overflow, false, `${id}/${width} horizontal overflow`);
          if (id.endsWith("-web")) {
            assert.equal(await page.locator("h1").count(), 1);
            assert.equal(await page.locator("main > section").count(), 4);
            assert.equal(await page.locator(".identity svg").count(), 1);
            for (const control of await page.locator("nav a, input, textarea, button").all()) {
              const box = await control.boundingBox();
              assert.ok(box && box.height >= 44, `${id}/${width} touch target`);
            }
          }
          if (out)
            await page.screenshot({
              path: join(out, `${id}-${width}.png`),
              fullPage: id.endsWith("-web"),
            });
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
});

it("saves website requests through the real srcdoc bridge and preserves input on rejected saves", async () => {
  const browser = await launchChromium();
  const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
  const result = composeProduct('kind=site sito web ristorante chiamato "Luce"');
  const srcdoc = prepareSrcDoc(result.html, result.tokens.palette, "website-form", "site");
  try {
    await page.setContent(`<iframe id="f" style="width:100%;height:800px"></iframe><script>
      window.db={};window.fail=false;window.saves=0;
      addEventListener('message',function(e){var m=e.data;if(!m||m.t!=='fenix-db'||!m.id)return;
      if(m.op==='save'&&!window.fail){window.db[m.col]=m.data;window.saves++}
      e.source.postMessage({t:'fenix-db',id:m.id,v:m.op==='load'?(window.db[m.col]||null):{ok:!window.fail,v:m.data}},'*')});
    </script>`);
    await page.locator("#f").evaluate((el, html) => {
      (el as HTMLIFrameElement).srcdoc = html;
    }, srcdoc);
    const frame = page.frameLocator("#f");
    await frame.locator("[data-fenix-ready]").waitFor({ state: "attached" });
    await frame.getByLabel("Nome", { exact: true }).fill("Persona test");
    await frame.getByLabel("Email", { exact: true }).fill("fixture@example.test");
    await frame.getByLabel("Messaggio", { exact: true }).fill("Informazioni sul menu");
    await frame.getByRole("button", { name: "Salva richiesta" }).click();
    await frame.getByRole("status").filter({ hasText: "Richiesta salvata." }).waitFor();
    assert.equal(await page.evaluate(() => (window as any).db["website-requests"].items.length), 1);
    assert.equal(await frame.getByLabel("Nome", { exact: true }).inputValue(), "");
    await page.evaluate(() => {
      (window as any).fail = true;
    });
    await frame.getByLabel("Nome", { exact: true }).fill("Seconda persona");
    await frame.getByLabel("Email", { exact: true }).fill("second@example.test");
    await frame.getByLabel("Messaggio", { exact: true }).fill("Testo da conservare");
    await frame.getByRole("button", { name: "Salva richiesta" }).click();
    await frame.getByRole("status").filter({ hasText: "Non è stato possibile salvare" }).waitFor();
    assert.equal(
      await frame.getByLabel("Messaggio", { exact: true }).inputValue(),
      "Testo da conservare",
    );
    assert.equal(await page.evaluate(() => (window as any).saves), 1);
    assert.equal(await frame.getByRole("button", { name: "Salva richiesta" }).isEnabled(), true);
    await page.evaluate(() => {
      (window as any).fail = false;
    });
    await frame.getByRole("button", { name: "Salva richiesta" }).click();
    await frame.getByRole("status").filter({ hasText: "Richiesta salvata." }).waitFor();
    assert.equal(await page.evaluate(() => (window as any).db["website-requests"].items.length), 2);
  } finally {
    await page.close();
    await browser.close();
  }
});
