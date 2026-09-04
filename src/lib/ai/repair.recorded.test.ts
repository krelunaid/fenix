import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseBuildOutput } from "./parse.ts";
import { gateBuildResult, repairBuild } from "./repair.ts";
import { CONTRACT_REPAIR_MAX } from "./build-contract.ts";

/** Recorded polish/repair path. Not live-verified against xAI. */
export const POLISH_REPAIR_LIVE_VERIFIED = false as const;

const here = dirname(fileURLToPath(import.meta.url));
const RECORDED_DIR = join(here, "fixtures/recorded");
const SITE_BRIEF = "FORMATO: sito web. kind=site. sito di musica";

function loadRecorded(name: string): string {
  return readFileSync(join(RECORDED_DIR, name), "utf8");
}

function mockCompletion(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

describe("polish/repair recorded responses (not live-verified)", () => {
  it("parses a declared worker-shaped payload through parseBuildOutput and gates it without fetching xAI", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const manifest = JSON.parse(loadRecorded("manifest.json")) as {
      liveVerified: boolean;
      provenance: string;
    };
    assert.equal(manifest.liveVerified, false);
    assert.match(manifest.provenance, /Not live xAI/);
    const recorded = loadRecorded("complete-site.txt");
    const parsed = parseBuildOutput(recorded, "site", SITE_BRIEF);
    assert.ok(parsed, "parseBuildOutput must accept the declared worker-shaped fixture");
    assert.equal(parsed.kind, "site");
    assert.match(parsed.html, /<section\b/i);
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      throw new Error("xAI fetch forbidden in recorded mock");
    }) as typeof fetch;
    try {
      const gated = await gateBuildResult({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: parsed,
        repair: async () => {
          throw new Error("complete payload must not repair");
        },
      });
      assert.equal(fetchHits, 0, "must not call xAI");
      assert.equal("error" in gated, false, (gated as { error?: string }).error);
      if ("error" in gated) throw new Error(gated.error);
      assert.match(gated.result.html, /data-fenix-adapter|window\.Fenix/);
      assert.equal(gated.report.ok, true);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("repairs an incomplete payload once through repairBuild with injected mock transport", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    assert.equal(CONTRACT_REPAIR_MAX, 2);
    const incomplete = parseBuildOutput(loadRecorded("incomplete-site.txt"), "site", SITE_BRIEF);
    assert.ok(incomplete, "incomplete fixture must still parse");
    const complete = loadRecorded("complete-site.txt");
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(complete);
    }) as typeof fetch;
    try {
      const gated = await gateBuildResult({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: incomplete,
        repair: repairBuild,
      });
      assert.equal(fetchHits, 1, "incomplete payload must hit mock repair once");
      assert.equal("error" in gated, false, (gated as { error?: string }).error);
      if ("error" in gated) throw new Error(gated.error);
      assert.match(gated.result.html, /data-fenix-adapter|window\.Fenix/);
      assert.match(gated.result.html, /<nav\b/i);
      assert.equal(gated.report.ok, true);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("stops after CONTRACT_REPAIR_MAX=2 when the mock repair stays invalid", async () => {
    assert.equal(CONTRACT_REPAIR_MAX, 2);
    const incomplete = parseBuildOutput(loadRecorded("incomplete-site.txt"), "site", SITE_BRIEF);
    assert.ok(incomplete);
    const stillBroken = loadRecorded("incomplete-site.txt");
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(stillBroken);
    }) as typeof fetch;
    try {
      const gated = await gateBuildResult({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: incomplete,
        repair: repairBuild,
      });
      assert.equal(fetchHits, CONTRACT_REPAIR_MAX);
      assert.equal("error" in gated, true, "gate must fail after max repairs");
      if (!("error" in gated)) throw new Error("expected gate error");
      assert.match(gated.error, /completo|sezioni|navigazione|Fenix/i);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("rejects an invalid payload from parser and from repairBuild", async () => {
    const invalid = loadRecorded("invalid.txt");
    assert.equal(parseBuildOutput(invalid, "site", SITE_BRIEF), null);
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      return mockCompletion(invalid);
    }) as typeof fetch;
    try {
      const repaired = await repairBuild({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        html: "<p>vuoto</p>",
        error: "HTML assente o troppo corto.",
      });
      assert.equal(fetchHits, 1);
      assert.equal(repaired, null);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
