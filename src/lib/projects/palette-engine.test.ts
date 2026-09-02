import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrastRatio } from "./visual-quality.ts";
import { familyFromBrief, fallbackPaletteFromBrief, tokensFromBrief } from "./design-tokens.ts";
import {
  CLOSE_DELTA_E,
  ENGINE_FAMILIES,
  FORBIDDEN_FALLBACK,
  PALETTE_CORPUS,
  applyUserColors,
  avoidRecent,
  extractUserColors,
  hashedFallbackPalette,
  paletteDistance,
  paletteSignatureKey,
  resolveAdaptivePalette,
  sanitizePaletteHistory,
  selectPaletteFamily,
  type PaletteFamily,
  type PaletteRecord,
} from "./palette-engine.ts";

describe("adaptive palette engine", () => {
  it("emits eight perceptually distinct families including cold, luminous, mono, pastel and high chroma", () => {
    const keys = Object.keys(ENGINE_FAMILIES) as PaletteFamily[];
    assert.equal(keys.length, 8);
    const signatures = keys.map((k) => paletteSignatureKey(ENGINE_FAMILIES[k].palette));
    assert.equal(new Set(signatures).size, 8, signatures.join(","));
    assert.equal(selectPaletteFamily("RepoVoci commit rami sync"), "ink-terminal");
    assert.equal(selectPaletteFamily("RepoVoci luce carta chiara"), "luminous-paper");
    assert.equal(selectPaletteFamily("Segnale Mono contrasto alto"), "mono-signal");
    assert.equal(selectPaletteFamily("Studio Pastello wellness"), "pastel-studio");
    assert.equal(selectPaletteFamily("Pulse Radio live set alta croma"), "chroma-pulse");
    assert.equal(selectPaletteFamily("Clinica Aurora pazienti terapie"), "glacier");
    assert.equal(selectPaletteFamily("Kiln ceramica argilla forno"), "earth-kiln");
    assert.equal(selectPaletteFamily("Osteria del Passo cucina di"), "wine-ink");
  });

  it("scores an offline corpus of 20+ briefs with unique signatures, AA and no earth unless motivated", () => {
    assert.ok(PALETTE_CORPUS.length >= 20);
    const rows = PALETTE_CORPUS.map((row) => {
      const tokens = tokensFromBrief(row.brief);
      return { ...row, tokens, key: paletteSignatureKey(tokens.palette) };
    });
    const unique = new Set(rows.map((r) => r.key));
    assert.ok(unique.size / rows.length >= 0.8, `unique ${unique.size}/${rows.length} keys=${[...unique]}`);
    for (const row of rows) {
      const p = row.tokens.palette;
      assert.ok(contrastRatio(p.fg, p.bg) >= 4.5, `${row.id} fg/bg ${contrastRatio(p.fg, p.bg).toFixed(2)}`);
      assert.ok(contrastRatio(p.muted, p.bg) >= 3, `${row.id} muted/bg ${contrastRatio(p.muted, p.bg).toFixed(2)}`);
      assert.ok(contrastRatio(p.surface, p.bg) >= 1.12 || p.surface !== p.bg, `${row.id} surface`);
      assert.notEqual(p.bg.toLowerCase(), FORBIDDEN_FALLBACK.bg);
      if (!/ceram|fornace|argilla|kiln|forno/.test(row.brief)) {
        assert.notEqual(selectPaletteFamily(row.brief), "earth-kiln", row.id);
        assert.notEqual(row.tokens.family, "ceramic", row.id);
      }
    }
    const last5 = rows.slice(-5);
    for (let i = 0; i < last5.length; i++) {
      for (let j = i + 1; j < last5.length; j++) {
        const dist = paletteDistance(
          { bg: last5[i]!.tokens.palette.bg, surface: last5[i]!.tokens.palette.surface, accent: last5[i]!.tokens.palette.accent },
          { bg: last5[j]!.tokens.palette.bg, surface: last5[j]!.tokens.palette.surface, accent: last5[j]!.tokens.palette.accent },
        );
        assert.ok(dist >= CLOSE_DELTA_E * 0.35, `last5 ${last5[i]!.id}/${last5[j]!.id} ΔE ${dist.toFixed(1)}`);
      }
    }
  });

  it("walks the corpus with history so none of the last five collide under CLOSE_DELTA_E", () => {
    const history: PaletteRecord[] = [];
    for (const row of PALETTE_CORPUS) {
      const resolved = resolveAdaptivePalette(row.brief, { recent: history });
      const rec: PaletteRecord = {
        bg: resolved.palette.bg,
        surface: resolved.palette.surface,
        accent: resolved.palette.accent,
        family: resolved.family,
      };
      if (!resolved.userLock.bg || !resolved.userLock.accent) {
        for (const prev of history) {
          const dist = paletteDistance(rec, prev);
          assert.ok(
            dist >= CLOSE_DELTA_E,
            `${row.id} vs prior ${prev.family} ΔE ${dist.toFixed(2)} lock=${JSON.stringify(resolved.userLock)}`,
          );
        }
      }
      history.push(rec);
      if (history.length > 5) history.shift();
    }
  });

  it("shifts a repeated generation away from the last five signatures", () => {
    const brief = "FORMATO: app (kind=app)\nRepoVoci: commit, rami, sync.";
    const first = resolveAdaptivePalette(brief);
    const history: PaletteRecord[] = [
      { bg: first.palette.bg, surface: first.palette.surface, accent: first.palette.accent, family: first.family },
    ];
    const second = resolveAdaptivePalette(brief, { recent: history });
    const dist = paletteDistance(
      { bg: first.palette.bg, surface: first.palette.surface, accent: first.palette.accent },
      { bg: second.palette.bg, surface: second.palette.surface, accent: second.palette.accent },
    );
    assert.ok(dist >= CLOSE_DELTA_E, `repeat ΔE ${dist.toFixed(2)}`);
    const shifted = avoidRecent(first.palette, history, 99);
    assert.notEqual(shifted.accent.toLowerCase(), first.palette.accent.toLowerCase());
  });

  it("treats explicit user colours as a priority lock and only nudges for AA", () => {
    const brief = "FORMATO: app (kind=app)\nAtlante Navy: sfondo #0b1f3a, accento #2ec8c0.";
    const found = extractUserColors(brief);
    assert.equal(found.bg, "#0b1f3a");
    assert.equal(found.accent, "#2ec8c0");
    const tokens = tokensFromBrief(brief);
    assert.equal(tokens.palette.bg.toLowerCase(), "#0b1f3a");
    assert.equal(tokens.palette.accent.toLowerCase(), "#2ec8c0");
    assert.ok(contrastRatio(tokens.palette.fg, tokens.palette.bg) >= 4.5);
    const named = applyUserColors(ENGINE_FAMILIES["ink-terminal"].palette, "app con accento rosa");
    assert.equal(named.lock.accent, true);
    assert.equal(named.palette.accent.toLowerCase(), "#db2777");
  });

  it("never falls back to #101114/#191b20/#e1693f when direction is missing", () => {
    const a = hashedFallbackPalette("un brief qualunque senza direzione visiva");
    const b = hashedFallbackPalette("un altro brief del tutto diverso per il fallback");
    const c = fallbackPaletteFromBrief("");
    for (const p of [a, b, c]) {
      assert.notEqual(p.bg.toLowerCase(), FORBIDDEN_FALLBACK.bg);
      assert.notEqual(p.accent.toLowerCase(), FORBIDDEN_FALLBACK.accent);
      assert.ok(contrastRatio(p.fg, p.bg) >= 4.5);
    }
    assert.notEqual(a.bg.toLowerCase() + a.accent.toLowerCase(), b.bg.toLowerCase() + b.accent.toLowerCase());
    assert.equal(familyFromBrief("RepoVoci commit rami"), "repo");
    const junk = sanitizePaletteHistory([{ bg: "red", secret: "sk-live" }, { bg: "#112233", surface: "#223344", accent: "#334455" }]);
    assert.equal(junk.length, 1);
    assert.equal("secret" in (junk[0] as object), false);
  });
});
