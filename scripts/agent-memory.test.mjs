import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAgentServer, projectContext } from "../workers/agent/server.mjs";
import { JobStore } from "../workers/agent/jobs.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { editBrief } from "../workers/agent/prompts.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

const TOKEN = "memory-token-0123456789abcdef";
const OWNER = "c".repeat(32);
const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));
const models = [];
const store = new JobStore({ concurrency: 1, maxQueued: 5 });
const server = createAgentServer({
  token: TOKEN,
  store,
  browserChecks: false,
  modelFactory: () => { const m = new FakeModel([writeAll, [{ tool: "run_checks" }], [{ tool: "finish", input: { summary: `fatto #${models.length + 1}` } }]]); models.push(m); return m; },
  sandboxFactory: ({ jobId }) => LocalSandbox.create({ jobId: `mem-${jobId}` }),
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => { store.close(); server.close(); await server.previews.close(); });

const call = (path, { method = "GET", body } = {}) =>
  fetch(base + path, { method, headers: { authorization: `Bearer ${TOKEN}`, "x-fenix-owner": OWNER, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

async function waitDone(id) {
  for (let i = 0; i < 400; i += 1) {
    const j = await (await call(`/agent/jobs/${id}?full=1`)).json();
    if (j.status !== "queued" && j.status !== "running") return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timeout");
}

const firstUserText = (model) => model.calls[0].messages[0].content;

test("projectContext chains brief, previous instructions and last summary", () => {
  assert.equal(projectContext({}), null);
  const root = { id: "r", input: { brief: "Agenda per barbiere" }, result: { summary: "Creata agenda" } };
  const c1 = projectContext({ parent: root });
  assert.deepEqual(c1, { brief: "Agenda per barbiere", history: [], lastSummary: "Creata agenda" });
  const edit1 = { id: "e1", input: { instruction: "aggiungi il telefono", context: c1 }, result: { summary: "Campo telefono aggiunto" } };
  const c2 = projectContext({ parent: edit1 });
  assert.equal(c2.brief, "Agenda per barbiere");
  assert.deepEqual(c2.history, [{ instruction: "aggiungi il telefono", summary: "Campo telefono aggiunto" }]);
  assert.equal(c2.lastSummary, "Campo telefono aggiunto");
  // Studio-sent fallback when the parent is unknown to this host; junk is ignored, history capped.
  const sent = projectContext({ sent: { brief: "Sito pizzeria", history: Array.from({ length: 15 }, (_, i) => ({ instruction: `passo ${i}` })).concat([{ nope: 1 }]), summary: 42 } });
  assert.equal(sent.brief, "Sito pizzeria");
  assert.equal(sent.history.length, 10);
  assert.equal(sent.history[0].instruction, "passo 5");
  assert.equal(sent.lastSummary, "");
  const text = editBrief({ instruction: "rimetti il campo come prima", context: c2 });
  assert.match(text, /BRIEF ORIGINALE: Agenda per barbiere/);
  assert.match(text, /1\. aggiungi il telefono → Campo telefono aggiunto/);
  assert.match(text, /STATO ATTUALE/);
  assert.doesNotMatch(editBrief({ instruction: "x" }), /BRIEF ORIGINALE/);
});

test("an edit with parentJobId receives the chained memory; the chain grows across edits", { timeout: 240_000 }, async () => {
  const created = await (await call("/agent/build", { method: "POST", body: { brief: "Agenda per barbiere con clienti", kind: "app", name: "Barbiere Rossi" } })).json();
  const root = await waitDone(created.id);
  assert.equal(root.status, "ok");
  const files = root.result.files.filter((f) => typeof f.content === "string").map((f) => ({ path: f.path, content: f.content }));

  const e1 = await (await call("/agent/build", { method: "POST", body: { instruction: "aggiungi il campo telefono al cliente", files, kind: "app", parentJobId: created.id } })).json();
  const j1 = await waitDone(e1.id);
  assert.equal(j1.status, "ok");
  const t1 = firstUserText(models[1]);
  assert.match(t1, /BRIEF ORIGINALE: Agenda per barbiere con clienti/);
  assert.match(t1, /STATO ATTUALE .*fatto #1/);
  assert.match(t1, /PROGETTO "Agenda Barbiere" \(app\): pagine \/ \(Agenda\), \/clienti \(Clienti\); API GET \/api\/appuntamenti/);
  assert.doesNotMatch(t1, /MODIFICHE PRECEDENTI/);

  const e2 = await (await call("/agent/build", { method: "POST", body: { instruction: "rendi il telefono obbligatorio", files, kind: "app", parentJobId: e1.id } })).json();
  const j2 = await waitDone(e2.id);
  assert.equal(j2.status, "ok");
  const t2 = firstUserText(models[2]);
  assert.match(t2, /MODIFICHE PRECEDENTI[\s\S]*1\. aggiungi il campo telefono al cliente → fatto #2/);
  assert.match(t2, /STATO ATTUALE .*fatto #2/);
  assert.match(t2, /MODIFICA RICHIESTA[\s\S]*rendi il telefono obbligatorio/);

  // Parent of another owner or unknown: falls back to the Studio's context.
  const e3 = await (await call("/agent/build", { method: "POST", body: { instruction: "cambia colore", files, kind: "app", parentJobId: "0".repeat(20), context: { brief: "Dal browser", history: [{ instruction: "prima modifica", summary: "ok" }] } } })).json();
  const j3 = await waitDone(e3.id);
  assert.equal(j3.status, "ok");
  const t3 = firstUserText(models[3]);
  assert.match(t3, /BRIEF ORIGINALE: Dal browser/);
  assert.match(t3, /1\. prima modifica → ok/);
});
