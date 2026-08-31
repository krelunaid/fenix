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
const BOTTEGA = readFileSync(join(here, "fixtures/bottega-orders-crash.html"), "utf8");

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

  it("demotes a ready site whose HTML throws on null.orders", () => {
    const recovered = recoverPersistedProject(
      seed({
        id: "bottega",
        status: "ready",
        html: BOTTEGA,
        kind: "site",
        prompt: "FORMATO: sito web. kind=site. Bottega del Tornio",
      }),
    );
    assert.equal(recovered.status, "error");
    assert.match(String(recovered.error), /gestionale|orders/i);
    assert.equal(isPublishable(recovered), false);
  });

  it("does not rewrite building overlay or error-resume HTML", () => {
    const building = recoverPersistedProject(seed({ status: "building", updatedAt: Date.now() }));
    assert.equal(building.status, "building");
    assert.equal(building.html, VALID);
    assert.equal(building.error, undefined);
    assert.doesNotMatch(building.html, /data-fenix-crud/);

    const resume = recoverPersistedProject(
      seed({ status: "error", error: RESUME_ERROR, updatedAt: Date.now() }),
    );
    assert.equal(resume.status, "error");
    assert.equal(resume.error, RESUME_ERROR);
    assert.equal(resume.html, VALID);
    assert.equal(needsResume(resume), true);
  });

  it("does not turn building + live visual jobId into a stale resume error", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        updatedAt: now - STALE_BUILD_MS - 5_000,
        visualJobId: "job-live",
        visualJobStatus: "run",
        visualJobStartedAt: now - 8_000,
      }),
      now,
    );
    assert.equal(recovered.status, "building");
    assert.equal(recovered.visualJobId, "job-live");
    assert.equal(recovered.error, undefined);
    assert.equal(isPublishable(recovered), false);
    assert.equal(needsResume(recovered), false);
  });

  it("expires a visual job past TTL and asks to resume", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        updatedAt: now - STALE_BUILD_MS - 5_000,
        visualJobId: "job-old",
        visualJobStatus: "run",
        visualJobStartedAt: now - 21 * 60 * 1000,
      }),
      now,
    );
    assert.equal(recovered.status, "error");
    assert.equal(recovered.error, RESUME_ERROR);
    assert.equal(recovered.visualJobId, undefined);
    assert.equal(needsResume(recovered), true);
  });

  it("error + JOB_STILL_RUNNING + stale visualJobId reloads to a null job", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        status: "error",
        error: "JOB_STILL_RUNNING",
        visualJobId: "job-stale",
        visualJobStatus: "run",
        visualJobStartedAt: now - 21 * 60 * 1000,
        buildLog: ["Motore visivo in sottofondo", "Partito", "Partito"],
        updatedAt: now,
      }),
      now,
    );
    assert.equal(recovered.status, "error");
    assert.equal(recovered.visualJobId, undefined);
    assert.equal(recovered.visualJobStatus, undefined);
    assert.equal(recovered.visualJobStartedAt, undefined);
    assert.equal(recovered.error, RESUME_ERROR);
    assert.doesNotMatch(String(recovered.error), /JOB_STILL_RUNNING/);
    assert.equal(isPublishable(recovered), false);
    assert.equal(needsResume(recovered), true);
    assert.equal((recovered.buildLog ?? []).includes("Partito"), false);
    assert.equal((recovered.buildLog ?? []).includes("Motore visivo in sottofondo"), false);
  });

  it("error + JOB_STILL_RUNNING + live job reattaches as building, no drop", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        status: "error",
        error: "JOB_STILL_RUNNING",
        visualJobId: "job-terra",
        visualJobStatus: "run",
        visualJobStartedAt: now - 8_000,
        buildLog: ["Motore visivo in sottofondo", "Partito"],
        updatedAt: now,
      }),
      now,
    );
    assert.equal(recovered.status, "building");
    assert.equal(recovered.visualJobId, "job-terra");
    assert.equal(recovered.visualJobStartedAt, now - 8_000);
    assert.equal(recovered.error, undefined);
    assert.equal(isPublishable(recovered), false);
    assert.equal(needsResume(recovered), false);
    assert.ok((recovered.buildLog ?? []).includes("Partito"));
  });

  it("keeps a boot-error message after the leftover job has expired", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        status: "error",
        error: "Errore in avvio: Cannot read properties of null (reading 'orders')",
        html: BOTTEGA,
        kind: "site",
        prompt: "FORMATO: sito web. kind=site. Bottega del Tornio",
        visualJobId: "job-x",
        visualJobStatus: "run",
        visualJobStartedAt: now - 21 * 60 * 1000,
      }),
      now,
    );
    assert.equal(recovered.status, "error");
    assert.equal(recovered.visualJobId, undefined);
    assert.match(String(recovered.error), /orders/);
    assert.doesNotMatch(String(recovered.error), /JOB_STILL_RUNNING/);
    assert.equal(isPublishable(recovered), false);
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
