import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { craftTokenCss, surfacesFromPalette, WATER_CRAFT } from "./craft-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { tokensFromBrief } from "./design-tokens.ts";

describe("craft surface tokens", () => {
  it("maps a domain palette into the same slots without forcing sky-blue", () => {
    const perfume = tokensFromBrief(`${formatPrefix("app")}Essenza: gestione profumi premium, flaconi e guardaroba.`);
    const s = surfacesFromPalette(perfume.palette, false);
    assert.notEqual(s.brand.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.doesNotMatch(s.brand, /#0ea5e9|#0284c7|#007aff|#0071e3/i);
    assert.match(craftTokenCss(s), /--inverse:/);
    assert.match(craftTokenCss(s), /--shadow-card:/);
  });

  it("keeps official water craft hexes on a field brief", () => {
    const field = tokensFromBrief(
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple. Accento #0A2F6B.`,
    );
    const s = surfacesFromPalette(field.palette, true);
    assert.equal(field.palette.fg.toLowerCase(), WATER_CRAFT.onSurface.toLowerCase());
    assert.equal(field.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.equal(s.surfaceInverse.toLowerCase(), "#0f172a");
    assert.equal(s.success.toLowerCase(), "#10b981");
  });
});
