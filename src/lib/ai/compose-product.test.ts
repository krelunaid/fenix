import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrefix } from "../projects/infer.ts";
import { evaluateContract, planContract } from "./build-contract.ts";
import { auditGraphicQuality } from "../projects/graphic-quality.ts";
import {
  PIPELINE_SPECS,
  composeProduct,
  loadPipelineFixtures,
  runGraphicPipeline,
  seedHtmlForBrief,
} from "./compose-product.ts";
import { APP_SHELL_HTML } from "./app-shell.ts";
import { hueBucket } from "../projects/design-tokens.ts";
import { domainIllustration } from "./domain-imagery.ts";

const HARD = [
  `${formatPrefix("app")}Essenza: gestione profumi premium, flaconi, note olfattive e guardaroba.`,
  `${formatPrefix("app")}Vesti: moda e vendite, lookbook, capi in passerella e cassa.`,
  `${formatPrefix("app")}Locanda Pietra: prenotazioni di ospitalità, camere, reception e soggiorno in pietra.`,
  `${formatPrefix("app")}Osteria del Passo: ristorazione, menu degustazione, comande al passo cucina e sala da pranzo.`,
  `${formatPrefix("dashboard")}Nord Ledger: cruscotto vendite, kpi di vendita, pipeline vendite e ledger commerciale.`,
  `${formatPrefix("site")}Atelier Carta: portfolio editoriale, rivista di lastre fotografiche e rassegna di studio.`,
];

describe("graphic pipeline prompt→plan→generate→visual→QA", () => {
  it("composes six hard briefs into distinct premium products without LLM credits", () => {
    const runs = HARD.map((brief) => runGraphicPipeline(brief));
    assert.equal(runs.length, 6);
    const families = new Set(runs.map((r) => r.tokens.family));
    const grammars = new Set(runs.map((r) => r.grammar.id));
    const grounds = new Set(runs.map((r) => r.tokens.palette.bg.toLowerCase()));
    const fonts = new Set(runs.map((r) => r.tokens.fonts.display));
    assert.equal(families.size, 6, [...families].join(","));
    assert.equal(grammars.size, 6, [...grammars].join(","));
    assert.equal(grounds.size, 6, [...grounds].join(","));
    assert.equal(fonts.size, 6, [...fonts].join(","));
    const hues = runs.map((r) => hueBucket(r.tokens.palette.accent));
    assert.ok(new Set(hues.map((h) => Math.round(h / 20))).size >= 4, `hues ${hues}`);
    for (const family of ["perfume", "fashion", "hospitality", "food", "editorial"] as const) {
      const slots = [0, 1, 2, 3].map((s) => domainIllustration(family, 0, family, s));
      assert.equal(new Set(slots).size, 4, `${family} slots`);
    }
    for (const run of runs) {
      assert.equal(run.plan.kind, run.generated.contract.kind);
      assert.ok(run.generated.spec, run.brief);
      assert.match(run.generated.html, /data-imagery="domain"/);
      assert.match(run.generated.html, /data-fenix-craft/);
      assert.match(run.generated.html, /:focus-visible/);
      assert.match(run.generated.html, /Fenix\.load/);
      assert.match(run.generated.html, /Fenix\.save/);
      assert.match(run.generated.html, /state-empty|prefers-reduced-motion/);
      assert.match(run.generated.html, /@media\(min-width:768px\)/);
      assert.match(run.generated.html, /data-slot="/);
      assert.match(run.generated.html, /data-fenix-flash/);
      assert.match(run.generated.html, /data-state/);
      assert.doesNotMatch(run.generated.html, /Ciao/);
      assert.doesNotMatch(run.generated.html, /localStorage/);
      assert.doesNotMatch(run.generated.html, /#f5f5f7/);
      if (run.grammar.chrome === "tabs") {
        assert.match(run.generated.html, /position:sticky;bottom:0/);
        assert.match(run.generated.html, /nav\.tabs\{position:static/);
      }
      if (run.grammar.id === "ops-desk") {
        assert.doesNotMatch(run.generated.html, /ops-hero/);
        assert.match(run.generated.html, /table-wrap/);
        assert.match(run.generated.html, /data-act="advance"/);
      }
      if (run.tokens.family !== "ceramic") {
        assert.doesNotMatch(run.generated.html.slice(0, 2500), /#efe6d4/);
      }
      assert.equal(run.qa.ok, true, `${run.generated.spec?.id}: ${run.qa.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(" · ")}`);
      const evaluation = evaluateContract({
        html: run.generated.html,
        files: run.generated.files,
        contract: planContract(run.brief),
        kind: run.plan.kind,
        brief: run.brief,
      });
      const failed = evaluation.checks.filter((c) => c.blocking && !c.ok);
      assert.equal(evaluation.ok, true, `${run.generated.spec?.id}: ${failed.map((c) => `${c.id}:${c.detail}`).join(" · ")}`);
    }
  });

  it("produces two really different directions for perfume, fashion and hospitality", () => {
    const pairs: [string, string][] = [
      [
        `${formatPrefix("app")}Essenza: gestione profumi premium, flaconi.`,
        `${formatPrefix("app")}Essenza Vetro: gestione profumi premium, flaconi di vetro, note di ghiaccio e nebbia.`,
      ],
      [
        `${formatPrefix("app")}Vesti: moda e vendite, lookbook, capi in passerella e cassa.`,
        `${formatPrefix("app")}Vesti Osso: moda e vendite, lookbook in avorio, capi in osso e cassa.`,
      ],
      [
        `${formatPrefix("app")}Locanda Pietra: prenotazioni di ospitalità, camere, reception e soggiorno in pietra.`,
        `${formatPrefix("app")}Hotel Notte: prenotazioni di ospitalità, suite, champagne e check-in in inchiostro di hotel.`,
      ],
    ];
    for (const [left, right] of pairs) {
      const a = composeProduct(left);
      const b = composeProduct(right);
      assert.equal(a.tokens.family, b.tokens.family, left);
      assert.notEqual(a.tokens.variant, b.tokens.variant, a.tokens.family);
      assert.notEqual(a.tokens.palette.bg, b.tokens.palette.bg, a.tokens.family);
      assert.notEqual(a.tokens.palette.accent, b.tokens.palette.accent, a.tokens.family);
      assert.notEqual(a.tokens.fonts.display, b.tokens.fonts.display, a.tokens.family);
      assert.match(a.html, /data-imagery="domain"/);
      assert.match(b.html, /data-imagery="domain"/);
    }
  });

  it("does not promote the beige phone shell as a finished perfume product", () => {
    const brief = HARD[0]!;
    assert.notEqual(seedHtmlForBrief(brief), APP_SHELL_HTML);
    const report = auditGraphicQuality(APP_SHELL_HTML, { brief, kind: "app" });
    assert.equal(report.ok, false);
  });

  it("keeps ten pipeline fixtures green on the graphic gate", () => {
    const fixtures = loadPipelineFixtures();
    assert.equal(fixtures.length, PIPELINE_SPECS.length);
    assert.ok(fixtures.length >= 10);
    for (const fix of fixtures) {
      const report = auditGraphicQuality(fix.html, { brief: fix.brief, kind: fix.kind });
      assert.equal(
        report.ok,
        true,
        `${fix.id}: ${report.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(" · ")}`,
      );
    }
  });
});
