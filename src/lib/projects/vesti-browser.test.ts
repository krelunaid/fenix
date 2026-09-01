import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { planContract, evaluateContract } from "../ai/build-contract.ts";
import { formatPrefix } from "./infer.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID = readFileSync(join(here, "fixtures/vesti.html"), "utf8");
const INVALID = readFileSync(join(here, "fixtures/vesti-invalid-collection.html"), "utf8");
const SHOTS = join(here, "fixtures/shots/vesti");
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;
const PALETTE = { bg: "#f3ead8", fg: "#1c1712", surface: "#fff8ec", muted: "#5c5348", accent: "#8c2f1b" };

function launch() {
  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  const dest = join(SHOTS, name);
  await page.screenshot({ path: dest, fullPage: false });
  return dest;
}

describe("Vesti collection gate in the browser D/T/M", () => {
  it("runs persistent CRUD on capi, stays console-clean, and blocks the spaced collection", async () => {
    const brief = `${formatPrefix("app")}Vesti: armadio di casa, registra i capi.`;
    const contract = planContract(brief);
    const evaluation = evaluateContract({
      html: VALID,
      files: [{ path: "index.html", content: VALID }],
      contract,
      kind: "app",
    });
    assert.equal(evaluation.ok, true, evaluation.checks.filter((c) => !c.ok).map((c) => c.id).join(","));

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
      badPage.on("pageerror", (err) => bootErrors.push(String(err)));
      badPage.on("console", (msg) => {
        if (msg.type() === "error") bootErrors.push(msg.text());
      });
      await badPage.addInitScript(() => {
        window.addEventListener("unhandledrejection", (event) => {
          const w = window as any;
          const bag = w.__fenixRejects || [];
          bag.push(String(event.reason || event));
          w.__fenixRejects = bag;
        });
      });
      const badSrc = prepareSrcDoc(INVALID, PALETTE, "vesti-bad", "app");
      await badPage.setContent(badSrc, { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 600));
      const probed = await badPage.evaluate(async () => {
        const w = window as any;
        const rejects = w.__fenixRejects || [];
        let call = "";
        try {
          await w.Fenix.data.query("capi vesti");
        } catch (error) {
          call = String(error);
        }
        return {
          ready: document.documentElement.getAttribute("data-fenix-ready"),
          boot: document.documentElement.getAttribute("data-fenix-boot-error"),
          rejects,
          call,
        };
      });
      const haystack = [probed.call, probed.boot, ...probed.rejects, ...bootErrors].join(" | ");
      assert.match(haystack, /Fenix\.data: collezione non valido/);
      assert.notEqual(probed.ready, "1");
      await badPage.close();

      for (const [vp, viewport] of VIEWPORTS) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(String(err)));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });
        const src = prepareSrcDoc(VALID, PALETTE, "vesti", "app");
        await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
        await waitForFenixReady(page, 8000);
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
      const src = prepareSrcDoc(VALID, PALETTE, "vesti-persist", "app");
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
  });
});
