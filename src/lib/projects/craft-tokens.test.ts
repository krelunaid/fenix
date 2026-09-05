import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRAFT_RADIUS,
  CRAFT_RADIUS_CONSUMER,
  CRAFT_RADIUS_DESK,
  MARKET_CRAFT,
  WATER_CRAFT,
  craftRhythmOf,
  craftTokenCss,
  radiusForRhythm,
  surfacesFromPalette,
} from "./craft-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { tokensFromBrief } from "./design-tokens.ts";

describe("craft surface tokens", () => {
  it("maps a domain palette into the same slots without forcing sky-blue or market navy", () => {
    const perfume = tokensFromBrief(`${formatPrefix("app")}Essenza: gestione profumi premium, flaconi e guardaroba.`);
    const s = surfacesFromPalette(perfume.palette, false);
    assert.notEqual(s.brand.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.notEqual(s.brand.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
    assert.doesNotMatch(s.brand, /#0ea5e9|#0284c7|#007aff|#0071e3|#1e40af/i);
    assert.match(craftTokenCss(s), /--inverse:/);
    assert.match(craftTokenCss(s), /--shadow-card:/);
    assert.doesNotMatch(craftTokenCss(s), /#F97316|#1E40AF/i);
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

  it("keeps official market craft hexes on a marketplace brief", () => {
    const market = tokensFromBrief(
      `${formatPrefix("app")}Vicina: marketplace di lavoretti e bacheca incarichi, stile Apple.`,
    );
    const s = surfacesFromPalette(market.palette, "market");
    assert.equal(market.palette.accent.toLowerCase(), MARKET_CRAFT.brand.toLowerCase());
    assert.equal(market.palette.bg.toLowerCase(), MARKET_CRAFT.surfaceSecondary.toLowerCase());
    assert.equal(s.surfaceInverse.toLowerCase(), "#18181b");
    assert.match(craftTokenCss(s, { domain: "market", rhythm: "consumer" }), /--fx-r3:24px/);
    assert.match(craftTokenCss(s, { domain: "market" }), /#F97316/);
  });

  it("uses consumer radii for market, utility for water, desk for gestionali", () => {
    assert.equal(radiusForRhythm("consumer").lg, CRAFT_RADIUS_CONSUMER.lg);
    assert.equal(radiusForRhythm("utility").lg, CRAFT_RADIUS.lg);
    assert.equal(radiusForRhythm("desk").lg, CRAFT_RADIUS_DESK.lg);
    assert.equal(craftRhythmOf({ field: true }), "utility");
    assert.equal(craftRhythmOf({ market: true }), "consumer");
    assert.equal(craftRhythmOf({ desk: true }), "desk");
  });
});
