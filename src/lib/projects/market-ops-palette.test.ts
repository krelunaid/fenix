import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokensFromBrief } from "./design-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { MARKET_CRAFT, WATER_CRAFT } from "./craft-tokens.ts";
import { enrichMarketPalette } from "./market-ops-palette.ts";
import { isMarketplaceBrief } from "./app-identity.ts";

describe("marketplace craft palette", () => {
  it("locks a lavoretti brief to market navy, not water sky", () => {
    const brief = `${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`;
    assert.equal(isMarketplaceBrief(brief), true);
    const tokens = tokensFromBrief(brief);
    assert.equal(tokens.palette.accent.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
    assert.notEqual(tokens.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.equal(tokens.radius, "24px");
  });

  it("does not retint water, perfume, shop or fiscal", () => {
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
    assert.equal(enrichMarketPalette("Essenza: gestione profumi premium", perfume), perfume);
    const waterBrief =
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.`;
    assert.equal(isMarketplaceBrief(waterBrief), false);
    const water = tokensFromBrief(waterBrief);
    assert.equal(water.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    const shop = tokensFromBrief(`${formatPrefix("app")}Emporio Luce: negozio di lampade da tavolo, stile Apple.`);
    assert.notEqual(shop.palette.accent.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
    const fiscal = tokensFromBrief(`${formatPrefix("app")}Studio Nord: gestionale per commercialisti, fatture e F24.`);
    assert.notEqual(fiscal.palette.accent.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
  });
});
