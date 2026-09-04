import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { isBlockedPublicNetworkError, launchChromium } from "./playwright-harness.ts";
import { requirePreview } from "./ensure-preview.ts";
import { APP_COMPONENTS, SITE_MULTIFILE } from "./fixtures/trees.ts";
import { DEFAULT_PALETTE, type Project } from "./types.ts";
import { commitIfChanged } from "./revisions.ts";
import { bundleProjectHtml } from "./files.ts";
import { zipProject } from "./zip.ts";

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
  return commitIfChanged(base, {
    source: "build",
    label: "Pronto",
    id: "rev-tree",
    at: now - 5_000,
  });
}

describe("studio file tree", () => {
  it("inspects the canonical tree on desktop, tablet and phone without console errors", async () => {
    await requirePreview();
    const browser = await launchChromium();
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
        await page.goto(`${PREVIEW}/studio/${project.id}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
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
    const browser = await launchChromium();
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
          content:
            "fetch('./data/items.json').then(r=>r.json()).then(x=>document.getElementById('result').textContent=x.items[0])",
        },
        { path: "data/items.json", content: '{"items":["Ciotola"]}' },
        { path: "js/unreferenced.js", content: "window.unreferencedRan=true" },
      ]);
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.locator("#result").getByText("Ciotola").waitFor({ timeout: 3000 });
      assert.equal(
        await page.locator("#result").evaluate((el) => getComputedStyle(el).color),
        "rgb(31, 95, 139)",
      );
      assert.equal(
        await page.evaluate(() =>
          Boolean((window as Window & { unreferencedRan?: boolean }).unreferencedRan),
        ),
        false,
      );
      assert.deepEqual(
        errors.filter((e) => !isBlockedPublicNetworkError(e)),
        [],
      );
    } finally {
      await browser.close();
    }
  });
});

describe("portable Fenix ZIP import", () => {
  it("reopens an exported tree as an independent ready project on desktop, tablet and phone", async () => {
    await requirePreview();
    const archive = zipProject(APP_COMPONENTS, { kind: "app", name: "Onda Portatile" });
    const expectedPaths = APP_COMPONENTS.map((file) => file.path).sort();
    const browser = await launchChromium();
    try {
      for (const [name, viewport] of [
        ["desktop", { width: 1280, height: 800 }],
        ["tablet", { width: 768, height: 1024 }],
        ["phone", { width: 390, height: 844 }],
      ] as const) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(PREVIEW, { waitUntil: "domcontentloaded", timeout: 20_000 });
        const button = page.getByRole("button", { name: "Importa .zip Fenix" });
        await button.waitFor({ timeout: 8_000 });
        const target = await button.boundingBox();
        assert.ok(target && target.height >= 44, `${name} import target too small`);
        await page.getByLabel("Importa archivio Fenix ZIP").setInputFiles({
          name: "onda-portatile.zip",
          mimeType: "application/zip",
          buffer: Buffer.from(archive),
        });
        await page.waitForURL((url) => url.pathname.startsWith("/studio/"), { timeout: 8_000 });
        await page.getByRole("button", { name: /^Codice$/ }).first().waitFor({ timeout: 8_000 });
        const proof = await page.evaluate(() => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return null;
          const state = JSON.parse(raw) as {
            state?: {
              creditsRemaining?: number;
              projects?: Array<{
                name: string;
                status: string;
                prompt: string;
                files?: Array<{ path: string }>;
                revisions?: unknown[];
                activity?: Array<{ kind: string; label: string }>;
                appData?: unknown;
                publishedId?: string;
                visualJobId?: string;
                branchFrom?: unknown;
              }>;
            };
          };
          const project = state.state?.projects?.[0];
          return project
            ? {
                credits: state.state?.creditsRemaining,
                name: project.name,
                status: project.status,
                prompt: project.prompt,
                paths: (project.files || []).map((file) => file.path).sort(),
                revisions: project.revisions?.length || 0,
                activity: project.activity || [],
                isolated:
                  !project.appData &&
                  !project.publishedId &&
                  !project.visualJobId &&
                  !project.branchFrom,
              }
            : null;
        });
        assert.ok(proof);
        assert.equal(proof!.credits, 100);
        assert.equal(proof!.name, "Onda Portatile");
        assert.equal(proof!.status, "ready");
        assert.match(proof!.prompt, /Importato da archivio Fenix verificato/);
        assert.deepEqual(proof!.paths, expectedPaths);
        assert.equal(proof!.revisions, 1);
        assert.ok(
          proof!.activity.some(
            (event) => event.kind === "import" && event.label === "ZIP importato",
          ),
        );
        assert.equal(proof!.isolated, true);
        await shot(page, `zip-import-${name}.png`);
        const noise = errors.filter(
          (error) => !/favicon|net::ERR|Download the React DevTools|hydration/i.test(error),
        );
        assert.equal(noise.length, 0, `${name} console ${noise.join(" | ")}`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  it("does not create a project when the imported preview gate fails", async () => {
    await requirePreview();
    const invalid = [
      {
        path: "index.html",
        content: `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Rotto</title>
        <style>:root{--bg:#ffffff;--fg:#111111;--accent:#7357ff}button:focus-visible{outline:2px solid #7357ff}</style>
        </head><body><main><h1>Una sola schermata</h1></main></body></html>`,
      },
    ];
    const browser = await launchChromium();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(PREVIEW, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.getByLabel("Importa archivio Fenix ZIP").setInputFiles({
        name: "rotto.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(zipProject(invalid, { kind: "app", name: "Rotto" })),
      });
      await page.getByText(/Importazione fermata:/).waitFor({ timeout: 5_000 });
      assert.equal(new URL(page.url()).pathname, "/");
      const state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("officina-projects") || "{}"),
      );
      assert.equal(state.state?.projects?.length || 0, 0);
      assert.equal(state.state?.creditsRemaining, 100);
    } finally {
      await browser.close();
    }
  });
});
