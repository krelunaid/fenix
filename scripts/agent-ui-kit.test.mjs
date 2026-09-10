import { test } from "node:test";
import assert from "node:assert/strict";
import { UI_KIT_CSS, UI_KIT_PATH, UI_KIT_CHEATSHEET, UI_KIT_PROTECTED_SELECTORS, seedUiKit, uiKitProblems, isUiKitPath } from "../workers/agent/ui-kit.mjs";
import { systemPrompt } from "../workers/agent/prompts.mjs";
import { runChecks } from "../workers/agent/checks.mjs";
import { LocalSandbox } from "../workers/agent/sandbox/local.mjs";
import { createToolExecutor } from "../workers/agent/tools.mjs";
import { runAgent } from "../workers/agent/agent.mjs";
import { FakeModel } from "../workers/agent/model/fake.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

test("the kit is self-contained CSS: tokens, app/site skeletons, components, no external URLs, AA-minded defaults", () => {
  assert.ok(UI_KIT_CSS.length > 8_000 && UI_KIT_CSS.length < 40_000, `dimensione inattesa ${UI_KIT_CSS.length}`);
  for (const sel of [".fx-app", ".fx-tabbar", ".fx-tab", ".fx-header", ".fx-main", ".fx-site", ".fx-nav", ".fx-hero", ".fx-footer", ".fx-card", ".fx-list", ".fx-item", ".fx-kpi", ".fx-btn", ".fx-btn-secondary", ".fx-field", ".fx-input", ".fx-select", ".fx-textarea", ".fx-badge", ".fx-empty", ".fx-toast", ".fx-dialog", ".fx-table", ".fx-segmented", ".fx-search", ".fx-fab"]) {
    assert.ok(UI_KIT_CSS.includes(sel), `manca ${sel}`);
  }
  assert.doesNotMatch(UI_KIT_CSS, /url\(\s*["']?https?:/i, "nessuna risorsa esterna");
  assert.doesNotMatch(UI_KIT_CSS, /@import/i);
  assert.match(UI_KIT_CSS, /--fx-accent:/);
  assert.match(UI_KIT_CSS, /min-height: 48px/, "controlli da 48px");
  assert.match(UI_KIT_CSS, /font-size: 16px/, "input a 16px (niente zoom iOS)");
  assert.match(UI_KIT_CSS, /env\(safe-area-inset-bottom\)/);
  assert.match(UI_KIT_CSS, /:focus-visible/);
  assert.match(UI_KIT_CSS, /prefers-reduced-motion/);
  assert.match(UI_KIT_CSS, /@media \(min-width: 900px\)/);
  assert.match(UI_KIT_CHEATSHEET, /fx-tabbar[\s\S]*fx-empty[\s\S]*Never emoji/);
  assert.match(UI_KIT_CHEATSHEET, /HARD RULE:[\s\S]*\.fx-dialog[\s\S]*\.barber-appointment/);
  assert.ok(UI_KIT_PROTECTED_SELECTORS.includes(".fx-btn") && UI_KIT_PROTECTED_SELECTORS.includes(".fx-toast"));
  assert.match(systemPrompt({ kind: "app", maxSteps: 10 }), /Fenix UI kit \(public\/fenix-ui\.css/);
  assert.match(systemPrompt({ kind: "app", maxSteps: 10 }), /parse JSON exactly once before authentication/);
  assert.ok(isUiKitPath("public/fenix-ui.css") && isUiKitPath("./public/fenix-ui.css") && !isUiKitPath("public/styles.css"));
});

test("seedUiKit writes the kit once and restores a tampered copy; the tools refuse to touch it", { timeout: 60_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `kit-${process.pid}` });
  try {
    assert.deepEqual(await seedUiKit(sandbox), { seeded: true, updated: false });
    assert.deepEqual(await seedUiKit(sandbox), { seeded: false, updated: false });
    await sandbox.writeFile(UI_KIT_PATH, "/* rotto */");
    assert.deepEqual(await seedUiKit(sandbox), { seeded: false, updated: true });
    assert.equal(await sandbox.readFile(UI_KIT_PATH), UI_KIT_CSS);
    const ex = createToolExecutor(sandbox, { browserChecks: false, uiKit: true });
    for (const [tool, input] of [
      ["write_file", { path: UI_KIT_PATH, content: "x" }],
      ["edit_file", { path: UI_KIT_PATH, search: "--fx-accent", replace: "--x" }],
      ["delete_file", { path: "./public/fenix-ui.css" }],
    ]) {
      const r = await ex.execute(tool, input);
      assert.equal(r.ok, false, `${tool} doveva essere rifiutato`);
      assert.match(r.output, /base grafica gestita da Fenix/);
    }
    assert.equal(await sandbox.readFile(UI_KIT_PATH), UI_KIT_CSS);
  } finally {
    await sandbox.destroy();
  }
});

test("uiKitProblems: missing file, tampered file, unlinked page, wrong order, kit unused", async () => {
  const files = (list) => list.map((path) => ({ path, bytes: 1 }));
  const page = (head, body = '<div class="fx-app"><main class="fx-main"><div class="fx-card"><button class="fx-btn">Ok</button></div></main></div>') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
  const okHead = '<link rel="stylesheet" href="/fenix-ui.css"><link rel="stylesheet" href="/styles.css">';
  const mk = (map) => ({ files: files(Object.keys(map)), readFile: async (p) => map[p] });

  assert.deepEqual(await uiKitProblems(mk({ [UI_KIT_PATH]: UI_KIT_CSS, "public/index.html": page(okHead) })), []);
  assert.match((await uiKitProblems(mk({ "public/index.html": page(okHead) })))[0], /mancante/);
  assert.match((await uiKitProblems(mk({ [UI_KIT_PATH]: "x", "public/index.html": page(okHead) })))[0], /modificato/);
  assert.match((await uiKitProblems(mk({ [UI_KIT_PATH]: UI_KIT_CSS, "public/a.html": page('<link rel="stylesheet" href="/styles.css">') })))[0], /manca <link/);
  assert.match((await uiKitProblems(mk({ [UI_KIT_PATH]: UI_KIT_CSS, "public/a.html": page('<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="fenix-ui.css">') })))[0], /primo stylesheet/);
  assert.match((await uiKitProblems(mk({ [UI_KIT_PATH]: UI_KIT_CSS, "public/a.html": page(okHead, "<main><h1>Ciao</h1></main>") })))[0], /usa le classi del kit/);
  const override = await uiKitProblems(mk({
    [UI_KIT_PATH]: UI_KIT_CSS,
    "public/index.html": page(okHead),
    "public/styles.css": ":root{--fx-accent:#125;} @media(min-width:900px){.fx-tabbar{display:none}.water-card{padding:1rem}}",
  }));
  assert.ok(override.some((p) => /non ridefinire \.fx-tabbar/.test(p)), override.join("\n"));
});

test("runChecks gates on ui:kit only when asked; the golden project passes with the kit seeded", { timeout: 120_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `kitchecks-${process.pid}` });
  try {
    for (const f of GOLDEN_FILES) await sandbox.writeFile(f.path, f.content);
    const without = await runChecks(sandbox, { browser: false });
    assert.equal(without.checks.some((c) => c.id === "ui:kit"), false);
    const missing = await runChecks(sandbox, { browser: false, uiKit: true });
    const miss = missing.checks.find((c) => c.id === "ui:kit");
    assert.equal(miss.ok, false);
    assert.match(miss.detail, /mancante/);
    await seedUiKit(sandbox);
    const withKit = await runChecks(sandbox, { browser: false, uiKit: true });
    const kit = withKit.checks.find((c) => c.id === "ui:kit");
    assert.equal(kit.ok, true, kit.detail);
    assert.equal(withKit.ok, true, withKit.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join("\n"));
  } finally {
    await sandbox.destroy();
  }
});

