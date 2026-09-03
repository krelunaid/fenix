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
import { evaluateContract, planContract, blocksPublish } from "../ai/build-contract.ts";
import { formatPrefix } from "./infer.ts";
import { canPublishHtml } from "./validate-html.ts";
import { isPublishable } from "./recover.ts";
import { collectRenderedGraphic } from "./graphic-quality.ts";
import {
  AGENDA_ICON_INSTRUCTION,
  applyIconRevision,
} from "../../../workers/visual/icon-patch.mjs";
import { isStudioLocked } from "./studio-lock.ts";

const here = dirname(fileURLToPath(import.meta.url));
const AGENDA = readFileSync(join(here, "fixtures/agenda.html"), "utf8");
const BROKEN = readFileSync(join(here, "fixtures/agenda-broken.html"), "utf8");
const CLIP = readFileSync(join(here, "fixtures/agenda-clip.html"), "utf8");
const SHOTS = join(here, "fixtures/shots/agenda");
const BRIEF = `${formatPrefix("app")}Agenda studio: impegni e appuntamenti in tasca.`;
const PALETTE = { bg: "#f3eee4", fg: "#1c1712", surface: "#fffaf1", muted: "#5a5148", accent: "#2f5d50" };
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;
const VIEWS = [
  ["home", /Oggi in studio|impegni in agenda/i],
  ["new", /Registra impegno/i],
  ["list", /impegno|Appunti/i],
  ["stats", /Settimana/i],
  ["more", /Studio/i],
] as const;

function launch() {
  return launchChromium();
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  const dest = join(SHOTS, name);
  await page.screenshot({ path: dest, fullPage: false });
  return dest;
}

