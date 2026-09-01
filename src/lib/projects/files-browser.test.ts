import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { requirePreview } from "./ensure-preview.ts";
import { SITE_MULTIFILE } from "./fixtures/trees.ts";
import { DEFAULT_PALETTE, type Project } from "./types.ts";
import { commitIfChanged } from "./revisions.ts";
import { bundleProjectHtml } from "./files.ts";

const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-tree";

function seed(page: Page, project: Project) {
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

function readyProject(): Project {
  const now = Date.now();
  const html = SITE_MULTIFILE.find((f) => f.path === "index.html")?.content || "";
  const base: Project = {
    id: "p-tree-studio",
    name: "Onda",
    tagline: "Musica",
    prompt: "sito musica kind=site",
    kind: "site",
    requestedKind: "site",
    summary: "",
    palette: { ...DEFAULT_PALETTE, bg: "#120c1c", accent: "#e85d4c" },
    html,
    files: SITE_MULTIFILE,
    messages: [],
    buildLog: ["Pronto"],
    status: "ready",
    createdAt: now - 60_000,
    updatedAt: now,
  };
  return commitIfChanged(base, { source: "build", label: "Pronto", id: "rev-tree", at: now - 5_000 });
}

describe("studio file tree", () => {
  it("inspects the canonical tree on desktop, tablet and phone without console errors", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const project = readyProject();
    try {
      for (const [name, viewport] of [
        ["desktop", { width: 1280, height: 800 }],
        ["tablet", { width: 768, height: 1024 }],
        ["phone", { width: 390, height: 844 }],
      ] as const) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(String(err)));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });
        await seed(page, project);
        await page.goto(`${PREVIEW}/studio/${project.id}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        const code = page.getByRole("button", { name: /^Codice$/ }).first();
        await code.waitFor({ timeout: 8000 });
        const box = await code.boundingBox();
        assert.ok(box && box.height >= 36, `${name} Codice target too small`);
        await code.click();
        const tree = page.getByRole("tree", { name: /Albero file/i }).filter({ visible: true });
        await tree.waitFor({ timeout: 5000 });
        const css = page.getByRole("treeitem", { name: "css/theme.css" }).filter({ visible: true });
        await css.waitFor({ timeout: 4000 });
        const cssBox = await css.boundingBox();
        assert.ok(cssBox && cssBox.height >= 36, `${name} file target too small`);
        await css.click();
        const inspector = page.getByLabel(/Contenuto css\/theme\.css/i).filter({ visible: true });
        await inspector.waitFor({ timeout: 3000 });
        assert.match((await inspector.textContent()) || "", /--accent:#e85d4c/);
        await shot(page, `tree-${name}.png`);
        const noise = errors.filter(
          (e) => !/favicon|net::ERR|Download the React DevTools|hydration/i.test(e),
        );
        assert.equal(noise.length, 0, `${name} console ${noise.join(" | ")}`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
});

describe("multi-file runtime", () => {
  it("runs linked CSS, linked JS and local JSON fetch in one sandboxable artifact", async () => {
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      const html = bundleProjectHtml([
        {
          path: "index.html",
          content: `<!doctype html><html><head><link rel="stylesheet" href="./css/app.css"></head>
          <body><output id="result">attesa</output><script src="./js/app.js"></script></body></html>`,
        },
        { path: "css/app.css", content: "#result{color:rgb(31,95,139)}" },
        {
          path: "js/app.js",
          content: "fetch('./data/items.json').then(r=>r.json()).then(x=>document.getElementById('result').textContent=x.items[0])",
        },
        { path: "data/items.json", content: '{"items":["Ciotola"]}' },
        { path: "js/unreferenced.js", content: "window.unreferencedRan=true" },
      ]);
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.locator("#result").getByText("Ciotola").waitFor({ timeout: 3000 });
      assert.equal(await page.locator("#result").evaluate((el) => getComputedStyle(el).color), "rgb(31, 95, 139)");
      assert.equal(await page.evaluate(() => Boolean((window as Window & { unreferencedRan?: boolean }).unreferencedRan)), false);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
});
