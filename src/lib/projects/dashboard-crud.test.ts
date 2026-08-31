import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { prepareSrcDoc } from "./color-scheme.ts";
import {
  looksLikeBeigeSaas,
  parseEuro,
  polishDashboardHtml,
  repairDashboardCrud,
  scrubTechMessages,
  stripFakeStudioCopy,
} from "./dashboard-crud.ts";
import { recoverPersistedProject } from "./recover.ts";
import { DEMOS } from "./demos.ts";
import { validateProductHtml } from "./validate-html.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ARGILLA = readFileSync(join(here, "fixtures/argilla-viva.html"), "utf8");

const BROKEN = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Argilla Viva</title>
<style>:root{--bg:#f5f5f7;--fg:#1d1d1f;--accent:#0071e3}body{font-family:Inter,system-ui,sans-serif;background:#f5f5f7}</style>
</head><body>
<header>
  <strong>Argilla Viva</strong>
  <nav>
    <button type="button" data-view="dash" class="on">Dashboard</button>
    <button type="button" data-view="inv">Inventario</button>
    <button type="button" data-view="ord">Ordini</button>
    <button type="button" data-view="cli">Clienti</button>
  </nav>
</header>
<main>
  <section data-view="inv">
    <h1>Inventario</h1>
    <p>Persistenza via ,</p>
    <button type="button" id="nuovo">+ Nuovo pezzo</button>
    <table><thead><tr><th>Nome</th><th>Qty</th><th>Stato</th></tr></thead>
    <tbody>
      <tr><td>Ciotola</td><td>4</td><td>in laboratorio</td><td><button type="button">Modifica</button></td></tr>
    </tbody></table>
    <dialog id="m">
      <form id="f">
        <input name="nome" placeholder="Nome"/>
        <button type="button" id="annulla">Annulla</button>
        <button type="submit">Salva</button>
      </form>
    </dialog>
  </section>
</main>
<script>
  window.Fenix = { load: function(){ return Promise.resolve({items:[]}); }, save: function(){ return Promise.resolve(); } };
  document.documentElement.setAttribute("data-fenix-ready","1");
</script>
</body></html>`;


describe("dashboard CRUD repair", () => {
  it("strips fake Studio copy", () => {
    const cleaned = stripFakeStudioCopy(
      "Pronto. Argilla Viva è in anteprima: 1 schermate (Fenix 2: Vite + React).",
    );
    assert.doesNotMatch(cleaned, /Fenix 2|Vite \+ React|1 schermate|\(\)|:\s*\./);
    const leftover = stripFakeStudioCopy("Argilla Viva è in anteprima: ().");
    assert.equal(leftover, "Argilla Viva è in anteprima");
    const msgs = scrubTechMessages([
      { content: "Persistenza via ,", role: "assistant" },
      { content: "Ok. Inventario pronto.", role: "assistant" },
    ]);
    assert.equal(msgs.some((m) => /persistenza via/i.test(m.content)), false);
    assert.ok(msgs.some((m) => /Inventario pronto/.test(m.content)));
  });

  it("rejects unrepaired Nuovo pezzo and recover injects crud+craft", () => {
    assert.equal(looksLikeBeigeSaas(BROKEN), true);
    const before = validateProductHtml(BROKEN, { kind: "dashboard" });
    assert.equal(before.ok, false);
    assert.ok(before.errors.some((e) => /Nuovo/i.test(e)));
    const recovered = recoverPersistedProject({
      id: "argilla",
      status: "ready",
      html: BROKEN,
      kind: "dashboard",
      prompt: "FORMATO: gestionale. kind=dashboard. Argilla Viva",
      updatedAt: Date.now(),
    });
    assert.match(recovered.html, /data-fenix-crud/);
    assert.match(recovered.html, /data-fenix-craft-desk/);
    assert.match(recovered.html, /b85c38/);
    assert.doesNotMatch(recovered.html, /Persistenza via/);
    const after = validateProductHtml(recovered.html, { kind: "dashboard" });
    assert.equal(after.ok, true, after.errors.join(" · "));
  });

  it("keeps kiln publishable", () => {
    const kiln = polishDashboardHtml(DEMOS.kiln.html, "dashboard");
    const report = validateProductHtml(kiln, { kind: "dashboard" });
    assert.equal(report.ok, true, report.errors.join(" · "));
    assert.doesNotMatch(kiln, /data-fenix-craft-desk/);
    assert.doesNotMatch(kiln, /data-fenix-crud/);
  });

  it("fixture matches production .summary/.summary-item, not data-summary", () => {
    assert.match(ARGILLA, /class="summary"/);
    assert.match(ARGILLA, /summary-item/);
    assert.match(ARGILLA, /QTÀ/);
    assert.match(ARGILLA, /€42/);
    assert.doesNotMatch(ARGILLA, /data-summary/);
  });

  it("parseEuro reads Italian currency cells", () => {
    assert.equal(parseEuro("€42"), 42);
    assert.equal(parseEuro("€3.604"), 3604);
    assert.equal(parseEuro("17"), 17);
    assert.equal(parseEuro("17,50"), 17.5);
    assert.equal(parseEuro("€ 1.234,56"), 1234.56);
  });

  it("Salva on real Argilla HTML adds a row, survives reload, edit and delete", async () => {
    const withV1 = ARGILLA.replace(
      "</body>",
      `<script data-fenix-crud>window.__fenixCrud=1;</script></body>`,
    );
    const html = repairDashboardCrud(withV1);
    assert.match(html, /data-fenix-crud="7"/);
    assert.equal((html.match(/data-fenix-crud/g) || []).length, 1);
    const src = prepareSrcDoc(
      html,
      { bg: "#f3eadc", fg: "#2b211c", accent: "#b85c38" },
      "argilla-viva",
      "dashboard",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:1280px;height:800px;border:0"></iframe>
<script>
  window.__db = {};
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-db" || !m.id) return;
    if (m.op === "save") window.__db[m.col] = m.data;
    var v = m.op === "load" ? (window.__db[m.col] || null) : m.data;
    e.source.postMessage({ t: "fenix-db", id: m.id, v: v }, "*");
  });
</script>
</body></html>`);
      const loadSrc = async () => {
        await page.locator("#f").evaluate((el, srcDoc: string) => {
          (el as HTMLIFrameElement).srcdoc = srcDoc;
        }, src);
      };
      await loadSrc();
      const frame = page.frameLocator("#f");
      await frame.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 8000 });
      await frame.getByRole("button", { name: /inventario/i }).click();
      const rows0 = await frame.locator("table tbody tr").count();
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").waitFor({ timeout: 3000 });
      await frame.getByRole("button", { name: /^annulla$/i }).click();
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").fill("Codex Prova Reale");
      await frame.locator("#p-qty").fill("2");
      await frame.locator("#p-prezzo").fill("17");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      const row = frame.locator("tr", { hasText: "Codex Prova Reale" });
      await row.waitFor({ timeout: 4000 });
      assert.equal((await row.locator("td").nth(3).textContent())?.trim(), "2");
      assert.equal((await row.locator("td").nth(4).textContent())?.trim(), "17");
      const sum = (await frame.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum, /25 pezzi/);
      assert.match(sum, /104 in stock/);
      assert.match(sum, /3638/);
      assert.equal(await frame.locator("#fk-saved").count(), 0);
      const rows1 = await frame.locator("table tbody tr").count();
      assert.equal(rows1, 25);
      await loadSrc();
      const row2 = frame.locator("tr", { hasText: "Codex Prova Reale" });
      await row2.waitFor({ timeout: 5000 });
      assert.equal((await row2.locator("td").nth(3).textContent())?.trim(), "2");
      const sum2 = (await frame.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum2, /25 pezzi/);
      assert.match(sum2, /104 in stock/);
      assert.equal(await frame.locator("#fk-saved").count(), 0);
      await row2.getByRole("button", { name: /^modifica$/i }).click();
      assert.equal(await frame.locator("#p-nome").inputValue(), "Codex Prova Reale");
      assert.equal(await frame.locator("#p-qty").inputValue(), "2");
      assert.equal(await frame.locator("#p-prezzo").inputValue(), "17");
      await frame.locator("#p-qty").fill("5");
      await frame.locator("#p-prezzo").fill("20");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await frame.getByText("107 in stock").waitFor({ timeout: 3000 });
      await frame.locator("tr", { hasText: "Codex Prova Reale" }).getByRole("button", { name: /^elimina$/i }).click();
      assert.equal(await frame.getByText("Codex Prova Reale").count(), 0);
      const sum3 = (await frame.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum3, /24 pezzi/);
      assert.match(sum3, /102 in stock/);
      assert.match(sum3, /3604/);
      assert.equal(await frame.locator("table tbody tr").count(), 24);
      await page.close();
    } finally {
      await browser.close();
    }
  });

  it("Studio remount keeps Argilla row, summary and edit/delete", async (t) => {
    const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
    try {
      const health = await fetch(`${PREVIEW}/`, { signal: AbortSignal.timeout(1200) });
      if (!health.ok) {
        t.skip("preview non in ascolto");
        return;
      }
    } catch {
      t.skip("preview non in ascolto");
      return;
    }
    const ARGILLA_PID = "49c14680-a504-436d-a0db-84e4f3583dbe";
    const html = polishDashboardHtml(ARGILLA, "dashboard");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(
        ({ seeded, pid }: { seeded: string; pid: string }) => {
          try {
            if (sessionStorage.getItem("fenix-seed-" + pid)) return;
            sessionStorage.setItem("fenix-seed-" + pid, "1");
          } catch {
            /* ignore */
          }
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: pid,
                    name: "Argilla Viva",
                    tagline: "",
                    prompt: "FORMATO: gestionale ufficio. kind=dashboard",
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f3eadc",
                      surface: "#fbf6ee",
                      fg: "#2b211c",
                      muted: "#6e5648",
                      accent: "#b85c38",
                      line: "#d7c4b0",
                    },
                    html: seeded,
                    messages: [],
                    buildLog: [],
                    status: "ready",
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
                creditsRemaining: 46,
                appDb: {},
              },
              version: 2,
            }),
          );
          localStorage.removeItem("officina-appdb");
        },
        { seeded: html, pid: ARGILLA_PID },
      );
      await page.goto(`${PREVIEW}/studio/${ARGILLA_PID}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.locator("iframe").first().waitFor({ timeout: 15000 });
      assert.equal(await page.locator("iframe").count(), 2);
      const frame = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 15000 });
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").fill("Codex Verifica 1e7b47a");
      await frame.locator("#p-qty").fill("2");
      await frame.locator("#p-prezzo").fill("17");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await frame.locator("tr", { hasText: "Codex Verifica 1e7b47a" }).waitFor({ timeout: 5000 });
      const sum = (await frame.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum, /25 pezzi/);
      assert.match(sum, /104 in stock/);
      assert.match(sum, /3638/);
      await page.waitForFunction(
        (pid: string) => {
          try {
            const raw =
              localStorage.getItem("officina-appdb") || sessionStorage.getItem("officina-appdb") || "";
            const db = JSON.parse(raw || "{}") as Record<string, { items?: { nome?: string }[] }>;
            return db[pid]?.items?.length === 25 &&
              Boolean(db[pid]?.items?.some((r) => r.nome === "Codex Verifica 1e7b47a"));
          } catch {
            return false;
          }
        },
        ARGILLA_PID,
        { timeout: 8000 },
      );
      const before = await page.evaluate(() => ({
        local: localStorage.getItem("officina-appdb"),
        session: sessionStorage.getItem("officina-appdb"),
      }));
      assert.ok(before.local || before.session, "appdb missing after save");
      const rawBefore = (before.local || before.session) as string;
      const dbBefore = JSON.parse(rawBefore) as Record<
        string,
        { items?: { nome?: string }[]; state?: unknown }
      >;
      assert.ok(dbBefore[ARGILLA_PID]?.items, "items missing before reload");
      assert.equal(dbBefore[ARGILLA_PID]?.items?.length, 25);
      assert.ok(dbBefore[ARGILLA_PID]?.state, "state missing before reload");

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("iframe").first().waitFor({ timeout: 15000 });
      assert.equal(await page.locator("iframe").count(), 2);

      const frame2 = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame2.locator("tr", { hasText: "Codex Verifica 1e7b47a" }).waitFor({ timeout: 15000 });
      const sum2 = (await frame2.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum2, /25 pezzi/);
      assert.match(sum2, /104 in stock/);
      assert.match(sum2, /3638/);
      assert.equal(await frame2.locator("#fk-saved").count(), 0);
      const target = frame2.locator("tr", { hasText: "Codex Verifica 1e7b47a" });
      await target.getByRole("button", { name: /^modifica$/i }).click();
      await frame2.locator("#p-qty").waitFor({ timeout: 3000 });
      assert.equal(await frame2.locator("#p-qty").inputValue(), "2");
      await frame2.locator("#p-qty").fill("5");
      await frame2.locator("#p-prezzo").fill("20");
      await frame2.getByRole("button", { name: /^salva$/i }).click();
      await target.locator("td").nth(3).filter({ hasText: /^5$/ }).waitFor({ timeout: 4000 });
      const afterEdit = (await frame2.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(afterEdit, /107 in stock/);
      await target.getByRole("button", { name: /^elimina$/i }).click();
      await frame2.locator("tr", { hasText: "Codex Verifica 1e7b47a" }).waitFor({
        state: "detached",
        timeout: 4000,
      });
      const afterDel = (await frame2.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(afterDel, /24 pezzi/);
      assert.match(afterDel, /102 in stock/);
      assert.match(afterDel, /3604/);
      await page.close();
    } finally {
      await browser.close();
    }
  });

  it("two iframes + delayed hydrate keep 25 rows after reload", async (t) => {
    const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
    try {
      const health = await fetch(`${PREVIEW}/`, { signal: AbortSignal.timeout(1200) });
      if (!health.ok) {
        t.skip("preview non in ascolto");
        return;
      }
    } catch {
      t.skip("preview non in ascolto");
      return;
    }
    const PID = "49c14680-a504-436d-a0db-84e4f3583dbe";
    const src = prepareSrcDoc(
      repairDashboardCrud(ARGILLA),
      { bg: "#f3eadc", fg: "#2b211c", accent: "#b85c38" },
      PID,
      "dashboard",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript((srcDoc: string) => {
        (window as Window & { __SRC?: string }).__SRC = srcDoc;
      }, src);
      await page.route("**/bridge-harness", async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<iframe id="desk" data-preview="desktop" style="width:100%;height:80vh;border:0"></iframe>
<iframe id="phone" data-preview="mobile" style="position:absolute;left:-9999px;width:390px;height:700px;border:0"></iframe>
<script>
  window.__hydrated = false;
  window.__db = {};
  try {
    var raw = sessionStorage.getItem("officina-appdb") || localStorage.getItem("officina-appdb");
    if (raw) {
      var parsed = JSON.parse(raw);
      window.__db = parsed["${PID}"] || {};
    }
  } catch (e) {}
  function n(x){
    if (Array.isArray(x)) return x.length;
    if (x && x.items && x.items.length) return x.items.length;
    return 0;
  }
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-db" || !m.id) return;
    function apply() {
      var v = null;
      if (m.op === "load") v = window.__db[m.col] || null;
      if (m.op === "save") {
        var cur = window.__db[m.col];
        var incoming = m.data;
        if (n(incoming) < n(cur) && n(cur) > 0) incoming = cur;
        window.__db[m.col] = incoming;
        var blob = {};
        blob["${PID}"] = window.__db;
        var json = JSON.stringify(blob);
        try { localStorage.setItem("officina-appdb", json); } catch (err) {}
        try { sessionStorage.setItem("officina-appdb", json); } catch (err) {}
        var read = window.__db[m.col];
        v = { ok: n(read) >= n(incoming) && n(read) > 0, v: read };
      }
      e.source.postMessage({ t: "fenix-db", id: m.id, v: v }, "*");
    }
    if (window.__hydrated) apply();
    else setTimeout(function () { window.__hydrated = true; apply(); }, 700);
  });
  var src = window.__SRC || "";
  document.getElementById("desk").srcdoc = src;
  document.getElementById("phone").srcdoc = src;
</script>
</body></html>`,
        });
      });
      await page.goto(`${PREVIEW}/bridge-harness`, { waitUntil: "domcontentloaded", timeout: 20000 });
      assert.equal(await page.locator("iframe").count(), 2);
      const desk = page.frameLocator("#desk");
      await desk.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 15000 });
      await desk.getByRole("button", { name: /nuovo pezzo/i }).click();
      await desk.locator("#p-nome").fill("Codex Twin Frame");
      await desk.locator("#p-qty").fill("2");
      await desk.locator("#p-prezzo").fill("17");
      await desk.getByRole("button", { name: /^salva$/i }).click();
      await desk.locator("tr", { hasText: "Codex Twin Frame" }).waitFor({ timeout: 8000 });
      await page.waitForFunction(
        (pid: string) => {
          try {
            const db = JSON.parse(sessionStorage.getItem("officina-appdb") || "{}") as Record<
              string,
              { items?: { nome?: string }[] }
            >;
            return Boolean(db[pid]?.items?.some((r) => r.nome === "Codex Twin Frame"));
          } catch {
            return false;
          }
        },
        PID,
        { timeout: 8000 },
      );
      const before = await page.evaluate(() => sessionStorage.getItem("officina-appdb"));
      await page.reload({ waitUntil: "domcontentloaded" });
      const after = await page.evaluate(() => sessionStorage.getItem("officina-appdb"));
      assert.equal(after, before, "session appdb changed across reload");
      assert.equal(await page.locator("iframe").count(), 2);
      const desk2 = page.frameLocator("#desk");
      await desk2.locator("tr", { hasText: "Codex Twin Frame" }).waitFor({ timeout: 15000 });
      const sum = (await desk2.locator(".summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum, /25 pezzi/);
      assert.match(sum, /3638/);
    } finally {
      await browser.close();
    }
  });
});
