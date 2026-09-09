import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { runAgent, compactMessages } from "../workers/agent/agent.mjs";
import { createToolExecutor } from "../workers/agent/tools.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));

test("agent builds the golden project, passes checks and finishes", { timeout: 180_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `loop-ok-${process.pid}` });
  const model = new FakeModel([
    { thought: "Scrivo il progetto.", calls: writeAll },
    [{ tool: "start_server" }, { tool: "http", input: { path: "/api/appuntamenti" } }],
    [{ tool: "run_checks" }],
    [{ tool: "finish", input: { summary: "Agenda barbiere con API e test." } }],
  ]);
  const events = [];
  try {
    const result = await runAgent({ model, sandbox, brief: "agenda per barbiere", kind: "app", onEvent: (e) => events.push(e), browserChecks: false });
    assert.equal(result.outcome, "done");
    assert.ok(result.ok);
    assert.equal(result.summary, "Agenda barbiere con API e test.");
    assert.ok(result.checks.ok);
    assert.equal(result.files.length, GOLDEN_FILES.length + 1, "golden files + the seeded Fenix UI kit");
    assert.ok(result.files.some((f) => f.path === "public/fenix-ui.css"));
    assert.ok(result.files.every((f) => typeof f.content === "string"));
    assert.equal(result.stats.modelCalls, 4);
    assert.ok(result.stats.costUsd > 0);
    // system prompt + tools were sent on every call
    assert.ok(model.calls.every((c) => c.system.includes("Fenix Project v1") && c.tools.length >= 10));
    assert.ok(events.some((e) => e.type === "tool" && e.name === "run_checks"));
    assert.equal(events.at(-1).type, "end");
  } finally {
    await sandbox.destroy();
  }
});

test("finish is refused until run_checks passes; the agent must fix and re-check", { timeout: 180_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `loop-fix-${process.pid}` });
  const broken = GOLDEN_FILES.map((f) => f.path === "public/index.html" ? { ...f, content: f.content.replace("Agenda di oggi", "Lorem ipsum") } : f);
  let sawRefusal = false;
  let sawFailReport = false;
  const model = new FakeModel([
    broken.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } })),
    [{ tool: "finish", input: { summary: "fatto" } }],
    (req) => {
      const last = req.messages.at(-1).content[0].content;
      sawRefusal = /RIFIUTATO/.test(last);
      return [{ tool: "run_checks" }];
    },
    (req) => {
      const last = req.messages.at(-1).content[0].content;
      sawFailReport = /CONTROLLI FALLITI: no-placeholders/.test(last);
      return [{ tool: "edit_file", input: { path: "public/index.html", search: "Lorem ipsum", replace: "Agenda di oggi" } }];
    },
    [{ tool: "run_checks" }],
    [{ tool: "finish", input: { summary: "ok" } }],
  ]);
  try {
    const result = await runAgent({ model, sandbox, brief: "agenda", browserChecks: false });
    assert.ok(sawRefusal, "finish prematuro deve essere rifiutato");
    assert.ok(sawFailReport, "il report deve nominare il check fallito");
    assert.equal(result.outcome, "done");
    assert.ok(result.ok);
    assert.equal(result.stats.modelCalls, 6);
  } finally {
    await sandbox.destroy();
  }
});

test("budget and stalls end the run without ok", { timeout: 60_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `loop-budget-${process.pid}` });
  try {
    const chatty = new FakeModel([{ text: "ci penso" }, { text: "ancora" }, { text: "mmm" }, { text: "boh" }]);
    const stalled = await runAgent({ model: chatty, sandbox, brief: "x", browserChecks: false });
    assert.equal(stalled.outcome, "stalled");
    assert.equal(stalled.ok, false);

    const looping = new FakeModel(Array.from({ length: 20 }, () => [{ tool: "list_files" }]));
    const budget = await runAgent({ model: looping, sandbox, brief: "x", browserChecks: false, limits: { maxSteps: 5 } });
    assert.equal(budget.outcome, "budget");
    assert.ok(budget.stats.steps <= 6);
  } finally {
    await sandbox.destroy();
  }
});

test("tools enforce the contract: paths, unique edits, forbidden commands", { timeout: 60_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `tools-${process.pid}` });
  const ex = createToolExecutor(sandbox, { browserChecks: false });
  try {
    assert.equal((await ex.execute("write_file", { path: "../evil.mjs", content: "x" })).ok, false);
    assert.equal((await ex.execute("write_file", { path: "node_modules/x.js", content: "x" })).ok, false);
    assert.equal((await ex.execute("write_file", { path: ".fenix/x", content: "x" })).ok, false);
    assert.equal((await ex.execute("write_file", { path: "public/a.txt", content: "uno due uno" })).ok, true);
    const dup = await ex.execute("edit_file", { path: "public/a.txt", search: "uno", replace: "tre" });
    assert.equal(dup.ok, false);
    assert.match(dup.output, /più volte/);
    const missing = await ex.execute("edit_file", { path: "public/a.txt", search: "quattro", replace: "tre" });
    assert.equal(missing.ok, false);
    const ok = await ex.execute("edit_file", { path: "public/a.txt", search: "due", replace: "tre" });
    assert.equal(ok.ok, true);
    assert.equal(await sandbox.readFile("public/a.txt"), "uno tre uno");
    const npm = await ex.execute("run", { command: "npm install express" });
    assert.match(npm.output, /non consentito/);
    const echo = await ex.execute("run", { command: "echo ciao && exit 3" });
    assert.match(echo.output, /exit 3/);
    assert.match(echo.output, /ciao/);
    const slow = await ex.execute("run", { command: "sleep 5", timeout_s: 1 });
    assert.match(slow.output, /TIMEOUT/);
    const noServer = await ex.execute("http", { path: "/health" });
    assert.equal(noServer.ok, false);
    const fin = await ex.execute("finish", { summary: "x" });
    assert.match(fin.output, /RIFIUTATO/);
  } finally {
    await sandbox.destroy();
  }
});

test("compactMessages keeps recent tool results verbatim and collapses old ones", () => {
  const msgs = [];
  for (let i = 0; i < 6; i++) {
    msgs.push({ role: "assistant", content: [{ type: "tool_use", id: `t${i}`, name: "list_files", input: {} }] });
    msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: "x".repeat(1000) }] });
  }
  const out = compactMessages(msgs, 2);
  const results = out.filter((m) => m.role === "user").map((m) => m.content[0].content.length);
  assert.deepEqual(results.slice(-2), [1000, 1000]);
  assert.ok(results.slice(0, 4).every((n) => n < 300));
  assert.equal(msgs[1].content[0].content.length, 1000, "input non mutato");
});
