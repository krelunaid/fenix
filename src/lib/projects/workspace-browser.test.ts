import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { launchChromium } from "./playwright-harness.ts";
import { requirePreview } from "./ensure-preview.ts";
import { DASHBOARD_MOCK } from "./fixtures/trees.ts";

const here = dirname(fileURLToPath(import.meta.url));
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT =
  process.env.FENIX_SCORECARD_OUT ||
  (existsSync("/workspace")
    ? "/workspace/screenshots/fase3-workspace"
    : join(process.cwd(), "screenshots/fase3-workspace"));
const FIXTURE = join(here, "fixtures/shots/fase3-workspace");

function seed(page: Page, id: string, owner: string) {
  return page.addInitScript(
    ({ pid, ownerId, files }) => {
      if (window !== window.parent) return;
      localStorage.setItem("fenix.owner-id", ownerId);
      const now = Date.now();
      const html = files.find((f: { path: string }) => f.path === "index.html")?.content || "";
      localStorage.setItem(
        "officina-projects",
        JSON.stringify({
          state: {
            creditsRemaining: 46,
            appDb: {},
            projects: [
              {
                id: pid,
                name: "Argilla Viva",
                tagline: "Magazzino",
                prompt: "kind=dashboard magazzino argilla",
                kind: "dashboard",
                requestedKind: "dashboard",
                summary: "Magazzino condiviso",
                palette: {
                  bg: "#0e0d0b",
                  surface: "#1a1814",
                  fg: "#f4efe8",
                  muted: "#a39486",
                  accent: "#c45c26",
                },
                html,
                files,
                messages: [{ id: "m1", role: "assistant", content: "Pronto.", at: now }],
                buildLog: ["Anteprima rifinita"],
                status: "ready",
                createdAt: now,
                updatedAt: now,
              },
            ],
          },
          version: 3,
        }),
      );
    },
    { pid: id, ownerId: owner, files: DASHBOARD_MOCK },
  );
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(FIXTURE, { recursive: true });
  const path = join(OUT, name);
  try {
    await page.screenshot({ path, fullPage: false });
    writeFileSync(join(FIXTURE, name), readFileSync(path));
  } catch {
    /* CI without the scorecard dir is fine */
  }
}

