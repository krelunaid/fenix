import { extractUserColors, hexToOkLch, type EnginePalette } from "./palette-engine.ts";
import { isFieldProductBrief } from "./app-identity.ts";

/** Deep board navy — AcquaGt-like richness, not Apple SET. */
export const WATER_NAVY = "#121C2D";
/** Electric water fill — vivid, not #007AFF / #0A84FF. */
export const WATER_BLUE = "#0D73C4";
/** Saturated success — not the olive wash (#b8c4a0). */
export const WATER_OK = "#178A45";
export const WATER_PAPER = "#F4F7FB";
export const WATER_WARN = "#C9A227";

function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const ch = (i: number) => {
    const x = parseInt(pa.slice(i, i + 2), 16);
    const y = parseInt(pb.slice(i, i + 2), 16);
    return Math.max(0, Math.min(255, Math.round(x + (y - x) * t)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

function isDeepInk(hex: string): boolean {
  return hexToOkLch(hex).L <= 0.38;
}

function isVividAccent(hex: string): boolean {
  const { L, C } = hexToOkLch(hex);
  return C >= 0.08 && L >= 0.4 && L <= 0.62;
}

/**
 * Field / water / ops briefs must not collapse to anemic paper palettes.
 * Keep the user's navy as ink when they give one; force a vivid water accent
 * and a saturated success green so KPI boards and tanks have real color.
 */
export function enrichWaterOpsPalette<T extends EnginePalette>(brief: string, palette: T): T {
  if (!isFieldProductBrief(brief)) return palette;
  const hexes = extractUserColors(brief).hexes;
  const userNavy = hexes.find((hex) => isDeepInk(hex)) ?? null;
  const userVivid = hexes.find((hex) => isVividAccent(hex)) ?? null;
  const navy = userNavy ?? WATER_NAVY;
  const accent = userVivid ?? WATER_BLUE;
  const paper = hexToOkLch(palette.bg).L < 0.78 ? WATER_PAPER : palette.bg;
  return {
    ...palette,
    bg: paper,
    fg: navy,
    accent,
    muted: mixHex(navy, "#6B7C90", 0.42),
    success: WATER_OK,
    warning: WATER_WARN,
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    line: mixHex(paper, navy, 0.14),
    accentInk: "#FFFFFF",
  };
}
