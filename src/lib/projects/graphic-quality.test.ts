import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { familyFromBrief, hueBucket, tokensFromBrief } from "./design-tokens.ts";
import { auditGraphicQuality, GRAPHIC_SCORE_THRESHOLD } from "./graphic-quality.ts";
import { loadGraphicFixtures } from "../ai/graphic-fixtures.ts";
import { evaluateContract, planContract, blocksPublish, criticBudget } from "../ai/build-contract.ts";
import { loadContractFixtures } from "../ai/contract-fixtures.ts";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";

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
});

describe("graphic quality gate", () => {
  it("rejects the Essenza skeleton even when HTML compiles and CRUD exists", () => {
    const fixtures = loadGraphicFixtures();
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

  it("passes three distinct premium products and keeps historical fixtures green", () => {
    for (const fix of loadGraphicFixtures().filter((f) => f.mustPass)) {
      const report = auditGraphicQuality(fix.html, { brief: fix.brief, kind: "app" });
      assert.equal(report.ok, true, `${fix.id}: ${report.findings.filter((f) => f.severity === "fail").map((f) => f.code).join(" · ")}`);
      const evaluation = evaluateContract({
        html: fix.html,
        files: [{ path: "index.html", content: fix.html }],
        contract: planContract(fix.brief),
        kind: "app",
        brief: fix.brief,
      });
      const failed = evaluation.checks.filter((c) => c.blocking && !c.ok);
      assert.equal(evaluation.ok, true, `${fix.id}: ${failed.map((c) => `${c.id}:${c.detail}`).join(" · ")}`);
      assert.equal(blocksPublish(fix.html, "app", undefined, fix.brief), "");
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
  });

  it("does not promote the phone shell as a finished perfume product", () => {
    const brief = "FORMATO: app telefono. kind=app. Essenza gestione profumi premium.";
    const report = auditGraphicQuality(APP_SHELL_HTML, { brief, kind: "app" });
    assert.equal(report.ok, false);
    assert.equal(blocksPublish(APP_SHELL_HTML, "app", undefined, brief).length > 0, true);
  });
});
