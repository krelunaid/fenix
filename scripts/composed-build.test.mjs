import assert from "node:assert/strict";
import { test } from "node:test";
import { applyComposedBuildPlan, composedBaseSha } from "../workers/visual/composed-build.mjs";
import {
  applyComposedBuildPlanOrSeed,
  applyComposedBuildPlanWeb,
  composedBaseShaWeb,
  composedBuildUserContent,
  composedFindStatus,
  composedPlanRetryFeedback,
  composedSeedAnchors,
  COMPOSED_BUILD_FIND_EXAMPLES,
  COMPOSED_BUILD_SYSTEM,
  COMPOSED_PLAN_APPLY_RETRIES,
  COMPOSED_PLAN_DEGRADED_LOG,
} from "../workers/visual/composed-protocol.mjs";

const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--fg:#102030}</style><style data-fenix-native-style="v1">body{font-size:17px}</style></head><body><main id="root" data-fenix-slot="root"><button id="save">Salva adesso</button><output id="status">In attesa</output></main><nav id="tabs"><button>Home</button></nav><script>/*fenix-slot:save*/window.saved="original";</script></body></html>';
const plan = (changes, base = html) => ({ version: 1, baseSha256: composedBaseSha(base), changes });
const edit = {find:'window.saved="original";',replace:'window.saved="literal $& $` $\'";'};

test("Node and Web Crypto protocols produce identical bytes for Unicode and literal edits", async () => {
  for (const base of [html, html.replace("In attesa", "Già pronto · 日本語 🗓️")]) {
    assert.equal(await composedBaseShaWeb(base), composedBaseSha(base));
    assert.equal(await applyComposedBuildPlanWeb(base, plan([edit], base)), applyComposedBuildPlan(base, plan([edit], base)));
  }
  await assert.rejects(applyComposedBuildPlanWeb(html, {...plan([edit]), baseSha256: "0".repeat(64)}));
  await assert.rejects(applyComposedBuildPlanWeb(html + " ", plan([edit])));
  await assert.rejects(composedBaseShaWeb("x".repeat(120001)), /troppo grande/);
});

test("atomic literal edits preserve the head and apply disjoint changes against one base", () => {
  const changes = [edit, {find:'<output id="status">In attesa</output>',replace:'<output id="status">Pronto per salvare</output>'}];
  const result = applyComposedBuildPlan(html, plan(changes));
  assert.equal(result, html.replace(edit.find, () => edit.replace).replace(changes[1].find, () => changes[1].replace));
  assert.equal(result.split("<body>")[0], html.split("<body>")[0]);
  assert.ok(result.includes(edit.replace));
});

test("reject wrong base, malformed plans, missing/ambiguous targets and overlap atomically", async () => {
  const invalid = [null, [], {}, {...plan([edit]),version:2}, {...plan([edit]),baseSha256:"0".repeat(64)},
    {...plan([edit]),html:"whole document"}, plan([]), plan(Array(13).fill(edit)),
    plan([{...edit,replace:edit.find}]), plan([{...edit,find:"missing anchor"}]),
    plan([{...edit,find:"short"}]), plan([{...edit,replace:"x".repeat(24001)}]),
    plan([edit,{find:'<script>window.saved="original";</script>',replace:'<script>window.saved="new";</script>'}]),
    plan([edit,{find:'<style data-fenix-craft>:root{--fg:#102030}</style>',replace:'<style>body{color:red}</style>'}]),
    plan([{find:'<nav id="tabs"><button>Home</button></nav>',replace:'<p>Nav removed</p>'}]),
    plan([{...edit,replace:'<style>body{display:none}</style>'}]),
  ];
  for (const p of invalid) {
    assert.throws(() => applyComposedBuildPlan(html, p));
    await assert.rejects(applyComposedBuildPlanWeb(html, p));
  }
  const repeated = html.replace('</body>', edit.find + '</body>');
  assert.throws(() => applyComposedBuildPlan(repeated, plan([edit], repeated)), /ambiguo/);
});

test("never searches inside text inserted by a previous change", () => {
  assert.throws(() => applyComposedBuildPlan(html, plan([
    {find:edit.find,replace:'window.newFunction="inserted";'},
    {find:'window.newFunction="inserted";',replace:'window.newFunction="changed again";'},
  ])), /assente/);
});

test("bounds the resulting artifact without truncating any source", () => {
  const big = html.replace('<main', ' '.repeat(120000-html.length) + '<main');
  assert.equal(big.length, 120000);
  assert.throws(() => applyComposedBuildPlan(big, plan([{...edit,replace:edit.find+' // expanded'}], big)), /troppo grande/);
  assert.equal(big.length, 120000);
});

