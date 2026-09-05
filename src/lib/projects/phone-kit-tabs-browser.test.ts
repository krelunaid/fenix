/**
 * prepareSrcDoc PHONE_KIT on apps WITHOUT data-fenix-phone.
 * Columns follow the real tab count (default 5). Not a 4-column mandate.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isolatedPage, isBlockedPublicNetworkError, launchChromium } from "./playwright-harness.ts";
import { prepareSrcDoc } from "./color-scheme.ts";

const AFTER = "/workspace/screenshots/fase3-graphic/five-tab";
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
  ["320", { width: 320, height: 568 }],
] as const;

const FIVE_TAB_APP = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<title>Cinque</title>
<style>
:root{--fg:#1c1712;--bg:#efe6d4;--surface:#f7f1e4;--accent:#3d4a1f;--muted:#5c5348}
body{margin:0;font:16px Georgia,serif;background:var(--bg);color:var(--fg)}
header{padding:12px 16px}
h1{margin:0;font:700 22px/1.2 Georgia,serif}
.fk-tab{display:flex;position:fixed;left:0;right:0;bottom:0;height:64px;border-top:1px solid #c4b49a;background:var(--surface)}
.fk-tab button{flex:1;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;font:600 10px/1.1 sans-serif}
.fk-tab button.on{color:var(--accent)}
.fk-tab svg{width:24px;height:24px;overflow:visible}
main{padding:12px 16px 88px}
section p.pad{min-height:160px}
li{display:flex;gap:8px;align-items:center;min-height:44px;list-style:none}
ul{margin:0;padding:0}
input,button[data-act]{min-height:44px;min-width:44px;font:16px sans-serif}
</style>
</head>
<body>
<header><h1 class="brand">Cinque</h1></header>
<nav class="fk-tab" aria-label="Navigazione">
  <button type="button" class="on" data-view="home"><svg viewBox="0 0 24 24"><path d="M5 19V10l7-6 7 6v9H5z"/></svg><span>Home</span></button>
  <button type="button" data-view="new"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg><span>Aggiungi</span></button>
  <button type="button" data-view="list"><svg viewBox="0 0 24 24"><path d="M6 7h12M6 12h12M6 17h8"/></svg><span>Elenco</span></button>
  <button type="button" data-view="me"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M6 19c1-4 11-4 12 0"/></svg><span>Persona</span></button>
  <button type="button" data-view="more"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg><span>Altro</span></button>
</nav>
<main id="main">
  <section data-panel="home">
    <p>Home utile</p>
    <p class="pad">scroll-a</p>
    <p class="pad">scroll-b</p>
    <p class="pad">scroll-c</p>
    <p class="pad">scroll-d</p>
    <p class="pad">scroll-e</p>
    <p class="pad">scroll-f</p>
    <p class="pad">scroll-g</p>
    <p class="pad">scroll-h</p>
  </section>
  <section data-panel="new" hidden>
    <form id="fnew">
      <label>Nome <input id="n" name="n"/></label>
      <button type="button" data-act="save">Salva</button>
    </form>
  </section>
  <section data-panel="list" hidden>
    <ul id="list"></ul>
  </section>
  <section data-panel="me" hidden><p>Persona</p></section>
  <section data-panel="more" hidden><p>Altro quinto</p></section>
</main>
<script>
(function(){
  var items = [];
  var editIdx = -1;
  function show(view){
    document.querySelectorAll("[data-panel]").forEach(function(p){ p.hidden = p.getAttribute("data-panel") !== view; });
    document.querySelectorAll("nav.fk-tab button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-view") === view); });
  }
  function renderList(){
    var ul = document.getElementById("list");
    ul.innerHTML = items.map(function(it, i){
      return '<li><h2>'+it+'</h2><button type="button" data-act="edit" data-i="'+i+'">Modifica</button><button type="button" data-act="del" data-i="'+i+'">Elimina</button></li>';
    }).join("") || "<li>Niente in lista</li>";
  }
  document.querySelectorAll("nav.fk-tab button").forEach(function(b){
    b.addEventListener("click", function(){ show(b.getAttribute("data-view")); });
  });
  document.getElementById("fnew").addEventListener("click", function(e){
    var t = e.target;
    if (!t || t.getAttribute("data-act") !== "save") return;
    var v = (document.getElementById("n").value || "").trim();
    if (!v) return;
    if (editIdx >= 0) { items[editIdx] = v; editIdx = -1; }
    else items.push(v);
    document.getElementById("n").value = "";
    renderList();
    show("list");
  });
  document.getElementById("list").addEventListener("click", function(e){
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var i = Number(t.getAttribute("data-i"));
    var act = t.getAttribute("data-act");
    if (act === "del") { items.splice(i,1); renderList(); }
    if (act === "edit") {
      editIdx = i;
      document.getElementById("n").value = items[i];
      show("new");
    }
  });
  renderList();
  document.documentElement.setAttribute("data-fenix-ready","1");
})();
</script>
</body>
</html>`;

assert.doesNotMatch(FIVE_TAB_APP, /data-fenix-phone/);
assert.match(FIVE_TAB_APP, /data-view="more"/);

async function tabGeometry(page: Page) {
  return page.locator("html").evaluate(() => {
    const nav = document.querySelector("nav.fk-tab, nav[aria-label]");
    const navBox = nav ? nav.getBoundingClientRect() : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const tabs = [...document.querySelectorAll("nav button[data-view]")].map((b) => {
      const br = b.getBoundingClientRect();
      const span = b.querySelector("span");
      const sr = span ? span.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        view: b.getAttribute("data-view") || "",
        label: (span && span.textContent ? span.textContent : "").trim(),
        on: b.classList.contains("on"),
        x: br.x,
        y: br.y,
        w: br.width,
        h: br.height,
        right: br.right,
        bottom: br.bottom,
        sw: sr.width,
        sh: sr.height,
      };
    });
    const main = document.querySelector("main");
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      nav: { x: navBox.left, y: navBox.top, w: navBox.width, h: navBox.height, right: navBox.right, bottom: navBox.bottom },
      tabs,
      mainScroll: main ? { sh: main.scrollHeight, ch: main.clientHeight, top: main.scrollTop } : null,
    };
  });
}

describe("prepareSrcDoc phone kit with 5 tabs and no data-fenix-phone", () => {
  it("phone control typography is valid CSS and inherits the chosen family at every viewport", async () => {
    const browser = await launchChromium();
    try {
      for (const [vp, viewport] of VIEWPORTS) {
        const page = await isolatedPage(browser, { viewport });
        try {
          const html = FIVE_TAB_APP.replace('<button type="button" data-act="save">', '<button class="fk-btn" type="button" data-act="save">');
          await page.setContent(prepareSrcDoc(html, "#efe6d4", "phone-type", "app"));
          await page.locator('nav button[data-view="new"]').click();
          const metrics = await page.evaluate(() => {
            const style = (selector: string) => { const s = getComputedStyle(document.querySelector(selector)!); return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight }; };
            return { body: style("body"), button: style(".fk-btn"), field: style("#n"), nav: style("nav button") };
          });
          assert.equal(metrics.button.family, metrics.body.family, `${vp} button family`);
          assert.equal(metrics.field.family, metrics.body.family, `${vp} field family`);
          assert.equal(metrics.nav.family, metrics.body.family, `${vp} navigation family`);
          assert.equal(metrics.button.size, "16px");
          assert.equal(metrics.button.weight, "600");
          assert.equal(metrics.field.size, "17px");
          assert.equal(metrics.nav.size, viewport.width >= 768 ? "13px" : "12px");
          await page.screenshot({ path: `/tmp/fenix-phone-type-${vp}.png`, fullPage: true });
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  });

  it("keeps five tabs in the bar at 320/390/T/D, fifth clickable, scroll and CRUD", async () => {
    const src = prepareSrcDoc(FIVE_TAB_APP, "#efe6d4", "five-tab-kit", "app");
    assert.match(src, /data-fenix-phone/);
    assert.match(src, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
    assert.doesNotMatch(src, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
    const browser = await launchChromium();
    const errorsAll: string[] = [];
    try {
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
          await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
          const geo = await tabGeometry(page);
          assert.equal(geo.tabs.length, 5, `${vp} tab count`);
          const labels = geo.tabs.map((t) => t.label);
          assert.deepEqual(labels, ["Home", "Aggiungi", "Elenco", "Persona", "Altro"]);
          for (const tab of geo.tabs) {
            assert.ok(tab.w >= 44, `${vp} ${tab.label} width ${tab.w}`);
            assert.ok(tab.h >= 44, `${vp} ${tab.label} height ${tab.h}`);
            assert.ok(tab.sw >= 4 && tab.sh >= 6, `${vp} ${tab.label} label ${tab.sw}x${tab.sh}`);
            assert.ok(tab.x >= -1, `${vp} ${tab.label} left ${tab.x}`);
            assert.ok(tab.right <= geo.vw + 2, `${vp} ${tab.label} right ${tab.right} vw ${geo.vw}`);
            assert.ok(tab.bottom <= geo.vh + 2, `${vp} ${tab.label} bottom ${tab.bottom} vh ${geo.vh}`);
            assert.ok(tab.y + 1 >= geo.nav.y, `${vp} ${tab.label} above bar ${tab.y} nav ${geo.nav.y}`);
            assert.ok(tab.bottom <= geo.nav.bottom + 2, `${vp} ${tab.label} below bar`);
          }
          const first = geo.tabs[0]!;
          const fifth = geo.tabs[4]!;
          if (viewport.width < 768) {
            assert.ok(Math.abs(first.y - fifth.y) <= 6, `${vp} fifth wrapped first.y ${first.y} fifth.y ${fifth.y}`);
          }
          await page.locator('nav button[data-view="more"]').click();
          const afterFifth = await tabGeometry(page);
          const active = afterFifth.tabs.find((t) => t.on);
          assert.equal(active?.view, "more", `${vp} fifth tab on`);
          assert.match(await page.locator("[data-panel=more]").innerText(), /Altro quinto/);
          await page.locator('nav button[data-view="home"]').click();
          const beforeScroll = await page.evaluate(() => {
            const m = document.querySelector("main") as HTMLElement | null;
            const doc = document.scrollingElement || document.documentElement;
            return {
              main: m ? { sh: m.scrollHeight, ch: m.clientHeight, top: m.scrollTop } : { sh: 0, ch: 0, top: 0 },
              doc: { sh: doc.scrollHeight, ch: doc.clientHeight, top: doc.scrollTop },
            };
          });
          const useMain = beforeScroll.main.sh > beforeScroll.main.ch + 8;
          const useDoc = beforeScroll.doc.sh > beforeScroll.doc.ch + 8;
          assert.ok(useMain || useDoc, `${vp} nothing scrolls main=${beforeScroll.main.sh}/${beforeScroll.main.ch} doc=${beforeScroll.doc.sh}/${beforeScroll.doc.ch}`);
          await page.evaluate((mode) => {
            if (mode === "main") {
              const m = document.querySelector("main") as HTMLElement | null;
              if (m) m.scrollTop = 80;
            } else {
              const doc = document.scrollingElement || document.documentElement;
              doc.scrollTop = 80;
            }
          }, useMain ? "main" : "doc");
          const scrolled = await page.evaluate((mode) => {
            if (mode === "main") {
              const m = document.querySelector("main") as HTMLElement | null;
              return m ? m.scrollTop : 0;
            }
            const doc = document.scrollingElement || document.documentElement;
            return doc.scrollTop;
          }, useMain ? "main" : "doc");
          assert.ok(scrolled >= 40, `${vp} scrollTop ${scrolled}`);

          await page.locator('nav button[data-view="new"]').click();
          await page.locator("#n").fill(`Voce ${vp}`);
          await page.locator('[data-act="save"]').click();
          await page.locator('h2', { hasText: `Voce ${vp}` }).waitFor({ timeout: 4000 });
          await page.locator('[data-act="edit"]').click();
          await page.locator("#n").fill(`Voce ${vp} ok`);
          await page.locator('[data-act="save"]').click();
          await page.locator("h2", { hasText: `Voce ${vp} ok` }).waitFor({ timeout: 4000 });
          await page.locator('[data-act="del"]').click();
          assert.equal(await page.locator("h2", { hasText: `Voce ${vp} ok` }).count(), 0, `${vp} delete`);
          try {
            mkdirSync(AFTER, { recursive: true });
            await page.screenshot({ path: join(AFTER, `five-${vp}.png`), fullPage: false });
          } catch {
            /* CI without scorecard dir */
          }
          assert.equal(errors.length, 0, `${vp} ${errors.join(" | ")}`);
        } finally {
          errorsAll.push(...errors.map((e) => `${vp}:${e}`));
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
    assert.equal(errorsAll.length, 0, errorsAll.join(" | "));
  });
});
