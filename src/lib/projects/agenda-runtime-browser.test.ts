import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isolatedPage, isBlockedPublicNetworkError, launchChromium } from "./playwright-harness.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import { formatPrefix } from "./infer.ts";
import { composeProduct } from "../ai/compose-product.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(here, "fixtures/shots/agenda-runtime");
const BRIEF = `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`;
const VIEWPORTS = [
  ["D", { width: 1280, height: 800 }],
  ["T", { width: 768, height: 1024 }],
  ["M", { width: 390, height: 844 }],
] as const;

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  const dest = join(SHOTS, name);
  await page.screenshot({ path: dest, fullPage: false });
  return dest;
}

function withFenixNow(html: string, y: number, month: number, day: number) {
  const line = `window.__FENIX_NOW=new Date(${y},${month - 1},${day},12,0,0).getTime();`;
  return html.replace("const COL=", `${line}\nconst COL=`);
}

function isoOf(y: number, month: number, day: number) {
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function settleVisual(page: Page) {
  await page.locator("#toast").waitFor({ state: "hidden", timeout: 4000 });
  await page.locator("#err").waitFor({ state: "hidden", timeout: 4000 });
  await page.locator("main").evaluate((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function recordShot(
  page: Page,
  name: string,
  files: { name: string; sha256: string; bytes: number }[],
) {
  const dest = await shot(page, name);
  const buf = await page.screenshot({ type: "png" });
  files.push({
    name,
    sha256: createHash("sha256").update(buf).digest("hex"),
    bytes: statSync(dest).size,
  });
}

describe("Agenda generated runtime D/T/M", () => {
  it("selects real days, advances status, CRUD+reload, console clean after interactions", async () => {
    const composed = composeProduct(BRIEF);
    assert.equal(composed.grammar.id, "agenda");
    assert.doesNotMatch(composed.html, /idx%5/);
    assert.doesNotMatch(composed.html, /placeholder="stato, taglia, ora"/);
    const browser = await launchChromium();
    const manifest: {
      product: string;
      viewports: string[];
      files: { name: string; sha256: string; bytes: number }[];
      credits: number;
      residual: string;
    } = {
      product: "Agenda-runtime",
      viewports: [],
      files: [],
      credits: 0,
      residual:
        "Graphic five-brief proof remains after-only: no parent-SHA before/after, three mobile palettes still close. This file proves Agenda function, not 9/10 craft.",
    };
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
          const src = prepareSrcDoc(composed.html, composed.tokens.palette, `agenda-runtime-${vp}`, "app");
          await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
          await waitForFenixReady(page, 8000);

          assert.equal(await page.locator('nav button[data-view="oggi"]').count(), 1);
          assert.equal(await page.locator('nav button[data-view="settimana"]').count(), 1);
          assert.equal(await page.locator('header .place').innerText(), "Sala");

          await page.locator('nav button[data-view="settimana"]').click();
          const days = page.locator(".week-day[data-day]");
          assert.equal(await days.count(), 7, `${vp} week days`);
          assert.equal(await page.locator('.week-day[data-day-label="Sab"]').count(), 1);
          assert.equal(await page.locator('.week-day[data-day-label="Dom"]').count(), 1);
          const firstIso = await days.nth(0).getAttribute("data-day");
          const thirdIso = await days.nth(2).getAttribute("data-day");
          assert.match(String(firstIso), /^\d{4}-\d{2}-\d{2}$/);
          assert.match(String(thirdIso), /^\d{4}-\d{2}-\d{2}$/);
          assert.notEqual(firstIso, thirdIso);

          await days.nth(2).click();
          const selected = page.locator('.week-day[aria-selected="true"]');
          assert.equal(await selected.count(), 1, `${vp} one selected day`);
          assert.equal(await selected.getAttribute("data-day"), thirdIso);
          assert.equal(await selected.getAttribute("aria-selected"), "true");
          assert.equal(await selected.getAttribute("tabindex"), "0");
          const slots = page.locator("article.slot");
          const slotCount = await slots.count();
          for (let i = 0; i < slotCount; i++) {
            assert.equal(await slots.nth(i).getAttribute("data-day"), thirdIso, `${vp} slot ${i} day`);
          }
          const expected = Number(await days.nth(2).locator("[data-count]").getAttribute("data-count"));
          assert.equal(slotCount, expected, `${vp} slot count matches day`);
          assert.match(await page.locator(".day-head .kicker").innerText(), new RegExp(String(thirdIso)));
          await settleVisual(page);
          const weekShot = await shot(page, `agenda-runtime-week-${vp.toLowerCase()}.png`);          const weekBuf = await page.screenshot({ type: "png" });
          manifest.files.push({
            name: `agenda-runtime-week-${vp.toLowerCase()}.png`,
            sha256: createHash("sha256").update(weekBuf).digest("hex"),
            bytes: statSync(weekShot).size,
          });

          await days.nth(0).click();
          assert.equal(await page.locator('.week-day[aria-selected="true"]').getAttribute("data-day"), firstIso);
          await page.locator('.week-day[aria-selected="true"]').focus();
          await page.keyboard.press("ArrowRight");
          const afterKey = await page.locator('.week-day[aria-selected="true"]').getAttribute("data-day");
          assert.equal(afterKey, await days.nth(1).getAttribute("data-day"), `${vp} keyboard day`);

          await page.locator('nav button[data-view="nuovo"]').click();
          assert.equal(await page.locator('[placeholder="stato, taglia, ora"]').count(), 0);
          assert.equal(await page.locator('[placeholder="materia"]').count(), 0);
          assert.equal(await page.locator("#ora").count(), 1, `${vp} ora field`);
          assert.equal(await page.locator("#luogo").count(), 1, `${vp} luogo field`);
          assert.equal(await page.locator("#cliente").count(), 1, `${vp} cliente field`);
          assert.equal(await page.locator("#data").count(), 1, `${vp} data field`);
          assert.equal(await page.locator("#data").getAttribute("type"), "date");          const created = `Prova ${vp} runtime`;
          await page.locator("#n").fill(created);
          await page.locator("#ora").fill("16:45");
          await page.locator("#luogo").fill("Sala 3");
          await page.locator("#cliente").fill("Gio");
          await page.locator("#fnew [data-act='save']").click();
          await page.getByRole("heading", { name: created, exact: true }).waitFor({ timeout: 4000 });
          const createdSlot = page.locator(`article.slot:has-text("${created}")`);
          assert.equal(await createdSlot.count(), 1, `${vp} created slot`);
          assert.equal(await createdSlot.locator("time.time").innerText(), "16:45");
          assert.equal(await createdSlot.getAttribute("data-status"), "prenotato");
          const timeBefore = await createdSlot.locator("time.time").innerText();
          await createdSlot.locator('[data-act="advance"]').click();
          const advanced = page.locator(`article.slot:has-text("${created}")`);
          assert.equal(await advanced.count(), 1, `${vp} advanced slot still present`);
          assert.equal(await advanced.locator("time.time").innerText(), timeBefore, `${vp} time stable`);
          assert.equal(await advanced.getAttribute("data-status"), "confermato", `${vp} status advanced`);

          await advanced.locator('[data-act="edit"]').click();
          assert.equal(await page.locator('[data-agenda-form="edit"]').count(), 1, `${vp} edit form`);
          const updated = `${created} edit`;
          await page.locator("#n").fill(updated);
          await page.locator("#fnew [data-act='save']").click();
          await page.getByRole("heading", { name: updated, exact: true }).waitFor({ timeout: 4000 });
          assert.equal(await page.getByRole("heading", { name: created, exact: true }).count(), 0);
          assert.equal(await page.getByRole("heading", { name: updated, exact: true }).count(), 1);

          const beforeDel = await page.locator("article.slot").count();
          await page.locator("article.slot").filter({ has: page.getByRole("heading", { name: updated, exact: true }) }).locator('[data-act="del"]').click();
          assert.equal(await page.getByRole("heading", { name: updated, exact: true }).count(), 0);
          assert.equal(await page.locator("article.slot").count(), beforeDel - 1);

          await settleVisual(page);
          const dest = await shot(page, `agenda-runtime-${vp.toLowerCase()}.png`);          const buf = await page.screenshot({ type: "png" });
          manifest.viewports.push(vp);
          manifest.files.push({
            name: `agenda-runtime-${vp.toLowerCase()}.png`,
            sha256: createHash("sha256").update(buf).digest("hex"),
            bytes: statSync(dest).size,
          });
          assert.equal(errors.length, 0, `${vp} console after interactions: ${errors.join(" | ")}`);
        } finally {
          await page.close();
        }
      }

      const persist = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
      persist.setDefaultTimeout(15000);
      await persist.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:390px;height:844px;border:0"></iframe>
<script>
window.__db = {};
window.addEventListener("message", function(e){
  var m=e.data;
  if(!m || m.t!=="fenix-db" || !m.id) return;
  if(m.op==="save") window.__db[m.col]=m.data;
  var value=m.op==="load" ? (window.__db[m.col] || null) : {ok:true,v:m.data,durable:Array.isArray(m.data&&m.data.items)?m.data.items.length:0};
  e.source.postMessage({t:"fenix-db",id:m.id,v:value},"*");
});
</script></body></html>`);
      const src = prepareSrcDoc(composed.html, composed.tokens.palette, "agenda-runtime-persist", "app");
      const load = () =>
        persist.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
      await load();
      const frame = persist.frameLocator("#f");
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await frame.locator('nav button[data-view="nuovo"]').click();
      await frame.locator("#n").fill("Persistito runtime");
      await frame.locator("#ora").fill("18:10");
      await frame.locator("#luogo").fill("Sala persist");
      await frame.locator("#cliente").fill("Noa");
      await frame.locator("#fnew [data-act='save']").click();
      await frame.getByRole("heading", { name: "Persistito runtime", exact: true }).waitFor({ timeout: 8000 });
      await frame.locator('article.slot:has-text("Persistito runtime") [data-act="advance"]').click();
      assert.equal(
        await frame.locator('article.slot:has-text("Persistito runtime")').getAttribute("data-status"),
        "confermato",
      );
      assert.equal(await frame.locator('article.slot:has-text("Persistito runtime") time.time').innerText(), "18:10");
      await persist.waitForFunction(() => {
        const db = (window as unknown as { __db: Record<string, { items?: { title?: string; status?: string; kicker?: string }[] }> }).__db;
        const items = db && db.slot && Array.isArray(db.slot.items) ? db.slot.items : [];
        return items.some((row) => row.title === "Persistito runtime" && row.status === "confermato" && row.kicker === "18:10");
      });
      await load();
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await frame.getByRole("heading", { name: "Persistito runtime", exact: true }).waitFor({ timeout: 8000 });
      assert.equal(
        await frame.locator('article.slot:has-text("Persistito runtime")').getAttribute("data-status"),
        "confermato",
        "status persisted across reload",
      );
      assert.equal(await frame.locator('article.slot:has-text("Persistito runtime") time.time').innerText(), "18:10");
      await persist.close();
    } finally {
      await browser.close();
    }
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(join(SHOTS, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    assert.equal(manifest.viewports.length, 3);
    assert.equal(manifest.credits, 0);
    for (const file of manifest.files) {
      assert.equal(existsSync(join(SHOTS, file.name)), true);
      assert.ok(statSync(join(SHOTS, file.name)).size > 1000);
    }
  });
});

const PERSIST_HOST = `<!DOCTYPE html><html><body>
<iframe id="f" style="width:390px;height:844px;border:0"></iframe>
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

describe("Agenda calendar edges Fri/Sat/Sun, validation, date keep", () => {
  it("weekend dates, keep form date, empty rail, reject invalid persist", async () => {
    const composed = composeProduct(BRIEF);
    assert.equal(composed.grammar.id, "agenda");
    const browser = await launchChromium();
    const files: { name: string; sha256: string; bytes: number }[] = [];
    try {
      const fridayHtml = withFenixNow(composed.html, 2026, 9, 4);
      const fridayIso = isoOf(2026, 9, 4);
      const saturdayIso = isoOf(2026, 9, 5);
      const sundayIso = isoOf(2026, 9, 6);
      const futureIso = isoOf(2026, 10, 15);

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
          const src = prepareSrcDoc(fridayHtml, composed.tokens.palette, `agenda-cal-${vp}`, "app");
          await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
          await waitForFenixReady(page, 8000);

          await page.locator('nav button[data-view="settimana"]').click();
          const days = page.locator(".week-day[data-day]");
          assert.equal(await days.count(), 7, `${vp} seven days`);
          const labels = await days.evaluateAll((nodes) =>
            nodes.map((n) => (n as HTMLElement).getAttribute("data-day-label")),
          );
          assert.deepEqual(labels, ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]);
          const isos = await days.evaluateAll((nodes) =>
            nodes.map((n) => (n as HTMLElement).getAttribute("data-day")),
          );
          assert.equal(isos[4], fridayIso, `${vp} Friday in week`);
          assert.equal(isos[5], saturdayIso);
          assert.equal(isos[6], sundayIso);
          assert.match(String(isos[0]), /^2026-08-31$/, `${vp} week spans August→September`);

          const sat = page.locator('.week-day[data-day-label="Sab"]');
          await sat.click();
          assert.equal(await page.locator('.week-day[aria-selected="true"]').getAttribute("data-day"), saturdayIso);
          assert.equal(await page.locator("#day-rail").count(), 1, `${vp} Saturday rail`);
          assert.equal(
            await page.locator(`article.slot[data-day="${saturdayIso}"]`).count(),
            Number(await sat.locator("[data-count]").getAttribute("data-count")),
            `${vp} Friday+1 seed lands on Saturday, not clamped to Friday`,
          );
          await settleVisual(page);
          await recordShot(page, `agenda-runtime-weekend-${vp.toLowerCase()}.png`, files);

          const sun = page.locator('.week-day[data-day-label="Dom"]');
          await sun.click();
          assert.equal(await page.locator('.week-day[aria-selected="true"]').getAttribute("data-day"), sundayIso);
          assert.equal(await page.locator("#day-rail").count(), 1, `${vp} empty Sunday still has day-rail`);
          assert.equal(await page.locator("#day-rail").getAttribute("role"), "tabpanel");
          assert.equal(await page.locator(`article.slot[data-day="${sundayIso}"]`).count(), 0);
          assert.equal(await page.locator("#day-rail [data-state='empty']").count(), 1);
          await settleVisual(page);
          await recordShot(page, `agenda-runtime-empty-${vp.toLowerCase()}.png`, files);

          await page.locator('nav button[data-view="nuovo"]').click();
          assert.equal(await page.locator("#data").inputValue(), sundayIso, `${vp} Nuovo keeps Settimana date`);
          await page.locator("#n").fill("");
          await page.locator("#ora").evaluate((el) => {
            (el as HTMLInputElement).value = "";
            el.dispatchEvent(new Event("input", { bubbles: true }));
          });
          await page.locator("#fnew [data-act='save']").click();
          assert.equal(await page.locator("#err[hidden]").count(), 0, `${vp} accessible error on click`);
          assert.equal(await page.locator("#toast[hidden]").count(), 1, `${vp} no success toast on invalid click`);
          assert.equal(await page.locator("[data-fenix-form-error]:not([hidden])").count(), 1);
          assert.equal(await page.locator("html").getAttribute("data-fenix-flash"), "err");
          assert.equal(await page.locator('[data-agenda-form="create"]').count(), 1, `${vp} stayed on form`);
          assert.equal(await page.getByRole("heading", { name: `Futuro ${vp}`, exact: true }).count(), 0);
          await recordShot(page, `agenda-runtime-valid-${vp.toLowerCase()}.png`, files);

          await page.locator("#n").fill(`Futuro ${vp}`);
          await page.locator("#ora").fill("10:15");
          await page.locator("#data").fill(futureIso);
          await page.locator("#luogo").fill("Sala futura");
          await page.locator("#cliente").fill("Ada");
          await page.locator("#fnew [data-act='save']").click();
          await page.getByRole("heading", { name: `Futuro ${vp}`, exact: true }).waitFor({ timeout: 4000 });
          const futureSlot = page.locator(`article.slot:has-text("Futuro ${vp}")`);
          assert.equal(await futureSlot.count(), 1);
          assert.equal(await futureSlot.getAttribute("data-day"), futureIso);
          await settleVisual(page);
          await recordShot(page, `agenda-runtime-clean-${vp.toLowerCase()}.png`, files);
          assert.equal(errors.length, 0, `${vp} console after calendar edges: ${errors.join(" | ")}`);
        } finally {
          await page.close();
        }
      }

      async function openClock(y: number, month: number, day: number, id: string) {
        const page = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
        const html = withFenixNow(composed.html, y, month, day);
        const src = prepareSrcDoc(html, composed.tokens.palette, id, "app");
        await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
        await waitForFenixReady(page, 8000);
        return page;
      }

      const satPage = await openClock(2026, 9, 5, "agenda-clock-sat");
      try {
        await satPage.locator('nav button[data-view="oggi"]').click();
        assert.match(await satPage.locator(".day-head .kicker").innerText(), /2026-09-05/);
        await satPage.locator('nav button[data-view="settimana"]').click();
        assert.equal(await satPage.locator('.week-day[aria-selected="true"]').getAttribute("data-day"), saturdayIso);
        assert.equal(await satPage.locator(".week-day[data-day]").count(), 7);
      } finally {
        await satPage.close();
      }

      const sunPage = await openClock(2026, 9, 6, "agenda-clock-sun");
      try {
        await sunPage.locator('nav button[data-view="oggi"]').click();
        assert.match(await sunPage.locator(".day-head .kicker").innerText(), /2026-09-06/);
        await sunPage.locator('nav button[data-view="settimana"]').click();
        assert.equal(await sunPage.locator('.week-day[aria-selected="true"]').getAttribute("data-day"), sundayIso);
      } finally {
        await sunPage.close();
      }

      const yearPage = await openClock(2026, 1, 2, "agenda-clock-year");
      try {
        await yearPage.locator('nav button[data-view="settimana"]').click();
        const yearIsos = await yearPage.locator(".week-day[data-day]").evaluateAll((nodes) =>
          nodes.map((n) => (n as HTMLElement).getAttribute("data-day")),
        );
        assert.deepEqual(yearIsos, [
          "2025-12-29",
          "2025-12-30",
          "2025-12-31",
          "2026-01-01",
          "2026-01-02",
          "2026-01-03",
          "2026-01-04",
        ]);
      } finally {
        await yearPage.close();
      }

      const monthPage = await openClock(2026, 2, 28, "agenda-clock-month");
      try {
        await monthPage.locator('nav button[data-view="settimana"]').click();
        const monthIsos = await monthPage.locator(".week-day[data-day]").evaluateAll((nodes) =>
          nodes.map((n) => (n as HTMLElement).getAttribute("data-day")),
        );
        assert.equal(monthIsos[5], "2026-02-28");
        assert.equal(monthIsos[6], "2026-03-01");
      } finally {
        await monthPage.close();
      }

      const persist = await isolatedPage(browser, { viewport: { width: 390, height: 844 } });
      persist.setDefaultTimeout(15000);
      await persist.setContent(PERSIST_HOST);
      const persistSrc = prepareSrcDoc(
        withFenixNow(composed.html, 2026, 9, 4),
        composed.tokens.palette,
        "agenda-cal-persist",
        "app",
      );
      const loadPersist = (srcDoc: string) =>
        persist.locator("#f").evaluate((el, doc: string) => {
          (el as HTMLIFrameElement).srcdoc = doc;
        }, srcDoc);
      await loadPersist(persistSrc);
      const frame = persist.frameLocator("#f");
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });

      await frame.locator('nav button[data-view="nuovo"]').click();
      await frame.locator("#n").fill("");
      await frame.locator("#ora").evaluate((el) => {
        (el as HTMLInputElement).value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await frame.locator("#fnew [data-act='save']").click();
      assert.equal(await frame.locator("#toast[hidden]").count(), 1, "invalid click: no success toast");
      assert.equal(await frame.locator("#err[hidden]").count(), 0, "invalid click: error visible");
      const savedAfterInvalid = await persist.evaluate(() => {
        const db = (window as unknown as { __db: Record<string, { items?: unknown[] }> }).__db;
        return db && db.slot && Array.isArray(db.slot.items) ? db.slot.items.length : 0;
      });
      assert.equal(savedAfterInvalid, 0, "invalid click does not persist");

      await frame.locator("#n").press("Enter");
      assert.equal(await frame.locator("#toast[hidden]").count(), 1, "invalid Enter: no success toast");
      assert.equal(
        await persist.evaluate(() => {
          const db = (window as unknown as { __db: Record<string, { items?: unknown[] }> }).__db;
          return db && db.slot && Array.isArray(db.slot.items) ? db.slot.items.length : 0;
        }),
        0,
        "invalid Enter does not persist",
      );

      await frame.locator("#n").fill("Weekend keep");
      await frame.locator("#ora").fill("11:40");
      await frame.locator("#data").fill(saturdayIso);
      await frame.locator("#luogo").fill("Sala sabato");
      await frame.locator("#cliente").fill("Neri");
      await frame.locator("#fnew [data-act='save']").click();
      await frame.getByRole("heading", { name: "Weekend keep", exact: true }).waitFor({ timeout: 8000 });
      assert.equal(await frame.locator('article.slot:has-text("Weekend keep")').getAttribute("data-day"), saturdayIso);
      await persist.waitForFunction(() => {
        const db = (window as unknown as { __db: Record<string, { items?: { title?: string; day?: string }[] }> }).__db;
        const items = db && db.slot && Array.isArray(db.slot.items) ? db.slot.items : [];
        return items.some((row) => row.title === "Weekend keep" && row.day === "2026-09-05");
      });

      const nextWeek = prepareSrcDoc(
        withFenixNow(composed.html, 2026, 9, 11),
        composed.tokens.palette,
        "agenda-cal-next-week",
        "app",
      );
      await loadPersist(nextWeek);
      await frame.locator("[data-fenix-ready]").waitFor({ timeout: 8000 });
      await persist.waitForFunction(() => {
        const db = (window as unknown as { __db: Record<string, { items?: { title?: string; day?: string }[] }> }).__db;
        const items = db && db.slot && Array.isArray(db.slot.items) ? db.slot.items : [];
        return items.some((row) => row.title === "Weekend keep" && row.day === "2026-09-05");
      });
      const kept = await persist.evaluate(() => {
        const db = (window as unknown as { __db: Record<string, { items?: { title?: string; day?: string }[] }> }).__db;
        return (db.slot.items || []).find((row) => row.title === "Weekend keep");
      });
      assert.equal(kept && kept.day, saturdayIso, "saved ISO day does not move when week changes");
      await persist.close();
    } finally {
      await browser.close();
    }
    mkdirSync(SHOTS, { recursive: true });
    const extra = {
      product: "Agenda-calendar-edges",
      files,
      credits: 0,
      residual:
        "Graphic five-brief proof remains after-only: no parent-SHA before/after, three mobile palettes still close. Calendar edges prove function, not 9/10 craft.",
    };
    writeFileSync(join(SHOTS, "edges.json"), `${JSON.stringify(extra, null, 2)}\n`);
    assert.equal(files.length, 12);
    for (const file of files) {
      assert.equal(existsSync(join(SHOTS, file.name)), true);
      assert.ok(statSync(join(SHOTS, file.name)).size > 1000);
    }
  });
});
