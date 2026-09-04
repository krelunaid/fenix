import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILD_STAGES, inferStage } from "./build-stages.ts";

describe("inferStage", () => {
  it("names the four visible stages", () => {
    assert.deepEqual([...BUILD_STAGES], ["Direzione visiva", "Codice", "QA", "Rifinitura"]);
  });

  it("maps log lines to the compact overlay index", () => {
    assert.equal(inferStage([]), 0);
    assert.equal(inferStage(["Piano · 6 check"]), 0);
    assert.equal(inferStage(["Contratto"]), 0);
    assert.equal(inferStage(["Direzione visiva"]), 0);
    assert.equal(inferStage(["Palette", "Scrivo il codice HTML"]), 1);
    assert.equal(inferStage(["Codice", "QA checklist"]), 2);
    assert.equal(inferStage(["QA", "Riprendo rifinitura"]), 3);
    assert.equal(inferStage(["Motore visivo in sottofondo"]), 3);
    assert.equal(inferStage(["Anteprima rifinita"]), 3);
  });
});
