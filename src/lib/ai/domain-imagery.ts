/**
 * Repository-native domain imagery. Original SVG, licensed, no Apple/Emergent
 * assets, no hotlink. Generation-time only — audit of stored HTML must not
 * call these injectors or legacy geometric fixtures would start passing.
 */
import {
  familyFromBrief,
  isProductFamily,
  variantFromBrief,
  type TokenFamily,
} from "../projects/design-tokens.ts";

export type ImageryProvenance = {
  id: string;
  family: TokenFamily;
  variant: 0 | 1;
  license: "CC0";
  source: "repository-native SVG originale Fenix";
  year: 2026;
  subject: string;
  notes: string;
};

export const DOMAIN_IMAGERY_PROVENANCE: ImageryProvenance[] = [
  { id: "svg-perfume-0", family: "perfume", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "flacone in vetro scuro e tappo oro", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-perfume-1", family: "perfume", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cilindro di vetro ghiaccio e nebbia", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-fashion-0", family: "fashion", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cappotto sartoriale con bavero, maniche e fodera carminio", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Capi riconoscibili, non sagome." },
  { id: "svg-fashion-1", family: "fashion", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "abito colonna in osso con cuciture, pieghe e manichino", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Capi riconoscibili, non sagome." },
  { id: "svg-booking-0", family: "booking", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "sala con poltrona, finestra e orologio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-booking-1", family: "booking", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "tavolo da taglio, lino e forbici", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-ops-0", family: "ops", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "ledger, barre e finestra nord", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-ops-1", family: "ops", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cassette di raccolto e andamento", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-utility-0", family: "utility", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "forbici e crocini di taglio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-utility-1", family: "utility", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "nastro millimetrato in tasca", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-hospitality-0", family: "hospitality", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "camera in pietra, letto e finestra sul pozzo", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-hospitality-1", family: "hospitality", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "suite d'hotel, lampada oro e champagne", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-food-0", family: "food", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "piatto al passo, plin e vino", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-food-1", family: "food", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "crudo di ricciola su marmo, agrume in spicchi ed erba di mare", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Impiattamento credibile, non ovali." },
  { id: "svg-editorial-0", family: "editorial", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "lastra del pozzo su carta da rivista, olivo e fienile", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Scene fotografiche, non campiture." },
  { id: "svg-editorial-1", family: "editorial", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "studio notturno, cornice e segnale rosso", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Scene fotografiche, non campiture." },
];

/** Exact 7c3245c geometric leftovers. A realism gate that still matches these is tautological. */
export const GEOMETRIC_REGRESSIONS: RegExp[] = [
  /M250 46l54-16 54 16 44 36/,
  /M232 86h176l22 34H210z/,
  /M268 48l52 28 52-28 28 20/,
  /M220 222c44-28 96-16 124 16/,
  /M236 200c18-6 40 0 52 14/,
  /width="340" height="230" fill="#c9b496"/,
  /width="304" height="194" fill="#6a5e52"/,
  /width="234" height="140" fill="#6a5e52"/,
];

export type MaterialSignature = {
  paths: number;
  gradients: number;
  marks: number;
  parts: string[];
  garment: string | null;
  scenes: string[];
};

export function materialSignature(svg: string): MaterialSignature {
  const parts = [...String(svg).matchAll(/\bdata-part="([^"]+)"/g)].map((m) => m[1]!);
  const garment = String(svg).match(/\bdata-garment="([^"]+)"/)?.[1] || null;
  const scenes = [...String(svg).matchAll(/\bdata-scene="([^"]+)"/g)].map((m) => m[1]!);
  return {
    paths: (String(svg).match(/<path\b/g) || []).length,
    gradients: (String(svg).match(/<(?:linear|radial)Gradient\b/g) || []).length,
    parts: [...new Set(parts)],
    garment,
    scenes: [...new Set(scenes)],
    marks: (String(svg).match(/<(?:path|ellipse|circle|polygon)\b/g) || []).length,
  };
}

function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&" + "amp;")
    .replace(/"/g, "&" + "quot;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}

function wrap(id: string, alt: string, inner: string, slot = 0, extraDefs = ""): string {
  const gid = `${id.replace(/[^a-z0-9]/gi, "")}s${slot}n${inner.length}`;
  const bits = id.split("-");
  const family = bits[1] || "";
  const variant = bits[2] || "0";
  return `<svg class="domain-art" data-imagery="domain" data-family="${esc(family)}" data-variant="${esc(variant)}" data-provenance="${esc(id)}" data-slot="${slot}" viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid slice"><defs><filter id="${gid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed="${11 + slot * 5}" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="g2"><feFuncA type="table" tableValues="0 0.26"/></feComponentTransfer><feBlend in="SourceGraphic" in2="g2" mode="multiply"/></filter><filter id="${gid}sh"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-opacity=".34"/></filter><radialGradient id="${gid}vg" cx=".48" cy=".42" r=".78"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>${extraDefs}</defs><g filter="url(#${gid})">${inner}</g><rect width="640" height="420" fill="url(#${gid}vg)" pointer-events="none"/></svg>`;
}

function perfumeArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-perfume-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const defs = `<linearGradient id="iceg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fbfe"/><stop offset=".4" stop-color="#c5d8e4"/><stop offset="1" stop-color="#6e93a8"/></linearGradient><radialGradient id="ices${s}" cx=".32" cy=".18" r=".62"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="iceliq${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec0d2" stop-opacity=".15"/><stop offset=".45" stop-color="#7ea8bc" stop-opacity=".55"/><stop offset="1" stop-color="#4d7388" stop-opacity=".7"/></linearGradient>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#dce6ee"/><rect y="268" width="640" height="152" fill="#c5d3de"/><ellipse cx="320" cy="268" rx="210" ry="18" fill="#9aafbd" opacity=".35"/><rect x="248" y="-30" width="144" height="360" rx="12" fill="url(#iceg${s})"/><rect x="264" y="8" width="112" height="300" rx="8" fill="url(#iceliq${s})"/><path d="M272 54h96v210c0 30-18 52-48 52s-48-22-48-52z" fill="#7ea8bc" opacity=".28"/><ellipse cx="320" cy="64" rx="46" ry="10" fill="#fff" opacity=".35"/><circle cx="300" cy="110" r="64" fill="url(#ices${s})"/><rect x="292" y="-48" width="56" height="52" rx="5" fill="#1a3a52"/><rect x="304" y="-58" width="32" height="16" rx="3" fill="#12202c"/>`, s, defs);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#e8eef3"/><rect y="300" width="640" height="120" fill="#d2dee6"/><rect x="86" y="86" width="168" height="248" rx="10" fill="url(#iceg${s})"/><rect x="354" y="54" width="196" height="292" rx="12" fill="#cfe0ea"/><rect x="102" y="108" width="136" height="200" rx="8" fill="url(#iceliq${s})"/><rect x="374" y="78" width="156" height="240" rx="8" fill="#8eb0c4" opacity=".4"/><rect x="148" y="48" width="44" height="44" rx="4" fill="#1a3a52"/><rect x="426" y="22" width="52" height="40" rx="4" fill="#12202c"/><circle cx="160" cy="160" r="48" fill="url(#ices${s})"/><path d="M40 44h150M40 64h96" stroke="#1a3a52" stroke-width="2"/>`, s, defs);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#d5e1ea"/><circle cx="168" cy="210" r="90" fill="#b9cdd8"/><circle cx="168" cy="210" r="54" fill="#eef5f8"/><rect x="300" y="70" width="120" height="280" rx="10" fill="url(#iceg${s})"/><rect x="316" y="96" width="88" height="230" rx="7" fill="url(#iceliq${s})"/><rect x="338" y="36" width="44" height="42" rx="4" fill="#1a3a52"/><circle cx="360" cy="140" r="50" fill="url(#ices${s})"/><path d="M40 72h120" stroke="#1a3a52" stroke-width="2"/>`, s, defs);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#dce6ee"/><rect y="312" width="640" height="108" fill="#c5d3de"/><ellipse cx="418" cy="312" rx="130" ry="16" fill="#9aafbd" opacity=".4"/><rect x="368" y="78" width="108" height="234" rx="10" fill="url(#iceg${s})"/><rect x="380" y="96" width="84" height="198" rx="7" fill="url(#iceliq${s})"/><path d="M388 118h68v148c0 22-14 38-34 38s-34-16-34-38z" fill="#7ea8bc" opacity=".45"/><rect x="396" y="42" width="52" height="42" rx="4" fill="#1a3a52"/><rect x="408" y="28" width="28" height="18" rx="3" fill="#12202c"/><circle cx="412" cy="148" r="46" fill="url(#ices${s})"/><path d="M36 64h170M36 88h110" stroke="#1a3a52" stroke-width="2"/><circle cx="118" cy="248" r="70" fill="#c5d3de" opacity=".7"/>`, s, defs);
  }
  const defs = `<linearGradient id="org${s}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a120c"/><stop offset=".36" stop-color="#c4a15a"/><stop offset=".62" stop-color="#2a211c"/><stop offset="1" stop-color="#7a5c2a"/></linearGradient><radialGradient id="ors${s}" cx=".34" cy=".2" r=".6"><stop offset="0" stop-color="#f4ead8" stop-opacity=".55"/><stop offset="1" stop-color="#f4ead8" stop-opacity="0"/></radialGradient><linearGradient id="orliq${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4a15a" stop-opacity=".08"/><stop offset=".4" stop-color="#6a4a24" stop-opacity=".55"/><stop offset="1" stop-color="#1a120c" stop-opacity=".85"/></linearGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#120e0c"/><ellipse cx="328" cy="396" rx="170" ry="26" fill="#000" opacity=".55"/><path d="M236 8c14-86 154-86 168 0v292c0 58-32 92-84 92s-84-34-84-92z" fill="url(#org${s})"/><path d="M258 28c10-62 114-62 124 0v264c0 46-24 74-62 74s-62-28-62-74z" fill="url(#orliq${s})"/><ellipse cx="320" cy="46" rx="58" ry="12" fill="#f4ead8" opacity=".2"/><circle cx="300" cy="108" r="62" fill="url(#ors${s})"/><rect x="292" y="-16" width="56" height="52" rx="6" fill="#c4a15a"/><rect x="304" y="-28" width="32" height="18" rx="3" fill="#8a6a32"/>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1d1714"/><ellipse cx="320" cy="390" rx="220" ry="22" fill="#000" opacity=".4"/><path d="M150 96c8-56 68-56 76 0v210c0 38-16 60-38 60s-38-22-38-60z" fill="url(#org${s})"/><path d="M368 64c10-66 92-66 104 0v248c0 48-20 74-52 74s-52-26-52-74z" fill="#2a211c"/><path d="M384 80c8-52 72-52 82 0v220c0 40-16 60-41 60s-41-20-41-60z" fill="url(#orliq${s})"/><rect x="172" y="44" width="36" height="58" fill="#f4ead8"/><rect x="400" y="18" width="40" height="54" fill="#c4a15a"/><circle cx="200" cy="160" r="40" fill="url(#ors${s})"/><path d="M36 52h150M36 74h96" stroke="#c4a15a" stroke-width="1.6"/>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#0e0b09"/><circle cx="150" cy="210" r="88" fill="#1d1714"/><circle cx="150" cy="210" r="52" fill="#c4a15a" opacity=".18"/><path d="M320 70c10-60 90-60 100 0v240c0 48-22 74-50 74s-50-26-50-74z" fill="url(#org${s})"/><path d="M338 90c8-46 64-46 72 0v210c0 38-16 58-36 58s-36-20-36-58z" fill="url(#orliq${s})"/><rect x="354" y="36" width="40" height="44" rx="5" fill="#c4a15a"/><circle cx="370" cy="140" r="48" fill="url(#ors${s})"/><path d="M40 64h120" stroke="#c4a15a" stroke-width="1.6"/><circle cx="150" cy="210" r="8" fill="#c4a15a"/>`, s, defs);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#120e0c"/><ellipse cx="428" cy="338" rx="120" ry="20" fill="#000" opacity=".5"/><path d="M384 148c10-76 92-76 102 0v168c0 44-20 68-51 68s-51-24-51-68z" fill="url(#org${s})"/><path d="M398 160c8-58 70-58 78 0v148c0 36-16 56-39 56s-39-20-39-56z" fill="url(#orliq${s})"/><rect x="418" y="84" width="28" height="72" rx="5" fill="#f4ead8"/><rect x="412" y="62" width="40" height="30" rx="4" fill="#c4a15a"/><circle cx="430" cy="196" r="52" fill="url(#ors${s})"/><path d="M40 64h160M40 88h100" stroke="#c4a15a" stroke-width="1.6"/><circle cx="118" cy="248" r="68" fill="#1d1714"/><circle cx="118" cy="248" r="8" fill="#c4a15a" opacity=".7"/>`, s, defs);
}

