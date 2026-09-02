/**
 * Design tokens from the brief. Deterministic, 0 tokens, no LLM.
 * Families are distinct on hue, paper, accent and type — never one beige.
 * Product families also have two keyword-driven variants.
 */
import { contrastRatio } from "./visual-quality.ts";
import type { Palette } from "./types.ts";

export type TokenFamily =
  | "perfume"
  | "fashion"
  | "booking"
  | "ceramic"
  | "night"
  | "paper"
  | "ops"
  | "utility";

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
};

type FamilySrc = Omit<DesignTokens, "family" | "dna" | "variant">;

const FAMILIES: Record<TokenFamily, FamilySrc> = {
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
  ops: {
    mood: "inchiostro nordico, ottone, carta di ledger",
    fonts: {
      display: "Source Serif 4",
      body: "Atkinson Hyperlegible",
      href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,700&display=swap",
    },
    radius: "8px",
    type: { h1: "clamp(1.45rem, 4vw, 2rem)", body: "15px", label: "11px uppercase tracking" },
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
    type: { h1: "clamp(1.55rem, 5vw, 2.15rem)", body: "16px", label: "11px uppercase tracking" },
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
};

const PRODUCT: { family: TokenFamily; re: RegExp }[] = [
  { family: "perfume", re: /profum|fragran|essenze|parfum|olfatt|flacone|eau de/i },
  { family: "fashion", re: /moda|sfilata|abiti|lookbook|boutique|atelier di moda|vendite di/i },
  { family: "booking", re: /prenot|appuntament|trattament|booking/i },
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
  const keys: TokenFamily[] = ["paper", "night", "ceramic"];
  return keys[hashBrief(p) % keys.length]!;
}

export function variantFromBrief(brief: string): 0 | 1 {
  const p = String(brief || "").toLowerCase();
  const family = familyFromBrief(brief);
  if (family === "perfume") return /nebbia|vetro|ghiaccio|frost/.test(p) ? 1 : 0;
  if (family === "fashion") return /osso|avorio|latte|bone/.test(p) ? 1 : 0;
  if (family === "booking") return /lino|tessile|tessuto|studio lino/.test(p) ? 1 : 0;
  if (family === "ops") return /orto|harvest|flusso ordini|orto flusso/.test(p) ? 1 : 0;
  if (family === "utility") return /metro tasca|metro in tasca|nastro millimetr/.test(p) ? 1 : 0;
  return 0;
}

export function isProductFamily(family: TokenFamily | "unknown"): boolean {
  return (
    family === "perfume" ||
    family === "fashion" ||
    family === "booking" ||
    family === "ops" ||
    family === "utility"
  );
}

export function tokensFromBrief(brief: string): DesignTokens {
  const family = familyFromBrief(brief);
  const variant = variantFromBrief(brief);
  const src = variant === 1 && VARIANTS[family] ? VARIANTS[family]! : FAMILIES[family];
  const palette = { ...src.palette };
  if (contrastRatio(palette.fg, palette.bg) < 4.5) {
    palette.fg = family === "perfume" || family === "night" || family === "ops" || (family === "utility" && variant === 1) || (family === "fashion" && variant === 1)
      ? "#f7f1e4"
      : "#161412";
  }
  const dna = `${family}${variant ? `/v${variant}` : ""} · ${src.fonts.display}/${src.fonts.body} · anti-clone`;
  return {
    family,
    variant,
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
    `DIREZIONE PREMIUM (legge, dal brief, famiglia ${tokens.family}${tokens.variant ? ` variante ${tokens.variant}` : ""}):`,
    `mood: ${tokens.mood}`,
    `font: ${tokens.fonts.display} + ${tokens.fonts.body}`,
    `raggio: ${tokens.radius}`,
    `token: --bg ${p.bg} --surface ${p.surface} --elevated ${p.elevated} --fg ${p.fg} --muted ${p.muted} --accent ${p.accent} --line ${p.line} --accent-ink ${p.accentInk}`,
    "Copia questi hex in :root. Non sostituirli con beige/terracotta se la famiglia non è ceramic.",
    `Vietato per questo brief: ${tokens.dont.join("; ")}.`,
    "Qualità nativa da tasca consentita (tipo, ritmo 8px, profondità, materiali, motion ridotto). Vietato clonare schermate, marchi, SF Symbols o la coppia #f5f5f7+#0071e3.",
    "Desktop/tablet: griglia editoriale a tutta larghezza, niente canvas boxed 1080px, niente dead zone, sidebar non sproporzionata. Imagery di dominio originale (data-imagery=domain), alt/aria-label, niente placeholder geometrici o hotlink.",
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
