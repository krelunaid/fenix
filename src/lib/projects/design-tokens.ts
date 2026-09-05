/**
 * Design tokens from the brief. Deterministic, 0 tokens, no LLM.
 * Families are distinct on hue, paper, accent and type — never one beige.
 * Product families also have two keyword-driven variants.
 * Unknown briefs go through the adaptive palette engine, never #101114.
 */
import { contrastRatio } from "./visual-quality.ts";
import type { Palette } from "./types.ts";
import {
  applyUserColors,
  avoidRecent,
  classifyPalette,
  CLOSE_DELTA_E,
  ENGINE_FAMILIES,
  ensureAccessible,
  extractBriefAxes,
  extractUserColors,
  hashedFallbackPalette,
  paletteDistance,
  resolveAdaptivePalette,
  selectPaletteFamily,
  type EnginePalette,
  type PaletteFamily,
  type PaletteRecord,
} from "./palette-engine.ts";
import { applyGraphicIntent, graphicIntentFromBrief } from "./graphic-intent.ts";
import { enrichWaterOpsPalette } from "./water-ops-palette.ts";
import { enrichMarketPalette } from "./market-ops-palette.ts";
import { enrichLuxePalette } from "./luxe-ops-palette.ts";
import { isLuxeBrief, isMarketplaceBrief } from "./app-identity.ts";

export type TokenFamily =
  | "perfume"
  | "fashion"
  | "booking"
  | "hospitality"
  | "food"
  | "editorial"
  | "ceramic"
  | "night"
  | "paper"
  | "ops"
  | "utility"
  | "repo";

export type DesignTokens = {
  family: TokenFamily;
  variant: 0 | 1;
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
  chroma: PaletteFamily;
};

export type TokenOptions = {
  recent?: PaletteRecord[];
};

type FamilySrc = Omit<DesignTokens, "family" | "dna" | "variant" | "chroma">;

