/**
 * Adaptive palette engine. Deterministic, 0 LLM credits.
 * Extracts domain/audience/tone/energy/material/context from the brief,
 * emits one of 8 perceptually distinct families, respects explicit user
 * colours (AA-only correction), and avoids the last 5 signatures in OKLab.
 */
import { contrastRatio } from "./visual-quality.ts";
import type { Palette } from "./types.ts";

export type PaletteFamily =
  | "ink-terminal"
  | "luminous-paper"
  | "mono-signal"
  | "pastel-studio"
  | "chroma-pulse"
  | "glacier"
  | "earth-kiln"
  | "wine-ink";

export type BriefAxes = {
  domain: string;
  audience: string;
  tone: "technical" | "warm" | "austere" | "luxe" | "playful" | "clinical";
  energy: "low" | "mid" | "high";
  material: string;
  context: "night" | "day" | "studio" | "kitchen" | "atelier" | "terminal" | "paper";
};

export type PaletteRecord = {
  bg: string;
  surface: string;
  accent: string;
  family?: PaletteFamily | string;
  at?: number;
};

export type EnginePalette = Palette & {
  elevated: string;
  accentInk: string;
  success: string;
  warning: string;
};

export type AdaptivePalette = {
  family: PaletteFamily;
  axes: BriefAxes;
  palette: EnginePalette;
  userLock: { bg: boolean; accent: boolean };
  dna: string;
};

export const CLOSE_DELTA_E = 14;
export const HISTORY_WINDOW = 5;
export const FORBIDDEN_FALLBACK = {
  bg: "#101114",
  surface: "#191b20",
  accent: "#e1693f",
} as const;

type OkLab = { L: number; a: number; b: number };
type OkLch = { L: number; C: number; H: number };

export type FamilyRecipe = {
  family: PaletteFamily;
  mood: string;
  fonts: { display: string; body: string; href: string };
  radius: string;
  type: { h1: string; body: string; label: string };
  palette: EnginePalette;
  dont: string[];
};

const HASH_FAMILIES: PaletteFamily[] = [
  "ink-terminal",
  "luminous-paper",
  "mono-signal",
  "pastel-studio",
  "chroma-pulse",
  "glacier",
];

function recipe(
  family: PaletteFamily,
  mood: string,
  display: string,
  body: string,
  href: string,
  radius: string,
  type: FamilyRecipe["type"],
  palette: EnginePalette,
  dont: string[],
): FamilyRecipe {
  return { family, mood, fonts: { display, body, href }, radius, type, palette, dont };
}

