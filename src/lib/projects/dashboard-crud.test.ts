import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { prepareSrcDoc } from "./color-scheme.ts";
import { waitForFenixReady } from "../../../scripts/fenix-ready.mjs";
import {
  looksLikeBeigeSaas,
  polishDashboardHtml,
  repairDashboardCrud,
  scrubTechMessages,
  stripFakeStudioCopy,
} from "./dashboard-crud.ts";
import { recoverPersistedProject } from "./recover.ts";
import { DEMOS } from "./demos.ts";
import { validateProductHtml } from "./validate-html.ts";

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
  document.getElementById("m").querySelector("button[type=submit]");
  document.querySelectorAll("[data-view]").forEach(function(b){
    b.addEventListener("click", function(){ b.classList.add("on"); });
  });
  document.querySelector("button").addEventListener; /* Modifica opens, Annulla no */
  document.querySelectorAll("button").forEach(function(b){
    if (/modifica/i.test(b.textContent||"")) b.addEventListener("click", function(){ document.getElementById("m").showModal(); });
  });
  document.documentElement.setAttribute("data-fenix-ready","1");
</script>
</body></html>`;

describe("dashboard CRUD repair", () => {
  it("strips fake Studio copy", () => {
    const cleaned = stripFakeStudioCopy(
      "Pronto. Argilla è in anteprima: 1 schermate (Fenix 2: Vite + React).",
    );
    assert.doesNotMatch(cleaned, /Fenix 2|Vite \+ React|1 schermate/);
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

  it("click + Nuovo pezzo opens, Annulla closes, Salva adds a row", async () => {
    const html = repairDashboardCrud(BROKEN);
    const src = prepareSrcDoc(html, { bg: "#f3eadc", fg: "#2b211c", accent: "#b85c38" }, "argilla", "dashboard");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
      await waitForFenixReady(page, 8000);
      const rows0 = await page.locator("table tbody tr").count();
      await page.getByRole("button", { name: /nuovo pezzo/i }).click();
      const opened = await page.evaluate(() => {
        const d = document.querySelector("dialog, [role=dialog], .modal");
        if (!d) return false;
        const cs = getComputedStyle(d);
        return d.hasAttribute("open") || cs.display !== "none";
      });
      assert.equal(opened, true, "+ Nuovo pezzo did not open a form");
      await page.getByRole("button", { name: /^annulla$/i }).click();
      const closed = await page.evaluate(() => {
        const d = document.querySelector("dialog, [role=dialog], .modal");
        if (!d) return false;
        return !(d as HTMLElement).hasAttribute("open") || (d as HTMLElement).hidden === true || getComputedStyle(d).display === "none";
      });
      assert.equal(closed, true, "Annulla did not close");
      await page.getByRole("button", { name: /nuovo pezzo/i }).click();
      await page.locator("dialog input, [role=dialog] input, .modal input").first().fill("Anfora");
      await page.getByRole("button", { name: /^salva$/i }).click();
      const rows1 = await page.locator("table tbody tr").count();
      assert.ok(rows1 > rows0, `Salva did not add a row (${rows0} → ${rows1})`);
      assert.ok(await page.getByText("Anfora").count());
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
