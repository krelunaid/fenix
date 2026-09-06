import { hexToOkLch, type EnginePalette } from "./palette-engine.ts";

/**
 * Shared craft slots distilled from three Emergent teachers
 * (water/field + marketplace + luxe/dark). Same names everywhere.
 * Domain hexes are opt-in — never force sky-blue, market navy, or stage gold.
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

export type CraftDomain = "water" | "market" | "luxe" | "barber" | "library" | "generic";
export type CraftRhythm = "utility" | "consumer" | "luxe" | "desk";
export type CraftMode = "utility" | "marketplace" | "luxe" | "desk" | "salon" | "bookstore" | "generic";

/** AcquaGt / field — utility radii. */
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

/** LikeSwift / marketplace — consumer radii, navy brand, category chips. */
export const MARKET_CRAFT: CraftSurfaces = {
  surface: "#FFFFFF",
  onSurface: "#18181B",
  surfaceSecondary: "#FAFAFA",
  surfaceTertiary: "#F4F4F5",
  surfaceInverse: "#18181B",
  brand: "#1E40AF",
  brandPrimary: "#1E40AF",
  brandSecondary: "#3B82F6",
  brandTertiary: "#DBEAFE",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#E4E4E7",
};

/** Barber / salon booking — espresso paper, cream ink, tan brand. Never raspberry. */
export const BARBER_CRAFT: CraftSurfaces = {
  surface: "#16110E",
  onSurface: "#F4EEE6",
  surfaceSecondary: "#0B0908",
  surfaceTertiary: "#1C1612",
  surfaceInverse: "#F4EEE6",
  brand: "#D2BFA6",
  brandPrimary: "#C4A882",
  brandSecondary: "#E4D3B8",
  brandTertiary: "#2A221C",
  success: "#8FBF9A",
  warning: "#E0A45A",
  error: "#E07070",
  border: "#3A2E24",
};

/** Library / bookstore — cream paper, wine brand, editorial type. Never desk gray. */
export const LIBRARY_CRAFT: CraftSurfaces = {
  surface: "#FFF8F0",
  onSurface: "#1C1410",
  surfaceSecondary: "#F6EFE4",
  surfaceTertiary: "#EBE0D0",
  surfaceInverse: "#2A1814",
  brand: "#6B2D3C",
  brandPrimary: "#4A1F2A",
  brandSecondary: "#8B4554",
  brandTertiary: "#F0D8DC",
  success: "#2F5D50",
  warning: "#B67323",
  error: "#9B2C2C",
  border: "#E0D2C2",
};

/**
 * Unmatched briefs — premium light floor. Warm paper, ink, one brand.
 * Not utility gray, not water sky, not library wine, not stage gold.
 */
export const GENERIC_CRAFT: CraftSurfaces = {
  surface: "#FFFCF8",
  onSurface: "#14110E",
  surfaceSecondary: "#F4F0EA",
  surfaceTertiary: "#EBE6DE",
  surfaceInverse: "#1A1815",
  brand: "#1F3D36",
  brandPrimary: "#16302B",
  brandSecondary: "#3D6B5C",
  brandTertiary: "#D7E4DE",
  success: "#1F7A4D",
  warning: "#B86A1A",
  error: "#B42318",
  border: "#DDD6CB",
};

/** Unmatched dark briefs — refined charcoal + cream, not luxe gold midnight. */
export const GENERIC_DARK_CRAFT: CraftSurfaces = {
  surface: "#141210",
  onSurface: "#F4EFE6",
  surfaceSecondary: "#1C1A17",
  surfaceTertiary: "#26231F",
  surfaceInverse: "#F4EFE6",
  brand: "#C4B5A0",
  brandPrimary: "#E8DCC8",
  brandSecondary: "#8A7A66",
  brandTertiary: "#3A342C",
  success: "#5AA87A",
  warning: "#D08A4A",
  error: "#E07070",
  border: "#2E2A26",
};

/** ActStage / luxe-dark — midnight paper, gold brand, utility radii, display 46. */
export const LUXE_CRAFT: CraftSurfaces = {
  surface: "#0D0D11",
  onSurface: "#F5F5FA",
  surfaceSecondary: "#1A1A22",
  surfaceTertiary: "#252530",
  surfaceInverse: "#F5F5FA",
  brand: "#D4AF37",
  brandPrimary: "#D4AF37",
  brandSecondary: "#B31A26",
  brandTertiary: "#3D2F1B",
  success: "#2A7C4F",
  warning: "#B67323",
  error: "#B31A26",
  border: "#2E2E38",
};

/** Official marketplace category accents. Only emitted on market products. */
export const MARKET_CATS = {
  delivery: "#F97316",
  home: "#1E40AF",
  cleaning: "#0EA5E9",
  pets: "#F59E0B",
  garden: "#10B981",
} as const;

export const CRAFT_SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;
export const CRAFT_RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const CRAFT_RADIUS_CONSUMER = { sm: 12, md: 20, lg: 24, pill: 999 } as const;
export const CRAFT_RADIUS_DESK = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const CRAFT_RADIUS_LUXE = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const CRAFT_FONT = { caption: 12, body: 14, callout: 16, title: 20, title2: 24, display: 40 } as const;
export const CRAFT_FONT_LUXE = { caption: 14, body: 14, callout: 16, title: 20, title2: 24, display: 46 } as const;

