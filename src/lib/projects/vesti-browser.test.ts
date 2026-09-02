import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isBlockedPublicNetworkError, launchChromium } from "./playwright-harness.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { planContract, evaluateContract } from "../ai/build-contract.ts";
import { formatPrefix } from "./infer.ts";
import { canPublishHtml } from "./validate-html.ts";
import { blocksPublish } from "../ai/build-contract.ts";
import { isPublishable } from "./recover.ts";
import { rewriteFenixCollections } from "./fenix-collection.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID = readFileSync(join(here, "fixtures/vesti.html"), "utf8");
const PRODUCTION = readFileSync(join(here, "fixtures/vesti-production.html"), "utf8");
const INVALID = readFileSync(join(here, "fixtures/vesti-invalid-collection.html"), "utf8");
const SLASH = INVALID.replace('var COL = "capi vesti"', 'var COL = "capi/abiti"');
const SHOTS = join(here, "fixtures/shots/vesti");
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;
const PALETTE = { bg: "#f3ead8", fg: "#1c1712", surface: "#fff8ec", muted: "#5c5348", accent: "#8c2f1b" };

function launch() {
  return launchChromium();
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  const dest = join(SHOTS, name);
  await page.screenshot({ path: dest, fullPage: false });
  return dest;
}

describe("Vesti collection gate in the browser D/T/M", () => {
  it("rewrites production COL=capi vesti, runs persistent CRUD, and blocks slash collections", async () => {
    const brief = `${formatPrefix("app")}Vesti: armadio di casa, registra i capi.`;
    const contract = planContract(brief);
    assert.match(PRODUCTION, /var COL = "capi vesti"/);
    const rewritten = rewriteFenixCollections(PRODUCTION);
    assert.match(rewritten, /var COL = "capi"/);
    const evaluation = evaluateContract({
      html: PRODUCTION,
      files: [{ path: "index.html", content: PRODUCTION }],
      contract,
      kind: "app",
    });
    assert.equal(evaluation.ok, true, evaluation.checks.filter((c) => !c.ok).map((c) => c.id).join(","));
    assert.equal(canPublishHtml(SLASH, "app", "vesti-slash"), false);
    assert.match(blocksPublish(SLASH, "app", undefined, brief), /collezione non valido/);
    assert.equal(isPublishable({ status: "ready", html: SLASH, kind: "app", prompt: brief }), false);

    const browser = await launch();
    const manifest: {
      product: string;
      collection: string;
      viewports: string[];
      files: { name: string; sha256: string; bytes: number }[];
      credits: number;
    } = {
      product: "Vesti",
      collection: "capi",
      viewports: [],
      files: [],
      credits: 0,
    };
    try {
      const badPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const bootErrors: string[] = [];
      badPage.on("pageerror", (err) => {
        if (!isBlockedPublicNetworkError(String(err))) bootErrors.push(String(err));
      });
      badPage.on("console", (msg) => {
        if (msg.type() === "error" && !isBlockedPublicNetworkError(msg.text())) bootErrors.push(msg.text());
      });
      await badPage.addInitScript(() => {
        window.addEventListener("unhandledrejection", (event) => {
          const w = window as any;
          const bag = w.__fenixRejects || [];
          bag.push(String(event.reason || event));
          w.__fenixRejects = bag;
        });
      });
      const badSrc = prepareSrcDoc(SLASH, PALETTE, "vesti-slash", "app");
      await badPage.setContent(badSrc, { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 600));
      const probed = await badPage.evaluate(async () => {
        const w = window as any;
        const rejects = w.__fenixRejects || [];
        let spaced = "";
        let slash = "";
        try {
          await w.Fenix.data.query("capi vesti");
        } catch (error) {
          spaced = String(error);
        }
        try {
          await w.Fenix.data.query("capi/abiti");
        } catch (error) {
          slash = String(error);
        }
        return {
          ready: document.documentElement.getAttribute("data-fenix-ready"),
          boot: document.documentElement.getAttribute("data-fenix-boot-error"),
          rejects,
          spaced,
          slash,
          visibleCss: /html,body\{/.test(document.body?.innerText || ""),
        };
      });
      const haystack = [probed.spaced, probed.slash, probed.boot, ...probed.rejects, ...bootErrors].join(" | ");
      assert.match(haystack, /Fenix\.data: collezione non valido/);
      assert.match(probed.spaced, /collezione non valido/);
      assert.match(probed.slash, /collezione non valido/);
      assert.notEqual(probed.ready, "1");
      assert.equal(probed.visibleCss, false);
      await badPage.close();

      for (const [vp, viewport] of VIEWPORTS) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (err) => {
          if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
        });
        page.on("console", (msg) => {
          if (msg.type() === "error" && !isBlockedPublicNetworkError(msg.text())) errors.push(msg.text());
        });
        const src = prepareSrcDoc(PRODUCTION, PALETTE, "vesti", "app");
        assert.match(src, /var COL = "capi"/);
        assert.doesNotMatch(src, /var COL = "capi vesti"/);
        await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
        await waitForFenixReady(page, 8000);
        const overlay = await page.evaluate(() => ({
          boot: document.documentElement.getAttribute("data-fenix-boot-error"),
          ready: document.documentElement.getAttribute("data-fenix-ready"),
          visibleCss: /html,body\{/.test(document.body?.innerText || ""),
        }));
        assert.equal(overlay.boot, null);
        assert.equal(overlay.ready, "1");
        assert.equal(overlay.visibleCss, false);
        await page.getByRole("button", { name: "Nuovo" }).click();
        await page.locator("#nome").fill("Cappotto lana");
        await page.locator("#stagione").fill("inverno");
        await page.getByRole("button", { name: "Salva" }).click();
        await page.getByText("Cappotto lana").waitFor({ timeout: 8000 });
        const dest = await shot(page, `vesti-${vp.toLowerCase()}.png`);
        const buf = readFileSync(dest);
        manifest.viewports.push(vp);
        manifest.files.push({
          name: `vesti-${vp.toLowerCase()}.png`,
          sha256: createHash("sha256").update(buf).digest("hex"),
          bytes: buf.length,
        });
        const metrics = await page.evaluate(() => {
          const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          return { overflow, ready: document.documentElement.getAttribute("data-fenix-ready") };
        });
        assert.equal(metrics.ready, "1");
        assert.ok(metrics.overflow <= 8, `${vp} overflow ${metrics.overflow}`);
        assert.deepEqual(errors, [], `${vp}: ${errors.join(" | ")}`);
        await page.close();
      }

      const persist = await browser.newPage({ viewport: { width: 390, height: 844 } });
      persist.setDefaultTimeout(15000);
      await persist.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:390px;height:844px;border:0"></iframe>
<script>
window.__db = {};
window.addEventListener("message", function(e){
  var m=e.data;
  if(!m || m.t!=="fenix-db" || !m.id) return;
  if(m.op==="save") window.__db[m.col]=m.data;
  var value=m.op==="load" ? (window.__db[m.col] || null) : {ok:true,v:m.data,durable:Array.isArray(m.data)?m.data.length:0};
  e.source.postMessage({t:"fenix-db",id:m.id,v:value},"*");
});
</script></body></html>`);
      const src = prepareSrcDoc(PRODUCTION, PALETTE, "vesti-persist", "app");
      const load = () =>
        persist.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
      await load();
      const frame = persist.frameLocator("#f");
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await frame.getByRole("button", { name: "Nuovo" }).click();
      await frame.locator("#nome").fill("Giacca velluto");
      await frame.locator("#stagione").fill("autunno");
      await frame.getByRole("button", { name: "Salva" }).click();
      await frame.getByText("Giacca velluto").waitFor({ timeout: 8000 });
      const storedBefore = await persist.evaluate(() => (window as any).__db);
      assert.ok(
        Array.isArray(storedBefore.capi) && storedBefore.capi.some((row: { nome?: string }) => row.nome === "Giacca velluto"),
        `parent db before remount: ${JSON.stringify(storedBefore)}`,
      );
      await load();
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await frame.getByRole("button", { name: "Capi" }).click();
      await frame.getByText("Giacca velluto").waitFor({ timeout: 8000 });
      const stored = await persist.evaluate(
        () => (window as unknown as { __db: { capi?: { nome?: string }[] } }).__db,
      );
      assert.ok(Array.isArray(stored.capi) && stored.capi.some((row) => row.nome === "Giacca velluto"));
      await persist.close();
    } finally {
      await browser.close();
    }
    writeFileSync(join(SHOTS, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.equal(manifest.viewports.length, 3);
    assert.equal(manifest.credits, 0);
    for (const file of manifest.files) {
      assert.equal(existsSync(join(SHOTS, file.name)), true);
      assert.ok(statSync(join(SHOTS, file.name)).size > 1000);
    }
    assert.equal(VALID.includes('query("capi")'), true);
  });
});
