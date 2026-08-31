import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { requirePreview } from "./ensure-preview.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";
import { DEFAULT_PALETTE } from "./types.ts";
import { prepareSrcDoc } from "./color-scheme.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
const BOTTEGA = readFileSync(join(here, "fixtures/bottega-orders-crash.html"), "utf8");
const NULL_INNER = readFileSync(join(here, "fixtures/null-innerhtml.html"), "utf8");
const NULL_FIXED = readFileSync(join(here, "fixtures/null-innerhtml-fixed.html"), "utf8");
const BROKEN_HERO = readFileSync(join(here, "fixtures/broken-hero-site.html"), "utf8");
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const ADAPTED = ensureFenixAdapter(SITE);

describe("studio repair for a new site project", () => {
  it("adapter preview is not empty, has 3+ views, Pubblica after valid gate", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.addInitScript(
        ({ html, pid }) => {
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: pid,
                    name: "Nuovo studio",
                    tagline: "",
                    prompt: "mi crei un sito di caricamento musicale. kind=site",
                    kind: "site",
                    requestedKind: "site",
                    summary: "",
                    palette: {
                      bg: "#120c1c",
                      surface: "#1c1528",
                      fg: "#f4efe8",
                      muted: "#9b93c2",
                      accent: "#e85d4c",
                    },
                    html,
                    messages: [],
                    buildLog: ["Adatto Fenix", "Apro l'anteprima"],
                    status: "ready",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  },
                ],
                creditsRemaining: 46,
              },
              version: 2,
            }),
          );
        },
        { html: ADAPTED, pid: "p-onda" },
      );
      await page.goto(`${PREVIEW}/studio/p-onda`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const frame = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame.getByRole("heading", { name: "Onda" }).waitFor({ timeout: 15000 });
      assert.ok((await frame.locator("[data-view]").count()) >= 3);
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).isDisabled(), false);
      assert.equal(
        await page.getByText("L'anteprima apparirà qui").count(),
        0,
      );
      assert.equal(errors.length, 0, errors.join(" · "));
    } finally {
      await browser.close();
    }
  });

  it("empty failed build shows recoverable overlay and retry, not a dead placeholder", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(() => {
        localStorage.setItem(
          "officina-projects",
          JSON.stringify({
            state: {
              projects: [
                {
                  id: "p-dead",
                  name: "Nuovo studio",
                  tagline: "",
                  prompt: "mi crei un sito di caricamento musicale. kind=site",
                  kind: "site",
                  requestedKind: "site",
                  summary: "",
                  palette: {
                    bg: "#120c1c",
                    surface: "#1c1528",
                    fg: "#f4efe8",
                    muted: "#9b93c2",
                    accent: "#e85d4c",
                  },
                  html: "",
                  messages: [
                    {
                      id: "m1",
                      role: "assistant",
                      content: "Il prodotto non è completo: Manca window.Fenix.load/save per i dati.",
                      at: Date.now(),
                    },
                  ],
                  buildLog: ["Compongo colori, icone, interfaccia", "Riparo il codice"],
                  status: "error",
                  error: "Il prodotto non è completo: Manca window.Fenix.load/save per i dati.",
                  creditRefunded: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
              creditsRemaining: 46,
            },
            version: 2,
          }),
        );
      });
      await page.goto(`${PREVIEW}/studio/p-dead`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByText("Bloccato").first().waitFor({ timeout: 12000 });
      await page.getByRole("button", { name: "Riprova. Lo ricostruisco." }).first().waitFor({ timeout: 8000 });
      const pub = page.getByRole("button", { name: /pubblica/i });
      assert.equal(await pub.isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("failed retry refunds once", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: ${JSON.stringify({ t: "err", error: "HTML non valido, non pubblico: HTML assente o troppo corto." })}\n\n`,
        });
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "officina-projects",
          JSON.stringify({
            state: {
              projects: [
                {
                  id: "p-ref",
                  name: "Nuovo studio",
                  tagline: "",
                  prompt: "mi crei un sito di caricamento musicale. kind=site",
                  kind: "site",
                  requestedKind: "site",
                  summary: "",
                  palette: {
                    bg: "#120c1c",
                    surface: "#1c1528",
                    fg: "#f4efe8",
                    muted: "#9b93c2",
                    accent: "#e85d4c",
                  },
                  html: "",
                  messages: [],
                  buildLog: [],
                  status: "error",
                  error: "Il prodotto non è completo: Manca window.Fenix.load/save per i dati.",
                  creditRefunded: false,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
              creditsRemaining: 46,
            },
            version: 2,
          }),
        );
      });
      await page.goto(`${PREVIEW}/studio/p-ref`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprova. Lo ricostruisco." }).first().click();
      await page.waitForTimeout(800);
      const remaining = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const parsed = JSON.parse(raw || "{}");
        return parsed.state?.creditsRemaining;
      });
      assert.equal(remaining, 46);
    } finally {
      await browser.close();
    }
  });

  it("empty/error project walks SSE /api/build through adapter to a ready preview", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const adapted = ensureFenixAdapter(SITE);
      const result = {
        name: "Onda",
        tagline: "Carica musica",
        kind: "site",
        summary: "Sito di caricamento musicale",
        direction: "inchiostro",
        palette: DEFAULT_PALETTE,
        html: adapted,
        files: [],
      };
      await page.route(/\/api\/build/, async (route) => {
        const body =
          `data: ${JSON.stringify({ t: "s", s: "Adatto Fenix" })}\n\n` +
          `data: ${JSON.stringify({ t: "ok", result })}\n\n`;
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream; charset=utf-8",
          body,
        });
      });
      await page.route(/polish|\/__worker/, async (route) => {
        await route.fulfill({ status: 500, body: "no-worker" });
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "officina-projects",
          JSON.stringify({
            state: {
              projects: [
                {
                  id: "p-sse",
                  name: "Nuovo studio",
                  tagline: "",
                  prompt: "mi crei un sito di caricamento musicale. kind=site",
                  kind: "site",
                  requestedKind: "site",
                  summary: "",
                  palette: {
                    bg: "#120c1c",
                    surface: "#1c1528",
                    fg: "#f4efe8",
                    muted: "#9b93c2",
                    accent: "#e85d4c",
                  },
                  html: "",
                  messages: [],
                  buildLog: [],
                  status: "error",
                  error: "Il prodotto non è completo: Manca window.Fenix.load/save per i dati.",
                  creditRefunded: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
              creditsRemaining: 46,
            },
            version: 2,
          }),
        );
      });
      await page.goto(`${PREVIEW}/studio/p-sse`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprova. Lo ricostruisco." }).first().click();
      const frame = page.locator("section.hidden.md\\:block").frameLocator("iframe");
      await frame.getByRole("heading", { name: "Onda" }).waitFor({ timeout: 25000 });
      await page.getByText("Adatto Fenix").first().waitFor({ timeout: 8000 });
      assert.equal(await page.getByText("L'anteprima apparirà qui").count(), 0);
    } finally {
      await browser.close();
    }
  });
});

describe("iframe boot error on site null.orders", () => {
  it("srcdoc reports fenix-boot-error to the parent without SyntaxError", async () => {
    const src = prepareSrcDoc(
      BOTTEGA,
      { bg: "#f3eadc", fg: "#2b211c", accent: "#b85c38" },
      "bottega-tornio",
      "site",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const syntax: string[] = [];
      page.on("pageerror", (err) => {
        if (/SyntaxError|missing \) after argument list/i.test(String(err))) syntax.push(String(err));
      });
      page.on("console", (msg) => {
        if (msg.type() === "error" && /SyntaxError|missing \) after argument list/i.test(msg.text())) {
          syntax.push(msg.text());
        }
      });
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:1280px;height:800px;border:0"></iframe>
<script>
  window.__boot = null;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.t !== "fenix-boot-error") return;
    window.__boot = m;
    document.documentElement.setAttribute("data-fenix-diag", JSON.stringify({ bootError: m.message }));
  });
</script>
</body></html>`);
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      await page.waitForFunction(() => Boolean((window as { __boot?: { message?: string } }).__boot?.message), null, {
        timeout: 8000,
      });
      const boot = await page.evaluate(() => (window as { __boot?: { message?: string } }).__boot);
      assert.match(String(boot?.message), /orders/i);
      const frame = page.frameLocator("#f");
      const attr = await frame.locator("html").getAttribute("data-fenix-boot-error");
      assert.match(String(attr), /orders/i);
      const diag = JSON.parse((await page.locator("html").getAttribute("data-fenix-diag")) || "{}");
      assert.match(String(diag.bootError), /orders/i);
      assert.equal(syntax.join(" | "), "", `srcdoc syntax ${syntax.join(" | ")}`);
    } finally {
      await browser.close();
    }
  });

  it("/api/build HTML that throws on null.orders stays Bloccato, Pubblica closed, credit refunded", async () => {
    await requirePreview();
    const result = {
      name: "Bottega del Tornio",
      tagline: "Legno tornito",
      kind: "site",
      summary: "Vetrina artigiana",
      direction: "legno",
      palette: DEFAULT_PALETTE,
      html: BOTTEGA,
      files: [],
    };
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, async (route) => {
        const body =
          `data: ${JSON.stringify({ t: "s", s: "Adatto Fenix" })}\n\n` +
          `data: ${JSON.stringify({ t: "ok", result })}\n\n`;
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream; charset=utf-8",
          body,
        });
      });
      await page.route(/polish|\/__worker/, async (route) => {
        await route.fulfill({ status: 500, body: "no-worker" });
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "officina-projects",
          JSON.stringify({
            state: {
              projects: [
                {
                  id: "p-orders",
                  name: "Bottega del Tornio",
                  tagline: "",
                  prompt: "FORMATO: sito web. kind=site. Bottega del Tornio, vetrina artigiana a Grottaglie",
                  kind: "site",
                  requestedKind: "site",
                  summary: "",
                  palette: {
                    bg: "#f3eadc",
                    surface: "#fbf6ee",
                    fg: "#2b211c",
                    muted: "#6e5648",
                    accent: "#b85c38",
                  },
                  html: "",
                  messages: [],
                  buildLog: [],
                  status: "error",
                  error: "Interrotto. Riprova.",
                  creditRefunded: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
              creditsRemaining: 46,
            },
            version: 2,
          }),
        );
      });
      await page.goto(`${PREVIEW}/studio/p-orders`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprova. Lo ricostruisco." }).first().click();
      await page.getByText("Bloccato").first().waitFor({ timeout: 25000 });
      const pub = page.getByRole("button", { name: /pubblica/i });
      assert.equal(await pub.isDisabled(), true);
      const overlay = await page.locator("text=/orders|gestionale|avvio/i").first().innerText();
      assert.match(overlay, /orders|gestionale|avvio/i);
      const remaining = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const parsed = JSON.parse(raw || "{}");
        return parsed.state?.creditsRemaining;
      });
      assert.equal(remaining, 46);
      const status = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const parsed = JSON.parse(raw || "{}");
        return parsed.state?.projects?.[0]?.status;
      });
      assert.equal(status, "error");
    } finally {
      await browser.close();
    }
  });

  it("reload of error + stale visualJobId/JOB_STILL_RUNNING drops the job, Pubblica closed, credits unchanged", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      let polishPosts = 0;
      await page.route(/polish|\/__worker/, async (route) => {
        if (route.request().method() === "POST") polishPosts += 1;
        await route.fulfill({ status: 500, body: "no-worker" });
      });
      await page.addInitScript(
        ({ html }: { html: string }) => {
          if (localStorage.getItem("officina-projects")) return;
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: "p-stale-job",
                    name: "Bottega del Tornio",
                    tagline: "",
                    prompt: "FORMATO: sito web. kind=site. Bottega del Tornio, vetrina artigiana a Grottaglie",
                    kind: "site",
                    requestedKind: "site",
                    summary: "",
                    palette: {
                      bg: "#f3eadc",
                      surface: "#fbf6ee",
                      fg: "#2b211c",
                      muted: "#6e5648",
                      accent: "#b85c38",
                    },
                    html,
                    messages: [
                      {
                        id: "m1",
                        role: "assistant",
                        content: "JOB_STILL_RUNNING",
                        at: now,
                      },
                    ],
                    buildLog: ["Motore visivo in sottofondo", "Partito", "Partito"],
                    status: "error",
                    error: "JOB_STILL_RUNNING",
                    creditRefunded: true,
                    visualJobId: "job-ghost",
                    visualJobStatus: "run",
                    visualJobStartedAt: now - 21 * 60 * 1000,
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
                creditsRemaining: 46,
              },
              version: 2,
            }),
          );
        },
        { html: BOTTEGA },
      );
      await page.goto(`${PREVIEW}/studio/p-stale-job`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForFunction(
        () => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return false;
          try {
            const state = JSON.parse(raw).state;
            const project = state.projects.find((p: { id: string }) => p.id === "p-stale-job");
            return (
              project?.status === "error" &&
              !project?.visualJobId &&
              !/JOB_STILL_RUNNING/.test(project?.error || "") &&
              state.creditsRemaining === 46
            );
          } catch {
            return false;
          }
        },
        null,
        { timeout: 20000 },
      );
      await page.getByText("Bloccato").first().waitFor({ timeout: 8000 });
      assert.equal(await page.getByText("JOB_STILL_RUNNING").count(), 0);
      assert.equal(await page.getByText("Motore visivo ancora in corso").count(), 0);
      const overlay = await page.locator("text=/orders|gestionale|avvio|rifinitura/i").first().innerText();
      assert.match(overlay, /orders|gestionale|avvio|rifinitura/i);
      const pub = page.getByRole("button", { name: /pubblica/i });
      assert.equal(await pub.isDisabled(), true);
      const snap = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const state = JSON.parse(raw || "{}").state;
        const project = state.projects.find((p: { id: string }) => p.id === "p-stale-job");
        return {
          jobId: project?.visualJobId ?? null,
          status: project?.status,
          error: project?.error,
          credits: state.creditsRemaining,
          partito: (project?.buildLog ?? []).filter((s: string) => s === "Partito").length,
        };
      });
      assert.equal(snap.jobId, null);
      assert.equal(snap.status, "error");
      assert.doesNotMatch(String(snap.error), /JOB_STILL_RUNNING/);
      assert.equal(snap.credits, 46);
      assert.equal(snap.partito, 0);
      assert.equal(polishPosts, 0, "reload must not POST a new visual job");
    } finally {
      await browser.close();
    }
  });
});

