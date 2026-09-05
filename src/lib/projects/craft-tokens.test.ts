import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRAFT_RADIUS,
  CRAFT_RADIUS_CONSUMER,
  CRAFT_RADIUS_DESK,
  CRAFT_RADIUS_LUXE,
  LUXE_CRAFT,
  MARKET_CRAFT,
  BARBER_CRAFT,
  LIBRARY_CRAFT,
  WATER_CRAFT,
  craftModeOf,
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
    assert.doesNotMatch(craftTokenCss(s), /#F97316|#1E40AF|#D4AF37|#B31A26/i);
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

  it("keeps official luxe craft hexes on a recitazione brief", () => {
    const luxe = tokensFromBrief(
      `${formatPrefix("app")}Palco: scene e recitazione, prove e repertorio, stile Apple.`,
    );
    const s = surfacesFromPalette(luxe.palette, "luxe");
    assert.equal(luxe.palette.accent.toLowerCase(), LUXE_CRAFT.brand.toLowerCase());
    assert.equal(luxe.palette.bg.toLowerCase(), LUXE_CRAFT.surface.toLowerCase());
    assert.equal(s.surfaceInverse.toLowerCase(), "#f5f5fa");
    assert.match(craftTokenCss(s, { domain: "luxe", rhythm: "luxe" }), /--fx-r3:20px/);
    assert.match(craftTokenCss(s, { domain: "luxe", rhythm: "luxe" }), /--fx-t-display:46px/);
    assert.match(craftTokenCss(s, { domain: "luxe" }), /#D4AF37/i);
  });

  it("uses consumer radii for market, utility for water, luxe 6/12/20, desk for gestionali", () => {
    assert.equal(radiusForRhythm("consumer").lg, CRAFT_RADIUS_CONSUMER.lg);
    assert.equal(radiusForRhythm("utility").lg, CRAFT_RADIUS.lg);
    assert.equal(radiusForRhythm("luxe").lg, CRAFT_RADIUS_LUXE.lg);
    assert.equal(radiusForRhythm("desk").lg, CRAFT_RADIUS_DESK.lg);
    assert.equal(craftRhythmOf({ field: true }), "utility");
    assert.equal(craftRhythmOf({ market: true }), "consumer");
    assert.equal(craftRhythmOf({ luxe: true }), "luxe");
    assert.equal(craftRhythmOf({ desk: true }), "desk");
    assert.equal(craftModeOf({ field: true }), "utility");
    assert.equal(craftModeOf({ market: true }), "marketplace");
    assert.equal(craftModeOf({ luxe: true }), "luxe");
    assert.equal(craftModeOf({ desk: true }), "desk");
    assert.equal(craftModeOf({ barber: true }), "salon");
    assert.equal(craftModeOf({ library: true }), "bookstore");
    assert.equal(craftRhythmOf({ barber: true }), "consumer");
    assert.equal(craftRhythmOf({ library: true }), "consumer");
  });

  it("keeps official salon and bookstore craft hexes on those briefs", () => {
    const barber = tokensFromBrief(
      `${formatPrefix("app")}App barbiere: agenda tagli e clienti, stile iPhone.`,
    );
    const library = tokensFromBrief(
      `${formatPrefix("app")}App libreria: catalogo libri, prestiti e scaffali, stile iPhone.`,
    );
    const b = surfacesFromPalette(barber.palette, "barber");
    const l = surfacesFromPalette(library.palette, "library");
    assert.equal(barber.palette.accent.toLowerCase(), BARBER_CRAFT.brand.toLowerCase());
    assert.equal(library.palette.accent.toLowerCase(), LIBRARY_CRAFT.brand.toLowerCase());
    assert.equal(b.surfaceInverse.toLowerCase(), BARBER_CRAFT.surfaceInverse.toLowerCase());
    assert.equal(l.surfaceInverse.toLowerCase(), LIBRARY_CRAFT.surfaceInverse.toLowerCase());
    assert.notEqual(barber.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.notEqual(library.palette.accent.toLowerCase(), WATER_CRAFT.brand.toLowerCase());
    assert.doesNotMatch(barber.palette.accent, /#b51246|#b01e47|#a61d4c/i);
  });
});