export function craftModeOf(flags: {
  field?: boolean;
  market?: boolean;
  luxe?: boolean;
  desk?: boolean;
  barber?: boolean;
  library?: boolean;
}): CraftMode {
  if (flags.desk && !flags.luxe) return "desk";
  if (flags.field) return "utility";
  if (flags.market) return "marketplace";
  if (flags.luxe) return "luxe";
  if (flags.barber) return "salon";
  if (flags.library) return "bookstore";
  if (flags.desk) return "desk";
  return "generic";
}

export function craftRhythmOf(flags: {
  field?: boolean;
  market?: boolean;
  luxe?: boolean;
  desk?: boolean;
  phone?: boolean;
  barber?: boolean;
  library?: boolean;
}): CraftRhythm {
  if (flags.desk && !flags.luxe) return "desk";
  if (flags.field) return "utility";
  if (flags.luxe) return "luxe";
  if (flags.market || flags.phone || flags.barber || flags.library) return "consumer";
  return "utility";
}

export function radiusForRhythm(rhythm: CraftRhythm = "utility"): { sm: number; md: number; lg: number; pill: number } {
  if (rhythm === "consumer") return CRAFT_RADIUS_CONSUMER;
  if (rhythm === "desk") return CRAFT_RADIUS_DESK;
  if (rhythm === "luxe") return CRAFT_RADIUS_LUXE;
  return CRAFT_RADIUS;
}

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

function asDomain(domain: boolean | CraftDomain = false): CraftDomain {
  if (domain === true || domain === "water") return "water";
  if (domain === "market") return "market";
  if (domain === "luxe") return "luxe";
  if (domain === "barber") return "barber";
  if (domain === "library") return "library";
  return "generic";
}

