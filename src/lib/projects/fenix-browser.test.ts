import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { DEMOS } from "./demos.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { RESUME_ERROR } from "./recover.ts";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import { requirePreview } from "./ensure-preview.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");
const NULL_INNER = readFileSync(join(here, "fixtures/null-innerhtml.html"), "utf8");
const NULL_FIXED = readFileSync(join(here, "fixtures/null-innerhtml-fixed.html"), "utf8");
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";

async function launch() {
  return chromium.launch({ headless: true });
}

describe("Fenix bridge in browser", () => {
  it("persists Split via window.Fenix.load/save across iframe reload", async () => {
    const html = DEMOS.split.html;
    assert.doesNotMatch(html, /\blocalStorage\b/);
    const src = prepareSrcDoc(html, DEMOS.split.palette, "split-demo", DEMOS.split.kind);
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:420px;height:720px;border:0"></iframe>
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
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      const frame = page.frameLocator("#f");
      await frame.locator("h1").filter({ hasText: "Spese" }).waitFor({ timeout: 8000 });
      await frame.locator("#t").fill("Pane");
      await frame.locator("#a").fill("12");
      await frame.locator("[data-act=add]").click();
      await frame.getByText("Pane · Anna").waitFor();
      await page.waitForFunction(
        () => {
          const db = (window as unknown as { __db?: { state?: { costs?: unknown[] } } }).__db;
          return Boolean(db?.state?.costs && db.state.costs.length >= 3);
        },
        null,
        { timeout: 5000 },
      );
      const saved = await page.evaluate(() => (window as unknown as { __db: { state?: { costs?: unknown[] } } }).__db);
      assert.ok(saved?.state?.costs && saved.state.costs.length >= 3, "parent store received Fenix.save");
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      await frame.getByText("Pane · Anna").waitFor({ timeout: 8000 });
    } finally {
      await browser.close();
    }
  });

  it("site contact form saves via Fenix and survives iframe reload even if parent boxes arrays", async () => {
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Bottega</title></head>
<body>
<nav><a href="#visita">Visita</a></nav>
<main>
<section id="visita">
<form id="contact-form">
<label for="name">Nome</label>
<input type="text" id="name" required>
<label for="email">Email</label>
<input type="email" id="email" required>
<label for="message">Messaggio</label>
<textarea id="message" required></textarea>
<button type="submit">Invia messaggio</button>
</form>
<ul id="messages-list"></ul>
</section>
</main>
<footer>via</footer>
<script>
async function init() {
  const form = document.getElementById("contact-form");
  const list = document.getElementById("messages-list");
  let messages = [];
  try {
    const loaded = await window.Fenix.load("messages");
    if (Array.isArray(loaded)) messages = loaded;
  } catch (e) {}
  function render() {
    list.innerHTML = "";
    if (!messages.length) {
      const li = document.createElement("li");
      li.textContent = "Nessun messaggio ancora.";
      list.appendChild(li);
      return;
    }
    messages.forEach(function (msg) {
      const li = document.createElement("li");
      li.textContent = msg.name + " — " + msg.message;
      list.appendChild(li);
    });
  }
  render();
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();
    if (!name || !message) return;
    messages.push({ name: name, email: email, message: message, date: new Date().toISOString() });
    try { await window.Fenix.save("messages", messages); } catch (err) {}
    render();
    form.reset();
  });
}
init();
</script>
</body></html>`;
    const src = prepareSrcDoc(html, "#1a1612", "bottega-form", "site");
    assert.match(src, /var desk = true/);
    const browser = await launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:1100px;height:800px;border:0"></iframe>
<script>
  window.__db = {};
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-db" || !m.id) return;
    if (m.op === "save") {
      var boxed = Array.isArray(m.data)
        ? { _fenix: 1, rev: 1, items: m.data, writer: "", at: Date.now() }
        : m.data;
      window.__db[m.col] = boxed;
      e.source.postMessage({ t: "fenix-db", id: m.id, v: { ok: true, v: boxed, durable: 1 } }, "*");
      return;
    }
    e.source.postMessage({ t: "fenix-db", id: m.id, v: window.__db[m.col] || null }, "*");
  });
</script>
</body></html>`);
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      const frame = page.frameLocator("#f");
      await frame.locator("#contact-form").waitFor({ timeout: 8000 });
      await frame.locator("#name").fill("Anna della Luna");
      await frame.locator("#email").fill("anna@bottegaterra.it");
      await frame.locator("#message").fill("Vorrei prenotare una visita.");
      await frame.locator("#contact-form button[type=submit]").click();
      await frame.getByText("Anna della Luna").waitFor({ timeout: 5000 });
      assert.equal(await frame.getByText("Nessun messaggio ancora.").count(), 0);
      const saved = await page.evaluate(
        () => (window as unknown as { __db: { messages?: { items?: { name?: string }[] } } }).__db,
      );
      assert.ok(
        saved?.messages?.items?.some((m) => m.name === "Anna della Luna"),
        "parent store received messages array inside the durability box",
      );
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      await frame.getByText("Anna della Luna").waitFor({ timeout: 8000 });
    } finally {
      await browser.close();
    }
  });
});

