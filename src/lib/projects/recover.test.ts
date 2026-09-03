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
import { canPublishHtml } from "./validate-html.ts";
import { looksLikeLeakedCss } from "./color-scheme.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");
const BROKEN = readFileSync(join(here, "fixtures/broken-flusso.html"), "utf8");
const BOTTEGA = readFileSync(join(here, "fixtures/bottega-orders-crash.html"), "utf8");
const LEAKED_CSS = readFileSync(join(here, "fixtures/leaked-phone-css.html"), "utf8");

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

  it("dedupes persisted Riprendo/Partito pairs on rehydrate of a live job", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        status: "building",
        visualJobId: "job-dup",
        visualJobStatus: "run",
        visualJobStartedAt: now - 8_000,
        buildLog: [
          "Motore visivo in sottofondo",
          "Partito",
          "Riprendo rifinitura",
          "Partito",
          "Riprendo rifinitura",
          "Motore visivo ancora in corso",
        ],
        updatedAt: now,
      }),
      now,
    );
    assert.equal(recovered.status, "building");
    assert.equal(recovered.visualJobId, "job-dup");
    assert.deepEqual(recovered.buildLog, [
      "Motore visivo in sottofondo",
      "Partito",
      "Riprendo rifinitura",
      "Motore visivo ancora in corso",
    ]);
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

  it("restores lastStableHtml on a definitive error and keeps Pubblica closed", () => {
    const recovered = recoverPersistedProject(
      seed({
        status: "error",
        error: RESUME_ERROR,
        html: BROKEN,
        lastStableHtml: VALID,
        lastStableFiles: [{ path: "index.html", content: VALID }],
      }),
    );
    assert.equal(recovered.status, "error");
    assert.equal(recovered.html, VALID);
    assert.equal(recovered.lastStableHtml, VALID);
    assert.equal(recovered.files?.[0]?.path, "index.html");
    assert.equal(isPublishable(recovered), false);
    assert.equal(needsResume(recovered), true);
  });

  it("does not restore lastStable while a live job is still building", () => {
    const now = Date.now();
    const recovered = recoverPersistedProject(
      seed({
        html: VALID,
        lastStableHtml: VALID,
        visualJobId: "job-live",
        visualJobStatus: "run",
        visualJobStartedAt: now - 8_000,
        updatedAt: now,
      }),
      now,
    );
    assert.equal(recovered.status, "building");
    assert.equal(recovered.html, VALID);
    assert.equal(recovered.visualJobId, "job-live");
    assert.equal(isPublishable(recovered), false);
  });

  it("does not publish a building draft whose HTML dumps phone-kit CSS", () => {
    const recovered = recoverPersistedProject(
      seed({ html: LEAKED_CSS, status: "building", updatedAt: Date.now() - 5_000 }),
    );
    assert.equal(recovered.status, "building");
    assert.equal(recovered.html, LEAKED_CSS);
    assert.equal(isPublishable(recovered), false);
    assert.equal(canPublishHtml(LEAKED_CSS, "app"), false);
  });

  it("strips leaked CSS from a ready project so the dump is gone", () => {
    const recovered = recoverPersistedProject(seed({ html: LEAKED_CSS, status: "ready" }));
    assert.equal(looksLikeLeakedCss(recovered.html), false);
    assert.match(recovered.html, /data-fenix-rescued/);
    const markup = recovered.html.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
    assert.doesNotMatch(markup, /\.fk-hello\s*\{/);
  });
});

describe("isPublishable", () => {
  it("is false for drafts even when the HTML would compile", () => {
    assert.equal(isPublishable({ status: "building", html: VALID, kind: "app", id: "p1" }), false);
    assert.equal(isPublishable({ status: "error", html: VALID, kind: "app", id: "p1" }), false);
    assert.equal(isPublishable({ status: "ready", html: "", kind: "app", id: "p1" }), false);
  });
});