/** Same slot names as the teacher themes, filled from a domain palette. */
export function surfacesFromPalette(palette: EnginePalette, domain: boolean | CraftDomain = false): CraftSurfaces {
  const kind = asDomain(domain);
  if (kind === "water") {
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
  if (kind === "market") {
    const vivid = hexToOkLch(palette.accent).L >= 0.35 && hexToOkLch(palette.accent).C >= 0.08;
    const brand = vivid ? palette.accent : MARKET_CRAFT.brand;
    return {
      ...MARKET_CRAFT,
      brand,
      brandPrimary: mixHex(brand, "#0B1226", 0.12),
      brandSecondary: mixHex(brand, "#FFFFFF", 0.28),
      brandTertiary: mixHex(brand, "#FFFFFF", 0.82),
      success: palette.success || MARKET_CRAFT.success,
      warning: palette.warning || MARKET_CRAFT.warning,
    };
  }
  if (kind === "luxe") {
    const vivid = hexToOkLch(palette.accent).L >= 0.42 && hexToOkLch(palette.accent).C >= 0.08;
    const brand = vivid ? palette.accent : LUXE_CRAFT.brand;
    return {
      ...LUXE_CRAFT,
      brand,
      brandPrimary: brand,
      brandSecondary: LUXE_CRAFT.brandSecondary,
      brandTertiary: LUXE_CRAFT.brandTertiary,
      success: palette.success || LUXE_CRAFT.success,
      warning: palette.warning || LUXE_CRAFT.warning,
    };
  }
  if (kind === "barber") {
    const vivid = hexToOkLch(palette.accent).L >= 0.38 && hexToOkLch(palette.accent).C >= 0.04;
    const brand = vivid ? palette.accent : BARBER_CRAFT.brand;
    return {
      ...BARBER_CRAFT,
      brand,
      brandPrimary: mixHex(brand, "#0B0908", 0.18),
      brandSecondary: mixHex(brand, "#F4EEE6", 0.22),
      brandTertiary: mixHex(brand, "#0B0908", 0.72),
      success: palette.success || BARBER_CRAFT.success,
      warning: palette.warning || BARBER_CRAFT.warning,
    };
  }
  if (kind === "library") {
    const vivid = hexToOkLch(palette.accent).L >= 0.28 && hexToOkLch(palette.accent).C >= 0.06;
    const brand = vivid ? palette.accent : LIBRARY_CRAFT.brand;
    return {
      ...LIBRARY_CRAFT,
      brand,
      brandPrimary: mixHex(brand, "#1C1410", 0.22),
      brandSecondary: mixHex(brand, "#FFFFFF", 0.28),
      brandTertiary: mixHex(brand, "#FFFFFF", 0.82),
      success: palette.success || LIBRARY_CRAFT.success,
      warning: palette.warning || LIBRARY_CRAFT.warning,
    };
  }
  const paper = isLightPaper(palette.bg);
  const base = paper ? GENERIC_CRAFT : GENERIC_DARK_CRAFT;
  const vivid = hexToOkLch(palette.accent).L >= (paper ? 0.22 : 0.38) && hexToOkLch(palette.accent).C >= 0.05;
  const brand = vivid ? palette.accent : base.brand;
  const onSurface = paper
    ? hexToOkLch(palette.fg).L <= 0.28
      ? palette.fg
      : base.onSurface
    : hexToOkLch(palette.fg).L >= 0.78
      ? palette.fg
      : base.onSurface;
  return {
    ...base,
    surface: paper ? base.surface : palette.surface || base.surface,
    onSurface,
    surfaceSecondary: paper ? mixHex(base.surfaceSecondary, palette.bg, 0.28) : mixHex(palette.bg, "#FFFFFF", 0.05),
    surfaceTertiary: paper ? mixHex(base.surfaceTertiary, palette.bg, 0.18) : mixHex(palette.surface, "#FFFFFF", 0.08),
    surfaceInverse: paper ? base.surfaceInverse : mixHex(palette.bg, "#FFFFFF", 0.92),
    brand,
    brandPrimary: mixHex(brand, paper ? "#0A0A0A" : "#FFFFFF", 0.22),
    brandSecondary: mixHex(brand, "#FFFFFF", paper ? 0.28 : 0.18),
    brandTertiary: mixHex(brand, paper ? "#FFFFFF" : palette.surface, 0.78),
    success: palette.success || base.success,
    warning: palette.warning || base.warning,
    error: paper ? base.error : GENERIC_DARK_CRAFT.error,
    border: palette.line || base.border,
  };
}

function categoryCss(s: CraftSurfaces, domain: CraftDomain): string {
  if (domain === "market") {
    return `--cat-1:${MARKET_CATS.delivery};--cat-2:${MARKET_CATS.home};--cat-3:${MARKET_CATS.cleaning};--cat-4:${MARKET_CATS.pets};--cat-5:${MARKET_CATS.garden}`;
  }
  if (domain === "luxe") {
    return `--cat-1:${LUXE_CRAFT.brand};--cat-2:${LUXE_CRAFT.brandSecondary};--cat-3:${LUXE_CRAFT.warning};--cat-4:${LUXE_CRAFT.success};--cat-5:${LUXE_CRAFT.brandTertiary}`;
  }
  return `--cat-1:${mixHex(s.brand, "#FFFFFF", 0.12)};--cat-2:${s.brand};--cat-3:${s.brandSecondary};--cat-4:${s.warning};--cat-5:${s.success}`;
}

function shadowCss(s: CraftSurfaces, domain: CraftDomain): string {
  if (domain === "luxe" || domain === "barber") {
    return `--shadow-card:0 1px 0 color-mix(in srgb,${s.brand} 22%,transparent),0 18px 40px rgba(0,0,0,.48);--shadow-float:0 16px 44px color-mix(in srgb,${s.brand} 32%,transparent)`;
  }
  if (domain === "generic") {
    return `--shadow-card:0 1px 0 color-mix(in srgb,${s.onSurface} 6%,transparent),0 14px 36px color-mix(in srgb,${s.onSurface} 10%,transparent);--shadow-float:0 16px 40px color-mix(in srgb,${s.brandPrimary} 28%,transparent)`;
  }
  return `--shadow-card:0 1px 2px rgba(15,23,42,.05),0 10px 28px rgba(15,23,42,.10);--shadow-float:0 12px 32px color-mix(in srgb,${s.brandPrimary} 30%,transparent)`;
}

/** CSS custom properties. Uses craft slot names, not Apple SET. */
export function craftTokenCss(
  s: CraftSurfaces,
  opts?: { rhythm?: CraftRhythm; domain?: CraftDomain },
): string {
  const r = radiusForRhythm(opts?.rhythm || "utility");
  const domain = opts?.domain || "generic";
  const type = domain === "luxe" || domain === "barber" || opts?.rhythm === "luxe" ? CRAFT_FONT_LUXE : CRAFT_FONT;
  return `--on-surface:${s.onSurface};--surface-2:${s.surfaceSecondary};--surface-3:${s.surfaceTertiary};--inverse:${s.surfaceInverse};--brand:${s.brand};--brand-2:${s.brandPrimary};--brand-3:${s.brandSecondary};--brand-soft:${s.brandTertiary};--ok:${s.success};--warn:${s.warning};--err:${s.error};--tile:rgba(255,255,255,.08);${categoryCss(s, domain)};${shadowCss(s, domain)};--fx-r1:${r.sm}px;--fx-r2:${r.md}px;--fx-r3:${r.lg}px;--fx-pill:${r.pill}px;--fx-s1:${CRAFT_SPACE[1]}px;--fx-s2:${CRAFT_SPACE[2]}px;--fx-s3:${CRAFT_SPACE[3]}px;--fx-s4:${CRAFT_SPACE[4]}px;--fx-s5:${CRAFT_SPACE[5]}px;--fx-s6:${CRAFT_SPACE[6]}px;--fx-s7:${CRAFT_SPACE[7]}px;--fx-t-12:${type.caption}px;--fx-t-14:${type.body}px;--fx-t-16:${type.callout}px;--fx-t-20:${type.title}px;--fx-t-24:${type.title2}px;--fx-t-display:${type.display}px`;
}
