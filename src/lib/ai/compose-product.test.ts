import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { formatPrefix } from "../projects/infer.ts";
import { evaluateContract, planContract } from "./build-contract.ts";
import { auditGraphicQuality } from "../projects/graphic-quality.ts";
import {
  PIPELINE_SPECS,
  campoHomeHeaderMark,
  barberHomeHeaderMark,
  libraryHomeHeaderMark,
  pocketHomeHeaderMark,
  composeProduct,
  loadPipelineFixtures,
  runGraphicPipeline,
  seedHtmlForBrief,
  GRAPHIC_FIVE_PARENT_SHA,
} from "./compose-product.ts";
import { APP_SHELL_HTML } from "./app-shell.ts";
import { hueBucket } from "../projects/design-tokens.ts";
import { PALETTE_CORPUS, paletteDistance, CLOSE_DELTA_E } from "../projects/palette-engine.ts";
import { domainIllustration, GEOMETRIC_REGRESSIONS, materialSignature } from "./domain-imagery.ts";
import { craftNavIcon, isLetterAIcon, looksLikeIosWidgetHome } from "../projects/craft-icons.ts";
import { appIdentityIcon, appIdentityLabel } from "../projects/app-identity.ts";
import { prepareSrcDoc } from "../projects/color-scheme.ts";
import { validateProductHtml } from "../projects/validate-html.ts";
import { createBuildRequest, isComposedCreation } from "./build-request.ts";
import { contrastRatio } from "../projects/visual-quality.ts";
import { productIconSvg } from "../projects/product-icon.ts";
import { MAX_ARTIFACT_CHARS } from "../../../workers/visual/artifact-context.mjs";
import { nativeStyleAssignsPalette } from "../projects/native-app-style.ts";
import {
  COMPOSED_BUILD_FIND_EXAMPLES,
  COMPOSED_BUILD_SYSTEM,
  COMPOSED_PLAN_DEGRADED_LOG,
  composedFindStatus,
  composedSeedAnchors,
} from "../../../workers/visual/composed-protocol.mjs";
import { applyComposedBuildPlan, composedBaseSha } from "../../../workers/visual/composed-build.mjs";
import { isComposedVisualArtifact } from "../../../workers/visual/visual-style.mjs";
import {
  canKeepComposedSeedAfterPolishError,
  shouldSkipComposedPolish,
} from "../../../workers/visual/visual-style-keep.mjs";

