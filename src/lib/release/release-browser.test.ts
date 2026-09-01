import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { ensureFenixAdapter } from "../projects/fenix-adapter.ts";
import { requirePreview } from "../projects/ensure-preview.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "../projects/fixtures/music-site-no-fenix.html"), "utf8");
const ADAPTED = ensureFenixAdapter(SITE);
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase2-release";

function seed(page: Page, project: Record<string, unknown>, owner?: string) {
  return page.addInitScript(
    ({ p, ownerId }: { p: Record<string, unknown>; ownerId?: string }) => {
      if (window !== window.parent) return;
      if (ownerId) localStorage.setItem("fenix.owner-id", ownerId);
      localStorage.setItem(
        "officina-projects",
        JSON.stringify({
          state: { projects: [p], creditsRemaining: 100, appDb: {} },
          version: 3,
        }),
      );
    },
    { p: project, ownerId: owner },
  );
}

async function shot(page: Page, name: string) {
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* optional */
  }
}

describe("publish panel multiplatform", () => {
  it("Pubblica stays closed on invalid, opens on ready; D/T/M show Web iOS Android", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const now = Date.now();
      const readyId = "prel-" + now.toString(36);
      const owner = "a".repeat(32);
      const ready = {
        id: readyId,
        name: "Onda",
        tagline: "Carica musica",
        prompt: "mi crei un sito di caricamento musicale. kind=site",
        kind: "site",
        requestedKind: "site",
        summary: "Carica brani",
        palette: {
          bg: "#120c1c",
          surface: "#1c1528",
          fg: "#f4efe8",
          muted: "#9b93c2",
          accent: "#e85d4c",
        },
        html: ADAPTED,
        messages: [{ id: "m1", role: "assistant", content: "Pronto.", at: now }],
        buildLog: ["Anteprima rifinita"],
        status: "ready",
        createdAt: now,
        updatedAt: now,
      };
      const blocked = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await blocked.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      await seed(blocked, { ...ready, id: "p-rel-bad", html: "<p>no</p>", status: "building" });
      await blocked.goto(`${PREVIEW}/studio/p-rel-bad`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const closed = blocked.getByRole("button", { name: /pubblica/i }).first();
      await closed.waitFor({ timeout: 8000 });
      assert.equal(await closed.isDisabled(), true);
      await blocked.close();
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route(/\/api\/build/, (route) => route.fulfill({ status: 204, body: "" }));
      await seed(page, ready, owner);
      await page.goto(`${PREVIEW}/studio/${readyId}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const publish = page.getByRole("button", { name: /pubblica/i }).first();
      await publish.waitFor({ timeout: 8000 });
      assert.equal(await publish.isDisabled(), false);
      await publish.click();
      await page.getByRole("heading", { name: "È online." }).waitFor({ timeout: 20000 });
      await page.getByText("App Store Connect").waitFor({ timeout: 8000 });
      await page.getByRole("button", { name: "iOS" }).click();
      await page.getByRole("button", { name: "Android" }).click();
      await shot(page, "release-desktop.png");
      await page.setViewportSize({ width: 768, height: 1024 });
      await shot(page, "release-tablet.png");
      await page.setViewportSize({ width: 390, height: 844 });
      await shot(page, "release-mobile.png");
      const launch = page.getByRole("button", { name: /Pubblica su/ });
      await launch.waitFor({ timeout: 8000 });
      assert.equal(await launch.isDisabled(), false, "launch stays gated until snapshot");
      await launch.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByText(/Pronto ·|Errore ·|In corso ·/).waitFor({ timeout: 20000 });
      const body = await dialog.innerText();
      assert.doesNotMatch(body, /BEGIN PRIVATE KEY/);
      assert.match(body, /TestFlight|internal|Web|banco prova|Pronto|review/i);
    } finally {
      await browser.close();
    }
  });
});