test("runAgent seeds the kit before the model starts and the served app links it", { timeout: 180_000 }, async () => {
  const sandbox = await LocalSandbox.create({ jobId: `kitagent-${process.pid}` });
  const writeAll = GOLDEN_FILES.map((f) => ({ tool: "write_file", input: { path: f.path, content: f.content } }));
  const model = new FakeModel([
    (req) => { assert.match(req.messages[0].content, /BRIEF/); return [{ tool: "list_files" }]; },
    writeAll,
    [{ tool: "run_checks" }],
    [{ tool: "finish", input: { summary: "ok" } }],
  ]);
  const events = [];
  try {
    const result = await runAgent({ model, sandbox, brief: "Agenda barbiere", kind: "app", browserChecks: false, onEvent: (e) => events.push(e) });
    assert.equal(result.ok, true, JSON.stringify(result.checks?.failed));
    const listing = model.calls[1].messages.at(-1).content.find((b) => b.type === "tool_result").content;
    assert.match(listing, /public\/fenix-ui\.css/, "the model sees the kit in list_files before writing anything");
    assert.ok(result.files.some((f) => f.path === UI_KIT_PATH), "the kit ships with the project");
    assert.ok(events.some((e) => e.type === "log" && /Fenix UI kit pronto/.test(e.text || "")));
  } finally {
    await sandbox.destroy();
  }
});
