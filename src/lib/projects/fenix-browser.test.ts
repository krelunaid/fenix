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
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const project = JSON.parse(raw).state.projects.find((p: { id: string }) => p.id === "p-argilla");
            return project?.visualJobId === "job-argilla-reattach" && project?.status === "building";
          } catch {
            return false;
          }
        },
        null,
        { timeout: 15000 },
      );
      assert.equal(polishPosts, 1, "first resume must POST once");
      await page.reload({ waitUntil: "domcontentloaded" });
      await new Promise((r) => setTimeout(r, 2500));
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
});
