import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
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
        await page.getByLabel("Password").fill("forno argilla viva");
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
});
