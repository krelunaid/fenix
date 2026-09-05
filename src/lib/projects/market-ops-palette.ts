import { extractUserColors, hexToOkLch, type EnginePalette } from "./palette-engine.ts";
import { isMarketplaceBrief } from "./app-identity.ts";
import { MARKET_CRAFT } from "./craft-tokens.ts";

function isVividAccent(hex: string): boolean {
  const { L, C } = hexToOkLch(hex);
  return C >= 0.08 && L >= 0.28 && L <= 0.62;
}

/**
 * Marketplace briefs lock to the distilled market craft tokens.
 * A vivid user accent can retint brand. Water/field/shop/fiscal stay out.
 */
export function enrichMarketPalette<T extends EnginePalette>(brief: string, palette: T): T {
  if (!isMarketplaceBrief(brief)) return palette;
  const userVivid = extractUserColors(brief).hexes.find((hex) => isVividAccent(hex)) ?? null;
  const brand = userVivid ?? MARKET_CRAFT.brand;
  return {
    ...palette,
    bg: MARKET_CRAFT.surfaceSecondary,
    fg: MARKET_CRAFT.onSurface,
    accent: brand,
    muted: "#71717A",
    success: MARKET_CRAFT.success,
    warning: MARKET_CRAFT.warning,
    surface: MARKET_CRAFT.surface,
    elevated: MARKET_CRAFT.surface,
    line: MARKET_CRAFT.border,
    accentInk: "#FFFFFF",
  };
}
