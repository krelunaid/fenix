import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { chromium } from "playwright";
import { requirePreview } from "./ensure-preview.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";
import { OWNER_HEADER, OWNER_STORAGE_KEY, PUBLISHED_MAP_KEY } from "./publish-owner.ts";
import { snapshotHash } from "./published.ts";
import { scrubCraftMedia } from "../ai/hero-image.ts";

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
const OWNER_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("published site is server-side, not localStorage", () => {
  it("sito route does not read the local project store", () => {
    const src = readFileSync(join(root, "src/routes/sito.$projectId.tsx"), "utf8");
    assert.doesNotMatch(src, /useProjectStore/);
    assert.doesNotMatch(src, /officina-projects/);
    assert.match(src, /loadPublished/);
    assert.doesNotMatch(src, /allow-same-origin/);
    const client = readFileSync(join(root, "src/lib/projects/publish-client.ts"), "utf8");
    assert.match(client, /\/api\/sites\//);
    assert.match(client, /OWNER_HEADER/);
    assert.match(client, /If-Match/);
    assert.match(client, /rememberPublishedId/);
    assert.match(client, /readPublishedId/);
    assert.match(client, /PUBLISHED_MAP_KEY/);
    const owner = readFileSync(join(root, "src/lib/projects/publish-owner.ts"), "utf8");
    assert.match(owner, /fenix\.published-ids/);
    const api = readFileSync(join(root, "src/routes/api/sites.\$id.ts"), "utf8");
    assert.match(api, /handleSiteRequest/);
    const panel = readFileSync(join(root, "src/components/publish-panel.tsx"), "utf8");
    assert.match(panel, /publishSnapshot/);
    assert.match(panel, /readPublishedId/);
    const preview = readFileSync(join(root, "src/components/preview-frame.tsx"), "utf8");
    assert.doesNotMatch(preview, /allow-same-origin/);
    const card = readFileSync(join(root, "src/components/project-card.tsx"), "utf8");
    assert.doesNotMatch(card, /allow-same-origin/);
  });

  it("anonymous PUT is 401 and GET stays public", async () => {
    const PREVIEW = await requirePreview();
    const id = "onda-auth-" + Date.now().toString(36);
    const anon = await fetch(`${PREVIEW}/api/sites/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Onda", kind: "site", palette: PALETTE, html: ADAPTED }),
    });
    assert.equal(anon.status, 401);

    const put = await fetch(`${PREVIEW}/api/sites/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", [OWNER_HEADER]: OWNER_A },
      body: JSON.stringify({ name: "Onda", kind: "site", palette: PALETTE, html: ADAPTED }),
    });
    assert.equal(put.ok, true, await put.text());

    const other = await fetch(`${PREVIEW}/api/sites/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        [OWNER_HEADER]: OWNER_B,
        "If-Match": `"1"`,
      },
      body: JSON.stringify({
        name: "Onda",
        kind: "site",
        palette: PALETTE,
        html: ADAPTED.replace("Onda", "Hijack"),
      }),
    });
    assert.equal(other.status, 403);

    const get = await fetch(`${PREVIEW}/api/sites/${id}`, { cache: "no-store" });
    assert.equal(get.status, 200);
    const snap = (await get.json()) as { ownerHash?: string; html: string; version?: number };
    assert.equal(snap.ownerHash, undefined);
    assert.match(snap.html, /Onda/);

    const lost = await fetch(`${PREVIEW}/api/sites/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        [OWNER_HEADER]: OWNER_A,
        "If-Match": `"9"`,
      },
      body: JSON.stringify({
        name: "Onda",
        kind: "site",
        palette: PALETTE,
        html: ADAPTED.replace("Onda", "Onda X"),
      }),
    });
    assert.equal(lost.status, 409);
  });

  it("PUT snapshot then a clean browser without localStorage sees the published heading", async () => {
    const PREVIEW = await requirePreview();
    const id = "onda-pub-" + Date.now().toString(36);
    const put = await fetch(`${PREVIEW}/api/sites/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", [OWNER_HEADER]: OWNER_A },
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
        if (window !== window.parent) return;
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
              version: 3,
            }),
          );
      });
      await page.goto(`${PREVIEW}/sito/${id}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const frame = page.frameLocator("iframe").first();
      await frame.getByRole("heading", { name: "Onda" }).waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);
      assert.equal(await page.getByText("Dashboard stantia").count(), 0);
      assert.equal(await page.getByText("Sito non trovato").count(), 0);
      const sandbox = await page.locator("iframe").first().getAttribute("sandbox");
      assert.equal(/(^|\s)allow-same-origin(\s|$)/.test(sandbox || ""), false);
      assert.match(sandbox || "", /allow-scripts/);
      const box = await page.locator("iframe").first().boundingBox();
      const vp = page.viewportSize();
      assert.ok(box && vp, "iframe e viewport");
      assert.ok(box!.width >= vp!.width * 0.95, `iframe width ${box!.width} vs ${vp!.width}`);
      const child = page.frames().find((f) => f !== page.mainFrame());
      assert.ok(child);
      const media = await child!.evaluate(async () => {
        const imgs = [...document.querySelectorAll("img")];
        await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
        return imgs.map((img) => ({
          alt: img.alt,
          w: img.naturalWidth,
          src: img.currentSrc || img.src,
        }));
      });
      for (const img of media) {
        if (!/craft-hero\.jpg/.test(img.src)) continue;
        assert.ok(img.w > 0, `craft-hero naturalWidth=${img.w}`);
      }
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
          if (window !== window.parent) return;
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
                version: 3,
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

  it("legacy publish persists original→published id across remount and rejects the other owner", async () => {
    const PREVIEW = await requirePreview();
    const originalId = "legacy-mig-" + Date.now().toString(36);
    const html = scrubCraftMedia(ADAPTED);
    const snap = {
      id: originalId,
      name: "Bottega Terra",
      tagline: "",
      kind: "site" as const,
      summary: "",
      palette: PALETTE,
      html,
      version: 1,
      hash: snapshotHash(html, "site", "Bottega Terra"),
      publishedAt: 1,
    };
    const dir = join(root, ".grok/published");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${originalId}.json`), JSON.stringify(snap));

    const puts: string[] = [];
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on("request", (req) => {
        if (req.method() === "PUT" && /\/api\/sites\//.test(req.url())) {
          puts.push(req.url());
        }
      });
      await page.addInitScript(
        ({ html: siteHtml, pid, owner, palette }: {
          html: string;
          pid: string;
          owner: string;
          palette: typeof PALETTE;
        }) => {
          if (window !== window.parent) return;
          if (!localStorage.getItem("fenix.owner-id")) {
            localStorage.setItem("fenix.owner-id", owner);
          }
          const now = Date.now();
          localStorage.setItem(
            "officina-projects",
            JSON.stringify({
              state: {
                projects: [
                  {
                    id: pid,
                    name: "Bottega Terra",
                    tagline: "",
                    prompt: "FORMATO: sito web. kind=site. Bottega Terra ceramiche.",
                    kind: "site",
                    requestedKind: "site",
                    summary: "",
                    palette,
                    html: siteHtml,
                    messages: [],
                    buildLog: ["Pronto"],
                    status: "ready",
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
                creditsRemaining: 46,
                appDb: {},
              },
              version: 3,
            }),
          );
        },
        { html: ADAPTED, pid: originalId, owner: OWNER_A, palette: PALETTE },
      );
      await page.goto(`${PREVIEW}/studio/${originalId}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.getByRole("button", { name: /Pubblica/ }).first().click();
      await page.getByRole("heading", { name: "È online." }).waitFor({ timeout: 20000 });
      const firstPath = (await page.locator("p.font-mono").filter({ hasText: "/sito/" }).innerText()).trim();
      assert.match(firstPath, /^\/sito\/[0-9a-f-]{36}/i);
      assert.equal(firstPath.includes(originalId), false);
      const publishedId = firstPath.replace(/^\/sito\//, "").split(/\s/)[0];
      const firstPutIds = puts.map((u) => decodeURIComponent(u.split("/api/sites/")[1] || "").split("?")[0]);
      assert.equal(firstPutIds.includes(originalId), true);
      assert.equal(firstPutIds.includes(publishedId), true);
      assert.equal(new Set(firstPutIds.filter((id) => id !== originalId)).size, 1);

      const stored = await page.evaluate(
        ({ mapKey, orig }: { mapKey: string; orig: string }) => {
          const raw = localStorage.getItem(mapKey);
          const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
          return { mapped: map[orig] || null, owner: localStorage.getItem("fenix.owner-id") };
        },
        { mapKey: PUBLISHED_MAP_KEY, orig: originalId },
      );
      assert.equal(stored.mapped, publishedId);
      assert.equal(stored.owner, OWNER_A);

      puts.length = 0;
      await page.getByRole("button", { name: "Chiudi" }).click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Pubblica/ }).first().click();
      await page.getByRole("heading", { name: "È online." }).waitFor({ timeout: 20000 });
      const secondPath = (await page.locator("p.font-mono").filter({ hasText: "/sito/" }).innerText()).trim();
      assert.equal(secondPath.split("·")[0].trim(), firstPath.split("·")[0].trim());
      const remountPuts = puts.map((u) => decodeURIComponent(u.split("/api/sites/")[1] || "").split("?")[0]);
      assert.equal(remountPuts.includes(originalId), false);
      assert.ok(remountPuts.length >= 1);
      assert.equal(new Set(remountPuts).size, 1);
      assert.equal(remountPuts[0], publishedId);

      await page.getByRole("button", { name: "Copia link" }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      if (copied) assert.match(copied, new RegExp(`/sito/${publishedId}`));

      await page.getByRole("button", { name: "Chiudi" }).click();
      await page.evaluate(
        ({ owner, key }: { owner: string; key: string }) => {
          localStorage.setItem(key, owner);
        },
        { owner: OWNER_B, key: OWNER_STORAGE_KEY },
      );
      puts.length = 0;
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Pubblica/ }).first().click();
      await page.getByText(/titolare/i).first().waitFor({ timeout: 15000 });
      const otherPuts = puts.map((u) => decodeURIComponent(u.split("/api/sites/")[1] || "").split("?")[0]);
      assert.equal(otherPuts.includes(publishedId), true);
      assert.equal(otherPuts.some((id) => id !== originalId && id !== publishedId), false);
    } finally {
      await browser.close();
    }
  });
});