export const ENGINE_FAMILIES: Record<PaletteFamily, FamilyRecipe> = {
  "ink-terminal": recipe(
    "ink-terminal",
    "terminale, ciano freddo, carta di commit",
    "IBM Plex Sans",
    "IBM Plex Sans",
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
    "6px",
    { h1: "clamp(1.35rem, 3.2vw, 1.85rem)", body: "14px", label: "11px tabular" },
    {
      bg: "#0b1220",
      surface: "#152033",
      elevated: "#1d2b44",
      fg: "#e8eef6",
      muted: "#8ea0b8",
      accent: "#2ec8c0",
      line: "#2a3b58",
      accentInk: "#061018",
      success: "#3dba84",
      warning: "#d8a03a",
    },
    ["hero grigio + 2 KPI", "serif da rivista", "terracotta da forno", "clone GitHub verde"],
  ),
  "luminous-paper": recipe(
    "luminous-paper",
    "carta diurna, inchiostro elettrico, luce nord",
    "Source Serif 4",
    "Source Sans 3",
    "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap",
    "8px",
    { h1: "clamp(1.6rem, 4vw, 2.3rem)", body: "16px", label: "11px uppercase tracking" },
    {
      bg: "#f3f6fb",
      surface: "#ffffff",
      elevated: "#e8eef8",
      fg: "#142033",
      muted: "#5a6b80",
      accent: "#1d4ed8",
      line: "#cfd8e6",
      accentInk: "#f3f6fb",
      success: "#0f766e",
      warning: "#b45309",
    },
    ["nero/terracotta", "tab Home/Nuovo", "viola AI"],
  ),
  "mono-signal": recipe(
    "mono-signal",
    "segnale unico, carta nera, ottone spento",
    "Archivo",
    "Public Sans",
    "https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Public+Sans:wght@400;600&display=swap",
    "2px",
    { h1: "clamp(1.4rem, 3.6vw, 2rem)", body: "15px", label: "10px uppercase tracking" },
    {
      bg: "#111111",
      surface: "#1c1c1c",
      elevated: "#2a2a2a",
      fg: "#f3f3f0",
      muted: "#9a9a94",
      accent: "#e8e2c4",
      line: "#3a3a38",
      accentInk: "#111111",
      success: "#b8c4a0",
      warning: "#d0a070",
    },
    ["pastello", "terracotta", "serif da sfilata"],
  ),
  "pastel-studio": recipe(
    "pastel-studio",
    "studio pastello, carta malva, inchiostro basso",
    "Fraunces",
    "Figtree",
    "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap",
    "16px",
    { h1: "clamp(1.5rem, 4vw, 2.2rem)", body: "16px", label: "12px sentence" },
    {
      bg: "#f4eef6",
      surface: "#fff8fc",
      elevated: "#ffffff",
      fg: "#3a2a42",
      muted: "#7a6a82",
      accent: "#a86c9a",
      line: "#e4d6e4",
      accentInk: "#fff8fc",
      success: "#4a8a72",
      warning: "#c07a48",
    },
    ["nero carbone", "KPI da cruscotto", "ciano da terminale"],
  ),
  "chroma-pulse": recipe(
    "chroma-pulse",
    "impulso, magenta vivo, notte di sala",
    "Syne",
    "Outfit",
    "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&family=Syne:wght@600;700&display=swap",
    "10px",
    { h1: "clamp(1.55rem, 4.4vw, 2.3rem)", body: "16px", label: "11px uppercase" },
    {
      bg: "#14081c",
      surface: "#221033",
      elevated: "#321848",
      fg: "#f4e8ff",
      muted: "#b89ad0",
      accent: "#ff3d7f",
      line: "#4a2860",
      accentInk: "#14081c",
      success: "#3ecf8e",
      warning: "#ffb020",
    },
    ["beige da forno", "serif da lastre", "tab iPhone"],
  ),
  glacier: recipe(
    "glacier",
    "ghiaccio clinico, acciaio, carta fredda",
    "Literata",
    "Karla",
    "https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&family=Literata:opsz,wght@7..72,500;7..72,700&display=swap",
    "12px",
    { h1: "clamp(1.45rem, 3.8vw, 2.1rem)", body: "16px", label: "11px uppercase tracking" },
    {
      bg: "#eef6f8",
      surface: "#ffffff",
      elevated: "#dcecef",
      fg: "#143038",
      muted: "#4e6a72",
      accent: "#0e7c8b",
      line: "#c5d8dc",
      accentInk: "#eef6f8",
      success: "#0f766e",
      warning: "#b45309",
    },
    ["terracotta", "carminio moda", "hero grigio"],
  ),
  "earth-kiln": recipe(
    "earth-kiln",
    "calce, cotto, polvere di bottega",
    "Fraunces",
    "Source Sans 3",
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap",
    "10px",
    { h1: "1.25rem", body: "16px", label: "11px uppercase tracking" },
    {
      bg: "#e8dcc8",
      surface: "#f4ebe0",
      elevated: "#fbf6ee",
      fg: "#3b2a22",
      muted: "#8a6f5c",
      accent: "#b85c38",
      line: "#c4b09a",
      accentInk: "#f4ebe0",
      success: "#3d4a1f",
      warning: "#b45309",
    },
    ["grigio iPhone", "ciano da terminale", "magenta da sala"],
  ),
  "wine-ink": recipe(
    "wine-ink",
    "carbone di cucina, vino, zafferano",
    "Zilla Slab",
    "Source Sans 3",
    "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Zilla+Slab:wght@500;700&display=swap",
    "8px",
    { h1: "clamp(1.6rem, 5vw, 2.3rem)", body: "16px", label: "13px slab" },
    {
      bg: "#1a1210",
      surface: "#241816",
      elevated: "#321f1b",
      fg: "#f6ead8",
      muted: "#c4a890",
      accent: "#c43c2c",
      line: "#4a3028",
      accentInk: "#f6ead8",
      success: "#7d9a6a",
      warning: "#d4a017",
    },
    ["beige da forno", "hero da boutique", "tab iPhone"],
  ),
};

