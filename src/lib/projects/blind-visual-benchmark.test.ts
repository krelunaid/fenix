import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadLegacyGraphicFixtures, loadGraphicFixtures } from "../ai/graphic-fixtures.ts";
import { loadPremiumFixtures } from "../ai/premium-fixtures.ts";
import {
  BLIND_RUBRIC,
  EXTERNAL_BENCHMARK,
  blindProtocolVerdict,
  runBlindTrial,
  shufflePair,
} from "./blind-visual-benchmark.ts";
import { competitiveBenchmarkVerdict } from "./emergent-competitive-benchmark.ts";

describe("blind visual benchmark protocol", () => {
  it("uses an explicit 10-criterion rubric and never names the producer in labels", () => {
    assert.equal(BLIND_RUBRIC.length, 10);
    const ids = BLIND_RUBRIC.map((r) => r.id);
    for (const need of [
      "hierarchy",
      "composition",
      "density",
      "imagery",
      "originality",
      "typography",
      "color",
      "controls",
      "responsive",
      "a11y",
    ]) {
      assert.ok(ids.includes(need as (typeof ids)[number]), need);
    }
  });

  it("shuffles A/B from the brief seed and keeps the same order on replay", () => {
    const brief = "FORMATO: app. Vetro di Nebbia flaconi.";
    const first = shufflePair(brief, "left", "right");
    const second = shufflePair(brief, "left", "right");
    assert.deepEqual(first, second);
    const other = shufflePair("FORMATO: app. Maison Lumière flaconi.", "left", "right");
    assert.equal(typeof other.A, "string");
  });

  it("scores unlabeled candidates with written motivations and no producer names", () => {
    const legacy = loadLegacyGraphicFixtures().find((f) => f.id === "sfilata-atelier")!;
    const premium = loadPremiumFixtures().find((f) => f.id === "sfilata-inchiostro")!;
    const trial = runBlindTrial({
      briefId: "fashion",
      brief: premium.brief,
      left: { id: legacy.id, html: legacy.html },
      right: { id: premium.id, html: premium.html },
    });
    assert.equal(trial.labels.A, "Candidate A");
    assert.equal(trial.labels.B, "Candidate B");
    assert.doesNotMatch(JSON.stringify(trial.labels), /fenix|emergent|apple/i);
    assert.equal(trial.scores.A.criteria.length, 10);
    for (const side of [trial.scores.A, trial.scores.B]) {
      for (const row of side.criteria) {
        assert.ok(row.motivation.length > 8, row.id);
        assert.doesNotMatch(row.motivation, /fenix|emergent|kreluna|grok/i);
      }
    }
    const premiumSlot = trial.mapping.A === premium.id ? trial.scores.A : trial.scores.B;
    const legacySlot = trial.mapping.A === legacy.id ? trial.scores.A : trial.scores.B;
    const imgP = premiumSlot.criteria.find((c) => c.id === "imagery")!.score;
    const imgL = legacySlot.criteria.find((c) => c.id === "imagery")!.score;
    assert.ok(imgP > imgL, `imagery delta ${imgP} vs ${imgL}`);
  });

  it("declares the external set unavailable and does not assign parity", () => {
    const trials = loadPremiumFixtures().slice(0, 5).map((fix, i) => {
      const legacy = loadLegacyGraphicFixtures()[Math.min(i + 1, 3)]!;
      return runBlindTrial({
        briefId: fix.id,
        brief: fix.brief,
        left: { id: legacy.id, html: legacy.html },
        right: { id: fix.id, html: fix.html },
      });
    });
    const verdict = blindProtocolVerdict(trials);
    assert.equal(EXTERNAL_BENCHMARK.available, false);
    assert.equal(EXTERNAL_BENCHMARK.declaration, "benchmark esterno non disponibile");
    assert.equal(verdict.headToHead, "not-run");
    assert.equal(verdict.parity, "unproven");
    assert.equal(verdict.superiority, "unproven");
    const competitive = competitiveBenchmarkVerdict();
    assert.equal(competitive.parity, "unproven");
    assert.equal(competitive.headToHead, "not-run");
    assert.ok(loadGraphicFixtures().length >= 14);
  });
});
