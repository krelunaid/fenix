// Runs INSIDE the sandbox (copied to .fenix/browser-smoke.mjs). Loads each page
// in Chromium at phone and desktop sizes, collects console errors / page errors /
// failed requests, takes screenshots, and prints one JSON report on stdout.
// If `playwright` cannot be resolved, prints { skipped: true } and exits 0.
//
// Env: BASE_URL (required), PAGES (JSON array of paths), SHOTS_DIR (default .fenix/shots)
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL;
const pages = JSON.parse(process.env.PAGES || '["/"]');
const shotsDir = process.env.SHOTS_DIR || ".fenix/shots";

let chromium;
try {
  try { ({ chromium } = await import("/opt/fenix/node_modules/playwright/index.mjs")); }
  catch { ({ chromium } = await import("playwright")); }
} catch {
  console.log(JSON.stringify({ skipped: true, reason: "playwright non disponibile nel sandbox" }));
  process.exit(0);
}

await mkdir(shotsDir, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const report = { skipped: false, pages: [] };
const viewports = [
  { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "desktop", width: 1280, height: 800 },
];

for (const path of pages) {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await context.newPage();
    const entry = { path, viewport: vp.name, consoleErrors: [], pageErrors: [], failedRequests: [], status: null, title: "", overflowX: false, shot: "" };
    page.on("console", (m) => { if (m.type() === "error") entry.consoleErrors.push(m.text().slice(0, 300)); });
    page.on("pageerror", (e) => entry.pageErrors.push(String(e?.message || e).slice(0, 300)));
    page.on("requestfailed", (r) => entry.failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText || ""}`.slice(0, 300)));
    page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(base)) entry.failedRequests.push(`${r.status()} ${r.url()}`.slice(0, 300)); });
    try {
      const res = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 20_000 });
      entry.status = res?.status() ?? null;
      entry.title = await page.title();
      await page.waitForTimeout(400);
      entry.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      entry.interactive = await page.evaluate(() => ({
        buttons: document.querySelectorAll("button, a[href], input, select, textarea").length,
        headings: document.querySelectorAll("h1, h2").length,
        textLength: (document.body?.innerText || "").trim().length,
        hasMain: Boolean(document.querySelector("main, [role=main]")),
      }));
      entry.shot = `${shotsDir}/${vp.name}${path.replace(/[^a-z0-9]+/gi, "_") || "_root"}.png`;
      await page.screenshot({ path: entry.shot, fullPage: false });
    } catch (err) {
      entry.pageErrors.push(`navigation: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300));
    }
    await context.close();
    report.pages.push(entry);
  }
}
await browser.close();
console.log(JSON.stringify(report));
