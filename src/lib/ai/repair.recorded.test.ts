import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { gateIncompleteHtml, ensureFenixAdapter, type GateOutcome } from "../projects/fenix-adapter.ts";
import { DEFAULT_PALETTE, type Palette, type ProjectKind } from "../projects/types.ts";

/** Recorded polish/repair path. Not live-verified against xAI. */
export const POLISH_REPAIR_LIVE_VERIFIED = false as const;

const here = dirname(fileURLToPath(import.meta.url));
const SITE_BRIEF = "FORMATO: sito web. kind=site. sito di musica";

function wrapRecorded(html: string, name: string, kind: "app" | "site"): string {
  return `<<<META>>>
{"name":${JSON.stringify(name)},"tagline":"Collezione","kind":${JSON.stringify(kind)},"summary":"Registrato","direction":"inchiostro","palette":{"bg":"#120e0c","surface":"#1c1612","elevated":"#241c18","fg":"#f4ead8","muted":"#a89078","accent":"#c4a15a","line":"#3a3028","accentInk":"#120e0c","success":"#3d9a6a","warning":"#c4a15a"}}
<<<HTML>>>
${html}
<<<END>>>`;
}

function htmlFromRecorded(text: string): string {
  const block = text.match(/<<<HTML>>>\s*([\s\S]*?)(?:<<<FILE |<<<END>>>|$)/);
  return (block?.[1] || "").trim();
}

type RecordedProduct = {
  name: string;
  tagline: string;
  kind: ProjectKind;
  summary: string;
  direction: string;
  palette: Palette;
  html: string;
  files: { path: string; content: string }[];
};

function stubFromRecorded(text: string, kind: ProjectKind): RecordedProduct {
  return {
    name: kind === "site" ? "Onda" : "Essenza",
    tagline: "Collezione",
    kind,
    summary: "Registrato",
    direction: "inchiostro",
    palette: DEFAULT_PALETTE,
    html: htmlFromRecorded(text),
    files: [],
  };
}

const RECORDED_SITE_REPAIR = wrapRecorded(
  ensureFenixAdapter(readFileSync(join(here, "../projects/fixtures/music-site-no-fenix.html"), "utf8")),
  "Onda",
  "site",
);

describe("polish/repair recorded responses (not live-verified)", () => {
  it("parses a recorded worker payload and gates it without fetching xAI", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const parseSrc = readFileSync(join(here, "parse.ts"), "utf8");
    const repairSrc = readFileSync(join(here, "repair.ts"), "utf8");
    assert.match(parseSrc, /export function parseBuildOutput/);
    assert.match(repairSrc, /export async function gateBuildResult/);
    assert.match(repairSrc, /repairBuild/);
    assert.doesNotMatch(repairSrc, /liveVerified:\s*true/);
    const recorded = RECORDED_SITE_REPAIR;
    const parsed = stubFromRecorded(recorded, "site");
    assert.match(parsed.html, /data-fenix-adapter|window\.Fenix/);
    let fetchHits = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      throw new Error("xAI fetch forbidden in recorded mock");
    }) as typeof fetch;
    try {
      const gated = await gateIncompleteHtml({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: parsed,
        repair: async () => {
          throw new Error("repair mock must not hit xAI");
        },
      });
      assert.equal(fetchHits, 0, "must not call xAI");
      assert.equal("error" in gated, false, (gated as { error?: string }).error);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("applies a declared mock repair to a recorded incomplete payload", async () => {
    assert.equal(POLISH_REPAIR_LIVE_VERIFIED, false);
    const incomplete = wrapRecorded(
      "<!DOCTYPE html><html><body><p>vuoto</p></body></html>",
      "Onda",
      "site",
    );
    const parsed = stubFromRecorded(incomplete, "site");
    let fetchHits = 0;
    let repairs = 0;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchHits += 1;
      throw new Error("xAI fetch forbidden in recorded mock");
    }) as typeof fetch;
    try {
      const gated: GateOutcome = await gateIncompleteHtml({
        apiKey: "unused",
        prompt: SITE_BRIEF,
        result: parsed,
        repair: async () => {
          repairs += 1;
          return stubFromRecorded(RECORDED_SITE_REPAIR, "site");
        },
      });
      assert.equal(fetchHits, 0, "must not call xAI");
      assert.ok(repairs >= 1, "incomplete recorded payload must hit mock repair");
      if (!("error" in gated)) {
        assert.match(gated.result.html, /data-fenix-adapter|window\.Fenix/);
      }
    } finally {
      globalThis.fetch = prev;
    }
  });
});