describe("studio overlay and resume in browser", () => {
  it("shows compact overlay on a building draft and Riprendi on stale error", async () => {
    await requirePreview();
    let browser;
    browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/(api\/build|api\/polish|api\/jobs\/|__worker\/)/, async () => {
        await new Promise(() => {
          /* hang so overlay stays compact without extra credits */
        });
      });
      await page.addInitScript(
        ({ html, resumeError }: { html: string; resumeError: string }) => {
          if (window !== window.parent) return;
          const now = Date.now();
          const overlay = {
            id: "p-overlay",
            name: "Bozza overlay",
            tagline: "",
            prompt: "test overlay",
            kind: "app",
            summary: "",
            palette: { bg: "#16110c", surface: "#221c16", fg: "#efe6d4", muted: "#9a8f7a", accent: "#c45c26" },
            html,
            messages: [],
            buildLog: ["Direzione visiva", "Codice"],
            status: "building",
            createdAt: now,
            updatedAt: now,
          };
          const resume = {
            ...overlay,
            id: "p-resume",
            name: "Bozza resume",
            status: "error",
            error: resumeError,
            buildLog: ["Rifinitura interrotta"],
          };
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: { projects: [overlay, resume], creditsRemaining: 50, appDb: {} },
              version: 2,
            }),
          );
        },
        { html: VALID, resumeError: RESUME_ERROR },
      );
      await page.goto(PREVIEW + "/studio/p-overlay", { waitUntil: "domcontentloaded", timeout: 20000 });
      const compact = page.locator("section.hidden.md\\:block .pointer-events-none.absolute.inset-x-0.top-0.z-20");
      await compact.waitFor({ timeout: 12000 });
      const box = await compact.boundingBox();
      assert.ok(box && box.height < 160, `overlay too tall: ${box?.height}`);
      const full = page.locator(".absolute.inset-0.z-10.grid.place-items-center");
      assert.equal(await full.count(), 0);
      await page.goto(PREVIEW + "/studio/p-resume", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprendi rifinitura" }).first().waitFor({ timeout: 12000 });
    } finally {
      await browser?.close();
    }
  });

  it("reattaches resume polling after reload without a second POST", async () => {
    await requirePreview();
    let browser;
    const ARGILLA_PROMPT =
      "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri. Tabella che si riempie. NON landing, NON tabbar iPhone.\n\nArgilla Viva — magazzino e ordini.";
    const jobId = "job-argilla-reattach";
    const readyHtml = DEMOS.kiln.html;
    let polishPosts = 0;
    let allowComplete = false;
    browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({
          status: 204,
          body: "",
        });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          const posted = route.request().postDataJSON() as { projectId?: string };
          assert.equal(posted?.projectId, "p-argilla");
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        const payload = allowComplete
          ? {
              id: jobId,
              status: "ok",
              html: readyHtml,
              meta: { kind: "dashboard", name: "Argilla Viva" },
              log: ["Rifinitura gestionale desktop"],
              files: [],
            }
          : { id: jobId, status: "run", log: ["In coda"], html: null };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(payload),
        });
      });
      await page.addInitScript(
        ({ html, resumeError, prompt }: { html: string; resumeError: string; prompt: string }) => {
          if (window !== window.parent) return;
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "p-argilla",
                    name: "Argilla Viva",
                    tagline: "",
                    prompt,
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f4efe6",
                      surface: "#fffaf3",
                      fg: "#2a241c",
                      muted: "#6f675c",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [],
                    buildLog: ["Rifinitura interrotta"],
                    status: "error",
                    error: resumeError,
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
        },
        { html: APP_SHELL_HTML, resumeError: RESUME_ERROR, prompt: ARGILLA_PROMPT },
      );
      await page.goto(PREVIEW + "/studio/p-argilla", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprendi rifinitura" }).first().click();
      const waitUniqueArgilla = async () => {
        await page.waitForFunction(
          () => {
            const raw = localStorage.getItem("officina-projects");
            if (!raw) return false;
            try {
              const project = JSON.parse(raw).state.projects.find((p: { id: string }) => p.id === "p-argilla");
              const logs: string[] = project?.buildLog ?? [];
              return (
                project?.visualJobId === "job-argilla-reattach" &&
                project?.status === "building" &&
                logs.filter((s) => s === "Riprendo rifinitura").length === 1 &&
                logs.filter((s) => s === "In coda").length === 1
              );
            } catch {
              return false;
            }
          },
          null,
          { timeout: 15000 },
        );
      };
      await waitUniqueArgilla();
      assert.equal(polishPosts, 1, "first resume must POST once");
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitUniqueArgilla();
      assert.equal(polishPosts, 1, "reload must not start a second polish job");
      const afterReload = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const project = JSON.parse(raw || "{}").state.projects.find((p: { id: string }) => p.id === "p-argilla");
        return {
          jobId: project?.visualJobId,
          status: project?.status,
          kind: project?.kind,
          requestedKind: project?.requestedKind,
          credits: JSON.parse(raw || "{}").state.creditsRemaining,
        };
      });
      assert.equal(afterReload.jobId, jobId);
      assert.equal(afterReload.status, "building");
      assert.equal(afterReload.kind, "dashboard");
      assert.equal(afterReload.requestedKind, "dashboard");
      assert.equal(afterReload.credits, 46);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitUniqueArgilla();
      assert.equal(polishPosts, 1);
      const logsTwice = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const project = JSON.parse(raw || "{}").state.projects.find((p: { id: string }) => p.id === "p-argilla");
        const logs: string[] = project?.buildLog ?? [];
        return {
          riprendo: logs.filter((s) => s === "Riprendo rifinitura").length,
          coda: logs.filter((s) => s === "In coda").length,
          jobId: project?.visualJobId,
          status: project?.status,
        };
      });
      assert.equal(logsTwice.riprendo, 1, "second reload must not persist another Riprendo");
      assert.equal(logsTwice.coda, 1);
      assert.equal(logsTwice.jobId, jobId);
      assert.equal(logsTwice.status, "building");
      allowComplete = true;
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-argilla");
            return project?.status === "ready" && !project?.visualJobId && state.creditsRemaining === 46;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 20000 },
      );
      assert.equal(polishPosts, 1);
      const publish = page.getByRole("button", { name: /Pubblica/ }).first();
      await publish.waitFor({ timeout: 8000 });
      assert.equal(await publish.isDisabled(), false);
    } finally {
      await browser?.close();
    }
  });

  it("pending JOB_STILL_RUNNING + reload keeps the same job, one POST, credits 42, then ready", async () => {
    await requirePreview();
    const jobId = "job-terra-live";
    const readyHtml = DEMOS.kiln.html;
    const ARGILLA_PROMPT =
      "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri. Tabella che si riempie. NON landing, NON tabbar iPhone.\n\nBottega Terra.";
    let polishPosts = 0;
    let allowComplete = false;
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        const payload = allowComplete
          ? {
              id: jobId,
              status: "ok",
              html: readyHtml,
              meta: { kind: "dashboard", name: "Bottega Terra" },
              log: ["Rifinitura"],
              files: [],
            }
          : { id: jobId, status: "run", log: ["Partito"], html: null };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(payload),
        });
      });
      await page.addInitScript(
        ({ html, prompt }: { html: string; prompt: string }) => {
          if (window !== window.parent) return;
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "p-terra",
                    name: "Bottega Terra",
                    tagline: "",
                    prompt,
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f4efe6",
                      surface: "#fffaf3",
                      fg: "#2a241c",
                      muted: "#6f675c",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [{ id: "m1", role: "assistant", content: "JOB_STILL_RUNNING", at: now }],
                    buildLog: [
                      "Motore visivo in sottofondo",
                      "Partito",
                      "Riprendo rifinitura",
                      "Partito",
                      "Riprendo rifinitura",
                      "Motore visivo ancora in corso",
                    ],
                    status: "error",
                    error: "JOB_STILL_RUNNING",
                    creditRefunded: false,
                    visualJobId: "job-terra-live",
                    visualJobStatus: "run",
                    visualJobStartedAt: now - 60_000,
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
                creditsRemaining: 42,
                appDb: {},
              },
              version: 2,
            }),
          );
        },
        { html: DEMOS.kiln.html, prompt: ARGILLA_PROMPT },
      );
      await page.goto(PREVIEW + "/studio/p-terra", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-terra");
            return (
              project?.status === "building" &&
              project?.visualJobId === "job-terra-live" &&
              state.creditsRemaining === 42
            );
          } catch {
            return false;
          }
        },
        null,
        { timeout: 15000 },
      );
      assert.equal(await page.getByText("Bloccato").count(), 0);
      assert.equal(polishPosts, 0, "live job must reattach, not POST again");
      const countPhase = () =>
        page.evaluate(() => {
          const raw = localStorage.getItem("officina-projects");
          const state = JSON.parse(raw || "{}").state;
          const project = state.projects.find((p: { id: string }) => p.id === "p-terra");
          const logs: string[] = project?.buildLog ?? [];
          return {
            jobId: project?.visualJobId ?? null,
            status: project?.status,
            credits: state.creditsRemaining,
            riprendo: logs.filter((s) => s === "Riprendo rifinitura").length,
            partito: logs.filter((s) => s === "Partito").length,
            sottofondo: logs.filter((s) => s === "Motore visivo in sottofondo").length,
            ancora: logs.filter((s) => s === "Motore visivo ancora in corso").length,
          };
        });
      const first = await countPhase();
      assert.equal(first.jobId, jobId);
      assert.equal(first.status, "building");
      assert.equal(first.credits, 42);
      assert.equal(first.riprendo, 1, "historical Riprendo stays once after uniqueLogs");
      assert.equal(first.partito, 1);
      assert.equal(first.sottofondo, 1);
      assert.equal(first.ancora, 1);
      for (let i = 0; i < 2; i++) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => {
            const raw = localStorage.getItem("officina-projects");
            if (!raw) return false;
            try {
              const state = JSON.parse(raw).state;
              const project = state.projects.find((p: { id: string }) => p.id === "p-terra");
              const logs: string[] = project?.buildLog ?? [];
              return (
                project?.status === "building" &&
                project?.visualJobId === "job-terra-live" &&
                state.creditsRemaining === 42 &&
                logs.filter((s) => s === "Riprendo rifinitura").length === 1 &&
                logs.filter((s) => s === "Partito").length === 1
              );
            } catch {
              return false;
            }
          },
          null,
          { timeout: 15000 },
        );
        assert.equal(await page.getByText("Bloccato").count(), 0);
        assert.equal(polishPosts, 0, `reload ${i + 1} must not POST`);
        const snap = await countPhase();
        assert.equal(snap.jobId, jobId);
        assert.equal(snap.status, "building");
        assert.equal(snap.credits, 42);
        assert.equal(snap.riprendo, 1);
        assert.equal(snap.partito, 1);
        assert.equal(snap.sottofondo, 1);
        assert.equal(snap.ancora, 1);
        assert.equal(await page.getByRole("button", { name: /pubblica/i }).isDisabled(), true);
      }
      allowComplete = true;
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-terra");
            return project?.status === "ready" && !project?.visualJobId && state.creditsRemaining === 42;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 20000 },
      );
      assert.equal(polishPosts, 0);
      const publish = page.getByRole("button", { name: /Pubblica/ }).first();
      await publish.waitFor({ timeout: 8000 });
      assert.equal(await publish.isDisabled(), false);
    } finally {
      await browser.close();
    }
  });

  it("missing worker job clears once and refunds once", async () => {
    await requirePreview();
    const jobId = "job-gone";
    let polishPosts = 0;
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        const result = {
          name: "Bottega Terra",
          tagline: "Ceramica",
          kind: "dashboard",
          summary: "Gestionale",
          direction: "terra",
          palette: {
            bg: "#f4efe6",
            surface: "#fffaf3",
            fg: "#2a241c",
            muted: "#6f675c",
            accent: "#b85c38",
          },
          html: DEMOS.kiln.html,
          files: [],
        };
        const body =
          `data: ${JSON.stringify({ t: "s", s: "Adatto Fenix" })}\n\n` +
          `data: ${JSON.stringify({ t: "ok", result })}\n\n`;
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream; charset=utf-8",
          body,
        });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        await route.fulfill({ status: 404, body: "gone" });
      });
      await page.addInitScript(() => {
        if (window !== window.parent) return;
        const now = Date.now();
        localStorage.setItem(
          "officina-projects",
          JSON.stringify({
            state: {
              projects: [
                {
                  id: "p-gone",
                  name: "Bottega Terra",
                  tagline: "",
                  prompt:
                    "FORMATO: gestionale ufficio. kind=dashboard. Bottega Terra",
                  kind: "dashboard",
                  requestedKind: "dashboard",
                  summary: "",
                  palette: {
                    bg: "#f4efe6",
                    surface: "#fffaf3",
                    fg: "#2a241c",
                    muted: "#6f675c",
                    accent: "#b85c38",
                  },
                  html: "",
                  messages: [],
                  buildLog: [],
                  status: "error",
                  error: "Interrotto. Riprova.",
                  creditRefunded: true,
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
      });
      await page.goto(PREVIEW + "/studio/p-gone", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprova. Lo ricostruisco." }).first().click();
      await page.getByText("Bloccato").first().waitFor({ timeout: 40000 });
      const snap = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const state = JSON.parse(raw || "{}").state;
        const project = state.projects.find((p: { id: string }) => p.id === "p-gone");
        return {
          jobId: project?.visualJobId ?? null,
          status: project?.status,
          credits: state.creditsRemaining,
          refunded: project?.creditRefunded,
        };
      });
      assert.equal(snap.status, "error");
      assert.equal(snap.jobId, null);
      assert.equal(snap.credits, 46);
      assert.equal(polishPosts, 1);
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("duplicate live logs + 404 job clears in a few seconds, unique state, no POST", async () => {
    await requirePreview();
    const projectId = "8b04fd98-106c-46f5-ac9a-1e929028c476";
    const jobId = "job-bottega-gone";
    let polishPosts = 0;
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Job non trovato" }),
        });
      });
      await page.addInitScript(
        ({ html, prompt }: { html: string; prompt: string }) => {
          if (window !== window.parent) return;
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "8b04fd98-106c-46f5-ac9a-1e929028c476",
                    name: "Bottega del Tornio",
                    tagline: "",
                    prompt,
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f4efe6",
                      surface: "#fffaf3",
                      fg: "#2a241c",
                      muted: "#6f675c",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [],
                    buildLog: [
                      "Motore visivo in sottofondo",
                      "Partito",
                      "Riprendo rifinitura",
                      "Partito",
                      "Riprendo rifinitura",
                      "Motore visivo ancora in corso",
                    ],
                    status: "building",
                    creditRefunded: true,
                    visualJobId: "job-bottega-gone",
                    visualJobStatus: "run",
                    visualJobStartedAt: now - 60_000,
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
        },
        {
          html: DEMOS.kiln.html,
          prompt:
            "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri.\n\nBottega del Tornio.",
        },
      );
      await page.goto(PREVIEW + `/studio/${projectId}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find(
              (p: { id: string }) => p.id === "8b04fd98-106c-46f5-ac9a-1e929028c476",
            );
            const logs: string[] = project?.buildLog ?? [];
            return (
              project?.status === "error" &&
              !project?.visualJobId &&
              state.creditsRemaining === 46 &&
              !logs.includes("Partito") &&
              !logs.includes("Riprendo rifinitura") &&
              !logs.includes("Motore visivo ancora in corso")
            );
          } catch {
            return false;
          }
        },
        null,
        { timeout: 8000 },
      );
      assert.equal(polishPosts, 0, "404 reattach must not POST");
      await page.getByText("Bloccato").first().waitFor({ timeout: 8000 });
      assert.equal(await page.getByText("Motore visivo ancora in corso").count(), 0);
      const snap = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const state = JSON.parse(raw || "{}").state;
        const project = state.projects.find(
          (p: { id: string }) => p.id === "8b04fd98-106c-46f5-ac9a-1e929028c476",
        );
        const logs: string[] = project?.buildLog ?? [];
        return {
          jobId: project?.visualJobId ?? null,
          status: project?.status,
          credits: state.creditsRemaining,
          refunded: project?.creditRefunded,
          partito: logs.filter((s) => s === "Partito").length,
          riprendo: logs.filter((s) => s === "Riprendo rifinitura").length,
          ancora: logs.filter((s) => s === "Motore visivo ancora in corso").length,
        };
      });
      assert.equal(snap.jobId, null);
      assert.equal(snap.status, "error");
      assert.equal(snap.credits, 46);
      assert.equal(snap.refunded, true);
      assert.equal(snap.partito, 0);
      assert.equal(snap.riprendo, 0);
      assert.equal(snap.ancora, 0);
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("duplicate live logs + first fetch ok promotes ready, unique logs, no POST", async () => {
    await requirePreview();
    const projectId = "p-bottega-done";
    const jobId = "job-bottega-done";
    let polishPosts = 0;
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: jobId,
            status: "ok",
            html: DEMOS.kiln.html,
            meta: { kind: "dashboard", name: "Bottega del Tornio" },
            log: ["Rifinitura"],
            files: [],
          }),
        });
      });
      await page.addInitScript(
        ({ html, prompt }: { html: string; prompt: string }) => {
          if (window !== window.parent) return;
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "p-bottega-done",
                    name: "Bottega del Tornio",
                    tagline: "",
                    prompt,
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f4efe6",
                      surface: "#fffaf3",
                      fg: "#2a241c",
                      muted: "#6f675c",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [],
                    buildLog: [
                      "Motore visivo in sottofondo",
                      "Partito",
                      "Riprendo rifinitura",
                      "Partito",
                      "Riprendo rifinitura",
                    ],
                    status: "building",
                    creditRefunded: false,
                    visualJobId: "job-bottega-done",
                    visualJobStatus: "run",
                    visualJobStartedAt: now - 30_000,
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
        },
        {
          html: DEMOS.kiln.html,
          prompt:
            "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri.\n\nBottega del Tornio.",
        },
      );
      await page.goto(PREVIEW + `/studio/${projectId}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-bottega-done");
            const logs: string[] = project?.buildLog ?? [];
            return (
              project?.status === "ready" &&
              !project?.visualJobId &&
              state.creditsRemaining === 46 &&
              logs.filter((s) => s === "Partito").length === 0 &&
              logs.filter((s) => s === "Riprendo rifinitura").length === 0 &&
              logs.includes("Anteprima rifinita")
            );
          } catch {
            return false;
          }
        },
        null,
        { timeout: 15000 },
      );
      assert.equal(polishPosts, 0);
      const snap = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const state = JSON.parse(raw || "{}").state;
        const project = state.projects.find((p: { id: string }) => p.id === "p-bottega-done");
        const logs: string[] = project?.buildLog ?? [];
        return {
          status: project?.status,
          jobId: project?.visualJobId ?? null,
          credits: state.creditsRemaining,
          partito: logs.filter((s) => s === "Partito").length,
          riprendo: logs.filter((s) => s === "Riprendo rifinitura").length,
          refined: logs.filter((s) => s === "Anteprima rifinita").length,
        };
      });
      assert.equal(snap.status, "ready");
      assert.equal(snap.jobId, null);
      assert.equal(snap.credits, 46);
      assert.equal(snap.partito, 0);
      assert.equal(snap.riprendo, 0);
      assert.equal(snap.refined, 1);
      const publish = page.getByRole("button", { name: /Pubblica/ }).first();
      await publish.waitFor({ timeout: 8000 });
      assert.equal(await publish.isDisabled(), false);
    } finally {
      await browser.close();
    }
  });

  it("null innerHTML polish result never becomes ready or Pronto, Pubblica closed", async () => {
    await requirePreview();
    const projectId = "p-innerhtml-crash";
    const jobId = "job-innerhtml-crash";
    let polishPosts = 0;
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: jobId,
            status: "ok",
            html: NULL_INNER,
            meta: { kind: "dashboard", name: "Bottega Terra" },
            log: ["Rifinitura"],
            files: [{ path: "src/screens/Home.tsx", content: "export default function Home(){return null}" }],
          }),
        });
      });
      await page.addInitScript(
        ({ html, prompt }: { html: string; prompt: string }) => {
          if (window !== window.parent) return;
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "p-innerhtml-crash",
                    name: "Bottega Terra",
                    tagline: "",
                    prompt,
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f4efe6",
                      surface: "#fffaf3",
                      fg: "#2a241c",
                      muted: "#6f675c",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [],
                    buildLog: ["Motore visivo in sottofondo", "Partito"],
                    status: "building",
                    creditRefunded: true,
                    visualJobId: "job-innerhtml-crash",
                    visualJobStatus: "run",
                    visualJobStartedAt: now - 20_000,
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
        },
        {
          html: NULL_INNER,
          prompt: "FORMATO: gestionale ufficio. kind=dashboard. Bottega Terra.",
        },
      );
      await page.goto(PREVIEW + `/studio/${projectId}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-innerhtml-crash");
            return (
              project?.status === "error" &&
              !project?.visualJobId &&
              /innerHTML/i.test(project?.error || "") &&
              state.creditsRemaining === 46
            );
          } catch {
            return false;
          }
        },
        null,
        { timeout: 20000 },
      );
      assert.equal(polishPosts, 0);
      assert.equal(await page.getByText(/Pronto\. Bottega Terra è in anteprima/i).count(), 0);
      await page.getByText("Bloccato").first().waitFor({ timeout: 8000 });
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("repaired innerHTML polish result is ready only after a clean canary", async () => {
    await requirePreview();
    const projectId = "p-innerhtml-fixed";
    const jobId = "job-innerhtml-fixed";
    let polishPosts = 0;
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({ status: 204, body: "" });
      });
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: jobId, status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: jobId,
            status: "ok",
            html: NULL_FIXED,
            meta: { kind: "dashboard", name: "Bottega Terra" },
            log: ["Rifinitura"],
            files: [],
          }),
        });
      });
      await page.addInitScript(
        ({ html, prompt }: { html: string; prompt: string }) => {
          if (window !== window.parent) return;
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "p-innerhtml-fixed",
                    name: "Bottega Terra",
                    tagline: "",
                    prompt,
                    kind: "dashboard",
                    requestedKind: "dashboard",
                    summary: "",
                    palette: {
                      bg: "#f4efe6",
                      surface: "#fffaf3",
                      fg: "#2a241c",
                      muted: "#6f675c",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [],
                    buildLog: ["Motore visivo in sottofondo"],
                    status: "building",
                    creditRefunded: true,
                    visualJobId: "job-innerhtml-fixed",
                    visualJobStatus: "run",
                    visualJobStartedAt: now - 20_000,
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
        },
        {
          html: NULL_FIXED,
          prompt: "FORMATO: gestionale ufficio. kind=dashboard. Bottega Terra.",
        },
      );
      await page.goto(PREVIEW + `/studio/${projectId}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-innerhtml-fixed");
            const msgs = (project?.messages ?? []) as { content?: string }[];
            const pronto = msgs.some((m) => /Pronto\. Bottega Terra è in anteprima/i.test(m.content || ""));
            return project?.status === "ready" && !project?.visualJobId && pronto && state.creditsRemaining === 46;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 20000 },
      );
      assert.equal(polishPosts, 0);
      const publish = page.getByRole("button", { name: /Pubblica/ }).first();
      await publish.waitFor({ timeout: 8000 });
      assert.equal(await publish.isDisabled(), false);
    } finally {
      await browser.close();
    }
  });
});
