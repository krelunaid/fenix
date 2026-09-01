import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  ensureFenixAdapter,
  gateIncompleteHtml,
  htmlHasFenixApi,
  type GateOutcome,
} from "./fenix-adapter.ts";
import { validateProductHtml } from "./validate-html.ts";
import type { BuildResult } from "../ai/parse.ts";
import { DEFAULT_PALETTE } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = readFileSync(join(here, "fixtures/music-site-no-fenix.html"), "utf8");
const BOTTEGA = readFileSync(join(here, "fixtures/bottega-orders-crash.html"), "utf8");

function stub(html: string, kind: BuildResult["kind"] = "site"): BuildResult {
  return {
    name: "Onda",
    tagline: "Carica musica",
    kind,
    summary: "Sito di caricamento musicale",
    direction: "inchiostro",
    palette: DEFAULT_PALETTE,
    html,
    files: [],
  };
}

describe("Fenix adapter + gate", () => {
  it("rejects a production-faithful site without Fenix before ready", () => {
    const report = validateProductHtml(SITE, { kind: "site" });
    assert.equal(report.syntaxOk, true, report.errors.join(" · "));
    assert.equal(htmlHasFenixApi(SITE), false);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /API dati Fenix/i.test(e)));
  });

  it("rejects Fenix.load without save (and the reverse)", () => {
    const onlyLoad = `${SITE}<script>window.Fenix.load("x")</script>`;
    const onlySave = `${SITE}<script>window.Fenix.save("x", {})</script>`;
    const onlyObj = `${SITE}<script>window.Fenix = {}</script>`;
    assert.equal(htmlHasFenixApi(onlyLoad), false);
    assert.equal(htmlHasFenixApi(onlySave), false);
    assert.equal(htmlHasFenixApi(onlyObj), false);
    assert.equal(validateProductHtml(onlyLoad, { kind: "site" }).ok, false);
    assert.equal(validateProductHtml(onlySave, { kind: "site" }).ok, false);
  });

  it("accepts only a complete Fenix.data read/write pair", () => {
    const readOnly = `${SITE}<script>window.Fenix.data.query("items")</script>`;
    const writeOnly = `${SITE}<script>window.Fenix.data.insert("items", { id: "1" })</script>`;
    const crud = `${SITE}<script>window.Fenix.data.query("items");window.Fenix.data.insert("items", { id: "1" })</script>`;
    assert.equal(htmlHasFenixApi(readOnly), false);
    assert.equal(htmlHasFenixApi(writeOnly), false);
    assert.equal(htmlHasFenixApi(crud), true);
    assert.equal(validateProductHtml(crud, { kind: "site" }).ok, true);
  });

  it("injects a bridge adapter and the site becomes complete", () => {
    const patched = ensureFenixAdapter(SITE);
    assert.match(patched, /data-fenix-adapter/);
    assert.match(patched, /window\.Fenix/);
    assert.doesNotMatch(patched, /\blocalStorage\b/);
    const report = validateProductHtml(patched, { kind: "site" });
    assert.equal(report.ok, true, report.errors.join(" · "));
    assert.equal(ensureFenixAdapter(patched), patched);
  });

  it("gate patches missing Fenix without calling the LLM", async () => {
    let repairs = 0;
    const gated = await gateIncompleteHtml({
      apiKey: "unused",
      prompt: "mi crei un sito di caricamento musicale. kind=site",
      result: stub(SITE),
      repair: async () => {
        repairs += 1;
        return null;
      },
    });
    assert.equal(repairs, 0);
    assert.equal("error" in gated, false, (gated as { error?: string }).error);
    const ok = gated as Exclude<GateOutcome, { error: string }>;
    assert.match(ok.result.html, /data-fenix-adapter/);
    assert.equal(ok.report.ok, true);
  });

  it("gate retries twice then returns salvage + error, never empty html", async () => {
    const short = "<!DOCTYPE html><html><body><p>vuoto</p></body></html>";
    let repairs = 0;
    const gated = await gateIncompleteHtml({
      apiKey: "unused",
      prompt: "kind=site. sito di musica",
      result: stub(short),
      repair: async () => {
        repairs += 1;
        return stub(short);
      },
    });
    assert.equal(repairs, 2);
    assert.equal("error" in gated, true);
    const fail = gated as Extract<GateOutcome, { error: string }>;
    assert.match(fail.error, /non è completo|non valido/i);
    assert.ok(fail.result?.html, "salvage html must be present");
    assert.match(fail.result!.html, /data-fenix-adapter/);
  });

  it("definitive failure without salvage when HTML is unusable", async () => {
    const gated = await gateIncompleteHtml({
      apiKey: "unused",
      prompt: "kind=app",
      result: stub("nope"),
      repair: async () => null,
    });
    assert.equal("error" in gated, true);
    const fail = gated as Extract<GateOutcome, { error: string }>;
    assert.equal(fail.result, undefined);
    assert.match(fail.error, /non valido|troppo corto/i);
  });

  it("site brief with null.orders is incomplete and repairs twice", async () => {
    let repairs = 0;
    const gated = await gateIncompleteHtml({
      apiKey: "unused",
      prompt: "FORMATO: sito web. kind=site. Bottega del Tornio, vetrina artigiana",
      result: stub(BOTTEGA, "site"),
      repair: async () => {
        repairs += 1;
        return stub(BOTTEGA, "site");
      },
    });
    assert.equal(repairs, 2);
    assert.equal("error" in gated, true);
    const fail = gated as Extract<GateOutcome, { error: string }>;
    assert.match(fail.error, /gestionale|orders/i);
    assert.ok(fail.result?.html);
    assert.equal(validateProductHtml(BOTTEGA, { kind: "site" }).syntaxOk, true);
    assert.equal(validateProductHtml(BOTTEGA, { kind: "site" }).ok, false);
  });
});
