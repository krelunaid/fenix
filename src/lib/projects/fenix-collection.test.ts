import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  FENIX_COLLECTION_RE,
  canonicalFenixCollection,
  collectionForBrief,
  extractFenixCollectionHits,
  invalidFenixCollectionError,
  normalizeFenixCollection,
  parseFenixCollection,
  rewriteFenixCollectionCode,
  rewriteFenixCollections,
  slugFenixCollection,
} from "./fenix-collection.ts";
import { parseCloudCollection, CLOUD_COLLECTION_RE } from "./cloud-data.ts";
import { canPublishHtml, validateProductHtml } from "./validate-html.ts";
import { blocksPublish, evaluateContract, planContract, contractInstruction } from "../ai/build-contract.ts";
import { formatPrefix } from "./infer.ts";
import { isPublishable } from "./recover.ts";
import { discoverAppCollection } from "./dashboard-crud.ts";
import { dashboardCrudScript } from "./fenix-crud-runtime.ts";
import { ensureFenixAdapter } from "./fenix-adapter.ts";

const here = dirname(fileURLToPath(import.meta.url));
const INVALID = readFileSync(join(here, "fixtures/vesti-invalid-collection.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/vesti.html"), "utf8");
const PRODUCTION = readFileSync(join(here, "fixtures/vesti-production.html"), "utf8");
const ARTIFACT = JSON.parse(readFileSync(join(here, "fixtures/vesti-eval.json"), "utf8")) as {
  failingCollection: string;
  validCollection: string;
  canonicalCollection: string;
  unrewritableCollection: string;
  hole: string;
  runtimeError: string;
};
const SLASH = INVALID.replace('var COL = "capi vesti"', 'var COL = "capi/abiti"');

