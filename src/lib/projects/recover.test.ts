import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { DEMOS } from "./demos.ts";
import {
  STALE_BUILD_MS,
  RESUME_ERROR,
  recoverPersistedProject,
  isPublishable,
  needsResume,
} from "./recover.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");
const BROKEN = readFileSync(join(here, "fixtures/broken-flusso.html"), "utf8");

function seed(patch: Partial<Parameters<typeof recoverPersistedProject>[0]>) {
  return {
    id: "p1",
    status: "building" as const,
    html: VALID,
    kind: "app" as const,
    updatedAt: Date.now(),
    ...patch,
  };
}

describe("recoverPersistedProject", () => {
  it("never auto-promotes stale building+valid HTML to ready", () => {
    const recovered = recoverPersistedProject(
      seed({ updatedAt: Date.now() - STALE_BUILD_MS - 1_000 }),
    );
    assert.equal(recovered.status, "error");
    assert.equal(recovered.error, RESUME_ERROR);
    assert.equal(isPublishable(recovered), false);
    assert.equal(needsResume(recovered), true);
  });

  it("keeps a fresh building+html draft as building, not ready", () => {
    const recovered = recoverPersistedProject(seed({ updatedAt: Date.now() - 5_000 }));
    assert.equal(recovered.status, "building");
    assert.equal(isPublishable(recovered), false);
    assert.equal(needsResume(recovered), false);
  });

  it("marks building without HTML as interrupted", () => {
    const recovered = recoverPersistedProject(seed({ html: "", updatedAt: Date.now() - 1_000 }));
    assert.equal(recovered.status, "error");
    assert.match(recovered.error || "", /Interrotto/);
    assert.equal(isPublishable(recovered), false);
  });

  it("demotes ready without a valid final srcdoc", () => {
    const recovered = recoverPersistedProject(seed({ status: "ready", html: BROKEN }));
    assert.equal(recovered.status, "error");
    assert.equal(isPublishable(recovered), false);
  });

  it("demotes ready without HTML", () => {
    const recovered = recoverPersistedProject(seed({ status: "ready", html: "" }));
    assert.equal(recovered.status, "error");
    assert.equal(isPublishable(recovered), false);
  });

  it("keeps a finished valid project ready and publishable", () => {
    const recovered = recoverPersistedProject(seed({ status: "ready" }));
    assert.equal(recovered.status, "ready");
    assert.equal(isPublishable(recovered), true);
  });

  it("keeps every demo ready after rehydrate", () => {
    for (const demo of Object.values(DEMOS)) {
      const recovered = recoverPersistedProject({
        id: demo.id,
        status: "ready" as const,
        html: demo.html,
        kind: demo.kind,
        updatedAt: Date.now(),
        palette: demo.palette,
        error: undefined,
      });
      assert.equal(recovered.status, "ready", `${demo.id}: ${recovered.error || ""}`);
      assert.equal(isPublishable(recovered), true, demo.id);
    }
  });
});

describe("isPublishable", () => {
  it("is false for drafts even when the HTML would compile", () => {
    assert.equal(isPublishable({ status: "building", html: VALID, kind: "app", id: "p1" }), false);
    assert.equal(isPublishable({ status: "error", html: VALID, kind: "app", id: "p1" }), false);
    assert.equal(isPublishable({ status: "ready", html: "", kind: "app", id: "p1" }), false);
  });
});