describe("controller build request preserves generated artifacts", () => {
  it("creates an editable sector app icon in the first phone seed without provider calls", () => {
    const icons = new Set<string>();
    for (const brief of ["mi crei un app da parrucchieri stile Barber shop", "Profumi e fragranze", "Abbigliamento e lookbook", "Agenda appuntamenti"]) {
      const product = composeProduct(formatPrefix("app") + brief);
      const icon = product.html.match(/<span class="app-mark"[^>]*>([\s\S]*?)<\/span>/)?.[1];
      assert.ok(icon,brief);
      assert.match(product.html,/data-fenix-id="icon:app"/);
      assert.match(icon,/data-craft-app="1"/);
      icons.add(icon);
    }
    assert.equal(icons.size,4,"sector icons must not all be the same generic document");
  });
  it("keeps sector marks distinct for accountant, shop, barber and perfume without a house palette", () => {
    const rows = [
      ["mi crei un app da parrucchieri stile Barber shop", "booking", "Taglio"],
      ["Profumi e fragranze", "perfume", "Profumi"],
      ["Abbigliamento e lookbook", "fashion", "Lookbook"],
      ["Agenda appuntamenti", "booking", "Agenda"],
      ["gestionale per commercialisti, fatture e pratiche", "paper", "Fatture"],
      ["negozio di alimentari, cassa e magazzino", "paper", "Negozio"],
    ] as const;
    const icons = rows.map(([brief, family, label]) => {
      assert.equal(appIdentityLabel(brief, family), label, brief);
      return appIdentityIcon(brief, family);
    });
    assert.equal(new Set(icons).size, rows.length, "each activity needs its own mark");
    assert.match(icons[4]!, /data-craft-app="1"/);
    assert.match(icons[5]!, /data-craft-app="1"/);
    const barber = composeProduct(formatPrefix("app") + rows[0][0]);
    const shop = composeProduct(formatPrefix("app") + rows[5][0]);
    const fiscal = composeProduct(formatPrefix("app") + rows[4][0]);
    assert.doesNotMatch(barber.html, /#b51246|#b01e47|#a61d4c/i);
    assert.doesNotMatch(shop.html, /#b51246|#b01e47|#a61d4c/i);
    assert.doesNotMatch(fiscal.html, /#b51246|#b01e47|#a61d4c/i);
    assert.notEqual(shop.tokens.palette.accent.toLowerCase(), barber.tokens.palette.accent.toLowerCase());
    assert.match(fiscal.html, /<span>Fatture<\/span>/);
    assert.match(fiscal.html, /<span>Bilancio<\/span>/);
    assert.match(shop.html, /<span>Negozio<\/span>/);
    assert.match(shop.html, /<span>Magazzino<\/span>/);
    assert.match(fiscal.html, /--t-callout:/);
    assert.match(fiscal.html, /--space:8px/);
    assert.match(shop.html, /font-variant-numeric:tabular-nums/);
  });
  it("keeps a commercialisti gestionale on desk chrome with fiscal tabs, never a phone seed or raspberry", () => {
    const brief = formatPrefix("dashboard") + "mi crei un gestionale per commercialisti";
    const product = composeProduct(brief);
    const payload = createBuildRequest({ prompt: brief, kind: "dashboard" });
    assert.equal(product.grammar.id, "ops-desk");
    assert.equal(product.grammar.chrome, "desk");
    assert.doesNotMatch(product.html, /data-fenix-native-style/);
    assert.doesNotMatch(product.html, /\bfk-tab\b/);
    assert.doesNotMatch(product.html, /#b51246|#0071e3|#f5f5f7/i);
    assert.match(product.html, /data-fenix-craft-desk/);
    assert.match(product.html, /<span>Fatture<\/span>/);
    assert.match(product.html, /<span>Pratiche<\/span>/);
    assert.match(product.html, /\.kpis\{[^}]*border-radius:12px/);
    assert.match(product.html, /--t-callout:1rem/);
    assert.equal(payload.html, "");
    assert.equal(payload.instruction, "");
    assert.equal(payload.kind, "dashboard");
  });
  it("keeps Barber activity identity without the rejected raspberry palette or auto-native style", () => {
    const brief = formatPrefix("app") + "mi crei un app da parrucchieri stile Barber shop";
    const product = composeProduct(brief);
    assert.match(product.html,/<title>Barber<\/title>/);
    assert.match(product.html,/data-fenix-id="icon:app"/);
    assert.doesNotMatch(product.html,/data-fenix-native-style/);
    assert.doesNotMatch(product.html,/#b51246|#b01e47|#a61d4c/i);
    assert.notEqual(product.tokens.fonts.display,"system-ui");
    assert.equal(product.tokens.family,"booking");
    assert.notEqual(product.tokens.palette.accent.toLowerCase(),"#b51246");
    assert.notEqual(product.tokens.palette.bg,product.tokens.palette.surface);
    const p = product.tokens.palette;
    for (const bg of [p.bg,p.surface]) {
      assert.ok(contrastRatio(p.fg,bg)>=4.5);
      assert.ok(contrastRatio(p.muted,bg)>=4.5);
    }
    assert.ok(contrastRatio(p.accentInk,p.accent)>=4.5);
    assert.match(product.html,/\.day-rail\{[^}]*border-radius:14px/);
    assert.doesNotMatch(product.html,/box-shadow:inset 3px 0 0 var\(--accent\)/);
    const explicit = composeProduct(brief + ", serif primario Garamond, accento #006633");
    assert.equal(explicit.tokens.fonts.display,"Garamond");
    assert.equal(explicit.tokens.palette.accent,"#006633");
    const native = composeProduct(brief + ", stile iPhone");
    assert.match(native.html,/data-fenix-native-style="v1"/);
    assert.equal(native.tokens.fonts.display,"system-ui");
    assert.equal(native.tokens.fonts.body,"system-ui");
    assert.notEqual(native.tokens.palette.accent.toLowerCase(),"#b51246");
    assert.equal(native.tokens.palette.accent,product.tokens.palette.accent);
  });
  it("uses complete product names instead of cutting a descriptive brief mid-word", () => {
    for (const [brief, expected] of [
      ["Agenda appuntamenti e prenotazioni, stile Apple.", "Agenda"],
      ["Vorrei una agenda per appuntamenti e prenotazioni in studio.", "Agenda"],
      ["Agenda delle consulenze di Valentina: appuntamenti, stile iPhone.", "Agenda delle consulenze di Valentina"],
      ['Crea una agenda chiamata "Studio Valentina" per appuntamenti.', "Studio Valentina"],
      ["Lista in tasca: cose da fare operative, stile Apple.", "Lista in tasca"],
    ]) {
      const result = composeProduct(formatPrefix("app") + brief);
      assert.equal(result.html.match(/<title>([^<]+)<\/title>/)?.[1], expected, brief);
    }
  });
  it("limits the no-rewrite retry policy to explicitly composed initial phone builds", () => {
    for (const kind of ["app", "tool", "game"]) assert.equal(isComposedCreation({operation:"create",kind}), true);
    for (const kind of ["app", "tool", "game", "site", "dashboard", "landing"]) {
      assert.equal(isComposedCreation({operation:"edit",kind}), false);
      assert.equal(isComposedCreation({kind}), false);
    }
    assert.equal(isComposedCreation({operation:"create",kind:"site"}), false);
  });
  it("tells grok-build the compose seed is fallback, not the product", () => {
    const polish = composeProduct(formatPrefix("app") + "Agenda studio: appuntamenti e prenotazioni, stile iPhone.").polish;
    assert.match(polish, /solo fallback/);
    assert.doesNotMatch(polish, /Il seed HTML è già il prodotto/);
  });
  it("keeps a usable acqua-bottiglia seed when visual polish rejects font-size after create fallback", () => {
    const composed = composeProduct(formatPrefix("app") + "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.");
    assert.equal(isComposedVisualArtifact(composed.html), true);
    assert.equal(shouldSkipComposedPolish({
      html: composed.html,
      buildLog: [COMPOSED_PLAN_DEGRADED_LOG, "QA · saltato"],
    }), false);
    assert.equal(shouldSkipComposedPolish({
      html: '<!doctype html><html data-fenix-model-create="1" lang="it"><body><main>Sala</main></body></html>',
      buildLog: ["Documento originale dal modello; seed solo fallback"],
    }), true);
    assert.equal(canKeepComposedSeedAfterPolishError(
      "Stile non consentito: font-size. Tocca Riprendi rifinitura.",
      { html: composed.html },
    ), true);
    assert.equal(canKeepComposedSeedAfterPolishError(
      "Stile non consentito: font-size",
      { instruction: "Cambia la tab Ordina", html: composed.html },
    ), false);
  });
  const briefs = [
    "Agenda studio: appuntamenti e prenotazioni, stile iPhone.",
    "Essenza: gestione profumi da vendere, stile iPhone.",
    "Vesti: abbigliamento e capi da vendere, stile iPhone.",
    "RepoVoci: note e repository GitHub, stile iPhone.",
    "Ristorazione: menu e prenotazioni, stile iPhone.",
    "Un diario per escursioni e sentieri, stile iPhone.",
  ];
  for (const brief of briefs) {
    it(`retains the entire seed for ${brief}`, () => {
      const prompt = formatPrefix("app") + brief;
      const composed = composeProduct(prompt);
      const payload = createBuildRequest({prompt, kind: "app"});
      assert.equal(payload.html, composed.html);
      assert.notEqual(payload.html, APP_SHELL_HTML);
      assert.equal(payload.instruction, composed.polish);
      assert.equal(payload.kind, "app");
      assert.equal(payload.operation, "create");
      assert.deepEqual(payload.palette, composed.tokens.palette);
      // Both transports serialize this same request; no hidden seed replacement.
      assert.equal(JSON.parse(JSON.stringify({...payload, projectId:"fixture"})).html, composed.html);
    });
  }
  it("uses the same history for composition and the outgoing payload", () => {
    const prompt = formatPrefix("app") + briefs[0];
    const recentPalettes = [composeProduct(prompt).tokens.palette];
    const expected = composeProduct(prompt, {recent:recentPalettes});
    const payload = createBuildRequest({prompt, kind:"app", recentPalettes});
    assert.equal(payload.html, expected.html);
    assert.equal(payload.instruction, expected.polish);
    assert.deepEqual(payload.palette, expected.tokens.palette);
    assert.deepEqual(payload.recentPalettes, recentPalettes);
  });
  it("keeps edits byte-identical before transport, including script/data at the end", () => {
    const html = '<html><body>' + ' '.repeat(45000) + '<script>window.saved="literal $&"</script></body></html>';
    const request = createBuildRequest({prompt:briefs[0], html, instruction:"Cambia solo icona", kind:"app"});
    assert.equal(request.html, html);
    assert.equal(request.instruction, "Cambia solo icona");
    assert.equal(request.operation, "edit");
  });
  it("does not seed desktop site or dashboard creates with a phone composition", () => {
    const sitePrompt = "FORMATO: sito web. kind=site. atlante delle maree";
    const site = createBuildRequest({prompt: sitePrompt, html:"existing", kind:"site"});
    assert.equal(site.html, "existing");
    assert.equal(site.instruction, "");
    assert.doesNotMatch(site.html, /fk-tab|data-grammar=/);
    const dashPrompt = formatPrefix("dashboard") + "mi crei un gestionale per commercialisti";
    const dash = createBuildRequest({prompt: dashPrompt, kind: "dashboard"});
    assert.equal(dash.html, "");
    assert.equal(dash.instruction, "");
    assert.equal(dash.kind, "dashboard");
    assert.equal(dash.operation, "create");
    assert.equal("palette" in dash, false);
  });
});

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
      assert.match(run.generated.html, /data-fenix-craft|data-fenix-site/);
      assert.match(run.generated.html, /:focus-visible/);
      assert.match(run.generated.html, /Fenix\.load/);
      assert.match(run.generated.html, /Fenix\.save/);
      assert.match(run.generated.html, /state-empty|prefers-reduced-motion/);
      if (run.plan.kind !== "site" && run.plan.kind !== "landing") {
      assert.match(run.generated.html, /@media\(min-width:768px\)/);
      assert.match(run.generated.html, /data-slot="/);
      assert.match(run.generated.html, /data-fenix-flash/);
      assert.match(run.generated.html, /data-state/);
      assert.match(run.generated.html, /data-craft-nav="1"/);
      assert.match(run.generated.html, /data-fenix-id="icon:/);
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
        assert.match(svg, /overflow="visible"/);
      }
      } else {
        assert.match(run.generated.html, /@media\(max-width:700px\)/);
        assert.match(run.generated.html, /<nav aria-label="Navigazione principale"/);
        assert.match(run.generated.html, /id="contact-form"/);
        assert.match(run.generated.html, /role="status"/);
        assert.doesNotMatch(run.generated.html, /data-craft-nav="1"|nav\.tabs/);
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
        assert.match(run.generated.html, /data-lane=/);
        assert.match(run.generated.html, /function spark\(seed/);
        assert.match(run.generated.html, /data-kpi=/);
        assert.match(run.generated.html, /ledger-art/);
        assert.doesNotMatch(run.generated.html, /height:40%[\s\S]*height:70%[\s\S]*height:55%[\s\S]*height:90%[\s\S]*height:62%/);
      }
      if (run.plan.kind !== "site" && run.plan.kind !== "landing") {
      assert.match(run.generated.html, /--t-h1:/);
      assert.match(run.generated.html, /--t-h2:/);
      assert.match(run.generated.html, /--ink-quiet:/);
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
    assert.match(vesti.html, /function artOf\(/);
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
    assert.match(crudo.html, /function artOf\(/);
    assert.match(atelier.html, /data-scene="pozzo"/);
    assert.match(atelier.html, /data-scene="olivo"/);
    assert.match(atelier.html, /data-scene="fienile"/);
    assert.match(atelier.html, /data-part="type"/);
    assert.match(atelier.html, /class="feature-art"/);
    assert.match(atelier.html, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
    const osso = composeProduct(
      `${formatPrefix("app")}Vesti Osso: moda e vendite, lookbook in avorio, capi in osso e cassa.`,
    );
    assert.match(osso.html, /Cappotto latte/);
    assert.match(osso.html, /data-garment=\\"skirt\\"/);
    const locanda = composeProduct(HARD[2]!);
    assert.match(locanda.html, /data-room="pozzo"/);
    assert.match(locanda.html, /data-room=\\"olivo\\"/);
    assert.match(locanda.html, /data-room=\\"fienile\\"/);
    assert.match(locanda.html, /data-room=\\"salice\\"/);
    assert.match(locanda.html, /grid-row:1 \/ span 2/);
    const essenza = composeProduct(HARD[0]!);
    assert.match(essenza.html, /data-bottle="nuit"/);
    assert.match(essenza.html, /data-bottle=\\"nuit\\"/);
    assert.match(essenza.html, /data-bottle=\\"acqua\\"/);
    assert.match(essenza.html, /function artOf\(/);
    assert.match(essenza.html, /slot:0/);
    const osteria = composeProduct(HARD[3]!);
    assert.match(osteria.html, /data-dish="plin"/);
    assert.match(osteria.html, /data-dish=\\"brasato\\"/);
    assert.match(osteria.html, /data-dish=\\"bonet\\"/);
    assert.match(osteria.html, /data-dish=\\"tajarin\\"/);
    const nord = composeProduct(HARD[4]!);
    assert.match(nord.html, /data-lane=/);
    assert.match(nord.html, /function spark\(seed/);
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
    assert.doesNotMatch(
      a.html,
      /html\[data-fenix-craft-desk\],html\[data-fenix-craft-desk\] body\{background:var\(--surface-2\)/,
    );
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

  it("composes five distinct briefs on the real generator: agenda rail, perfume, fashion, repo, kitchen", () => {
    const five = {
      agenda: `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`,
      profumi: `${formatPrefix("app")}Essenza: gestione profumi premium, flaconi, note olfattive e guardaroba.`,
      abbigliamento: `${formatPrefix("app")}Vesti: moda e vendite, lookbook, capi in passerella e cassa.`,
      repo: `${formatPrefix("app")}Taccuino: note e repository, commit, rami, sync e scarto del repo.`,
      ristorazione: `${formatPrefix("app")}Osteria del Passo: ristorazione, menu degustazione, comande al passo cucina e sala da pranzo.`,
    };
    const runs = Object.entries(five).map(([id, brief]) => ({ id, ...composeProduct(brief) }));
    const grammars = new Set(runs.map((r) => r.grammar.id));
    const palettes = new Set(runs.map((r) => `${r.tokens.palette.bg}:${r.tokens.palette.accent}`));
    const fonts = new Set(runs.map((r) => r.tokens.fonts.display));
    assert.equal(grammars.size, 5, [...grammars].join(","));
    assert.equal(palettes.size, 5, [...palettes].join(" | "));
    assert.ok(fonts.size >= 4, [...fonts].join(","));
    const agenda = runs.find((r) => r.id === "agenda")!;
    assert.equal(agenda.grammar.id, "agenda");
    assert.match(agenda.html, /data-fenix-rail="day"/);
    assert.match(agenda.html, /data-view="oggi"/);
    assert.match(agenda.html, /data-view="settimana"/);
    assert.match(agenda.html, /<time class="time"/);
    assert.match(agenda.html, /--t-headline/);
    assert.match(agenda.html, /min-height:44px/);
    assert.match(agenda.html, /data-icon-grid="24"/);
    assert.match(agenda.html, /Fenix\.save/);
    assert.match(agenda.html, /data-fenix-crud|id="fnew"/);
    assert.doesNotMatch(agenda.html, /data-view="home"/);
    assert.doesNotMatch(agenda.html, /data-view="elenco"/);
    assert.doesNotMatch(agenda.html, /state-empty:before/);
    assert.doesNotMatch(agenda.html, /#f5f5f7|#0071e3|#007aff/);
    assert.doesNotMatch(agenda.html, /SF Pro|Newsreader|Georgia|\bInter\b/);
    assert.match(agenda.html, /Figtree/);
    assert.match(agenda.html, /ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI"/);
    assert.match(agenda.html, /backdrop-filter:saturate\(1\.8\) blur\(20px\)/);
    assert.doesNotMatch(agenda.html, /--display:"Newsreader"/);
    assert.equal(agenda.tokens.fonts.display, "Figtree");
    assert.equal(agenda.tokens.palette.bg.toLowerCase(), "#e8eef4");
    assert.equal(agenda.tokens.palette.accent.toLowerCase(), "#1f6f68");
    const locked = composeProduct(
      `${formatPrefix("app")}Agenda: appuntamenti. Sfondo #dce8e2 accento #0f766e.`,
    );
    assert.equal(locked.tokens.palette.bg.toLowerCase(), "#dce8e2");
    assert.equal(locked.tokens.palette.accent.toLowerCase(), "#0f766e");
    for (const run of runs) {
      const qa = auditGraphicQuality(run.html, { brief: five[run.id as keyof typeof five], kind: run.grammar.kind });
      assert.equal(
        qa.ok,
        true,
        `${run.id}: ${qa.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(" · ")}`,
      );
      assert.match(run.html, /viewBox="0 0 24 24"/);
      assert.match(run.html, /data-craft-nav="1"/);
      assert.match(run.html, /Fenix\.load/);
    }
    assert.equal(runs.find((r) => r.id === "profumi")!.grammar.id, "split-stage");
    assert.equal(runs.find((r) => r.id === "abbigliamento")!.grammar.id, "lookbook");
    assert.equal(runs.find((r) => r.id === "repo")!.grammar.id, "source-timeline");
    assert.equal(runs.find((r) => r.id === "ristorazione")!.grammar.id, "service-board");
    assert.equal(GRAPHIC_FIVE_PARENT_SHA, "bffc58f1af1ee22e69b99a0ed3dd65eaba8822f9");
    const profumi = runs.find((r) => r.id === "profumi")!;
    const ristorazione = runs.find((r) => r.id === "ristorazione")!;
    const abbigliamento = runs.find((r) => r.id === "abbigliamento")!;
    assert.match(profumi.html, /class="collection"/);
    assert.match(profumi.html, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(profumi.html, /xMidYMid slice/);
    assert.match(profumi.html, /data-focus=\\"/);
    assert.match(profumi.html, /data-thumb-box=\\"/);
    assert.match(profumi.html, /viewBox="0 0 640 420"/);
    assert.match(ristorazione.html, /preserveAspectRatio="xMidYMid meet"/);
    assert.match(ristorazione.html, /xMidYMid slice/);
    assert.match(abbigliamento.html, /preserveAspectRatio="xMidYMid slice"/);
    assert.doesNotMatch(abbigliamento.html, /preserveAspectRatio="xMidYMid meet"/);
    assert.doesNotMatch(profumi.html, /content:" · in prova"/);
    assert.doesNotMatch(ristorazione.html, /content:" · in prova"/);
    assert.match(profumi.html, /Bois de Nuit/);
    assert.match(profumi.html, /function artOf\(/);
    assert.match(profumi.html, /data-bottle="nuit"/);
    assert.match(profumi.html, /data-bottle=\\"nuit\\"/);
    assert.match(ristorazione.html, /Plin al burro/);
    assert.match(ristorazione.html, /data-dish="plin"/);
    assert.match(ristorazione.html, /data-dish=\\"brasato\\"/);
    assert.match(abbigliamento.html, /Metti in passerella/);
    assert.match(agenda.html, /aria-label="Modifica"/);
    assert.match(agenda.html, /aria-label="Archivia"/);
    assert.doesNotMatch(agenda.html, /\.slot-actions\{[^}]*overflow:\s*auto/);
    assert.equal(runs.find((r) => r.id === "repo")!.tokens.fonts.display, "IBM Plex Mono");
    const repo = runs.find((r) => r.id === "repo")!;
    assert.match(repo.html, /"id":"diff","label":"Diff"/);
    assert.doesNotMatch(repo.html, /"label":"Scarto"/);
    assert.doesNotMatch(repo.html, /home universale grigia/);
    assert.doesNotMatch(repo.html, /due riquadri vuoti/);
    assert.match(repo.html, /Diff · /);
    for (const run of runs) {
      assert.match(run.html, new RegExp(`data-family="${run.tokens.family}"`));
      assert.match(run.html, new RegExp(`data-grammar="${run.grammar.id}"`));
      assert.match(run.html, /family-chrome /);
      assert.match(run.html, /html\[data-family\]::before/);
      const pipeline = runGraphicPipeline(five[run.id as keyof typeof five]);
      assert.equal(pipeline.qa.ok, true, `${run.id} pipeline qa`);
      assert.equal(pipeline.generated.html, run.html);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i]!.tokens.palette;
        const b = runs[j]!.tokens.palette;
        const dist = paletteDistance(
          { bg: a.bg, surface: a.surface, accent: a.accent },
          { bg: b.bg, surface: b.surface, accent: b.accent },
        );
        assert.ok(
          dist >= CLOSE_DELTA_E,
          `${runs[i]!.id}/${runs[j]!.id} ΔE ${dist.toFixed(2)} < ${CLOSE_DELTA_E}`,
        );
      }
    }
  });

  it("freezes five-brief before shots at parent SHA bffc58f", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const before = join(here, "fixtures/graphic/five/before");
    const names = [
      "agenda",
      "profumi",
      "abbigliamento",
      "repo",
      "ristorazione",
    ].flatMap((id) => ["D", "T", "M"].map((vp) => `${id}-${vp}.png`));
    assert.equal(GRAPHIC_FIVE_PARENT_SHA, "bffc58f1af1ee22e69b99a0ed3dd65eaba8822f9");
    assert.equal(existsSync(before), true);
    const listed = readdirSync(before).filter((n) => n.endsWith(".png")).sort();
    assert.deepEqual(listed, [...names].sort());
    for (const name of names) {
      assert.equal(existsSync(join(before, name)), true, name);
    }
  });

  it("prepareSrcDoc of composeProduct keeps product home and system fallbacks, no imposed ledger", () => {
    const product = composeProduct(
      `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`,
    );
    const src = prepareSrcDoc(product.html, product.tokens.palette, "agenda-keep", "app");
    assert.equal(looksLikeIosWidgetHome(src), false);
    assert.doesNotMatch(src, /fk-ledger/);
    assert.doesNotMatch(src, /#f5f5f7|#0071e3|#007aff|SF Pro/);
    assert.match(src, /-apple-system/);
    assert.match(src, /Figtree/);
    assert.match(src, /backdrop-filter:saturate\(1\.8\) blur\(20px\)/);
    assert.doesNotMatch(src, /<style data-fenix-phone>\s*\*/);
  });

  it("agenda runtime: ISO days, status cycle, domain form, Sala place, desktop inset", () => {
    const brief = `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`;
    const product = composeProduct(brief);
    const html = product.html;
    assert.equal(product.grammar.id, "agenda");
    assert.match(html, /<p class="place">Sala<\/p>/);
    assert.doesNotMatch(html, /<p class="place">salvia<\/p>/i);
    assert.doesNotMatch(html, /Oggi · salvia/i);
    assert.doesNotMatch(html, /idx%5/);
    assert.doesNotMatch(html, /\.slot\{[^}]*padding:18px 0/);
    assert.doesNotMatch(html, /\.slot\{[^}]*padding:16px 0/);
    assert.match(html, /padding:18px 20px/);
    assert.match(html, /padding:16px 18px/);
    assert.match(html, /function weekDays/);
    assert.match(html, /selectedDay/);
    assert.match(html, /AGENDA_CYCLE/);
    assert.match(html, /prenotato:"confermato"/);
    assert.match(html, /function enqueueOp/);
    assert.match(html, /e\.day===d\.iso/);
    assert.match(html, /name="ora"/);
    assert.match(html, /name="luogo"/);
    assert.match(html, /name="cliente"/);
    assert.match(html, /placeholder="Es\. Taglio e piega"/);
    assert.match(html, /type="time"/);
    assert.match(html, /data-act="edit"/);
    for (const label of ["Conferma", "Inizia", "Concludi"]) assert.ok(html.includes(`>${label}</button>`));
    assert.match(html, /"concluso":"Riapri"/);
    assert.doesNotMatch(html, />Avanti</);
    assert.doesNotMatch(html, /Avanza slot/);
    assert.match(html, /aria-label="Modifica"/);
    assert.match(html, /aria-label="Archivia"/);
    assert.match(html, /const AGENDA_EDIT_GLYPH=/);
    assert.match(html, /'\+AGENDA_EDIT_GLYPH\+'/);
    assert.doesNotMatch(html, /\.slot-actions\{[^}]*overflow:\s*auto/);
    assert.match(html, /nav\.tabs svg\{[^}]*overflow:visible/);
    assert.match(html, /flex-wrap:nowrap/);
    assert.match(html, /aria-selected/);
    assert.match(html, /role="tab"/);
    assert.match(html, /closest\("\.week-day\[data-day\]"\)/);
    assert.match(html, /status:"prenotato"/);
    assert.match(html, /dayOffset:0/);
    assert.match(html, /data-status="/);
    assert.match(html, /ArrowRight/);
    assert.doesNotMatch(html, /placeholder="stato, taglia, ora"/);
    assert.doesNotMatch(html, /placeholder="materia"/);
  });

  it("agenda calendar edges: 7 real days, date field, validity, empty rail, no week clamp", () => {
    const brief = `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`;
    const product = composeProduct(brief);
    const html = product.html;
    assert.equal(product.grammar.id, "agenda");
    assert.match(html, /\["Lun","Mar","Mer","Gio","Ven","Sab","Dom"\]/);
    assert.doesNotMatch(html, /\["Lun","Mar","Mer","Gio","Ven"\]/);
    assert.match(html, /function nowDate/);
    assert.match(html, /__FENIX_NOW/);
    assert.match(html, /function shiftIso/);
    assert.match(html, /checkValidity/);
    assert.match(html, /reportValidity/);
    assert.match(html, /name="data"/);
    assert.match(html, /id="data"/);
    assert.match(html, /type="date"/);
    assert.match(html, /for="data"/);
    assert.match(html, /role="alert"/);
    assert.match(html, /data-fenix-form-error/);
    assert.match(html, /role="tabpanel"/);
    assert.match(html, /repeat\(7,/);
    assert.doesNotMatch(html, /repeat\(5,/);
    assert.doesNotMatch(html, /trim\(\)\|\|"09:00"/);
    assert.doesNotMatch(html, /Math\.min\(days\.length-1,todayIdx/);
    assert.doesNotMatch(html, /if\(!rows\.length\) return html\+emptyBox/);
    assert.match(html, /id="day-rail"/);
    assert.match(html, /aria-invalid/);
    assert.match(html, /selectedDay\|\|todayIso\(\)/);
    assert.match(html, /function mondayOf/);
    assert.match(html, /function weekRangeLabel/);
    assert.match(html, /data-act="week-prev"/);
    assert.match(html, /data-act="week-next"/);
    assert.match(html, /data-act="week-today"/);
    assert.match(html, /id="day-label"/);
    assert.match(html, /aria-labelledby="day-label"/);
    assert.match(html, /function persistThen/);
    assert.match(html, /data-fenix-persist/);
    assert.match(html, /data-fenix-queue/);
    assert.match(html, /function payloadForHead/);
    assert.match(html, /pendingOps/);
    assert.match(html, /function enqueueOp/);
    assert.match(html, /function renderKeepForm/);
    assert.match(html, /function finishBoot/);
    assert.match(html, /op\.patch/);
    assert.match(html, /AGENDA_CYCLE\[item\.status\]\|\|"confermato"/);
    assert.match(html, /KICKER_CYCLE\[item\.kicker\]\|\|item\.kicker/);
    assert.match(html, /renderKeepForm\(\);\s*return persistThen/);
    assert.match(html, /function saveOnce/);
    assert.match(html, /Promise\.resolve\(\)\.then\(function\(\)\{/);
    assert.match(html, /return window\.Fenix\.save\(COL, payload\)/);
    assert.doesNotMatch(html, /data=snapAdv/);
    assert.doesNotMatch(html, /data=snapDel/);
    assert.doesNotMatch(html, /data=snapWear/);
    assert.doesNotMatch(html, /if\(cur\.status===nextStatus\)/);
    assert.doesNotMatch(html, /status:\(prev&&prev.status\)/);
    assert.doesNotMatch(html, /pendingOps=\[\];\s*confirmed/);
    assert.doesNotMatch(html, /function finishBoot[\s\S]{0,500}pendingOps=\[\];/);
    assert.match(html, /fromLoad && !pendingOps\.length/);
    assert.doesNotMatch(html, /if\(persistBusy\) return false/);
    assert.doesNotMatch(html, /void window\.Fenix\.save/);
    assert.doesNotMatch(html, /function save\(\)\{ if\(window\.Fenix\) void/);
  });

  it("preserves explicit system and serif intent on the real generator without a single look", async () => {
    const { INTENT_SYSTEM_PROMPT, INTENT_SERIF_PROMPT, GRAPHIC_INTENT_PARENT_SHA } = await import(
      "../projects/graphic-intent.ts"
    );
    assert.equal(GRAPHIC_INTENT_PARENT_SHA, "76414c75ce4dc1b2f66343fc0ed1160be0c1b45b");
    const system = composeProduct(`${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}`);
    const serif = composeProduct(`${formatPrefix("app")}${INTENT_SERIF_PROMPT}`);
    const perfume = composeProduct(HARD[0]!);
    assert.equal(system.tokens.fonts.display, "system-ui");
    assert.match(system.html, /<span>Home<\/span>/);
    assert.match(system.html, /<span>Aggiungi<\/span>/);
    assert.match(system.polish, /Home\/Aggiungi\/Persona/);
    assert.equal(serif.tokens.fonts.display, "Literata");
    assert.equal(serif.tokens.fonts.body, "Literata");
    assert.match(serif.html, /data-intent-type="serif"/);
    assert.notEqual(system.tokens.fonts.display, serif.tokens.fonts.display);
    assert.notEqual(perfume.tokens.fonts.display, "system-ui");
    assert.match(perfume.html, /Cormorant Garamond/);
    const sysQa = auditGraphicQuality(system.html, { brief: system.brief, kind: "app" });
    assert.equal(sysQa.findings.some((f) => f.code === "apple-clone"), false);
    assert.doesNotMatch(system.html, /#f5f5f7|#0071e3|SF Pro/);
    const italian = composeProduct(`${formatPrefix("app")}Voglio una app stile iPhone`);
    assert.equal(italian.tokens.fonts.display, "system-ui");
    assert.match(italian.html, /data-intent-type="system"/);
    assert.notEqual(italian.tokens.fonts.display, perfume.tokens.fonts.display);
    const visible = system.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.doesNotMatch(visible, /anti-clone|glacier|Literata\/Karla|Lista in tasca uno/);
    assert.match(perfume.html, /<article class="card fragrance"/);
    const visPerfume = perfume.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.doesNotMatch(visPerfume, /Niente in lista/);
    const agenda = composeProduct(`${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`);
    assert.match(agenda.html, /Taglio e piega/);
    assert.doesNotMatch(agenda.html, /Lista in tasca uno/);
    assert.match(system.html, /Niente in lista/);
    assert.match(serif.html, /nav\.rail button\.on\{background:var\(--accent\);color:var\(--accent-ink\)/);
  });

  it("SYSTEM first-run is an honest empty sheet and domain briefs keep distinct composition", async () => {
    const { INTENT_SYSTEM_PROMPT, INTENT_SERIF_PROMPT } = await import("../projects/graphic-intent.ts");
    const system = composeProduct(`${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}`);
    const header = system.html.match(/<header[\s\S]*?<\/header>/)?.[0] || "";
    const home = system.html.match(/<section class="home-overview"[\s\S]*?<\/section>/)?.[0] || "";
    assert.equal((header.match(/<h1 /g) || []).length, 1);
    assert.doesNotMatch(header, /<p class="kicker">/);
    assert.doesNotMatch(home, /<p class="kicker">Lista<\/p>/);
    assert.match(home, /class="mark"/);
    assert.match(system.html, /items:\[\]/);
    assert.match(system.html, /\.home-first \.btn\{min-height:48px;width:100%/);
    assert.match(system.html, /pocket-list/);
    assert.match(system.html, /\.pocket-list\{list-style:none/);
    assert.match(system.html, /function pocketLine/);
    assert.doesNotMatch(system.html, /meta:"nuovo"/);
    assert.doesNotMatch(system.html, /#f5f5f7|#0071e3/);
    assert.match(system.html, /html\[data-grammar="phone-seed"\] nav\.tabs svg\{width:28px/);
    const perfume = composeProduct(HARD[0]!);
    const vesti = composeProduct(HARD[1]!);
    const food = composeProduct(HARD[3]!);
    const agenda = composeProduct(
      `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`,
    );
    const repo = composeProduct(
      `${formatPrefix("app")}RepoVoci: repository, commit, rami, sync e diff sul nastro.`,
    );
    assert.match(perfume.html, /<article class="card fragrance"/);
    assert.match(perfume.html, /data-imagery="domain"|viewBox/);
    assert.match(vesti.html, /lookbook/);
    assert.match(food.html, /plate|passo|comanda/i);
    assert.match(agenda.html, /day-rail/);
    assert.match(agenda.html, /Taglio e piega/);
    assert.match(repo.html, /source-timeline|repo-stage|timeline/);
    const bgs = [perfume, vesti, food, agenda, repo, system].map((p) => p.tokens.palette.bg.toLowerCase());
    assert.equal(new Set(bgs).size >= 5, true, `palettes collide ${bgs.join(" ")}`);
    const serif = composeProduct(`${formatPrefix("app")}${INTENT_SERIF_PROMPT}`);
    assert.notEqual(serif.tokens.fonts.display, "system-ui");
    const a = system;
    const b = composeProduct(
      `${formatPrefix("app")}Voglio una app stile iPhone. Font system-ui primario, tab Home Aggiungi Persona.`,
      { recent: [{ bg: a.tokens.palette.bg, surface: a.tokens.palette.surface, accent: a.tokens.palette.accent }] },
    );
    const c = composeProduct(
      `${formatPrefix("app")}Taccuino di bordo: font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD.`,
      {
        recent: [
          { bg: a.tokens.palette.bg, surface: a.tokens.palette.surface, accent: a.tokens.palette.accent },
          { bg: b.tokens.palette.bg, surface: b.tokens.palette.surface, accent: b.tokens.palette.accent },
        ],
      },
    );
    const sig = (p: typeof a) =>
      `${p.tokens.palette.bg}|${p.tokens.palette.accent}`.toLowerCase();
    assert.notEqual(sig(a), sig(b));
    assert.notEqual(sig(b), sig(c));
    assert.notEqual(sig(a), sig(c));
    const again = composeProduct(`${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}`);
    assert.equal(sig(a), sig(again));
    assert.match(system.html, /function renderPocketPersona/);
    assert.match(system.html, /function renderPocketList/);
    assert.match(system.html, /data-fenix-pane="home"/);
    assert.match(system.html, /home-overview/);
    assert.match(system.html, /Storage locale/);
    assert.match(system.html, /kind==="wipe"/);
    assert.match(system.html, /data-act="wipe-ask"/);
    assert.match(system.html, /data-act="wipe-confirm"/);
    assert.match(system.html, /data-chroma="/);
    assert.match(system.html, /minmax\(0,1fr\)/);
    assert.doesNotMatch(system.html, /min-height:calc\(100dvh - 148px\)/);
    const bootHome = system.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    assert.match(bootHome, /data-fenix-pane="home"/);
    assert.match(bootHome, /home-aside/);
    assert.match(bootHome, /fx-hello/);
    assert.match(bootHome, /Niente in lista/);
    assert.doesNotMatch(bootHome, /Panoramica|fx-board|fx-tank|<b>0<\/b>/);
    assert.doesNotMatch(bootHome, /pocket-list/);
    assert.doesNotMatch(bootHome, /data-fenix-pane="persona"/);
    assert.match(system.html, /html\+='<ul class="pocket-list">'/);
    assert.match(system.html, /slot-actions/);
    assert.match(system.html, /data-act="edit"/);
    assert.match(system.html, /data-act="del"/);
  });

  it("raises field-product chrome toward a real product without Ciao or a house palette", () => {
    const brief =
      formatPrefix("app") +
      "NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple. Accento #0A2F6B.";
    const product = composeProduct(brief);
    assert.equal(product.grammar.id, "phone-seed");
    assert.match(product.html, /<span>Home<\/span>/);
    assert.match(product.html, /<span>Registra<\/span>/);
    assert.match(product.html, /<span>Storico<\/span>/);
    assert.match(product.html, /<span>Statistiche<\/span>/);
    assert.match(product.html, /<span>Gestione<\/span>/);
    assert.match(product.html, /data-fenix-campo/);
    assert.match(product.html, /data-fenix-water-mark/);
    assert.match(product.html, /function renderPocketHistory/);
    assert.match(product.html, /function renderPocketStats/);
    assert.match(product.html, /html\+='<ul class="pocket-list" hidden/);
    assert.match(product.html, /fx-board/);
    assert.match(product.html, /fx-tank/);
    assert.match(product.html, /fxBotteSvg/);
    assert.match(product.html, /fx-botte/);
    assert.match(product.html, /fx-wave/);
    assert.match(product.html, /fx-inverse/);
    assert.match(product.html, /fx-toggle/);
    assert.match(product.html, /Obiettivo raggiunto\. Bene\./);
    assert.match(product.html, /:has\(nav\.tabs button:first-child\.on\) header/);
    assert.match(product.html, /#10B981/);
    assert.match(product.html, /fx-splash/);
    assert.match(product.html, /data-fenix-premium-mark/);
    assert.match(product.html, /Cerca per nome/);
    assert.match(product.html, /Apertura/);
    assert.match(product.html, /--inverse:/);
    assert.match(product.html, /--brand:/);
    assert.match(product.html, /#0[Ee][Aa]5[Ee]9|#10[Bb]981|#0[Ff]172[Aa]/);
    assert.doesNotMatch(product.html, /Ciao/);
    assert.doesNotMatch(product.html, /#b51246|#0071e3|#f5f5f7|#007aff/i);
    assert.notEqual(product.tokens.palette.accent.toLowerCase(), "#b51246");
    assert.equal(product.tokens.palette.accent.toLowerCase(), "#0ea5e9");
    assert.equal(product.tokens.palette.success.toLowerCase(), "#10b981");
    assert.equal(product.tokens.palette.fg.toLowerCase(), "#0f172a");
    const system = composeProduct(`${formatPrefix("app")}Lista in tasca: cose da fare operative, tipo system-ui iPhone-like, font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD. Non clonare marchi o schermate Apple.`);
    assert.match(system.html, /<span>Home<\/span>/);
    assert.match(system.html, /<span>Aggiungi<\/span>/);
    assert.match(system.html, /Niente in lista/);
    assert.doesNotMatch(system.html, /<span>Gestione<\/span>/);
  });

  it("teaches marketplace craft without cloning LikeSwift or forcing water sky", () => {
    const product = composeProduct(
      `${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`,
    );
    assert.equal(product.grammar.id, "phone-seed");
    assert.match(product.html, /data-fenix-market/);
    assert.match(product.html, /data-craft-rhythm="consumer"/);
    assert.match(product.html, /<span>Pubblica<\/span>/);
    assert.match(product.html, /<span>Attivit/);
    assert.match(product.html, /<span>Profilo<\/span>/);
    assert.match(product.html, /fx-cats/);
    assert.match(product.html, /fx-task/);
    assert.match(product.html, /#1[Ee]40[Aa][Ff]/);
    assert.match(product.html, /--fx-r3:24px/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-campo/);
    assert.doesNotMatch(product.html, /Ciao/);
    assert.doesNotMatch(product.html, /LikeSwift/);
    assert.notEqual(product.tokens.palette.accent.toLowerCase(), "#0ea5e9");
    const water = composeProduct(
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`,
    );
    assert.match(water.html, /data-fenix-campo/);
    assert.doesNotMatch(water.html, /<html[^>]*data-fenix-market/);
    assert.equal(water.tokens.palette.accent.toLowerCase(), "#0ea5e9");
  });

  it("teaches luxe craft without cloning ActStage or forcing gold on water, market or desk", () => {
    const product = composeProduct(
      `${formatPrefix("app")}Palco: scene e recitazione, prove e repertorio, stile Apple.`,
    );
    assert.equal(product.grammar.id, "phone-seed");
    assert.match(product.html, /data-fenix-luxe/);
    assert.match(product.html, /data-craft-mode="luxe"/);
    assert.match(product.html, /data-craft-rhythm="luxe"/);
    assert.match(product.html, /<span>Scena<\/span>/);
    assert.match(product.html, /<span>Prove<\/span>/);
    assert.match(product.html, /fx-scene/);
    assert.match(product.html, /Repertorio/);
    assert.match(product.html, /#D4AF37/i);
    assert.match(product.html, /#0[Dd]0[Dd]11/);
    assert.match(product.html, /--fx-t-display:46px/);
    assert.match(product.html, /--display:ui-sans-serif,system-ui/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-campo/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-market/);
    assert.doesNotMatch(product.html, /Ciao/);
    assert.doesNotMatch(product.html, /ActStage|Teleprompter|Gamification|LikeSwift/);
    assert.doesNotMatch(product.html, /#f5f5f7|#007aff|#0071e3/i);
    const water = composeProduct(
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`,
    );
    assert.match(water.html, /data-craft-mode="utility"/);
    assert.doesNotMatch(water.html, /<html[^>]*data-fenix-luxe/);
    assert.equal(water.tokens.palette.accent.toLowerCase(), "#0ea5e9");
    const market = composeProduct(
      `${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`,
    );
    assert.match(market.html, /data-craft-mode="marketplace"/);
    assert.doesNotMatch(market.html, /<html[^>]*data-fenix-luxe/);
    const desk = composeProduct(
      `${formatPrefix("dashboard")}Studio Nord: gestionale per commercialisti, fatture e F24.`,
    );
    assert.equal(desk.grammar.id, "ops-desk");
    assert.match(desk.html, /data-craft-mode="desk"/);
    assert.doesNotMatch(desk.html, /<html[^>]*data-fenix-luxe/);
    assert.notEqual(desk.tokens.palette.bg.toLowerCase(), "#0d0d11");
  });

  it("widens acqua bottiglia onto campo water craft with a contained glass botte", () => {
    const brief =
      formatPrefix("app") +
      "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.";
    const product = composeProduct(brief);
    assert.equal(product.grammar.id, "phone-seed");
    assert.match(product.html, /data-fenix-campo/);
    assert.match(product.html, /data-craft-domain="water"/);
    assert.match(product.html, /data-craft-mode="utility"/);
    assert.match(product.html, /fx-botte/);
    assert.match(product.html, /fxBotteSvg/);
    assert.match(product.html, /data-fenix-water-mark/);
    assert.match(product.html, /Serbatoio:/);
    assert.match(product.html, /fx-tank-meta/);
    assert.match(product.html, /\.fx-tank\{[^}]*overflow:hidden/);
    assert.match(product.html, /\.fx-tank-frame\{[^}]*overflow:hidden/);
    assert.match(product.html, /\.fx-axis\{[^}]*list-style:none/);
    assert.match(product.html, /overflow-wrap:anywhere/);
    assert.match(product.html, /\.home-hero\{[^}]*overflow:hidden/);
    assert.match(product.html, /background-color:#F0F9FF/);
    assert.match(product.html, /#BAE6FD|#7DD3FC|#0EA5E9/);
    assert.match(product.html, /\.fx-inverse \.fx-board\{[^}]*gap:12px/);
    assert.match(product.html, /\.fx-tank-well\{[^}]*height:176px/);
    assert.match(product.html, /\.fx-botte\{[^}]*max-height:176px/);
    assert.match(product.html, /data-craft-nav="1"/);
    assert.equal(product.tokens.palette.accent.toLowerCase(), "#0ea5e9");
    assert.doesNotMatch(product.html, /Ciao/);
    const perfume = composeProduct(
      `${formatPrefix("app")}Essenza: gestione profumi da vendere, stile iPhone.`,
    );
    assert.doesNotMatch(perfume.html, /<html[^>]*data-fenix-campo/);
    assert.doesNotMatch(perfume.html, /data-craft-domain="water"/);
    const agenda = composeProduct(
      `${formatPrefix("app")}Agenda appuntamenti e prenotazioni, stile Apple.`,
    );
    assert.doesNotMatch(agenda.html, /<html[^>]*data-fenix-campo/);
    const generic = composeProduct(
      `${formatPrefix("app")}Lista in tasca: cose da fare operative, tipo system-ui iPhone-like.`,
    );
    assert.match(generic.html, /\.fx-tank\{[^}]*overflow:hidden/);
    assert.match(generic.html, /\.fx-axis\{[^}]*list-style:none/);
    assert.doesNotMatch(generic.html, /data-craft-domain="water"/);
  });

  it("renders a water-drop header mark on acqua bottiglia, not the live exit door or a briefcase", () => {
    const brief =
      formatPrefix("app") +
      "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.";
    const product = composeProduct(brief);
    const hello =
      product.html.match(/html\+='<div class="fx-hello-row"[\s\S]{0,360}/)?.[0] || "";
    const mark = campoHomeHeaderMark();
    const office = craftNavIcon({ id: "app", label: "Ufficio" });
    const officeMotif = "M10 7h12v16H10z";
    assert.match(hello, /FX_WATER_MARK/);
    assert.match(hello, /fx-app-mark/);
    assert.doesNotMatch(hello, /fx-exit|FX_EXIT_MARK|aria-label=\\"Esci\\"|aria-label="Esci"/);
    assert.match(product.html, /data-fenix-water-header=\\?"1\\?"/);
    assert.match(product.html, /M12 4\.4c3\.8 4\.8 5\.6 8\.2/);
    assert.match(mark, /data-fenix-water-header="1"/);
    assert.match(mark, /M12 4\.4c3\.8 4\.8 5\.6 8\.2/);
    assert.match(mark, /#082338|#0F3A5C/);
    assert.match(mark, /cwd-drop/);
    assert.doesNotMatch(mark, /fill-opacity="\.18"|fill="none"/);
    assert.match(product.html, /\.fx-app-mark\{[^}]*background:#082338/);
    assert.match(product.html, /\.fx-app-mark\{[^}]*width:48px/);
    assert.doesNotMatch(product.html, /\.fx-app-mark\{[^}]*#E0F2FE,#BAE6FD/);
    assert.match(product.html, /rel="apple-touch-icon"/);
    assert.match(product.html, /rel="icon" type="image\/svg\+xml"/);
    assert.match(product.html, /M12(?: |%20)4\.4c3\.8/);
    assert.doesNotMatch(product.html, new RegExp(officeMotif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.notEqual(mark, office.replace('data-craft-nav="1"', 'data-craft-app="1"'));
    assert.doesNotMatch(product.html, /M10 7V5\.8A1\.8|M4 12h10M11\.2 8\.8/);
    assert.doesNotMatch(product.html, /M4\.8 8\.8h14\.4|M5\.2 8\.6h13\.6/);
    assert.doesNotMatch(office, /M12 4\.4c3\.8 4\.8 5\.6 8\.2/);
    assert.ok(contrastRatio("#082338", "#38BDF8") >= 4.5, "filled drop on navy chip must stay readable");
    const homeTab = craftNavIcon({ id: "home", label: "Acqua" });
    assert.match(product.html, /<span>Home<\/span>/);
    assert.match(homeTab, /M12 4\.4c3\.8 4\.8 5\.6 8\.2/);
    assert.match(homeTab, /data-craft-nav="1"/);
    const fallbackIcon = productIconSvg({
      name: "App acqua bottiglia",
      kind: "app",
      palette: product.tokens.palette,
      prompt: brief,
    });
    assert.match(fallbackIcon, /M16 6c5 6\.4 7\.4 11/);
    assert.doesNotMatch(fallbackIcon, /M10 7h12v16H10z/);
  });

  it("paints filled espresso shears and navy book marks for barber and library, not faint scraps or exit doors", () => {
    const barberBrief = formatPrefix("app") + "App barbiere: agenda tagli e clienti, stile iPhone.";
    const libraryBrief = formatPrefix("app") + "App libreria: catalogo libri, prestiti e scaffali, stile iPhone.";
    const barber = composeProduct(barberBrief);
    const library = composeProduct(libraryBrief);
    const officeMotif = "M10 7h12v16H10z";
    const exitDoor = /M10 7V5\.8A1\.8|M4 12h10M11\.2 8\.8/;
    const header = (html: string) => html.match(/<span class="app-mark"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "";
    const barberMark = header(barber.html);
    const libraryMark = header(library.html);
    assert.equal(appIdentityLabel(barberBrief, barber.tokens.family), "Taglio");
    assert.equal(appIdentityLabel(libraryBrief, library.tokens.family), "Libri");
    assert.match(barberMark, /data-fenix-barber-mark="1"/);
    assert.match(barberMark, /data-fenix-shears-fill="1"/);
    assert.match(barberMark, /data-fenix-shears-defined="1"/);
    assert.match(barberMark, /data-fenix-crisp-mark="1"/);
    assert.match(barberMark, /M22\.8 3\.9 26\.4 6\.85/);
    assert.match(barberMark, /fill-rule="evenodd"/);
    assert.match(barberMark, /<path /);
    assert.match(barberMark, /#0B0908|#1C1612/);
    assert.doesNotMatch(barberMark, /fill-opacity="\.18"/);
    assert.match(libraryMark, /data-fenix-book-mark="1"/);
    assert.match(libraryMark, /M8\.2 6\.2h13\.4/);
    assert.doesNotMatch(libraryMark, /fill="none"|fill-opacity="\.18"/);
    assert.notEqual(barberMark, libraryMark);
    assert.doesNotMatch(barber.html, exitDoor);
    assert.doesNotMatch(library.html, exitDoor);
    assert.doesNotMatch(library.html, /M5\.2 5\.2h13\.6|M5\.2 8\.6h13\.6/);
    assert.doesNotMatch(library.html, new RegExp(officeMotif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(barber.html, /rel="apple-touch-icon"/);
    assert.match(library.html, /rel="apple-touch-icon"/);
    assert.match(barber.html, /rel="icon" type="image\/svg\+xml"/);
    assert.match(barber.html, /header \.app-mark\{[^}]*background:transparent/);
    assert.match(barber.html, /header \.app-mark svg[^}]*width:48px/);
    assert.ok(contrastRatio("#0B0908", "#D2BFA6") >= 4.5, "tan shears on espresso must stay readable");
    assert.ok(contrastRatio("#082338", "#7DD3FC") >= 3, "book cover on navy must stay obvious");
    const barberIcon = productIconSvg({
      name: "App barbiere",
      kind: "app",
      palette: barber.tokens.palette,
      prompt: barberBrief,
    });
    const libraryIcon = productIconSvg({
      name: "App libreria",
      kind: "app",
      palette: library.tokens.palette,
      prompt: libraryBrief,
    });
    assert.match(barberIcon, /data-fenix-barber-mark="1"/);
    assert.match(libraryIcon, /data-fenix-book-mark="1"/);
    assert.doesNotMatch(barberIcon, /M10 7h12v16H10z/);
    assert.doesNotMatch(libraryIcon, /M10 7h12v16H10z/);
  });

  it("teaches barber salon craft: espresso booking Home, not a pale staff KPI sheet", () => {
    const brief = formatPrefix("app") + "App barbiere: agenda tagli e clienti, stile iPhone.";
    const product = composeProduct(brief);
    assert.equal(product.grammar.id, "agenda");
    assert.match(product.html, /data-fenix-barber/);
    assert.match(product.html, /data-craft-domain="barber"/);
    assert.match(product.html, /data-craft-mode="salon"/);
    assert.match(product.html, /<span>Home<\/span>/);
    assert.match(product.html, /<span>Prenota<\/span>/);
    assert.match(product.html, /<span>I miei<\/span>/);
    assert.doesNotMatch(product.html, /<span>Oggi<\/span>/);
    assert.doesNotMatch(product.html, /<span>Nuovo<\/span>/);
    assert.doesNotMatch(product.html, /<span>Settimana<\/span>/);
    assert.doesNotMatch(product.html, /<span>Archivio<\/span>/);
    assert.match(product.html, /Taglio e piega/);
    assert.match(product.html, /€42|€28/);
    assert.match(product.html, /Il taglio, al tuo ritmo/);
    assert.match(product.html, /data-fenix-salon-art="1"/);
    assert.match(product.html, /salon-cta-prenota/);
    assert.match(product.html, /I miei appuntamenti/);
    const hero = product.html.match(/class="salon-hero"[^>]*>([\s\S]*?)<\/div><\/div>/)?.[1] || "";
    assert.match(hero, /data-view="prenota">Prenota →/);
    assert.match(hero, /data-view="miei">I miei appuntamenti/);
    const splash = product.html.match(/id="fx-splash"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
    assert.match(splash, /data-fenix-barber-mark="1"/);
    assert.match(splash, /data-fenix-shears-fill="1"/);
    assert.match(splash, /salon-cta-prenota/);
    assert.match(splash, /data-view="prenota">Prenota →/);
    assert.match(product.html, /<header[\s\S]*data-view="prenota">Prenota<\/button>/);
    assert.match(hero, /<path /);
    assert.doesNotMatch(hero, /<img\b|unsplash|pexels|corto/i);
    assert.match(product.html, /Passaggio 1 di 2/);
    assert.match(product.html, /In poltrona|Sala taglio/);
    assert.doesNotMatch(product.html, /oggi in sala/);
    assert.doesNotMatch(product.html, /barber-strip/);
    assert.doesNotMatch(product.html, /Corto|Gentleman Barber|Il dettaglio fa la differenza/i);
    assert.match(product.html, /data-fenix-barber-mark="1"/);
    assert.equal((product.html.match(/data-fenix-id="icon:app"/g) || []).length, 1);
    assert.doesNotMatch(product.html, /class="fx-app-mark"/);
    assert.doesNotMatch(product.html, /data-fenix-barber\]:has\(nav\.tabs button:first-child\.on\) header/);
    const headerMark = product.html.match(/<span class="app-mark"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "";
    const iconHref = product.html.match(/rel="icon" type="image\/svg\+xml" href="([^"]+)"/)?.[1] || "";
    const touchHref = product.html.match(/rel="apple-touch-icon" href="([^"]+)"/)?.[1] || "";
    const favicon = decodeURIComponent(iconHref.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));
    assert.match(headerMark, /data-fenix-barber-mark="1"/);
    assert.match(headerMark, /data-fenix-shears-fill="1"/);
    assert.match(headerMark, /data-fenix-shears-defined="1"/);
    assert.match(headerMark, /M22\.8 3\.9 26\.4 6\.85/);
    assert.match(headerMark, /fill-rule="evenodd"/);
    assert.match(headerMark, /<path /);
    assert.match(favicon, /data-fenix-barber-mark="1"/);
    assert.match(favicon, /data-fenix-shears-fill="1"/);
    assert.match(favicon, /data-fenix-shears-defined="1"/);
    assert.match(favicon, /M22\.8 3\.9 26\.4 6\.85/);
    assert.equal(iconHref, touchHref);
    assert.doesNotMatch(headerMark, /fill-opacity="\.18"/);
    assert.doesNotMatch(product.html, /FX_BARBER_MARK/);
    assert.match(product.html, /--display:ui-sans-serif,system-ui/);
    assert.doesNotMatch(product.html, /fonts.googleapis.com/);
    assert.match(product.html, /#0B0908|#F4EEE6|#D2BFA6/i);
    assert.match(product.html, /html\[data-fenix-barber\] header\{[^}]*blur\(8px\)/);
    assert.match(product.html, /html\[data-fenix-barber\] nav\.tabs\{[^}]*blur\(6px\)/);
    assert.match(product.html, /html\[data-fenix-barber\] \.salon-display\{[^}]*font:800/);
    assert.match(product.html, /\.btn\.salon-cta-prenota\{[^}]*border:2px solid #E4D3B8/);
    assert.match(product.html, /\.btn\.salon-cta-prenota:active\{[^}]*background:#C4A882/);
    assert.match(product.html, /\.fx-splash \.btn\.salon-cta-prenota\{[^}]*flex:0 0 auto/);
    assert.match(product.html, /header \.btn\.salon-cta-prenota\{[^}]*flex:0 0 auto/);
    assert.match(product.html, /border:1px solid #4A3C30/);
    assert.doesNotMatch(product.html, /html\[data-fenix-barber\] nav\.tabs\{[^}]*blur\(18px\)/);
    assert.equal(product.tokens.fonts.display, "system-ui");
    assert.equal(product.tokens.fonts.body, "system-ui");
    assert.equal(product.tokens.palette.accent.toLowerCase(), "#d2bfa6");
    assert.equal(product.tokens.palette.bg.toLowerCase(), "#0b0908");
    assert.notEqual(product.tokens.palette.accent.toLowerCase(), "#0ea5e9");
    assert.notEqual(product.tokens.palette.accent.toLowerCase(), "#1f6f68");
    assert.doesNotMatch(product.html, /#b51246|#b01e47|#a61d4c/i);
    assert.doesNotMatch(product.html, /<span>Tavolo<\/span>/);
    assert.doesNotMatch(product.html, /<span>Registra<\/span>/);
    assert.doesNotMatch(product.html, /M10 7V5\.8A1\.8|M4 12h10M11\.2 8\.8/);
    const mark = barberHomeHeaderMark();
    assert.match(mark, /data-fenix-barber-mark="1"/);
    assert.match(mark, /data-fenix-shears-defined="1"/);
    assert.match(mark, /M22\.8 3\.9 26\.4 6\.85/);
    const water = composeProduct(
      formatPrefix("app") +
        "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.",
    );
    const library = composeProduct(
      formatPrefix("app") + "App libreria: catalogo libri, prestiti e scaffali, stile iPhone.",
    );
    assert.match(water.html, /data-fenix-campo/);
    assert.doesNotMatch(water.html, /<html[^>]*data-fenix-barber/);
    assert.match(library.html, /data-fenix-libreria/);
    assert.doesNotMatch(library.html, /<html[^>]*data-fenix-barber/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-campo/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-libreria/);
  });

  it("composes a TikTok-like brief as clip-feed, not Home/Aggiungi/Elenco", () => {
    const brief = formatPrefix("app") + "mi crei un app simile tik tok";
    const product = composeProduct(brief);
    const visible = product.html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
    const boot = product.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    assert.equal(product.grammar.id, "clip-feed");
    assert.equal(product.tokens.family, "night");
    assert.equal(product.tokens.chroma, "chroma-pulse");
    assert.match(product.html, /data-grammar="clip-feed"/);
    assert.match(product.html, /<span>Feed<\/span>/);
    assert.match(product.html, /<span>Crea<\/span>/);
    assert.match(product.html, /<span>Profilo<\/span>/);
    assert.match(product.html, /clip-stage/);
    assert.match(product.html, /clip-frame/);
    assert.match(product.html, /clip-ambient/);
    assert.match(product.html, /clip-beats/);
    assert.match(product.html, /clip-ava/);
    assert.match(product.html, /data-fenix-clip/);
    assert.match(product.html, /function renderClipFeed/);
    assert.match(product.html, /min\(540px,48vw\)/);
    assert.match(product.html, /clip-brand/);
    assert.doesNotMatch(product.html, /html\[data-grammar="clip-feed"\] \.app\{[^}]*max-width:390px/);
    assert.doesNotMatch(product.html, /grid-template-areas:"head nav"/);
    assert.doesNotMatch(product.html, /width="78" height="130"/);
    assert.match(boot, /Luce di Brera/);
    assert.doesNotMatch(visible, /<span>Aggiungi<\/span>/);
    assert.doesNotMatch(visible, /Niente in lista/);
    assert.doesNotMatch(visible, /Aggiungi la prima voce/);
    assert.doesNotMatch(visible, /voci sul dispositivo/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-premium[\s>]/);
    assert.match(product.polish, /clip-stage a tutto schermo|clip a tutto schermo/);
    assert.doesNotMatch(product.html, /For You/);
    const qa = auditGraphicQuality(product.html, { brief, kind: "app" });
    assert.equal(
      qa.findings.some((f) => f.severity === "fail" && (f.code === "ledger-on-feed" || f.code === "missing-clip-stage")),
      false,
      qa.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(","),
    );
  });

  it("raises default compose for a plain brief above the old utility floor", () => {
    const appBrief = formatPrefix("app") + "Note e promemoria per la giornata.";
    const deskBrief = formatPrefix("dashboard") + "Gestionale ufficio: pratiche, scadenze e clienti.";
    const siteBrief = "FORMATO: sito web. kind=site. atlante delle maree";
    const app = composeProduct(appBrief);
    const desk = composeProduct(deskBrief);
    const site = composeProduct(siteBrief);
    const boot = app.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    const visible = app.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");

    assert.equal(app.grammar.id, "phone-seed");
    assert.match(app.html, /data-fenix-pocket/);
    assert.match(app.html, /<html[^>]*data-fenix-premium[\s>]/);
    assert.match(app.html, /data-craft-rhythm="consumer"/);
    assert.match(app.html, /data-craft-domain="generic"/);
    assert.match(app.html, /<span>Home<\/span>/);
    assert.match(app.html, /<span>Aggiungi<\/span>/);
    assert.match(app.html, /<span>Elenco<\/span>/);
    assert.match(app.html, /<p class="place">Personale<\/p>/);
    assert.match(app.html, /fx-hello/);
    assert.match(app.html, /fx-app-mark/);
    assert.match(app.html, /data-fenix-crisp-mark|data-fenix-premium-mark/);
    assert.match(app.html, /Niente in lista/);
    assert.match(boot, /class="mark"/);
    assert.match(boot, /fx-hello/);
    assert.doesNotMatch(visible, /<span>Tavolo<\/span>/);
    assert.doesNotMatch(visible, /<span>Studio<\/span>/);
    assert.doesNotMatch(visible, /<p class="place">Studio<\/p>/);
    assert.doesNotMatch(boot, /fx-board|fx-tank/);
    assert.doesNotMatch(boot, /<b>0<\/b>/);
    assert.doesNotMatch(boot, /Panoramica/);
    assert.doesNotMatch(app.html, /<span>Oggi<\/span><\/div><div class="fx-cell"><b>0<\/b><span>Media/);
    assert.match(app.html, /html\[data-fenix-pocket\] \.fx-hello\{/);
    assert.match(app.html, /html\[data-fenix-pocket\]:has\(nav\.tabs button:first-child\.on\) header \.app-mark\{display:none\}/);
    assert.doesNotMatch(app.html, /html\[data-fenix-pocket\]:has\(nav\.tabs button:first-child\.on\) header\{display:none\}/);
    assert.match(app.html, /--shadow-card:0 1px 0/);
    assert.doesNotMatch(app.html, /<html[^>]*data-fenix-campo/);
    assert.doesNotMatch(app.html, /<html[^>]*data-fenix-libreria/);
    assert.doesNotMatch(app.html, /<html[^>]*data-fenix-barber/);
    const mark = pocketHomeHeaderMark(appBrief, app.tokens.family);
    assert.match(mark, /data-fenix-crisp-mark="1"|data-fenix-premium-mark="1"/);
    assert.doesNotMatch(mark, /fill="none" stroke="currentColor"/);

    assert.equal(desk.grammar.id, "ops-desk");
    assert.match(desk.html, /<html[^>]*data-fenix-premium[\s>]/);
    assert.match(desk.html, /data-craft-mode="desk"/);
    assert.match(desk.html, /<span>Pipeline<\/span>/);
    assert.match(desk.html, /desk-hello|fx-hello/);
    assert.match(desk.html, /desk-empty/);
    assert.match(desk.html, /data-fenix-id="icon:app"/);
    assert.match(desk.html, /data-fenix-crisp-mark|data-fenix-premium-mark/);
    assert.doesNotMatch(desk.html, /<span>Tavolo<\/span>/);
    assert.doesNotMatch(desk.html, /<span>Studio<\/span>/);
    assert.doesNotMatch(desk.html, /<p class="place">Studio<\/p>/);
    assert.doesNotMatch(desk.html.replace(/<style[\s\S]*?<\/style>/gi, ""), /<b>0<\/b>/);
    assert.doesNotMatch(desk.html, /<html[^>]*data-fenix-luxe/);
    const deskBoot = desk.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    assert.doesNotMatch(deskBoot, /class="hero"/);

    assert.equal(site.grammar.id, "magazine");
    assert.equal(site.grammar.chrome, "masthead");
    assert.match(site.html, /<html[^>]*data-fenix-website/);
    assert.match(site.html, /class="identity"/);
    assert.match(site.html, /class="hero"/);
    assert.match(site.html, /id="contatti"/);
    assert.doesNotMatch(site.html, /Fascicolo editoriale/);
    assert.doesNotMatch(site.html, /<span>Tavolo<\/span>/);
    assert.doesNotMatch(site.html, /nav\.tabs/);
    assert.doesNotMatch(site.html, /<p class="place">Studio<\/p>/);
    const siteBoot = site.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    assert.doesNotMatch(siteBoot, /class="hero"/);
    assert.doesNotMatch(site.html, /Rivista di lastre fotografiche/);

    const water = composeProduct(
      formatPrefix("app") +
        "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.",
    );
    const library = composeProduct(
      formatPrefix("app") + "App libreria: catalogo libri, prestiti e scaffali, stile iPhone.",
    );
    const barber = composeProduct(formatPrefix("app") + "App barbiere: agenda tagli e clienti, stile iPhone.");
    assert.match(water.html, /data-fenix-campo/);
    assert.doesNotMatch(water.html, /data-fenix-pocket/);
    assert.match(library.html, /data-fenix-libreria/);
    assert.doesNotMatch(library.html, /data-fenix-pocket/);
    assert.match(barber.html, /data-fenix-barber/);
    assert.doesNotMatch(barber.html, /data-fenix-pocket/);
    assert.doesNotMatch(water.html, /<html[^>]*data-fenix-premium[\s>]/);
    assert.doesNotMatch(library.html, /<html[^>]*data-fenix-premium[\s>]/);
    assert.doesNotMatch(barber.html, /<html[^>]*data-fenix-premium[\s>]/);
  });

  it("applies the premium system floor to unmatched site, desk, tool and distant-domain apps", () => {
    const tool = composeProduct(
      `${formatPrefix("tool")}Segnale Mono: strumento a contrasto alto, segnale unico, niente colore di mestiere.`,
    );
    const clinica = composeProduct(
      `${formatPrefix("app")}Clinica Aurora: agenda di uno studio medico, pazienti, slot e terapie.`,
    );
    const pulse = composeProduct(
      `${formatPrefix("app")}Pulse Radio: palinsesto live, playlist e impulsi di una radio notturna ad alta croma.`,
    );
    const pastel = composeProduct(
      `${formatPrefix("app")}Studio Pastello: didattica e wellness, lezioni in pastello.`,
    );
    const ids = [tool.grammar.id, clinica.grammar.id, pulse.grammar.id, pastel.grammar.id];
    assert.equal(new Set(ids).size, 4, ids.join(","));
    assert.equal(tool.grammar.id, "pocket-tool");
    assert.equal(clinica.grammar.id, "agenda");
    assert.equal(pulse.grammar.id, "split-stage");
    assert.equal(pastel.grammar.id, "service-board");

    for (const product of [tool, pulse, pastel]) {
      const boot = product.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
      const visible = product.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
      assert.match(product.html, /<html[^>]*data-fenix-premium[\s>]/);
      assert.match(product.html, /data-craft-rhythm="consumer"/);
      assert.match(product.html, /data-fenix-crisp-mark|data-fenix-premium-mark/);
      assert.match(product.html, /fx-hello/);
      assert.doesNotMatch(boot, /class="hero"/);
      assert.doesNotMatch(visible, /<span>Tavolo<\/span>/);
      assert.doesNotMatch(visible, /<span>Studio<\/span>/);
      assert.doesNotMatch(product.html, /<html[^>]*data-fenix-campo/);
      assert.doesNotMatch(product.html, /<html[^>]*data-fenix-libreria/);
      assert.doesNotMatch(product.html, /<html[^>]*data-fenix-barber/);
    }

    assert.match(clinica.html, /<html[^>]*data-fenix-premium[\s>]/);
    assert.match(clinica.html, /data-fenix-crisp-mark|data-fenix-premium-mark/);
    assert.match(clinica.html, /data-craft-rhythm="consumer"/);
    assert.doesNotMatch(clinica.html, /<span>Tavolo<\/span>/);
    assert.doesNotMatch(clinica.html, /<html[^>]*data-fenix-barber/);
    assert.match(tool.html, /Niente in lista/);
    assert.match(tool.polish, /Chrome premium di sistema/);
  });

  it("teaches library bookstore craft instead of falling to desk STUDIO/Tavolo/0-KPI", () => {
    const brief = formatPrefix("app") + "App libreria: catalogo libri, prestiti e scaffali, stile iPhone.";
    const product = composeProduct(brief);
    assert.equal(product.grammar.id, "phone-seed");
    assert.match(product.html, /data-fenix-libreria/);
    assert.match(product.html, /data-craft-domain="library"/);
    assert.match(product.html, /data-craft-mode="bookstore"/);
    assert.match(product.html, /<span>Catalogo<\/span>/);
    assert.match(product.html, /<span>Prestiti<\/span>/);
    assert.match(product.html, /<span>Scaffali<\/span>/);
    assert.match(product.html, /<span>Scheda<\/span>/);
    assert.match(product.html, /Sala lettura/);
    assert.match(product.html, /In prestito/);
    assert.match(product.html, /In scaffale/);
    assert.match(product.html, /Il nome della rosa/);
    assert.match(product.html, /Nessun libro in scaffale/);
    assert.match(product.html, /if\(libraryProduct\)/);
    assert.match(product.html, /FX_BOOK_MARK/);
    assert.match(product.html, /data-fenix-book-mark="1"/);
    assert.match(product.html, /:has\(nav\.tabs button:first-child\.on\) header/);
    assert.match(product.html, /#6B2D3C|#F6EFE4|#2A1814/i);
    assert.equal(product.tokens.palette.accent.toLowerCase(), "#6b2d3c");
    assert.notEqual(product.tokens.palette.accent.toLowerCase(), "#0ea5e9");
    assert.doesNotMatch(product.html, /<span>Tavolo<\/span>/);
    assert.doesNotMatch(product.html, /<span>Registra<\/span>/);
    assert.doesNotMatch(product.html, /<span>Studio<\/span>/);
    assert.doesNotMatch(product.html, />Studio</);
    assert.doesNotMatch(product.html, /<p class="place">Studio<\/p>/);
    assert.doesNotMatch(product.html, /<span>Oggi<\/span><\/div><div class="fx-cell"><b>0<\/b><span>Media/);
    const boot = product.html.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    assert.doesNotMatch(boot, /fx-board|Tavolo|Registra|STUDIO/);
    assert.match(boot, /In scaffale|Nessun libro in scaffale/);
    assert.match(boot, /data-fenix-book-mark/);
    const mark = libraryHomeHeaderMark();
    assert.match(mark, /data-fenix-book-mark="1"/);
    assert.match(mark, /M8\.2 6\.2h13\.4/);
    const water = composeProduct(
      formatPrefix("app") +
        "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.",
    );
    assert.match(water.html, /data-fenix-campo/);
    assert.doesNotMatch(water.html, /<html[^>]*data-fenix-libreria/);
    assert.doesNotMatch(product.html, /<html[^>]*data-fenix-campo/);
  });

  it("keeps composed phone apps under the Edge artifact cap", () => {
    const briefs = [
      "FORMATO: app. kind=app. Agenda studio: appuntamenti e prenotazioni, stile iPhone.",
      "FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito.\n\nmi crei un app da parrucchieri stile Barber shop",
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`,
      `${formatPrefix("app")}App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.`,
      `${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`,
      `${formatPrefix("app")}Palco: scene e recitazione, prove e repertorio, stile Apple.`,
      `${formatPrefix("app")}Emporio Luce: negozio di lampade da tavolo, stile Apple.`,
      `${formatPrefix("app")}App barbiere: agenda tagli e clienti, stile iPhone.`,
      `${formatPrefix("app")}App libreria: catalogo libri, prestiti e scaffali, stile iPhone.`,
      `${formatPrefix("app")}mi crei un app simile tik tok`,
      `${formatPrefix("app")}Crea un'app per registrare l'acqua utilizzata dai dipendenti. Servono login, ruoli amministratore e dipendente, luoghi di lavoro, registrazioni con litri, data, turno e nota, storico filtrabile e statistiche.`,
    ];
    for (const brief of briefs) {
      const html = composeProduct(brief).html;
      assert.ok(
        html.length <= MAX_ARTIFACT_CHARS,
        `${brief.slice(0, 48)}… ${html.length} > ${MAX_ARTIFACT_CHARS}`,
      );
    }
  });
});

describe("composed shared-ops water product", () => {
  it("composes a shared-ops water app with real /auth and no trial employees", () => {
    const brief =
      formatPrefix("app") +
      "Crea un'app per registrare l'acqua utilizzata dai dipendenti. Servono login, ruoli amministratore e dipendente, luoghi di lavoro, registrazioni con litri, data, turno e nota, storico filtrabile e statistiche. L'amministratore vede tutto; ogni dipendente vede e gestisce solo le proprie registrazioni. I dati devono essere condivisi tra dispositivi e restare disponibili dopo logout e ricaricamento.";
    const product = composeProduct(brief);
    assert.match(product.html, /data-fenix-campo/);
    assert.match(product.html, /data-fenix-ops/);
    assert.match(product.html, /\/auth\/login/);
    assert.match(product.html, /\/auth\/signup/);
    assert.match(product.html, /\/api\/registrazioni/);
    assert.match(product.html, />Litri</);
    assert.match(product.html, /id="fx-auth"/);
    assert.doesNotMatch(product.html, /Marta Neri|Leo Bianchi|Noa Greco/);
    assert.doesNotMatch(product.html, /\blocalStorage\b/);
    assert.doesNotMatch(product.html, /password_hash|correct horse/);
    const manifest = product.files.find((file) => file.path === "backend/fenix.backend.json");
    assert.ok(manifest);
    const spec = JSON.parse(manifest!.content) as {
      collections: Array<{ name: string; scope?: string }>;
    };
    assert.ok(spec.collections.some((collection) => collection.name === "registrazioni" && collection.scope === "org"));
    assert.ok(spec.collections.some((collection) => collection.name === "luoghi" && collection.scope === "catalog"));
    const report = validateProductHtml(product.html, { kind: "app" });
    assert.equal(report.ok, true, report.errors.join("; "));
    const visual = composeProduct(
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`,
    );
    assert.doesNotMatch(visual.html, /data-fenix-ops/);
    assert.doesNotMatch(visual.html, /\/auth\/login/);
  });
});

describe("composed create find/replace anchors", () => {
  const waterBrief =
    formatPrefix("app") +
    "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.";
  const campoBrief =
    formatPrefix("app") +
    "NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.";
  const phoneBrief =
    formatPrefix("app") +
    "Lista in tasca: cose da fare operative, tipo system-ui iPhone-like, font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD.";
  const agendaBrief = formatPrefix("app") + "Agenda studio: appuntamenti e prenotazioni, stile iPhone.";

  const naiveFinds = [
    '<div class="fx-board" aria-label="Sintesi">',
    '<div class="fx-tank">',
    "data-fenix-pane=\"home\"",
    "M26 36C26 22 214 22 214 36V168",
    "M60 26c12.4 17.2 19.4 29.6",
  ];

  it("stamps unique fenix-slot anchors on water, campo, phone and agenda seeds", () => {
    for (const brief of [waterBrief, campoBrief, phoneBrief, agendaBrief]) {
      const html = composeProduct(brief).html;
      const anchors = composedSeedAnchors(html);
      assert.ok(anchors.includes("/*fenix-slot:save*/"), brief);
      assert.ok(anchors.includes("/*fenix-slot:form*/"), brief);
      assert.ok(anchors.includes("/*fenix-slot:render*/"), brief);
      assert.ok(anchors.includes('data-fenix-slot="root"'), brief);
      assert.ok(anchors.includes('data-fenix-slot="form"'), brief);
      for (const example of COMPOSED_BUILD_FIND_EXAMPLES) {
        assert.equal(composedFindStatus(html, example).usable, true, `${brief} ${example}`);
        assert.match(COMPOSED_BUILD_SYSTEM, new RegExp(example.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
    const water = composeProduct(waterBrief).html;
    assert.ok(composedSeedAnchors(water).includes("/*fenix-slot:botte*/"));
    assert.ok(composedSeedAnchors(water).includes("/*fenix-slot:home*/"));
    assert.ok(composedSeedAnchors(water).includes('data-fenix-slot="home"'));
    assert.match(water, /data-fenix-slot="home-boot"/);
    assert.match(water, /class='fx-botte'/);
    assert.equal(composedFindStatus(water, "/*fenix-slot:botte*/function fxBotteSvg(pct){").usable, true);
    const boot = water.match(/<main id="root"[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    assert.doesNotMatch(boot, /fx-board|fx-tank|fx-botte/);
    assert.match(boot, /Missioni|Quadro di controllo/);
    assert.match(boot, /Niente in lista|data-fenix-water-header/);
  });

  it("applies hash-bound slot plans on water/campo without rewriting the botte or falling back to full HTML", () => {
    for (const brief of [waterBrief, campoBrief]) {
      const html = composeProduct(brief).html;
      const find = "/*fenix-slot:commit*/function commitForm(f){";
      const replace = "/*fenix-slot:commit*/function commitForm(f){ /* acqua: litri dal brief */";
      const next = applyComposedBuildPlan(html, {
        version: 1,
        baseSha256: composedBaseSha(html),
        changes: [{ find, replace }],
      });
      assert.equal(next.split("<body")[0], html.split("<body")[0]);
      assert.ok(next.includes(replace));
      assert.match(next, /class='fx-botte'/);
      assert.match(next, /function fxBotteSvg\(pct\)\{/);
      assert.doesNotMatch(next, /<!doctype html>[\s\S]*<!doctype html>/i);
      assert.throws(
        () => applyComposedBuildPlan(html, {
          version: 1,
          baseSha256: composedBaseSha(html),
          changes: [{ find: "M26 36C26 22 214 22 214 36V168", replace: "M26 36C26 22 214 22 214 36V168 /* no */" }],
        }),
        /ambiguo/,
      );
    }
  });

  it("raises usable find rate on water by slimming duplicated boot chrome and exposing slots", () => {
    const water = composeProduct(waterBrief).html;
    const slotFinds = [
      ...COMPOSED_BUILD_FIND_EXAMPLES,
      "/*fenix-slot:botte*/function fxBotteSvg(pct){",
      "/*fenix-slot:home*/function renderPocketHome(){",
      "/*fenix-slot:tank*/function fxTankMarkup(n){",
      "/*fenix-slot:commit*/function commitForm(f){",
      'data-fenix-slot="form"',
    ];
    const naiveOk = naiveFinds.filter((find) => composedFindStatus(water, find).usable).length;
    const slotOk = slotFinds.filter((find) => composedFindStatus(water, find).usable).length;
    assert.equal(slotOk, slotFinds.length, `slot finds ${slotOk}/${slotFinds.length}`);
    assert.ok(slotOk > naiveOk, `expected slot finds ${slotOk} > naive ${naiveOk}`);
    assert.equal(composedFindStatus(water, '<div class="fx-board" aria-label="Sintesi">').usable, true);
    assert.equal(composedFindStatus(water, '<div class="fx-tank">').usable, true);
    assert.equal(composedFindStatus(water, "M26 36C26 22 214 22 214 36V168").usable, false);
    assert.equal(composedFindStatus(water, "M60 26c12.4 17.2 19.4 29.6").usable, false);
    assert.ok(
      naiveOk / naiveFinds.length <= 0.6,
      `naive water finds should stay lossy (${naiveOk}/${naiveFinds.length}) so slots remain the reliable path`,
    );
  });

  it("composes a shared-ops water app with real /auth and no trial employees", () => {
    const brief =
      formatPrefix("app") +
      "Crea un'app per registrare l'acqua utilizzata dai dipendenti. Servono login, ruoli amministratore e dipendente, luoghi di lavoro, registrazioni con litri, data, turno e nota, storico filtrabile e statistiche. L'amministratore vede tutto; ogni dipendente vede e gestisce solo le proprie registrazioni. I dati devono essere condivisi tra dispositivi e restare disponibili dopo logout e ricaricamento.";
    const product = composeProduct(brief);
    assert.match(product.html, /data-fenix-campo/);
    assert.match(product.html, /data-fenix-ops/);
    assert.match(product.html, /\/auth\/login/);
    assert.match(product.html, /\/auth\/signup/);
    assert.match(product.html, /\/api\/registrazioni/);
    assert.match(product.html, />Litri</);
    assert.match(product.html, /id="fx-auth"/);
    assert.doesNotMatch(product.html, /Marta Neri|Leo Bianchi|Noa Greco/);
    assert.doesNotMatch(product.html, /\blocalStorage\b/);
    assert.doesNotMatch(product.html, /password_hash|correct horse/);
    const manifest = product.files.find((file) => file.path === "backend/fenix.backend.json");
    assert.ok(manifest);
    const spec = JSON.parse(manifest!.content) as {
      collections: Array<{ name: string; scope?: string }>;
    };
    assert.ok(spec.collections.some((collection) => collection.name === "registrazioni" && collection.scope === "org"));
    assert.ok(spec.collections.some((collection) => collection.name === "luoghi" && collection.scope === "catalog"));
    const report = validateProductHtml(product.html, { kind: "app" });
    assert.equal(report.ok, true, report.errors.join("; "));
    const visual = composeProduct(
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`,
    );
    assert.doesNotMatch(visual.html, /data-fenix-ops/);
    assert.doesNotMatch(visual.html, /\/auth\/login/);
  });
});
