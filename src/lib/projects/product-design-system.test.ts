import assert from "node:assert/strict";
import { it } from "node:test";
import { composeProduct } from "../ai/compose-product.ts";
import { productDesignCss, productDesignInstruction } from "./product-design-system.ts";
import { tokensFromBrief, tokensInstruction } from "./design-tokens.ts";

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
  for (const brief of ["kind=app agenda stile iPhone", "kind=site portfolio Fraunces serif primario"]) {
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
