import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { launchChromium } from "./playwright-harness.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import {
  looksLikeBeigeSaas,
  parseEuro,
  polishDashboardHtml,
  repairDashboardCrud,
  discoverAppCollection,
  scrubTechMessages,
  keepLatestPronto,
  stripFakeStudioCopy,
} from "./dashboard-crud.ts";
import { recoverPersistedProject } from "./recover.ts";
import { DEMOS } from "./demos.ts";
import { validateProductHtml } from "./validate-html.ts";
import { requirePreview, PREVIEW_RESTART_ARGV } from "./ensure-preview.ts";

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
  it("restarts preview via node scripts/preview.mjs, not npm", () => {
    assert.deepEqual([...PREVIEW_RESTART_ARGV], ["scripts/preview.mjs", "restart"]);
  });

  it("discovers argilla_viva from product Fenix.load/save", () => {
    assert.equal(discoverAppCollection(ARGILLA), "argilla_viva");
    assert.equal(discoverAppCollection(`window.Fenix.save("items", [])`), "items");
    assert.equal(discoverAppCollection(`Fenix.load('state')`), "state");
  });

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
      { content: "JOB_STILL_RUNNING", role: "assistant" },
    ]);
    assert.equal(msgs.some((m) => /persistenza via/i.test(m.content)), false);
    assert.ok(msgs.some((m) => /Inventario pronto/.test(m.content)));
    assert.equal(msgs.some((m) => /JOB_STILL_RUNNING/.test(m.content)), false);
    assert.ok(msgs.some((m) => /Riprendi rifinitura/.test(m.content)));
  });

  it("keeps a single latest Pronto on recover/scrub", () => {
    const msgs = keepLatestPronto([
      { content: "Pronto. Bottega Terra è in anteprima e si usa." },
      { content: "Motore visivo: Foto hero." },
      { content: "Pronto. Bottega Terra • Ceramica a Grottaglie è in anteprima e si usa." },
    ]);
    assert.equal(msgs.filter((m) => /^Pronto\./.test(m.content)).length, 1);
    assert.match(msgs.at(-1)?.content || "", /Ceramica a Grottaglie/);
    const scrubbed = scrubTechMessages([
      { content: "Pronto. Prima.", role: "assistant" },
      { content: "Ok.", role: "assistant" },
      { content: "Pronto. Dopo.", role: "assistant" },
    ]);
    assert.equal(scrubbed.filter((m) => /^Pronto\./.test(m.content)).length, 1);
    assert.equal(scrubbed.at(-1)?.content, "Pronto. Dopo.");
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
    assert.match(recovered.html, /1f5f8b|c35d35/);
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

  it("builds a professional client form from the table schema, never inventory fields", async () => {
    const clients = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Clienti</title></head><body>
    <header><strong>Anagrafica Clienti</strong></header><main><button type="button">Nuovo cliente</button>
    <table aria-label="Riepilogo"><thead><tr><th>Metrica</th><th>Valore</th></tr></thead><tbody><tr><td>Totale clienti</td><td>2</td></tr></tbody></table>
    <table><thead><tr><th>Nome e cognome</th><th>Email</th><th>Telefono</th><th>Azienda</th><th>Data inserimento</th><th>Azioni</th></tr></thead>
    <tbody><tr><td>Giulia Bianchi</td><td>giulia@example.it</td><td>347 1234567</td><td>Bianchi Design</td><td>1 settembre 2026</td><td><button>Modifica</button></td></tr></tbody></table></main>
    <script>window.Fenix.load("clienti");window.Fenix.save("clienti",[]);document.documentElement.setAttribute("data-fenix-ready","1")</script></body></html>`;
    const polished = polishDashboardHtml(clients, "dashboard");
    const src = prepareSrcDoc(polished, { bg: "#201812", surface: "#2a211b", fg: "#f3eadc", muted: "#a8927e", accent: "#d26a2e" }, "clienti", "dashboard");
    const browser = await launchChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
      await page.setContent(src, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.getByRole("button", { name: /nuovo cliente/i }).click();
      const dialog = page.locator("#fenix-sheet");
      await dialog.waitFor({ state: "visible", timeout: 4000 });
      const schema = (await dialog.locator("label").allTextContents()).join(" | ");
      assert.match(schema, /Nome e cognome/i);
      assert.match(schema, /Email/i);
      assert.match(schema, /Telefono/i);
      assert.match(schema, /Azienda/i);
      assert.match(schema, /Data inserimento/i);
      assert.doesNotMatch(schema, /Categoria|Stato|Quantità|Prezzo/i);
      assert.equal(await dialog.locator('input[type="email"]').count(), 1);
      assert.equal(await dialog.locator('input[type="tel"]').count(), 1);
      assert.equal(await dialog.locator('input[type="date"]').count(), 1);
      const visual = await page.evaluate(() => {
        const input = document.querySelector("#fenix-sheet input") as HTMLElement;
        const action = document.querySelector("#fenix-sheet [data-fenix=save]") as HTMLElement;
        const table = document.querySelector("table") as HTMLElement;
        const root = getComputedStyle(document.documentElement);
        return {
          inputRadius: parseFloat(getComputedStyle(input).borderRadius),
          inputHeight: input.getBoundingClientRect().height,
          actionRadius: parseFloat(getComputedStyle(action).borderRadius),
          tableOverflow: getComputedStyle(table).overflowX,
          bg: root.getPropertyValue("--bg").trim(),
          surface: root.getPropertyValue("--surface").trim(),
        };
      });
      assert.ok(visual.inputRadius >= 6 && visual.inputHeight >= 40);
      assert.ok(visual.actionRadius >= 6);
      assert.match(visual.tableOverflow, /auto|scroll/);
      assert.equal(visual.bg, "#eef3f8");
      assert.equal(visual.surface, "#ffffff");
    } finally {
      await browser.close();
    }
  });

  it("fixture matches production .summary/.summary-item, not data-summary", () => {
    assert.match(ARGILLA, /class="summary"/);
    assert.match(ARGILLA, /summary-item/);
    assert.match(ARGILLA, /QTÀ/);
    assert.match(ARGILLA, /€42/);
    assert.match(ARGILLA, /\.modal\{display:none/);
    assert.match(ARGILLA, /Ultimi pezzi inseriti/);
    assert.match(ARGILLA, /data-view="dash" class="on"/);
    assert.doesNotMatch(ARGILLA, /id="modal"[^>]*\bhidden\b/);
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
    assert.match(html, /data-fenix-crud="13"/);
    assert.match(html, /var COL = "argilla_viva"/);
    assert.equal((html.match(/data-fenix-crud/g) || []).length, 1);
    const src = prepareSrcDoc(
      html,
      { bg: "#f3eadc", fg: "#2b211c", accent: "#b85c38" },
      "argilla-viva",
      "dashboard",
    );
    const browser = await launchChromium();
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
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      const modalCss = await frame.locator("#modal").evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          hiddenProp: (el as HTMLElement).hidden,
          hiddenAttr: el.hasAttribute("hidden"),
          openAttr: el.hasAttribute("open"),
          classes: el.className,
          display: cs.display,
        };
      });
      assert.equal(modalCss.hiddenProp, false, JSON.stringify(modalCss));
      assert.equal(modalCss.hiddenAttr, false);
      assert.equal(modalCss.openAttr, false);
      assert.equal(modalCss.display, "none");
      await frame.getByRole("button", { name: /inventario/i }).click();
      await frame.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 4000 });
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").waitFor({ timeout: 3000 });
      await frame.getByRole("button", { name: /^annulla$/i }).click();
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").fill("Codex Prova Reale");
      await frame.locator("#p-qty").fill("2");
      await frame.locator("#p-prezzo").fill("17");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      const row = frame.locator("#rows tr", { hasText: "Codex Prova Reale" });
      await row.waitFor({ timeout: 4000 });
      assert.equal((await row.locator("td").nth(3).textContent())?.trim(), "2");
      assert.equal((await row.locator("td").nth(4).textContent())?.trim(), "17");
      const sum = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum, /25 pezzi/);
      assert.match(sum, /104 in stock/);
      assert.match(sum, /3638/);
      assert.equal(await frame.locator("#fk-saved").count(), 0);
      assert.equal(await frame.locator("#rows tr").count(), 25);
      await loadSrc();
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      const dashRow = frame.locator("#recent-rows tr", { hasText: "Codex Prova Reale" });
      await dashRow.waitFor({ timeout: 5000 });
      await frame.getByRole("button", { name: /inventario/i }).click();
      const row2 = frame.locator("#rows tr", { hasText: "Codex Prova Reale" });
      await row2.waitFor({ timeout: 5000 });
      const bootSrc = JSON.parse((await frame.locator("html").getAttribute("data-fenix-boot")) || "{}");
      assert.equal(bootSrc.col, "argilla_viva", `srcdoc boot ${JSON.stringify(bootSrc)}`);
      assert.equal(bootSrc.n, 25);
      assert.equal((await row2.locator("td").nth(3).textContent())?.trim(), "2");
      const sum2 = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
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
      await frame.locator("#inv-summary").getByText("107 in stock").waitFor({ timeout: 3000 });
      await frame.locator("#rows tr", { hasText: "Codex Prova Reale" }).getByRole("button", { name: /^elimina$/i }).click();
      assert.equal(await frame.locator("#rows tr", { hasText: "Codex Prova Reale" }).count(), 0);
      const sum3 = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum3, /24 pezzi/);
      assert.match(sum3, /102 in stock/);
      assert.match(sum3, /3604/);
      assert.equal(await frame.locator("#rows tr").count(), 24);
      await page.close();
    } finally {
      await browser.close();
    }
  });

  it("Studio remount keeps Argilla row, summary and edit/delete", async () => {
    const PREVIEW = await requirePreview();
    const ARGILLA_PID = "49c14680-a504-436d-a0db-84e4f3583dbe";
    const html = polishDashboardHtml(ARGILLA, "dashboard");
    const browser = await launchChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(
        ({ seeded, pid }: { seeded: string; pid: string }) => {
          if (window !== window.parent) return;
          if (sessionStorage.getItem("fenix-seed-" + pid)) return;
          sessionStorage.setItem("fenix-seed-" + pid, "1");
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
              version: 3,
            }),
          );
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
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 15000 });
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").waitFor({ timeout: 4000 });
      await frame.locator("#p-nome").fill("Codex Verifica 1e7b47a");
      await frame.locator("#p-qty").fill("2");
      await frame.locator("#p-prezzo").fill("17");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await frame.locator("tr", { hasText: "Codex Verifica 1e7b47a" }).first().waitFor({ timeout: 8000 });
      await frame.getByRole("button", { name: /inventario/i }).click();
      await frame.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 8000 });
      await frame.locator("#rows tr", { hasText: "Codex Verifica 1e7b47a" }).waitFor({ timeout: 8000 });
      const sum = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum, /25 pezzi/);
      assert.match(sum, /104 in stock/);
      assert.match(sum, /3638/);
      await page.waitForFunction(() => {
        try {
          const d = JSON.parse(document.documentElement.getAttribute("data-fenix-diag") || "{}");
          return (
            d.col === "argilla_viva" &&
            (Number(d.idb) >= 25 || Number(d.session) >= 25 || Number(d.local) >= 25)
          );
        } catch {
          return false;
        }
      }, null, { timeout: 8000 });
      const beforeDiag = JSON.parse((await page.locator("html").getAttribute("data-fenix-diag")) || "{}");
      assert.equal(beforeDiag.col, "argilla_viva");
      assert.ok(
        beforeDiag.idb >= 25 || beforeDiag.session >= 25 || beforeDiag.local >= 25,
        `diag before reload ${JSON.stringify(beforeDiag)}`,
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("iframe").first().waitFor({ timeout: 15000 });
      assert.equal(await page.locator("iframe").count(), 2);
      await page.waitForFunction(() => {
        try {
          const d = JSON.parse(document.documentElement.getAttribute("data-fenix-diag") || "{}");
          return (
            d.col === "argilla_viva" &&
            (Number(d.idb) >= 25 || Number(d.session) >= 25 || Number(d.local) >= 25 || Number(d.n) >= 25)
          );
        } catch {
          return false;
        }
      }, null, { timeout: 15000 });

      const frame2 = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame2.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 15000 });
      const initialRow = await frame2.locator("tr", { hasText: "Codex Verifica 1e7b47a" }).count();
      assert.ok(initialRow > 0, "riga assente in Dashboard dopo reload");
      await frame2.getByRole("button", { name: /inventario/i }).click();
      const row2 = frame2.locator("#rows tr", { hasText: "Codex Verifica 1e7b47a" });
      await row2.waitFor({ timeout: 8000 });
      const boot = JSON.parse((await frame2.locator("html").getAttribute("data-fenix-boot")) || "{}");
      assert.equal(boot.col, "argilla_viva", `boot after reload ${JSON.stringify(boot)}`);
      assert.equal(boot.n, 25);
      const sum2 = (await frame2.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(sum2, /25 pezzi/);
      assert.match(sum2, /104 in stock/);
      assert.match(sum2, /3638/);
      assert.equal(await frame2.locator("#fk-saved").count(), 0);
      await row2.getByRole("button", { name: /^modifica$/i }).click();
      await frame2.locator("#p-qty").waitFor({ timeout: 3000 });
      assert.equal(await frame2.locator("#p-qty").inputValue(), "2");
      await frame2.locator("#p-qty").fill("5");
      await frame2.locator("#p-prezzo").fill("20");
      await frame2.getByRole("button", { name: /^salva$/i }).click();
      await row2.locator("td").nth(3).filter({ hasText: /^5$/ }).waitFor({ timeout: 4000 });
      assert.match((await frame2.locator("#inv-summary").innerText()).replace(/\s+/g, " "), /107 in stock/);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("iframe").first().waitFor({ timeout: 15000 });
      const frame3 = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame3.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 15000 });
      await frame3.getByRole("button", { name: /inventario/i }).click();
      const edited = frame3.locator("#rows tr", { hasText: "Codex Verifica 1e7b47a" });
      await edited.waitFor({ timeout: 15000 });
      await edited.locator("td").nth(3).filter({ hasText: /^5$/ }).waitFor({ timeout: 4000 });
      await edited.getByRole("button", { name: /^elimina$/i }).click();
      await frame3.locator("#rows tr", { hasText: "Codex Verifica 1e7b47a" }).waitFor({
        state: "detached",
        timeout: 4000,
      });
      assert.match((await frame3.locator("#inv-summary").innerText()).replace(/\s+/g, " "), /24 pezzi/);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("iframe").first().waitFor({ timeout: 15000 });
      const frame4 = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame4.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 15000 });
      await frame4.getByRole("button", { name: /inventario/i }).click();
      await frame4.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 8000 });
      assert.equal(await frame4.locator("#rows tr", { hasText: "Codex Verifica 1e7b47a" }).count(), 0);
      assert.match((await frame4.locator("#inv-summary").innerText()).replace(/\s+/g, " "), /24 pezzi/);
      assert.match((await frame4.locator("#inv-summary").innerText()).replace(/\s+/g, " "), /102 in stock/);
      const tomb = JSON.parse((await frame4.locator("html").getAttribute("data-fenix-boot")) || "{}");
      assert.equal(tomb.col, "argilla_viva");
      assert.equal(tomb.n, 24);
      await page.close();
    } finally {
      await browser.close();
    }
  });

  it("add survives reload + Inventario, no data loss, console clean", async () => {
    const html = repairDashboardCrud(ARGILLA);
    const src = prepareSrcDoc(
      html,
      { bg: "#f3eadc", fg: "#2b211c", accent: "#b85c38" },
      "argilla-viva",
      "dashboard",
    );
    const browser = await launchChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
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
      const frame = page.frameLocator("#f");
      const goInv = async () => {
        await frame.getByRole("button", { name: /inventario/i }).click();
        await frame.getByRole("heading", { name: "Inventario" }).waitFor({ timeout: 4000 });
      };
      await loadSrc();
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").fill("Codex QA c9a047e");
      await frame.locator("#p-qty").fill("3");
      await frame.locator("#p-prezzo").fill("19");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await frame.locator("tr", { hasText: "Codex QA c9a047e" }).first().waitFor({ timeout: 4000 });
      await goInv();
      const added = frame.locator("#rows tr", { hasText: "Codex QA c9a047e" });
      await added.waitFor({ timeout: 4000 });
      let inv = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(inv, /25 pezzi/);
      assert.match(inv, /105 in stock/);
      assert.match(inv, /3661/);
      await loadSrc();
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      const initialRow = (await frame.locator("tr", { hasText: "Codex QA c9a047e" }).count()) > 0;
      assert.equal(initialRow, true, "initialRow after reload");
      await goInv();
      const afterNav = frame.locator("#rows tr", { hasText: "Codex QA c9a047e" });
      await afterNav.waitFor({ timeout: 5000 });
      inv = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(inv, /25 pezzi/);
      assert.match(inv, /105 in stock/);
      assert.match(inv, /3661/);
      await afterNav.getByRole("button", { name: /^modifica$/i }).click();
      await frame.locator("#p-qty").fill("4");
      await frame.locator("#p-prezzo").fill("21");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await afterNav.locator("td").nth(3).filter({ hasText: /^4$/ }).waitFor({ timeout: 4000 });
      await loadSrc();
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      await goInv();
      const edited = frame.locator("#rows tr", { hasText: "Codex QA c9a047e" });
      await edited.waitFor({ timeout: 5000 });
      assert.equal((await edited.locator("td").nth(3).textContent())?.trim(), "4");
      await edited.getByRole("button", { name: /^elimina$/i }).click();
      await frame.locator("#rows tr", { hasText: "Codex QA c9a047e" }).waitFor({ state: "detached", timeout: 4000 });
      await loadSrc();
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      await goInv();
      assert.equal(await frame.locator("#rows tr", { hasText: "Codex QA c9a047e" }).count(), 0);
      inv = (await frame.locator("#inv-summary").innerText()).replace(/\s+/g, " ");
      assert.match(inv, /24 pezzi/);
      assert.match(inv, /102 in stock/);
      assert.match(inv, /3604/);
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").fill("Keep A");
      await frame.locator("#p-qty").fill("1");
      await frame.locator("#p-prezzo").fill("10");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await frame.locator("#rows tr", { hasText: "Keep A" }).waitFor({ timeout: 4000 });
      await frame.getByRole("button", { name: /nuovo pezzo/i }).click();
      await frame.locator("#p-nome").fill("Keep B");
      await frame.locator("#p-qty").fill("1");
      await frame.locator("#p-prezzo").fill("10");
      await frame.getByRole("button", { name: /^salva$/i }).click();
      await frame.locator("#rows tr", { hasText: "Keep B" }).waitFor({ timeout: 4000 });
      await loadSrc();
      await frame.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 8000 });
      await goInv();
      assert.equal(await frame.locator("#rows tr", { hasText: "Keep A" }).count(), 1);
      assert.equal(await frame.locator("#rows tr", { hasText: "Keep B" }).count(), 1);
      assert.equal(await frame.locator("#rows tr").count(), 26);
      const syntax = errors.filter((e) => /missing \) after argument list|SyntaxError/i.test(e));
      assert.equal(syntax.join(" | "), "", `srcdoc syntax ${syntax.join(" | ")}`);
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
