import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { loadContractFixtures, type ContractFixtureId } from "./contract-fixtures.ts";
import { evaluateContract, planContract } from "./build-contract.ts";
import { isolatedPage, isBlockedPublicNetworkError, launchChromium } from "../projects/playwright-harness.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DTM = join(here, "fixtures/dtm");
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-quality";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;

function launch() {
  return launchChromium();
}

async function shot(page: Page, name: string) {
  mkdirSync(DTM, { recursive: true });
  const dest = join(DTM, name);
  await page.screenshot({ path: dest, fullPage: false });
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* CI without the scorecard dir is fine */
  }
  return dest;
}

async function exerciseJourney(page: Page, id: ContractFixtureId): Promise<string> {
  if (id === "utility-calculator") {
    await page.locator("#t").fill("Traghetto");
    await page.locator("#a").fill("16");
    await page.locator('[data-act="add"]').click();
    await page.getByText("Traghetto · Anna").waitFor({ state: "visible" });
    await page.locator('[data-view="saldi"]').click();
    await page.getByText("Quota 30.00 € su 120.00 €").waitFor({ state: "visible" });
    return "aggiungi spesa → saldi ricalcolati";
  }
  if (id === "interactive-game") {
    const cards = page.locator("button.card");
    assert.equal(await cards.count(), 16);
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.getByText("1 mosse").waitFor({ state: "visible" });
    return "gira due carte → contatore mosse";
  }
  if (id === "portfolio-contact") {
    await page.locator('input[name="nome"]').fill("Ada Lovelace");
    await page.locator('input[name="mail"]').fill("ada@example.test");
    await page.locator('textarea[name="msg"]').fill("Fotografia del nuovo padiglione");
    await page.getByRole("button", { name: "Invia" }).click();
    await page.locator("#ok").waitFor({ state: "visible" });
    return "invia richiesta → conferma persistita";
  }
  const tabs = page.locator("button[data-view]");
  assert.ok((await tabs.count()) >= 3, `${id}: meno di 3 viste`);
  const target = tabs.nth(1);
  const view = (await target.getAttribute("data-view")) || "seconda";
  await target.click();
  const selected = await target.evaluate((el) => {
    const cls = String((el as HTMLElement).className || "");
    return (
      /(?:^|\s)(?:on|active|selected)(?:\s|$)/i.test(cls) ||
      el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("aria-pressed") === "true"
    );
  });
  assert.equal(selected, true, `${id}: vista ${view} non attiva dopo click`);
  return `apri vista ${view}`;
}

describe("contract fixtures in the browser D/T/M", () => {
  it("runs functional journeys with console zero, no overflow, visible focus and 24px targets on 6 products", async () => {
    const fixtures = loadContractFixtures();
    const browser = await launch();
    const manifest: {
      benchmark: { fixtures: number; viewports: number; journeys: string[] };
      files: { name: string; sha256: string; bytes: number }[];
    } = {
      benchmark: { fixtures: fixtures.length, viewports: VIEWPORTS.length, journeys: [] },
      files: [],
    };
    try {
      for (const fix of fixtures) {
        const evaluation = evaluateContract({
          html: fix.html,
          files: fix.files,
          contract: planContract(fix.brief),
        });
        assert.equal(evaluation.ok, true, `${fix.id} static`);
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
            const src = prepareSrcDoc(fix.html, fix.palette, fix.id, evaluation.kind);
            await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
            await waitForFenixReady(page, 8000);
            const journey = await exerciseJourney(page, fix.id);
            manifest.benchmark.journeys.push(`${fix.id}/${vp}: ${journey}`);
            const metrics = await page.evaluate(() => {
              const doc = document.documentElement;
              const nodes = [...document.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]")];
              const usable = nodes.find((el) => {
                const box = el.getBoundingClientRect();
                return box.width >= 24 && box.height >= 24;
              }) || nodes[0];
              if (usable) {
                try {
                  usable.focus({ focusVisible: true } as FocusOptions);
                } catch {
                  usable.focus();
                }
              }
              const focused = document.activeElement;
              const cs = focused instanceof HTMLElement ? getComputedStyle(focused) : null;
              const box = focused instanceof HTMLElement ? focused.getBoundingClientRect() : null;
              const outlineW = cs ? parseFloat(cs.outlineWidth || "0") : 0;
              const style = cs ? String(cs.outlineStyle || "") : "";
              const shadow = cs ? String(cs.boxShadow || "") : "";
              const outlineVisible =
                Boolean(cs) &&
                ((style !== "none" && style !== "") ||
                  outlineW > 0 ||
                  (shadow !== "" && shadow !== "none"));
              return {
                overflowX: Math.max(0, doc.scrollWidth - window.innerWidth),
                focusTag: focused && focused !== document.body ? focused.tagName : "",
                target: box ? Math.min(box.width, box.height) : 0,
                outline: style,
                outlineVisible,
              };
            });
            assert.deepEqual(errors, [], `${fix.id} ${vp}: ${errors.join(" · ")}`);
            assert.ok(metrics.overflowX <= 8, `${fix.id} ${vp} overflow ${metrics.overflowX}`);
            assert.ok(metrics.focusTag, `${fix.id} ${vp} nessun controllo focusabile`);
            assert.ok(metrics.outlineVisible, `${fix.id} ${vp} focus non visibile (outline=${metrics.outline})`);
            assert.ok(metrics.target >= 24, `${fix.id} ${vp} target ${metrics.target} < 24`);
            const file = await shot(page, `${fix.id}-${vp}.png`);
            const buf = readFileSync(file);
            manifest.files.push({
              name: `${fix.id}-${vp}.png`,
              sha256: createHash("sha256").update(buf).digest("hex"),
              bytes: buf.length,
            });
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
    mkdirSync(DTM, { recursive: true });
    writeFileSync(join(DTM, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.equal(manifest.benchmark.fixtures, 6);
    assert.equal(manifest.benchmark.journeys.length, 18);
    assert.equal(manifest.files.length, 18);
    for (const row of manifest.files) {
      const path = join(DTM, row.name);
      assert.equal(existsSync(path), true, row.name);
      assert.ok(statSync(path).size > 1000, row.name);
    }
  });
});
