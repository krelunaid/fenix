import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = String(process.env.FENIX_FIXTURE_URL || "http://127.0.0.1:4317").replace(/\/$/, "");
const out = process.env.FENIX_EVIDENCE_DIR || "docs/phase3/evidence/acquatrack";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const attach = (page, label) => {
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label}:console:${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`${label}:page:${error.message}`));
};

try {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mobile.newPage();
  attach(page, "mobile");
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin@acquatrack.it");
  await page.fill("#password", "admin123");
  await Promise.all([page.waitForURL(`${base}/`, { timeout: 5_000 }), page.click("button[type=submit]")]);
  await page.screenshot({ path: `${out}/dashboard-mobile.png`, fullPage: true });

  await page.goto(`${base}/registrazioni`, { waitUntil: "networkidle" });
  await page.click("#addBtn");
  const luogo = await page.locator("#luogo_id option").nth(1).getAttribute("value");
  await page.selectOption("#luogo_id", luogo);
  await page.fill("#litri", "123.45");
  await page.fill("#data", new Date().toISOString().slice(0, 10));
  await page.selectOption("#turno", "pomeriggio");
  const note = `Prova browser Fenix ${Date.now()}`;
  await page.fill("#nota", note);
  await page.locator("#registrazioneForm button[type=submit]").click();
  await page.getByText(note).waitFor({ timeout: 5_000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(note).waitFor();

  let row = page.locator("li").filter({ hasText: note }).first();
  await row.locator(".edit-btn").click();
  const updated = `${note} aggiornata`;
  await page.fill("#nota", updated);
  await page.locator("#registrazioneForm button[type=submit]").click();
  await page.getByText(updated).waitFor();
  await page.screenshot({ path: `${out}/records-mobile.png`, fullPage: true });
  row = page.locator("li").filter({ hasText: updated }).first();
  await row.locator(".delete-btn").click();
  await page.click("#confirmDeleteBtn");
  await page.getByText(updated).waitFor({ state: "detached" });
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const desktopPage = await desktop.newPage();
  attach(desktopPage, "desktop");
  await desktopPage.goto(`${base}/login`, { waitUntil: "networkidle" });
  await desktopPage.fill("#email", "mario.rossi@acquatrack.it");
  await desktopPage.fill("#password", "dip123");
  await Promise.all([desktopPage.waitForURL(`${base}/`, { timeout: 5_000 }), desktopPage.click("button[type=submit]")]);
  await desktopPage.screenshot({ path: `${out}/dashboard-desktop.png`, fullPage: true });
  const employeeLuoghiVisible = await desktopPage.locator("#luoghiTab").isVisible().catch(() => false);
  await desktop.close();

  const report = {
    ok: errors.length === 0,
    adminCrud: { create: true, reloadPersistence: true, update: true, delete: true },
    employee: { login: true, luoghiAdminTabHidden: !employeeLuoghiVisible },
    consoleErrors: errors,
    viewports: ["390x844", "1440x1000"],
  };
  await writeFile(`${out}/browser-flow.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok || employeeLuoghiVisible) process.exitCode = 1;
} finally {
  await browser.close();
}
