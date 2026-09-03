import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { holdVisualWork, isolatedPage, isBlockedPublicNetworkError, launchChromium } from "./playwright-harness.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";
import { requirePreview } from "./ensure-preview.ts";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
const NULL_INNER = readFileSync(join(here, "fixtures/null-innerhtml.html"), "utf8");
const ADAPTED = ensureFenixAdapter(SITE);
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase1-scorecard";

function seed(page: Page, project: Record<string, unknown>) {
  return page.addInitScript((p) => {
    if (window !== window.parent) return;
    localStorage.setItem(
      "officina-projects",
      JSON.stringify({
        state: {
          projects: [p],
          creditsRemaining: 100,
          appDb: {},
        },
        version: 3,
      }),
    );
  }, project);
}

async function shot(page: Page, name: string) {
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* CI without the scorecard dir is fine */
  }
}

describe("studio kit overlay and Pubblica gate", () => {
  it("building overlay exposes mute, then Pubblica stays closed", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await holdVisualWork(page, "job-kit");
      const now = Date.now();
      await seed(page, {
        id: "p-kit-build",
        name: "Bottega Terra",
        tagline: "Ceramica",
        prompt: "sito ceramica kind=site",
        kind: "site",
        requestedKind: "site",
        summary: "",
        palette: { bg: "#1a1612", surface: "#2a241c", fg: "#e6dcc8", muted: "#b9ad96", accent: "#c45c26" },
        html: ADAPTED,
        messages: [],
        buildLog: ["Partito", "Scrivo le schermate"],
        status: "building",
        visualJobId: "job-kit",
        visualJobStatus: "run",
        visualJobStartedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-kit-build`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const mute = page.getByRole("button", { name: /silenzia kit/i }).first();
      await mute.waitFor({ timeout: 8000 });
      assert.equal(await mute.getAttribute("aria-label"), "Silenzia kit");
      await page.getByText("Palette del progetto").waitFor({ timeout: 4000 });
      const progress = page.getByRole("progressbar", { name: /Avanzamento Fenix/i }).first();
      await progress.waitFor({ timeout: 4000 });
      const firstProgress = await progress.getAttribute("aria-valuetext");
      assert.match(String(firstProgress), /Codice, tempo trascorso 00:0\d/);
      await page.waitForTimeout(1100);
      const nextProgress = await progress.getAttribute("aria-valuetext");
      assert.notEqual(nextProgress, firstProgress, "elapsed time must prove the worker is still monitored");
      assert.match(await progress.innerText(), /^\s*$/, "progress segments must not expose code or fake percent text");
      await shot(page, "studio-kit-building.png");
      await mute.click();
      await page.getByRole("button", { name: /riattiva audio kit/i }).first().waitFor({ timeout: 4000 });
      await shot(page, "studio-kit-muted.png");
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).first().isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("boot-error / Bloccato keeps Pubblica closed", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      const now = Date.now();
      await seed(page, {
        id: "p-kit-error",
        name: "Bottega Terra",
        tagline: "",
        prompt: "kind=dashboard",
        kind: "dashboard",
        requestedKind: "dashboard",
        summary: "",
        palette: { bg: "#f4efe6", surface: "#fff", fg: "#2a241c", muted: "#6e5648", accent: "#b85c38" },
        html: NULL_INNER,
        error: "Cannot set properties of null (setting 'innerHTML')",
        messages: [],
        buildLog: ["Bloccato"],
        status: "error",
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-kit-error`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByText("Bloccato").first().waitFor({ timeout: 8000 });
      await shot(page, "studio-kit-blocked.png");
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).first().isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("ready valid site opens Pubblica; desktop/tablet/mobile chrome", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      const now = Date.now();
      await seed(page, {
        id: "p-kit-ready",
        name: "Onda",
        tagline: "Carica musica",
        prompt: "mi crei un sito di caricamento musicale. kind=site",
        kind: "site",
        requestedKind: "site",
        summary: "Carica brani",
        palette: { bg: "#120c1c", surface: "#1c1528", fg: "#f4efe8", muted: "#9b93c2", accent: "#e85d4c" },
        html: ADAPTED,
        messages: [{ id: "m1", role: "assistant", content: "Pronto. Onda è in anteprima.", at: now }],
        buildLog: ["Anteprima rifinita"],
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-kit-ready`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const publish = page.getByRole("button", { name: /pubblica/i }).first();
      await publish.waitFor({ timeout: 8000 });
      assert.equal(await publish.isDisabled(), false);
      await shot(page, "studio-kit-ready-publish.png");
      for (const [label, file] of [
        ["desktop", "studio-ready-desktop.png"],
        ["tablet", "studio-ready-tablet.png"],
        ["mobile", "studio-ready-mobile.png"],
      ] as const) {
        await page.getByRole("button", { name: label }).click();
        await page.waitForTimeout(250);
        await shot(page, file);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      await shot(page, "studio-ready-phone-viewport.png");
    } finally {
      await browser.close();
    }
  });
});

describe("total UX lock during create/refine", () => {
  it("blocks chrome, iframe, synthetic clicks and covers D/T/M with zero console noise", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await holdVisualWork(page, "job-lock");
      const now = Date.now();
      await seed(page, {
        id: "p-lock",
        name: "Bottega Terra",
        tagline: "Ceramica",
        prompt: "sito ceramica kind=site",
        kind: "site",
        requestedKind: "site",
        summary: "",
        palette: { bg: "#1a1612", surface: "#2a241c", fg: "#e6dcc8", muted: "#b9ad96", accent: "#c45c26" },
        html: ADAPTED,
        lastStableHtml: ADAPTED,
        messages: [],
        buildLog: ["Partito", "Scrivo le schermate"],
        status: "building",
        visualJobId: "job-lock",
        visualJobStatus: "run",
        visualJobStartedAt: now,
        buildEpoch: 1,
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-lock`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.locator('[data-fenix-lock="1"]').first().waitFor({ timeout: 8000 });
      await page.getByText("Fenix sta creando").first().waitFor({ timeout: 4000 });
      const lockText = await page.locator('[data-fenix-lock="1"]').first().innerText();
      assert.doesNotMatch(lockText, /<!DOCTYPE|function\s*\(|<<<HTML>>>/);
      assert.equal(await page.getAttribute("[data-studio-lock]", "aria-busy"), "true");
      const iframe = page.locator("iframe[data-preview]").first();
      assert.equal(await iframe.evaluate((el) => (el as HTMLIFrameElement).inert), true);
      const pointer = await iframe.evaluate((el) => getComputedStyle(el).pointerEvents);
      assert.equal(pointer, "none");
      await iframe.evaluate((el) => (el as HTMLElement).focus());
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      assert.notEqual(focused, "IFRAME");

      for (const name of [/codice/i, /versioni/i, /condividi/i, /esporta/i, /pubblica/i, /^desktop$/i]) {
        const control = page.getByRole("button", { name }).first();
        assert.equal(await control.isDisabled(), true, String(name));
        await control.evaluate((el) => {
          el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
        });
      }
      assert.equal(await page.getByRole("tree", { name: /albero file/i }).count(), 0);
      assert.ok(await page.locator('[data-fenix-lock="1"]').first().isVisible());
      assert.ok((await page.locator('[data-fenix-lock="1"]').count()) >= 1);

      const composer = page.getByPlaceholder(/una modifica/i);
      assert.equal(await composer.isDisabled(), true);
      await composer.evaluate((el) => {
        (el as HTMLTextAreaElement).value = "cambia il colore";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      });

      await shot(page, "studio-lock-D.png");
      for (const [width, height, file] of [
        [768, 1024, "studio-lock-T.png"],
        [390, 844, "studio-lock-M.png"],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.getByRole("dialog", { name: "Fenix sta creando" }).first().waitFor({ timeout: 4000 });
        await page.waitForTimeout(150);
        await shot(page, file);
      }
      await page.getByRole("button", { name: "Codice" }).evaluate((el) => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      assert.equal(await page.getByRole("tree", { name: /albero file/i }).count(), 0);
      assert.ok(await page.getByRole("dialog", { name: "Fenix sta creando" }).first().isVisible());

      const noise = errors.filter((text) => !isBlockedPublicNetworkError(text));
      assert.equal(noise.join("\n"), "");
    } finally {
      await browser.close();
    }
  });

  it("restores lastStableHtml on error, keeps Pubblica closed, and shows Riprendi", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      const now = Date.now();
      await seed(page, {
        id: "p-lock-err",
        name: "Bottega Terra",
        tagline: "",
        prompt: "kind=dashboard",
        kind: "dashboard",
        requestedKind: "dashboard",
        summary: "",
        palette: { bg: "#f4efe6", surface: "#fff", fg: "#2a241c", muted: "#6e5648", accent: "#b85c38" },
        html: NULL_INNER,
        lastStableHtml: ADAPTED,
        error: "Rifinitura interrotta. Tocca Riprendi rifinitura.",
        messages: [],
        buildLog: ["Bloccato"],
        status: "error",
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-lock-err`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByRole("button", { name: "Riprendi rifinitura" }).first().waitFor({ timeout: 8000 });
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).first().isDisabled(), true);
      const src = await page.locator("iframe[data-preview]").first().getAttribute("srcdoc");
      assert.match(String(src), /Onda|Carica e ascolta i tuoi brani/i);
      assert.doesNotMatch(String(src), /Ceramica a Grottaglie|data-view="elenco"/);
    } finally {
      await browser.close();
    }
  });

  it("reload of a live job keeps the lock and does not POST polish", async () => {
    await requirePreview();
    const browser = await launchChromium();
    let polishPosts = 0;
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          polishPosts += 1;
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: "job-reattach-lock", status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "job-reattach-lock", status: "run", html: null, log: ["In coda"] }),
        });
      });
      const now = Date.now();
      await seed(page, {
        id: "p-lock-re",
        name: "Argilla Viva",
        tagline: "",
        prompt: "FORMATO: gestionale ufficio. kind=dashboard.",
        kind: "dashboard",
        requestedKind: "dashboard",
        summary: "",
        palette: { bg: "#f4efe6", surface: "#fff", fg: "#2a241c", muted: "#6e5648", accent: "#b85c38" },
        html: ADAPTED,
        lastStableHtml: ADAPTED,
        messages: [],
        buildLog: ["Partito"],
        status: "building",
        visualJobId: "job-reattach-lock",
        visualJobStatus: "run",
        visualJobStartedAt: now,
        buildEpoch: 2,
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-lock-re`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.locator('[data-fenix-lock="1"]').first().waitFor({ timeout: 8000 });
      await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
      await page.locator('[data-fenix-lock="1"]').first().waitFor({ timeout: 8000 });
      await page.waitForTimeout(800);
      assert.equal(polishPosts, 0, "reattach must not POST");
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).first().isDisabled(), true);
    } finally {
      await browser.close();
    }
  });

  it("stale job cannot swap html, unlock, or refund", async () => {
    await requirePreview();
    const browser = await launchChromium();
    let polls = 0;
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      await page.route(/polish/, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({ id: "job-stale-lock", status: "run" }),
          });
          return;
        }
        await route.continue();
      });
      await page.route(/\/jobs\//, async (route) => {
        polls += 1;
        if (polls >= 2) {
          await page.evaluate(() => {
            const raw = localStorage.getItem("officina-projects");
            const parsed = JSON.parse(raw || "{}") as {
              state?: { projects?: Array<Record<string, unknown>>; creditsRemaining?: number };
            };
            const project = parsed.state?.projects?.[0];
            if (project) {
              project.buildEpoch = 9;
              project.visualJobId = "job-newer";
            }
            localStorage.setItem("officina-projects", JSON.stringify(parsed));
          });
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "job-stale-lock",
            status: polls >= 2 ? "ok" : "run",
            html: polls >= 2 ? "<!DOCTYPE html><html><body>STALE-WIN</body></html>" : null,
            meta: { kind: "site", name: "Stale" },
            log: ["Rifinitura scartata"],
          }),
        });
      });
      const now = Date.now();
      await seed(page, {
        id: "p-lock-stale",
        name: "Argilla Viva",
        tagline: "",
        prompt: "sito ceramica kind=site",
        kind: "site",
        requestedKind: "site",
        summary: "",
        palette: { bg: "#1a1612", surface: "#2a241c", fg: "#e6dcc8", muted: "#b9ad96", accent: "#c45c26" },
        html: ADAPTED,
        lastStableHtml: ADAPTED,
        messages: [],
        buildLog: ["Partito"],
        status: "building",
        visualJobId: "job-stale-lock",
        visualJobStatus: "run",
        visualJobStartedAt: now,
        buildEpoch: 2,
        creditRefunded: false,
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-lock-stale`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.locator('[data-fenix-lock="1"]').first().waitFor({ timeout: 8000 });
      await page.waitForTimeout(4500);
      const snap = await page.evaluate(() => {
        const raw = localStorage.getItem("officina-projects");
        const state = JSON.parse(raw || "{}").state as {
          creditsRemaining?: number;
          projects?: Array<{ html?: string; status?: string; creditRefunded?: boolean }>;
        };
        const project = state.projects?.[0];
        return {
          html: String(project?.html || ""),
          status: project?.status,
          credits: state.creditsRemaining,
          refunded: project?.creditRefunded,
        };
      });
      assert.doesNotMatch(snap.html, /STALE-WIN/);
      assert.match(snap.html, /Onda|Carica e ascolta/i);
      assert.notEqual(snap.status, "ready");
      assert.equal(snap.refunded, false);
      assert.equal(await page.getByRole("button", { name: /pubblica/i }).first().isDisabled(), true);
      assert.ok(await page.locator('[data-fenix-lock="1"]').first().isVisible());
    } finally {
      await browser.close();
    }
  });

  it("Tab stays in the lock or on Back, never the iframe", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const page = await isolatedPage(browser, { viewport: { width: 1280, height: 800 } });
      await holdVisualWork(page, "job-tab");
      const now = Date.now();
      await seed(page, {
        id: "p-lock-tab",
        name: "Bottega Terra",
        tagline: "Ceramica",
        prompt: "sito ceramica kind=site",
        kind: "site",
        requestedKind: "site",
        summary: "",
        palette: { bg: "#1a1612", surface: "#2a241c", fg: "#e6dcc8", muted: "#b9ad96", accent: "#c45c26" },
        html: ADAPTED,
        lastStableHtml: ADAPTED,
        messages: [],
        buildLog: ["Partito", "Scrivo le schermate"],
        status: "building",
        visualJobId: "job-tab",
        visualJobStatus: "run",
        visualJobStartedAt: now,
        buildEpoch: 1,
        createdAt: now,
        updatedAt: now,
      });
      await page.goto(`${PREVIEW}/studio/p-lock-tab`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.locator('[data-fenix-lock="1"]').first().waitFor({ timeout: 8000 });
      const live = await page.locator("[data-fenix-lock-live]").first().innerText();
      assert.match(live, /Fenix sta creando/);
      assert.doesNotMatch(live, /\d{2}:\d{2}|%/);
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press("Tab");
        const tag = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return {
            tag: el?.tagName || "",
            iframe: el?.tagName === "IFRAME",
            lock: Boolean(el?.closest("[data-fenix-lock]")),
            back: el?.getAttribute("aria-label") === "Torna agli studi",
          };
        });
        assert.equal(tag.iframe, false);
        assert.ok(tag.lock || tag.back, `focus escaped lock: ${tag.tag}`);
      }
      await page.keyboard.press("Shift+Tab");
      const after = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.tagName === "IFRAME";
      });
      assert.equal(after, false);
    } finally {
      await browser.close();
    }
  });
});
