import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { chromium, type Page } from "playwright";
import { FULLSTACK_FIXTURES, materializeFullstackProject } from "./portable-fullstack.ts";

const here = dirname(fileURLToPath(import.meta.url));
const OUT =
  process.env.FENIX_SCORECARD_OUT ||
  (existsSync("/workspace")
    ? "/workspace/screenshots/fase3-fullstack"
    : join(process.cwd(), "screenshots/fase3-fullstack"));
const FIXTURE = join(here, "fixtures/shots/fase3-fullstack");

function writeTree(root: string, files: { path: string; content: string }[]) {
  for (const file of files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
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

describe("coupled full-stack app in the browser", () => {
  it("signs in on the same origin D/T/M with focus, overflow and a clean console", async () => {
    const fixture = FULLSTACK_FIXTURES[0]!;
    const root = mkdtempSync(join(tmpdir(), "fenix-fullstack-ui-"));
    writeTree(root, materializeFullstackProject(fixture));
    const child = spawn(process.execPath, ["backend/server.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: "0",
        FENIX_DB_PATH: join(root, "data.sqlite"),
        FENIX_ALLOWED_ORIGIN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const [chunk] = (await Promise.race([
        once(child.stdout!, "data"),
        once(child, "exit").then(([code]) => {
          throw new Error(`fullstack ui server exited ${code}`);
        }),
      ])) as [Buffer];
      const ready = JSON.parse(chunk.toString("utf8").trim().split("\n")[0]!);
      const base = `http://127.0.0.1:${ready.port}`;
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const noise: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") noise.push(msg.text());
        });
        page.on("pageerror", (error) => noise.push(String(error)));
        await page.goto(base, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.getByRole("heading", { name: "Argilla Viva" }).waitFor({ timeout: 8_000 });
        await page.getByLabel("Email").fill("argilla@fenix.test");
        await page.getByLabel("Password", { exact: true }).fill("forno argilla viva");
        await page.getByRole("button", { name: "Crea account" }).click();
        await page.getByText("Sei argilla@fenix.test").waitFor({ timeout: 10_000 });
        await page.getByLabel("nome").fill("Piatto fondo");
        await page.getByLabel("pezzi").fill("8");
        await page.getByLabel("scaffale").fill("A1");
        await page.getByRole("button", { name: "Salva" }).click();
        await page.getByRole("cell", { name: "Piatto fondo" }).waitFor({ timeout: 8_000 });
        const cookie = await page.evaluate(() => document.cookie);
        assert.doesNotMatch(cookie, /fenix_session/);
        await shot(page, "fullstack-D.png");

        await page.setViewportSize({ width: 768, height: 1024 });
        await page.getByRole("heading", { name: "Argilla Viva" }).waitFor();
        await shot(page, "fullstack-T.png");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole("heading", { name: "Argilla Viva" }).waitFor();
        await shot(page, "fullstack-M.png");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert.ok(overflow <= 1, `mobile overflow ${overflow}`);
        const focus = await page.evaluate(() => {
          const btn = document.querySelector("#create button[type=submit]") as HTMLButtonElement | null;
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
        assert.ok(focus.width >= 44 && focus.height >= 44);
        assert.match(focus.outline, /rgb|#[0-9a-f]|solid|f2c6a6/i);
        const filtered = noise.filter(
          (entry) => !/favicon|Download the React DevTools|net::ERR/i.test(entry),
        );
        assert.deepEqual(filtered, []);
        const manifest = ["fullstack-D.png", "fullstack-T.png", "fullstack-M.png"].map((name) => {
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
        await page.close();
      } finally {
        await browser.close();
      }
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit").catch(() => undefined);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("recovers an account on D/T/M without leaking the token to the browser", async () => {
    const fixture = FULLSTACK_FIXTURES[0]!;
    const root = mkdtempSync(join(tmpdir(), "fenix-recovery-ui-"));
    const dbPath = join(root, "data.sqlite");
    writeTree(root, materializeFullstackProject(fixture));
    const shotDir =
      process.env.FENIX_SCORECARD_OUT ||
      (existsSync("/workspace")
        ? "/workspace/screenshots/fase3-recovery"
        : join(process.cwd(), "screenshots/fase3-recovery"));
    const fixtureDir = join(here, "fixtures/shots/fase3-recovery");
    const child = spawn(process.execPath, ["backend/server.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: "0",
        FENIX_DB_PATH: dbPath,
        FENIX_ALLOWED_ORIGIN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const [chunk] = (await Promise.race([
        once(child.stdout!, "data"),
        once(child, "exit").then(([code]) => {
          throw new Error(`recovery ui server exited ${code}`);
        }),
      ])) as [Buffer];
      const ready = JSON.parse(chunk.toString("utf8").trim().split("\n")[0]!);
      const base = `http://127.0.0.1:${ready.port}`;
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const noise: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") noise.push(msg.text());
        });
        page.on("pageerror", (error) => noise.push(String(error)));
        await page.goto(base, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.getByRole("heading", { name: "Argilla Viva" }).waitFor({ timeout: 8_000 });
        await page.getByLabel("Email").fill("recupero@fenix.test");
        await page.getByLabel("Password", { exact: true }).fill("forno argilla viva");
        await page.getByRole("button", { name: "Crea account" }).click();
        await page.getByText("Sei recupero@fenix.test").waitFor({ timeout: 10_000 });
        await page.getByRole("button", { name: "Esci" }).click();
        await page.getByRole("button", { name: "Recupera accesso" }).waitFor({ timeout: 8_000 });
        await page.getByRole("button", { name: "Recupera accesso" }).click();
        await page.getByLabel("Indirizzo da recuperare").waitFor({ timeout: 8_000 });
        mkdirSync(shotDir, { recursive: true });
        mkdirSync(fixtureDir, { recursive: true });
        const snap = async (name: string) => {
          const path = join(shotDir, name);
          try {
            await page.screenshot({ path, fullPage: false });
            writeFileSync(join(fixtureDir, name), readFileSync(path));
          } catch {
            /* CI without the scorecard dir is fine */
          }
        };
        await snap("recovery-D.png");
        await page.getByLabel("Indirizzo da recuperare").fill("recupero@fenix.test");
        await page.getByRole("button", { name: "Invia recupero" }).click();
        await page.getByText("Se l'account esiste, il codice è stato inviato.").waitFor({ timeout: 10_000 });
        await page.getByLabel("Codice di recupero").waitFor({ timeout: 8_000 });
        await page.setViewportSize({ width: 768, height: 1024 });
        await snap("recovery-T.png");
        const stored = await page.evaluate(() => ({
          cookie: document.cookie,
          local: Object.keys(localStorage),
          session: Object.keys(sessionStorage),
          html: document.documentElement.innerHTML,
        }));
        assert.doesNotMatch(stored.cookie, /fenix_session|token=/i);
        assert.deepEqual(stored.local, []);
        assert.deepEqual(stored.session, []);
        const db = new DatabaseSync(dbPath);
        const outbox = db
          .prepare("SELECT payload FROM _fenix_outbox WHERE kind=? ORDER BY created_at")
          .all("password_reset") as Array<{ payload: string }>;
        db.close();
        assert.equal(outbox.length, 1);
        const token = (JSON.parse(outbox[0]!.payload) as { token: string }).token;
        assert.match(token, /^[A-Za-z0-9_-]{32,}$/);
        assert.doesNotMatch(stored.html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        await page.getByLabel("Codice di recupero").fill(token);
        await page.getByLabel("Nuova chiave").fill("nuova chiave argilla");
        await page.getByRole("button", { name: "Conferma password" }).click();
        await page.getByText("Password aggiornata. Accedi.").waitFor({ timeout: 10_000 });
        const after = await page.evaluate(() => ({
          local: Object.keys(localStorage),
          tokenValue: (document.getElementById("reset-token") as HTMLInputElement | null)?.value || "",
        }));
        assert.deepEqual(after.local, []);
        assert.equal(after.tokenValue, "");
        await page.setViewportSize({ width: 390, height: 844 });
        await snap("recovery-M.png");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert.ok(overflow <= 1, `mobile overflow ${overflow}`);
        const focus = await page.evaluate(() => {
          const btn = document.querySelector("#auth button[type=submit]") as HTMLButtonElement | null;
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
        assert.ok(focus.width >= 44 && focus.height >= 44);
        assert.match(focus.outline, /rgb|#[0-9a-f]|solid|f2c6a6/i);
        await page.getByLabel("Email").fill("recupero@fenix.test");
        await page.getByLabel("Password", { exact: true }).fill("nuova chiave argilla");
        await page.getByRole("button", { name: "Entra" }).click();
        await page.getByText("Sei recupero@fenix.test").waitFor({ timeout: 10_000 });
        const filtered = noise.filter(
          (entry) => !/favicon|Download the React DevTools|net::ERR/i.test(entry),
        );
        assert.deepEqual(filtered, []);
        const manifest = ["recovery-D.png", "recovery-T.png", "recovery-M.png"].map((name) => {
          const file = join(fixtureDir, name);
          const bytes = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
          return {
            name,
            sha256: bytes.length ? createHash("sha256").update(bytes).digest("hex") : "",
            bytes: bytes.length,
          };
        });
        writeFileSync(
          join(fixtureDir, "manifest.json"),
          `${JSON.stringify({ generatedAt: new Date().toISOString(), shots: manifest }, null, 2)}\n`,
        );
        await page.close();
      } finally {
        await browser.close();
      }
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit").catch(() => undefined);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("completes passwordless magic-link and OTP on D/T/M without leaking secrets", async () => {
    const fixture = FULLSTACK_FIXTURES[0]!;
    const root = mkdtempSync(join(tmpdir(), "fenix-passwordless-ui-"));
    const dbPath = join(root, "data.sqlite");
    writeTree(root, materializeFullstackProject(fixture));
    const shotDir =
      process.env.FENIX_SCORECARD_OUT ||
      (existsSync("/workspace")
        ? "/workspace/screenshots/fase3-passwordless"
        : join(process.cwd(), "screenshots/fase3-passwordless"));
    const fixtureDir = join(here, "fixtures/shots/fase3-passwordless");
    const child = spawn(process.execPath, ["backend/server.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: "0",
        FENIX_DB_PATH: dbPath,
        FENIX_ALLOWED_ORIGIN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const [chunk] = (await Promise.race([
        once(child.stdout!, "data"),
        once(child, "exit").then(([code]) => {
          throw new Error(`passwordless ui server exited ${code}`);
        }),
      ])) as [Buffer];
      const ready = JSON.parse(chunk.toString("utf8").trim().split("\n")[0]!);
      const base = `http://127.0.0.1:${ready.port}`;
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const noise: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") noise.push(msg.text());
        });
        page.on("pageerror", (error) => noise.push(String(error)));
        await page.goto(base, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.getByRole("heading", { name: "Argilla Viva" }).waitFor({ timeout: 8_000 });
        await page.getByLabel("Email").fill("senza.password@fenix.test");
        await page.getByLabel("Password", { exact: true }).fill("forno argilla viva");
        await page.getByRole("button", { name: "Crea account" }).click();
        await page.getByText("Sei senza.password@fenix.test").waitFor({ timeout: 10_000 });
        await page.getByRole("button", { name: "Esci" }).click();
        await page.getByRole("button", { name: "Accedi senza password" }).waitFor({ timeout: 8_000 });
        await page.getByRole("button", { name: "Accedi senza password" }).click();
        await page.getByLabel("Indirizzo senza password").waitFor({ timeout: 8_000 });
        mkdirSync(shotDir, { recursive: true });
        mkdirSync(fixtureDir, { recursive: true });
        const snap = async (name: string) => {
          const path = join(shotDir, name);
          try {
            await page.screenshot({ path, fullPage: false });
            writeFileSync(join(fixtureDir, name), readFileSync(path));
          } catch {
            /* CI without the scorecard dir is fine */
          }
        };
        await snap("passwordless-D.png");
        await page.getByLabel("Indirizzo senza password").fill("senza.password@fenix.test");
        await page.getByRole("button", { name: "Invia codice" }).click();
        await page
          .getByText("Se l'account esiste, il codice a 8 cifre è stato inviato.")
          .waitFor({ timeout: 10_000 });
        await page.getByLabel("Codice a 8 cifre").waitFor({ timeout: 8_000 });
        await page.setViewportSize({ width: 768, height: 1024 });
        await snap("passwordless-T.png");
        const stored = await page.evaluate(() => ({
          cookie: document.cookie,
          local: Object.keys(localStorage),
          session: Object.keys(sessionStorage),
          html: document.documentElement.innerHTML,
        }));
        assert.doesNotMatch(stored.cookie, /fenix_session|token=/i);
        assert.deepEqual(stored.local, []);
        assert.deepEqual(stored.session, []);
        const db = new DatabaseSync(dbPath);
        const otpRows = db
          .prepare("SELECT payload FROM _fenix_outbox WHERE kind=? ORDER BY created_at")
          .all("passwordless_otp") as Array<{ payload: string }>;
        db.close();
        assert.equal(otpRows.length, 1);
        const otp = (JSON.parse(otpRows[0]!.payload) as { otp: string }).otp;
        assert.match(otp, /^\d{8}$/);
        assert.doesNotMatch(stored.html, new RegExp(otp));
        await page.getByLabel("Codice a 8 cifre").fill(otp);
        await page.getByRole("button", { name: "Completa accesso" }).click();
        await page.getByText("Sei senza.password@fenix.test").waitFor({ timeout: 10_000 });
        const cookie = await page.evaluate(() => document.cookie);
        assert.doesNotMatch(cookie, /fenix_session/);
        await page.getByRole("button", { name: "Esci" }).click();
        await page.getByRole("button", { name: "Accedi senza password" }).click();
        await page.getByLabel("Indirizzo senza password").fill("senza.password@fenix.test");
        await page.getByRole("button", { name: "Invia link magico" }).click();
        await page
          .getByText("Se l'account esiste, il link magico è stato inviato.")
          .waitFor({ timeout: 10_000 });
        const db2 = new DatabaseSync(dbPath);
        const magicRows = db2
          .prepare("SELECT payload FROM _fenix_outbox WHERE kind=? ORDER BY created_at")
          .all("passwordless_magic") as Array<{ payload: string }>;
        db2.close();
        assert.equal(magicRows.length, 1);
        const token = (JSON.parse(magicRows[0]!.payload) as { token: string }).token;
        assert.match(token, /^[A-Za-z0-9_-]{32,}$/);
        await page.getByLabel("Link magico").fill(token);
        await page.getByRole("button", { name: "Completa accesso" }).click();
        await page.getByText("Sei senza.password@fenix.test").waitFor({ timeout: 10_000 });
        await page.setViewportSize({ width: 390, height: 844 });
        await snap("passwordless-M.png");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert.ok(overflow <= 1, `mobile overflow ${overflow}`);
        const focus = await page.evaluate(() => {
          const btn = document.querySelector("#create button[type=submit]") as HTMLButtonElement | null;
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
        assert.ok(focus.width >= 44 && focus.height >= 44);
        assert.match(focus.outline, /rgb|#[0-9a-f]|solid|f2c6a6/i);
        const filtered = noise.filter(
          (entry) => !/favicon|Download the React DevTools|net::ERR/i.test(entry),
        );
        assert.deepEqual(filtered, []);
        const manifest = ["passwordless-D.png", "passwordless-T.png", "passwordless-M.png"].map((name) => {
          const file = join(fixtureDir, name);
          const bytes = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
          return {
            name,
            sha256: bytes.length ? createHash("sha256").update(bytes).digest("hex") : "",
            bytes: bytes.length,
          };
        });
        writeFileSync(
          join(fixtureDir, "manifest.json"),
          `${JSON.stringify({ generatedAt: new Date().toISOString(), shots: manifest }, null, 2)}\n`,
        );
        await page.close();
      } finally {
        await browser.close();
      }
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit").catch(() => undefined);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