describe("Fenix collection tokens", () => {
  it("reproduces the production Vesti value as spaced COL = capi vesti, not a query literal", () => {
    assert.equal(ARTIFACT.failingCollection, "capi vesti");
    assert.equal(ARTIFACT.canonicalCollection, "capi");
    assert.match(ARTIFACT.hole, /COL = /);
    assert.equal(parseFenixCollection("capi vesti"), null);
    assert.equal(parseFenixCollection("capi"), "capi");
    assert.equal(parseFenixCollection("../private"), null);
    assert.equal(parseFenixCollection("__proto__"), null);
    assert.equal(parseFenixCollection("capi/abiti"), null);
    assert.equal(parseCloudCollection("capi vesti"), null);
    assert.equal(CLOUD_COLLECTION_RE.source, FENIX_COLLECTION_RE.source);
    assert.match(PRODUCTION, /var COL = "capi vesti"/);
    assert.match(PRODUCTION, /Fenix\.data\.query\(COL\)/);
    assert.doesNotMatch(PRODUCTION, /Fenix\.data\.query\(["']capi vesti["']\)/);
    const hits = extractFenixCollectionHits(PRODUCTION);
    assert.ok(hits.some((hit) => hit.raw === "capi vesti" && hit.api === "data" && !hit.valid));
    assert.match(invalidFenixCollectionError(PRODUCTION), /capi vesti/);
    const invalidHits = extractFenixCollectionHits(INVALID);
    assert.ok(invalidHits.some((hit) => hit.raw === "capi vesti" && hit.api === "data" && !hit.valid));
    assert.equal(invalidFenixCollectionError(VALID), "");
  });

  it("maps wardrobe aliases to capi and refuses to slugify unknown spaced labels", () => {
    assert.equal(canonicalFenixCollection("capi vesti"), "capi");
    assert.equal(canonicalFenixCollection("capi_vesti"), "capi");
    assert.equal(canonicalFenixCollection("guardaroba"), "capi");
    assert.equal(canonicalFenixCollection("foo bar"), null);
    assert.equal(canonicalFenixCollection("capi/abiti"), null);
    assert.equal(slugFenixCollection("capi vesti"), "capi");
    assert.equal(slugFenixCollection("città"), "citta");
    assert.equal(slugFenixCollection("../private"), null);
    assert.equal(slugFenixCollection("capi/abiti"), null);
    assert.equal(normalizeFenixCollection("capi vesti", "capi"), "capi");
    assert.equal(collectionForBrief("Vesti armadio di casa"), "capi");
    assert.equal(collectionForBrief("Taccuino in tasca"), "voci");
  });

  it("rewrites production COL to capi so the contract can ready, and still blocks slash tokens", () => {
    const brief = `${formatPrefix("app")}Vesti: armadio di casa, registra i capi.`;
    const contract = planContract(brief);
    assert.equal(contract.entities[0]?.name, "capi");
    assert.match(contractInstruction(contract), /collezioni Fenix.data: capi/);
    assert.match(contractInstruction(contract), /capi vesti/);
    const rewritten = rewriteFenixCollections(PRODUCTION);
    assert.match(rewritten, /var COL = "capi"/);
    assert.doesNotMatch(rewritten, /var COL = "capi vesti"/);
    assert.equal(invalidFenixCollectionError(rewriteFenixCollectionCode(rewritten)), "");
    const adapted = ensureFenixAdapter(PRODUCTION);
    assert.match(adapted, /var COL = "capi"/);
    const report = validateProductHtml(PRODUCTION, { kind: "app" });
    assert.equal(report.ok, true, report.errors.join(" · "));
    assert.equal(canPublishHtml(PRODUCTION, "app", "vesti-prod"), true);
    const evaluation = evaluateContract({
      html: PRODUCTION,
      files: [{ path: "index.html", content: PRODUCTION }],
      contract,
      kind: "app",
    });
    assert.equal(evaluation.ok, true, evaluation.checks.filter((c) => !c.ok).map((c) => `${c.id}:${c.detail}`).join(" · "));
    assert.equal(blocksPublish(PRODUCTION, "app", undefined, brief), "");
    assert.equal(
      isPublishable({ status: "ready", html: PRODUCTION, kind: "app", prompt: brief }),
      true,
    );
    const slashHits = extractFenixCollectionHits(SLASH);
    assert.ok(slashHits.some((hit) => hit.raw === "capi/abiti" && !hit.valid));
    assert.equal(canonicalFenixCollection("capi/abiti"), null);
    assert.equal(rewriteFenixCollectionCode('var COL = "capi/abiti"; Fenix.data.query(COL)').includes("capi/abiti"), true);
    const slashReport = validateProductHtml(SLASH, { kind: "app" });
    assert.equal(slashReport.ok, false);
    assert.ok(slashReport.errors.some((e) => /collezione non valido/.test(e)));
    assert.equal(canPublishHtml(SLASH, "app", "vesti-slash"), false);
    assert.match(blocksPublish(SLASH, "app", undefined, brief), /collezione non valido/);
    assert.equal(
      isPublishable({ status: "ready", html: SLASH, kind: "app", prompt: brief }),
      false,
    );
    const good = evaluateContract({
      html: VALID,
      files: [{ path: "index.html", content: VALID }],
      contract,
      kind: "app",
    });
    assert.equal(good.ok, true, good.checks.filter((c) => !c.ok).map((c) => `${c.id}:${c.detail}`).join(" · "));
    assert.equal(canPublishHtml(VALID, "app", "vesti"), true);
    assert.equal(blocksPublish(VALID, "app", undefined, brief), "");
  });

  it("does not feed invalid names into the dashboard CRUD injector", () => {
    assert.equal(discoverAppCollection(`window.Fenix.data.query("capi vesti")`), "items");
    assert.equal(discoverAppCollection(VALID), "capi");
    assert.match(dashboardCrudScript("capi vesti"), /var COL = "capi"/);
    assert.match(dashboardCrudScript("../private"), /var COL = "items"/);
  });
});