test("first plan with a missing find retries against the original html and then applies", async () => {
  const missing = plan([{...edit,find:"function doesNotExist(){"}]);
  let retries = 0;
  const outcome = await applyComposedBuildPlanOrSeed(
    html,
    (next) => applyComposedBuildPlan(html, next),
    JSON.stringify(missing),
    async (feedback) => {
      retries++;
      assert.match(feedback, /Target di creazione assente/);
      assert.match(feedback, /function doesNotExist/);
      assert.match(feedback, /verbatim dall'HTML ORIGINALE/);
      assert.match(feedback, /unico nel body/);
      assert.match(feedback, /head, style o link/);
      assert.match(feedback, /\/\*fenix-slot:save\*\//);
      assert.match(feedback, /data-fenix-slot="root"/);
      return JSON.stringify(plan([edit]));
    },
  );
  assert.equal(retries, 1);
  assert.equal(outcome.applied, true);
  assert.equal(outcome.attempts, 2);
  assert.deepEqual(outcome.log, []);
  assert.equal(outcome.html, html.replace(edit.find, () => edit.replace));
  assert.equal(outcome.html.split("<body>")[0], html.split("<body>")[0]);
});

test("exhausted plan retries return the composed seed unchanged", async () => {
  const missing = plan([{...edit,find:"function doesNotExist(){"}]);
  let retries = 0;
  const outcome = await applyComposedBuildPlanOrSeed(
    html,
    (next) => {
      assert.equal(html.includes("function doesNotExist(){"), false);
      return applyComposedBuildPlan(html, next);
    },
    "not-json",
    async (feedback) => {
      retries++;
      assert.match(feedback, /JSON non valido|Target di creazione assente/);
      return JSON.stringify(missing);
    },
  );
  assert.equal(retries, COMPOSED_PLAN_APPLY_RETRIES);
  assert.equal(outcome.applied, false);
  assert.equal(outcome.attempts, COMPOSED_PLAN_APPLY_RETRIES + 1);
  assert.equal(outcome.html, html);
  assert.deepEqual(outcome.log, [COMPOSED_PLAN_DEGRADED_LOG]);
  assert.match(outcome.error?.message || "", /Target di creazione assente/);
});

test("ambiguous finds stay rejected and never become a full rewrite", async () => {
  const repeated = html.replace("</body>", `${edit.find}</body>`);
  const bad = JSON.stringify(plan([edit], repeated));
  let retries = 0;
  const outcome = await applyComposedBuildPlanOrSeed(
    repeated,
    (next) => applyComposedBuildPlan(repeated, next),
    bad,
    async (feedback) => {
      retries++;
      assert.match(feedback, /ambiguo/);
      return bad;
    },
  );
  assert.equal(retries, COMPOSED_PLAN_APPLY_RETRIES);
  assert.equal(outcome.applied, false);
  assert.equal(outcome.html, repeated);
  assert.match(outcome.error?.message || "", /ambiguo/);
});

test("system prompt examples are verbatim unique finds and retry names the missed find plus seed anchors", () => {
  for (const example of COMPOSED_BUILD_FIND_EXAMPLES) {
    assert.match(COMPOSED_BUILD_SYSTEM, new RegExp(example.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(COMPOSED_BUILD_SYSTEM, /\/\*fenix-slot:NOME\*\//);
  assert.match(COMPOSED_BUILD_SYSTEM, /data-fenix-slot="NOME"/);
  assert.match(COMPOSED_BUILD_SYSTEM, /Non usare come find frammenti SVG/);
  const missing = new Error("Target di creazione assente: «<svg class='fx-botte'» non compare nel documento");
  const feedback = composedPlanRetryFeedback(missing, html);
  assert.match(feedback, /fx-botte/);
  assert.match(feedback, /Ancore uniche/);
  assert.match(feedback, /\/\*fenix-slot:save\*\//);
  assert.match(feedback, /Preferisci \/\*fenix-slot:/);
  const user = composedBuildUserContent({
    prompt: "acqua",
    html,
    digest: composedBaseSha(html),
  });
  assert.match(user, /ANCORE UNICHE:/);
  assert.match(user, /\/\*fenix-slot:save\*\//);
  assert.ok(user.endsWith(html));
  assert.deepEqual(composedSeedAnchors(html), ['data-fenix-slot="root"', "/*fenix-slot:save*/"]);
  assert.equal(composedFindStatus(html, "/*fenix-slot:save*/window.saved=").usable, true);
  assert.equal(composedFindStatus(html, "function doesNotExist(){").reason, "assente");
  assert.throws(
    () => applyComposedBuildPlan(html, plan([{ find: "function doesNotExist(){", replace: "function exists(){" }])),
    /Target di creazione assente: «function doesNotExist\(\)\{»/,
  );
});
