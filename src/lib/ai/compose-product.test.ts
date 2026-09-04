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
        assert.match(run.generated.html, /data-lane=/);
        assert.match(run.generated.html, /function spark\(seed/);
        assert.match(run.generated.html, /data-kpi=/);
        assert.match(run.generated.html, /ledger-art/);
        assert.doesNotMatch(run.generated.html, /height:40%[\s\S]*height:70%[\s\S]*height:55%[\s\S]*height:90%[\s\S]*height:62%/);
      }
      assert.match(run.generated.html, /--t-h1:/);
      assert.match(run.generated.html, /--t-h2:/);
      assert.match(run.generated.html, /--ink-quiet:/);
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
    const locanda = composeProduct(HARD[2]!);
    assert.match(locanda.html, /data-room="pozzo"/);
    assert.match(locanda.html, /data-room=\\"olivo\\"/);
    assert.match(locanda.html, /data-room=\\"fienile\\"/);
    assert.match(locanda.html, /data-room=\\"salice\\"/);
    assert.match(locanda.html, /grid-row:1 \/ span 2/);
    const essenza = composeProduct(HARD[0]!);
    assert.match(essenza.html, /data-bottle="nuit"/);
    assert.match(essenza.html, /data-bottle=\\"acqua\\"/);
    assert.match(essenza.html, /var plates=\[hero\]/);
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
    assert.doesNotMatch(agenda.html, /-apple-system|BlinkMacSystemFont|SF Pro|Newsreader|Georgia|\bInter\b/);
    assert.match(agenda.html, /Figtree/);
    assert.match(agenda.html, /ui-sans-serif,system-ui,"Segoe UI"/);
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
    assert.equal(GRAPHIC_FIVE_PARENT_SHA, "a9304931bfb8fd1711aa932fa80f090463c7b59a");
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

  it("freezes five-brief before shots at parent SHA a930493", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const before = join(here, "fixtures/graphic/five/before");
    const names = [
      "agenda",
      "profumi",
      "abbigliamento",
      "repo",
      "ristorazione",
    ].flatMap((id) => ["D", "T", "M"].map((vp) => `${id}-${vp}.png`));
    assert.equal(GRAPHIC_FIVE_PARENT_SHA, "a9304931bfb8fd1711aa932fa80f090463c7b59a");
    assert.equal(existsSync(before), true);
    const listed = readdirSync(before).filter((n) => n.endsWith(".png")).sort();
    assert.deepEqual(listed, [...names].sort());
    for (const name of names) {
      assert.equal(existsSync(join(before, name)), true, name);
    }
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
    assert.match(html, /function payloadForHead/);
    assert.match(html, /function enqueueOp/);
    assert.match(html, /e\.day===d\.iso/);
    assert.match(html, /name="ora"/);
    assert.match(html, /name="luogo"/);
    assert.match(html, /name="cliente"/);
    assert.match(html, /placeholder="Es\. Taglio e piega"/);
    assert.match(html, /type="time"/);
    assert.match(html, /data-act="edit"/);
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
    assert.match(html, /AGENDA_CYCLE\[item\.status\]\|\|"confermato"/);
    assert.match(html, /KICKER_CYCLE\[item\.kicker\]\|\|item\.kicker/);
    assert.match(html, /render\(\);\s*return persistThen/);
    assert.match(html, /function saveOnce/);
    assert.match(html, /Promise\.resolve\(\)\.then\(function\(\)\{/);
    assert.match(html, /return window\.Fenix\.save\(COL, payload\)/);
    assert.doesNotMatch(html, /data=snapAdv/);
    assert.doesNotMatch(html, /data=snapDel/);
    assert.doesNotMatch(html, /data=snapWear/);
    assert.doesNotMatch(html, /if\(cur\.status===nextStatus\)/);
    assert.doesNotMatch(html, /if\(persistBusy\) return false/);
    assert.doesNotMatch(html, /void window\.Fenix\.save/);
    assert.doesNotMatch(html, /function save\(\)\{ if\(window\.Fenix\) void/);
  });
});