describe("Agenda icon patch in the browser D/T/M", () => {
  it("changes one icon, keeps 5 views+CRUD+state, blocks broken publish", async () => {
    assert.equal(isStudioLocked({ status: "building" }), true);
    const contract = planContract(BRIEF);
    const patched = applyIconRevision({
      html: AGENDA,
      files: [{ path: "index.html", content: AGENDA }],
      instruction: AGENDA_ICON_INSTRUCTION,
    });
    assert.equal(patched.status, "ok", patched.reason);
    assert.match(patched.html, /M8 4v4M16 4v4/);
    assert.doesNotMatch(patched.html, /Stato: undefined/);
    const evaluation = evaluateContract({
      html: patched.html,
      files: patched.files,
      contract,
      kind: "app",
      brief: BRIEF,
    });
    assert.equal(
      evaluation.ok,
      true,
      evaluation.checks.filter((c) => !c.ok).map((c) => `${c.id}:${c.detail}`).join(" · "),
    );
    assert.equal(canPublishHtml(patched.html, "app", "agenda"), true);
    assert.equal(blocksPublish(patched.html, "app", undefined, BRIEF), "");
    assert.equal(
      isPublishable({ status: "ready", html: patched.html, kind: "app", prompt: BRIEF }),
      true,
    );
    assert.equal(isPublishable({ status: "ready", html: BROKEN, kind: "app", prompt: BRIEF }), false);
    assert.match(blocksPublish(BROKEN, "app", undefined, BRIEF), /undefined|overflow|graphic|NaN|clip/i);

    const browser = await launch();
    const manifest: {
      product: string;
      collection: string;
      viewports: string[];
      files: { name: string; sha256: string; bytes: number }[];
      credits: number;
    } = {
      product: "Agenda",
      collection: "impegni",
      viewports: [],
      files: [],
      credits: 0,
    };
    try {
      for (const [vp, viewport] of VIEWPORTS) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (err) => {
          if (!isBlockedPublicNetworkError(String(err))) errors.push(String(err));
        });
        page.on("console", (msg) => {
          if (msg.type() === "error" && !isBlockedPublicNetworkError(msg.text())) errors.push(msg.text());
        });
        const src = prepareSrcDoc(patched.html, PALETTE, "agenda", "app");
        await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
        await waitForFenixReady(page, 8000);
        const bodyText = await page.locator("body").innerText();
        assert.doesNotMatch(bodyText, /\bundefined\b/);
        assert.doesNotMatch(bodyText, /\bNaN\b/);
        assert.doesNotMatch(bodyText, /(^|\s)null(\s|$)/);

        for (const [view, expect] of VIEWS) {
          await page.locator(`[data-view="${view}"]`).click();
          await page.locator("main").waitFor({ timeout: 4000 });
          const main = await page.locator("main").innerText();
          assert.match(main, expect, `${vp} ${view}`);
          const box = await page.locator(`[data-view="${view}"]`).boundingBox();
          assert.ok(box, `${vp} tab ${view}`);
          assert.ok((box?.x || 0) + (box?.width || 0) <= viewport.width + 1.5, `${vp} tab ${view} overflow`);
        }

        await page.locator('[data-view="new"]').click();
        await page.locator("#nome").fill("Prova tessuti");
        await page.locator("#ora").fill("10:30");
        await page.getByRole("button", { name: "Registra impegno" }).click();
        await page.getByText("Prova tessuti").waitFor({ timeout: 8000 });

        const metrics = await page.evaluate(collectRenderedGraphic);
        assert.ok(metrics.overflowX <= 8, `${vp} overflow ${metrics.overflowX}`);
        assert.equal(metrics.clipping, 0, `${vp} clipping ${metrics.clipping}`);
        assert.equal(metrics.overlap, 0, `${vp} overlap ${metrics.overlap}`);
        assert.equal(metrics.leakedText, false, `${vp} leaked`);
        const dest = await shot(page, `agenda-${vp.toLowerCase()}.png`);
        const buf = readFileSync(dest);
        manifest.viewports.push(vp);
        manifest.files.push({
          name: `agenda-${vp.toLowerCase()}.png`,
          sha256: createHash("sha256").update(buf).digest("hex"),
          bytes: buf.length,
        });
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
      const src = prepareSrcDoc(patched.html, PALETTE, "agenda-persist", "app");
      const load = () =>
        persist.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
      await load();
      const frame = persist.frameLocator("#f");
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await frame.locator('[data-view="new"]').click();
      await frame.locator("#nome").fill("Taglio prova");
      await frame.locator("#ora").fill("16:00");
      await frame.getByRole("button", { name: "Registra impegno" }).click();
      await frame.getByText("Taglio prova").waitFor({ timeout: 8000 });
      const storedBefore = await persist.evaluate(
        () => (window as unknown as { __db: Record<string, { nome?: string }[]> }).__db,
      );
      assert.ok(
        Array.isArray(storedBefore.impegni) && storedBefore.impegni.some((row) => row.nome === "Taglio prova"),
        `parent db before remount: ${JSON.stringify(storedBefore)}`,
      );
      await load();
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await frame.locator('[data-view="list"]').click();
      await frame.getByText("Taglio prova").waitFor({ timeout: 8000 });
      await persist.close();

      for (const [vp, viewport] of VIEWPORTS) {
        const page = await browser.newPage({ viewport });
        const src = prepareSrcDoc(CLIP, PALETTE, "agenda-clip", "app");
        await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
        await waitForFenixReady(page, 8000);
        const metrics = await page.evaluate(collectRenderedGraphic);
        assert.ok(
          metrics.clipping > 0 || metrics.overlap > 0,
          `${vp} clip fixture clip=${metrics.clipping} overlap=${metrics.overlap}`,
        );
        const evaluation = evaluateContract({
          html: CLIP,
          files: [{ path: "index.html", content: CLIP }],
          contract,
          kind: "app",
          brief: BRIEF,
          rendered: metrics,
        });
        assert.equal(evaluation.ok, false, `${vp} clip should fail contract`);
        assert.equal(evaluation.checks.find((c) => c.id === "clipping")?.ok, false, `${vp} clipping gate`);
        assert.match(blocksPublish(CLIP, "app", undefined, BRIEF, metrics), /clip/i);
        assert.equal(isPublishable({ status: "ready", html: CLIP, kind: "app", prompt: BRIEF }), false);
        await page.close();
      }
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
