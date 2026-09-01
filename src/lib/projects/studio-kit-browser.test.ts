import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
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
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/(api\/build|api\/polish|api\/jobs\/|__worker\/)/, async () => {
        await new Promise(() => {
          /* hang so the compact overlay stays without extra credits */
        });
      });
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
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