function fashionDefs(s: number, ink: boolean): string {
  const cloth0 = ink ? "#fff8ef" : "#2a2420";
  const cloth1 = ink ? "#f3ece3" : "#161412";
  const cloth2 = ink ? "#c9b496" : "#0c0a09";
  const lining0 = ink ? "#4a4038" : "#c81d25";
  const lining1 = ink ? "#2a2420" : "#7a1016";
  const sheen = ink ? ".28" : ".16";
  const floor0 = ink ? "#241f1c" : "#ddd0bc";
  const floor1 = ink ? "#120f0d" : "#cfc3ae";
  return `<linearGradient id="fab${s}" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="${cloth0}"/><stop offset=".45" stop-color="${cloth1}"/><stop offset="1" stop-color="${cloth2}"/></linearGradient><linearGradient id="lin${s}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${lining0}"/><stop offset="1" stop-color="${lining1}"/></linearGradient><linearGradient id="slv${s}" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="${cloth2}"/><stop offset=".35" stop-color="${cloth0}"/><stop offset="1" stop-color="${cloth1}"/></linearGradient><radialGradient id="she${s}" cx=".38" cy=".22" r=".7"><stop offset="0" stop-color="#fff" stop-opacity="${sheen}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="flr${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${floor0}"/><stop offset="1" stop-color="${floor1}"/></linearGradient>`;
}

function atelierSet(ink: boolean, s: number): string {
  const wall = ink ? "#241f1c" : "#f6f1ea";
  const rail = ink ? "#c9b496" : "#161412";
  const paper = ink ? "#f3ece3" : "#fffdf8";
  const shear = ink ? "#3a322c" : "#2a2420";
  const pin = ink ? "#c9b496" : "#c81d25";
  return `<rect width="640" height="420" fill="${wall}"/><rect y="318" width="640" height="102" fill="url(#flr${s})"/><rect x="36" y="24" width="7" height="292" fill="${rail}"/><path d="M56 44h118M56 64h78" stroke="${rail}" stroke-width="2.2"/><g data-part="props"><rect x="52" y="248" width="54" height="70" fill="${paper}" stroke="${rail}" stroke-width="1"/><path d="M56 262h46M56 274h38M56 286h42" stroke="${rail}" stroke-width="1.2" opacity=".55"/><path d="M118 300l36 14-10 22-38-16z" fill="${shear}"/><path d="M132 312l18 8" stroke="${rail}" stroke-width="2.4"/><circle cx="108" cy="236" r="3" fill="${pin}"/><circle cx="122" cy="230" r="2.4" fill="${rail}"/></g>`;
}

function dressForm(cx: number, ink: boolean): string {
  const canvas = ink ? "#c9b496" : "#3a3028";
  const metal = ink ? "#e8dcc8" : "#1a1614";
  return `<g data-part="dress-form">
    <ellipse cx="${cx}" cy="368" rx="46" ry="9" fill="${metal}" opacity=".85"/>
    <ellipse cx="${cx}" cy="360" rx="28" ry="5" fill="${metal}"/>
    <rect x="${cx - 5}" y="250" width="10" height="112" rx="2" fill="${metal}"/>
    <path d="M${cx - 32} 86c10-26 54-26 64 0l5 14c6 62-4 118-12 154-8 10-42 10-50 0-8-36-18-92-12-154z" fill="${canvas}"/>
    <ellipse cx="${cx}" cy="78" rx="16" ry="9" fill="${canvas}"/>
    <ellipse cx="${cx}" cy="74" rx="11" ry="5" fill="${metal}"/>
  </g>`;
}

function coatOnForm(cx: number, s: number, ink: boolean): string {
  const stitch = ink ? "#1a1614" : "#c9b496";
  const button = ink ? "#1a1614" : "#f6f1ea";
  const hole = ink ? "#c9b496" : "#161412";
  return `${dressForm(cx, ink)}
  <g data-part="garment" data-garment="coat">
    <g data-part="sleeve">
      <path d="M${cx - 78} 108c-18 14-36 52-42 96-4 28 2 58 16 64l22 4c6-36 14-92 22-132 2-10-2-22-18-32z" fill="url(#slv${s})"/>
      <path d="M${cx - 108} 262c8 6 28 8 40 2l-4 14c-16 4-36 2-44-6z" fill="url(#fab${s})"/>
      <path d="M${cx - 96} 168c-6 18-8 40-6 62" fill="none" stroke="${stitch}" stroke-width="1" opacity=".35"/>
      <path d="M${cx + 78} 108c18 14 36 52 42 96 4 28-2 58-16 64l-22 4c-6-36-14-92-22-132-2-10 2-22 18-32z" fill="url(#slv${s})"/>
      <path d="M${cx + 108} 262c-8 6-28 8-40 2l4 14c16 4 36 2 44-6z" fill="url(#fab${s})"/>
      <path d="M${cx + 96} 168c6 18 8 40 6 62" fill="none" stroke="${stitch}" stroke-width="1" opacity=".35"/>
    </g>
    <path data-part="body" d="M${cx - 72} 100c16-28 48-40 72-28 24-12 56 0 72 28 10 36 12 110 8 168-10 28-40 48-80 50s-70-22-80-50c-4-58-2-132 8-168z" fill="url(#fab${s})"/>
    <path data-part="lining" d="M${cx - 70} 300c18 28 48 42 70 44 22-2 52-16 70-44l-8 28c-18 22-48 34-62 34s-44-12-62-34z" fill="url(#lin${s})"/>
    <g data-part="lapel">
      <path d="M${cx - 2} 84l-18-10-16 18-22 86 28 14 28-78z" fill="url(#fab${s})" stroke="${stitch}" stroke-width="0.8" opacity=".95"/>
      <path d="M${cx + 2} 84l18-10 16 18 22 86-28 14-28-78z" fill="url(#fab${s})" stroke="${stitch}" stroke-width="0.8"/>
      <path d="M${cx - 20} 92l14 12 8-16zM${cx + 20} 92l-14 12-8-16z" fill="url(#lin${s})"/>
    </g>
    <path data-part="collar" d="M${cx - 22} 72c14-16 30-16 44 0l-10 14-12-8-12 8z" fill="url(#fab${s})"/>
    <g data-part="seam" fill="none" stroke="${stitch}" stroke-width="1" opacity=".45">
      <path d="M${cx - 40} 128c-6 50-4 110 6 168"/>
      <path d="M${cx + 40} 128c6 50 4 110-6 168"/>
      <path d="M${cx} 118v200" opacity=".4"/>
    </g>
    <g data-part="pocket">
      <rect x="${cx - 62}" y="228" width="44" height="9" rx="1.5" fill="none" stroke="${stitch}" stroke-width="1.3"/>
      <rect x="${cx + 18}" y="228" width="44" height="9" rx="1.5" fill="none" stroke="${stitch}" stroke-width="1.3"/>
      <path d="M${cx - 62} 228h44M${cx + 18} 228h44" stroke="${stitch}" stroke-width="2.2"/>
    </g>
    <g data-part="button">
      ${[168, 204, 240].map((y) => `<circle cx="${cx + 10}" cy="${y}" r="5.2" fill="${button}"/><circle cx="${cx + 8.4}" cy="${y - 1.4}" r="1.1" fill="${hole}"/><circle cx="${cx + 11.6}" cy="${y + 1.2}" r="1.1" fill="${hole}"/>`).join("")}
    </g>
    <path d="M${cx - 50} 120c40-30 100-28 118 8" fill="url(#she${s})"/>
  </g>
  <ellipse cx="${cx}" cy="372" rx="92" ry="14" fill="#000" opacity=".2"/>`;
}

