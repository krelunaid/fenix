import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { contractInstruction, evaluateContract, planContract } from "../ai/build-contract.ts";
import { APP_COMPONENTS } from "./fixtures/trees.ts";
import { ingestProjectFiles, parseProjectFiles } from "./files.ts";
import {
  hydratePortableBackendFiles,
  materializePortableBackend,
  PORTABLE_BACKEND_MANIFEST,
  PORTABLE_BACKEND_VERSION,
  PORTABLE_DEPLOY_MANIFEST,
  PORTABLE_SCHEMA_VERSION,
  portableBackendMigrations,
  validatePortableBackendSpec,
  type PortableBackendSpec,
} from "./portable-backend.ts";
import { FULLSTACK_FIXTURES, materializeFullstackProject } from "./portable-fullstack.ts";
import { unzipProject, zipProject } from "./zip.ts";

const SPEC: PortableBackendSpec = {
  collections: [
    {
      name: "tasks",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "done", type: "boolean", required: true },
        { name: "priority", type: "integer" },
      ],
    },
  ],
};

function headers(extra: Record<string, string> = {}) {
  return { authorization: "Bearer test-token", "content-type": "application/json", ...extra };
}

function sessionHeaders(cookie: string, extra: Record<string, string> = {}) {
  return {
    cookie,
    origin: "https://app.example",
    "content-type": "application/json",
    ...extra,
  };
}

function cookieFrom(response: Response) {
  const value = response.headers.get("set-cookie") || "";
  assert.match(value, /^fenix_session=[^;]+;/);
  assert.match(value, /HttpOnly/);
  assert.match(value, /SameSite=Strict/);
  assert.match(value, /Secure/);
  return value.split(";", 1)[0];
}

function writeTree(root: string, files: { path: string; content: string }[]) {
  for (const file of files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
}

async function startTree(
  files: { path: string; content: string }[],
  env: Record<string, string> = {},
  opts: { expectFail?: boolean } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "fenix-portable-backend-"));
  writeTree(root, files);
  const stderrChunks: Buffer[] = [];
  const stdoutChunks: Buffer[] = [];
  const child = spawn(process.execPath, ["backend/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "0",
      FENIX_API_TOKEN: "test-token",
      FENIX_DB_PATH: join(root, "data.sqlite"),
      FENIX_ALLOWED_ORIGIN: "https://app.example",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr!.on("data", (chunk) => stderrChunks.push(chunk as Buffer));
  child.stdout!.on("data", (chunk) => stdoutChunks.push(chunk as Buffer));
  const logs = () =>
    `${Buffer.concat(stdoutChunks).toString("utf8")}\n${Buffer.concat(stderrChunks).toString("utf8")}`;
  if (opts.expectFail) {
    const outcome = await Promise.race([
      once(child, "exit").then(([code]) => ({ kind: "exit" as const, code: (code as number | null) ?? 1 })),
      once(child.stdout!, "data").then(() => ({ kind: "ready" as const, code: 0 })),
    ]);
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
    }
    return {
      root,
      child,
      base: "",
      ready: { ready: false, port: 0, schema: 0, origin: "same" },
      code: outcome.code,
      logs,
      async close() {
        rmSync(root, { recursive: true, force: true });
      },
    };
  }
  const [chunk] = (await Promise.race([
    once(child.stdout!, "data"),
    once(child, "exit").then(([code]) => {
      throw new Error(`backend exited ${code}: ${logs()}`);
    }),
  ])) as [Buffer];
  const ready = JSON.parse(chunk.toString("utf8").trim().split("\n")[0]!);
  assert.equal(ready.ready, true);
  assert.ok(Number.isInteger(ready.port) && ready.port > 0);
  return {
    root,
    child,
    base: `http://127.0.0.1:${ready.port}`,
    ready,
    code: 0,
    logs,
    async close() {
      if (child.exitCode === null) child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit");
      rmSync(root, { recursive: true, force: true });
    },
  };
}

async function startBackend() {
  return startTree(materializePortableBackend(SPEC));
}

