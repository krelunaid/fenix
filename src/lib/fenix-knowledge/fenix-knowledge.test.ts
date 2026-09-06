import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { formatPrefix } from "../projects/infer.ts";
import { composeProduct } from "../ai/compose-product.ts";
import { createBuildRequest } from "../ai/build-request.ts";
import { catalogKnowledge } from "./catalog.ts";
import { consultKnowledge } from "./consult.ts";
import { knowledgeRoot, loadKnowledgeFromDisk } from "./load.ts";
import { loadKnowledge } from "./runtime.ts";
import { fenixReviewer, reviewDraftForBuildLoop } from "./reviewer.ts";
import { DEFAULT_COMPLETENESS_THRESHOLD, KNOWLEDGE_CATEGORIES } from "./types.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const WATER_BRIEF = `${formatPrefix("app")}NordAcqua: consegne acqua, bottiglia, serbatoio, dipendenti in campo.`;
const BARBER_BRIEF = `${formatPrefix("app")}mi crei un app da parrucchieri stile Barber shop`;
const LIBRARY_BRIEF = `${formatPrefix("app")}libreria di quartiere, catalogo libri e prestiti, scaffali.`;

describe("fenix-knowledge store", () => {
  it("loads every category from disk and the runtime catalog", () => {
    const disk = loadKnowledgeFromDisk(knowledgeRoot());
    const runtime = loadKnowledge();
    const catalog = catalogKnowledge();
    assert.equal(disk.extractNotClone, true);
    assert.equal(disk.completenessRetryThreshold, 90);
    assert.deepEqual(
      disk.categories.map((c) => c.id),
      [...KNOWLEDGE_CATEGORIES],
    );
    assert.deepEqual(
      runtime.categories.map((c) => c.id),
      [...KNOWLEDGE_CATEGORIES],
    );
    const diskPacks = disk.packs.map((p) => p.id).sort();
    const catalogPacks = catalog.packs.map((p) => p.id).sort();
    assert.deepEqual(diskPacks, catalogPacks);
    for (const pack of disk.packs) {
      const embedded = catalog.packs.find((p) => p.id === pack.id);
      assert.ok(embedded, pack.id);
      assert.deepEqual(
        pack.rules.map((r) => r.id).sort(),
        embedded!.rules.map((r) => r.id).sort(),
        pack.id,
      );
    }
    assert.ok(existsSync(join(repo, "fenix-knowledge", "README.md")));
    const readme = readFileSync(join(repo, "fenix-knowledge", "README.md"), "utf8");
    assert.match(readme, /extract|estrai/i);
    assert.match(readme, /not.*clone|non clonare/i);
    assert.match(readme, /10 Emergent/);
    assert.match(readme, /golden-projects/);
  });

  it("consultKnowledge pulls ui-patterns for water and barber briefs", () => {
    const water = consultKnowledge(WATER_BRIEF, "app");
    const barber = consultKnowledge(BARBER_BRIEF, "app");
    const library = consultKnowledge(LIBRARY_BRIEF, "app");
    assert.ok(water.categories.includes("ui-patterns"), String(water.categories));
    assert.ok(barber.categories.includes("ui-patterns"), String(barber.categories));
    assert.ok(water.packs.some((p) => p.id === "water-craft"));
    assert.ok(water.packs.some((p) => p.id === "premium-default-floor"));
    assert.ok(barber.packs.some((p) => p.id === "barber-corto"));
    assert.ok(barber.packs.some((p) => p.id === "premium-default-floor"));
    assert.ok(library.packs.some((p) => p.id === "library-editorial"));
    assert.doesNotMatch(water.instruction, /clonare layout AcquaGt|Corto screens/i);
    assert.match(water.instruction, /consultKnowledge/);
    assert.match(barber.instruction, /espresso|Prenota|raspberry/i);
    assert.equal(
      barber.packs.some((p) => p.id === "water-craft"),
      false,
      "barber must not pull water craft",
    );
    assert.equal(
      water.packs.some((p) => p.id === "barber-corto"),
      false,
      "water must not pull barber Corto pack",
    );
  });

  it("compose and create consult knowledge before writing", () => {
    const water = composeProduct(WATER_BRIEF);
    const barber = composeProduct(BARBER_BRIEF);
    assert.ok(water.knowledge.packs.some((p) => p.id === "water-craft"));
    assert.ok(barber.knowledge.packs.some((p) => p.id === "barber-corto"));
    assert.match(water.polish, /consultKnowledge/);
    assert.match(barber.polish, /consultKnowledge/);
    assert.match(water.polish, /water-craft/);
    assert.match(barber.polish, /barber-corto/);
    const request = createBuildRequest({ prompt: BARBER_BRIEF, kind: "app" });
    assert.ok(request.knowledge?.packs.some((p) => p.id === "barber-corto"));
    assert.match(request.instruction, /consultKnowledge/);
    const runBuild = readFileSync(join(repo, "src/lib/ai/run-build.ts"), "utf8");
    assert.match(runBuild, /reviewDraftForBuildLoop/);
    assert.match(runBuild, /reviewGate\.retry/);
  });
});

describe("fenixReviewer", () => {
  it("flags weak utility HTML below the completeness threshold", () => {
    const weak = `<!doctype html><html><body><h1>Utility</h1><p>Hello world</p></body></html>`;
    const review = fenixReviewer({ html: weak, brief: WATER_BRIEF, kind: "app" });
    assert.ok(review.scores.completeness < DEFAULT_COMPLETENESS_THRESHOLD, String(review.scores.completeness));
    assert.equal(review.retry, true);
    assert.match(review.retryInstruction, /REVIEWER RETRY/);
    const gate = reviewDraftForBuildLoop({ html: weak, brief: WATER_BRIEF, kind: "app" });
    assert.equal(gate.retry, true);
    assert.match(gate.log, /completeness \d+ < 90 — retry/);
    const custom = fenixReviewer({ html: weak, kind: "app", threshold: 10 });
    assert.equal(custom.threshold, 10);
  });

  it("lets a composed water seed pass completeness", () => {
    const product = composeProduct(WATER_BRIEF);
    assert.ok(
      product.review.scores.completeness >= DEFAULT_COMPLETENESS_THRESHOLD,
      String(product.review.scores.completeness),
    );
    assert.equal(product.review.retry, false);
  });
});
