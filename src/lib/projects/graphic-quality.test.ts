import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { familyFromBrief, hueBucket, isProductFamily, tokensFromBrief, variantFromBrief } from "./design-tokens.ts";
import { auditGraphicQuality, GRAPHIC_SCORE_THRESHOLD } from "./graphic-quality.ts";
import { loadGraphicFixtures, loadLegacyGraphicFixtures } from "../ai/graphic-fixtures.ts";
import { loadPremiumFixtures } from "../ai/premium-fixtures.ts";
import { evaluateContract, planContract, blocksPublish, criticBudget } from "../ai/build-contract.ts";
import { loadContractFixtures } from "../ai/contract-fixtures.ts";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import { formatPrefix } from "./infer.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VALID_APP = readFileSync(join(here, "fixtures/valid-app.html"), "utf8");

describe("design tokens from brief", () => {
  it("builds three product identities that do not share paper, accent or display font", () => {
    const perfume = tokensFromBrief("gestione profumi premium flaconi");
    const fashion = tokensFromBrief("moda e vendite lookbook sfilata");
    const booking = tokensFromBrief("prenotazioni di un servizio in sala");
    assert.equal(perfume.family, "perfume");
    assert.equal(fashion.family, "fashion");
    assert.equal(booking.family, "booking");
    const bgs = new Set([perfume.palette.bg, fashion.palette.bg, booking.palette.bg]);
    const accents = new Set([perfume.palette.accent, fashion.palette.accent, booking.palette.accent]);
    const fonts = new Set([perfume.fonts.display, fashion.fonts.display, booking.fonts.display]);
    assert.equal(bgs.size, 3);
    assert.equal(accents.size, 3);
    assert.equal(fonts.size, 3);
    const hues = [perfume, fashion, booking].map((t) => hueBucket(t.palette.accent));
    assert.ok(Math.abs(hues[0]! - hues[1]!) > 25, `accent hue ${hues}`);
    assert.ok(Math.abs(hues[1]! - hues[2]!) > 25, `accent hue ${hues}`);
    assert.notEqual(familyFromBrief("fornace grottaglie ceramica"), "perfume");
    assert.notEqual(familyFromBrief("kind=app agenda condivisa"), "booking");
  });

  it("gives five briefs two really different variants and keeps kiln ceramic", () => {
    const pairs: [string, string][] = [
      ["gestione profumi premium flaconi maison", "vetro di nebbia profumi flaconi ghiaccio"],
      ["moda e vendite lookbook sfilata", "atelier osso moda lookbook avorio"],
      ["prenotazioni di un servizio in sala", "studio lino prenotazioni servizio tessile"],
      ["nord ledger kpi di vendita pipeline vendite ledger commerciale", "orto flusso flusso ordini harvest kpi di vendita"],
      ["taglia foto ritaglio in tasca", "metro tasca convertitore di misure nastro millimetrato"],
    ];
    for (const [a, b] of pairs) {
      const left = tokensFromBrief(a);
      const right = tokensFromBrief(b);
      assert.equal(left.family, right.family, `${a} vs ${b}`);
      assert.equal(variantFromBrief(a), 0, a);
      assert.equal(variantFromBrief(b), 1, b);
      assert.notEqual(left.palette.bg, right.palette.bg, left.family);
      assert.notEqual(left.palette.accent, right.palette.accent, left.family);
      assert.notEqual(left.fonts.display, right.fonts.display, left.family);
    }
    assert.equal(familyFromBrief("Kiln — cruscotto forno, colate e rischi"), "ceramic");
    assert.notEqual(familyFromBrief("Split: dividi spese e calcola chi deve a chi"), "utility");
    assert.equal(familyFromBrief("Nord Ledger kpi di vendita pipeline vendite"), "ops");
    assert.equal(familyFromBrief("Taglia foto ritaglio in tasca"), "utility");
  });
});

