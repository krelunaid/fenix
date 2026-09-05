import assert from "node:assert/strict";
import { test } from "node:test";
import { applyComposedBuildPlan, composedBaseSha } from "../workers/visual/composed-build.mjs";
import { applyComposedBuildPlanWeb, composedBaseShaWeb } from "../workers/visual/composed-protocol.mjs";

const html = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>:root{--fg:#102030}</style><style data-fenix-native-style="v1">body{font-size:17px}</style></head><body><main id="root"><button id="save">Salva adesso</button><output id="status">In attesa</output></main><nav id="tabs"><button>Home</button></nav><script>window.saved="original";</script></body></html>';
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