describe("project workspace in the browser", () => {
  it("isolates owner/editor/viewer sessions with CAS, revoke, D/T/M and no token in storage", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const id = `ws-proj-${Date.now().toString(36)}`;
      const owner = "a".repeat(32);
      const editor = "b".repeat(32);
      const viewer = "c".repeat(32);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const noise: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") noise.push(msg.text());
      });
      page.on("pageerror", (error) => noise.push(String(error)));
      await seed(page, id, owner);
      await page.goto(`${PREVIEW}/studio/${id}`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      await page.getByRole("button", { name: /Condividi/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "Condividi il progetto" }).waitFor({ timeout: 8_000 });
      await dialog.getByRole("button", { name: "Crea workspace" }).click();
      await dialog.getByRole("button", { name: "Invita editore" }).waitFor({ timeout: 10_000 });
      await shot(page, "workspace-D.png");

      await dialog.getByRole("button", { name: "Invita editore" }).click();
      const link = dialog.getByLabel("Link di invito appena creato");
      await link.waitFor({ timeout: 10_000 });
      const editorUrl = await link.inputValue();
      assert.match(editorUrl, /\/condiviso\/w[a-f0-9]{16,32}#fenix-join=[a-f0-9]{64}$/);
      const workspaceId = editorUrl.split("/condiviso/")[1]?.split("#")[0] || "";
      const editorToken = editorUrl.split("fenix-join=")[1] || "";
      const storage = await page.evaluate(() => JSON.stringify(localStorage));
      assert.doesNotMatch(storage, new RegExp(editorToken));
      assert.doesNotMatch(storage, /fenix-join=/);

      await dialog.getByRole("button", { name: "Invita lettore" }).click();
      await page.waitForTimeout(400);
      const viewerUrl = await link.inputValue();
      const viewerToken = viewerUrl.split("fenix-join=")[1] || "";
      assert.notEqual(viewerToken, editorToken);

      await page.setViewportSize({ width: 768, height: 1024 });
      await dialog.getByRole("heading", { name: "Condividi il progetto" }).scrollIntoViewIfNeeded();
      await shot(page, "workspace-T.png");
      await page.setViewportSize({ width: 390, height: 844 });
      await dialog.getByRole("heading", { name: "Condividi il progetto" }).scrollIntoViewIfNeeded();
      await shot(page, "workspace-M.png");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      assert.ok(overflow <= 1, `mobile overflow ${overflow}`);

      const focus = await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="Copia link di invito"]') as HTMLButtonElement | null;
        if (!btn) return { outline: "", width: 0, height: 0 };
        btn.focus();
        const style = getComputedStyle(btn);
        const box = btn.getBoundingClientRect();
        return {
          outline: `${style.outline} ${style.boxShadow}`,
          width: box.width,
          height: box.height,
        };
      });
      assert.ok(focus.width >= 24 && focus.height >= 24);
      assert.match(focus.outline, /rgb|#[0-9a-f]|solid|8b7cff/i);

      await page.goto(`${PREVIEW}/condiviso/${workspaceId}`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      await page.getByLabel("Appunti condivisi").waitFor({ timeout: 12_000 });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByLabel("Appunti condivisi").fill("Argilla viva. ");
      await page.getByLabel("Appunti condivisi").blur();
      await page.getByText(/Sincronizzati/).first().waitFor({ timeout: 10_000 });
      await shot(page, "coedit-D.png");
      await page.setViewportSize({ width: 768, height: 1024 });
      await shot(page, "coedit-T.png");
      await page.setViewportSize({ width: 390, height: 844 });
      await shot(page, "coedit-M.png");
      const notesOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      assert.ok(notesOverflow <= 1, `notes mobile overflow ${notesOverflow}`);
      const notesFocus = await page.evaluate(() => {
        const area = document.getElementById("fenix-shared-notes") as HTMLTextAreaElement | null;
        if (!area) return { outline: "", width: 0, height: 0 };
        area.focus();
        const style = getComputedStyle(area);
        const box = area.getBoundingClientRect();
        return {
          outline: `${style.outline} ${style.boxShadow}`,
          width: box.width,
          height: box.height,
        };
      });
      assert.ok(notesFocus.width >= 24 && notesFocus.height >= 24);
      assert.match(notesFocus.outline, /rgb|#[0-9a-f]|solid|8b7cff/i);

      const editorCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const editorPage = await editorCtx.newPage();
      await editorPage.addInitScript((ownerId) => {
        localStorage.setItem("fenix.owner-id", ownerId);
      }, editor);
      await editorPage.goto(editorUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await editorPage.getByText(/editor/i).first().waitFor({ timeout: 12_000 });
      await editorPage.waitForFunction(() => !location.hash, undefined, { timeout: 8_000 });
      const editorWrite = await editorPage.evaluate(async (ws) => {
        const loaded = await fetch(`/api/workspace/${ws}`, { cache: "no-store", headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" } });
        const snap = (await loaded.json()) as { casVersion: number };
        const res = await fetch(`/api/workspace/${ws}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "if-match": `"${snap.casVersion}"`,
            "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "",
          },
          body: JSON.stringify({
            path: "data/ordini.json",
            content: `${JSON.stringify({ ordini: [{ id: "o9", pezzi: 9 }] }, null, 2)}\n`,
          }),
        });
        return { status: res.status, body: await res.json() };
      }, workspaceId);
      assert.equal(editorWrite.status, 200);
      assert.equal((editorWrite.body as { casVersion: number }).casVersion, 2);

      await editorPage.getByLabel("Appunti condivisi").waitFor({ timeout: 12_000 });
      const concurrent = await Promise.all([
        editorPage.evaluate(async (ws) => {
          const loaded = await fetch(`/api/workspace/${ws}`, {
            cache: "no-store",
            headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" },
          });
          const snap = (await loaded.json()) as { doc: { content: string; version: number } };
          const res = await fetch(`/api/workspace/${ws}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "",
            },
            body: JSON.stringify({
              op: "doc",
              opId: `o${"a".repeat(16)}`,
              kind: "insert",
              pos: 0,
              text: "Lotti. ",
              base: snap.doc.version,
            }),
          });
          return { status: res.status, body: await res.json() };
        }, workspaceId),
        page.evaluate(async (ws) => {
          const loaded = await fetch(`/api/workspace/${ws}`, {
            cache: "no-store",
            headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" },
          });
          const snap = (await loaded.json()) as { doc: { content: string; version: number } };
          const res = await fetch(`/api/workspace/${ws}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "",
            },
            body: JSON.stringify({
              op: "doc",
              opId: `o${"b".repeat(16)}`,
              kind: "insert",
              pos: snap.doc.content.length,
              text: "Forno.",
              base: snap.doc.version,
            }),
          });
          return { status: res.status, body: await res.json() };
        }, workspaceId),
      ]);
      assert.equal(concurrent[0]?.status, 200);
      assert.equal(concurrent[1]?.status, 200);

      const reopened = await editorPage.evaluate(async (ws) => {
        const res = await fetch(`/api/workspace/${ws}`, {
          cache: "no-store",
          headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" },
        });
        return res.json();
      }, workspaceId);
      const shared = (reopened as { doc: { content: string } }).doc.content;
      assert.match(shared, /Lotti\. /);
      assert.match(shared, /Forno\./);
      const ownerView = await page.evaluate(async (ws) => {
        const res = await fetch(`/api/workspace/${ws}`, {
          cache: "no-store",
          headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" },
        });
        return res.json();
      }, workspaceId);
      assert.equal((ownerView as { doc: { content: string } }).doc.content, shared);

      const viewerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const viewerPage = await viewerCtx.newPage();
      await viewerPage.addInitScript((ownerId) => {
        localStorage.setItem("fenix.owner-id", ownerId);
      }, viewer);
      await viewerPage.goto(viewerUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await viewerPage.getByText(/sola lettura|viewer/i).first().waitFor({ timeout: 12_000 });
      const viewerWrite = await viewerPage.evaluate(async (ws) => {
        const res = await fetch(`/api/workspace/${ws}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "if-match": '"2"',
            "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "",
          },
          body: JSON.stringify({ path: "index.html", content: "<html><body>no</body></html>" }),
        });
        return res.status;
      }, workspaceId);
      assert.equal(viewerWrite, 403);

      const viewerDoc = await viewerPage.evaluate(async (ws) => {
        const res = await fetch(`/api/workspace/${ws}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "",
          },
          body: JSON.stringify({
            op: "doc",
            opId: `o${"c".repeat(16)}`,
            kind: "insert",
            pos: 0,
            text: "no",
            base: 0,
            role: "editor",
          }),
        });
        return res.status;
      }, workspaceId);
      assert.equal(viewerDoc, 403);

      const memberId = await page.evaluate(async (ws) => {
        const res = await fetch(`/api/workspace/${ws}`, {
          cache: "no-store",
          headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" },
        });
        const body = (await res.json()) as { members: { id: string; role: string }[] };
        return body.members.find((m) => m.role === "viewer")?.id || "";
      }, workspaceId);
      assert.ok(memberId);
      const revoked = await page.evaluate(
        async ({ ws, memberId: mid }) => {
          const res = await fetch(`/api/workspace/${ws}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "",
            },
            body: JSON.stringify({ op: "revoke", memberId: mid }),
          });
          return res.status;
        },
        { ws: workspaceId, memberId },
      );
      assert.equal(revoked, 200);
      const after = await viewerPage.evaluate(async (ws) => {
        const res = await fetch(`/api/workspace/${ws}`, {
          cache: "no-store",
          headers: { "x-fenix-owner": localStorage.getItem("fenix.owner-id") || "" },
        });
        return res.status;
      }, workspaceId);
      assert.equal(after, 403);

      const filtered = noise.filter(
        (entry) => !/favicon|Download the React DevTools|status of 404|net::ERR/i.test(entry),
      );
      assert.deepEqual(filtered, []);

      const manifest = [
        "workspace-D.png",
        "workspace-T.png",
        "workspace-M.png",
        "coedit-D.png",
        "coedit-T.png",
        "coedit-M.png",
      ].map((name) => {
        const file = join(FIXTURE, name);
        const bytes = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
        return {
          name,
          sha256: bytes.length ? createHash("sha256").update(bytes).digest("hex") : "",
          bytes: bytes.length,
        };
      });
      writeFileSync(
        join(FIXTURE, "manifest.json"),
        `${JSON.stringify({ generatedAt: new Date().toISOString(), shots: manifest }, null, 2)}\n`,
      );

      await editorCtx.close();
      await viewerCtx.close();
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
