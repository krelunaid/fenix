import { extractUserColors, hexToOkLch, type EnginePalette } from "./palette-engine.ts";
import { isLuxeBrief } from "./app-identity.ts";
import { LUXE_CRAFT } from "./craft-tokens.ts";

function isVividAccent(hex: string): boolean {
  const { L, C } = hexToOkLch(hex);
  return C >= 0.08 && L >= 0.42 && L <= 0.78;
}

/**
 * Luxe / cinematic briefs lock to midnight + gold. Water, market, shop and
 * light fiscal stay out unless the brief asks for dark luxe.
 */
export function enrichLuxePalette<T extends EnginePalette>(brief: string, palette: T): T {
  if (!isLuxeBrief(brief)) return palette;
  const userVivid = extractUserColors(brief).hexes.find((hex) => isVividAccent(hex)) ?? null;
  const brand = userVivid ?? LUXE_CRAFT.brand;
  return {
    ...palette,
    bg: LUXE_CRAFT.surface,
    fg: LUXE_CRAFT.onSurface,
    accent: brand,
    muted: "#A2A2AE",
    success: LUXE_CRAFT.success,
    warning: LUXE_CRAFT.warning,
    surface: LUXE_CRAFT.surfaceSecondary,
    elevated: LUXE_CRAFT.surfaceTertiary,
    line: LUXE_CRAFT.border,
    accentInk: LUXE_CRAFT.surface,
  };
}
