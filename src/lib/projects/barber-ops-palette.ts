import { extractUserColors, hexToOkLch, type EnginePalette } from "./palette-engine.ts";
import { isBarberBrief } from "./app-identity.ts";
import { BARBER_CRAFT } from "./craft-tokens.ts";

/** Rejected raspberry — never a salon accent. */
export const BARBER_RASPBERRY = /#b51246|#b01e47|#a61d4c/i;

function isUsableAccent(hex: string): boolean {
  if (BARBER_RASPBERRY.test(hex)) return false;
  const { L, C } = hexToOkLch(hex);
  return C >= 0.04 && L >= 0.25 && L <= 0.86;
}

/**
 * Barber / salon briefs lock to espresso + cream + tan.
 * Never raspberry, never water sky, never pale booking teal.
 * An explicit brief hex can retint brand if it stays AA-usable.
 */
export function enrichBarberPalette<T extends EnginePalette>(brief: string, palette: T): T {
  if (!isBarberBrief(brief)) return palette;
  const userHex = extractUserColors(brief).hexes.find((hex) => isUsableAccent(hex)) ?? null;
  const brand = userHex ?? BARBER_CRAFT.brand;
  return {
    ...palette,
    bg: BARBER_CRAFT.surfaceSecondary,
    fg: BARBER_CRAFT.onSurface,
    accent: brand,
    muted: "#B9A894",
    success: BARBER_CRAFT.success,
    warning: BARBER_CRAFT.warning,
    surface: BARBER_CRAFT.surface,
    elevated: BARBER_CRAFT.surfaceTertiary,
    line: BARBER_CRAFT.border,
    accentInk: "#0B0908",
  };
}