function columnDress(cx: number, s: number, ink: boolean): string {
  const stitch = ink ? "#1a1614" : "#c9b496";
  const strap = ink ? "#f3ece3" : "#161412";
  return `${dressForm(cx, ink)}
  <g data-part="garment" data-garment="dress">
    <path d="M${cx - 16} 92c-4 8-8 8-18 6l-8 14c8 6 14 8 20 8h44c6 0 12-2 20-8l-8-14c-10 2-14 2-18-6z" fill="url(#fab${s})"/>
    <path data-part="sleeve" d="M${cx - 42} 110c-16 10-22 36-16 58l18 4c2-16 8-36 14-50zM${cx + 42} 110c16 10 22 36 16 58l-18 4c-2-16-8-36-14-50z" fill="url(#slv${s})"/>
    <path d="M${cx - 36} 118c8 10 18 14 36 14s28-4 36-14c6 40 10 110 4 196-8 22-24 36-40 38s-32-16-40-38c-6-86-2-156 4-196z" fill="url(#fab${s})"/>
    <path data-part="seam" d="M${cx} 118v228" fill="none" stroke="${stitch}" stroke-width="1.1"/>
    <path d="M${cx - 18} 156c12 10 24 10 36 0" fill="none" stroke="${stitch}" stroke-width="1.3"/>
    <path d="M${cx - 22} 210h44M${cx - 18} 248h36" stroke="${stitch}" stroke-width="0.9" opacity=".5"/>
    <path data-part="lining" d="M${cx - 34} 330c10 16 24 24 34 24s24-8 34-24l-6 18c-8 14-20 20-28 20s-20-6-28-20z" fill="url(#lin${s})"/>
    <circle cx="${cx + 8}" cy="178" r="2.6" fill="${strap}"/>
    <circle cx="${cx + 8}" cy="206" r="2.6" fill="${strap}"/>
    <circle cx="${cx + 8}" cy="234" r="2.6" fill="${strap}"/>
    <path d="M${cx - 24} 130c24-18 56-16 70 6" fill="url(#she${s})"/>
  </g>
  <ellipse cx="${cx}" cy="372" rx="80" ry="12" fill="#000" opacity=".2"/>`;
}

function hangTrousers(cx: number, s: number, ink: boolean): string {
  const hook = ink ? "#c9b496" : "#161412";
  const stitch = ink ? "#1a1614" : "#c9b496";
  return `<g data-part="garment" data-garment="trousers">
    <path d="M${cx} 48c16-18 28-8 28 8 0 10-8 16-16 16" fill="none" stroke="${hook}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M${cx - 70} 74l70-12 70 12-8 14H${cx - 62}z" fill="${hook}"/>
    <path data-part="seam" d="M${cx - 56} 88h112v16c-16 6-40 8-56 8s-40-2-56-8z" fill="url(#fab${s})"/>
    ${[ -48, -28, -8, 12, 32, 48 ].map((dx) => `<rect x="${cx + dx}" y="90" width="5" height="10" rx="1" fill="${hook}" opacity=".7"/>`).join("")}
    <path d="M${cx - 54} 108c2 8 6 12 16 14v210c0 16-8 24-20 24s-22-8-22-24V186c0-28 8-56 26-78z" fill="url(#fab${s})"/>
    <path d="M${cx + 54} 108c-2 8-6 12-16 14v210c0 16 8 24 20 24s22-8 22-24V186c0-28-8-56-26-78z" fill="url(#fab${s})"/>
    <path data-part="seam" d="M${cx - 38} 130v200M${cx + 38} 130v200" fill="none" stroke="${stitch}" stroke-width="1.15"/>
    <path d="M${cx - 8} 108v36c-2 10-8 16-16 18M${cx + 8} 108v36c2 10 8 16 16 18" fill="none" stroke="${stitch}" stroke-width="1"/>
    <g data-part="pocket">
      <path d="M${cx - 50} 128h22v28H${cx - 50}z" fill="none" stroke="${stitch}" stroke-width="1"/>
      <path d="M${cx + 28} 128h22v28H${cx + 28}z" fill="none" stroke="${stitch}" stroke-width="1"/>
    </g>
    <path d="M${cx - 76} 328h28v12h-28zM${cx + 48} 328h28v12h-28z" fill="url(#lin${s})"/>
    <path d="M${cx - 20} 112c8 14 24 14 40 0" fill="none" stroke="${stitch}" stroke-width="1.2"/>
  </g>
  <ellipse cx="${cx}" cy="372" rx="100" ry="12" fill="#000" opacity=".16"/>`;
}

function skirtOnForm(cx: number, s: number, ink: boolean): string {
  const stitch = ink ? "#1a1614" : "#c9b496";
  return `${dressForm(cx, ink)}
  <g data-part="garment" data-garment="skirt">
    <path d="M${cx - 40} 96c8-6 72-6 80 0l6 14H${cx - 46}z" fill="url(#fab${s})"/>
    <path d="M${cx - 46} 112c18 8 36 10 46 10s28-2 46-10c8 36 22 110 28 196-24 18-70 28-74 28s-50-10-74-28c6-86 20-160 28-196z" fill="url(#fab${s})"/>
    <g data-part="seam" fill="none" stroke="${stitch}" stroke-width="1" opacity=".5">
      <path d="M${cx - 20} 120c-6 70-10 140-8 196"/>
      <path d="M${cx} 122v194"/>
      <path d="M${cx + 20} 120c6 70 10 140 8 196"/>
      <path d="M${cx - 34} 120c-8 80-16 150-18 196"/>
      <path d="M${cx + 34} 120c8 80 16 150 18 196"/>
    </g>
    <path data-part="lining" d="M${cx - 70} 318c20 16 50 28 70 28s50-12 70-28l-8 20c-18 16-44 24-62 24s-44-8-62-24z" fill="url(#lin${s})"/>
    <rect x="${cx - 28}" y="188" width="56" height="8" fill="url(#lin${s})"/>
  </g>
  <ellipse cx="${cx}" cy="372" rx="88" ry="12" fill="#000" opacity=".2"/>`;
}

function fashionArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-fashion-${variant}`;
  const s = slot % 4;
  const ink = variant === 1;
  const defs = fashionDefs(s, ink);
  const set = atelierSet(ink, s);
  const subject =
    s === 1
      ? columnDress(320, s, ink)
      : s === 2
        ? ink
          ? skirtOnForm(320, s, ink)
          : hangTrousers(320, s, ink)
        : s === 3
          ? ink
            ? hangTrousers(320, s, ink)
            : skirtOnForm(320, s, ink)
          : coatOnForm(320, s, ink);
  const framed = `<g transform="translate(320 208) scale(1.3) translate(-320 -208)">${subject}</g>`;
  return wrap(id, alt, `${set}${framed}`, s, defs);
}

function bookingArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-booking-${variant}`;
  if (variant === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#f4efe4"/><rect x="40" y="70" width="560" height="280" rx="8" fill="#fffaf1" stroke="#e0d4c4"/><rect x="70" y="110" width="360" height="200" fill="#e8dcc8"/><rect x="90" y="130" width="320" height="12" fill="#8a4b2e"/><path d="M470 150l70 40-24 70-70-40z" fill="#2a2118"/><path d="M490 170l36 20" stroke="#8a4b2e" stroke-width="4"/><circle cx="${160 + slot * 30}" cy="250" r="18" fill="#8a4b2e" opacity=".3"/>`, slot);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#1f6f68"/><rect x="36" y="48" width="280" height="200" rx="18" fill="#eef3ea"/><rect x="70" y="80" width="90" height="130" rx="8" fill="#1a2a24"/><rect x="180" y="120" width="100" height="90" rx="10" fill="#c9d6c8"/><circle cx="170" cy="300" r="${36 + slot * 4}" fill="#eef3ea"/><rect x="340" y="70" width="240" height="160" rx="16" fill="#c9d6c8"/><path d="M370 110h180M370 140h120" stroke="#1a2a24" stroke-width="6" stroke-linecap="round"/><rect x="70" y="330" width="200" height="10" fill="#1a2a24"/>`, slot);
}

function opsArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-ops-${variant}`;
  const s = slot % 4;
  const bars = [62, 118, 168, 96, 148, 88].map((h, i) => {
    const x = 64 + i * 52 + s * 2;
    return `<rect x="${x}" y="${292 - h}" width="28" height="${h}" rx="3" fill="${variant ? "#3d5a1f" : "#d4a017"}"/>`;
  });
  if (variant === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#e7efe2"/><rect x="28" y="36" width="584" height="348" rx="10" fill="#f4f8f0"/><path d="M52 64h220M52 88h150" stroke="#1c2a18" stroke-width="6" stroke-linecap="round"/>${bars.join("")}<rect x="430" y="56" width="150" height="86" rx="8" fill="#3d5a1f"/><path d="M56 312h520" stroke="#c9d6c0" stroke-width="2"/>`, s);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#10151c"/><rect x="24" y="28" width="592" height="364" rx="8" fill="#171e28"/><path d="M52 62h240M52 88h168" stroke="#e7e1d4" stroke-width="5" stroke-linecap="round"/>${bars.join("")}<path d="M64 206l64-36 58 18 76-48 64 12 70-22" fill="none" stroke="#d4a017" stroke-width="3"/><rect x="448" y="48" width="140" height="70" rx="6" fill="#d4a017"/>`, s);
}

function utilityArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-utility-${variant}`;
  if (variant === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#111318"/><rect x="70" y="160" width="500" height="72" rx="12" fill="#6ec8b8"/><g fill="#111318">${Array.from({ length: 18 }, (_, i) => `<rect x="${90 + i * 26}" y="168" width="2" height="${i % 5 === 0 ? 36 : 16}"/>`).join("")}</g><circle cx="${160 + slot * 40}" cy="300" r="28" fill="none" stroke="#6ec8b8" stroke-width="3"/><path d="M80 80h200" stroke="#e8e4d8" stroke-width="4"/>`, slot);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#f6f3ee"/><rect x="80" y="70" width="360" height="260" fill="none" stroke="#1b1814" stroke-width="2" stroke-dasharray="8 10"/><path d="M420 90l90 50-40 90-90-48z" fill="#d6452d"/><path d="M448 118l48 28" stroke="#1b1814" stroke-width="5"/><circle cx="${140 + slot * 24}" cy="300" r="10" fill="#d6452d"/><path d="M80 70h24M80 70v24M440 70h-24M440 70v24" stroke="#1b1814" stroke-width="3"/>`, slot);
}

function hospitalityArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-hospitality-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const defs = `<linearGradient id="htw${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#243044"/><stop offset="1" stop-color="#0c1018"/></linearGradient><radialGradient id="htl${s}" cx=".5" cy=".18" r=".55"><stop offset="0" stop-color="#f0e6d4" stop-opacity=".85"/><stop offset=".45" stop-color="#d4c4a0" stop-opacity=".4"/><stop offset="1" stop-color="#d4c4a0" stop-opacity="0"/></radialGradient><linearGradient id="htdrap${s}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1f28"/><stop offset=".5" stop-color="#2a3140"/><stop offset="1" stop-color="#12151c"/></linearGradient>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#12151c"/><rect x="70" y="36" width="500" height="348" fill="#1a1f28"/><rect x="96" y="60" width="220" height="300" fill="url(#htw${s})"/><rect x="118" y="84" width="176" height="160" fill="#d4c4a0" opacity=".12"/><circle cx="430" cy="150" r="80" fill="url(#htl${s})"/><rect x="414" y="150" width="32" height="130" fill="#d4c4a0"/><rect x="300" y="268" width="240" height="88" rx="4" fill="#242a36"/><rect x="320" y="256" width="90" height="14" rx="3" fill="#f0e6d4" opacity=".35"/><path d="M300 56h220" stroke="#d4c4a0" stroke-width="1.2"/>`, s, defs);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1118"/><rect x="40" y="40" width="560" height="340" fill="#1a1f28"/><rect x="40" y="40" width="70" height="340" fill="url(#htdrap${s})"/><rect x="530" y="40" width="70" height="340" fill="url(#htdrap${s})"/><rect x="160" y="250" width="320" height="96" rx="6" fill="#242a36"/><rect x="180" y="236" width="120" height="22" rx="6" fill="#f0e6d4" opacity=".4"/><rect x="310" y="236" width="120" height="22" rx="6" fill="#f0e6d4" opacity=".28"/><ellipse cx="320" cy="120" rx="90" ry="40" fill="url(#htl${s})"/><path d="M200 80h240" stroke="#d4c4a0" stroke-width="1"/>`, s, defs);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#12151c"/><rect x="0" y="0" width="220" height="420" fill="#1a1f28"/><rect x="48" y="80" width="12" height="220" fill="#d4c4a0" opacity=".5"/><rect x="80" y="80" width="12" height="220" fill="#d4c4a0" opacity=".25"/><rect x="250" y="90" width="330" height="240" fill="#242a36"/><rect x="280" y="120" width="270" height="160" fill="#0c1018"/><circle cx="416" cy="180" r="36" fill="url(#htl${s})"/><rect x="250" y="90" width="8" height="240" fill="#d4c4a0"/><path d="M40 48h140" stroke="#d4c4a0" stroke-width="1.4"/>`, s, defs);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#12151c"/><rect x="36" y="32" width="568" height="356" fill="#1a1f28"/><rect x="64" y="56" width="236" height="300" fill="url(#htw${s})"/><rect x="88" y="84" width="188" height="156" fill="#d4c4a0" opacity=".16"/><rect x="108" y="104" width="148" height="116" fill="#0c1018"/><circle cx="456" cy="168" r="70" fill="url(#htl${s})"/><rect x="440" y="168" width="32" height="110" fill="#d4c4a0"/><ellipse cx="456" cy="164" rx="22" ry="8" fill="#f0e6d4" opacity=".45"/><rect x="320" y="268" width="240" height="72" rx="5" fill="#242a36"/><rect x="340" y="254" width="80" height="16" rx="4" fill="#f0e6d4" opacity=".3"/><path d="M320 56h220" stroke="#d4c4a0" stroke-width="1.3"/><path d="M500 300c8-22 28-22 36 0" fill="none" stroke="#d4c4a0" stroke-width="1.6"/>`, s, defs);
  }
  const defs = `<linearGradient id="rmw${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa3b4"/><stop offset="1" stop-color="#dfe8ee"/></linearGradient><radialGradient id="fire${s}" cx=".5" cy=".8" r=".6"><stop offset="0" stop-color="#f4c27a"/><stop offset=".45" stop-color="#c45c26" stop-opacity=".85"/><stop offset="1" stop-color="#1f2a24" stop-opacity="0"/></radialGradient><linearGradient id="hill${s}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5e6a62"/><stop offset="1" stop-color="#5e6a62" stop-opacity=".15"/></linearGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#e7e0d2"/><rect x="36" y="40" width="568" height="340" fill="#cfc3ae"/><rect x="64" y="64" width="300" height="200" fill="url(#rmw${s})"/><path d="M64 200c50-70 140-78 220-10v74H64z" fill="url(#hill${s})"/><rect x="64" y="64" width="12" height="200" fill="#f4efe4" opacity=".5"/><rect x="208" y="64" width="12" height="200" fill="#f4efe4" opacity=".5"/><rect x="352" y="64" width="12" height="200" fill="#f4efe4" opacity=".5"/><rect x="64" y="264" width="300" height="96" fill="#1f4a3e"/><rect x="400" y="210" width="180" height="150" rx="6" fill="#f4efe4"/><rect x="420" y="228" width="140" height="16" fill="#1f4a3e" opacity=".35"/><rect x="420" y="256" width="100" height="10" fill="#1f4a3e" opacity=".2"/>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#d9d0c0"/><rect x="80" y="80" width="480" height="260" rx="8" fill="#f4efe4"/><rect x="110" y="200" width="420" height="110" rx="8" fill="#fffaf1"/><rect x="130" y="176" width="150" height="36" rx="10" fill="#e7e0d2"/><rect x="300" y="176" width="150" height="36" rx="10" fill="#e7e0d2"/><rect x="110" y="300" width="420" height="18" fill="#1f4a3e" opacity=".45"/><path d="M80 80h480" stroke="#1f4a3e" stroke-width="3"/><circle cx="160" cy="120" r="10" fill="#1f4a3e" opacity=".3"/>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#cfc3ae"/><rect x="40" y="70" width="280" height="280" fill="#1f2a24"/><rect x="70" y="160" width="220" height="140" fill="#3a2a20"/><ellipse cx="180" cy="250" rx="70" ry="50" fill="url(#fire${s})"/><rect x="360" y="90" width="240" height="240" fill="#e7e0d2"/><rect x="390" y="120" width="180" height="120" fill="url(#rmw${s})"/><rect x="390" y="260" width="180" height="40" fill="#1f4a3e"/><path d="M40 48h200" stroke="#1f4a3e" stroke-width="3"/>`, s, defs);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#e7e0d2"/><rect x="28" y="32" width="584" height="356" fill="#cfc3ae"/><g opacity=".35" stroke="#8a7a66" stroke-width="1" fill="none"><path d="M28 80h584M28 140h584M28 210h584M28 280h584M28 340h584"/><path d="M90 32v356M180 32v356M280 32v356M400 32v356M520 32v356"/></g><rect x="56" y="56" width="260" height="200" fill="url(#rmw${s})"/><rect x="56" y="56" width="14" height="200" fill="#f4efe4" opacity=".55"/><rect x="179" y="56" width="14" height="200" fill="#f4efe4" opacity=".55"/><rect x="302" y="56" width="14" height="200" fill="#f4efe4" opacity=".55"/><path d="M56 200c40-54 110-60 180-8v64H56z" fill="url(#hill${s})"/><rect x="360" y="200" width="220" height="140" rx="6" fill="#f4efe4"/><rect x="380" y="188" width="80" height="20" rx="6" fill="#fffaf1"/><rect x="470" y="188" width="80" height="20" rx="6" fill="#fffaf1"/><rect x="56" y="268" width="260" height="88" fill="#1f4a3e"/><rect x="90" y="288" width="70" height="50" fill="#3a2a20"/><ellipse cx="125" cy="328" rx="24" ry="16" fill="url(#fire${s})"/><circle cx="${140 + s * 10}" cy="120" r="16" fill="#fffaf1" opacity=".45"/>`, s, defs);
}

