// Studio proxy (/api/agent/*) against a real agent server with a scripted model.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAgentServer } from "../workers/agent/server.mjs";
import { JobStore } from "../workers/agent/jobs.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";
import { handleAgentRequest, handlePublicAppRequest, setAgentConfigForTests } from "../src/lib/agent/http.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SiteStore, SitePool } from "../workers/agent/sites.mjs";
import { AGENT_CREATE_COST, AGENT_EDIT_COST, AGENT_GRANT, resetMemoryLedger } from "../src/lib/agent/credits-store.ts";

const TOKEN = "agent-token-0123456789abcdef";
const OWNER_A = "a".repeat(32);
const OWNER_B = "b".repeat(32);
const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));

let mode = "ok";
const dataDir = await mkdtemp(join(tmpdir(), "fenix-proxy-data-"));
const store = new JobStore({ concurrency: 1, maxQueued: 40, dataDir });
const sandboxFactory = (opts) => LocalSandbox.create({ ...opts, jobId: `proxy-${opts.jobId}` });
const sitePool = new SitePool({ store: new SiteStore({ dir: join(dataDir, "sites") }), sandboxFactory, idleMs: 60_000, max: 2 });
const server = createAgentServer({
  token: TOKEN,
  store,
  dataDir,
  sites: sitePool,
  browserChecks: false,
  modelFactory: () =>
    mode === "ok"
      ? new FakeModel([writeAll, [{ tool: "run_checks" }], [{ tool: "finish", input: { summary: "ok" } }]])
      : mode === "fail"
        ? new FakeModel([{ text: "non so" }, { text: "boh" }, { text: "mah" }, { text: "no" }])
        : { model: "fake", complete: () => new Promise(() => {}) },
  sandboxFactory,
});
before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  setAgentConfigForTests({ url: `http://127.0.0.1:${server.address().port}`, token: TOKEN });
});
after(async () => { await sitePool.close(); await server.previews.close(); store.close(); server.close(); setAgentConfigForTests(undefined); await rm(dataDir, { recursive: true, force: true }); });

