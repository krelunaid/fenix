import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { runChecks } from "../workers/agent/checks.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

async function goldenSandbox(name) {
  const sb = await LocalSandbox.create({ jobId: `checks-${name}-${process.pid}` });
  for (const f of GOLDEN_FILES) await sb.writeFile(f.path, f.content);
  return sb;
}

test("golden project passes structural checks but missing browser fails closed", { timeout: 120_000 }, async () => {
  const sb = await goldenSandbox("golden");
  try {
    const exec = sb.exec.bind(sb);
    sb.exec = (options) => options.cmd === "node .fenix/browser-smoke.mjs"
      ? Promise.resolve({ code: 0, stdout: JSON.stringify({ skipped: true, reason: "missing test browser" }), stderr: "" })
      : exec(options);
    const result = await runChecks(sb, { browser: true });
    const failed = result.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
    assert.deepEqual(result.failed, ["browser"]);
    assert.equal(result.ok, false);
    const ids = result.checks.map((c) => c.id);
    for (const id of ["manifest", "syntax", "server:start", "server:health", "page:/", "page:/clienti", "page:404", "api:GET /api/appuntamenti", "api:POST /api/appuntamenti", "tests:pass", "browser"]) {
      assert.ok(ids.includes(id), `manca il check ${id}`);
    }
    // A skipped browser must never be reported as a successful verification.
    const browser = result.checks.find((c) => c.id === "browser");
    assert.equal(browser.ok, false);
  } finally {
    await sb.destroy();
  }
});

test("a broken server, a missing page and placeholder text are reported precisely", { timeout: 120_000 }, async () => {
  const sb = await goldenSandbox("broken");
  try {
    await sb.writeFile("public/index.html", (await sb.readFile("public/index.html")).replace("Agenda di oggi", "Lorem ipsum agenda"));
    await sb.writeFile("server.mjs", (await sb.readFile("server.mjs")).replace('{ ok: true }', '{ ok: false }'));
    await sb.deleteFile("public/clienti.html");
    const result = await runChecks(sb, { browser: false });
    assert.equal(result.ok, false);
    assert.ok(result.failed.includes("no-placeholders"));
    assert.ok(result.failed.includes("server:health"));
    assert.ok(result.failed.includes("page:/clienti"));
    assert.ok(!result.failed.includes("page:/"));
  } finally {
    await sb.destroy();
  }
});

test("syntax errors stop before starting the server", { timeout: 60_000 }, async () => {
  const sb = await goldenSandbox("syntax");
  try {
    await sb.writeFile("server.mjs", "import x from ;;; broken");
    const result = await runChecks(sb, { browser: false });
    assert.equal(result.ok, false);
    assert.ok(result.failed.includes("syntax"));
    assert.ok(!result.checks.some((c) => c.id === "server:start"));
  } finally {
    await sb.destroy();
  }
});

test("dependencies and missing tests are rejected", { timeout: 60_000 }, async () => {
  const sb = await goldenSandbox("deps");
  try {
    await sb.writeFile("package.json", JSON.stringify({ name: "x", type: "module", scripts: { start: "node server.mjs" }, dependencies: { express: "^4" } }));
    await sb.deleteFile("tests/app.test.mjs");
    const result = await runChecks(sb, { browser: false });
    assert.ok(result.failed.includes("package"));
    assert.ok(result.failed.includes("tests:present"));
  } finally {
    await sb.destroy();
  }
});