describe("graphic quality gate", () => {
  it("rejects the Essenza skeleton even when HTML compiles and CRUD exists", () => {
    const fixtures = loadLegacyGraphicFixtures();
    const essenza = fixtures.find((f) => f.id === "essenza-fail")!;
    const report = auditGraphicQuality(essenza.html, { brief: essenza.brief, kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.score < GRAPHIC_SCORE_THRESHOLD);
    const codes = report.findings.filter((f) => f.severity === "fail").map((f) => f.code);
    assert.ok(codes.includes("empty-contradiction"), codes.join(","));
    assert.ok(codes.includes("skeletal-home") || codes.includes("generic-chrome"), codes.join(","));
    const evaluation = evaluateContract({
      html: essenza.html,
      files: [{ path: "index.html", content: essenza.html }],
      contract: planContract(essenza.brief),
      kind: "app",
      brief: essenza.brief,
    });
    assert.equal(evaluation.ok, false);
    assert.equal(evaluation.checks.find((c) => c.id === "graphic")?.ok, false);
    assert.match(blocksPublish(essenza.html, "app", undefined, essenza.brief), /graphic|empty|skeletal|generic/i);
    const budget = criticBudget({ kind: "app", evaluation });
    assert.equal(budget.call, false);
    assert.equal(budget.reason, "graphic");
  });

  it("fails the three current geometric products on imagery, clones or boxed canvas", () => {
    const expectCode: Record<string, string> = {
      "maison-lumiere": "abstract-imagery",
      "sfilata-atelier": "card-clone",
      "sala-ore": "abstract-imagery",
    };
    for (const fix of loadLegacyGraphicFixtures().filter((f) => f.id !== "essenza-fail")) {
      const report = auditGraphicQuality(fix.html, { brief: fix.brief, kind: "app" });
      assert.equal(report.ok, false, `${fix.id} should fail`);
      const codes = report.findings.filter((f) => f.severity === "fail").map((f) => f.code);
      assert.ok(codes.includes(expectCode[fix.id]!), `${fix.id}: ${codes.join(",")}`);
      assert.ok(codes.includes("boxed-canvas"), `${fix.id} boxed ${codes.join(",")}`);
      const evaluation = evaluateContract({
        html: fix.html,
        files: [{ path: "index.html", content: fix.html }],
        contract: planContract(fix.brief),
        kind: "app",
        brief: fix.brief,
      });
      assert.equal(evaluation.checks.find((c) => c.id === "graphic")?.ok, false);
      assert.match(blocksPublish(fix.html, "app", undefined, fix.brief), /graphic|abstract|clone|boxed/i);
    }
  });

  it("passes ten distinct premium products and keeps historical fixtures green", () => {
    const premium = loadPremiumFixtures();
    assert.equal(premium.length, 10);
    const grounds = new Set(premium.map((f) => f.palette.bg.toLowerCase()));
    assert.ok(grounds.size >= 8, `grounds ${[...grounds].join(",")}`);
    for (const fix of premium) {
      const report = auditGraphicQuality(fix.html, { brief: fix.brief, kind: fix.kind });
      assert.equal(
        report.ok,
        true,
        `${fix.id}: ${report.findings
          .filter((f) => f.severity === "fail")
          .map((f) => f.code)
          .join(" · ")}`,
      );
      const evaluation = evaluateContract({
        html: fix.html,
        files: [{ path: "index.html", content: fix.html }],
        contract: planContract(fix.brief),
        kind: fix.kind,
        brief: fix.brief,
      });
      const failed = evaluation.checks.filter((c) => c.blocking && !c.ok);
      assert.equal(evaluation.ok, true, `${fix.id}: ${failed.map((c) => `${c.id}:${c.detail}`).join(" · ")}`);
      assert.equal(blocksPublish(fix.html, fix.kind, undefined, fix.brief), "");
      assert.match(fix.html, /data-imagery="domain"/);
      assert.match(fix.html, /aria-label=/);
    }
    for (const fix of loadContractFixtures()) {
      const evaluation = evaluateContract({
        html: fix.html,
        files: fix.files,
        contract: planContract(fix.brief),
        brief: fix.brief,
      });
      assert.equal(
        evaluation.ok,
        true,
        `${fix.id} graphic ${evaluation.checks.find((c) => c.id === "graphic")?.detail}`,
      );
    }
    assert.ok(loadGraphicFixtures().some((f) => f.id === "lumiere-or" && f.mustPass));
  });

  it("does not promote the phone shell as a finished perfume product", () => {
    const brief = "FORMATO: app telefono. kind=app. Essenza gestione profumi premium.";
    const report = auditGraphicQuality(APP_SHELL_HTML, { brief, kind: "app" });
    assert.equal(report.ok, false);
    assert.equal(blocksPublish(APP_SHELL_HTML, "app", undefined, brief).length > 0, true);
  });

  it("does not block a GitHub import of a valid app as a repo product without imagery", () => {
    const brief = `${formatPrefix("app")}Importato da GitHub Fenix verificato.`;
    assert.notEqual(familyFromBrief(brief), "repo");
    assert.equal(isProductFamily(familyFromBrief(brief)), false);
    const report = auditGraphicQuality(VALID_APP, { brief, kind: "app" });
    const codes = report.findings.filter((f) => f.severity === "fail").map((f) => f.code);
    assert.equal(codes.includes("no-product-image"), false, codes.join(","));
    assert.equal(blocksPublish(VALID_APP, "app", [{ path: "index.html", content: VALID_APP }], brief), "");
  });
});
