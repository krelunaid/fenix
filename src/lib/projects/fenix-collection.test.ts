import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  FENIX_COLLECTION_RE,
  collectionForBrief,
  extractFenixCollectionHits,
  invalidFenixCollectionError,
  normalizeFenixCollection,
  parseFenixCollection,
  slugFenixCollection,
} from "./fenix-collection.ts";
import { parseCloudCollection, CLOUD_COLLECTION_RE } from "./cloud-data.ts";
import { canPublishHtml, validateProductHtml } from "./validate-html.ts";
import { blocksPublish, evaluateContract, planContract, contractInstruction } from "../ai/build-contract.ts";
import { formatPrefix } from "./infer.ts";
import { isPublishable } from "./recover.ts";
import { discoverAppCollection } from "./dashboard-crud.ts";
import { dashboardCrudScript } from "./fenix-crud-runtime.ts";

const here = dirname(fileURLToPath(import.meta.url));
const INVALID = readFileSync(join(here, "fixtures/vesti-invalid-collection.html"), "utf8");
const VALID = readFileSync(join(here, "fixtures/vesti.html"), "utf8");
const ARTIFACT = JSON.parse(readFileSync(join(here, "fixtures/vesti-eval.json"), "utf8")) as {
  failingCollection: string;
  validCollection: string;
  runtimeError: string;
};

describe("Fenix collection tokens", () => {
  it("identifies the production Vesti failure as the spaced label capi vesti", () => {
    assert.equal(ARTIFACT.failingCollection, "capi vesti");
    assert.equal(parseFenixCollection("capi vesti"), null);
    assert.equal(parseFenixCollection("capi"), "capi");
    assert.equal(parseFenixCollection("../private"), null);
    assert.equal(parseFenixCollection("__proto__"), null);
    assert.equal(parseFenixCollection("capi/abiti"), null);
    assert.equal(parseCloudCollection("capi vesti"), null);
    assert.equal(CLOUD_COLLECTION_RE.source, FENIX_COLLECTION_RE.source);
    const hits = extractFenixCollectionHits(INVALID);
    assert.ok(hits.some((hit) => hit.raw === "capi vesti" && hit.api === "data" && !hit.valid));
    assert.match(invalidFenixCollectionError(INVALID), /capi vesti/);
    assert.equal(invalidFenixCollectionError(VALID), "");
  });

  it("slugs planner labels without accepting traversal", () => {
    assert.equal(slugFenixCollection("capi vesti"), "capi_vesti");
    assert.equal(slugFenixCollection("città"), "citta");
    assert.equal(slugFenixCollection("../private"), null);
    assert.equal(slugFenixCollection("capi/abiti"), null);
    assert.equal(normalizeFenixCollection("capi vesti", "capi"), "capi_vesti");
    assert.equal(collectionForBrief("Vesti armadio di casa"), "capi");
    assert.equal(collectionForBrief("Taccuino in tasca"), "voci");
  });

  it("locks the Vesti contract onto capi and fails the production-faithful HTML", () => {
    const brief = `${formatPrefix("app")}Vesti: armadio di casa, registra i capi.`;
    const contract = planContract(brief);
    assert.equal(contract.entities[0]?.name, "capi");
    assert.match(contractInstruction(contract), /collezioni Fenix.data: capi/);
    assert.match(contractInstruction(contract), /capi vesti/);
    const report = validateProductHtml(INVALID, { kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /collezione non valido/.test(e)));
    assert.equal(canPublishHtml(INVALID, "app", "vesti-bad"), false);
    const evaluation = evaluateContract({
      html: INVALID,
      files: [{ path: "index.html", content: INVALID }],
      contract,
      kind: "app",
    });
    assert.equal(evaluation.ok, false);
    const collections = evaluation.checks.find((c) => c.id === "collections");
    assert.equal(collections?.ok, false);
    assert.match(blocksPublish(INVALID, "app", undefined, brief), /collezione non valido/);
    assert.equal(
      isPublishable({ status: "ready", html: INVALID, kind: "app", prompt: brief }),
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
    assert.match(dashboardCrudScript("capi vesti"), /var COL = "capi_vesti"/);
    assert.match(dashboardCrudScript("../private"), /var COL = "items"/);
  });
});
