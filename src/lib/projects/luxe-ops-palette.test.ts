import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokensFromBrief } from "./design-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { LUXE_CRAFT, MARKET_CRAFT, WATER_CRAFT } from "./craft-tokens.ts";
import { enrichLuxePalette } from "./luxe-ops-palette.ts";
import { isLuxeBrief } from "./app-identity.ts";

describe("luxe craft palette", () => {
  it("locks a recitazione brief to midnight gold, not water sky or market navy", () => {
    const brief = `${formatPrefix("app")}Palco: scene e recitazione, prove e repertorio, stile Apple.`;
    assert.equal(isLuxeBrief(brief), true);
    const tokens = tokensFromBrief(brief);
    assert.equal(tokens.palette.accent.toLowerCase(), LUXE_CRAFT.brand.toLowerCase());
    assert.equal(tokens.palette.bg.toLowerCase(), LUXE_CRAFT.surface.toLowerCase());
    assert.equal(tokens.fonts.display, "Fraunces");
    assert.notEqual(tokens.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.notEqual(tokens.palette.accent.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
  });

  it("does not retint water, perfume, shop, market or light fiscal", () => {
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
    assert.equal(enrichLuxePalette("Essenza: gestione profumi premium", perfume), perfume);
    const waterBrief =
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`;
    assert.equal(isLuxeBrief(waterBrief), false);
    const water = tokensFromBrief(waterBrief);
    assert.equal(water.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    const market = tokensFromBrief(
      `${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`,
    );
    assert.equal(isLuxeBrief(`${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`), false);
    assert.equal(market.palette.accent.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
    const shop = tokensFromBrief(`${formatPrefix("app")}Emporio Luce: negozio di lampade da tavolo, stile Apple.`);
    assert.notEqual(shop.palette.accent.toLowerCase(), LUXE_CRAFT.brand.toLowerCase());
    const fiscal = tokensFromBrief(`${formatPrefix("app")}Studio Nord: gestionale per commercialisti, fatture e F24.`);
    assert.equal(isLuxeBrief(`${formatPrefix("app")}Studio Nord: gestionale per commercialisti, fatture e F24.`), false);
    assert.notEqual(fiscal.palette.bg.toLowerCase(), LUXE_CRAFT.surface.toLowerCase());
  });
});