describe("iframe boot error on null innerHTML", () => {
  it("srcdoc reports innerHTML TypeError and never emits a clean boot-ok", async () => {
    const src = prepareSrcDoc(
      NULL_INNER,
      { bg: "#f4efe6", fg: "#2a241c", accent: "#b85c38" },
      "bottega-terra-inner",
      "dashboard",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:1280px;height:800px;border:0"></iframe>
<script>
  window.__boot = null;
  window.__ok = 0;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m) return;
    if (m.t === "fenix-boot-error") window.__boot = m;
    if (m.t === "fenix-boot-ok") window.__ok += 1;
  });
</script>
</body></html>`);
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      await page.waitForFunction(() => Boolean((window as { __boot?: { message?: string } }).__boot?.message), null, {
        timeout: 8000,
      });
      const boot = await page.evaluate(() => (window as { __boot?: { message?: string }; __ok?: number }).__boot);
      const ok = await page.evaluate(() => (window as { __ok?: number }).__ok);
      assert.match(String(boot?.message), /innerHTML/i);
      assert.equal(ok, 0, "boot-ok must not fire after innerHTML TypeError");
      const frame = page.frameLocator("#f");
      const attr = await frame.locator("html").getAttribute("data-fenix-boot-error");
      assert.match(String(attr), /innerHTML/i);
    } finally {
      await browser.close();
    }
  });

  it("broken hero image does not count as a JS boot error", async () => {
    const src = prepareSrcDoc(
      BROKEN_HERO,
      { bg: "#f4efe6", fg: "#2a241c", accent: "#b85c38" },
      "bottega-terra-hero",
      "site",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:1280px;height:800px;border:0"></iframe>
<script>
  window.__boot = null;
  window.__ok = 0;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m) return;
    if (m.t === "fenix-boot-error") window.__boot = m;
    if (m.t === "fenix-boot-ok") window.__ok += 1;
  });
</script>
</body></html>`);
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      await page.waitForFunction(() => (window as { __ok?: number }).__ok === 1, null, { timeout: 8000 });
      const boot = await page.evaluate(() => (window as { __boot?: { message?: string } }).__boot);
      assert.equal(boot, null, "img 404 must not emit fenix-boot-error");
      const frame = page.frameLocator("#f");
      assert.equal(await frame.locator("html").getAttribute("data-fenix-boot-error"), null);
      assert.equal(await frame.locator("html").getAttribute("data-fenix-boot-ok"), "1");
    } finally {
      await browser.close();
    }
  });

  it("repaired innerHTML fixture emits boot-ok without fenix-boot-error", async () => {
    const src = prepareSrcDoc(
      NULL_FIXED,
      { bg: "#f4efe6", fg: "#2a241c", accent: "#b85c38" },
      "bottega-terra-fixed",
      "dashboard",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(`<!DOCTYPE html><html><body>
<iframe id="f" style="width:1280px;height:800px;border:0"></iframe>
<script>
  window.__boot = null;
  window.__ok = 0;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m) return;
    if (m.t === "fenix-boot-error") window.__boot = m;
    if (m.t === "fenix-boot-ok") window.__ok += 1;
  });
</script>
</body></html>`);
      await page.locator("#f").evaluate((el, srcDoc: string) => {
        (el as HTMLIFrameElement).srcdoc = srcDoc;
      }, src);
      await page.waitForFunction(() => (window as { __ok?: number }).__ok === 1, null, { timeout: 8000 });
      const boot = await page.evaluate(() => (window as { __boot?: { message?: string } }).__boot);
      assert.equal(boot, null);
      const frame = page.frameLocator("#f");
      assert.equal(await frame.locator("html").getAttribute("data-fenix-boot-error"), null);
      assert.equal(await frame.locator("html").getAttribute("data-fenix-boot-ok"), "1");
    } finally {
      await browser.close();
    }
  });
});
