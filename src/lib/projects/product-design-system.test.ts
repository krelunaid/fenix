import assert from "node:assert/strict";
import { it } from "node:test";
import { composeProduct } from "../ai/compose-product.ts";
import { productDesignCss, productDesignInstruction } from "./product-design-system.ts";
import { tokensFromBrief, tokensInstruction } from "./design-tokens.ts";
import { createBuildRequest, isAtomicStreamCreation } from "../ai/build-request.ts";
import { validateProductHtml } from "./validate-html.ts";
import { websiteDirection } from "../ai/website-product.ts";
import { contrastRatio, extractCssVars } from "./visual-quality.ts";

it("keeps website text and action ink AA across page and card backgrounds", () => {
  for (const domain of ["ristorante", "fotografo", "barbiere stile iPhone", "hotel", "profumi", "consulenza"]) {
    const result = composeProduct(`kind=site sito web ${domain}`);
    const vars = extractCssVars(result.html);
    for (const background of [vars.bg, vars.surface]) {
      assert.ok(contrastRatio(vars.fg!, background!) >= 4.5, domain);
      assert.ok(contrastRatio(vars.muted!, background!) >= 4.5, domain);
    }
    assert.ok(contrastRatio(vars["accent-ink"]!,vars.accent!) >= 4.5, domain);
    assert.equal(vars.accent,result.tokens.palette.accent);
    assert.equal(vars.bg,result.tokens.palette.bg);
  }
});

it("creates public websites across domains without choosing operations recipes", () => {
  for (const [domain, expected] of [
    ["ristorante", "food"],
    ["fotografo", "editorial"],
    ["barbiere", "beauty"],
    ["hotel", "hospitality"],
    ["profumi", "collection"],
    ["consulenza", "service"],
  ]) {
    const prompt = `sito web ${domain} chiamato "Luce" stile iPhone`;
    const request = createBuildRequest({ prompt, kind: "site" });
    assert.equal(websiteDirection(prompt).domain, expected);
    assert.equal(request.operation, "create");
    assert.equal(isAtomicStreamCreation(request), false);
    assert.match(request.html, /<title>Luce<\/title>/);
    assert.match(request.html, /data-fenix-website/);
    assert.doesNotMatch(request.html, /nav\.tabs|data-craft-nav|function spark\(/);
    assert.equal(validateProductHtml(request.html, { kind: "site" }).ok, true, domain);
    const edit = createBuildRequest({
      prompt,
      kind: "site",
      html: request.html,
      instruction: "Cambia solo icona",
    });
    assert.equal(edit.html, request.html);
    assert.equal(edit.operation, "edit");
  }
});

it("shares policy across domains and app/site/desk without rewriting their identities", () => {
  for (const brief of [
    "kind=app barbiere prenotazioni stile iPhone",
    "kind=app profumi gestione flaconi",
    "kind=site sito web ristorante cucina stagionale",
    "kind=site sito web portfolio fotografo",
    "kind=dashboard cruscotto acqua consumi",
  ]) {
    const result = composeProduct(brief);
    assert.match(result.html, /fenix-product-system-v1/, brief);
    assert.match(result.polish, /SISTEMA UI TRASVERSALE/, brief);
    assert.deepEqual(result.tokens.palette, tokensFromBrief(brief).palette);
    assert.match(result.html, /prefers-reduced-motion:reduce/);
  }
});

it("does not assign domain colors or font faces and differentiates web typography", () => {
  for (const kind of ["app", "site", "dashboard", "landing", "tool", "game"]) {
    const css = productDesignCss(kind);
    assert.doesNotMatch(css, /#[a-f0-9]{3,8}\b|--(?:bg|accent|fg|body|display)\s*:/i);
    assert.equal(css.includes("clamp(2rem,4.5vw,4rem)"), kind === "site" || kind === "landing");
  }
  assert.match(productDesignInstruction(), /empty\/error\/success sono esclusivi/);
});

it("preserves explicitly requested system or editorial font direction", () => {
  for (const brief of [
    "kind=app agenda stile iPhone",
    "kind=site portfolio Fraunces serif primario",
  ]) {
    const tokens = tokensFromBrief(brief);
    const output = tokensInstruction(tokens, brief);
    assert.ok(output.includes(`font: ${tokens.fonts.display} + ${tokens.fonts.body}`));
    assert.match(output, /Mantieni la stessa identità durante revisioni/);
  }
});

it("does not let domain recipes override explicit native or named editorial type", () => {
  for (const domain of ["barbiere", "palco recitazione", "libreria"]) {
    const native = composeProduct(`kind=app ${domain} stile iPhone`);
    assert.equal(native.tokens.fonts.display, "system-ui", domain);
    assert.doesNotMatch(native.html, /--display:\s*"?Fraunces/);
    assert.doesNotMatch(native.html, /fonts.googleapis.com/);
    const serif = composeProduct(`kind=app ${domain} font Garamond serif primario`);
    assert.match(serif.tokens.fonts.display, /Garamond/);
  }
});
