import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { requirePreview } from "./ensure-preview.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
const ADAPTED = ensureFenixAdapter(SITE);
const PALETTE = {
  bg: "#120c1c",
  surface: "#1c1528",
  fg: "#f4efe8",
  muted: "#9b93c2",
  accent: "#e85d4c",
  line: "#3a3048",
};

describe("published site is server-side, not localStorage", () => {
  it("sito route does not read the local project store", () => {
    const src = readFileSync(join(root, "src/routes/sito.$projectId.tsx"), "utf8");
    assert.doesNotMatch(src, /useProjectStore/);
    assert.doesNotMatch(src, /officina-projects/);
    assert.match(src, /loadPublished/);
    const client = readFileSync(join(root, "src/lib/projects/publish-client.ts"), "utf8");
    assert.match(client, /\/api\/sites\//);
    const api = readFileSync(join(root, "src/routes/api/sites.$id.ts"), "utf8");
    assert.match(api, /writePublished/);
    assert.match(api, /readPublished/);
    const panel = readFileSync(join(root, "src/components/publish-panel.tsx"), "utf8");
    assert.match(panel, /publishSnapshot/);
  });

  it("PUT snapshot then a clean browser without localStorage sees the published heading", async () => {
    const PREVIEW = await requirePreview();
    const id = "onda-pub-" + Date.now().toString(36);
    const put = await fetch(`${PREVIEW}/api/sites/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Onda",
        kind: "site",
        palette: PALETTE,
        html: ADAPTED,
      }),
    });
    const raw = await put.text();
    assert.equal(put.ok, true, raw);
    const snap = JSON.parse(raw) as { version?: number; hash?: string };
    assert.equal(snap.version, 1);

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
                  id: "onda-wrong",
                  name: "Sbagliato",
                  html: "<html><body><h1>Dashboard stantia</h1><nav>Home Nuova Elenco</nav></body></html>",
                  kind: "dashboard",
                  status: "ready",
                },
              ],
              creditsRemaining: 46,
            },
            version: 2,
          }),
        );
      });
      await page.goto(`${PREVIEW}/sito/${id}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const frame = page.frameLocator("iframe").first();
      await frame.getByRole("heading", { name: "Onda" }).waitFor({ timeout: 15000 });
      assert.equal(await page.getByText("Dashboard stantia").count(), 0);
      assert.equal(await page.getByText("Sito non trovato").count(), 0);
    } finally {
      await browser.close();
    }
  });

  it("missing snapshot shows Sito non trovato even if localStorage has html", async () => {
    const PREVIEW = await requirePreview();
    const id = "missing-site-xyz";
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(
        ({ html, pid }: { html: string; pid: string }) => {
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: pid,
                    name: "Onda locale",
                    html,
                    kind: "site",
                    status: "ready",
                  },
                ],
              },
              version: 2,
            }),
          );
        },
        { html: ADAPTED, pid: id },
      );
      await page.goto(`${PREVIEW}/sito/${id}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.getByText("Sito non trovato").first().waitFor({ timeout: 12000 });
      assert.equal(await page.locator("iframe").count(), 0);
    } finally {
      await browser.close();
    }
  });
});
