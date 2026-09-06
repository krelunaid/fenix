import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCreatedDocumentOrSeed,
  applyCreatedDeskDocumentOrSeed,
  applyCreatedGraphicOrKeep,
  composedCreateUserContent,
  composedDeskCreateUserContent,
  COMPOSED_CREATE_APPLIED_LOG,
  COMPOSED_CREATE_SYSTEM,
  COMPOSED_DESK_CREATE_APPLIED_LOG,
  COMPOSED_DESK_GRAPHIC_SYSTEM,
  COMPOSED_PLAN_DEGRADED_LOG,
  COMPOSED_SITE_CREATE_SYSTEM,
  createdDocumentBeatsSeed,
  extractCreatedHtml,
  isModelCreatedArtifact,
  looksLikeFenixComposeSeed,
  looksLikeFenixWebsiteSeed,
} from "../workers/visual/composed-create.mjs";
import { originalCreateHtml, createdMetaHtml } from "./fixtures/composed-create-html.mjs";
import { createdGraphicSiteMetaHtml, createdSiteMetaHtml, originalSiteHtml } from "./fixtures/composed-desk-html.mjs";
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
  assert.match(COMPOSED_CREATE_SYSTEM, /CLIP a tutto schermo/);
  const feed = composedCreateUserContent({ prompt: "mi crei un app simile tik tok" });
  assert.match(feed, /clip a tutto schermo/);
  assert.match(feed, /NON agenda/);
  assert.doesNotMatch(feed, /For You/);
});

test("desktop create accepts original site HTML and rejects the magazine seed", () => {
  const seed = '<!doctype html><html data-fenix-website="1" data-grammar="magazine"><head><style data-fenix-site>body{}</style></head><body><main id="main">Sito</main></body></html>';
  assert.equal(looksLikeFenixWebsiteSeed(seed), true);
  const applied = applyCreatedDeskDocumentOrSeed(seed, createdSiteMetaHtml(), "site");
  assert.equal(applied.applied, true);
  assert.ok(isModelCreatedArtifact(applied.html));
  assert.equal(applied.log[0], COMPOSED_DESK_CREATE_APPLIED_LOG);
  assert.equal(looksLikeFenixWebsiteSeed(originalSiteHtml()), false);

  const copy = applyCreatedDeskDocumentOrSeed(seed, seed + " ".repeat(3000), "site");
  assert.equal(copy.applied, false);
  assert.equal(copy.html, seed);

  const current = originalSiteHtml().replace("<html", '<html data-fenix-model-create="1"');
  const graphic = applyCreatedGraphicOrKeep(current, createdGraphicSiteMetaHtml(), "desk", "site");
  assert.equal(graphic.applied, true);
  assert.match(graphic.html, /Sala · Brera/);

  const deskUser = composedDeskCreateUserContent({ prompt: "sito barbiere", kind: "site" });
  assert.match(deskUser, /BRIEF:/);
  assert.doesNotMatch(deskUser, /HTML ORIGINALE:/);
  assert.match(COMPOSED_SITE_CREATE_SYSTEM, /SITO WEB desktop/);
  assert.match(COMPOSED_DESK_GRAPHIC_SYSTEM, /screenshot DESKTOP 1280/);
  assert.doesNotMatch(COMPOSED_SITE_CREATE_SYSTEM, /Rispondi SOLO JSON/);
});
