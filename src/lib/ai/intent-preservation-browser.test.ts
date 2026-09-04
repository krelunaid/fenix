import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isolatedPage, isBlockedPublicNetworkError, launchChromium } from "../projects/playwright-harness.ts";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { composeProduct } from "./compose-product.ts";
import { formatPrefix } from "../projects/infer.ts";
import {
  GRAPHIC_INTENT_PARENT_SHA,
  INTENT_SERIF_PROMPT,
  INTENT_SYSTEM_PROMPT,
} from "../projects/graphic-intent.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(here, "fixtures/graphic/intent");
const BEFORE = join(SHOTS, "before");
const AFTER = "/workspace/screenshots/fase3-graphic/intent-after";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;

const PERSIST_HOST = `<!DOCTYPE html><html><head><style>html,body,#f{margin:0;width:100%;height:100%;border:0;display:block;background:transparent}</style></head><body>
<iframe id="f"></iframe>
<script>
window.__db = {};
window.addEventListener("message", function(e){
  var m=e.data;
  if(!m || m.t!=="fenix-db" || !m.id) return;
  if(m.op==="save") window.__db[m.col]=m.data;
  var value=m.op==="load" ? (window.__db[m.col] || null) : {ok:true,v:m.data,durable:Array.isArray(m.data&&m.data.items)?m.data.items.length:0};
  e.source.postMessage({t:"fenix-db",id:m.id,v:value},"*");
});
</script></body></html>`;

const BRIEFS = [
  { id: "system", brief: `${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}` },
  { id: "serif", brief: `${formatPrefix("app")}${INTENT_SERIF_PROMPT}` },
] as const;

async function restFrame(page: Page) {
  await page.locator("#f").evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    if (!doc) return;
    const toast = doc.getElementById("toast");
    if (toast) (toast as HTMLElement).hidden = true;
    const load = doc.getElementById("load");
    if (load) (load as HTMLElement).hidden = true;
    const err = doc.getElementById("err");
    if (err) (err as HTMLElement).hidden = true;
    const main = doc.querySelector("main");
    if (main) main.scrollTop = 0;
    doc.documentElement.scrollTop = 0;
    doc.body.scrollTop = 0;
    doc.defaultView?.scrollTo(0, 0);
  });
}

async function waitHeading(page: Page, title: string, timeout = 8000) {
  await page.waitForFunction(
    (t) => {
      const el = document.querySelector("#f") as HTMLIFrameElement | null;
      const doc = el && el.contentDocument;
      if (!doc) return false;
      return [...doc.querySelectorAll("h2")].some((node) => (node.textContent || "").trim() === t);
    },
    title,
    { timeout },
  );
}

async function headingCount(page: Page, title: string): Promise<number> {
  return page.locator("#f").evaluate((el, t) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    if (!doc) return 0;
    return [...doc.querySelectorAll("h2")].filter((node) => (node.textContent || "").trim() === t).length;
  }, title);
}

async function clickActOnHeading(frame: ReturnType<Page["frameLocator"]>, title: string, act: "edit" | "del") {
  const cards = frame.locator("article[data-id], div.card[data-id]");
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const text = await cards
      .nth(i)
      .locator("h2")
      .first()
      .evaluate((el) => (el.textContent || "").trim());
    if (text !== title) continue;
    await cards.nth(i).locator(`[data-act="${act}"]`).click();
    return;
  }
  assert.equal(true, false, `${act} control for ${title}`);
}

