import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const forno = String(process.env.FENIX_FORNO_URL || "http://127.0.0.1:4320").replace(/\/$/, "");
const atelier = String(process.env.FENIX_ATELIER_URL || "http://127.0.0.1:4321").replace(/\/$/, "");
const out = process.env.FENIX_EVIDENCE_DIR || "docs/phase3/evidence/generality";
const atelierUser = process.env.FENIX_ATELIER_USER;
const atelierPassword = process.env.FENIX_ATELIER_PASSWORD;
const viewports = [
  ["mobile", { width: 390, height: 844 }],
  ["tablet", { width: 820, height: 1180 }],
  ["desktop", { width: 1440, height: 1000 }],
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { ok: true, products: {}, viewports: viewports.map(([name, size]) => ({ name, ...size })) };

async function inspect(label, base, { login = false } = {}) {
  const result = { pages: [], consoleErrors: [] };
  for (const [viewport, size] of viewports) {
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(`${viewport}: ${message.text()}`); });
    page.on("pageerror", (error) => result.consoleErrors.push(`${viewport}: ${error.message}`));
    if (login) {
      if (!atelierUser || !atelierPassword) throw new Error("Imposta FENIX_ATELIER_USER e FENIX_ATELIER_PASSWORD per il benchmark autenticato");
      await page.goto(`${base}/login`, { waitUntil: "networkidle" });
      await page.fill("#username", atelierUser);
      await page.fill("#password", atelierPassword);
      await Promise.all([
        page.waitForURL(`${base}/`, { timeout: 8_000 }),
        page.click('button[type="submit"]'),
      ]);
      await page.waitForLoadState("networkidle");
    } else {
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
    }
    const metrics = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      textLength: document.body.innerText.trim().length,
    }));
    await page.screenshot({ path: `${out}/${label}-${viewport}.png`, fullPage: true });
    result.pages.push({ viewport, ...metrics });
    await context.close();
  }
  return result;
}

try {
  report.products.fornoVivo = await inspect("forno-vivo", forno);
  report.products.atelierBarba = await inspect("atelier-barba", atelier, { login: true });
  report.ok = Object.values(report.products).every((product) => product.consoleErrors.length === 0 && product.pages.every((page) => !page.overflowX && page.h1 && page.textLength >= 120));
  await writeFile(`${out}/browser-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
