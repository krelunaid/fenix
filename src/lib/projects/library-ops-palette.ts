import { extractUserColors, hexToOkLch, type EnginePalette } from "./palette-engine.ts";
import { isLibraryBrief } from "./app-identity.ts";
import { LIBRARY_CRAFT } from "./craft-tokens.ts";

function isWineAccent(hex: string): boolean {
  const { L, C, H } = hexToOkLch(hex);
  if (C < 0.06 || L < 0.22 || L > 0.55) return false;
  return (H >= 350 || H <= 40) || (H >= 330 && H <= 360);
}

/**
 * Library / bookstore briefs lock to cream paper + wine.
 * Never desk gray, never water sky, never generic studio teal.
 */
export function enrichLibraryPalette<T extends EnginePalette>(brief: string, palette: T): T {
  if (!isLibraryBrief(brief)) return palette;
  const userWine = extractUserColors(brief).hexes.find((hex) => isWineAccent(hex)) ?? null;
  const brand = userWine ?? LIBRARY_CRAFT.brand;
  return {
    ...palette,
    bg: LIBRARY_CRAFT.surfaceSecondary,
    fg: LIBRARY_CRAFT.onSurface,
    accent: brand,
    muted: "#7A6558",
    success: LIBRARY_CRAFT.success,
    warning: LIBRARY_CRAFT.warning,
    surface: LIBRARY_CRAFT.surface,
    elevated: LIBRARY_CRAFT.surface,
    line: LIBRARY_CRAFT.border,
    accentInk: "#FFF8F0",
  };
}