describe("intent preservation D/T/M after compose+repair path+prepareSrcDoc", () => {
  it("keeps system/iPhone-like and serif direction on computed styles, CRUD, reload, console", async () => {
    assert.equal(GRAPHIC_INTENT_PARENT_SHA, "76414c75ce4dc1b2f66343fc0ed1160be0c1b45b");
    assert.equal(readFileSync(join(BEFORE, "parent.txt"), "utf8").trim(), GRAPHIC_INTENT_PARENT_SHA);
    const before = BRIEFS.flatMap((row) =>
      VIEWPORTS.map(([vp]) => {
        const name = `${row.id}-${vp}.png`;
        const buf = readFileSync(join(BEFORE, name));
        return { name, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
      }),
    );
    assert.equal(before.length, 6);
    const browser = await launchChromium();
    const files: { name: string; sha256: string }[] = [];
    try {
      for (const row of BRIEFS) {
        const composed = composeProduct(row.brief);
        const src = prepareSrcDoc(
          composed.html,
          composed.tokens.palette,
          `intent-${row.id}`,
          composed.grammar.kind,
        );
        assert.match(src, new RegExp(`data-intent-type="${row.id === "system" ? "system" : "serif"}"`));
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
            await page.setContent(PERSIST_HOST, { waitUntil: "domcontentloaded", timeout: 15000 });
            const load = () =>
              page.locator("#f").evaluate((el, srcDoc: string) => {
                (el as HTMLIFrameElement).srcdoc = srcDoc;
              }, src);
            await load();
            const frame = page.frameLocator("#f");
            await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
            await restFrame(page);
            const painted = await frame.locator("html").evaluate(() => {
              const root = getComputedStyle(document.documentElement);
              const body = getComputedStyle(document.body);
              const brand = document.querySelector(".brand, header h1, h1, h2");
              const heading = brand ? getComputedStyle(brand) : body;
              return {
                bodyVar: root.getPropertyValue("--body"),
                displayVar: root.getPropertyValue("--display"),
                bodyFamily: body.fontFamily,
                headingFamily: heading.fontFamily,
                intentType: document.documentElement.getAttribute("data-intent-type"),
                intentChrome: document.documentElement.getAttribute("data-intent-chrome"),
                tabs: [...document.querySelectorAll("nav button[data-view] span")].map((s) =>
                  (s.textContent || "").trim(),
                ),
                views: [...document.querySelectorAll("nav button[data-view]")].map(
                  (b) => b.getAttribute("data-view") || "",
                ),
              };
            });
            if (row.id === "system") {
              assert.equal(painted.intentType, "system");
              assert.equal(painted.intentChrome, "semantic");
              assert.match(painted.bodyVar, /system-ui/);
              assert.match(painted.displayVar, /system-ui/);
              assert.doesNotMatch(painted.bodyVar, /Literata|Karla|Figtree|Newsreader/);
              assert.doesNotMatch(painted.bodyFamily, /Literata|Karla|Figtree|Newsreader/i);
              assert.ok(painted.tabs.includes("Home"), painted.tabs.join(","));
              assert.ok(painted.tabs.includes("Aggiungi"), painted.tabs.join(","));
              assert.ok(painted.tabs.includes("Persona"), painted.tabs.join(","));
            } else {
              assert.equal(painted.intentType, "serif");
              assert.match(painted.displayVar, /Literata/);
              assert.match(painted.bodyVar, /Literata/);
              assert.doesNotMatch(painted.bodyVar, /Figtree|Karla|Inter/);
              assert.ok(
                /literata|georgia|times|ui-serif/i.test(painted.headingFamily),
                painted.headingFamily,
              );
              assert.doesNotMatch(painted.headingFamily, /Figtree|Karla|Inter/i);
            }
            const overflow = await frame.locator("html").evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            );
            assert.ok(overflow <= 8, `${row.id}/${vp} overflow ${overflow}`);
            mkdirSync(SHOTS, { recursive: true });
            const dest = join(SHOTS, `${row.id}-${vp}.png`);
            await page.locator("#f").screenshot({ path: dest });
            try {
              mkdirSync(AFTER, { recursive: true });
              await page.locator("#f").screenshot({ path: join(AFTER, `${row.id}-${vp}.png`) });
            } catch {
              /* CI without scorecard dir */
            }
            const buf = readFileSync(dest);
            assert.ok(statSync(dest).size > 4000, `${row.id}-${vp} shot too small`);
            files.push({ name: `${row.id}-${vp}.png`, sha256: createHash("sha256").update(buf).digest("hex") });

            const formView = painted.views[1];
            const listView = painted.views[2];
            assert.ok(formView && listView, `${row.id} tabs`);
            await frame.locator(`nav button[data-view="${formView}"]`).click();
            await frame.locator("#n").waitFor({ timeout: 4000 });
            const created = `Intent ${row.id} ${vp}`;
            await frame.locator("#n").fill(created);
            if (await frame.locator("#k").count()) await frame.locator("#k").fill("dettaglio");
            if (await frame.locator("#note").count()) await frame.locator("#note").fill("nota");
            if (await frame.locator("#ora").count()) await frame.locator("#ora").fill("09:30");
            if (await frame.locator("#data").count()) {
              const day = await frame.locator("html").evaluate(() => new Date().toISOString().slice(0, 10));
              await frame.locator("#data").fill(day);
            }
            if (await frame.locator("#luogo").count()) await frame.locator("#luogo").fill("Sala");
            if (await frame.locator("#cliente").count()) await frame.locator("#cliente").fill("Noa");
            await frame.locator('#fnew [data-act="save"]').click();
            await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
            await waitHeading(page, created);
            await frame.locator(`nav button[data-view="${listView}"]`).click();
            await waitHeading(page, created);
            const updated = `${created} ok`;
            await clickActOnHeading(frame, created, "edit");
            await frame.locator("#n").waitFor({ timeout: 4000 });
            await frame.locator("#n").fill(updated);
            await frame.locator('#fnew [data-act="save"]').click();
            await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
            await load();
            await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
            await frame.locator(`nav button[data-view="${listView}"]`).click();
            await waitHeading(page, updated);
            await clickActOnHeading(frame, updated, "del");
            await frame.locator("html:not([data-fenix-persist='busy'])").waitFor({ timeout: 8000 });
            await load();
            await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
            await frame.locator(`nav button[data-view="${listView}"]`).click();
            assert.equal(await headingCount(page, updated), 0, `${row.id}/${vp} delete+reload`);
            assert.equal(errors.length, 0, `${row.id}/${vp} ${errors.join(" | ")}`);
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(
      join(SHOTS, "manifest.json"),
      `${JSON.stringify(
        {
          parent: GRAPHIC_INTENT_PARENT_SHA,
          before,
          after: files,
          note: "composeProduct+prepareSrcDoc intent system/serif D/T/M. Hash is a movement floor, not a score. Not 9/10. Planner/polish LLM skipped (quota). LiveVerified false.",
        },
        null,
        2,
      )}\n`,
    );
    assert.equal(files.length, 6);
    const mustMove = /^(system|serif)-[DTM]\.png$/;
    for (const file of files) {
      const prior = before.find((b) => b.name === file.name);
      assert.ok(prior, file.name);
      if (mustMove.test(file.name)) {
        assert.notEqual(file.sha256, prior!.sha256, `${file.name} after must move from parent 76414c7`);
      }
      assert.equal(existsSync(join(BEFORE, file.name)), true);
    }
  });
});
