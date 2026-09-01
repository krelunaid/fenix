import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium, type Page } from "playwright";
import { ensureFenixAdapter } from "./fenix-adapter.ts";
import { requirePreview } from "./ensure-preview.ts";
import { appendProjectActivity } from "./activity.ts";
import { commitIfChanged } from "./revisions.ts";
import { DEFAULT_PALETTE, type Project } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
const ADAPTED = ensureFenixAdapter(SITE);
const OLDER = ADAPTED.replace("Onda", "Onda Prime").replace(
  /Carica e ascolta i tuoi brani\.?/,
  "Prima cottura, prima della rifinitura.",
);
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT = process.env.FENIX_SCORECARD_OUT || "/workspace/screenshots/fase3-revisions";

function seed(page: Page, project: Project) {
  return page.addInitScript((p) => {
    if (window !== window.parent) return;
    if (sessionStorage.getItem("fenix-revisions-seeded") === "1") return;
    sessionStorage.setItem("fenix-revisions-seeded", "1");
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

function writeShotManifest() {
  try {
    const screenshots = readdirSync(OUT)
      .filter((name) => name.endsWith(".png"))
      .sort()
      .map((name) => {
        const path = join(OUT, name);
        const bytes = readFileSync(path);
        return {
          name,
          bytes: statSync(path).size,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      });
    writeFileSync(
      join(OUT, "manifest.json"),
      `${JSON.stringify(
        {
          schema: "fenix-revisions-evidence-v1",
          viewports: ["desktop", "tablet", "phone"],
          journeys: ["activity-diagnostics", "branch-merge", "rollback"],
          screenshots,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch {
    /* CI without the scorecard dir is fine */
  }
}

function readyProject(): Project {
  const now = Date.now();
  const base: Project = {
    id: "p-rev-studio",
    name: "Onda",
    tagline: "Musica",
    prompt: "sito musica kind=site",
    kind: "site",
    requestedKind: "site",
    summary: "",
    palette: { ...DEFAULT_PALETTE, bg: "#120c1c", accent: "#e85d4c" },
    html: ADAPTED,
    files: [
      { path: "index.html", content: ADAPTED },
      { path: "css/theme.css", content: ":root{--accent:#e85d4c}" },
    ],
    messages: [],
    buildLog: ["Pronto"],
    status: "ready",
    createdAt: now - 60_000,
    updatedAt: now,
  };
  const first = commitIfChanged(
    { ...base, html: OLDER, files: [{ path: "index.html", content: OLDER }] },
    { source: "build", label: "Pronto", id: "rev-old", at: now - 50_000 },
  );
  const ready = commitIfChanged(
    { ...first, html: ADAPTED, files: base.files, name: "Onda" },
    { source: "polish", label: "Rifinitura", id: "rev-new", at: now - 5_000 },
  );
  return appendProjectActivity(
    appendProjectActivity(ready, {
      kind: "build",
      outcome: "run",
      label: "Build avviata",
      metrics: { credits: 4 },
      at: now - 40_000,
    }),
    {
      kind: "ready",
      outcome: "ok",
      label: "Build pronta",
      detail: "Controlli completati",
      metrics: { files: 2, revisions: 2 },
      at: now - 4_000,
    },
  );
}

describe("studio version branches and rollback", () => {
  it("branches and restores an older cottura on desktop, tablet and phone", async () => {
    await requirePreview();
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const project = readyProject();
    assert.ok((project.revisions?.length ?? 0) >= 2);
    try {
      for (const [name, viewport] of [
        ["desktop", { width: 1280, height: 800 }],
        ["tablet", { width: 768, height: 1024 }],
        ["phone", { width: 390, height: 844 }],
      ] as const) {
        const page = await browser.newPage({ viewport });
        await seed(page, project);
        await page.goto(`${PREVIEW}/studio/${project.id}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        const versions = page.getByRole("button", { name: /^Versioni$/ });
        await versions.waitFor({ timeout: 8000 });
        const box = await versions.boundingBox();
        assert.ok(box && box.height >= 36, `${name} Versioni target too small`);
        await versions.click();
        const dialog = page.getByRole("dialog", { name: /Cotture precedenti/i });
        await dialog.waitFor({ timeout: 5000 });
        await shot(page, `versions-${name}.png`);
        assert.ok(await dialog.getByText("Rifinitura").count());
        assert.ok(await dialog.getByText("Pronto").count());
        const activityTab = dialog.getByRole("tab", { name: /Attività · 2/i });
        const activityBox = await activityTab.boundingBox();
        assert.ok(activityBox && activityBox.height >= 44, `${name} Attività target too small`);
        await activityTab.click();
        const ledger = dialog.getByRole("list", { name: "Registro attività" });
        await ledger.waitFor({ timeout: 3000 });
        const summary = dialog.getByRole("group", { name: "Riepilogo operativo" });
        await summary.waitFor({ timeout: 3000 });
        assert.match((await summary.textContent()) || "", /2Eventi1Riuscite0Errori4Crediti/);
        assert.ok(await ledger.getByText("Build pronta").count());
        assert.ok(await ledger.getByText("Build avviata").count());
        assert.match((await ledger.textContent()) || "", /files 2|revisions 2/);
        const exportButton = dialog.getByRole("button", { name: "Esporta diagnosi" });
        const exportBox = await exportButton.boundingBox();
        assert.ok(exportBox && exportBox.height >= 44, `${name} export target too small`);
        const downloadPromise = page.waitForEvent("download");
        await exportButton.click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), "fenix-diagnostica.json");
        const downloadedPath = await download.path();
        assert.ok(downloadedPath);
        const report = readFileSync(downloadedPath!, "utf8");
        assert.match(report, /"schema": "fenix-diagnostics-v1"/);
        assert.doesNotMatch(report, /prompt|messages|html|visualJob|p-rev-studio/i);
        await shot(page, `activity-${name}.png`);
        await dialog.getByRole("tab", { name: /Versioni · 2/i }).click();
        const branchButton = dialog.getByRole("button", { name: /Crea ramo da Pronto/i });
        const branchBox = await branchButton.boundingBox();
        assert.ok(branchBox && branchBox.height >= 44, `${name} Ramo target too small`);
        await branchButton.click();
        await page.waitForURL(
          (url) => url.pathname.startsWith("/studio/") && !url.pathname.endsWith(project.id),
          {
            timeout: 5000,
          },
        );
        const branchProof = await page.evaluate((sourceId) => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return null;
          const parsed = JSON.parse(raw) as {
            state?: {
              projects?: Array<{
                id: string;
                html: string;
                files?: Array<{ path: string; content?: string }>;
                branchFrom?: { projectId: string; revisionId: string };
              }>;
            };
          };
          const projects = parsed.state?.projects || [];
          const branch = projects.find((candidate) => candidate.branchFrom?.projectId === sourceId);
          return branch
            ? {
                count: projects.length,
                id: branch.id,
                html: branch.html,
                paths: (branch.files || []).map((file) => file.path),
                from: branch.branchFrom,
              }
            : null;
        }, project.id);
        assert.ok(branchProof);
        assert.equal(branchProof!.count, 2);
        assert.match(branchProof!.html, /Prima cottura, prima della rifinitura/);
        assert.deepEqual(branchProof!.paths, ["index.html"]);
        assert.deepEqual(branchProof!.from, { projectId: project.id, revisionId: "rev-old" });

        await page.evaluate((branchId) => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) throw new Error("missing persisted projects");
          const parsed = JSON.parse(raw) as {
            state?: {
              projects?: Array<{
                id: string;
                files?: Array<{ path: string; content: string }>;
                appData?: Record<string, unknown>;
                messages?: Array<{ id: string; role: string; content: string; at: number }>;
              }>;
            };
          };
          const branch = parsed.state?.projects?.find((candidate) => candidate.id === branchId);
          if (!branch) throw new Error("missing branch");
          branch.files = [
            ...(branch.files || []),
            { path: "notes/ramo.md", content: "# Decisione del ramo" },
          ];
          branch.appData = { private: [{ value: "non copiare" }] };
          branch.messages = [
            { id: "branch-private", role: "user", content: "messaggio privato", at: 1 },
          ];
          localStorage.setItem("officina-projects", JSON.stringify(parsed));
        }, branchProof!.id);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
        await page.getByRole("button", { name: /^Versioni$/ }).click();
        const branchDialog = page.getByRole("dialog", { name: /Cotture precedenti/i });
        await branchDialog.waitFor({ timeout: 5000 });
        const merge = branchDialog.getByRole("button", { name: /^Unisci ramo in /i });
        assert.equal(
          await merge.count(),
          1,
          `${name} merge missing: ${(await branchDialog.getByRole("button").allTextContents()).join(" · ")}`,
        );
        const mergeBox = await merge.boundingBox();
        assert.ok(mergeBox && mergeBox.height >= 44, `${name} Unisci target too small`);
        await shot(page, `merge-${name}.png`);
        await merge.click();
        await page.waitForURL((url) => url.pathname.endsWith(`/${project.id}`), {
          timeout: 5000,
        });
        const mergeProof = await page.evaluate((sourceId) => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return null;
          const parsed = JSON.parse(raw) as {
            state?: {
              projects?: Array<{
                id: string;
                html: string;
                files?: Array<{ path: string }>;
                appData?: Record<string, unknown>;
                messages?: Array<{ content: string }>;
                activity?: Array<{ kind: string; outcome: string }>;
              }>;
            };
          };
          const source = parsed.state?.projects?.find((candidate) => candidate.id === sourceId);
          return source
            ? {
                html: source.html,
                paths: (source.files || []).map((file) => file.path),
                appData: source.appData,
                messages: source.messages,
                merged: (source.activity || []).some(
                  (item) => item.kind === "merge" && item.outcome === "ok",
                ),
              }
            : null;
        }, project.id);
        assert.ok(mergeProof);
        assert.match(mergeProof!.html, /Carica e ascolta i tuoi brani/);
        assert.ok(mergeProof!.paths.includes("notes/ramo.md"));
        assert.equal(mergeProof!.appData, undefined);
        assert.doesNotMatch(JSON.stringify(mergeProof!.messages), /messaggio privato/);
        assert.equal(mergeProof!.merged, true);

        await page.goto(`${PREVIEW}/studio/${project.id}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        await page.getByRole("button", { name: /^Versioni$/ }).click();
        const restoredDialog = page.getByRole("dialog", { name: /Cotture precedenti/i });
        await restoredDialog.waitFor({ timeout: 5000 });
        const restore = restoredDialog.getByRole("button", { name: /Ripristina Pronto/i });
        await restore.click();
        await page.waitForTimeout(300);
        const html = await page.evaluate(() => {
          const raw = localStorage.getItem("officina-projects");
          if (!raw) return "";
          const parsed = JSON.parse(raw) as { state?: { projects?: { html?: string }[] } };
          return parsed.state?.projects?.[0]?.html || "";
        });
        assert.match(html, /Prima cottura, prima della rifinitura/);
        await page.close();
      }
      writeShotManifest();
    } finally {
      await browser.close();
    }
  });
});
