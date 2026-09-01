import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { contractInstruction, evaluateContract, planContract } from "../ai/build-contract.ts";
import { APP_COMPONENTS } from "./fixtures/trees.ts";
import { ingestProjectFiles, parseProjectFiles } from "./files.ts";
import {
  hydratePortableBackendFiles,
  materializePortableBackend,
  PORTABLE_BACKEND_MANIFEST,
  validatePortableBackendSpec,
  type PortableBackendSpec,
} from "./portable-backend.ts";
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

async function startBackend() {
  const root = mkdtempSync(join(tmpdir(), "fenix-portable-backend-"));
  const files = materializePortableBackend(SPEC);
  for (const file of files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: join(root, "backend"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "0",
      FENIX_API_TOKEN: "test-token",
      FENIX_DB_PATH: join(root, "data.sqlite"),
      FENIX_ALLOWED_ORIGIN: "https://app.example",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const [chunk] = (await once(child.stdout!, "data")) as [Buffer];
  const ready = JSON.parse(chunk.toString("utf8").trim());
  assert.equal(ready.ready, true);
  assert.ok(Number.isInteger(ready.port) && ready.port > 0);
  return {
    root,
    child,
    base: `http://127.0.0.1:${ready.port}`,
    async close() {
      if (child.exitCode === null) child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit");
      rmSync(root, { recursive: true, force: true });
    },
  };
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
    const tree = ingestProjectFiles([
      { path: "index.html", content: "<!doctype html><title>Tasks</title>" },
      ...backend,
    ]);
    assert.deepEqual(tree.rejected, []);
    assert.ok(tree.files.some((file) => file.path === "backend/server.mjs"));
    assert.ok(tree.files.some((file) => file.path === "backend/schema.sql"));
    assert.doesNotMatch(JSON.stringify(tree.files), /test-token|DATABASE_URL=|PRIVATE KEY/);
    const round = unzipProject(zipProject(tree.files, { kind: "dashboard" }));
    assert.equal(
      round.files.find((file) => file.path === "backend/server.mjs")?.content,
      backend.find((file) => file.path === "backend/server.mjs")?.content,
    );
    const hydrated = hydratePortableBackendFiles([
      { path: PORTABLE_BACKEND_MANIFEST, content: JSON.stringify(SPEC) },
      { path: "backend/server.mjs", content: "throw new Error('untrusted')" },
    ]);
    assert.deepEqual(hydrated.errors, []);
    assert.doesNotMatch(
      hydrated.files.find((file) => file.path === "backend/server.mjs")!.content,
      /untrusted/,
    );
    const parsed = parseProjectFiles(
      `<<<FILE path="${PORTABLE_BACKEND_MANIFEST}">>>\n${JSON.stringify(SPEC)}\n<<<END>>>`,
    );
    assert.ok(parsed.some((file) => file.path === "backend/server.mjs"));
    assert.ok(parsed.some((file) => file.path === "backend/schema.sql"));
  });

  it("is requested only by an explicit full-stack brief and blocks invalid manifests", () => {
    const local = planContract("kind=app registro locale");
    assert.equal(local.files.includes(PORTABLE_BACKEND_MANIFEST), false);
    const contract = planContract("kind=app gestionale full-stack con backend e API REST");
    assert.equal(contract.files.includes(PORTABLE_BACKEND_MANIFEST), true);
    assert.match(contractInstruction(contract), /materializza server Node\+SQLite/);
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
      assert.deepEqual(await health.json(), { ok: true, service: "fenix-backend", version: 1 });

      assert.equal((await fetch(`${runtime.base}/api/tasks`)).status, 401);
      const preflight = await fetch(`${runtime.base}/api/tasks`, {
        method: "OPTIONS",
        headers: { origin: "https://app.example" },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), "https://app.example");
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
    } finally {
      await runtime.close();
    }
  });
});