const req = (path, { method = "GET", body, owner = OWNER_A } = {}) =>
  handleAgentRequest(
    new Request(`https://fenix.test/api/agent${path}`, {
      method,
      headers: { ...(owner ? { "x-fenix-owner": owner } : {}), "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    path.split("?")[0],
  );

async function waitJob(id, owner = OWNER_A) {
  let view;
  for (let i = 0; i < 600; i++) {
    view = await (await req(`/jobs/${id}`, { owner })).json();
    if (view.status !== "queued" && view.status !== "running") return view;
    await new Promise((r) => setTimeout(r, 150));
  }
  return view;
}

test("status is public-ish, everything else needs an owner; unconfigured proxy says so", async () => {
  resetMemoryLedger();
  const status = await (await req("/status", { owner: null })).json();
  assert.equal(status.configured, true);
  assert.equal(status.credits, null);
  assert.equal((await req("/credits", { owner: null })).status, 401);
  assert.equal((await req("/build", { method: "POST", body: { brief: "x" }, owner: null })).status, 401);
  setAgentConfigForTests(null);
  const off = await req("/build", { method: "POST", body: { brief: "app barbiere" } });
  assert.equal(off.status, 503);
  assert.match((await off.json()).error, /AGENT_URL/);
  setAgentConfigForTests({ url: `http://127.0.0.1:${server.address().port}`, token: TOKEN });
});

test("a successful build charges CREATE_COST once and is owner-bound", { timeout: 180_000 }, async () => {
  resetMemoryLedger();
  mode = "ok";
  const created = await req("/build", { method: "POST", body: { brief: "agenda per barbiere", kind: "app" } });
  assert.equal(created.status, 202);
  const body = await created.json();
  assert.match(body.id, /^[0-9a-f-]{36}$/);
  assert.equal(body.credits.remaining, AGENT_GRANT - AGENT_CREATE_COST);
  assert.equal((await req(`/jobs/${body.id}`, { owner: OWNER_B })).status, 404);
  const done = await waitJob(body.id);
  assert.equal(done.status, "ok", JSON.stringify(done.error || done.result?.checks?.failed));
  assert.equal(done.refunded, false);
  assert.equal(done.credits.remaining, AGENT_GRANT - AGENT_CREATE_COST);
  const full = await (await req(`/jobs/${body.id}?full=1`)).json();
  assert.ok(full.result.files.some((f) => f.path === "server.mjs" && f.content));
});

test("a failed build is refunded exactly once, even when polled repeatedly", { timeout: 180_000 }, async () => {
  resetMemoryLedger();
  mode = "fail";
  const created = await (await req("/build", { method: "POST", body: { brief: "qualcosa che fallisce" } })).json();
  assert.equal(created.credits.remaining, AGENT_GRANT - AGENT_CREATE_COST);
  const done = await waitJob(created.id);
  assert.equal(done.status, "failed");
  assert.equal(done.refunded, true);
  assert.equal(done.credits.remaining, AGENT_GRANT);
  const again = await (await req(`/jobs/${created.id}`)).json();
  assert.equal(again.refunded, false);
  assert.equal(again.credits.remaining, AGENT_GRANT, "no double refund");
});

test("cancel refunds; edits cost EDIT_COST; insufficient credits -> 402 without dispatch", { timeout: 60_000 }, async () => {
  resetMemoryLedger();
  mode = "hang";
  const created = await (await req("/build", { method: "POST", body: { brief: "lento" } })).json();
  const cancelled = await (await req(`/jobs/${created.id}`, { method: "DELETE" })).json();
  assert.equal(cancelled.refunded, true);
  assert.equal(cancelled.credits.remaining, AGENT_GRANT);

  const edit = await (await req("/build", { method: "POST", body: { instruction: "cambia colore", files: [{ path: "public/index.html", content: "<!doctype html>" }] } })).json();
  assert.equal(edit.credits.remaining, AGENT_GRANT - AGENT_EDIT_COST);
  await req(`/jobs/${edit.id}`, { method: "DELETE" });

  assert.equal((await req("/build", { method: "POST", body: { instruction: "senza file" } })).status, 400);

  // Spend the whole grant with hanging creates (not cancelled), then the next one must be
  // refused before reaching the agent.
  resetMemoryLedger();
  let jobsBefore = store.jobs.size;
  const spentCreates = Math.floor(AGENT_GRANT / AGENT_CREATE_COST);
  const ids = [];
  for (let i = 0; i < spentCreates; i++) {
    const r = await req("/build", { method: "POST", body: { brief: `create ${i}` } });
    const j = await r.json();
    assert.equal(r.status, 202, JSON.stringify(j));
    ids.push(j.id);
  }
  jobsBefore = store.jobs.size;
  const refused = await req("/build", { method: "POST", body: { brief: "uno di troppo" } });
  assert.equal(refused.status, 402);
  assert.equal(store.jobs.size, jobsBefore, "no job dispatched when broke");
  for (const id of ids) await req(`/jobs/${id}`, { method: "DELETE" });
});

test("preview through the proxy: start, rewritten HTML, relayed API, stop", { timeout: 180_000 }, async () => {
  resetMemoryLedger();
  mode = "ok";
  const created = await (await req("/build", { method: "POST", body: { brief: "agenda per barbiere" } })).json();
  const done = await waitJob(created.id);
  assert.equal(done.status, "ok");
  const started = await req(`/jobs/${created.id}/preview`, { method: "POST" });
  const startedBody = await started.json();
  assert.equal(started.status, 200, JSON.stringify(startedBody));
  assert.match(startedBody.url, /^\/api\/agent\/preview\/[A-Za-z0-9_.-]+\/$/);
  // Token-addressed relay: no identity header, works from the sandboxed iframe.
  const viaToken = await handleAgentRequest(new Request(`https://fenix.test/api/agent${startedBody.url}`), startedBody.url.replace(/^\/api\/agent/, ""));
  assert.equal(viaToken.status, 200);
  assert.equal(viaToken.headers.get("access-control-allow-origin"), "*");
  const tokenHtml = await viaToken.text();
  assert.match(tokenHtml, new RegExp(`href="${startedBody.url.replace(/[/.]/g, "\\$&")}styles.css"`));
  const preflight = await handleAgentRequest(new Request(`https://fenix.test/api/agent${startedBody.url}api/x`, { method: "OPTIONS" }), `${startedBody.url.replace(/^\/api\/agent/, "")}api/x`);
  assert.equal(preflight.status, 204);
  const badToken = await handleAgentRequest(new Request("https://fenix.test/api/agent/preview/" + "x".repeat(70) + ".sig/"), "/preview/" + "x".repeat(70) + ".sig/");
  assert.equal(badToken.status, 401);
  const home = await req(`/jobs/${created.id}/preview/`);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("content-security-policy"), "frame-ancestors 'self'");
  const html = await home.text();
  assert.match(html, new RegExp(`href="/api/agent/jobs/${created.id}/preview/styles.css"`));
  assert.match(html, /data-fenix-preview/);
  const api = await handleAgentRequest(
    new Request(`https://fenix.test/api/agent/jobs/${created.id}/preview/api/appuntamenti`, {
      method: "POST",
      headers: { "x-fenix-owner": OWNER_A, "content-type": "application/json" },
      body: JSON.stringify({ cliente: "Anna Verdi", servizio: "Barba", quando: "2026-09-11T09:00" }),
    }),
    `/jobs/${created.id}/preview/api/appuntamenti`,
  );
  assert.equal(api.status, 201);
  const list = await (await req(`/jobs/${created.id}/preview/api/appuntamenti`)).json();
  assert.equal(list.length, 1);
  assert.equal((await req(`/jobs/${created.id}/preview`, { method: "DELETE" })).status, 200);
  assert.equal((await req(`/jobs/${created.id}/preview/`)).status, 409);
});

test("publish through the proxy and serve publicly at /app/:slug/ with rewritten paths", { timeout: 240_000 }, async () => {
  resetMemoryLedger();
  mode = "ok";
  const created = await (await req("/build", { method: "POST", body: { brief: "agenda per barbiere", name: "Barbiere Verdi" } })).json();
  const done = await waitJob(created.id);
  assert.equal(done.status, "ok");
  const pub = await req("/sites", { method: "POST", body: { jobId: created.id } });
  const rec = await pub.json();
  assert.equal(pub.status, 200, JSON.stringify(rec));
  assert.equal(rec.slug, "barbiere-verdi");
  const publicHome = await handlePublicAppRequest(new Request("https://fenix.test/app/barbiere-verdi/"), "barbiere-verdi", "/");
  assert.equal(publicHome.status, 200);
  assert.equal(publicHome.headers.get("content-security-policy"), "frame-ancestors 'none'");
  const html = await publicHome.text();
  assert.match(html, /href="\/app\/barbiere-verdi\/styles.css"/);
  const api = await handlePublicAppRequest(new Request("https://fenix.test/app/barbiere-verdi/api/appuntamenti", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cliente: "Pia Rossi", servizio: "Taglio", quando: "2026-09-13T15:00" }) }), "barbiere-verdi", "/api/appuntamenti");
  assert.equal(api.status, 201);
  const mine = await (await req("/sites")).json();
  assert.equal(mine.sites.length, 1);
  assert.equal((await req("/sites", { owner: OWNER_B })).status, 200);
  assert.equal((await (await req("/sites", { owner: OWNER_B })).json()).sites.length, 0);
  assert.equal((await req(`/sites/${rec.slug}`, { method: "DELETE" })).status, 200);
  assert.equal((await handlePublicAppRequest(new Request("https://fenix.test/app/barbiere-verdi/"), "barbiere-verdi", "/")).status, 404);
});
