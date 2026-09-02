import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMERGENT_COMPETITIVE_AXES,
  EMERGENT_COMPETITIVE_SOURCES,
  competitiveBenchmarkVerdict,
} from "./emergent-competitive-benchmark.ts";

describe("Emergent competitive benchmark is evidence-led", () => {
  it("covers all ten requested axes with dated first-party sources", () => {
    assert.equal(EMERGENT_COMPETITIVE_AXES.length, 10);
    assert.ok(EMERGENT_COMPETITIVE_SOURCES.length >= 4);
    const sourceIds = new Set(EMERGENT_COMPETITIVE_SOURCES.map((source) => source.id));
    for (const source of EMERGENT_COMPETITIVE_SOURCES) {
      assert.match(source.url, /^https:\/\/(?:help\.)?emergent\.sh\//);
      assert.equal(source.retrieved, "2026-09-02");
    }
    for (const axis of EMERGENT_COMPETITIVE_AXES) {
      assert.ok(axis.sourceIds.length > 0);
      assert.ok(axis.sourceIds.every((id) => sourceIds.has(id)));
      assert.equal(axis.headToHeadRun, false);
      assert.ok(axis.fenixEvidence.length > 20);
      assert.ok(axis.remainingGap.length > 20);
    }
  });

  it("does not convert internal 100/100 into parity or superiority", () => {
    const verdict = competitiveBenchmarkVerdict();
    assert.deepEqual(verdict.counts, { demonstrated: 2, partial: 7, gap: 1 });
    assert.equal(verdict.headToHead, "not-run");
    assert.equal(verdict.parity, "unproven");
    assert.equal(verdict.superiority, "unproven");
  });
});