function passwordRecord(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function readOutbox<T extends { user_id: string } = { user_id: string; token: string }>(
  dbPath: string,
  kind = "password_reset",
) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout=5000");
    return (
      db.prepare("SELECT payload FROM _fenix_outbox WHERE kind=? ORDER BY created_at").all(
        kind,
      ) as Array<{ payload: string }>
    ).map((row) => JSON.parse(row.payload) as T);
  } finally {
    db.close();
  }
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("portable generated backend", () => {
  it("validates schema names and exports only reproducible, secret-free files", () => {
    assert.deepEqual(validatePortableBackendSpec(SPEC), []);
    assert.ok(validatePortableBackendSpec({ collections: [] }).length > 0);
    assert.ok(
      validatePortableBackendSpec({
        collections: [{ name: "../tasks", fields: [{ name: "id", type: "text" }] }],
      }).length >= 1,
    );
    assert.ok(
      validatePortableBackendSpec({
        collections: [{ name: "tasks", fields: [{ name: "id", type: "text" }] }],
      }).some((error) => /Campo non valido/.test(error)),
    );
    const backend = materializePortableBackend(SPEC);
    const manifest = JSON.parse(
      backend.find((file) => file.path === PORTABLE_BACKEND_MANIFEST)!.content,
    );
    assert.equal(manifest.version, PORTABLE_BACKEND_VERSION);
    assert.equal(manifest.schemaVersion, PORTABLE_SCHEMA_VERSION);
    assert.equal(manifest.origin, "same");
    assert.equal(manifest.auth, "session-cookie+bearer-env");
    const deploy = JSON.parse(backend.find((file) => file.path === PORTABLE_DEPLOY_MANIFEST)!.content);
    assert.equal(deploy.origin, "same");
    assert.equal(deploy.health, "/health");
    assert.equal(deploy.start, "node backend/server.mjs");
    assert.ok(backend.some((file) => file.path === "backend/migrations/0001_init.sql"));
    assert.ok(backend.some((file) => file.path === "backend/migrations/0002_meta.sql"));
    assert.ok(backend.some((file) => file.path === "backend/migrations/0003_password_reset.sql"));
    assert.ok(backend.some((file) => file.path === "backend/migrations/0004_passwordless.sql"));
    const again = materializePortableBackend(SPEC);
    assert.equal(
      createHash("sha256").update(backend.find((file) => file.path === "backend/server.mjs")!.content).digest("hex"),
      createHash("sha256").update(again.find((file) => file.path === "backend/server.mjs")!.content).digest("hex"),
    );
    const tree = ingestProjectFiles([
      { path: "index.html", content: "<!doctype html><title>Tasks</title>" },
      ...backend,
    ]);
    assert.deepEqual(tree.rejected, []);
    assert.ok(tree.files.some((file) => file.path === "backend/server.mjs"));
    assert.ok(tree.files.some((file) => file.path === "backend/schema.sql"));
    assert.ok(tree.files.some((file) => file.path === PORTABLE_DEPLOY_MANIFEST));
    assert.doesNotMatch(JSON.stringify(tree.files), /test-token|DATABASE_URL=|PRIVATE KEY|xai-/);
    const round = unzipProject(zipProject(tree.files, { kind: "dashboard" }));
    assert.equal(
      round.files.find((file) => file.path === "backend/server.mjs")?.content,
      backend.find((file) => file.path === "backend/server.mjs")?.content,
    );
    const hydrated = hydratePortableBackendFiles([
      { path: PORTABLE_BACKEND_MANIFEST, content: JSON.stringify(SPEC) },
      { path: "backend/server.mjs", content: "throw new Error('untrusted')" },
      { path: "package.json", content: '{"name":"evil"}' },
      { path: "backend/migrations/0009_evil.sql", content: "DROP TABLE _fenix_users;" },
    ]);
    assert.deepEqual(hydrated.errors, []);
    assert.doesNotMatch(
      hydrated.files.find((file) => file.path === "backend/server.mjs")!.content,
      /untrusted/,
    );
    assert.doesNotMatch(hydrated.files.find((file) => file.path === "package.json")!.content, /evil/);
    assert.equal(
      hydrated.files.some((file) => file.path === "backend/migrations/0009_evil.sql"),
      false,
    );
    const parsed = parseProjectFiles(
      `<<<FILE path="${PORTABLE_BACKEND_MANIFEST}">>>\n${JSON.stringify(SPEC)}\n<<<END>>>`,
    );
    assert.ok(parsed.some((file) => file.path === "backend/server.mjs"));
    assert.ok(parsed.some((file) => file.path === "backend/schema.sql"));
    assert.ok(parsed.some((file) => file.path === "backend/migrations/0001_init.sql"));
    assert.ok(parsed.some((file) => file.path === PORTABLE_DEPLOY_MANIFEST));
  });

  it("is requested only by an explicit full-stack brief and blocks invalid manifests", () => {
    const local = planContract("kind=app registro locale");
    assert.equal(local.files.includes(PORTABLE_BACKEND_MANIFEST), false);
    const contract = planContract("kind=app gestionale full-stack con backend e API REST");
    assert.equal(contract.files.includes(PORTABLE_BACKEND_MANIFEST), true);
    assert.match(contractInstruction(contract), /materializza server Node\+SQLite/);
    assert.match(contractInstruction(contract), /stessa origine/);
    const html = APP_COMPONENTS.find((file) => file.path === "index.html")!.content;
    const valid = evaluateContract({
      html,
      contract,
      kind: "app",
      files: [{ path: PORTABLE_BACKEND_MANIFEST, content: JSON.stringify(SPEC) }],
    });
    assert.equal(valid.checks.find((check) => check.id === "backend")?.ok, true);
    const invalid = evaluateContract({
      html,
      contract,
      kind: "app",
      files: [{ path: PORTABLE_BACKEND_MANIFEST, content: '{"collections":[]}' }],
    });
    assert.equal(invalid.checks.find((check) => check.id === "backend")?.ok, false);
    assert.equal(invalid.ok, false);
  });

  it("runs a real Node+SQLite CRUD API with auth, validation, CAS and concurrent writes", async () => {
    const runtime = await startBackend();
    try {
      const health = await fetch(`${runtime.base}/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), {
        ok: true,
        service: "fenix-backend",
        version: PORTABLE_BACKEND_VERSION,
        schema: PORTABLE_SCHEMA_VERSION,
        origin: "same",
      });
      assert.equal(runtime.ready.schema, PORTABLE_SCHEMA_VERSION);
      assert.equal(runtime.ready.origin, "same");

      assert.equal((await fetch(`${runtime.base}/api/tasks`)).status, 401);
      const preflight = await fetch(`${runtime.base}/api/tasks`, {
        method: "OPTIONS",
        headers: { origin: "https://app.example" },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), "https://app.example");
      assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
      assert.equal(
        (
          await fetch(`${runtime.base}/api/tasks`, {
            method: "POST",
            headers: headers({ origin: "https://evil.example" }),
            body: JSON.stringify({ title: "No", done: false }),
          })
        ).status,
        403,
      );
      const invalid = await fetch(`${runtime.base}/api/tasks`, {
        method: "POST",
        headers: headers({ origin: "https://app.example" }),
        body: JSON.stringify({ done: "no" }),
      });
      assert.equal(invalid.status, 400);

      const createdResponse = await fetch(`${runtime.base}/api/tasks`, {
        method: "POST",
        headers: headers({ origin: "https://app.example" }),
        body: JSON.stringify({ title: "Prima", done: false, priority: 1 }),
      });
      assert.equal(createdResponse.status, 201);
      const created = (await createdResponse.json()) as { id: string; version: number };
      assert.equal(created.version, 1);

      const stale = await fetch(`${runtime.base}/api/tasks/${created.id}`, {
        method: "PUT",
        headers: headers({ "if-match": "99" }),
        body: JSON.stringify({ title: "Stale", done: true }),
      });
      assert.equal(stale.status, 409);
      const updatedResponse = await fetch(`${runtime.base}/api/tasks/${created.id}`, {
        method: "PUT",
        headers: headers({ "if-match": "1" }),
        body: JSON.stringify({ title: "Aggiornata", done: true, priority: 2 }),
      });
      assert.equal(updatedResponse.status, 200);
      const updated = (await updatedResponse.json()) as { title: string; version: number };
      assert.equal(updated.title, "Aggiornata");
      assert.equal(updated.version, 2);

      const burst = await Promise.all(
        Array.from({ length: 16 }, (_, index) =>
          fetch(`${runtime.base}/api/tasks`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ title: `Task ${index}`, done: false, priority: index }),
          }),
        ),
      );
      assert.ok(burst.every((response) => response.status === 201));
      const list = await fetch(`${runtime.base}/api/tasks?limit=100`, { headers: headers() });
      const payload = (await list.json()) as { items: unknown[] };
      assert.equal(payload.items.length, 17);
      assert.equal(
        (
          await fetch(`${runtime.base}/api/tasks?limit=not-a-number`, { headers: headers() })
        ).status,
        200,
      );

      const removed = await fetch(`${runtime.base}/api/tasks/${created.id}`, {
        method: "DELETE",
        headers: headers({ "if-match": "2" }),
      });
      assert.equal(removed.status, 200);
      assert.equal(
        (await fetch(`${runtime.base}/api/tasks/${created.id}`, { headers: headers() })).status,
        404,
      );
      assert.doesNotMatch(runtime.logs(), /test-token|xai-|PRIVATE KEY|password_hash/i);
    } finally {
      await runtime.close();
    }
  });

  it("resets passwords with an enumeration-safe one-shot token and isolates two users", async () => {
    const runtime = await startBackend();
    const dbPath = join(runtime.root, "data.sqlite");
    const origin = { origin: "https://app.example", "content-type": "application/json" };
    const passOne = "correct horse battery staple";
    const passTwo = "another secure password";
    const passNew = "nuova chiave argilla viva";
    try {
      const signupOne = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: "one@example.test", password: passOne }),
      });
      assert.equal(signupOne.status, 201);
      const cookieOne = cookieFrom(signupOne);
      const signupOneBody = (await signupOne.json()) as { id: string; email: string };

      const signupTwo = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: "two@example.test", password: passTwo }),
      });
      assert.equal(signupTwo.status, 201);
      const cookieTwo = cookieFrom(signupTwo);
      const signupTwoBody = (await signupTwo.json()) as { id: string };

      assert.equal(
        (
          await fetch(`${runtime.base}/api/tasks`, {
            method: "POST",
            headers: sessionHeaders(cookieOne),
            body: JSON.stringify({ title: "Crudo uno", done: false, priority: 1 }),
          })
        ).status,
        201,
      );

      const recover = (email: string) =>
        fetch(`${runtime.base}/auth/recover`, {
          method: "POST",
          headers: origin,
          body: JSON.stringify({ email }),
        });
      const reset = (token: string, password: string) =>
        fetch(`${runtime.base}/auth/reset`, {
          method: "POST",
          headers: origin,
          body: JSON.stringify({ token, password }),
        });

      const unknown = await recover("missing@example.test");
      const known = await recover("one@example.test");
      assert.equal(unknown.status, 200);
      assert.equal(known.status, 200);
      assert.deepEqual(await unknown.json(), { ok: true });
      assert.deepEqual(await known.json(), { ok: true });
      assert.equal(unknown.headers.get("set-cookie"), null);
      assert.equal(known.headers.get("set-cookie"), null);
      assert.equal((await fetch(`${runtime.base}/auth/outbox`)).status, 404);
      assert.equal((await fetch(`${runtime.base}/api/_fenix_outbox`)).status, 401);
      assert.equal(
        (
          await fetch(`${runtime.base}/api/_fenix_outbox`, { headers: sessionHeaders(cookieOne) })
        ).status,
        404,
      );

      let box = readOutbox(dbPath);
      assert.equal(box.length, 1);
      assert.equal(box[0]?.user_id, signupOneBody.id);
      const staleOne = box[0]!.token;
      assert.match(staleOne, /^[A-Za-z0-9_-]{32,}$/);
      assert.equal(staleOne.includes("@"), false);

      const secondOne = await recover("one@example.test");
      assert.equal(secondOne.status, 200);
      const twoRecover = await recover("two@example.test");
      assert.equal(twoRecover.status, 200);
      box = readOutbox(dbPath);
      assert.equal(box.length, 3);
      const tokenOne = box.filter((row) => row.user_id === signupOneBody.id).at(-1)!.token;
      const tokenTwo = box.find((row) => row.user_id === signupTwoBody.id)!.token;
      assert.notEqual(tokenOne, staleOne);
      assert.notEqual(tokenOne, tokenTwo);

      const stale = await reset(staleOne, passNew);
      assert.equal(stale.status, 400);
      assert.deepEqual(await stale.json(), { error: "Token non valido" });
      const wrong = await reset("totally-invalid-token-value", passNew);
      assert.equal(wrong.status, 400);
      assert.deepEqual(await wrong.json(), { error: "Token non valido" });

      const burst = await Promise.all(Array.from({ length: 8 }, () => reset(tokenOne, passNew)));
      const statuses = burst.map((response) => response.status);
      assert.equal(statuses.filter((status) => status === 200).length, 1);
      assert.equal(statuses.filter((status) => status === 400).length, 7);
      const winner = burst.find((response) => response.status === 200)!;
      assert.deepEqual(await winner.json(), { ok: true });
      assert.equal(winner.headers.get("set-cookie"), null);

      assert.equal(
        (await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieOne) })).status,
        401,
      );
      assert.equal(
        (await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieTwo) })).status,
        200,
      );
      assert.equal(
        (
          await fetch(`${runtime.base}/auth/login`, {
            method: "POST",
            headers: origin,
            body: JSON.stringify({ email: "one@example.test", password: passOne }),
          })
        ).status,
        401,
      );
      const relogin = await fetch(`${runtime.base}/auth/login`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: "one@example.test", password: passNew }),
      });
      assert.equal(relogin.status, 200);
      const cookieOneNext = cookieFrom(relogin);
      const list = (await (
        await fetch(`${runtime.base}/api/tasks`, { headers: sessionHeaders(cookieOneNext) })
      ).json()) as { items: Array<{ title: string }> };
      assert.deepEqual(
        list.items.map((item) => item.title),
        ["Crudo uno"],
      );
      assert.equal(
        (
          await fetch(`${runtime.base}/auth/login`, {
            method: "POST",
            headers: origin,
            body: JSON.stringify({ email: "two@example.test", password: passTwo }),
          })
        ).status,
        200,
      );
      const replay = await reset(tokenOne, "altra password lunga");
      assert.equal(replay.status, 400);
      assert.deepEqual(await replay.json(), { error: "Token non valido" });

      const expiredRaw = randomBytes(32).toString("base64url");
      const probe = new DatabaseSync(dbPath);
      probe
        .prepare(
          "INSERT INTO _fenix_password_resets (token_hash,user_id,expires_at,used_at,created_at) VALUES (?,?,?,NULL,?)",
        )
        .run(
          createHash("sha256").update(expiredRaw).digest("hex"),
          signupTwoBody.id,
          new Date(Date.now() - 60_000).toISOString(),
          new Date().toISOString(),
        );
      probe.close();
      const expired = await reset(expiredRaw, passNew);
      assert.equal(expired.status, 400);
      assert.deepEqual(await expired.json(), { error: "Token non valido" });
      assert.equal(
        (
          await fetch(`${runtime.base}/auth/login`, {
            method: "POST",
            headers: origin,
            body: JSON.stringify({ email: "two@example.test", password: passTwo }),
          })
        ).status,
        200,
      );

      const thirdOne = await recover("one@example.test");
      assert.equal(thirdOne.status, 200);
      const fourth = await recover("one@example.test");
      assert.equal(fourth.status, 429);
      assert.deepEqual(await fourth.json(), { error: "Troppi tentativi" });

      const huge = await fetch(`${runtime.base}/auth/recover`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: `${"a".repeat(300_000)}@x.test` }),
      });
      assert.equal(huge.status, 413);

      const logs = runtime.logs();
      assert.doesNotMatch(logs, /one@example.test|two@example.test|missing@example.test/);
      assert.doesNotMatch(logs, /correct horse|nuova chiave|another secure|altra password/);
      assert.doesNotMatch(logs, /password_hash|token_hash|xai-|PRIVATE KEY/i);
      for (const row of readOutbox(dbPath)) {
        assert.doesNotMatch(logs, new RegExp(escapeRe(row.token!)));
        assert.equal("email" in row, false);
      }
    } finally {
      await runtime.close();
    }
  });

  it("signs in with enumeration-safe magic-link and OTP, isolating two users", async () => {
    const runtime = await startBackend();
    const dbPath = join(runtime.root, "data.sqlite");
    const origin = { origin: "https://app.example", "content-type": "application/json" };
    const passOne = "correct horse battery staple";
    const passTwo = "another secure password";
    try {
      const signupOne = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: "one@example.test", password: passOne }),
      });
      assert.equal(signupOne.status, 201);
      const cookieOne = cookieFrom(signupOne);
      const signupOneBody = (await signupOne.json()) as { id: string; email: string };
      const signupTwo = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: "two@example.test", password: passTwo }),
      });
      assert.equal(signupTwo.status, 201);
      const cookieTwo = cookieFrom(signupTwo);
      const signupTwoBody = (await signupTwo.json()) as { id: string };
      assert.equal(
        (
          await fetch(`${runtime.base}/api/tasks`, {
            method: "POST",
            headers: sessionHeaders(cookieOne),
            body: JSON.stringify({ title: "Crudo uno", done: false, priority: 1 }),
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await fetch(`${runtime.base}/api/tasks`, {
            method: "POST",
            headers: sessionHeaders(cookieTwo),
            body: JSON.stringify({ title: "Crudo due", done: true, priority: 2 }),
          })
        ).status,
        201,
      );

      const requestLink = (email: string, method: "magic" | "otp") =>
        fetch(`${runtime.base}/auth/passwordless`, {
          method: "POST",
          headers: origin,
          body: JSON.stringify({ email, method }),
        });
      const verifyMagic = (token: string) =>
        fetch(`${runtime.base}/auth/passwordless/verify`, {
          method: "POST",
          headers: origin,
          body: JSON.stringify({ token }),
        });
      const verifyOtp = (email: string, otp: string) =>
        fetch(`${runtime.base}/auth/passwordless/verify`, {
          method: "POST",
          headers: origin,
          body: JSON.stringify({ email, otp }),
        });

      const unknownMagic = await requestLink("missing@example.test", "magic");
      const unknownOtp = await requestLink("missing@example.test", "otp");
      assert.equal(unknownMagic.status, 200);
      assert.equal(unknownOtp.status, 200);
      assert.deepEqual(await unknownMagic.json(), { ok: true });
      assert.deepEqual(await unknownOtp.json(), { ok: true });
      assert.equal(unknownMagic.headers.get("set-cookie"), null);
      assert.equal(readOutbox(dbPath, "passwordless_magic").length, 0);
      assert.equal(readOutbox(dbPath, "passwordless_otp").length, 0);

      const badMethod = await requestLink("one@example.test", "sms" as "magic");
      assert.equal(badMethod.status, 400);

      const firstMagic = await requestLink("one@example.test", "magic");
      assert.equal(firstMagic.status, 200);
      assert.deepEqual(await firstMagic.json(), { ok: true });
      assert.equal(firstMagic.headers.get("set-cookie"), null);
      assert.equal((await fetch(`${runtime.base}/auth/outbox`)).status, 404);
      assert.equal((await fetch(`${runtime.base}/api/_fenix_outbox`)).status, 401);
      assert.equal(
        (
          await fetch(`${runtime.base}/api/_fenix_outbox`, { headers: sessionHeaders(cookieOne) })
        ).status,
        404,
      );

      let magics = readOutbox<{ user_id: string; token: string }>(dbPath, "passwordless_magic");
      assert.equal(magics.length, 1);
      assert.equal(magics[0]?.user_id, signupOneBody.id);
      const staleMagic = magics[0]!.token;
      assert.match(staleMagic, /^[A-Za-z0-9_-]{32,}$/);
      assert.equal("email" in magics[0]!, false);

      const secondMagic = await requestLink("one@example.test", "magic");
      assert.equal(secondMagic.status, 200);
      const twoOtpReq = await requestLink("two@example.test", "otp");
      assert.equal(twoOtpReq.status, 200);
      magics = readOutbox<{ user_id: string; token: string }>(dbPath, "passwordless_magic");
      const otps = readOutbox<{ user_id: string; otp: string }>(dbPath, "passwordless_otp");
      assert.equal(magics.length, 2);
      assert.equal(otps.length, 1);
      const tokenOne = magics.filter((row) => row.user_id === signupOneBody.id).at(-1)!.token;
      const otpTwo = otps.find((row) => row.user_id === signupTwoBody.id)!.otp;
      assert.notEqual(tokenOne, staleMagic);
      assert.match(otpTwo, /^\d{8}$/);

      const stale = await verifyMagic(staleMagic);
      assert.equal(stale.status, 400);
      assert.deepEqual(await stale.json(), { error: "Codice non valido" });
      const wrongMagic = await verifyMagic("totally-invalid-token-value");
      assert.equal(wrongMagic.status, 400);
      const wrongOtp = await verifyOtp("two@example.test", "00000000");
      assert.equal(wrongOtp.status, 400);
      const crossed = await verifyOtp("one@example.test", otpTwo);
      assert.equal(crossed.status, 400);

      const burst = await Promise.all(Array.from({ length: 8 }, () => verifyMagic(tokenOne)));
      const statuses = burst.map((response) => response.status);
      assert.equal(statuses.filter((status) => status === 200).length, 1);
      assert.equal(statuses.filter((status) => status === 400).length, 7);
      const winner = burst.find((response) => response.status === 200)!;
      const winnerBody = (await winner.json()) as { id: string; email: string };
      assert.equal(winnerBody.email, "one@example.test");
      assert.equal(winnerBody.id, signupOneBody.id);
      const cookieMagic = cookieFrom(winner);
      const meMagic = (await (
        await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieMagic) })
      ).json()) as { email: string };
      assert.equal(meMagic.email, "one@example.test");
      const listOne = (await (
        await fetch(`${runtime.base}/api/tasks`, { headers: sessionHeaders(cookieMagic) })
      ).json()) as { items: Array<{ title: string }> };
      assert.deepEqual(
        listOne.items.map((item) => item.title),
        ["Crudo uno"],
      );
      const replay = await verifyMagic(tokenOne);
      assert.equal(replay.status, 400);

      const otpOk = await verifyOtp("two@example.test", otpTwo);
      assert.equal(otpOk.status, 200);
      const cookieOtp = cookieFrom(otpOk);
      const meTwo = (await (
        await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieOtp) })
      ).json()) as { email: string };
      assert.equal(meTwo.email, "two@example.test");
      const listTwo = (await (
        await fetch(`${runtime.base}/api/tasks`, { headers: sessionHeaders(cookieOtp) })
      ).json()) as { items: Array<{ title: string }> };
      assert.deepEqual(
        listTwo.items.map((item) => item.title),
        ["Crudo due"],
      );
      assert.equal((await verifyOtp("two@example.test", otpTwo)).status, 400);

      const expiredRaw = randomBytes(32).toString("base64url");
      const probe = new DatabaseSync(dbPath);
      probe
        .prepare(
          "INSERT INTO _fenix_passwordless (id,token_hash,user_id,kind,salt,expires_at,used_at,attempts,created_at) VALUES (?,?,?,?,?,?,NULL,0,?)",
        )
        .run(
          "expired-challenge",
          createHash("sha256").update(expiredRaw).digest("hex"),
          signupTwoBody.id,
          "magic",
          "",
          new Date(Date.now() - 60_000).toISOString(),
          new Date().toISOString(),
        );
      probe.close();
      const expired = await verifyMagic(expiredRaw);
      assert.equal(expired.status, 400);
      assert.equal(
        (await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieTwo) })).status,
        200,
      );
      assert.equal(
        (
          await fetch(`${runtime.base}/auth/login`, {
            method: "POST",
            headers: origin,
            body: JSON.stringify({ email: "two@example.test", password: passTwo }),
          })
        ).status,
        200,
      );

      const thirdOne = await requestLink("one@example.test", "otp");
      assert.equal(thirdOne.status, 200);
      const fourth = await requestLink("one@example.test", "magic");
      assert.equal(fourth.status, 429);
      assert.deepEqual(await fourth.json(), { error: "Troppi tentativi" });

      const huge = await fetch(`${runtime.base}/auth/passwordless`, {
        method: "POST",
        headers: origin,
        body: JSON.stringify({ email: `${"a".repeat(300_000)}@x.test`, method: "magic" }),
      });
      assert.equal(huge.status, 413);

      const logs = runtime.logs();
      assert.doesNotMatch(logs, /one@example.test|two@example.test|missing@example.test/);
      assert.doesNotMatch(logs, /correct horse|another secure/);
      assert.doesNotMatch(logs, /password_hash|token_hash|xai-|PRIVATE KEY/i);
      for (const row of [
        ...readOutbox<{ user_id: string; token: string }>(dbPath, "passwordless_magic"),
        ...readOutbox<{ user_id: string; otp: string }>(dbPath, "passwordless_otp"),
      ]) {
        if ("token" in row && row.token) assert.doesNotMatch(logs, new RegExp(escapeRe(row.token)));
        if ("otp" in row && row.otp) assert.doesNotMatch(logs, new RegExp(escapeRe(row.otp)));
        assert.equal("email" in row, false);
      }
    } finally {
      await runtime.close();
    }
  });

  it("creates end-user sessions and isolates records between accounts", async () => {
    const runtime = await startBackend();
    try {
      const weak = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "one@example.test", password: "too-short" }),
      });
      assert.equal(weak.status, 400);

      const signupOne = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "one@example.test", password: "correct horse battery staple" }),
      });
      assert.equal(signupOne.status, 201);
      const cookieOne = cookieFrom(signupOne);
      const signupOneBody = (await signupOne.json()) as { id: string; email: string };

      const signupTwo = await fetch(`${runtime.base}/auth/signup`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "two@example.test", password: "another secure password" }),
      });
      assert.equal(signupTwo.status, 201);
      const cookieTwo = cookieFrom(signupTwo);

      const oneCreatedResponse = await fetch(`${runtime.base}/api/tasks`, {
        method: "POST",
        headers: sessionHeaders(cookieOne),
        body: JSON.stringify({ title: "Solo uno", done: false, priority: 1 }),
      });
      assert.equal(oneCreatedResponse.status, 201);
      const oneCreated = (await oneCreatedResponse.json()) as { id: string };

      const twoCreatedResponse = await fetch(`${runtime.base}/api/tasks`, {
        method: "POST",
        headers: sessionHeaders(cookieTwo),
        body: JSON.stringify({ title: "Solo due", done: false, priority: 2 }),
      });
      assert.equal(twoCreatedResponse.status, 201);

      const listOne = (await (
        await fetch(`${runtime.base}/api/tasks`, { headers: sessionHeaders(cookieOne) })
      ).json()) as { items: Array<{ title: string }> };
      const listTwo = (await (
        await fetch(`${runtime.base}/api/tasks`, { headers: sessionHeaders(cookieTwo) })
      ).json()) as { items: Array<{ title: string }> };
      assert.deepEqual(listOne.items.map((item) => item.title), ["Solo uno"]);
      assert.deepEqual(listTwo.items.map((item) => item.title), ["Solo due"]);
      assert.equal(
        (
          await fetch(`${runtime.base}/api/tasks/${oneCreated.id}`, {
            headers: sessionHeaders(cookieTwo),
          })
        ).status,
        404,
      );

      const me = await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieOne) });
      assert.equal(me.status, 200);
      assert.deepEqual(await me.json(), {
        id: signupOneBody.id,
        email: "one@example.test",
        service: false,
      });

      const invalidLogin = await fetch(`${runtime.base}/auth/login`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "one@example.test", password: "wrong password here" }),
      });
      assert.equal(invalidLogin.status, 401);
      const login = await fetch(`${runtime.base}/auth/login`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "one@example.test", password: "correct horse battery staple" }),
      });
      assert.equal(login.status, 200);
      assert.ok(cookieFrom(login));

      const logout = await fetch(`${runtime.base}/auth/logout`, {
        method: "POST",
        headers: sessionHeaders(cookieOne),
      });
      assert.equal(logout.status, 200);
      assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/);
      assert.equal(
        (await fetch(`${runtime.base}/auth/me`, { headers: sessionHeaders(cookieOne) })).status,
        401,
      );
    } finally {
      await runtime.close();
    }
  });

  it("serves three coupled full-stack fixtures on the same origin after a real check", async () => {
    assert.equal(FULLSTACK_FIXTURES.length, 3);
    for (const fixture of FULLSTACK_FIXTURES) {
      const files = materializeFullstackProject(fixture);
      const collection = fixture.spec.collections[0]!.name;
      const root = mkdtempSync(join(tmpdir(), `fenix-fs-check-${fixture.id}-`));
      writeTree(root, files);
      const verified = spawn(process.execPath, ["--check", "backend/server.mjs"], { cwd: root, stdio: "ignore" });
      const [checkCode] = (await once(verified, "exit")) as [number | null];
      assert.equal(checkCode, 0, fixture.id);
      const runtime = await startTree(files, { FENIX_ALLOWED_ORIGIN: "" });
      try {
        const page = await fetch(runtime.base);
        assert.equal(page.status, 200);
        const html = await page.text();
        assert.match(html, new RegExp(fixture.name));
        assert.match(html, /<html lang="it">/);
        assert.equal((await fetch(`${runtime.base}/backend/server.mjs`)).status, 404);
        assert.equal((await fetch(`${runtime.base}/backend/migrations/0001_init.sql`)).status, 404);
        const health = await (await fetch(`${runtime.base}/health`)).json();
        assert.equal(health.origin, "same");
        assert.equal(health.schema, PORTABLE_SCHEMA_VERSION);
        const signup = await fetch(`${runtime.base}/auth/signup`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: runtime.base },
          body: JSON.stringify({
            email: `${fixture.id}@fenix.test`,
            password: "forno argilla viva",
          }),
        });
        assert.equal(signup.status, 201, fixture.id);
        const cookie = cookieFrom(signup);
        const sample =
          collection === "lotti"
            ? { nome: "Piatto", pezzi: 4, scaffale: "A1" }
            : collection === "cotture"
              ? { titolo: "Biscotto", temperatura: 980, pronta: false }
              : { cliente: "Studio Luce", pezzi: 6, pronto: false };
        const created = await fetch(`${runtime.base}/api/${collection}`, {
          method: "POST",
          headers: { cookie, origin: runtime.base, "content-type": "application/json" },
          body: JSON.stringify(sample),
        });
        assert.equal(created.status, 201, fixture.id);
        const listed = (await (
          await fetch(`${runtime.base}/api/${collection}`, {
            headers: { cookie, origin: runtime.base },
          })
        ).json()) as { items: unknown[] };
        assert.equal(listed.items.length, 1);
        assert.doesNotMatch(runtime.logs(), /forno argilla viva|xai-|PRIVATE KEY|test-token/);
      } finally {
        await runtime.close();
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("upgrades a v1 fixture to v4 without losing rows, then fail-closes a bad migration", async () => {
    const files = materializePortableBackend(SPEC);
    const v1 = portableBackendMigrations(SPEC)[0]!;
    const root = mkdtempSync(join(tmpdir(), "fenix-migrate-"));
    const dbPath = join(root, "data.sqlite");
    writeTree(root, files);
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    db.exec(v1.sql);
    const password = "correct horse battery staple";
    const userId = "11111111-1111-4111-8111-111111111111";
    db.prepare("INSERT INTO _fenix_users (id,email,password_hash,created_at) VALUES (?,?,?,?)").run(
      userId,
      "keeper@fenix.test",
      passwordRecord(password),
      new Date().toISOString(),
    );
    db.prepare(
      'INSERT INTO "tasks" (id,owner_id,data,created_at,updated_at,version) VALUES (?,?,?,?,?,1)',
    ).run(
      "task-keep",
      userId,
      JSON.stringify({ title: "Crudo v1", done: false, priority: 3 }),
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.close();

    const runtime = await startTree(files, { FENIX_DB_PATH: dbPath });
    try {
      const health = await (await fetch(`${runtime.base}/health`)).json();
      assert.equal(health.schema, PORTABLE_SCHEMA_VERSION);
      const login = await fetch(`${runtime.base}/auth/login`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "keeper@fenix.test", password }),
      });
      assert.equal(login.status, 200);
      const cookie = cookieFrom(login);
      const listed = (await (
        await fetch(`${runtime.base}/api/tasks`, { headers: sessionHeaders(cookie) })
      ).json()) as { items: Array<{ id: string; title: string }> };
      assert.equal(listed.items.length, 1);
      assert.equal(listed.items[0]?.id, "task-keep");
      assert.equal(listed.items[0]?.title, "Crudo v1");
      const created = await fetch(`${runtime.base}/api/tasks`, {
        method: "POST",
        headers: sessionHeaders(cookie),
        body: JSON.stringify({ title: "Dopo v4", done: true, priority: 1 }),
      });
      assert.equal(created.status, 201);
      const recover = await fetch(`${runtime.base}/auth/recover`, {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ email: "keeper@fenix.test" }),
      });
      assert.equal(recover.status, 200);
      assert.deepEqual(await recover.json(), { ok: true });
      assert.equal(readOutbox(dbPath).length, 1);
    } finally {
      await runtime.close();
    }

    const upgraded = new DatabaseSync(dbPath);
    const loginAt = upgraded.prepare("SELECT last_login_at FROM _fenix_users WHERE id=?").get(userId) as
      | { last_login_at: string | null }
      | undefined;
    assert.ok(loginAt?.last_login_at);
    const meta = upgraded.prepare("SELECT value FROM _fenix_meta WHERE key='product'").get() as
      | { value: string }
      | undefined;
    assert.equal(meta?.value, "fenix-portable");
    const applied = upgraded.prepare("SELECT id FROM _fenix_migrations ORDER BY id").all() as Array<{ id: string }>;
    assert.deepEqual(
      applied.map((row) => row.id),
      ["0001_init", "0002_meta", "0003_password_reset", "0004_passwordless"],
    );
    upgraded.close();

    writeFileSync(join(root, "backend/migrations/0005_bad.sql"), "ALTER TABLE _fenix_missing ADD COLUMN x TEXT;\n");
    const failed = await startTree(files.concat([{ path: "backend/migrations/0005_bad.sql", content: "ALTER TABLE _fenix_missing ADD COLUMN x TEXT;\n" }]), { FENIX_DB_PATH: dbPath }, { expectFail: true });
    try {
      assert.notEqual(failed.code, 0);
      assert.match(failed.logs(), /Migrazione fallita/);
      assert.doesNotMatch(failed.logs(), /keeper@fenix.test|correct horse|password_hash/);
      const after = new DatabaseSync(dbPath);
      const rows = after.prepare("SELECT id, data FROM tasks ORDER BY id").all() as Array<{ id: string; data: string }>;
      assert.equal(rows.length, 2);
      assert.ok(rows.some((row) => row.id === "task-keep" && row.data.includes("Crudo v1")));
      const ids = after.prepare("SELECT id FROM _fenix_migrations ORDER BY id").all() as Array<{ id: string }>;
      assert.deepEqual(
        ids.map((row) => row.id),
        ["0001_init", "0002_meta", "0003_password_reset", "0004_passwordless"],
      );
      after.close();
    } finally {
      await failed.close();
    }
  });

  it("starts two isolated ports against the same database idempotently", async () => {
    const files = materializePortableBackend(SPEC);
    const root = mkdtempSync(join(tmpdir(), "fenix-concurrent-"));
    const dbPath = join(root, "data.sqlite");
    writeTree(root, files);
    const first = await startTree(files, { FENIX_DB_PATH: dbPath });
    const second = await startTree(files, { FENIX_DB_PATH: dbPath });
    try {
      assert.notEqual(first.base, second.base);
      const a = await (await fetch(`${first.base}/health`)).json();
      const b = await (await fetch(`${second.base}/health`)).json();
      assert.equal(a.schema, PORTABLE_SCHEMA_VERSION);
      assert.equal(b.schema, PORTABLE_SCHEMA_VERSION);
      assert.equal(a.origin, "same");
      const restart = await startTree(files, { FENIX_DB_PATH: dbPath });
      try {
        const again = await (await fetch(`${restart.base}/health`)).json();
        assert.equal(again.schema, PORTABLE_SCHEMA_VERSION);
      } finally {
        await restart.close();
      }
    } finally {
      await first.close();
      await second.close();
    }
  });
});
