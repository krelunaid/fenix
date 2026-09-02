/**
 * Design tokens from the brief. Deterministic, 0 tokens, no LLM.
 * Families are distinct on hue, paper, accent and type — never one beige.
 */
import { contrastRatio } from "./visual-quality.ts";
import type { Palette } from "./types.ts";

export type TokenFamily =
  | "perfume"
  | "fashion"
  | "booking"
  | "ceramic"
  | "night"
  | "paper";

export type DesignTokens = {
  family: TokenFamily;
  mood: string;
  fonts: { display: string; body: string; href: string };
  radius: string;
  type: { h1: string; body: string; label: string };
  palette: Palette & {
    elevated: string;
    accentInk: string;
    success: string;
    warning: string;
  };
  dna: string;
  dont: string[];
};

const FAMILIES: Record<TokenFamily, Omit<DesignTokens, "family" | "dna">> = {
  perfume: {
    mood: "inchiostro, avorio, oro di flacone",
    fonts: {
      display: "Cormorant Garamond",
      body: "Outfit",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Outfit:wght@400;500;600&display=swap",
    },
    radius: "18px",
    type: { h1: "clamp(1.8rem, 6vw, 2.6rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#120e0c",
      surface: "#1d1714",
      elevated: "#2a211c",
      fg: "#f4ead8",
      muted: "#b7a48c",
      accent: "#c4a15a",
      line: "#3a3028",
      accentInk: "#120e0c",
      success: "#7d9a6a",
      warning: "#d08a4a",
    },
    dont: ["beige/terracotta da bottega", "tab Home/Nuovo/Elenco", "griglia 4 stat iPhone"],
  },
  fashion: {
    mood: "carta calda, inchiostro, carminio di sfilata",
    fonts: {
      display: "Playfair Display",
      body: "DM Sans",
      href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@500;700&display=swap",
    },
    radius: "2px",
    type: { h1: "clamp(1.7rem, 5vw, 2.4rem)", body: "15px", label: "10px uppercase tracking" },
    palette: {
      bg: "#f6f1ea",
      surface: "#fffdf8",
      elevated: "#ffffff",
      fg: "#161412",
      muted: "#6b645c",
      accent: "#c81d25",
      line: "#e4d9cc",
      accentInk: "#fffdf8",
      success: "#1f6f4a",
      warning: "#b45309",
    },
    dont: ["ledger da magazzino", "oro da profumo", "tab generiche"],
  },
  booking: {
    mood: "salvia, ottone, carta di studio",
    fonts: {
      display: "Newsreader",
      body: "Karla",
      href: "https://fonts.googleapis.com/css2?family=Karla:wght@400;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,650&display=swap",
    },
    radius: "14px",
    type: { h1: "clamp(1.6rem, 5vw, 2.2rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#eef3ea",
      surface: "#f7faf4",
      elevated: "#ffffff",
      fg: "#1a2a24",
      muted: "#5c6e64",
      accent: "#1f6f68",
      line: "#c9d6c8",
      accentInk: "#f7faf4",
      success: "#1f6f68",
      warning: "#b45309",
    },
    dont: ["carminio moda", "oro profumo", "terracotta da forno"],
  },
  ceramic: {
    mood: "calce, cotto, polvere di bottega",
    fonts: {
      display: "Fraunces",
      body: "Source Sans 3",
      href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap",
    },
    radius: "10px",
    type: { h1: "1.25rem", body: "16px", label: "11px uppercase tracking" },
    palette: {
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
    dont: ["grigio iPhone", "carminio moda", "oro da flacone"],
  },
  night: {
    mood: "inchiostro di notte, ottone freddo",
    fonts: {
      display: "Syne",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Syne:wght@600;700&display=swap",
    },
    radius: "8px",
    type: { h1: "clamp(1.5rem, 5vw, 2.2rem)", body: "16px", label: "11px uppercase" },
    palette: {
      bg: "#0b0d12",
      surface: "#151821",
      elevated: "#1e2330",
      fg: "#e8e4d8",
      muted: "#9aa0b0",
      accent: "#6b8cff",
      line: "#2a3142",
      accentInk: "#0b0d12",
      success: "#5aa87a",
      warning: "#d08a4a",
    },
    dont: ["beige da forno", "viola AI", "SF Pro + blu sistema"],
  },
  paper: {
    mood: "carta da lettera, inchiostro verde",
    fonts: {
      display: "Literata",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Literata:opsz,wght@7..72,500;7..72,700&display=swap",
    },
    radius: "6px",
    type: { h1: "clamp(1.5rem, 5vw, 2.3rem)", body: "16px", label: "11px uppercase" },
    palette: {
      bg: "#f7f2e8",
      surface: "#fffaf0",
      elevated: "#ffffff",
      fg: "#1c1712",
      muted: "#6a5e52",
      accent: "#2c4a3e",
      line: "#d7ccba",
      accentInk: "#fffaf0",
      success: "#2c4a3e",
      warning: "#b45309",
    },
    dont: ["terracotta da forno", "carminio moda", "griglia iPhone"],
  },
};

const PRODUCT: { family: TokenFamily; re: RegExp }[] = [
  { family: "perfume", re: /profum|fragran|essenze|parfum|olfatt|flacone|eau de/i },
  { family: "fashion", re: /moda|sfilata|abiti|lookbook|boutique|atelier di moda|vendite di/i },
  { family: "booking", re: /prenot|appuntament|trattament|booking/i },
  { family: "ceramic", re: /ceram|fornace|argilla|terracotta|kiln|colata|grottaglie|forno/i },
  { family: "night", re: /timer|respiro|notte|vesper|meditaz/i },
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

export function familyFromBrief(brief: string): TokenFamily {
  const p = String(brief || "");
  for (const row of PRODUCT) {
    if (row.re.test(p)) return row.family;
  }
  const keys: TokenFamily[] = ["paper", "night", "ceramic"];
  return keys[hashBrief(p) % keys.length]!;
}

export function tokensFromBrief(brief: string): DesignTokens {
  const family = familyFromBrief(brief);
  const src = FAMILIES[family];
  const palette = { ...src.palette };
  if (contrastRatio(palette.fg, palette.bg) < 4.5) {
    palette.fg = family === "perfume" || family === "night" ? "#f7f1e4" : "#161412";
  }
  const dna = `${family} · ${src.fonts.display}/${src.fonts.body} · anti-clone`;
  return {
    family,
    mood: src.mood,
    fonts: { ...src.fonts },
    radius: src.radius,
    type: { ...src.type },
    palette,
    dna: dna.slice(0, 80),
    dont: [...src.dont],
  };
}

export function tokensInstruction(tokens: DesignTokens): string {
  const p = tokens.palette;
  return [
    `DIREZIONE PREMIUM (legge, dal brief, famiglia ${tokens.family}):`,
    `mood: ${tokens.mood}`,
    `font: ${tokens.fonts.display} + ${tokens.fonts.body}`,
    `raggio: ${tokens.radius}`,
    `token: --bg ${p.bg} --surface ${p.surface} --elevated ${p.elevated} --fg ${p.fg} --muted ${p.muted} --accent ${p.accent} --line ${p.line} --accent-ink ${p.accentInk}`,
    "Copia questi hex in :root. Non sostituirli con beige/terracotta se la famiglia non è ceramic.",
    `Vietato per questo brief: ${tokens.dont.join("; ")}.`,
    "Qualità nativa da tasca consentita (tipo, ritmo 8px, profondità, materiali, motion ridotto). Vietato clonare schermate, marchi, SF Symbols o la coppia #f5f5f7+#0071e3.",
  ].join("\n");
}

export function hueBucket(hex: string): number {
  const h = hex.replace("#", "").trim();
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.02) return 360;
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

export const TOKEN_FAMILIES = FAMILIES;
