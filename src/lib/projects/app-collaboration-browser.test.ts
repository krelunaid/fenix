import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { type Page } from "playwright";
import { launchChromium } from "./playwright-harness.ts";
import { requirePreview } from "./ensure-preview.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = ensureFenixAdapter(
  readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8"),
);
const PREVIEW = process.env.PREVIEW_URL || "http://127.0.0.1:8081";
const OUT =
  process.env.FENIX_SCORECARD_OUT ||
  (existsSync("/workspace")
    ? "/workspace/screenshots/fase3-collaboration"
    : join(process.cwd(), "screenshots/fase3-collaboration"));
const PALETTE = {
  bg: "#120c1c",
  surface: "#1c1528",
  fg: "#f4efe8",
  muted: "#9b93c2",
  accent: "#e85d4c",
  line: "#3a3048",
};

function seed(page: Page, id: string, owner: string) {
  return page.addInitScript(
    ({ pid, ownerId, html, palette }) => {
      if (window !== window.parent) return;
      localStorage.setItem("fenix.owner-id", ownerId);
      const now = Date.now();
      localStorage.setItem(
        "officina-projects",
        JSON.stringify({
          state: {
            creditsRemaining: 46,
            appDb: {},
            projects: [
              {
                id: pid,
                name: "Argilla condivisa",
                tagline: "Agenda di bottega",
                prompt: "kind=app agenda condivisa",
                kind: "app",
                requestedKind: "app",
                summary: "Agenda condivisa",
                palette,
                html,
                files: [{ path: "index.html", content: html }],
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
    { pid: id, ownerId: owner, html: SITE, palette: PALETTE },
  );
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, name), fullPage: false });
}

describe("shared app links in the browser", () => {
  it("D/T/M: creates an editor link once, scrubs the fragment and opens shared cloud data", async () => {
    await requirePreview();
    const browser = await launchChromium();
    try {
      const id = `collab-${Date.now().toString(36)}`;
      const owner = "f".repeat(32);
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
      await page
        .getByRole("button", { name: /Pubblica/i })
        .first()
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "È online." }).waitFor({ timeout: 20_000 });
      const collaboration = dialog.getByRole("heading", { name: "Collabora sui dati" });
      await collaboration.waitFor({ timeout: 8_000 });
      await collaboration.scrollIntoViewIfNeeded();
      await shot(page, "collaboration-D.png");

      await dialog.getByRole("button", { name: "Link modifica" }).click();
      const link = dialog.getByLabel("Link di collaborazione appena creato");
      await link.waitFor({ timeout: 10_000 });
      const url = await link.inputValue();
      assert.match(url, new RegExp(`/sito/${id}#fenix-access=[a-f0-9]{64}$`));
      const token = url.split("fenix-access=")[1] || "";
      const storage = await page.evaluate(() => JSON.stringify(localStorage));
      assert.doesNotMatch(storage, new RegExp(token));

      await page.setViewportSize({ width: 768, height: 1024 });
      await collaboration.scrollIntoViewIfNeeded();
      await shot(page, "collaboration-T.png");
      await page.setViewportSize({ width: 390, height: 844 });
      await collaboration.scrollIntoViewIfNeeded();
      await shot(page, "collaboration-M.png");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      assert.ok(overflow <= 1, `mobile overflow ${overflow}`);

      const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const guest = await guestContext.newPage();
      let exchangeCookie = "";
      const guestRequests: { method: string; url: string }[] = [];
      guest.on("request", (next) => {
        guestRequests.push({ method: next.method(), url: next.url() });
      });
      guest.on("response", (response) => {
        if (
          response.request().method() === "POST" &&
          new RegExp(`/api/app-access/${id}$`).test(response.url())
        ) {
          void response.headerValue("set-cookie").then((value) => {
            exchangeCookie = value || "";
          });
        }
      });
      await guest.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await guest.locator("iframe").waitFor({ timeout: 15_000 });
      await guest.waitForFunction(() => !location.hash, undefined, { timeout: 8_000 });
      await guest.waitForTimeout(200);
      const exchangeIndex = guestRequests.findIndex(
        (next) => next.method === "POST" && new RegExp(`/api/app-access/${id}$`).test(next.url),
      );
      const publicSiteIndex = guestRequests.findIndex(
        (next) => next.method === "GET" && new RegExp(`/api/sites/${id}`).test(next.url),
      );
      assert.ok(exchangeIndex >= 0 && publicSiteIndex > exchangeIndex);
      assert.match(exchangeCookie, /fenix_share_[a-f0-9]{16}=/);
      assert.match(exchangeCookie, /HttpOnly/);
      assert.match(exchangeCookie, /SameSite=Strict/);
      assert.match(exchangeCookie, new RegExp(`Path=/api/app-data/${id}`));
      const pair = exchangeCookie.split(";", 1)[0] || "";
      const separator = pair.indexOf("=");
      assert.ok(separator > 0);
      // Production is HTTPS and keeps Secure. The local HTTP preview cannot retain
      // that cookie, so install the same scoped HttpOnly capability without Secure.
      await guestContext.addCookies([
        {
          name: pair.slice(0, separator),
          value: pair.slice(separator + 1),
          domain: "127.0.0.1",
          path: `/api/app-data/${id}`,
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
        },
      ]);
      const cloud = await guest.evaluate(async (siteId) => {
        const res = await fetch(`/api/app-data/${encodeURIComponent(siteId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "load", col: "agenda" }),
        });
        return { status: res.status, body: await res.json() };
      }, id);
      assert.equal(cloud.status, 200);
      assert.equal(cloud.body.mode, "cloud-shared");
      assert.equal(cloud.body.role, "editor");
      assert.equal(cloud.body.shared, true);
      assert.equal(new URL(guest.url()).hash, "");
      await guestContext.close();

      const filtered = noise.filter(
        (entry) =>
          !/favicon|Download the React DevTools|status of 404|net::ERR|\/api\/sites\//i.test(entry),
      );
      assert.deepEqual(filtered, []);
      await page.close();
    } finally {
      await browser.close();
    }
  });
});
