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
import { PALETTE_CORPUS } from "../projects/palette-engine.ts";
import { domainIllustration, GEOMETRIC_REGRESSIONS, materialSignature } from "./domain-imagery.ts";
import { isLetterAIcon } from "../projects/craft-icons.ts";

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
      assert.match(run.generated.html, /data-craft-nav="1"/);
      assert.match(run.generated.html, /stroke-linejoin="round"/);
      assert.match(run.generated.html, /viewBox="0 0 24 24"/);
      assert.doesNotMatch(run.generated.html, /M5 19l7-14 7 14/);
      assert.doesNotMatch(run.generated.html, /M16 8\s*L24 22\s*H8/i);
      const navIcons = [...run.generated.html.matchAll(/<svg[^>]*data-craft-nav="1"[^>]*>[\s\S]*?<\/svg>/g)].map(
        (m) => m[0],
      );
      assert.ok(navIcons.length >= 4, run.generated.spec?.id);
      assert.equal(new Set(navIcons).size, 4, `${run.generated.spec?.id} unique nav icons`);
      for (const svg of navIcons) {
        assert.equal(isLetterAIcon(svg), false, svg.slice(0, 80));
        assert.match(svg, /width="24"/);
        assert.match(svg, /height="24"/);
        assert.match(svg, /overflow="hidden"/);
      }
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

  it("paints material garments, crudo plating and editorial scenes instead of 7c3245c silhouettes", () => {
    const vesti = composeProduct(HARD[1]!);
    const crudo = composeProduct(
      `${formatPrefix("app")}Crudo Mare: ristorazione di crudo, marmo, agrume ed erba di mare.`,
    );
    const atelier = composeProduct(HARD[5]!);
    for (const re of GEOMETRIC_REGRESSIONS) {
      assert.equal(re.test(vesti.html), false, String(re));
      assert.equal(re.test(crudo.html), false, String(re));
      assert.equal(re.test(atelier.html), false, String(re));
    }
    assert.match(vesti.html, /data-garment="coat"/);
    assert.match(vesti.html, /data-part="lapel"/);
    assert.match(vesti.html, /data-part="shoulder"/);
    assert.match(vesti.html, /data-garment=\\"trousers\\"/);
    assert.match(vesti.html, /data-part=\\"crease\\"/);
    assert.match(vesti.html, /var plates=\[hero\]/);
    assert.match(vesti.html, /grid-row:1 \/ span 2/);
    assert.match(vesti.html, /min\(54vh,460px\)/);
    const coat = materialSignature(domainIllustration("fashion", 0, "c", 0));
    assert.ok(coat.paths >= 22);
    assert.match(crudo.html, /data-part="flesh"/);
    assert.match(crudo.html, /data-part="citrus"/);
    assert.match(crudo.html, /data-part="herb"/);
    assert.match(crudo.html, /data-dish="ricciola"/);
    assert.match(crudo.html, /data-dish=\\"gambero\\"/);
    assert.match(crudo.html, /data-dish=\\"ostrica\\"/);
    assert.match(crudo.html, /data-dish=\\"tonno\\"/);
    assert.match(crudo.html, /ticket \.thumb/);
    assert.match(crudo.html, /width:96px;height:80px/);
    assert.match(crudo.html, /var plates=\[hero\]/);
    assert.match(atelier.html, /data-scene="pozzo"/);
    assert.match(atelier.html, /data-scene=\\"olivo\\"/);
    assert.match(atelier.html, /data-scene=\\"fienile\\"/);
    assert.match(atelier.html, /data-part="type"/);
    assert.match(atelier.html, /#copertina\{grid-column:1/);
    assert.match(atelier.html, /var plates=\[hero\]/);
    const osso = composeProduct(
      `${formatPrefix("app")}Vesti Osso: moda e vendite, lookbook in avorio, capi in osso e cassa.`,
    );
    assert.match(osso.html, /Cappotto latte/);
    assert.match(osso.html, /data-garment=\\"skirt\\"/);
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

  it("composes RepoVoci as a source timeline, not a gray hero + two KPI + empty card", () => {
    const brief = `${formatPrefix("app")}RepoVoci: registro delle voci di un repository, commit, rami, stato di sync e timeline/diff.`;
    const luce = `${formatPrefix("app")}RepoVoci luce: registro di repository in carta chiara, commit, rami e diff diurni.`;
    const a = composeProduct(brief);
    const b = composeProduct(luce);
    assert.equal(a.grammar.id, "source-timeline");
    assert.equal(b.grammar.id, "source-timeline");
    assert.equal(a.tokens.family, "repo");
    assert.notEqual(a.tokens.palette.bg.toLowerCase(), b.tokens.palette.bg.toLowerCase());
    assert.notEqual(a.tokens.chroma, b.tokens.chroma);
    assert.match(a.html, /data-repo-stage="activity"/);
    assert.match(a.html, /data-hash=/);
    assert.match(a.html, /class="sha"/);
    assert.match(a.html, /data-repo-stage="branches"/);
    assert.match(a.html, /Attività/);
    assert.match(a.html, /Rami/);
    assert.doesNotMatch(a.html, /#2ea043|#238636|Octocat|Pull request/i);
    assert.doesNotMatch(a.html.slice(0, 4000), /#101114|#e1693f/);
    assert.match(b.html, /data-repo-stage="diff"/);
    const qa = auditGraphicQuality(a.html, { brief, kind: a.grammar.kind });
    assert.equal(qa.ok, true, qa.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(" · "));
    assert.equal(qa.findings.some((f) => f.code === "template-home"), false);
    const fake = `<!DOCTYPE html><html><style>:root{--bg:#101114;--surface:#191b20;--fg:#f5f2ea;--muted:#a7a39a;--accent:#e1693f}</style><div class="kpi">42</div><div class="kpi">7</div><section class="hero"></section></html>`;
    const bad = auditGraphicQuality(fake, { brief, kind: "app" });
    assert.ok(bad.findings.some((f) => f.code === "template-home" || f.code === "static-fallback"), bad.findings.map((f) => f.code).join(","));
  });

  it("does not clone palette or grammar across six distant domains", () => {
    const ids = ["repo-voci", "clinica", "pulse", "carta-luce", "pastello", "segnale"];
    const runs = PALETTE_CORPUS.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, ...composeProduct(r.brief) }));
    assert.equal(runs.length, 6);
    const grammars = new Set(runs.map((r) => r.grammar.id));
    assert.ok(grammars.size >= 5, [...grammars].join(","));
    const palettes = new Set(runs.map((r) => `${r.tokens.palette.bg}:${r.tokens.palette.accent}`));
    assert.equal(palettes.size, runs.length, [...palettes].join(" | "));
    assert.equal(runs.find((r) => r.id === "repo-voci")?.grammar.id, "source-timeline");
    assert.match(runs.find((r) => r.id === "repo-voci")!.html, /data-repo-stage="activity"/);
    assert.match(runs.find((r) => r.id === "repo-voci")!.html, /class="commit"/);
  });
});
