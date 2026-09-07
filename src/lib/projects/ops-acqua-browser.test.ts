import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { formatPrefix } from "./infer.ts";
import { composeProduct } from "../ai/compose-product.ts";
import { hydratePortableBackendFiles } from "./portable-backend.ts";
import { launchChromium } from "./playwright-harness.ts";

const WATER_BRIEF =
  formatPrefix("app") +
  "Crea un'app per registrare l'acqua utilizzata dai dipendenti. Servono login, ruoli amministratore e dipendente, luoghi di lavoro, registrazioni con litri, data, turno e nota, storico filtrabile e statistiche. L'amministratore vede tutto; ogni dipendente vede e gestisce solo le proprie registrazioni. I dati devono essere condivisi tra dispositivi e restare disponibili dopo logout e ricaricamento.";

function writeTree(root: string, files: { path: string; content: string }[]) {
  for (const file of files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
}

async function startGenerated() {
  const composed = composeProduct(WATER_BRIEF);
  const hydrated = hydratePortableBackendFiles(composed.files);
  assert.equal(hydrated.errors.length, 0);
  const root = mkdtempSync(join(tmpdir(), "fenix-acqua-ops-"));
  writeTree(root, hydrated.files);
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
  const [chunk] = (await Promise.race([
    once(child.stdout!, "data"),
    once(child, "exit").then(([code]) => {
      throw new Error(`acqua ops server exited ${code}`);
    }),
  ])) as [Buffer];
  const ready = JSON.parse(chunk.toString("utf8").trim().split("\n")[0]!);
  return {
    root,
    child,
    base: `http://127.0.0.1:${ready.port}`,
    async close() {
      if (child.exitCode === null) child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit").catch(() => undefined);
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function cookieValue(res: Response, name: string) {
  const header = res.headers.get("set-cookie") || "";
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

async function signup(base: string, email: string, password: string) {
  const res = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { res, session: cookieValue(res, "fenix_session"), body: await res.json() };
}

describe("generated water ops app from Fenix compose", () => {
  it("stores hashed passwords and rejects member writes on another employee's rows", async () => {
    const runtime = await startGenerated();
    try {
      const admin = await signup(runtime.base, "admin@acqua.test", "serbatoio acqua 12");
      assert.equal(admin.res.status, 201);
      assert.equal(admin.body.role, "admin");
      const luogo = await fetch(`${runtime.base}/api/luoghi`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `fenix_session=${admin.session}` },
        body: JSON.stringify({ nome: "Deposito nord", note: "" }),
      });
      assert.equal(luogo.status, 201);
      const created = await fetch(`${runtime.base}/api/registrazioni`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `fenix_session=${admin.session}` },
        body: JSON.stringify({ litri: 120, data: "2026-09-07", turno: "Mattina", nota: "Prima botte", luogo: "Deposito nord" }),
      });
      assert.equal(created.status, 201);
      const adminRow = (await created.json()) as { id: string; version: number; nota: string };

      const member = await signup(runtime.base, "anna@acqua.test", "chiave dipendente");
      assert.equal(member.res.status, 201);
      assert.equal(member.body.role, "member");
      const memberList = await fetch(`${runtime.base}/api/registrazioni`, {
        headers: { cookie: `fenix_session=${member.session}` },
      });
      const listed = (await memberList.json()) as { items: unknown[] };
      assert.deepEqual(listed.items, []);
      assert.equal(
        (
          await fetch(`${runtime.base}/api/registrazioni/${adminRow.id}`, {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              "if-match": String(adminRow.version || 1),
              cookie: `fenix_session=${member.session}`,
            },
            body: JSON.stringify({ litri: 1, data: "2026-09-07", turno: "Notte", nota: "intruso" }),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${runtime.base}/api/registrazioni/${adminRow.id}`, {
            method: "DELETE",
            headers: { "if-match": String(adminRow.version || 1), cookie: `fenix_session=${member.session}` },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${runtime.base}/api/luoghi`, {
            method: "POST",
            headers: { "content-type": "application/json", cookie: `fenix_session=${member.session}` },
            body: JSON.stringify({ nome: "Luogo vietato" }),
          })
        ).status,
        403,
      );
      const db = new DatabaseSync(join(runtime.root, "data.sqlite"));
      try {
        const hashes = db.prepare("SELECT email,password_hash FROM _fenix_users WHERE email LIKE '%acqua.test'").all() as Array<{
          email: string;
          password_hash: string;
        }>;
        assert.equal(hashes.length, 2);
        for (const row of hashes) {
          assert.match(row.password_hash, /^[a-f0-9]+:[a-f0-9]+$/);
          assert.doesNotMatch(row.password_hash, /serbatoio|chiave dipendente|acqua 12/);
        }
        const rows = db.prepare("SELECT data FROM registrazioni").all() as Array<{ data: string }>;
        assert.deepEqual(rows.map((row) => JSON.parse(row.data).nota), ["Prima botte"]);
      } finally {
        db.close();
      }
    } finally {
      await runtime.close();
    }
  });

  it("logs in, records liters, persists, edits, deletes, and isolates two employees", async () => {
    const runtime = await startGenerated();
    const browser = await launchChromium();
    try {
      const admin = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await admin.goto(runtime.base, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await admin.getByRole("heading", { name: "Entra in squadra" }).waitFor({ timeout: 10_000 });
      await admin.getByLabel("Email").fill("admin@acqua.test");
      await admin.getByLabel("Password").fill("serbatoio acqua 12");
      await admin.getByRole("button", { name: "Crea account" }).click();
      await admin.locator(".fx-hello").waitFor({ timeout: 10_000 });
      await admin.locator(".fx-role").getByText("Amministratore").waitFor();

      await admin.getByRole("button", { name: "Gestione" }).click();
      await admin.getByRole("button", { name: "Luoghi" }).click();
      await admin.getByLabel("Nuovo luogo").fill("Deposito nord");
      await admin.getByRole("button", { name: "Aggiungi luogo" }).click();
      await admin.getByRole("heading", { name: "Deposito nord" }).waitFor({ timeout: 8_000 });

      await admin.getByRole("button", { name: "Registra", exact: true }).click();
      await admin.getByLabel("Litri").fill("120");
      await admin.getByLabel("Nota").fill("Prima botte");
      await admin.getByRole("button", { name: "Registra in campo" }).click();
      await admin.locator(".fx-record").filter({ hasText: "Prima botte" }).waitFor({ timeout: 8_000 });
      await admin.locator(".fx-record").filter({ hasText: "120 L" }).waitFor();

      await admin.reload({ waitUntil: "domcontentloaded" });
      await admin.locator(".fx-hello").waitFor({ timeout: 10_000 });
      await admin.getByRole("button", { name: "Storico" }).click();
      await admin.locator(".fx-record").filter({ hasText: "Prima botte" }).waitFor({ timeout: 10_000 });

      await admin.locator(".fx-record").filter({ hasText: "Prima botte" }).getByRole("button", { name: "Modifica" }).click();
      await admin.getByLabel("Litri").fill("150");
      await admin.getByLabel("Nota").fill("Botte aggiornata");
      await admin.getByRole("button", { name: "Salva modifiche" }).click();
      await admin.locator(".fx-record").filter({ hasText: "Botte aggiornata" }).waitFor({ timeout: 8_000 });
      await admin.locator(".fx-record").filter({ hasText: "150 L" }).waitFor();

      const member = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await member.goto(runtime.base, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await member.getByRole("heading", { name: "Entra in squadra" }).waitFor({ timeout: 10_000 });
      await member.getByLabel("Email").fill("anna@acqua.test");
      await member.getByLabel("Password").fill("chiave dipendente");
      await member.getByRole("button", { name: "Crea account" }).click();
      await member.locator(".fx-hello").waitFor({ timeout: 10_000 });
      await member.locator(".fx-role").getByText("Dipendente").waitFor();
      await member.getByRole("button", { name: "Storico" }).click();
      await member.getByText("Nessuna voce in elenco").waitFor({ timeout: 8_000 });

      await member.getByRole("button", { name: "Registra", exact: true }).click();
      await member.getByLabel("Litri").fill("40");
      await member.getByLabel("Nota").fill("Turno Anna");
      await member.getByRole("button", { name: "Registra in campo" }).click();
      await member.locator(".fx-record").filter({ hasText: "Turno Anna" }).waitFor({ timeout: 8_000 });
      assert.equal(await member.locator(".fx-record").filter({ hasText: "Botte aggiornata" }).count(), 0);

      await admin.reload({ waitUntil: "domcontentloaded" });
      await admin.locator(".fx-hello").waitFor({ timeout: 10_000 });
      await admin.getByRole("button", { name: "Storico" }).click();
      await admin.locator(".fx-record").filter({ hasText: "Botte aggiornata" }).waitFor({ timeout: 10_000 });
      await admin.locator(".fx-record").filter({ hasText: "Turno Anna" }).waitFor();

      const memberCookies = await member.context().cookies(runtime.base);
      const session = memberCookies.find((cookie) => cookie.name === "fenix_session");
      assert.ok(session);
      const listed = await fetch(`${runtime.base}/api/registrazioni`, {
        headers: { cookie: `fenix_session=${session.value}` },
      });
      const body = (await listed.json()) as { items: Array<{ nota: string; id: string; version: number }> };
      assert.deepEqual(body.items.map((item) => item.nota), ["Turno Anna"]);
      const adminList = (await (
        await fetch(`${runtime.base}/api/registrazioni`, {
          headers: {
            cookie: (await admin.context().cookies(runtime.base))
              .filter((cookie) => cookie.name === "fenix_session")
              .map((cookie) => `${cookie.name}=${cookie.value}`)
              .join("; "),
          },
        })
      ).json()) as { items: Array<{ id: string; nota: string; version: number }> };
      const foreign = adminList.items.find((item) => item.nota === "Botte aggiornata");
      assert.ok(foreign);
      assert.equal(
        (
          await fetch(`${runtime.base}/api/registrazioni/${foreign.id}`, {
            method: "DELETE",
            headers: {
              cookie: `fenix_session=${session.value}`,
              "if-match": String(foreign.version || 1),
            },
          })
        ).status,
        403,
      );

      await admin.getByRole("button", { name: "Elimina" }).first().click();
      await admin.waitForTimeout(400);
      const db = new DatabaseSync(join(runtime.root, "data.sqlite"));
      try {
        const hashes = db.prepare("SELECT email,password_hash FROM _fenix_users WHERE email LIKE '%acqua.test'").all() as Array<{
          email: string;
          password_hash: string;
        }>;
        assert.equal(hashes.length, 2);
        for (const row of hashes) {
          assert.match(row.password_hash, /^[a-f0-9]+:[a-f0-9]+$/);
          assert.doesNotMatch(row.password_hash, /serbatoio|chiave dipendente|acqua 12/);
        }
      } finally {
        db.close();
      }
    } finally {
      await browser.close();
      await runtime.close();
    }
  });
});
