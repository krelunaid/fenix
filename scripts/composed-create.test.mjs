import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCreatedDocumentOrSeed,
  composedCreateUserContent,
  COMPOSED_CREATE_APPLIED_LOG,
  COMPOSED_CREATE_SYSTEM,
  COMPOSED_PLAN_DEGRADED_LOG,
  createdDocumentBeatsSeed,
  extractCreatedHtml,
  isModelCreatedArtifact,
  looksLikeFenixComposeSeed,
} from "../workers/visual/composed-create.mjs";
import { originalCreateHtml, createdMetaHtml } from "./fixtures/composed-create-html.mjs";
import { COMPOSED_BUILD_SYSTEM } from "../workers/visual/composed-protocol.mjs";

const seed = '<!doctype html><html data-grammar="agenda"><head><style data-fenix-craft>body{color:#102030}</style></head><body><main id="root">Agenda</main><nav id="tabs"><button>Home</button></nav><script>window.Fenix.load("s");window.Fenix.save("s",{});</script></body></html>';

test("create protocol accepts original META+HTML and rejects seed copies", () => {
  const original = originalCreateHtml();
  assert.equal(looksLikeFenixComposeSeed(seed), true);
  assert.equal(looksLikeFenixComposeSeed(original), false);
  assert.equal(createdDocumentBeatsSeed(seed, original), true);
  const applied = applyCreatedDocumentOrSeed(seed, createdMetaHtml());
  assert.equal(applied.applied, true);
  assert.ok(isModelCreatedArtifact(applied.html));
  assert.equal(applied.log[0], COMPOSED_CREATE_APPLIED_LOG);
  assert.equal(extractCreatedHtml(createdMetaHtml()).includes("Atelier Nova"), true);

  const copy = applyCreatedDocumentOrSeed(seed, seed + " ".repeat(3000));
  assert.equal(copy.applied, false);
  assert.equal(copy.html, seed);
  assert.equal(copy.log[0], COMPOSED_PLAN_DEGRADED_LOG);

  const plan = applyCreatedDocumentOrSeed(seed, JSON.stringify({version:1,changes:[]}));
  assert.equal(plan.applied, false);
  assert.equal(plan.html, seed);

  const broken = original.replace("var KEY=\"state\";", "const = ;");
  assert.equal(createdDocumentBeatsSeed(seed, broken), false);
});

test("create system asks for a full original document and never for an atomic JSON plan", () => {
  assert.match(COMPOSED_CREATE_SYSTEM, /documento HTML originale/);
  assert.match(COMPOSED_CREATE_SYSTEM, /<<<HTML>>>/);
  assert.doesNotMatch(COMPOSED_CREATE_SYSTEM, /Rispondi SOLO JSON/);
  assert.doesNotMatch(COMPOSED_CREATE_SYSTEM, /Non restituire un documento HTML intero/);
  assert.match(COMPOSED_BUILD_SYSTEM, /Rispondi SOLO JSON/);
  const user = composedCreateUserContent({ prompt: "app barbiere", instruction: "direzione" });
  assert.match(user, /BRIEF:/);
  assert.match(user, /DIREZIONE/);
  assert.doesNotMatch(user, /HTML ORIGINALE:/);
  assert.doesNotMatch(user, /BASE_SHA256/);
});