const FAMILIES: Record<TokenFamily, FamilySrc> = {
  perfume: {
    mood: "inchiostro, avorio, oro di flacone",
    fonts: {
      display: "Cormorant Garamond",
      body: "Outfit",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600;1,700&family=Outfit:wght@400;500;600&display=swap",
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
    mood: "carta operativa, teal di studio, tipo da tasca",
    fonts: {
      display: "Figtree",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap",
    },
    radius: "10px",
    type: { h1: "2.125rem", body: "17px", label: "13px" },
    palette: {
      bg: "#e8eef4",
      surface: "#ffffff",
      elevated: "#f4f7fa",
      fg: "#1c242c",
      muted: "#5c6b75",
      accent: "#1f6f68",
      line: "#d3dce4",
      accentInk: "#f4f7fa",
      success: "#1f6f68",
      warning: "#b45309",
    },
    dont: ["carminio moda", "oro profumo", "terracotta da forno", "serif da rivista", "Georgia da display"],
  },
  hospitality: {
    mood: "pietra di locanda, bosco, ottone di reception",
    fonts: {
      display: "Fraunces",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap",
    },
    radius: "12px",
    type: { h1: "clamp(1.7rem, 5vw, 2.4rem)", body: "16px", label: "13px sentence, no tracking shout" },
    palette: {
      bg: "#e7e0d2",
      surface: "#f4efe4",
      elevated: "#fffaf1",
      fg: "#1f2a24",
      muted: "#5e6a62",
      accent: "#1f4a3e",
      line: "#d2c6b4",
      accentInk: "#f4efe4",
      success: "#1f4a3e",
      warning: "#b45309",
    },
    dont: ["salvia da parrucchiere", "tab Home/Nuovo", "beige da forno"],
  },
  food: {
    mood: "carbone di cucina, vino, zafferano di passa",
    fonts: {
      display: "Zilla Slab",
      body: "Source Sans 3",
      href: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Zilla+Slab:wght@500;700&display=swap",
    },
    radius: "8px",
    type: { h1: "clamp(1.6rem, 5vw, 2.3rem)", body: "16px", label: "13px slab, no uppercase" },
    palette: {
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
    dont: ["beige da forno", "hero da boutique", "tab iPhone"],
  },
  editorial: {
    mood: "carta da rivista, inchiostro, rame da lastre",
    fonts: {
      display: "Literata",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Literata:opsz,wght@7..72,500;7..72,700&display=swap",
    },
    radius: "0px",
    type: { h1: "clamp(2rem, 7vw, 3.4rem)", body: "17px", label: "11px uppercase tracking" },
    palette: {
      bg: "#f3efe6",
      surface: "#fffdf8",
      elevated: "#ffffff",
      fg: "#1a1814",
      muted: "#6a5e52",
      accent: "#9a4a28",
      line: "#ddd4c6",
      accentInk: "#fffdf8",
      success: "#2c4a3e",
      warning: "#b45309",
    },
    dont: ["tab Home/Nuovo", "griglia iPhone", "terracotta da forno"],
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
  ops: {
    mood: "inchiostro nordico, ottone, carta di ledger",
    fonts: {
      display: "IBM Plex Sans",
      body: "Atkinson Hyperlegible",
      href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
    },
    radius: "6px",
    type: { h1: "clamp(1.35rem, 3.4vw, 1.85rem)", body: "14px", label: "10px tabular, short tracking" },
    palette: {
      bg: "#10151c",
      surface: "#171e28",
      elevated: "#1f2834",
      fg: "#e7e1d4",
      muted: "#9aa3ad",
      accent: "#d4a017",
      line: "#2a3442",
      accentInk: "#10151c",
      success: "#5aa87a",
      warning: "#d08a4a",
    },
    dont: ["hero da boutique", "tab Home/Nuovo", "beige da forno"],
  },
  utility: {
    mood: "carta da taglio, inchiostro, segno di registro",
    fonts: {
      display: "Archivo",
      body: "Public Sans",
      href: "https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Public+Sans:wght@400;600&display=swap",
    },
    radius: "8px",
    type: { h1: "clamp(1.5rem, 5vw, 2.1rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#f6f3ee",
      surface: "#fffcf7",
      elevated: "#ffffff",
      fg: "#1b1814",
      muted: "#6a645c",
      accent: "#d6452d",
      line: "#e4ddd2",
      accentInk: "#fffcf7",
      success: "#2f6b4a",
      warning: "#b45309",
    },
    dont: ["sfilata carminio", "flacone oro", "admin da magazzino"],
  },
  repo: {
    mood: "terminale, ciano freddo, carta di commit",
    fonts: {
      display: "IBM Plex Mono",
      body: "IBM Plex Sans",
      href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
    },
    radius: "6px",
    type: { h1: "clamp(1.3rem, 3vw, 1.75rem)", body: "14px", label: "11px tabular" },
    palette: ENGINE_FAMILIES["ink-terminal"].palette,
    dont: ["hero grigio + 2 KPI", "serif da rivista", "terracotta", "clone GitHub"],
  },
};

const VARIANTS: Partial<Record<TokenFamily, FamilySrc>> = {
  perfume: {
    mood: "vetro di nebbia, acciaio freddo, carta ghiaccio",
    fonts: {
      display: "Spectral",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Spectral:wght@500;700&display=swap",
    },
    radius: "4px",
    type: { h1: "clamp(1.7rem, 5.5vw, 2.5rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#f3f5f8",
      surface: "#ffffff",
      elevated: "#e8eef3",
      fg: "#12202c",
      muted: "#5c6d7a",
      accent: "#1a3a52",
      line: "#cfd8e0",
      accentInk: "#f3f5f8",
      success: "#2f6b4a",
      warning: "#b45309",
    },
    dont: ["oro da maison", "beige da forno", "tab generiche"],
  },
  fashion: {
    mood: "osso, inchiostro, atelier su carta",
    fonts: {
      display: "Bodoni Moda",
      body: "Jost",
      href: "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,700&family=Jost:wght@400;600&display=swap",
    },
    radius: "0px",
    type: { h1: "clamp(1.7rem, 5vw, 2.5rem)", body: "15px", label: "10px uppercase tracking" },
    palette: {
      bg: "#1a1614",
      surface: "#241f1c",
      elevated: "#2e2824",
      fg: "#f3ece3",
      muted: "#b2a79b",
      accent: "#c9b496",
      line: "#3a332e",
      accentInk: "#1a1614",
      success: "#6a9a74",
      warning: "#d08a4a",
    },
    dont: ["carminio da passerella", "oro da flacone", "tab generiche"],
  },
  booking: {
    mood: "lino crudo, terracotta chiara, ombra di studio",
    fonts: {
      display: "Libre Caslon Text",
      body: "Red Hat Text",
      href: "https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:wght@400;700&family=Red+Hat+Text:wght@400;600&display=swap",
    },
    radius: "6px",
    type: { h1: "1.75rem", body: "17px", label: "13px" },
    palette: {
      bg: "#f4efe4",
      surface: "#fffaf1",
      elevated: "#ffffff",
      fg: "#2a2118",
      muted: "#6e6256",
      accent: "#8a4b2e",
      line: "#e0d4c4",
      accentInk: "#fffaf1",
      success: "#3d5a1f",
      warning: "#b45309",
    },
    dont: ["salvia da sala", "carminio moda", "admin da forno"],
  },
  hospitality: {
    mood: "inchiostro di hotel, champagne, ottone freddo",
    fonts: {
      display: "Cinzel",
      body: "Karla",
      href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Karla:wght@400;600&display=swap",
    },
    radius: "4px",
    type: { h1: "clamp(1.7rem, 5vw, 2.5rem)", body: "16px", label: "12px letter, no shout" },
    palette: {
      bg: "#12151c",
      surface: "#1a1f28",
      elevated: "#242a36",
      fg: "#f0e6d4",
      muted: "#a8a094",
      accent: "#d4c4a0",
      line: "#2c3340",
      accentInk: "#12151c",
      success: "#2a6f73",
      warning: "#d08a4a",
    },
    dont: ["pietra da locanda", "tab iPhone", "beige da forno"],
  },
  food: {
    mood: "marmo di crudo, agrume, erba di mare",
    fonts: {
      display: "Newsreader",
      body: "Outfit",
      href: "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,700&family=Outfit:wght@400;600&display=swap",
    },
    radius: "16px",
    type: { h1: "clamp(1.6rem, 5vw, 2.3rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#eef3f6",
      surface: "#ffffff",
      elevated: "#e4eef2",
      fg: "#12202c",
      muted: "#5c6d7a",
      accent: "#2f6b4a",
      line: "#cfdbe0",
      accentInk: "#eef3f6",
      success: "#2f6b4a",
      warning: "#e25c2a",
    },
    dont: ["carbone da trattoria", "vino rosso", "beige da forno"],
  },
  editorial: {
    mood: "studio di notte, argento, segnale rosso",
    fonts: {
      display: "Syne",
      body: "Figtree",
      href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Syne:wght@600;700&display=swap",
    },
    radius: "0px",
    type: { h1: "clamp(2rem, 7vw, 3.2rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#0e1014",
      surface: "#16181e",
      elevated: "#1e2128",
      fg: "#e8e6df",
      muted: "#9aa0b0",
      accent: "#c81d25",
      line: "#2a2e38",
      accentInk: "#0e1014",
      success: "#5aa87a",
      warning: "#d08a4a",
    },
    dont: ["carta da rivista", "rame da lastre", "tab iPhone"],
  },
  ops: {
    mood: "orto, carta verde, inchiostro di raccolto",
    fonts: {
      display: "Lora",
      body: "Libre Franklin",
      href: "https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;700&family=Lora:wght@500;700&display=swap",
    },
    radius: "10px",
    type: { h1: "clamp(1.4rem, 4vw, 1.9rem)", body: "15px", label: "11px uppercase tracking" },
    palette: {
      bg: "#e7efe2",
      surface: "#f4f8f0",
      elevated: "#ffffff",
      fg: "#1c2a18",
      muted: "#5c6e54",
      accent: "#3d5a1f",
      line: "#c9d6c0",
      accentInk: "#f4f8f0",
      success: "#3d5a1f",
      warning: "#b45309",
    },
    dont: ["mustard da ledger", "hero da boutique", "tab iPhone"],
  },
  utility: {
    mood: "nastro millimetrato, ottone, tasca nera",
    fonts: {
      display: "Oswald",
      body: "Work Sans",
      href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Work+Sans:wght@400;600&display=swap",
    },
    radius: "4px",
    type: { h1: "clamp(1.45rem, 5vw, 2rem)", body: "16px", label: "11px uppercase tracking" },
    palette: {
      bg: "#111318",
      surface: "#191c24",
      elevated: "#232734",
      fg: "#e8e4d8",
      muted: "#9aa0b0",
      accent: "#6ec8b8",
      line: "#2c3140",
      accentInk: "#111318",
      success: "#6ec8b8",
      warning: "#d08a4a",
    },
    dont: ["coral da taglio", "sfilata", "beige da forno"],
  },
  repo: {
    mood: "carta diurna, inchiostro elettrico, voci in luce",
    fonts: {
      display: "Source Serif 4",
      body: "Source Sans 3",
      href: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap",
    },
    radius: "4px",
    type: { h1: "clamp(1.4rem, 3.4vw, 2rem)", body: "15px", label: "11px tabular" },
    palette: ENGINE_FAMILIES["luminous-paper"].palette,
    dont: ["nero/terracotta", "hero KPI", "clone GitHub"],
  },
};

const PRODUCT: { family: TokenFamily; re: RegExp }[] = [
  { family: "repo", re: /repovoci|voci del repo|\brepository\b|\brepo\b|commit|branch|\bgit\b|pull request|\bdiff\b|sync del repo/i },
  { family: "perfume", re: /profum|fragran|essenze|parfum|olfatt|flacone|eau de/i },
  { family: "fashion", re: /moda|sfilata|abiti|lookbook|boutique|atelier di moda|vendite di/i },
  { family: "hospitality", re: /ospital|locanda|albergo|\bhotel\b|reception|camera doppia|soggiorno in|check-?in/i },
  { family: "food", re: /ristor|trattoria|osteria|brasserie|chef|cucina di|menu degust|sala da pranzo|\bfood\b|passo cucina/i },
  { family: "editorial", re: /editoriale|rivista di|magazine di|studio fotograf|lastre fotografic| rassegna |portfolio di lastre/i },
  { family: "booking", re: /prenot|appuntament|trattament|booking|parrucchier|barbiere|barbieri|\bbarber(?:\s*shop)?\b|\bhair\s*salon\b/i },
  { family: "ceramic", re: /ceram|fornace|argilla|terracotta|kiln|colata|grottaglie|forno/i },
  { family: "ops", re: /nord ledger|orto flusso|kpi di vendita|pipeline vendite|flusso ordini|cruscotto vendite|ledger commerciale/i },
  { family: "utility", re: /taglia foto|ritaglio|metro in tasca|metro tasca|convertitore di misure|misure in tasca/i },
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

export function briefSeed(brief: string): number {
  return hashBrief(brief);
}

export function familyFromBrief(brief: string): TokenFamily {
  const p = String(brief || "");
  for (const row of PRODUCT) {
    if (row.re.test(p)) return row.family;
  }
  const chroma = selectPaletteFamily(p);
  if (chroma === "earth-kiln") return "ceramic";
  if (chroma === "ink-terminal" || chroma === "chroma-pulse" || chroma === "wine-ink") return "night";
  if (
    chroma === "luminous-paper" ||
    chroma === "glacier" ||
    chroma === "pastel-studio" ||
    chroma === "mono-signal"
  ) {
    return "paper";
  }
  const keys: TokenFamily[] = ["paper", "night"];
  return keys[hashBrief(p) % keys.length]!;
}

export function variantFromBrief(brief: string): 0 | 1 {
  const p = String(brief || "").toLowerCase();
  const family = familyFromBrief(brief);
  if (family === "perfume") return /nebbia|vetro|ghiaccio|frost/.test(p) ? 1 : 0;
  if (family === "fashion") return /osso|avorio|latte|bone/.test(p) ? 1 : 0;
  if (family === "booking") return /lino|tessile|tessuto|studio lino/.test(p) ? 1 : 0;
  if (family === "hospitality") return /notte|champagne|inchiostro di hotel|suite/.test(p) ? 1 : 0;
  if (family === "food") return /crudo|marmo|agrume|erba di mare/.test(p) ? 1 : 0;
  if (family === "editorial") return /notte|argento|segnale|studio di notte/.test(p) ? 1 : 0;
  if (family === "ops") return /orto|harvest|flusso ordini|orto flusso/.test(p) ? 1 : 0;
  if (family === "utility") return /metro tasca|metro in tasca|nastro millimetr/.test(p) ? 1 : 0;
  if (family === "repo") return /luce|luminos|daylight|carta chiara|paper/.test(p) ? 1 : 0;
  return 0;
}

export function isProductFamily(family: TokenFamily | "unknown"): boolean {
  return (
    family === "perfume" ||
    family === "fashion" ||
    family === "booking" ||
    family === "hospitality" ||
    family === "food" ||
    family === "editorial" ||
    family === "ops" ||
    family === "utility" ||
    family === "repo"
  );
}

function asEngine(p: FamilySrc["palette"]): EnginePalette {
  return {
    bg: p.bg,
    surface: p.surface,
    fg: p.fg,
    muted: p.muted,
    accent: p.accent,
    line: p.line || "#3d3428",
    elevated: p.elevated,
    accentInk: p.accentInk,
    success: p.success,
    warning: p.warning,
  };
}

function mixHexLocal(a: string, b: string, t: number): string {
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

/** Adaptive SYSTEM sheet. Not a single petrol, not Apple SET, AA on chrome. */
function finishSystemSheet(tokens: DesignTokens, brief: string, recent?: PaletteRecord[]): DesignTokens {
  const intent = graphicIntentFromBrief(brief);
  if (intent.type !== "system") return tokens;
  if (isProductFamily(tokens.family) && tokens.family !== "repo") return tokens;
  const user = extractUserColors(brief);
  const lock = { bg: Boolean(user.bg), accent: Boolean(user.accent) };
  let palette: EnginePalette = { ...tokens.palette };
  if (!lock.bg && !lock.accent) {
    const apple =
      palette.bg.toLowerCase() === "#f5f5f7" && palette.accent.toLowerCase() === "#0071e3";
    const chroma = classifyPalette(palette);
    const warm = chroma === "earth-kiln" || chroma === "wine-ink";
    const cool: PaletteFamily[] = [
      "glacier",
      "luminous-paper",
      "ink-terminal",
      "mono-signal",
      "chroma-pulse",
      "pastel-studio",
    ];
    if (apple || warm) {
      const fam = cool[briefSeed(brief) % cool.length]!;
      palette = { ...ENGINE_FAMILIES[fam].palette };
    }
    palette = avoidRecent(palette, recent, briefSeed(brief), lock);
    let step = 0;
    const rec = recent || [];
    const clashes = (p: EnginePalette) =>
      rec.some((row) => {
        const self = { bg: p.bg, surface: p.surface, accent: p.accent };
        return row.bg.toLowerCase() === p.bg.toLowerCase() || paletteDistance(self, row) < CLOSE_DELTA_E;
      });
    while (rec.length && !lock.bg && clashes(palette) && step < cool.length) {
      const fam = cool[(briefSeed(brief) + step + 1) % cool.length]!;
      palette = avoidRecent({ ...ENGINE_FAMILIES[fam].palette }, rec, briefSeed(brief) + step * 19, lock);
      step += 1;
    }
  }
  palette = ensureAccessible(palette, lock);
  let guard = 0;
  while (contrastRatio(palette.muted, palette.bg) < 4.5 && guard < 10) {
    palette.muted = mixHexLocal(palette.muted, palette.fg, 0.2);
    guard += 1;
  }
  return { ...tokens, palette, chroma: classifyPalette(palette) };
}

const LUXE_FONTS = {
  display: "Fraunces",
  body: "Figtree",
  href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap",
};

function finishFieldSheet(tokens: DesignTokens, brief: string): DesignTokens {
  let palette = enrichWaterOpsPalette(brief, tokens.palette);
  palette = enrichMarketPalette(brief, palette);
  palette = enrichLuxePalette(brief, palette);
  const luxe = isLuxeBrief(brief);
  const radius = isMarketplaceBrief(brief) ? "24px" : luxe ? "20px" : tokens.radius;
  const fonts = luxe ? LUXE_FONTS : tokens.fonts;
  const type = luxe ? { h1: "2.4rem", body: "16px", label: "13px" } : tokens.type;
  if (palette === tokens.palette && radius === tokens.radius && fonts === tokens.fonts) return tokens;
  return { ...tokens, palette, radius, fonts, type, chroma: classifyPalette(palette) };
}

export function tokensFromBrief(brief: string, opts?: TokenOptions): DesignTokens {
  const family = familyFromBrief(brief);
  const variant = variantFromBrief(brief);
  const product = isProductFamily(family) && family !== "repo";
  if (!product && family !== "ceramic") {
    const adaptive = resolveAdaptivePalette(brief, { recent: opts?.recent });
    const recipe = ENGINE_FAMILIES[adaptive.family];
    const srcFamily: TokenFamily =
      family === "repo" ? "repo" : family;
    const repoSrc = family === "repo" ? (variant === 1 && VARIANTS.repo ? VARIANTS.repo : FAMILIES.repo) : null;
    const fonts = family === "repo" && repoSrc ? repoSrc.fonts : recipe.fonts;
    const mood = family === "repo" && repoSrc ? repoSrc.mood : recipe.mood;
    const radius = family === "repo" && repoSrc ? repoSrc.radius : recipe.radius;
    const type = family === "repo" && repoSrc ? repoSrc.type : recipe.type;
    const dont = family === "repo" && repoSrc ? repoSrc.dont : recipe.dont;
    const dna = `${srcFamily}${variant ? `/v${variant}` : ""} · ${adaptive.family} · ${fonts.display}/${fonts.body} · anti-clone`;
    return finishFieldSheet(
      finishSystemSheet(
        applyGraphicIntent(
          {
            family: srcFamily,
            variant,
            mood,
            fonts: { ...fonts },
            radius,
            type: { ...type },
            palette: adaptive.palette,
            dna: dna.slice(0, 80),
            dont: [...dont],
            chroma: adaptive.family,
          },
          brief,
        ),
        brief,
        opts?.recent,
      ),
      brief,
    );
  }
  const src = variant === 1 && VARIANTS[family] ? VARIANTS[family]! : FAMILIES[family];
  // Colors stay on the domain recipe + explicit user locks. A shop name
  // (barber, salon, …) is not a palette and must not inject a house accent.
  const applied = applyUserColors(asEngine(src.palette), brief);
  let palette = avoidRecent(applied.palette, opts?.recent, hashBrief(brief), applied.lock);
  palette = ensureAccessible(palette, applied.lock);
  if (contrastRatio(palette.fg, palette.bg) < 4.5) {
    palette.fg =
      family === "perfume" ||
      family === "ops" ||
      (family === "food" && variant === 0) ||
      (family === "editorial" && variant === 1) ||
      (family === "hospitality" && variant === 1) ||
      (family === "utility" && variant === 1) ||
      (family === "fashion" && variant === 1)
        ? "#f7f1e4"
        : "#161412";
  }
  const chroma = classifyPalette(palette);
  const dna = `${family}${variant ? `/v${variant}` : ""} · ${src.fonts.display}/${src.fonts.body} · anti-clone`;
  return finishFieldSheet(
    finishSystemSheet(
      applyGraphicIntent(
        {
          family,
          variant,
          mood: src.mood,
          fonts: { ...src.fonts },
          radius: src.radius,
          type: { ...src.type },
          palette,
          dna: dna.slice(0, 80),
          dont: [...src.dont],
          chroma,
        },
        brief,
      ),
      brief,
      opts?.recent,
    ),
    brief,
  );
}

export function fallbackPaletteFromBrief(brief: string): Palette {
  const p = hashedFallbackPalette(brief);
  return { bg: p.bg, surface: p.surface, fg: p.fg, muted: p.muted, accent: p.accent, line: p.line };
}

export function tokensInstruction(tokens: DesignTokens, brief = ""): string {
  const p = tokens.palette;
  const axes = extractBriefAxes(tokens.dna);
  const intent = graphicIntentFromBrief(brief);
  const typeLaw =
    intent.type === "system"
      ? "Tipo: system-ui/-apple-system/Segoe UI è il PRIMARIO (non in coda). Non nominare SF Pro. Non clonare la coppia #f5f5f7+#0071e3. Palette dal motore adattivo + history, non un unico verde petrolio #125e57 né #eceff3 fisso. Hex espliciti del brief restano (solo correzione AA)."
      : intent.type === "serif"
        ? `Tipo: display serif ${tokens.fonts.display} è legge. Non sostituirlo con system-ui, Inter o Manrope.`
        : "Tipo: font del mestiere, system (-apple-system, BlinkMacSystemFont, Segoe UI) solo in coda. Vietato SF Pro/Inter come primario se il brief non li chiede. Vietato clonare schermate, marchi, SF Symbols o la coppia #f5f5f7+#0071e3.";
  const chromeLaw =
    intent.chrome === "semantic"
      ? "Icone: se il brief chiede Home/Aggiungi/Persona, usale (path originali). Non sostituirle solo perché comuni."
      : "Icone: pittogrammi del mestiere. Qualità nativa da tasca consentita (tipo, ritmo 8px, profondità, materiali, motion ridotto).";
  return [
    `DIREZIONE PREMIUM (legge, dal brief, famiglia ${tokens.family}${tokens.variant ? ` variante ${tokens.variant}` : ""} · chroma ${tokens.chroma}):`,
    `mood: ${tokens.mood}`,
    `font: ${tokens.fonts.display} + ${tokens.fonts.body}`,
    `raggio: ${tokens.radius}`,
    `token: --bg ${p.bg} --surface ${p.surface} --elevated ${p.elevated} --fg ${p.fg} --muted ${p.muted} --accent ${p.accent} --line ${p.line} --accent-ink ${p.accentInk}`,
    "Copia questi hex in :root. Non sostituirli con beige/terracotta se la famiglia non è ceramic. Vietato cadere su #101114/#191b20/#e1693f.",
    `Vietato per questo brief: ${tokens.dont.join("; ")}.`,
    typeLaw,
    chromeLaw,
    tokens.family === "repo"
      ? "Dominio repository: attività commit, rami, stato sync, timeline/diff. Vietato home universale con hero grigio + due KPI + CTA + empty card. Non copiare GitHub."
      : tokens.family === "booking" && intent.type !== "system"
        ? "Dominio agenda: binario orario, tab Oggi/Nuovo/Settimana/Archivio, tipo 17/headline da tasca (sans operativa, non serif da rivista), icone griglia 24, target 44px. Vietato hero KPI e tab Home/Elenco."
        : `Asse dominio=${axes.domain}.`,
    "Desktop/tablet: grammatica editoriale a tutta larghezza (split-stage, lookbook, agenda, passo cucina, magazine, ops-desk, source-timeline). Niente canvas boxed 1080px, niente dead zone, niente telefono al centro. Imagery di dominio originale (data-imagery=domain), alt/aria-label, niente placeholder geometrici o hotlink.",
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
