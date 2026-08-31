import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { requirePreview } from "./ensure-preview.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
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
});
