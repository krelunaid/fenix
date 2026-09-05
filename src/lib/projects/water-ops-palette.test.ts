import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokensFromBrief } from "./design-tokens.ts";
import { formatPrefix } from "./infer.ts";
import { WATER_BLUE, WATER_OK, enrichWaterOpsPalette } from "./water-ops-palette.ts";

describe("water / field ops palette", () => {
  it("turns a field brief with a dark navy accent into rich ink + vivid water, not olive wash", () => {
    const tokens = tokensFromBrief(
      `${formatPrefix("app")}NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple. Accento #0A2F6B.`,
    );
    assert.equal(tokens.palette.fg.toLowerCase(), "#0f172a");
    assert.equal(tokens.palette.accent.toLowerCase(), WATER_BLUE.toLowerCase());
    assert.equal(tokens.palette.success.toLowerCase(), WATER_OK.toLowerCase());
    assert.notEqual(tokens.palette.success.toLowerCase(), "#b8c4a0");
    assert.doesNotMatch(tokens.palette.accent, /#007aff|#0071e3|#0a84ff/i);
  });

  it("leaves barber and perfume palettes alone", () => {
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
    assert.equal(enrichWaterOpsPalette("Essenza: gestione profumi premium", perfume), perfume);
    const barber = tokensFromBrief(`${formatPrefix("app")}mi crei un app da parrucchieri stile Barber shop`);
    assert.notEqual(barber.palette.accent.toLowerCase(), WATER_BLUE.toLowerCase());
    assert.notEqual(barber.palette.accent.toLowerCase(), "#b51246");
  });
});
