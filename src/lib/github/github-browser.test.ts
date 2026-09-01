import assert from "node:assert/strict";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { ensureFenixAdapter } from "../projects/fenix-adapter.ts";
import { requirePreview } from "../projects/ensure-preview.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "../projects/fixtures/argilla-viva.html"), "utf8");
const VALID_APP = readFileSync(join(here, "../projects/fixtures/valid-app.html"), "utf8");
const ADAPTED = ensureFenixAdapter(SITE);
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT =
  process.env.FENIX_SCORECARD_OUT ||
  (existsSync("/workspace")
    ? "/workspace/screenshots/fase3-github"
    : join(process.cwd(), "screenshots/fase3-github"));

function seed(page: Page, project: Record<string, unknown>, owner?: string) {
  return page.addInitScript(
    ({ p, ownerId }: { p: Record<string, unknown>; ownerId?: string }) => {
      if (window !== window.parent) return;
      if (ownerId) localStorage.setItem("fenix.owner-id", ownerId);
      localStorage.setItem(
        "officina-projects",
        JSON.stringify({
          state: { projects: [p], creditsRemaining: 46, appDb: {} },
          version: 3,
        }),
      );
    },
    { p: project, ownerId: owner },
  );
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  try {
    await page.screenshot({ path: join(OUT, name), fullPage: false });
  } catch {
    /* CI without the scorecard dir is fine */
  }
}

const ready = (id: string, now: number) => ({
  id,
  name: "Argilla Viva",
  tagline: "Magazzino",
  prompt: "FORMATO: gestionale ufficio. kind=dashboard. Argilla Viva",
  kind: "dashboard",
  requestedKind: "dashboard",
  summary: "",
  palette: {
    bg: "#120c1c",
    surface: "#1c1528",
    fg: "#f4efe8",
    muted: "#9b93c2",
    accent: "#e85d4c",
    line: "#3a3048",
  },
  html: ADAPTED,
  messages: [],
  buildLog: ["Pronto"],
  status: "ready",
  createdAt: now,
  updatedAt: now,
});