function marbleVeins(): string {
  return `<g data-part="marble" fill="none">
    <path d="M-20 70c90 40 140-36 230 10 80-40 150 28 240-12 90 34 150 8 210 22" stroke="#8a9aa6" stroke-width="1.4" opacity=".45"/>
    <path d="M0 180c100-24 170 36 260 8 90 28 160-22 250 14 80-18 130 12 180-6" stroke="#c5d0d6" stroke-width="2.4" opacity=".55"/>
    <path d="M20 300c80-34 150 16 230-14 100 30 170-10 260 12" stroke="#6a7a84" stroke-width="1.1" opacity=".35"/>
    <path d="M40 120c60 8 90-24 150 6" stroke="#fff" stroke-width="0.7" opacity=".35"/>
    <path d="M280 250c70 16 110-20 180 8" stroke="#fff" stroke-width="0.8" opacity=".25"/>
    <ellipse cx="480" cy="80" rx="90" ry="36" fill="#fff" opacity=".07"/>
  </g>`;
}

function ceramicPlate(cx: number, cy: number, s: number): string {
  return `<g data-part="plate">
    <ellipse cx="${cx}" cy="${cy + 18}" rx="210" ry="108" fill="#000" opacity=".16"/>
    <ellipse cx="${cx}" cy="${cy}" rx="198" ry="96" fill="#dfe8ee"/>
    <ellipse cx="${cx}" cy="${cy - 6}" rx="168" ry="78" fill="url(#pl${s})"/>
    <ellipse cx="${cx}" cy="${cy - 10}" rx="150" ry="66" fill="#fff" opacity=".35"/>
    <path d="M${cx - 150} ${cy - 8}c40-40 100-52 150-38" fill="none" stroke="#fff" stroke-width="3" opacity=".45"/>
    <path d="M${cx - 180} ${cy + 6}c20 4 40 6 60 4" fill="none" stroke="#c5d0d6" stroke-width="1.4" opacity=".6"/>
  </g>`;
}

function crudoSlice(x: number, y: number, rot: number, w: number, h: number, s: number): string {
  const hw = w / 2;
  const hh = h / 2;
  return `<g data-part="flesh" transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse cx="0" cy="5" rx="${hw}" ry="${hh}" fill="#000" opacity=".14"/>
    <path d="M${-hw} 0 Q0 ${-hh} ${hw} ${-hh * 0.15} Q${hw * 0.4} ${hh} ${-hw * 0.2} ${hh * 0.7} Q${-hw} ${hh * 0.3} ${-hw} 0Z" fill="url(#flesh${s})"/>
    <path d="M${-hw * 0.7} ${-hh * 0.15} Q0 ${-hh * 0.45} ${hw * 0.55} ${-hh * 0.05}" fill="none" stroke="#fff" stroke-width="1.15" opacity=".5"/>
    <path d="M${-hw * 0.45} ${hh * 0.05} Q0 ${-hh * 0.1} ${hw * 0.4} ${hh * 0.2}" fill="none" stroke="#fff" stroke-width="0.8" opacity=".35"/>
    <path d="M${-hw} 0 Q${-hw * 0.6} ${hh * 0.55} 0 ${hh * 0.7}" fill="none" stroke="#9a3a28" stroke-width="1.7" opacity=".45"/>
  </g>`;
}

function lemonHalf(cx: number, cy: number, s: number): string {
  const segs = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return `<path d="M0 0 L${(Math.cos(a) * 19).toFixed(1)} ${(Math.sin(a) * 19).toFixed(1)}" stroke="#e8c24a" stroke-width=".7"/>`;
  }).join("");
  return `<g data-part="citrus" transform="translate(${cx} ${cy})">
    <ellipse cx="3" cy="5" rx="28" ry="25" fill="#000" opacity=".16"/>
    <circle r="26" fill="url(#lem${s})"/>
    <circle r="19.5" fill="#fff4c4"/>
    ${segs}
    <circle r="3.4" fill="#f0d56a"/>
    <ellipse cx="7" cy="-7" rx="3.2" ry="1.5" fill="#c9a040" opacity=".75"/>
    <ellipse cx="-9" cy="8" rx="2.6" ry="1.3" fill="#c9a040" opacity=".65"/>
    <path d="M-16 -15 Q-2 -26 14 -16" fill="none" stroke="#fff" stroke-width="2.2" opacity=".4"/>
    <path d="M18 -8c8-2 14 4 12 12" fill="none" stroke="#e25c2a" stroke-width="2"/>
  </g>`;
}

function seaHerb(x: number, y: number): string {
  return `<g data-part="herb" transform="translate(${x} ${y})" fill="#2f6b4a">
    <path d="M4 48 C0 24 8 10 4 -12" fill="none" stroke="#245a3c" stroke-width="1.7"/>
    <ellipse cx="-8" cy="8" rx="5.2" ry="10" transform="rotate(-30 -8 8)"/>
    <ellipse cx="10" cy="0" rx="4.6" ry="9" transform="rotate(24 10 0)"/>
    <ellipse cx="-2" cy="-14" rx="4.2" ry="8" transform="rotate(-6 -2 -14)"/>
    <ellipse cx="12" cy="16" rx="3.6" ry="7" transform="rotate(38 12 16)"/>
    <ellipse cx="-12" cy="22" rx="3.4" ry="6" transform="rotate(-42 -12 22)"/>
    <path d="M14 6 C26 -8 22 -22 12 -14" fill="none" stroke="#2f6b4a" stroke-width="1.3"/>
    <ellipse cx="16" cy="-8" rx="3" ry="5.5" transform="rotate(18 16 -8)"/>
  </g>`;
}

function oilAndSalt(cx: number, cy: number): string {
  return `<g data-part="oil">
    <ellipse cx="${cx}" cy="${cy}" rx="7" ry="4.5" fill="#d8c078" opacity=".55"/>
    <ellipse cx="${cx - 3}" cy="${cy - 1}" rx="2.4" ry="1.4" fill="#fff" opacity=".5"/>
    <ellipse cx="${cx + 18}" cy="${cy + 10}" rx="5" ry="3.2" fill="#d8c078" opacity=".4"/>
    <g data-part="salt" fill="#fff">
      <circle cx="${cx + 36}" cy="${cy - 8}" r="1.4"/><circle cx="${cx + 42}" cy="${cy - 4}" r="1.1"/><circle cx="${cx + 39}" cy="${cy + 2}" r="1.3"/><circle cx="${cx + 47}" cy="${cy - 1}" r="0.9"/><circle cx="${cx + 33}" cy="${cy + 4}" r="1"/>
    </g>
  </g>`;
}