const NAMED_COLORS: { re: RegExp; hex: string; role: "bg" | "accent" | "either" }[] = [
  { re: /\bnero\b|\bblack\b/i, hex: "#121212", role: "bg" },
  { re: /\bbianco\b|\bwhite\b/i, hex: "#f6f4ef", role: "bg" },
  { re: /\bnavy\b|\bblu navy\b/i, hex: "#0b1f3a", role: "either" },
  { re: /\bpetrolio\b|\bteal\b/i, hex: "#0f766e", role: "accent" },
  { re: /\bciano\b|\bcyan\b/i, hex: "#0891b2", role: "accent" },
  { re: /\bindaco\b/i, hex: "#3730a3", role: "accent" },
  { re: /\bblu\b|\bblue\b/i, hex: "#1d4ed8", role: "accent" },
  { re: /\bverde\b|\bgreen\b/i, hex: "#166534", role: "accent" },
  { re: /\brosso\b|\bred\b/i, hex: "#b91c1c", role: "accent" },
  { re: /\barancio\b|\borange\b/i, hex: "#c2410c", role: "accent" },
  { re: /\bocra\b|\bocre\b/i, hex: "#b45309", role: "accent" },
  { re: /\bgiallo\b|\byellow\b/i, hex: "#ca8a04", role: "accent" },
  { re: /\bros[ao]\b|\bpink\b/i, hex: "#db2777", role: "accent" },
  { re: /\bghiaccio\b|\bice\b/i, hex: "#dce8ee", role: "bg" },
];

