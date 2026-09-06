import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokensFromBrief } from "./design-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { BARBER_CRAFT, WATER_CRAFT } from "./craft-tokens.ts";
import { BARBER_RASPBERRY, enrichBarberPalette } from "./barber-ops-palette.ts";

const BARBER_IPHONE_BRIEF = "App barbiere: agenda tagli e clienti, stile iPhone.";

describe("barber / salon ops palette", () => {
  it("turns the barber iPhone brief into espresso + cream + tan, not pale teal or raspberry", () => {
    const tokens = tokensFromBrief(`${formatPrefix("app")}${BARBER_IPHONE_BRIEF}`);
    assert.equal(tokens.palette.accent.toLowerCase(), BARBER_CRAFT.brand.toLowerCase());
    assert.equal(tokens.palette.bg.toLowerCase(), BARBER_CRAFT.surfaceSecondary.toLowerCase());
    assert.equal(tokens.palette.fg.toLowerCase(), BARBER_CRAFT.onSurface.toLowerCase());
    assert.equal(tokens.palette.bg.toLowerCase(), "#0b0908");
    assert.equal(tokens.palette.fg.toLowerCase(), "#f4eee6");
    assert.equal(tokens.palette.accent.toLowerCase(), "#d2bfa6");
    assert.notEqual(tokens.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.notEqual(tokens.palette.accent.toLowerCase(), "#1f6f68");
    assert.doesNotMatch(tokens.palette.accent, BARBER_RASPBERRY);
    assert.doesNotMatch(tokens.palette.bg, /#e8eef4|#f5f5f7|#f6ede4/i);
  });

  it("leaves water, perfume and library palettes alone", () => {
    const perfume = {
      bg: "#120e0c",
      surface: "#1d1714",
      elevated: "#2a211c",
      fg: "#f4ead8",
      muted: "#b9a28c",
      accent: "#c4a36a",
      line: "#3a3028",
      accentInk: "#120e0c",
      success: "#5aa87a",
      warning: "#d08a4a",
    };
    assert.equal(enrichBarberPalette("Essenza: gestione profumi premium", perfume), perfume);
    const water = tokensFromBrief(
      `${formatPrefix("app")}App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.`,
    );
    assert.equal(water.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    const library = tokensFromBrief(
      `${formatPrefix("app")}App libreria: catalogo libri, prestiti e scaffali, stile iPhone.`,
    );
    assert.notEqual(library.palette.accent.toLowerCase(), BARBER_CRAFT.brand.toLowerCase());
  });
});
