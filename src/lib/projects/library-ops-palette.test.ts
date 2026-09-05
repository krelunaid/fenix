import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokensFromBrief } from "./design-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { LIBRARY_CRAFT, WATER_CRAFT } from "./craft-tokens.ts";
import { enrichLibraryPalette } from "./library-ops-palette.ts";

const LIBRARY_IPHONE_BRIEF = "App libreria: catalogo libri, prestiti e scaffali, stile iPhone.";

describe("library / bookstore ops palette", () => {
  it("turns the library iPhone brief into cream paper + wine, not desk gray or water sky", () => {
    const tokens = tokensFromBrief(`${formatPrefix("app")}${LIBRARY_IPHONE_BRIEF}`);
    assert.equal(tokens.palette.accent.toLowerCase(), LIBRARY_CRAFT.brand.toLowerCase());
    assert.equal(tokens.palette.bg.toLowerCase(), LIBRARY_CRAFT.surfaceSecondary.toLowerCase());
    assert.equal(tokens.palette.fg.toLowerCase(), LIBRARY_CRAFT.onSurface.toLowerCase());
    assert.notEqual(tokens.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.doesNotMatch(tokens.palette.bg, /#101114|#f5f5f7|#e8eef4/i);
  });

  it("leaves water, barber and perfume palettes alone", () => {
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
    assert.equal(enrichLibraryPalette("Essenza: gestione profumi premium", perfume), perfume);
    const water = tokensFromBrief(
      `${formatPrefix("app")}App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.`,
    );
    assert.equal(water.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    const barber = tokensFromBrief(
      `${formatPrefix("app")}App barbiere: agenda tagli e clienti, stile iPhone.`,
    );
    assert.notEqual(barber.palette.accent.toLowerCase(), LIBRARY_CRAFT.brand.toLowerCase());
  });
});