function hashBrief(brief: string): number {
  let h = 2166136261;
  const s = String(brief || "").toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function briefSeed(brief: string): number {
  return hashBrief(brief);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  if (h.length >= 6 && /^[0-9a-fA-F]{6}/.test(h)) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  return rgbToHex(A[0] * (1 - t) + B[0] * t, A[1] * (1 - t) + B[1] * t, A[2] * (1 - t) + B[2] * t);
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function hexToOkLab(hex: string): OkLab {
  const rgb = hexToRgb(hex) || [16, 17, 20];
  const lr = srgbToLinear(rgb[0]);
  const lg = srgbToLinear(rgb[1]);
  const lb = srgbToLinear(rgb[2]);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function hexToOkLch(hex: string): OkLch {
  const { L, a, b } = hexToOkLab(hex);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

export function deltaE(a: string, b: string): number {
  const A = hexToOkLab(a);
  const B = hexToOkLab(b);
  const dL = (A.L - B.L) * 100;
  const da = (A.a - B.a) * 100;
  const db = (A.b - B.b) * 100;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function paletteDistance(a: PaletteRecord, b: PaletteRecord): number {
  const paper = (deltaE(a.bg, b.bg) + deltaE(a.surface, b.surface)) / 2;
  const accent = deltaE(a.accent, b.accent);
  return Math.max(paper, accent);
}

export function paletteSignatureKey(p: Pick<Palette, "bg" | "accent">): string {
  const bg = hexToOkLch(p.bg);
  const ac = hexToOkLch(p.accent);
  const paper = bg.L > 0.55 ? "L" : "D";
  const hue = Math.round(ac.H / 20) % 18;
  const band = ac.C < 0.055 ? "m" : ac.C < 0.13 ? "s" : "h";
  const paperBand = Math.round(bg.L * 6);
  return `${paper}${hue}${band}${paperBand}`;
}

export function extractUserColors(brief: string): { bg?: string; accent?: string; hexes: string[] } {
  const text = String(brief || "");
  const hexes = [...text.matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => `#${m[1]!.toLowerCase()}`);
  let bg: string | undefined;
  let accent: string | undefined;
  const wantsBg = /sfondo|background|carta|bg\b/i.test(text);
  const wantsAccent = /accent|accento|primar/i.test(text);
  if (hexes.length >= 2 && wantsBg && wantsAccent) {
    bg = hexes[0];
    accent = hexes[1];
  } else if (hexes.length >= 2) {
    bg = bg || hexes[0];
    accent = accent || hexes[1];
  } else if (hexes.length === 1) {
    if (wantsBg && !wantsAccent) bg = hexes[0];
    else accent = hexes[0];
  }
  for (const row of NAMED_COLORS) {
    if (!row.re.test(text)) continue;
    if (row.role === "bg" && !bg) bg = row.hex;
    else if (row.role === "accent" && !accent) accent = row.hex;
    else if (row.role === "either") {
      if (/sfondo|background|carta/i.test(text) && !bg) bg = row.hex;
      else if (!accent) accent = row.hex;
    }
  }
  return { bg, accent, hexes };
}

export function extractBriefAxes(brief: string): BriefAxes {
  const p = String(brief || "").toLowerCase();
  const domain = /repo|github|commit|branch|\bgit\b|diff|pull request|sync/.test(p)
    ? "repository"
    : /clinic|ospedal|pazient|medic|dentist|terap/.test(p)
      ? "clinical"
      : /radio|music|dj|concerto|playlist|live set/.test(p)
        ? "music"
        : /scuol|didatt|wellness|yoga|pastello/.test(p)
          ? "studio"
          : /documen|manuale|carta luce|knowledge|wiki/.test(p)
            ? "docs"
            : /ceram|fornace|argilla|kiln/.test(p)
              ? "ceramic"
              : /ristor|cucina|crudo|osteria/.test(p)
                ? "food"
                : /moda|sfilata|lookbook/.test(p)
                  ? "fashion"
                  : /profum|flacone/.test(p)
                    ? "perfume"
                    : /hotel|locanda|ospital/.test(p)
                      ? "hospitality"
                      : /ledger|kpi|pipeline|vendit/.test(p)
                        ? "ops"
                        : "craft";
  const audience = /developer|dev\b|ingegn|repo/.test(p)
    ? "engineer"
    : /ospit|guest|cliente/.test(p)
      ? "guest"
      : /chef|cuoco/.test(p)
        ? "chef"
        : /pazient/.test(p)
          ? "patient"
          : "maker";
  const tone: BriefAxes["tone"] = /clinic|ospedal|fredd|ice|ghiaccio/.test(p)
    ? "clinical"
    : /tecn|repo|git|terminal|ops/.test(p)
      ? "technical"
      : /luxe|premium|oro|champagne/.test(p)
        ? "luxe"
        : /play|radio|pulse|fest/.test(p)
          ? "playful"
          : /auster|mono|segnale/.test(p)
            ? "austere"
            : "warm";
  const energy: BriefAxes["energy"] = /pulse|live|alta croma|high/.test(p)
    ? "high"
    : /quiet|silenz|notte|low/.test(p)
      ? "low"
      : "mid";
  const material = /marmo/.test(p)
    ? "marble"
    : /vetro/.test(p)
      ? "glass"
      : /pietra/.test(p)
        ? "stone"
        : /acciaio|steel|silicon/.test(p)
          ? "steel"
          : /carta|paper/.test(p)
            ? "paper"
            : /argilla|cotto/.test(p)
              ? "clay"
              : "ink";
  const context: BriefAxes["context"] = /terminal|repo|git/.test(p)
    ? "terminal"
    : /cucina|crudo/.test(p)
      ? "kitchen"
      : /atelier|sfilata/.test(p)
        ? "atelier"
        : /notte|night/.test(p)
          ? "night"
          : /studio/.test(p)
            ? "studio"
            : /luce|day|diurn/.test(p)
              ? "day"
              : "paper";
  return { domain, audience, tone, energy, material, context };
}

export function earthMotivated(brief: string): boolean {
  return /ceram|fornace|argilla|terracotta|kiln|colata|grottaglie|forno|cotto di bottega/.test(
    String(brief || ""),
  );
}

export function selectPaletteFamily(brief: string, seed = hashBrief(brief)): PaletteFamily {
  const p = String(brief || "").toLowerCase();
  if (earthMotivated(p)) return "earth-kiln";
  if (/ristor|osteria|trattoria|brasserie|chef|cucina di|menu degust|crudo/.test(p)) return "wine-ink";
  if (/repo|github|commit|branch|\bgit\b|diff|pull request|voci del repo|repovoci/.test(p)) {
    return /luce|luminos|daylight|carta chiara|paper/.test(p) ? "luminous-paper" : "ink-terminal";
  }
  if (/clinic|ospedal|pazient|medic|dentist|terap/.test(p)) return "glacier";
  if (/radio|music|dj|concerto|playlist|live set|pulse/.test(p)) return "chroma-pulse";
  if (/scuol|didatt|wellness|yoga|pastello/.test(p)) return "pastel-studio";
  if (/documen|manuale|wiki|knowledge|carta luce/.test(p)) return "luminous-paper";
  if (/\bmono\b|segnale|contrasto alto|high contrast/.test(p)) return "mono-signal";
  if (/notte|night|vesper|timer|respiro/.test(p)) return "ink-terminal";
  return HASH_FAMILIES[seed % HASH_FAMILIES.length]!;
}

export function classifyPalette(p: Pick<Palette, "bg" | "accent">): PaletteFamily {
  const bg = hexToOkLch(p.bg);
  const ac = hexToOkLch(p.accent);
  const dark = bg.L < 0.45;
  if (ac.C < 0.055) return "mono-signal";
  if (!dark && ac.C < 0.14 && ac.H > 280 && ac.H < 350) return "pastel-studio";
  if (!dark && ac.H >= 160 && ac.H <= 220) return "glacier";
  if (!dark && ac.H >= 230 && ac.H <= 280) return "luminous-paper";
  if (dark && ac.C >= 0.14 && (ac.H < 40 || ac.H > 320 || (ac.H > 300 && ac.H < 360))) return "chroma-pulse";
  if (dark && ac.H >= 160 && ac.H <= 220) return "ink-terminal";
  if (!dark && ac.H >= 20 && ac.H <= 55 && ac.C >= 0.06) return "earth-kiln";
  if (dark && ac.H >= 15 && ac.H <= 50) return "wine-ink";
  if (dark) return ac.C >= 0.12 ? "chroma-pulse" : "ink-terminal";
  return ac.C >= 0.12 ? "luminous-paper" : "pastel-studio";
}

function clonePalette(p: EnginePalette): EnginePalette {
  return { ...p };
}

function rotateAccent(hex: string, deg: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((n) => n / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deg + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  return rgbToHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}

export function ensureAccessible(
  palette: EnginePalette,
  lock: { bg?: boolean; accent?: boolean } = {},
): EnginePalette {
  const next = clonePalette(palette);
  const light = hexToOkLch(next.bg).L > 0.55;
  if (contrastRatio(next.fg, next.bg) < 4.5) next.fg = light ? "#141414" : "#f4efe4";
  if (contrastRatio(next.muted, next.bg) < 3) {
    next.muted = light ? mixHex(next.fg, next.bg, 0.32) : mixHex(next.fg, next.bg, 0.42);
  }
  if (contrastRatio(next.surface, next.bg) < 1.12) {
    next.surface = light ? mixHex(next.bg, "#ffffff", 0.55) : mixHex(next.bg, "#ffffff", 0.1);
  }
  if (contrastRatio(next.fg, next.surface) < 4.5) next.fg = light ? "#141414" : "#f4efe4";
  next.line = next.line && contrastRatio(next.bg, next.line) >= 1.25 ? next.line : mixHex(next.bg, next.fg, 0.22);
  next.elevated = next.elevated || mixHex(next.surface, "#ffffff", light ? 0.4 : 0.08);
  const accentInkDark = contrastRatio("#111111", next.accent) >= 4.5;
  const accentInkLight = contrastRatio("#f7f1e4", next.accent) >= 4.5;
  next.accentInk = accentInkDark ? "#111111" : accentInkLight ? "#f7f1e4" : light ? "#111111" : "#f7f1e4";
  if (!lock.accent && contrastRatio(next.accent, next.bg) < 2.4) {
    next.accent = light ? mixHex(next.accent, "#000000", 0.22) : mixHex(next.accent, "#ffffff", 0.22);
  }
  return next;
}

export function applyUserColors(
  palette: EnginePalette,
  brief: string,
): { palette: EnginePalette; lock: { bg: boolean; accent: boolean } } {
  const found = extractUserColors(brief);
  const next = clonePalette(palette);
  const lock = { bg: false, accent: false };
  if (found.bg) {
    next.bg = found.bg;
    const light = hexToOkLch(next.bg).L > 0.55;
    next.surface = light ? mixHex(next.bg, "#ffffff", 0.4) : mixHex(next.bg, "#ffffff", 0.1);
    next.elevated = light ? mixHex(next.surface, "#ffffff", 0.35) : mixHex(next.surface, "#ffffff", 0.08);
    next.fg = light ? "#161412" : "#f4efe4";
    next.muted = light ? "#5c5348" : "#9aa0b0";
    lock.bg = true;
  }
  if (found.accent) {
    next.accent = found.accent;
    lock.accent = true;
  }
  return { palette: ensureAccessible(next, lock), lock };
}

export function avoidRecent(
  palette: EnginePalette,
  recent: PaletteRecord[] | undefined,
  seed: number,
  lock: { bg?: boolean; accent?: boolean } = {},
): EnginePalette {
  const history = (recent || []).slice(-HISTORY_WINDOW);
  if (!history.length) return palette;
  let next = clonePalette(palette);
  const self: PaletteRecord = { bg: next.bg, surface: next.surface, accent: next.accent };
  let closest = Math.min(...history.map((row) => paletteDistance(self, row)));
  let guard = 0;
  while (closest < CLOSE_DELTA_E && guard < 8) {
    if (lock.bg && lock.accent) break;
    const deg = 41 + ((seed + guard * 17) % 53);
    if (!lock.accent) next.accent = rotateAccent(next.accent, deg);
    if (guard % 2 === 1 && !lock.bg) {
      const light = hexToOkLch(next.bg).L > 0.55;
      if (light) {
        next.bg = mixHex(next.bg, "#0b1220", 0.08);
        next.surface = mixHex(next.surface, "#152033", 0.08);
      } else {
        next.bg = mixHex(next.bg, "#f3f6fb", 0.1);
        next.surface = mixHex(next.surface, "#ffffff", 0.12);
      }
    }
    next = ensureAccessible(next, lock);
    closest = Math.min(
      ...history.map((row) => paletteDistance({ bg: next.bg, surface: next.surface, accent: next.accent }, row)),
    );
    guard += 1;
  }
  return next;
}

export function sanitizePaletteHistory(input: unknown): PaletteRecord[] {
  if (!Array.isArray(input)) return [];
  const out: PaletteRecord[] = [];
  for (const row of input.slice(-12)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const bg = typeof rec.bg === "string" && /^#[0-9a-fA-F]{6}$/.test(rec.bg) ? rec.bg : "";
    const surface =
      typeof rec.surface === "string" && /^#[0-9a-fA-F]{6}$/.test(rec.surface) ? rec.surface : "";
    const accent =
      typeof rec.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(rec.accent) ? rec.accent : "";
    if (!bg || !surface || !accent) continue;
    out.push({
      bg: bg.toLowerCase(),
      surface: surface.toLowerCase(),
      accent: accent.toLowerCase(),
      family: typeof rec.family === "string" ? rec.family.slice(0, 32) : undefined,
      at: typeof rec.at === "number" ? rec.at : undefined,
    });
  }
  return out.slice(-HISTORY_WINDOW);
}

export function hashedFallbackPalette(brief: string): EnginePalette {
  const family = selectPaletteFamily(brief);
  const next = ensureAccessible(clonePalette(ENGINE_FAMILIES[family].palette));
  if (
    next.bg.toLowerCase() === FORBIDDEN_FALLBACK.bg &&
    next.accent.toLowerCase() === FORBIDDEN_FALLBACK.accent
  ) {
    return ensureAccessible(clonePalette(ENGINE_FAMILIES.glacier.palette));
  }
  return personalize(next, hashBrief(brief), {});
}

function personalize(
  palette: EnginePalette,
  seed: number,
  lock: { bg?: boolean; accent?: boolean },
): EnginePalette {
  let next = clonePalette(palette);
  if (!lock.accent) {
    const deg = 10 + (seed % 41);
    next.accent = rotateAccent(next.accent, deg);
  }
  if (!lock.bg) {
    const t = 0.04 + ((seed >> 4) % 7) / 80;
    const light = hexToOkLch(next.bg).L > 0.55;
    next.bg = light ? mixHex(next.bg, "#1a2430", t) : mixHex(next.bg, "#e8eef6", t);
    next.surface = light ? mixHex(next.surface, "#243044", t * 0.8) : mixHex(next.surface, "#ffffff", t);
  }
  return ensureAccessible(next, lock);
}

export function resolveAdaptivePalette(
  brief: string,
  opts?: { recent?: PaletteRecord[] },
): AdaptivePalette {
  const axes = extractBriefAxes(brief);
  const family = selectPaletteFamily(brief);
  const recipeRow = ENGINE_FAMILIES[family];
  const applied = applyUserColors(clonePalette(recipeRow.palette), brief);
  const seeded = personalize(applied.palette, hashBrief(brief), applied.lock);
  const palette = avoidRecent(seeded, opts?.recent, hashBrief(brief), applied.lock);
  return {
    family,
    axes,
    palette,
    userLock: applied.lock,
    dna: `${family} · ${recipeRow.fonts.display}/${recipeRow.fonts.body} · ${axes.domain}/${axes.tone}`,
  };
}

export function rememberPaletteList(current: PaletteRecord[] | undefined, next: PaletteRecord): PaletteRecord[] {
  const clean = sanitizePaletteHistory(current);
  return [
    ...clean,
    {
      bg: next.bg.toLowerCase(),
      surface: next.surface.toLowerCase(),
      accent: next.accent.toLowerCase(),
      family: next.family,
      at: next.at || Date.now(),
    },
  ].slice(-8);
}

export const PALETTE_CORPUS: { id: string; brief: string }[] = [
  { id: "repo-voci", brief: "FORMATO: app (kind=app)\nRepoVoci: registro delle voci di un repository, commit, rami, stato di sync e timeline/diff." },
  { id: "repo-luce", brief: "FORMATO: app (kind=app)\nRepoVoci luce: registro di repository in carta chiara, commit, rami e diff diurni." },
  { id: "clinica", brief: "FORMATO: app (kind=app)\nClinica Aurora: agenda di uno studio medico, pazienti, slot e terapie." },
  { id: "pulse", brief: "FORMATO: app (kind=app)\nPulse Radio: palinsesto live, playlist e impulsi di una radio notturna ad alta croma." },
  { id: "carta-luce", brief: "FORMATO: site (kind=site)\nCarta Luce: manuale di knowledge, documenti e wiki di studio in luce diurna." },
  { id: "pastello", brief: "FORMATO: app (kind=app)\nStudio Pastello: didattica e wellness, lezioni in pastello." },
  { id: "segnale", brief: "FORMATO: tool (kind=tool)\nSegnale Mono: strumento a contrasto alto, segnale unico, niente colore di mestiere." },
  { id: "essenza", brief: "FORMATO: app (kind=app)\nEssenza: gestione profumi premium, flaconi, note olfattive e guardaroba." },
  { id: "vesti", brief: "FORMATO: app (kind=app)\nVesti: moda e vendite, lookbook, capi in passerella e cassa." },
  { id: "locanda", brief: "FORMATO: app (kind=app)\nLocanda Pietra: prenotazioni di ospitalità, camere, reception e soggiorno in pietra." },
  { id: "osteria", brief: "FORMATO: app (kind=app)\nOsteria del Passo: ristorazione, menu degustazione, comande al passo cucina e sala da pranzo." },
  { id: "nord", brief: "FORMATO: dashboard (kind=dashboard)\nNord Ledger: cruscotto vendite, kpi di vendita, pipeline vendite e ledger commerciale." },
  { id: "carta", brief: "FORMATO: site (kind=site)\nAtelier Carta: portfolio editoriale, rivista di lastre fotografiche e rassegna di studio." },
  { id: "kiln", brief: "FORMATO: dashboard (kind=dashboard)\nKiln: cruscotto forno, ceramica, argilla e colate." },
  { id: "ice", brief: "FORMATO: app (kind=app)\nEssenza Vetro: gestione profumi premium, flaconi di vetro, note di ghiaccio e nebbia." },
  { id: "hotel", brief: "FORMATO: app (kind=app)\nHotel Notte: prenotazioni di ospitalità, suite, champagne e check-in in inchiostro di hotel." },
  { id: "crudo", brief: "FORMATO: app (kind=app)\nCrudo Mare: ristorazione di crudo, marmo, agrume ed erba di mare." },
  { id: "metro", brief: "FORMATO: tool (kind=tool)\nMetro in tasca: convertitore di misure, nastro millimetrato." },
  { id: "vesper", brief: "FORMATO: app (kind=app)\nVesper: timer di respiro, notte e meditazione." },
  { id: "orto", brief: "FORMATO: dashboard (kind=dashboard)\nOrto Flusso: cruscotto vendite, flusso ordini e harvest." },
  { id: "blu-navy", brief: "FORMATO: app (kind=app)\nAtlante Navy: app di carte nautiche, sfondo #0b1f3a, accento #2ec8c0." },
  { id: "rosa-studio", brief: "FORMATO: app (kind=app)\nAtelier Rosa: studio di disegno, accento rosa, carta chiara." },
];
