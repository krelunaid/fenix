import { extractUserColors, hexToOkLch, type EnginePalette } from "./palette-engine.ts";
import { isFieldProductBrief } from "./app-identity.ts";
import { WATER_CRAFT } from "./craft-tokens.ts";

/** @deprecated use WATER_CRAFT.surfaceInverse — kept for older notes. */
export const WATER_NAVY = WATER_CRAFT.surfaceInverse;
export const WATER_BLUE = WATER_CRAFT.brand;
export const WATER_OK = WATER_CRAFT.success;
export const WATER_PAPER = WATER_CRAFT.surfaceSecondary;
export const WATER_WARN = WATER_CRAFT.warning;

function isVividAccent(hex: string): boolean {
  const { L, C } = hexToOkLch(hex);
  return C >= 0.1 && L >= 0.4 && L <= 0.62;
}

/**
 * Field / water / ops briefs use the distilled water craft tokens.
 * A vivid user accent can retint brand; dark user hexes do not collapse
 * the board back to washed navy-as-accent.
 */
export function enrichWaterOpsPalette<T extends EnginePalette>(brief: string, palette: T): T {
  if (!isFieldProductBrief(brief)) return palette;
  const userVivid = extractUserColors(brief).hexes.find((hex) => isVividAccent(hex)) ?? null;
  const brand = userVivid ?? WATER_CRAFT.brand;
  return {
    ...palette,
    bg: WATER_CRAFT.surfaceSecondary,
    fg: WATER_CRAFT.onSurface,
    accent: brand,
    muted: "#64748B",
    success: WATER_CRAFT.success,
    warning: WATER_CRAFT.warning,
    surface: WATER_CRAFT.surface,
    elevated: WATER_CRAFT.surface,
    line: WATER_CRAFT.border,
    accentInk: "#FFFFFF",
  };
}