describe("studio GitHub export panel", () => {
  it("D/T/M: ZIP stays, unconfigured GitHub is honest, no auto export, no overflow", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const now = Date.now();
      const pid = "49c14680-a504-436d-a0db-84e4f3583dbe";
      const owner = "c".repeat(32);
      const viewports = [
        { name: "D", width: 1440, height: 900 },
        { name: "T", width: 768, height: 1024 },
        { name: "M", width: 390, height: 844 },
      ];
      for (const vp of viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        const noise: string[] = [];
        const posts: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") noise.push(msg.text());
        });
        page.on("pageerror", (err) => noise.push(String(err)));
        page.on("request", (req) => {
          if (req.method() === "POST" && /\/api\/github\/export/.test(req.url()))
            posts.push(req.url());
        });
        await seed(page, ready(pid, now), owner);
        await page.goto(`${PREVIEW}/studio/${pid}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        const exportBtn = page.getByRole("button", { name: /Esporta/i }).first();
        await exportBtn.waitFor({ timeout: 12000 });
        await exportBtn.click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("heading", { name: /Albero Fenix/i }).waitFor({ timeout: 8000 });
        await dialog.getByRole("button", { name: /Scarica \.zip/i }).waitFor({ timeout: 4000 });
        await dialog
          .getByRole("status")
          .filter({ hasText: /GitHub non configurato/i })
          .waitFor({ timeout: 8000 });
        assert.equal(await dialog.getByRole("button", { name: /^Esporta$/ }).count(), 0);
        assert.equal(posts.length, 0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert.ok(overflow <= 1, `${vp.name} overflow ${overflow}`);
        const box = await dialog.boundingBox();
        assert.ok(box && box.width <= vp.width + 1);
        await shot(page, `export-${vp.name}.png`);
        const filtered = noise.filter(
          (e) =>
            !/favicon|net::ERR|Download the React DevTools|hydration|status of 404|\/api\/sites\//i.test(
              e,
            ),
        );
        assert.deepEqual(filtered, []);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  it("connected fixture: repo, branch, preview, export only on click, focus-visible", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const now = Date.now();
      const pid = "gh-export-" + now.toString(36);
      let exportPosts = 0;
      await page.route("**/api/github", async (route) => {
        const req = route.request();
        if (req.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              configured: true,
              connected: true,
              account: "krelunaid",
              hint: "Installazione collegata. L'export parte solo se lo chiedi tu.",
            }),
          });
          return;
        }
        if (req.method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              url: "https://github.com/apps/fenix-export/installations/new?state=test",
            }),
          });
          return;
        }
        await route.continue();
      });
      await page.route("**/api/github/repos", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            repos: [
              {
                fullName: "krelunaid/argilla",
                defaultBranch: "main",
                private: false,
                empty: false,
              },
            ],
          }),
        });
      });
      await page.route("**/api/github/export", async (route) => {
        const req = route.request();
        const body = req.postDataJSON() as { preview?: boolean };
        if (body?.preview) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "preview",
              status: "ok",
              repo: "krelunaid/argilla",
              branch: "main",
              contentHash: "abc",
              files: [{ path: "index.html", bytes: 12, change: "update" }],
              log: ["Anteprima locale. Nessun commit."],
            }),
          });
          return;
        }
        exportPosts += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "job-1",
            status: "ok",
            repo: "krelunaid/argilla",
            branch: "main",
            contentHash: "abc",
            commitSha: "deadbeefcafebabe",
            htmlUrl: "https://github.com/krelunaid/argilla/commit/deadbeefcafebabe",
            files: [{ path: "index.html", bytes: 12 }],
            log: ["Branch aggiornato. force=false."],
          }),
        });
      });
      await seed(page, ready(pid, now), "d".repeat(32));
      await page.goto(`${PREVIEW}/studio/${pid}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page
        .getByRole("button", { name: /Esporta/i })
        .first()
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox").or(dialog.locator("select")).waitFor({ timeout: 8000 });
      await dialog.locator("select").selectOption("krelunaid/argilla");
      const branch = dialog.locator("input");
      await branch.waitFor({ timeout: 4000 });
      assert.equal(exportPosts, 0);
      await dialog.getByRole("button", { name: /Anteprima file/i }).click();
      await dialog.getByText("index.html").waitFor({ timeout: 8000 });
      assert.equal(exportPosts, 0);
      await dialog.getByRole("button", { name: /^Esporta$/ }).click();
      await dialog.getByText(/Pronto · deadbeef/i).waitFor({ timeout: 8000 });
      assert.equal(exportPosts, 1);
      const selectH = await dialog
        .locator("select")
        .evaluate((el) => el.getBoundingClientRect().height);
      assert.ok(selectH >= 40, `select ${selectH}`);
    } finally {
      await browser.close();
    }
  });

  it("D/T/M: GitHub pull starts only on click and creates an isolated project", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const viewports = [
        { name: "D", width: 1440, height: 900 },
        { name: "T", width: 768, height: 1024 },
        { name: "M", width: 390, height: 844 },
      ];
      for (const vp of viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        const now = Date.now();
        const pid = `gh-import-${vp.name.toLowerCase()}-${now.toString(36)}`;
        let importPosts = 0;
        const noise: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") noise.push(msg.text());
        });
        page.on("pageerror", (err) => noise.push(String(err)));
        await page.route("**/api/github", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              configured: true,
              connected: true,
              account: "krelunaid",
              hint: "Installazione collegata. L'export parte solo se lo chiedi tu.",
            }),
          });
        });
        await page.route("**/api/github/repos", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              repos: [
                {
                  fullName: "krelunaid/argilla",
                  defaultBranch: "main",
                  private: false,
                  empty: false,
                },
              ],
            }),
          });
        });
        await page.route("**/api/github/import", async (route) => {
          importPosts += 1;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              repo: "krelunaid/argilla",
              branch: "main",
              commitSha: "deadbeefcafebabe",
              contentHash: "a".repeat(64),
              name: `Flusso ${vp.name}`,
              kind: "app",
              files: [{ path: "index.html", content: VALID_APP }],
            }),
          });
        });
        await seed(page, ready(pid, now), "e".repeat(32));
        await page.goto(`${PREVIEW}/studio/${pid}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        await page
          .getByRole("button", { name: /Esporta/i })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        const pull = dialog.getByRole("button", { name: /Importa come nuovo progetto/i });
        await pull.waitFor({ timeout: 8000 });
        await pull.scrollIntoViewIfNeeded();
        assert.equal(importPosts, 0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert.ok(overflow <= 1, `${vp.name} overflow ${overflow}`);
        await shot(page, `github-import-${vp.name}.png`);
        await pull.click();
        await page.waitForTimeout(800);
        const alertNode = dialog.getByRole("alert");
        const alert = (await alertNode.count()) ? await alertNode.textContent() : "";
        assert.equal(alert || "", "", `${vp.name} import error: ${alert}`);
        await page.waitForURL(
          (url) => /\/studio\//.test(url.pathname) && !url.pathname.endsWith(pid),
          {
            timeout: 12000,
          },
        );
        assert.equal(importPosts, 1);
        const stored = await page.evaluate(() => {
          const parsed = JSON.parse(localStorage.getItem("officina-projects") || "{}") as {
            state?: { projects?: Record<string, unknown>[]; creditsRemaining?: number };
          };
          return {
            project: parsed.state?.projects?.[0],
            credits: parsed.state?.creditsRemaining,
          };
        });
        const imported = stored.project || {};
        assert.equal(imported.name, `Flusso ${vp.name}`);
        assert.equal(imported.direction, "Import GitHub");
        assert.equal(imported.appData, undefined);
        assert.equal(imported.visualJobId, undefined);
        assert.equal(imported.publishedId, undefined);
        assert.equal(stored.credits, 46);
        const filtered = noise.filter(
          (e) =>
            !/favicon|net::ERR|Download the React DevTools|status of 404|\/api\/sites\//i.test(e),
        );
        assert.deepEqual(filtered, []);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
});