function crudoStill(s: number, kind: "ricciola" | "gambero" | "ostrica" | "tonno"): string {
  const plate = ceramicPlate(320, 228, s);
  const napkin = `<g data-part="linen"><path d="M168 300l70-18 36 86-74 22z" fill="#f4f7f8" stroke="#cfdbe0"/><path d="M186 308l48-12" stroke="#cfdbe0" stroke-width="1.2"/><path d="M200 336l40-10" stroke="#cfdbe0" stroke-width="1"/></g>`;
  const knife = `<g data-part="knife"><path d="M470 250l86-18 6 12-84 22z" fill="#e8eef2" stroke="#9aa8b0"/><rect x="548" y="228" width="36" height="14" rx="2" fill="#2f4a3e"/><path d="M478 254l70-16" stroke="#fff" stroke-width="1" opacity=".5"/></g>`;
  const food =
    kind === "gambero"
      ? `<g data-part="flesh">
        <path d="M250 200c20-28 70-40 110-18 16 10 8 28-8 34-22 12-54 18-86 8-18-4-24-14-16-24z" fill="url(#flesh${s})"/>
        <path d="M360 196c18-8 40-4 48 14 4 12-8 20-22 18l-30-6c-8-4-6-18 4-26z" fill="#d4785c"/>
        <path d="M402 214c16 4 28 16 22 32-18 6-36-4-40-18z" fill="#c45c3a"/>
        <path d="M250 206c28-8 60-6 86 8" fill="none" stroke="#fff" stroke-width="1.1" opacity=".4"/>
      </g>
      ${lemonHalf(400, 168, s)}${seaHerb(196, 150)}${oilAndSalt(300, 248)}${knife}`
      : kind === "ostrica"
        ? `<g data-part="flesh">
        <path d="M250 210c-20-36 8-70 46-74 36-4 70 22 74 54 4 28-18 52-50 58-36 8-64-6-70-38z" fill="#f4f7f8" stroke="#c5d0d6"/>
        <path d="M268 206c8-28 36-40 58-28 16 10 18 34 4 46-18 14-46 10-58-6z" fill="url(#flesh${s})"/>
        <ellipse cx="292" cy="214" rx="16" ry="10" fill="#e28a6a" opacity=".55"/>
      </g>
      ${lemonHalf(400, 176, s)}${seaHerb(188, 148)}${oilAndSalt(340, 250)}
      <ellipse cx="456" cy="230" rx="36" ry="14" fill="#dfe8ee" opacity=".7"/>`
        : kind === "tonno"
          ? `${crudoSlice(268, 210, -18, 92, 36, s)}
      ${crudoSlice(318, 198, -6, 96, 34, s)}
      ${crudoSlice(368, 214, 14, 88, 32, s)}
      ${crudoSlice(300, 236, 8, 80, 28, s)}
      ${lemonHalf(412, 168, s)}${seaHerb(190, 152)}${oilAndSalt(250, 252)}${knife}`
          : `${crudoSlice(250, 214, -22, 88, 34, s)}
    ${crudoSlice(300, 200, -8, 100, 36, s)}
    ${crudoSlice(352, 208, 10, 92, 34, s)}
    ${crudoSlice(318, 232, 4, 84, 30, s)}
    ${crudoSlice(270, 240, -12, 72, 26, s)}
    ${lemonHalf(408, 164, s)}${seaHerb(186, 146)}${oilAndSalt(236, 250)}${knife}`;
  return `${marbleVeins()}<g transform="translate(320 220) scale(1.16) translate(-320 -220)">${plate}${napkin}${food}</g>`;
}

function foodArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-food-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const defs = `<radialGradient id="pl${s}" cx=".5" cy=".42" r=".52"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8ee"/></radialGradient><linearGradient id="mv${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4eef2"/><stop offset=".45" stop-color="#c5d3dc"/><stop offset="1" stop-color="#dbe6ec"/></linearGradient><linearGradient id="flesh${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7d0bc"/><stop offset=".45" stop-color="#e28a6a"/><stop offset="1" stop-color="#c45c3a"/></linearGradient><linearGradient id="lem${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e25c2a"/></linearGradient>`;
    const kinds = ["ricciola", "gambero", "ostrica", "tonno"] as const;
    const kind = kinds[s]!;
    const caption = `<path d="M168 48h120M168 68h72" stroke="#12202c" stroke-width="3"/>`;
    return wrap(id, alt, `<rect width="640" height="420" fill="url(#mv${s})"/>${crudoStill(s, kind)}${caption}`, s, defs);
  }
  const defs = `<radialGradient id="dk${s}" cx=".5" cy=".38" r=".55"><stop offset="0" stop-color="#e25c2a"/><stop offset=".45" stop-color="#c43c2c"/><stop offset="1" stop-color="#3a2420"/></radialGradient><linearGradient id="plin${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ead8"/><stop offset="1" stop-color="#d4b896"/></linearGradient>`;
  const sage = `<g data-part="herb" fill="#7d9a6a"><ellipse cx="292" cy="200" rx="10" ry="5" transform="rotate(-20 292 200)"/><ellipse cx="312" cy="194" rx="11" ry="5" transform="rotate(18 312 194)"/><ellipse cx="328" cy="204" rx="9" ry="4.5" transform="rotate(-12 328 204)"/></g>`;
  const wine = `<g data-part="glass"><ellipse cx="470" cy="210" rx="36" ry="58" fill="#f6ead8" opacity=".12" stroke="#c4a890"/><path d="M456 160c14 0 26 12 26 32" fill="none" stroke="#c4a890" stroke-width="1.6"/><path d="M470 268v40M452 308h36" stroke="#c4a890" stroke-width="2"/><path d="M448 200c8 28 36 28 44 0" fill="#c43c2c" opacity=".35"/></g>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="280" rx="220" ry="96" fill="#000" opacity=".45"/><g data-part="plate"><ellipse cx="328" cy="246" rx="156" ry="66" fill="url(#dk${s})"/></g><g data-part="flesh">${Array.from({ length: 7 }, (_, i) => `<ellipse cx="${270 + i * 16}" cy="${228 + (i % 2) * 6}" rx="14" ry="9" fill="url(#plin${s})"/>`).join("")}</g>${sage}${wine}<path d="M250 228c40-22 96-18 128 12-22 32-86 44-128 20z" fill="#f6ead8" opacity=".35"/><rect x="56" y="48" width="8" height="240" fill="#c43c2c"/>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#140e0c"/><g data-part="plate"><ellipse cx="250" cy="250" rx="150" ry="80" fill="#3a2420"/><ellipse cx="250" cy="236" rx="110" ry="50" fill="url(#dk${s})"/></g><g data-part="flesh"><path d="M200 226c28-14 70-10 90 10-14 22-60 30-90 14z" fill="#f6ead8"/><ellipse cx="230" cy="230" rx="16" ry="10" fill="url(#plin${s})"/><ellipse cx="258" cy="226" rx="15" ry="9" fill="url(#plin${s})"/></g>${wine}<rect x="56" y="48" width="8" height="250" fill="#c43c2c"/><path d="M80 64h140" stroke="#f6ead8" stroke-width="3"/>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><rect x="70" y="60" width="500" height="300" fill="#241816"/><g data-part="plate"><ellipse cx="260" cy="230" rx="130" ry="70" fill="url(#dk${s})"/></g><g data-part="flesh"><path d="M210 220c30-16 70-12 90 10" fill="#f6ead8"/><ellipse cx="236" cy="224" rx="14" ry="9" fill="url(#plin${s})"/><ellipse cx="264" cy="220" rx="14" ry="9" fill="url(#plin${s})"/><ellipse cx="290" cy="226" rx="13" ry="8" fill="url(#plin${s})"/></g><rect x="420" y="100" width="120" height="200" fill="#321f1b"/><rect x="436" y="120" width="88" height="14" fill="#f6ead8" opacity=".4"/><rect x="436" y="148" width="64" height="8" fill="#c43c2c"/><rect x="70" y="60" width="8" height="300" fill="#c43c2c"/>`, s, defs);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="272" rx="206" ry="100" fill="#000" opacity=".5"/><g data-part="plate"><ellipse cx="328" cy="250" rx="170" ry="80" fill="#3a2420"/><ellipse cx="328" cy="236" rx="128" ry="56" fill="url(#dk${s})"/><path d="M210 220c30-24 80-36 118-20" fill="none" stroke="#f6ead8" stroke-width="2" opacity=".2"/></g><g data-part="flesh">${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${276 + i * 15}" cy="${222 + (i % 3) * 5}" rx="13" ry="8" fill="url(#plin${s})"/>`).join("")}<path d="M248 220c36-22 84-18 112 10-18 30-72 44-112 24z" fill="#f6ead8" opacity=".4"/><path d="M260 218c20-6 48-4 70 8" fill="none" stroke="#d4b896" stroke-width="1.2"/></g>${sage}<path d="M300 188c-8 6-6 16 4 14 8 10 20 2 14-8 6-12-10-18-18-6z" fill="#7d9a6a"/><circle cx="${300 + s * 8}" cy="214" r="7" fill="#7d9a6a"/><path d="M290 176c6-26 16-38 12-6M318 168c8-30 20-40 12-4M344 174c6-24 16-34 10-2" fill="none" stroke="#f6ead8" stroke-width="1.8" opacity=".4"/>${wine}<rect x="64" y="56" width="8" height="240" fill="#c43c2c"/><path d="M92 72h170M92 98h100" stroke="#f6ead8" stroke-width="3"/>`, s, defs);
}

function sprockets(): string {
  return Array.from({ length: 9 }, (_, i) => `<rect x="${56 + i * 58}" y="14" width="14" height="10" rx="2" fill="#1a1814"/><rect x="${56 + i * 58}" y="396" width="14" height="10" rx="2" fill="#1a1814"/>`).join("");
}

function scenePozzo(): string {
  return `<g data-part="scene" data-scene="pozzo">
    <rect width="640" height="420" fill="#8aa3b4"/>
    <rect y="0" width="640" height="210" fill="#c5d4de"/>
    <path d="M0 210c80-36 160-20 260 8 90-30 180-10 280 16 40 8 80 4 100 0V420H0z" fill="#6a7a70"/>
    <path d="M0 250c120-20 220 10 340-8 90 16 180 4 300 18V420H0z" fill="#5e6a62"/>
    <rect x="0" y="300" width="640" height="120" fill="#cfc3ae"/>
    <g fill="none" stroke="#8a7a66" stroke-width="1" opacity=".4"><path d="M0 320h640M0 350h640M0 380h640"/><path d="M80 300v120M180 300v120M300 300v120M460 300v120"/></g>
    <ellipse cx="320" cy="338" rx="92" ry="18" fill="#000" opacity=".2"/>
    <ellipse cx="320" cy="318" rx="86" ry="36" fill="#d7cbb8"/>
    <ellipse cx="320" cy="318" rx="70" ry="26" fill="#3a322c"/>
    <ellipse cx="320" cy="320" rx="52" ry="16" fill="#1f2a24"/>
    <ellipse cx="328" cy="316" rx="18" ry="6" fill="#8aa3b4" opacity=".35"/>
    <path d="M320 292 v-64" stroke="#3a322c" stroke-width="2"/>
    <path d="M304 228h32v8h-32z" fill="#3a322c"/>
    <path d="M210 250c10-50 40-80 70-86" fill="none" stroke="#3a322c" stroke-width="6"/>
    <path d="M248 292c8-16 24-16 32 0" fill="none" stroke="#3a322c" stroke-width="2"/>
    <path d="M360 300c12-20 36-18 44 4" fill="none" stroke="#8a7a66" stroke-width="1.4"/>
    <ellipse cx="204" cy="168" rx="36" ry="48" fill="#3d5a1f"/>
    <ellipse cx="188" cy="150" rx="22" ry="28" fill="#2c4a18"/>
    <ellipse cx="222" cy="158" rx="18" ry="24" fill="#4a6a28"/>
    <rect x="198" y="210" width="8" height="40" fill="#3a322c"/>
  </g>`;
}

function sceneOlivo(): string {
  return `<g data-part="scene" data-scene="olivo">
    <rect width="640" height="420" fill="#c9b496"/>
    <rect y="0" width="640" height="200" fill="#e8d8b8"/>
    <path d="M0 200c100-40 200-20 320 10 100-30 200-8 320 20V420H0z" fill="#6a7a4a"/>
    <path d="M0 280c140-16 240 20 400 0 80 10 160 0 240 12V420H0z" fill="#4a5a32"/>
    <path d="M40 340c80-24 160 8 240-10 90 18 170-6 260 12" fill="none" stroke="#3a322c" stroke-width="2" opacity=".25"/>
    <rect x="300" y="220" width="18" height="110" fill="#3a322c"/>
    <path d="M300 250c-16 20-18 50-8 80M318 248c14 18 16 48 6 78" fill="none" stroke="#2a2420" stroke-width="2"/>
    <ellipse cx="292" cy="170" rx="70" ry="58" fill="#3d5a1f"/>
    <ellipse cx="340" cy="150" rx="64" ry="54" fill="#2c4a18"/>
    <ellipse cx="318" cy="128" rx="40" ry="32" fill="#4a6a28"/>
    <ellipse cx="360" cy="180" rx="36" ry="28" fill="#3d5a1f" opacity=".85"/>
    <ellipse cx="270" cy="190" rx="28" ry="22" fill="#2c4a18"/>
    <ellipse cx="308" cy="108" rx="22" ry="16" fill="#3d5a1f"/>
    <ellipse cx="248" cy="168" rx="18" ry="14" fill="#4a6a28" opacity=".8"/>
    <path d="M160 300c40-70 120-80 200-30" fill="none" stroke="#3a322c" stroke-width="3" opacity=".25"/>
    <circle cx="420" cy="90" r="22" fill="#f3efe6" opacity=".45"/>
    <circle cx="510" cy="70" r="8" fill="#f3efe6" opacity=".25"/>
  </g>`;
}

function sceneFienile(): string {
  return `<g data-part="scene" data-scene="fienile">
    <rect width="640" height="420" fill="#c9b496"/>
    <rect y="0" width="640" height="190" fill="#d8c4a0"/>
    <path d="M0 250h640v170H0z" fill="#8a6a40"/>
    <path d="M0 250c80-20 200 8 320-6 140 18 220 0 320 10v20H0z" fill="#6a5e52"/>
    <path d="M180 250 L320 120 L460 250z" fill="#6a5e52"/>
    <rect x="200" y="168" width="240" height="140" fill="#9a4a28"/>
    <rect x="288" y="210" width="64" height="98" fill="#1a1814"/>
    <path d="M288 210h64v98h-64z" fill="none" stroke="#3a2420" stroke-width="2"/>
    <rect x="228" y="190" width="36" height="28" fill="#c9b496" opacity=".4"/>
    <rect x="376" y="190" width="36" height="28" fill="#c9b496" opacity=".4"/>
    <path d="M320 120 L320 168" stroke="#1a1814" stroke-width="3"/>
    <path d="M240 140c40-60 120-60 170 0" fill="none" stroke="#f3efe6" stroke-width="8" opacity=".15"/>
    <ellipse cx="250" cy="310" rx="40" ry="14" fill="#c9b496" opacity=".5"/>
    <ellipse cx="390" cy="318" rx="50" ry="16" fill="#c9b496" opacity=".4"/>
    <path d="M210 300c20-18 50-16 70 4M370 304c24-16 60-12 80 8" fill="none" stroke="#6a5e52" stroke-width="3" opacity=".4"/>
    <circle cx="480" cy="80" r="18" fill="#f3efe6" opacity=".35"/>
    <path d="M228 190h36M228 204h36M376 190h36M376 204h36" stroke="#6a5e52" stroke-width="1" opacity=".5"/>
  </g>`;
}

function sceneRame(): string {
  return `<g data-part="scene" data-scene="rame">
    <rect width="640" height="420" fill="#1a1814"/>
    <rect x="80" y="70" width="480" height="280" fill="#2a2420"/>
    <ellipse cx="320" cy="230" rx="150" ry="96" fill="#9a4a28"/>
    <ellipse cx="320" cy="226" rx="128" ry="80" fill="#c9b496"/>
    <ellipse cx="320" cy="222" rx="96" ry="58" fill="#6a5e52"/>
    <circle cx="308" cy="200" r="36" fill="#f3efe6" opacity=".2"/>
    <path d="M240 190c40-24 80-20 110 8" fill="none" stroke="#f3efe6" stroke-width="2" opacity=".25"/>
    <rect x="120" y="86" width="8" height="248" fill="#9a4a28"/>
    <path d="M148 100h200" stroke="#c9b496" stroke-width="3"/>
  </g>`;
}

function typeColumn(): string {
  return `<g data-part="type">
    <path d="M456 88h128M456 104h86" stroke="#1a1814" stroke-width="7" stroke-linecap="square"/>
    <path d="M456 128h120M456 146h108M456 164h96M456 182h112" stroke="#1a1814" stroke-width="2.4"/>
    <rect x="456" y="208" width="128" height="6" fill="#9a4a28"/>
    <path d="M456 232h100M456 248h88M456 264h108" stroke="#6a5e52" stroke-width="2"/>
    <rect x="456" y="292" width="72" height="36" fill="#1a1814"/>
    <rect x="536" y="300" width="40" height="8" fill="#9a4a28"/>
  </g>`;
}

function editorialArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-editorial-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const frame = `<rect x="72" y="48" width="8" height="280" fill="#c81d25"/>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="48" y="36" width="544" height="348" fill="#16181e"/>
        <g transform="translate(72 58) scale(0.375)">${sceneRame()}</g>
        <rect x="72" y="58" width="240" height="170" fill="none" stroke="#2a2e38"/>
        <g transform="translate(336 58) scale(0.36)">${sceneOlivo()}</g>
        <rect x="336" y="58" width="228" height="170" fill="none" stroke="#2a2e38"/>
        <rect x="72" y="248" width="492" height="10" fill="#c81d25"/>
        <g transform="translate(72 268) scale(0.31)">${scenePozzo()}</g>
        <g transform="translate(292 268) scale(0.31)">${sceneFienile()}</g>
        ${frame}`, s);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="40" y="40" width="560" height="340" fill="#16181e"/><g transform="translate(64 64) scale(0.34)">${sceneRame()}</g><rect x="64" y="64" width="220" height="160" fill="none" stroke="#2a2e38"/><g transform="translate(308 64) scale(0.42)">${scenePozzo()}</g><rect x="308" y="64" width="268" height="268" fill="none" stroke="#2a2e38"/><path d="M332 300h220" stroke="#c81d25" stroke-width="3"/><rect x="560" y="40" width="16" height="340" fill="#c81d25"/>`, s);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#16181e"/><rect x="100" y="36" width="440" height="320" fill="#0e1014"/><g transform="translate(128 64) scale(0.6)">${sceneOlivo()}</g><rect x="128" y="64" width="384" height="230" fill="none" stroke="#2a2e38"/><rect x="128" y="308" width="90" height="8" fill="#c81d25"/><path d="M36 48h80" stroke="#c81d25" stroke-width="6"/>`, s);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><g transform="translate(72 60) scale(0.53)">${sceneRame()}</g><rect x="72" y="60" width="342" height="240" fill="none" stroke="#2a2e38"/><rect x="470" y="52" width="16" height="240" fill="#c81d25"/><path d="M96 348h300" stroke="#c81d25" stroke-width="2"/><rect x="72" y="360" width="140" height="8" fill="#e8e6df"/>`, s);
  }
  if (s === 1) {
    const clips = `<clipPath id="cs0${s}"><rect x="40" y="40" width="270" height="176"/></clipPath><clipPath id="cs1${s}"><rect x="330" y="40" width="270" height="176"/></clipPath><clipPath id="cs2${s}"><rect x="40" y="236" width="270" height="148"/></clipPath><clipPath id="cs3${s}"><rect x="330" y="236" width="270" height="148"/></clipPath>`;
    return wrap(id, alt, `<rect width="640" height="420" fill="#e8e0d2"/>${sprockets()}
      <g clip-path="url(#cs0${s})"><g transform="translate(40 40) scale(0.42)">${scenePozzo()}</g></g><rect x="40" y="40" width="270" height="176" fill="none" stroke="#ddd4c6"/>
      <g clip-path="url(#cs1${s})"><g transform="translate(330 40) scale(0.42)">${sceneOlivo()}</g></g><rect x="330" y="40" width="270" height="176" fill="none" stroke="#ddd4c6"/>
      <g clip-path="url(#cs2${s})"><g transform="translate(40 236) scale(0.42)">${sceneFienile()}</g></g><rect x="40" y="236" width="270" height="148" fill="none" stroke="#ddd4c6"/>
      <g clip-path="url(#cs3${s})"><g transform="translate(330 236) scale(0.42)">${sceneRame()}</g></g><rect x="330" y="236" width="270" height="148" fill="none" stroke="#ddd4c6"/>
      <path d="M40 400h560" stroke="#9a4a28" stroke-width="5"/>`, s, clips);
  }
  if (s === 2) {
    const clips = `<clipPath id="edl${s}"><rect x="32" y="28" width="300" height="364"/></clipPath>`;
    return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/><g clip-path="url(#edl${s})"><g transform="translate(-20 -40) scale(0.867)">${sceneOlivo()}</g></g><rect x="32" y="28" width="300" height="364" fill="none" stroke="#1a1814"/><rect x="356" y="28" width="252" height="364" fill="#fffdf8"/>${typeColumn()}`, s, clips);
  }
  if (s === 3) {
    const clips = `<clipPath id="edf${s}"><rect x="96" y="64" width="448" height="210"/></clipPath>`;
    return wrap(id, alt, `<rect width="640" height="420" fill="#e8e0d2"/><rect x="70" y="40" width="500" height="340" fill="#fffdf8" stroke="#ddd4c6"/><g clip-path="url(#edf${s})"><g transform="translate(96 40) scale(0.7)">${sceneFienile()}</g></g><rect x="96" y="64" width="448" height="210" fill="none" stroke="#6a5e52"/><rect x="118" y="292" width="240" height="12" fill="#1a1814"/><rect x="118" y="318" width="160" height="8" fill="#9a4a28"/><rect x="400" y="292" width="120" height="50" fill="#1a1814"/>`, s, clips);
  }
  const clips = `<clipPath id="edc${s}"><rect x="36" y="36" width="380" height="288"/></clipPath>`;
  return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/>${sprockets()}
    <g clip-path="url(#edc${s})"><g transform="translate(36 36) scale(0.594)">${scenePozzo()}</g></g>
    <rect x="36" y="36" width="380" height="288" fill="none" stroke="#ddd4c6" stroke-width="2"/>
    <rect x="36" y="324" width="380" height="8" fill="#9a4a28"/>
    <rect x="436" y="52" width="168" height="280" fill="#fffdf8"/>
    ${typeColumn()}
    <rect x="56" y="348" width="200" height="10" fill="#1a1814"/>`, s, clips);
}

export function altForBrief(brief: string): string {
  const family = familyFromBrief(brief);
  const variant = variantFromBrief(brief);
  const row = DOMAIN_IMAGERY_PROVENANCE.find((p) => p.family === family && p.variant === variant);
  return row?.subject || "Oggetto del mestiere";
}

export function domainIllustration(
  family: TokenFamily,
  variant: 0 | 1 = 0,
  alt?: string,
  slot = 0,
): string {
  const label = alt || altForBrief(`${family} ${variant}`);
  if (family === "perfume") return perfumeArt(variant, slot, label);
  if (family === "fashion") return fashionArt(variant, slot, label);
  if (family === "booking") return bookingArt(variant, slot, label);
  if (family === "hospitality") return hospitalityArt(variant, slot, label);
  if (family === "food") return foodArt(variant, slot, label);
  if (family === "editorial") return editorialArt(variant, slot, label);
  if (family === "ops") return opsArt(variant, slot, label);
  if (family === "utility") return utilityArt(variant, slot, label);
  return perfumeArt(0, slot, label);
}

export function heroPromptForBrief(brief: string): string {
  const family = familyFromBrief(brief);
  const subject = altForBrief(brief);
  const craft =
    family === "perfume"
      ? "glass perfume bottle, liquid, studio light, no people"
      : family === "fashion"
        ? "tailored garment on a dress form in an atelier, fabric drape"
        : family === "booking"
          ? "treatment studio interior, chair, linen, daylight window"
          : family === "hospitality"
            ? "hotel room interior, bed, window light, no people, no UI"
            : family === "food"
              ? "plated dish, linen, steam, no people, no menu screenshot"
              : family === "editorial"
                ? "photographic plate on paper, copper edge, studio light"
          : family === "ops"
            ? "paper ledger, brass ruler, north window, no screenshots"
            : family === "utility"
              ? "brass measuring tools and crop marks on paper"
              : "clay, kiln, tools, hands, vessels";
  return `Photorealistic close-up of the craft itself (${craft}). No text, no logo, no watermark, no website, no UI, no screenshot, no browser chrome, no navbar, no form, no page collage. Subject: ${subject}. Brief: ${String(brief || "").slice(0, 220)}`;
}

export const HERO_IMAGE_CREDIT = {
  model: "grok-imagine-image-2.0",
  quality: "low" as const,
  trigger: "user-initiated build only",
  purpose: "family-specific photoreal still-life of the craft",
  fallback: "repository-native SVG (0 credits)",
  authorized: true,
};

function markHeroImg(tag: string, alt: string): string {
  let next = tag;
  if (!/data-imagery=/.test(next)) {
    next = next.replace(/<img\b/i, '<img data-imagery="domain"');
  }
  if (!/\balt=/.test(next)) {
    next = next.replace(/<img\b([^>]*)>/i, `<img$1 alt="${esc(alt)}">`);
  } else if (/\balt=(""|'')/.test(next)) {
    next = next.replace(/\balt=(""|'')/, `alt="${esc(alt)}"`);
  }
  return next;
}

/** Generation-time only. Do not call from auditGraphicQuality. */
export function ensureDomainImagery(html: string, brief: string): string {
  if (!html) return html;
  const family = familyFromBrief(brief);
  if (!isProductFamily(family)) return html;
  const variant = variantFromBrief(brief);
  const alt = altForBrief(brief);
  const art = domainIllustration(family, variant, alt, 0);
  let next = html;
  let slot = 0;
  next = next.replace(/<img\b[^>]*fk-hero[^>]*>/gi, (tag) => markHeroImg(tag, alt));
  next = next.replace(
    /<div([^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*)>([\s\S]*?)<\/div>/gi,
    (full, attrs: string, inner: string) => {
      if (/data-imagery=["']domain["']/.test(full) || /<img\b[^>]*fk-hero/i.test(inner)) return full;
      const cleaned = String(attrs).replace(/\baria-hidden=["'][^"']*["']/gi, "");
      return `<div${cleaned}>${domainIllustration(family, variant, alt, slot++)}</div>`;
    },
  );
  next = next.replace(
    /<div([^>]*class=["'][^"']*\bsil\b[^"']*["'][^>]*)>([\s\S]*?)<\/div>/gi,
    (full, attrs: string, inner: string) => {
      if (/data-imagery=["']domain["']/.test(inner) || /<svg[\s\S]{180,}/.test(inner)) return full;
      return `<div${attrs}>${domainIllustration(family, variant, alt, slot++)}</div>`;
    },
  );
  if (!/data-imagery=["']domain["']/.test(next)) {
    if (/<main\b[^>]*>/i.test(next)) {
      next = next.replace(/<main\b[^>]*>/i, (open) => `${open}<div class="hero">${art}</div>`);
    }
  }
  return next;
}

export function unboxProductCanvas(html: string, brief: string): string {
  if (!html || !isProductFamily(familyFromBrief(brief))) return html;
  return html.replace(
    /(\.app\s*\{[^}]*?)width\s*:\s*min\(\s*1[01]\d{2}px\s*,\s*100%\s*\)/gi,
    "$1width:100%",
  );
}

export function upgradeProductChrome(html: string, brief: string): string {
  return unboxProductCanvas(ensureDomainImagery(html, brief), brief);
}

export function provenanceForBrief(brief: string): ImageryProvenance | undefined {
  const family = familyFromBrief(brief);
  const variant = variantFromBrief(brief);
  return DOMAIN_IMAGERY_PROVENANCE.find((p) => p.family === family && p.variant === variant);
}
