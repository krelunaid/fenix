import { hexToOkLch, type EnginePalette } from "./palette-engine.ts";

/**
 * Distilled craft slots from a real water/field Expo theme.
 * Reusable structure — water/field may use these hexes; other domains
 * map their own palette into the same names. Not Apple SET.
 */
export type CraftSurfaces = {
  surface: string;
  onSurface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  surfaceInverse: string;
  brand: string;
  brandPrimary: string;
  brandSecondary: string;
  brandTertiary: string;
  success: string;
  warning: string;
  error: string;
  border: string;
};

export const WATER_CRAFT: CraftSurfaces = {
  surface: "#FFFFFF",
  onSurface: "#0F172A",
  surfaceSecondary: "#F8FAFC",
  surfaceTertiary: "#F1F5F9",
  surfaceInverse: "#0F172A",
  brand: "#0EA5E9",
  brandPrimary: "#0284C7",
  brandSecondary: "#38BDF8",
  brandTertiary: "#E0F2FE",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#E2E8F0",
};

export const CRAFT_SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;
export const CRAFT_RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const CRAFT_FONT = { caption: 12, body: 14, callout: 16, title: 20, title2: 24, display: 40 } as const;

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

function isLightPaper(hex: string): boolean {
  return hexToOkLch(hex).L >= 0.72;
}

/** Same slot names as the water theme, filled from a domain palette. Never forces sky-blue. */
export function surfacesFromPalette(palette: EnginePalette, water = false): CraftSurfaces {
  if (water) {
    const vivid = hexToOkLch(palette.accent).L >= 0.4 && hexToOkLch(palette.accent).C >= 0.1;
    const brand = vivid ? palette.accent : WATER_CRAFT.brand;
    return {
      ...WATER_CRAFT,
      brand,
      brandPrimary: mixHex(brand, "#032033", 0.22),
      brandSecondary: mixHex(brand, "#FFFFFF", 0.28),
      brandTertiary: mixHex(brand, "#FFFFFF", 0.82),
      success: palette.success || WATER_CRAFT.success,
      warning: palette.warning || WATER_CRAFT.warning,
    };
  }
  const paper = isLightPaper(palette.bg);
  const inverse = paper ? palette.fg : palette.bg;
  const onSurface = paper ? palette.fg : palette.fg;
  const brand = palette.accent;
  return {
    surface: paper ? "#FFFFFF" : palette.surface,
    onSurface,
    surfaceSecondary: paper ? mixHex(palette.bg, "#FFFFFF", 0.35) : mixHex(palette.bg, "#FFFFFF", 0.06),
    surfaceTertiary: paper ? mixHex(palette.bg, inverse, 0.08) : mixHex(palette.surface, "#FFFFFF", 0.08),
    surfaceInverse: inverse,
    brand,
    brandPrimary: mixHex(brand, paper ? "#000000" : "#FFFFFF", 0.22),
    brandSecondary: mixHex(brand, "#FFFFFF", paper ? 0.28 : 0.18),
    brandTertiary: mixHex(brand, paper ? "#FFFFFF" : palette.surface, 0.78),
    success: palette.success || (paper ? "#15803D" : "#5AA87A"),
    warning: palette.warning || "#D08A4A",
    error: "#DC2626",
    border: palette.line || mixHex(palette.bg, onSurface, 0.16),
  };
}

/** CSS custom properties. Uses craft slot names, not Apple SET. */
export function craftTokenCss(s: CraftSurfaces): string {
  return `--on-surface:${s.onSurface};--surface-2:${s.surfaceSecondary};--surface-3:${s.surfaceTertiary};--inverse:${s.surfaceInverse};--brand:${s.brand};--brand-2:${s.brandPrimary};--brand-3:${s.brandSecondary};--brand-soft:${s.brandTertiary};--ok:${s.success};--warn:${s.warning};--err:${s.error};--tile:rgba(255,255,255,.08);--shadow-card:0 8px 24px rgba(15,23,42,.08);--shadow-float:0 12px 28px color-mix(in srgb,${s.brandPrimary} 28%,transparent);--fx-r1:${CRAFT_RADIUS.sm}px;--fx-r2:${CRAFT_RADIUS.md}px;--fx-r3:${CRAFT_RADIUS.lg}px;--fx-pill:${CRAFT_RADIUS.pill}px;--fx-s1:${CRAFT_SPACE[1]}px;--fx-s2:${CRAFT_SPACE[2]}px;--fx-s3:${CRAFT_SPACE[3]}px;--fx-s4:${CRAFT_SPACE[4]}px;--fx-s5:${CRAFT_SPACE[5]}px;--fx-s6:${CRAFT_SPACE[6]}px;--fx-s7:${CRAFT_SPACE[7]}px;--fx-t-12:${CRAFT_FONT.caption}px;--fx-t-14:${CRAFT_FONT.body}px;--fx-t-16:${CRAFT_FONT.callout}px;--fx-t-20:${CRAFT_FONT.title}px;--fx-t-24:${CRAFT_FONT.title2}px;--fx-t-display:${CRAFT_FONT.display}px`;
}
