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
  { id: "svg-fashion-0", family: "fashion", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cappotto sartoriale su manichino, baveri, pieghe e cuciture", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Capi riconoscibili, non capsule." },
  { id: "svg-fashion-1", family: "fashion", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "abito colonna in osso con pieghe, cuciture e manichino", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Capi riconoscibili, non sagome." },
  { id: "svg-booking-0", family: "booking", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "sala con poltrona, finestra e orologio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-booking-1", family: "booking", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "tavolo da taglio, lino e forbici", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-ops-0", family: "ops", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "ledger, barre e finestra nord", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-ops-1", family: "ops", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cassette di raccolto e andamento", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-utility-0", family: "utility", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "forbici e crocini di taglio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-utility-1", family: "utility", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "nastro millimetrato in tasca", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-hospitality-0", family: "hospitality", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "camera in pietra, letto e finestra sul pozzo", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-hospitality-1", family: "hospitality", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "suite d'hotel, lampada oro e champagne", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-food-0", family: "food", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "piatto al passo, plin e vino", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-food-1", family: "food", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "crudo di ricciola, gambero, ostrica e tonno, impiattamenti distinti", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Quattro piatti semanticamente diversi." },
  { id: "svg-editorial-0", family: "editorial", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "lastra del pozzo, olivo, fienile e torchio su carta da rivista", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Scene fotografiche distinte, non alberi ripetuti." },
  { id: "svg-editorial-1", family: "editorial", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "studio notturno, cornice e segnale rosso", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Scene fotografiche, non campiture." },
  { id: "svg-repo-0", family: "repo", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "nastro di commit, rami e scarto su carta di terminale", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Non è un clone GitHub." },
  { id: "svg-repo-1", family: "repo", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "colonna di diff e rami in luce diurna", notes: "Nessun asset Apple/Emergent. Nessun hotlink. Non è un clone GitHub." },
];

/** Exact leftovers from 7c3245c and 7812483. A realism gate that still matches these is tautological. */
export const GEOMETRIC_REGRESSIONS: RegExp[] = [
  /M250 46l54-16 54 16 44 36/,
  /M232 86h176l22 34H210z/,
  /M268 48l52 28 52-28 28 20/,
  /M220 222c44-28 96-16 124 16/,
  /M236 200c18-6 40 0 52 14/,
  /width="340" height="230" fill="#c9b496"/,
  /width="304" height="194" fill="#6a5e52"/,
  /width="234" height="140" fill="#6a5e52"/,
  /c16-28 48-40 72-28 24-12 56 0 72 28/,
  /v210c0 16-8 24-20 24s-22-8-22-24V186/,
  /c20-28 70-40 110-18 16 10 8 28-8 34/,
  /M250 210c-20-36 8-70 46-74 36-4 70 22/,
  /M214 176 C198 148 224 108 268 118/,
  /C276 86 328 74 364 108 C408 96 428 138 396 164/,
];

export type MaterialSignature = {
  paths: number;
  gradients: number;
  marks: number;
  parts: string[];
  garment: string | null;
  dish: string | null;
  scenes: string[];
  fills: string[];
  room: string | null;
  bottle: string | null;
  tool: string | null;
};

export function materialSignature(svg: string): MaterialSignature {
  const parts = [...String(svg).matchAll(/\bdata-part="([^"]+)"/g)].map((m) => m[1]!);
  const garment = String(svg).match(/\bdata-garment="([^"]+)"/)?.[1] || null;
  const dish = String(svg).match(/\bdata-dish="([^"]+)"/)?.[1] || null;
  const scenes = [...String(svg).matchAll(/\bdata-scene="([^"]+)"/g)].map((m) => m[1]!);
  const fills = [...new Set([...String(svg).matchAll(/\bstop-color="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1]!.toLowerCase()))];
  const room = String(svg).match(/\bdata-room="([^"]+)"/)?.[1] || null;
  const bottle = String(svg).match(/\bdata-bottle="([^"]+)"/)?.[1] || null;
  const tool = String(svg).match(/\bdata-tool="([^"]+)"/)?.[1] || null;
  return {
    paths: (String(svg).match(/<path\b/g) || []).length,
    gradients: (String(svg).match(/<(?:linear|radial)Gradient\b/g) || []).length,
    parts: [...new Set(parts)],
    garment,
    dish,
    scenes: [...new Set(scenes)],
    fills,
    marks: (String(svg).match(/<(?:path|ellipse|circle|polygon)\b/g) || []).length,
    room,
    bottle,
    tool,
  };
}

function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&" + "amp;")
    .replace(/"/g, "&" + "quot;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}

function wrap(id: string, alt: string, inner: string, slot = 0, extraDefs = "", fit: "meet" | "slice" = "slice"): string {
  const gid = `${id.replace(/[^a-z0-9]/gi, "")}s${slot}n${inner.length}`;
  const bits = id.split("-");
  const family = bits[1] || "";
  const variant = bits[2] || "0";
  const resolved = fit === "meet" ? "meet" : "slice";
  return `<svg class="domain-art" data-imagery="domain" data-family="${esc(family)}" data-variant="${esc(variant)}" data-provenance="${esc(id)}" data-slot="${slot}" data-fit="${resolved}" viewBox="0 0 640 420" width="640" height="420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid ${resolved}"><defs><filter id="${gid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed="${11 + slot * 5}" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="g2"><feFuncA type="table" tableValues="0 0.26"/></feComponentTransfer><feBlend in="SourceGraphic" in2="g2" mode="multiply"/></filter><filter id="${gid}sh"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-opacity=".34"/></filter><radialGradient id="${gid}vg" cx=".48" cy=".42" r=".78"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>${extraDefs}</defs><g filter="url(#${gid})">${inner}</g>${family === "editorial" ? `<rect width="640" height="420" fill="#6a5a48" opacity=".07" pointer-events="none"/><rect width="640" height="420" fill="#f4ead8" opacity=".05" pointer-events="none"/>` : family === "repo" ? `<g pointer-events="none" opacity=".12">${Array.from({ length: 14 }, (_, i) => `<path d="M0 ${28 * i}h640" stroke="#9ec8d4" stroke-width="1"/>`).join("")}</g>` : ""}<rect width="640" height="420" fill="url(#${gid}vg)" pointer-events="none"/></svg>`;
}

function perfumeArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-perfume-${variant}`;
  const s = slot % 4;
  const fit: "meet" | "slice" = slot === 0 ? "meet" : "slice";
  const bottles = variant === 1 ? (["sale", "nebbia", "pino", "vetro"] as const) : (["nuit", "acqua", "fleur", "pelle"] as const);
  const bottle = bottles[s]!;
  if (variant === 1) {
    const defs = `<linearGradient id="iceg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fbfe"/><stop offset=".4" stop-color="#c5d8e4"/><stop offset="1" stop-color="#6e93a8"/></linearGradient><radialGradient id="ices${s}" cx=".32" cy=".18" r=".62"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="iceliq${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ec0d2" stop-opacity=".15"/><stop offset=".45" stop-color="#7ea8bc" stop-opacity=".55"/><stop offset="1" stop-color="#4d7388" stop-opacity=".7"/></linearGradient>`;
    const mark = (inner: string) => `<g data-bottle="${bottle}">${inner}</g>`;
    if (s === 1) {
      return wrap(id, alt, mark(`<rect width="640" height="420" fill="#dce6ee"/><rect y="268" width="640" height="152" fill="#c5d3de"/><ellipse cx="320" cy="268" rx="210" ry="18" fill="#9aafbd" opacity=".35"/><rect data-part="glass" x="248" y="-30" width="144" height="360" rx="12" fill="url(#iceg${s})"/><rect data-part="liquid" x="264" y="8" width="112" height="300" rx="8" fill="url(#iceliq${s})"/><path d="M272 54h96v210c0 30-18 52-48 52s-48-22-48-52z" fill="#7ea8bc" opacity=".28"/><ellipse cx="320" cy="64" rx="46" ry="10" fill="#fff" opacity=".35"/><circle cx="300" cy="110" r="64" fill="url(#ices${s})"/><rect data-part="cap" x="292" y="-48" width="56" height="52" rx="5" fill="#1a3a52"/><rect data-part="label" x="304" y="-58" width="32" height="16" rx="3" fill="#12202c"/>`), slot, defs, fit);
    }
    if (s === 2) {
      return wrap(id, alt, mark(`<rect width="640" height="420" fill="#e8eef3"/><rect y="300" width="640" height="120" fill="#d2dee6"/><g data-part="glass"><rect x="86" y="86" width="168" height="248" rx="10" fill="url(#iceg${s})"/><rect x="354" y="54" width="196" height="292" rx="12" fill="#cfe0ea"/></g><g data-part="liquid"><rect x="102" y="108" width="136" height="200" rx="8" fill="url(#iceliq${s})"/><rect x="374" y="78" width="156" height="240" rx="8" fill="#8eb0c4" opacity=".4"/></g><g data-part="cap"><rect x="148" y="48" width="44" height="44" rx="4" fill="#1a3a52"/><rect x="426" y="22" width="52" height="40" rx="4" fill="#12202c"/></g><circle cx="160" cy="160" r="48" fill="url(#ices${s})"/><path data-part="label" d="M40 44h150M40 64h96" stroke="#1a3a52" stroke-width="2"/>`), slot, defs, fit);
    }
    if (s === 3) {
      return wrap(id, alt, mark(`<rect width="640" height="420" fill="#d5e1ea"/><circle data-part="label" cx="168" cy="210" r="90" fill="#b9cdd8"/><circle cx="168" cy="210" r="54" fill="#eef5f8"/><rect data-part="glass" x="300" y="70" width="120" height="280" rx="10" fill="url(#iceg${s})"/><rect data-part="liquid" x="316" y="96" width="88" height="230" rx="7" fill="url(#iceliq${s})"/><rect data-part="cap" x="338" y="36" width="44" height="42" rx="4" fill="#1a3a52"/><circle cx="360" cy="140" r="50" fill="url(#ices${s})"/><path d="M40 72h120" stroke="#1a3a52" stroke-width="2"/>`), slot, defs, fit);
    }
    return wrap(id, alt, mark(`<rect width="640" height="420" fill="#dce6ee"/><rect y="312" width="640" height="108" fill="#c5d3de"/><ellipse cx="418" cy="312" rx="130" ry="16" fill="#9aafbd" opacity=".4"/><rect data-part="glass" x="368" y="78" width="108" height="234" rx="10" fill="url(#iceg${s})"/><rect data-part="liquid" x="380" y="96" width="84" height="198" rx="7" fill="url(#iceliq${s})"/><path d="M388 118h68v148c0 22-14 38-34 38s-34-16-34-38z" fill="#7ea8bc" opacity=".45"/><g data-part="cap"><rect x="396" y="42" width="52" height="42" rx="4" fill="#1a3a52"/><rect x="408" y="28" width="28" height="18" rx="3" fill="#12202c"/></g><circle cx="412" cy="148" r="46" fill="url(#ices${s})"/><path data-part="label" d="M36 64h170M36 88h110" stroke="#1a3a52" stroke-width="2"/><circle cx="118" cy="248" r="70" fill="#c5d3de" opacity=".7"/>`), slot, defs, fit);
  }
  const defs = `<linearGradient id="org${s}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a120c"/><stop offset=".36" stop-color="#c4a15a"/><stop offset=".62" stop-color="#2a211c"/><stop offset="1" stop-color="#7a5c2a"/></linearGradient><radialGradient id="ors${s}" cx=".34" cy=".2" r=".6"><stop offset="0" stop-color="#f4ead8" stop-opacity=".55"/><stop offset="1" stop-color="#f4ead8" stop-opacity="0"/></radialGradient><linearGradient id="orliq${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4a15a" stop-opacity=".08"/><stop offset=".4" stop-color="#6a4a24" stop-opacity=".55"/><stop offset="1" stop-color="#1a120c" stop-opacity=".85"/></linearGradient>`;
  const mark = (inner: string) => `<g data-bottle="${bottle}">${inner}</g>`;
  if (s === 1) {
    return wrap(id, alt, mark(`<rect width="640" height="420" fill="#120e0c"/><ellipse cx="328" cy="396" rx="170" ry="26" fill="#000" opacity=".55"/><path data-part="glass" d="M236 8c14-86 154-86 168 0v292c0 58-32 92-84 92s-84-34-84-92z" fill="url(#org${s})"/><path data-part="liquid" d="M258 28c10-62 114-62 124 0v264c0 46-24 74-62 74s-62-28-62-74z" fill="url(#orliq${s})"/><ellipse cx="320" cy="46" rx="58" ry="12" fill="#f4ead8" opacity=".2"/><circle cx="300" cy="108" r="62" fill="url(#ors${s})"/><g data-part="cap"><rect x="292" y="-16" width="56" height="52" rx="6" fill="#c4a15a"/><rect x="304" y="-28" width="32" height="18" rx="3" fill="#8a6a32"/></g>`), slot, defs, fit);
  }
  if (s === 2) {
    return wrap(id, alt, mark(`<rect width="640" height="420" fill="#1d1714"/><ellipse cx="320" cy="390" rx="220" ry="22" fill="#000" opacity=".4"/><g data-part="glass"><path d="M150 96c8-56 68-56 76 0v210c0 38-16 60-38 60s-38-22-38-60z" fill="url(#org${s})"/><path d="M368 64c10-66 92-66 104 0v248c0 48-20 74-52 74s-52-26-52-74z" fill="#2a211c"/></g><path data-part="liquid" d="M384 80c8-52 72-52 82 0v220c0 40-16 60-41 60s-41-20-41-60z" fill="url(#orliq${s})"/><g data-part="cap"><rect x="172" y="44" width="36" height="58" fill="#f4ead8"/><rect x="400" y="18" width="40" height="54" fill="#c4a15a"/></g><circle cx="200" cy="160" r="40" fill="url(#ors${s})"/><path data-part="label" d="M36 52h150M36 74h96" stroke="#c4a15a" stroke-width="1.6"/>`), slot, defs, fit);
  }
  if (s === 3) {
    return wrap(id, alt, mark(`<rect width="640" height="420" fill="#0e0b09"/><circle data-part="label" cx="150" cy="210" r="88" fill="#1d1714"/><circle cx="150" cy="210" r="52" fill="#c4a15a" opacity=".18"/><path data-part="glass" d="M320 70c10-60 90-60 100 0v240c0 48-22 74-50 74s-50-26-50-74z" fill="url(#org${s})"/><path data-part="liquid" d="M338 90c8-46 64-46 72 0v210c0 38-16 58-36 58s-36-20-36-58z" fill="url(#orliq${s})"/><rect data-part="cap" x="354" y="36" width="40" height="44" rx="5" fill="#c4a15a"/><circle cx="370" cy="140" r="48" fill="url(#ors${s})"/><path d="M40 64h120" stroke="#c4a15a" stroke-width="1.6"/><circle cx="150" cy="210" r="8" fill="#c4a15a"/>`), slot, defs, fit);
  }
  return wrap(id, alt, mark(`<rect width="640" height="420" fill="#120e0c"/><ellipse cx="428" cy="338" rx="120" ry="20" fill="#000" opacity=".5"/><path data-part="glass" d="M384 148c10-76 92-76 102 0v168c0 44-20 68-51 68s-51-24-51-68z" fill="url(#org${s})"/><path data-part="liquid" d="M398 160c8-58 70-58 78 0v148c0 36-16 56-39 56s-39-20-39-56z" fill="url(#orliq${s})"/><g data-part="cap"><rect x="418" y="84" width="28" height="72" rx="5" fill="#f4ead8"/><rect x="412" y="62" width="40" height="30" rx="4" fill="#c4a15a"/></g><circle cx="430" cy="196" r="52" fill="url(#ors${s})"/><path data-part="label" d="M40 64h160M40 88h100" stroke="#c4a15a" stroke-width="1.6"/><circle cx="118" cy="248" r="68" fill="#1d1714"/><circle cx="118" cy="248" r="8" fill="#c4a15a" opacity=".7"/>`), slot, defs, fit);
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
  const shade = ink ? "#a89070" : "#241c18";
  const metal = ink ? "#e8dcc8" : "#1a1614";
  return `<g data-part="dress-form">
    <ellipse cx="${cx}" cy="394" rx="56" ry="8" fill="${metal}" opacity=".88"/>
    <path d="M${cx} 270 L${cx - 44} 394 M${cx} 270 L${cx + 44} 394 M${cx} 270 L${cx} 394" stroke="${metal}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="${cx}" cy="270" rx="11" ry="4.5" fill="${metal}"/>
    <rect x="${cx - 4}" y="248" width="8" height="24" fill="${metal}"/>
    <ellipse cx="${cx}" cy="250" rx="40" ry="9" fill="${canvas}"/>
    <path d="M${cx - 50} 104 L${cx - 54} 114 C${cx - 52} 142 ${cx - 46} 164 ${cx - 40} 176 C${cx - 32} 198 ${cx - 28} 218 ${cx - 26} 232 C${cx - 30} 242 ${cx - 38} 248 ${cx - 40} 250 L${cx + 40} 250 C${cx + 38} 248 ${cx + 30} 242 ${cx + 26} 232 C${cx + 28} 218 ${cx + 32} 198 ${cx + 40} 176 C${cx + 46} 164 ${cx + 52} 142 ${cx + 54} 114 L${cx + 50} 104 C${cx + 26} 94 ${cx - 26} 94 ${cx - 50} 104Z" fill="${canvas}"/>
    <path d="M${cx + 8} 114 C${cx + 20} 150 ${cx + 16} 200 ${cx + 12} 246" fill="${shade}" opacity=".35"/>
    <rect x="${cx - 8}" y="82" width="16" height="24" rx="3" fill="${canvas}"/>
    <ellipse cx="${cx}" cy="80" rx="15" ry="6.5" fill="${canvas}"/>
    <ellipse cx="${cx}" cy="78" rx="11" ry="4" fill="${metal}"/>
  </g>`;
}

function coatOnForm(cx: number, s: number, ink: boolean): string {
  const stitch = ink ? "#1a1614" : "#c9b496";
  const button = ink ? "#1a1614" : "#f6f1ea";
  const hole = ink ? "#c9b496" : "#161412";
  const fold = ink ? "#000" : "#fff";
  return `${dressForm(cx, ink)}
  <g data-part="garment" data-garment="coat">
    <g data-part="sleeve">
      <path d="M${cx - 56} 108 L${cx - 92} 128 L${cx - 108} 186 L${cx - 112} 236 L${cx - 98} 258 L${cx - 76} 254 L${cx - 72} 176 L${cx - 58} 122 Z" fill="url(#slv${s})"/>
      <path data-part="cuff" d="M${cx - 114} 246 L${cx - 76} 254 L${cx - 74} 268 L${cx - 118} 258 Z" fill="url(#fab${s})"/>
      <path data-part="fold" d="M${cx - 100} 186 L${cx - 86} 192 L${cx - 76} 184" fill="none" stroke="${fold}" stroke-width="1.4" opacity=".25"/>
      <path d="M${cx - 90} 150 L${cx - 98} 230" fill="none" stroke="${stitch}" stroke-width="1" opacity=".4"/>
      <path d="M${cx + 56} 108 L${cx + 92} 128 L${cx + 108} 186 L${cx + 112} 236 L${cx + 98} 258 L${cx + 76} 254 L${cx + 72} 176 L${cx + 58} 122 Z" fill="url(#slv${s})"/>
      <path data-part="cuff" d="M${cx + 114} 246 L${cx + 76} 254 L${cx + 74} 268 L${cx + 118} 258 Z" fill="url(#fab${s})"/>
      <path data-part="fold" d="M${cx + 100} 186 L${cx + 86} 192 L${cx + 76} 184" fill="none" stroke="${fold}" stroke-width="1.4" opacity=".25"/>
      <path d="M${cx + 90} 150 L${cx + 98} 230" fill="none" stroke="${stitch}" stroke-width="1" opacity=".4"/>
    </g>
    <path data-part="lining" d="M${cx - 18} 92 L${cx + 18} 92 L${cx + 36} 168 L${cx + 8} 186 L${cx - 8} 186 L${cx - 36} 168 Z" fill="url(#lin${s})"/>
    <path d="M${cx - 8} 96 L${cx - 6} 176 L${cx + 10} 182 L${cx + 8} 96Z" fill="#000" opacity=".28"/>
    <path d="M${cx - 62} 336 L${cx - 58} 352 L${cx + 58} 352 L${cx + 62} 336 Z" fill="url(#lin${s})"/>
    <path data-part="body" d="M${cx - 8} 92 L${cx - 54} 100 L${cx - 82} 112 L${cx - 86} 124 L${cx - 78} 168 L${cx - 64} 226 L${cx - 58} 268 L${cx - 66} 336 L${cx - 66} 344 L${cx + 8} 344 L${cx + 10} 186 L${cx - 8} 168 Z" fill="url(#fab${s})"/>
    <path d="M${cx + 8} 92 L${cx + 54} 100 L${cx + 82} 112 L${cx + 86} 124 L${cx + 78} 168 L${cx + 64} 226 L${cx + 58} 268 L${cx + 66} 336 L${cx + 66} 344 L${cx - 4} 344 L${cx - 6} 190 L${cx + 12} 176 Z" fill="url(#fab${s})"/>
    <path data-part="shoulder" d="M${cx - 86} 112 L${cx - 54} 100 L${cx + 54} 100 L${cx + 86} 112 L${cx + 78} 122 L${cx - 78} 122 Z" fill="url(#slv${s})"/>
    <path data-part="waist" d="M${cx - 64} 226 L${cx + 64} 226" fill="none" stroke="${stitch}" stroke-width="1.3" opacity=".45"/>
    <g data-part="lapel">
      <path d="M${cx - 8} 92 L${cx - 28} 78 L${cx - 44} 118 L${cx - 38} 168 L${cx - 8} 168 Z" fill="url(#fab${s})" stroke="${stitch}" stroke-width="0.9"/>
      <path d="M${cx + 8} 92 L${cx + 28} 78 L${cx + 44} 118 L${cx + 38} 168 L${cx + 12} 176 Z" fill="url(#fab${s})" stroke="${stitch}" stroke-width="0.9"/>
      <path d="M${cx - 26} 96 L${cx - 10} 118 L${cx - 18} 84 Z M${cx + 26} 96 L${cx + 12} 118 L${cx + 18} 84 Z" fill="url(#lin${s})"/>
    </g>
    <path data-part="collar" d="M${cx - 22} 72 L${cx} 62 L${cx + 22} 72 L${cx + 12} 90 L${cx} 80 L${cx - 12} 90 Z" fill="url(#fab${s})"/>
    <g data-part="seam" fill="none" stroke="${stitch}" stroke-width="1" opacity=".5">
      <path d="M${cx - 48} 124 L${cx - 58} 226 L${cx - 52} 336"/>
      <path d="M${cx + 48} 124 L${cx + 58} 226 L${cx + 52} 336"/>
      <path d="M${cx + 8} 186 L${cx + 8} 344"/>
    </g>
    <g data-part="pocket">
      <rect x="${cx - 58}" y="252" width="40" height="7" rx="1" fill="none" stroke="${stitch}" stroke-width="1.3"/>
      <rect x="${cx + 18}" y="252" width="40" height="7" rx="1" fill="none" stroke="${stitch}" stroke-width="1.3"/>
      <path d="M${cx - 58} 252h40 M${cx + 18} 252h40" stroke="${stitch}" stroke-width="2"/>
    </g>
    <g data-part="button">
      ${[186, 226, 266, 306].map((y) => `<circle cx="${cx + 14}" cy="${y}" r="4.6" fill="${button}"/><circle cx="${cx + 12.8}" cy="${y - 1.2}" r="1" fill="${hole}"/>`).join("")}
    </g>
    <path data-part="hem" d="M${cx - 66} 336 L${cx - 66} 344 L${cx + 66} 344 L${cx + 66} 336 Z" fill="url(#lin${s})"/>
    <path data-part="fold" d="M${cx - 30} 140 L${cx - 26} 226 L${cx - 34} 320" fill="none" stroke="${fold}" stroke-width="6" opacity=".16"/>
    <path d="M${cx + 22} 150 L${cx + 18} 240 L${cx + 26} 318" fill="none" stroke="${fold}" stroke-width="4" opacity=".1"/>
    <path d="M${cx - 70} 116 L${cx - 20} 104 L${cx + 48} 110 L${cx + 72} 128" fill="url(#she${s})"/>
    <ellipse cx="${cx - 70}" cy="130" rx="18" ry="10" fill="#000" opacity=".08"/>
    <ellipse cx="${cx + 70}" cy="130" rx="18" ry="10" fill="#000" opacity=".08"/>
  </g>
  <ellipse cx="${cx}" cy="396" rx="90" ry="10" fill="#000" opacity=".18"/>`;
}

function columnDress(cx: number, s: number, ink: boolean): string {
  const stitch = ink ? "#1a1614" : "#c9b496";
  const strap = ink ? "#f3ece3" : "#161412";
  const fold = ink ? "#000" : "#fff";
  return `${dressForm(cx, ink)}
  <g data-part="garment" data-garment="dress">
    <path data-part="sleeve" d="M${cx - 48} 106 C${cx - 70} 122 ${cx - 78} 152 ${cx - 62} 174 L${cx - 42} 168 C${cx - 50} 148 ${cx - 46} 124 ${cx - 34} 112Z M${cx + 48} 106 C${cx + 70} 122 ${cx + 78} 152 ${cx + 62} 174 L${cx + 42} 168 C${cx + 50} 148 ${cx + 46} 124 ${cx + 34} 112Z" fill="url(#slv${s})"/>
    <path data-part="bodice" d="M${cx - 42} 100 C${cx - 52} 118 ${cx - 50} 140 ${cx - 38} 156 C${cx - 28} 172 ${cx - 22} 178 ${cx - 18} 182 L${cx + 18} 182 C${cx + 22} 178 ${cx + 28} 172 ${cx + 38} 156 C${cx + 50} 140 ${cx + 52} 118 ${cx + 42} 100 C${cx + 16} 90 ${cx - 16} 90 ${cx - 42} 100Z" fill="url(#fab${s})"/>
    <path d="M${cx - 20} 96 C${cx - 24} 86 ${cx - 16} 80 ${cx - 8} 90 L${cx - 14} 106Z M${cx + 20} 96 C${cx + 24} 86 ${cx + 16} 80 ${cx + 8} 90 L${cx + 14} 106Z" fill="${strap}"/>
    <path data-part="waist" d="M${cx - 20} 178 L${cx + 20} 178 L${cx + 26} 190 L${cx - 26} 190Z" fill="url(#lin${s})"/>
    <path data-part="column" d="M${cx - 26} 188 C${cx - 34} 230 ${cx - 40} 278 ${cx - 52} 338 L${cx - 40} 352 L${cx - 16} 346 L${cx} 354 L${cx + 16} 346 L${cx + 40} 352 L${cx + 52} 338 C${cx + 40} 278 ${cx + 34} 230 ${cx + 26} 188Z" fill="url(#fab${s})"/>
    <path data-part="hip" d="M${cx - 28} 200 C${cx - 36} 230 ${cx - 32} 250 ${cx - 24} 258 L${cx + 24} 258 C${cx + 32} 250 ${cx + 36} 230 ${cx + 28} 200Z" fill="url(#slv${s})" opacity=".35"/>
    <g data-part="fold">
      <path d="M${cx - 18} 196 C${cx - 28} 250 ${cx - 36} 300 ${cx - 40} 342" fill="none" stroke="${fold}" stroke-width="2.4" opacity=".18"/>
      <path d="M${cx - 4} 192 C${cx - 8} 250 ${cx - 6} 310 ${cx - 8} 348" fill="none" stroke="${fold}" stroke-width="1.6" opacity=".2"/>
      <path d="M${cx + 10} 194 C${cx + 18} 250 ${cx + 24} 305 ${cx + 30} 344" fill="none" stroke="${fold}" stroke-width="2" opacity=".16"/>
      <path d="M${cx + 20} 220 C${cx + 8} 228 ${cx - 8} 226 ${cx - 18} 218" fill="none" stroke="${stitch}" stroke-width="1" opacity=".35"/>
      <path d="M${cx - 22} 280 C${cx - 10} 292 ${cx + 12} 288 ${cx + 24} 276" fill="url(#slv${s})" opacity=".2"/>
    </g>
    <path data-part="seam" d="M${cx} 182 v166" fill="none" stroke="${stitch}" stroke-width="1"/>
    <path d="M${cx - 14} 214 C${cx} 224 ${cx + 14} 214 ${cx + 14} 214" fill="none" stroke="${stitch}" stroke-width="1" opacity=".45"/>
    <path data-part="hem" d="M${cx - 52} 336 L${cx - 44} 356 C${cx - 16} 366 ${cx + 16} 366 ${cx + 44} 356 L${cx + 52} 336Z" fill="url(#lin${s})"/>
    <path data-part="lining" d="M${cx - 40} 348 C${cx - 12} 360 ${cx + 12} 360 ${cx + 40} 348" fill="none" stroke="url(#lin${s})" stroke-width="3.4"/>
    ${[166, 198, 228].map((y) => `<circle cx="${cx + 11}" cy="${y}" r="2.4" fill="${strap}"/>`).join("")}
    <path d="M${cx - 30} 118 C${cx} 100 ${cx + 38} 110 ${cx + 48} 138" fill="url(#she${s})"/>
  </g>
  <ellipse cx="${cx}" cy="396" rx="82" ry="9" fill="#000" opacity=".18"/>`;
}

function hangTrousers(cx: number, s: number, ink: boolean): string {
  const hook = ink ? "#c9b496" : "#161412";
  const wood = ink ? "#e8dcc8" : "#3a322c";
  const stitch = ink ? "#1a1614" : "#c9b496";
  const fold = ink ? "#000" : "#fff";
  const shadow = ink ? "#000" : "#1a1614";
  return `<g data-part="garment" data-garment="trousers">
    <g data-part="hanger">
      <path d="M${cx} 36 C${cx + 16} 22 ${cx + 30} 40 ${cx + 22} 56" fill="none" stroke="${hook}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M${cx - 92} 72 L${cx} 54 L${cx + 92} 72 L${cx + 80} 88 H${cx - 80}Z" fill="${wood}"/>
      <path d="M${cx - 70} 78 L${cx} 64 L${cx + 70} 78" fill="none" stroke="${hook}" stroke-width="1.2" opacity=".35"/>
      <path d="M${cx - 80} 88 H${cx + 80}" stroke="${shadow}" stroke-width="2" opacity=".2"/>
    </g>
    <path data-part="waistband" d="M${cx - 70} 86 H${cx + 70} V108 C${cx + 42} 118 ${cx + 18} 122 ${cx} 122 C${cx - 18} 122 ${cx - 42} 118 ${cx - 70} 108Z" fill="url(#fab${s})"/>
    <path d="M${cx - 70} 86 H${cx + 70} V94 H${cx - 70}Z" fill="url(#slv${s})" opacity=".55"/>
    ${[-56, -34, -12, 12, 34, 56].map((dx) => `<rect x="${cx + dx - 2.4}" y="90" width="4.8" height="14" rx="0.8" fill="${hook}" opacity=".8"/>`).join("")}
    <path data-part="seat" d="M${cx - 68} 108 C${cx - 74} 128 ${cx - 70} 148 ${cx - 54} 168 C${cx - 28} 186 ${cx + 28} 186 ${cx + 54} 168 C${cx + 70} 148 ${cx + 74} 128 ${cx + 68} 108 C${cx + 40} 120 ${cx - 40} 120 ${cx - 68} 108Z" fill="url(#fab${s})"/>
    <path d="M${cx - 40} 124 C${cx - 20} 148 ${cx + 20} 148 ${cx + 40} 124" fill="none" stroke="${stitch}" stroke-width="1.1" opacity=".45"/>
    <path data-part="fly" d="M${cx} 108 V150 C${cx - 6} 158 ${cx - 12} 164 ${cx - 16} 168" fill="none" stroke="${stitch}" stroke-width="1.3"/>
    <g data-part="leg">
      <path d="M${cx - 68} 108 C${cx - 72} 130 ${cx - 64} 150 ${cx - 52} 168 L${cx - 18} 176 C${cx - 22} 230 ${cx - 28} 286 ${cx - 22} 340 L${cx - 30} 358 H${cx - 78} L${cx - 70} 340 C${cx - 84} 270 ${cx - 90} 210 ${cx - 78} 160 C${cx - 74} 136 ${cx - 70} 118 ${cx - 68} 108Z" fill="url(#fab${s})"/>
      <path d="M${cx - 62} 170 C${cx - 70} 220 ${cx - 66} 280 ${cx - 58} 336" fill="${shadow}" opacity=".12"/>
      <path data-part="crease" d="M${cx - 44} 172 C${cx - 46} 230 ${cx - 50} 290 ${cx - 46} 346" fill="none" stroke="${stitch}" stroke-width="1.25"/>
      <path data-part="drape" d="M${cx - 74} 210 C${cx - 62} 218 ${cx - 50} 214 ${cx - 40} 204" fill="none" stroke="${fold}" stroke-width="2.2" opacity=".22"/>
      <path d="M${cx - 76} 268 C${cx - 60} 280 ${cx - 46} 274 ${cx - 36} 262" fill="url(#slv${s})" opacity=".25"/>
      <path data-part="cuff" d="M${cx - 80} 350 H${cx - 24} V366 H${cx - 80}Z" fill="url(#lin${s})"/>
      <path d="M${cx - 78} 358 H${cx - 28}" stroke="${stitch}" stroke-width="1" opacity=".4"/>
    </g>
    <g data-part="leg">
      <path d="M${cx + 68} 108 C${cx + 72} 130 ${cx + 64} 150 ${cx + 52} 168 L${cx + 18} 176 C${cx + 22} 230 ${cx + 28} 286 ${cx + 22} 340 L${cx + 30} 358 H${cx + 78} L${cx + 70} 340 C${cx + 84} 270 ${cx + 90} 210 ${cx + 78} 160 C${cx + 74} 136 ${cx + 70} 118 ${cx + 68} 108Z" fill="url(#fab${s})"/>
      <path d="M${cx + 40} 176 C${cx + 48} 230 ${cx + 52} 290 ${cx + 46} 336" fill="${shadow}" opacity=".1"/>
      <path data-part="crease" d="M${cx + 44} 172 C${cx + 46} 230 ${cx + 50} 290 ${cx + 46} 346" fill="none" stroke="${stitch}" stroke-width="1.25"/>
      <path data-part="drape" d="M${cx + 74} 210 C${cx + 62} 218 ${cx + 50} 214 ${cx + 40} 204" fill="none" stroke="${fold}" stroke-width="2.2" opacity=".22"/>
      <path d="M${cx + 76} 268 C${cx + 60} 280 ${cx + 46} 274 ${cx + 36} 262" fill="url(#slv${s})" opacity=".25"/>
      <path data-part="cuff" d="M${cx + 24} 350 H${cx + 80} V366 H${cx + 24}Z" fill="url(#lin${s})"/>
      <path d="M${cx + 28} 358 H${cx + 78}" stroke="${stitch}" stroke-width="1" opacity=".4"/>
    </g>
    <path d="M${cx - 8} 168 C${cx} 210 ${cx} 260 ${cx} 300" fill="none" stroke="${shadow}" stroke-width="10" opacity=".08"/>
    <g data-part="pocket">
      <path d="M${cx - 62} 128 h24 v30 h-24z" fill="none" stroke="${stitch}" stroke-width="1.15"/>
      <path d="M${cx + 38} 128 h24 v30 h-24z" fill="none" stroke="${stitch}" stroke-width="1.15"/>
      <path d="M${cx - 62} 128 h24" stroke="${stitch}" stroke-width="2"/>
      <path d="M${cx + 38} 128 h24" stroke="${stitch}" stroke-width="2"/>
    </g>
    <path data-part="seam" d="M${cx - 16} 118 C${cx - 10} 140 ${cx - 20} 160 ${cx - 22} 174 M${cx + 16} 118 C${cx + 10} 140 ${cx + 20} 160 ${cx + 22} 174" fill="none" stroke="${stitch}" stroke-width="1.05"/>
    <path d="M${cx - 40} 100 C${cx} 88 ${cx + 48} 98 ${cx + 64} 118" fill="url(#she${s})"/>
  </g>
  <ellipse cx="${cx}" cy="378" rx="118" ry="12" fill="#000" opacity=".16"/>`;
}

function skirtOnForm(cx: number, s: number, ink: boolean): string {
  const stitch = ink ? "#1a1614" : "#c9b496";
  const fold = ink ? "#000" : "#fff";
  const pleats = Array.from({ length: 8 }, (_, i) => {
    const x0 = cx - 52 + i * 13;
    const x1 = x0 + 8;
    const hem0 = cx - 78 + i * 19.5;
    const hem1 = hem0 + 14;
    const shade = i % 2 === 0 ? `url(#fab${s})` : `url(#slv${s})`;
    return `<path d="M${x0} 118 L${x1} 118 L${hem1} 348 L${hem0} 348Z" fill="${shade}"/>`;
  }).join("");
  return `${dressForm(cx, ink)}
  <g data-part="garment" data-garment="skirt">
    <path data-part="waistband" d="M${cx - 44} 102 C${cx - 20} 96 ${cx + 20} 96 ${cx + 44} 102 L${cx + 48} 118 H${cx - 48}Z" fill="url(#fab${s})"/>
    <g data-part="pleat">${pleats}</g>
    <g data-part="fold" fill="none" stroke="${fold}" stroke-width="1.1" opacity=".2">
      <path d="M${cx - 30} 124 L${cx - 52} 340"/>
      <path d="M${cx - 4} 124 L${cx - 12} 342"/>
      <path d="M${cx + 20} 124 L${cx + 28} 340"/>
      <path d="M${cx + 40} 124 L${cx + 64} 342"/>
    </g>
    <g data-part="seam" fill="none" stroke="${stitch}" stroke-width="0.9" opacity=".45">
      <path d="M${cx} 118 v226"/>
      <path d="M${cx - 44} 118 L${cx - 70} 348"/>
      <path d="M${cx + 44} 118 L${cx + 70} 348"/>
    </g>
    <path data-part="hem" d="M${cx - 80} 344 C${cx - 40} 356 ${cx + 40} 356 ${cx + 80} 344 L${cx + 76} 352 C${cx + 36} 362 ${cx - 36} 362 ${cx - 76} 352Z" fill="url(#lin${s})"/>
    <path data-part="lining" d="M${cx - 70} 348 C${cx - 30} 358 ${cx + 30} 358 ${cx + 70} 348" fill="none" stroke="url(#lin${s})" stroke-width="4"/>
  </g>
  <ellipse cx="${cx}" cy="396" rx="96" ry="10" fill="#000" opacity=".18"/>`;
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
  const framed = `<g transform="translate(320 208) scale(0.9) translate(-320 -208)">${subject}</g>`;
  return wrap(id, alt, `${set}${framed}`, s, defs);
}

function bookingArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-booking-${variant}`;
  const s = slot % 4;
  const rooms = variant === 1 ? (["taglio", "lino", "forbici", "nastro"] as const) : (["sala", "poltrona", "orologio", "finestra"] as const);
  const room = rooms[s]!;
  if (variant === 1) {
    const defs = `<linearGradient id="ln${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf1"/><stop offset="1" stop-color="#e8dcc8"/></linearGradient>`;
    const table = `<g data-part="table"><rect x="70" y="110" width="360" height="200" fill="url(#ln${s})"/><rect x="90" y="130" width="320" height="12" fill="#8a4b2e"/><rect x="90" y="168" width="280" height="6" fill="#c9b496" opacity=".55"/><rect x="90" y="196" width="240" height="6" fill="#c9b496" opacity=".35"/></g>`;
    const shears = `<g data-part="shears"><path d="M470 150l70 40-24 70-70-40z" fill="#2a2118"/><path d="M490 170l36 20" stroke="#8a4b2e" stroke-width="4"/><circle cx="486" cy="178" r="8" fill="#8a4b2e"/></g>`;
    const bolt = `<g data-part="linen"><rect x="96" y="220" width="180" height="70" fill="#f4efe4" stroke="#c9b496"/><path d="M104 236h160M104 252h120" stroke="#8a4b2e" stroke-width="1.4" opacity=".45"/></g>`;
    if (s === 1) return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#f4efe4"/><rect x="40" y="70" width="560" height="280" rx="8" fill="#fffaf1" stroke="#e0d4c4"/>${table}${bolt}<circle cx="${190 + s * 18}" cy="250" r="16" fill="#8a4b2e" opacity=".25"/></g>`, s, defs);
    if (s === 2) return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#ebe3d4"/><rect x="48" y="56" width="544" height="308" fill="#fffaf1"/>${shears}${table}<path d="M64 80h180" stroke="#2a2118" stroke-width="4"/></g>`, s, defs);
    if (s === 3) return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#f4efe4"/><rect x="80" y="180" width="480" height="64" rx="10" fill="#8a4b2e"/><g fill="#fffaf1">${Array.from({ length: 16 }, (_, i) => `<rect x="${96 + i * 28}" y="188" width="2" height="${i % 5 === 0 ? 40 : 18}"/>`).join("")}</g>${bolt}</g>`, s, defs);
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#f4efe4"/><rect x="40" y="70" width="560" height="280" rx="8" fill="#fffaf1" stroke="#e0d4c4"/>${table}${shears}<circle cx="${160 + s * 30}" cy="250" r="18" fill="#8a4b2e" opacity=".3"/></g>`, s, defs);
  }
  const defs = `<linearGradient id="bk${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8eef4"/><stop offset="1" stop-color="#d3dce4"/></linearGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#1f6f68"/><rect data-part="seat" x="80" y="140" width="200" height="160" rx="18" fill="#e8eef4"/><rect data-part="window" x="340" y="70" width="240" height="160" rx="16" fill="#d3dce4"/><path d="M370 110h180M370 140h120" stroke="#1c242c" stroke-width="6" stroke-linecap="round"/><circle cx="180" cy="300" r="40" fill="#e8eef4"/></g>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#164f4a"/><circle data-part="clock" cx="320" cy="190" r="110" fill="#e8eef4"/><circle cx="320" cy="190" r="8" fill="#1c242c"/><path d="M320 190 L320 120 M320 190 L372 214" stroke="#1c242c" stroke-width="6" stroke-linecap="round"/><rect x="70" y="330" width="200" height="10" fill="#1c242c"/></g>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#1f6f68"/><rect data-part="window" x="70" y="56" width="500" height="260" rx="8" fill="url(#bk${s})"/><path d="M70 186h500" stroke="#1c242c" stroke-width="8"/><path d="M320 56v260" stroke="#1c242c" stroke-width="8"/><rect x="96" y="330" width="240" height="12" fill="#1c242c"/></g>`, s, defs);
  }
  return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#1f6f68"/><rect data-part="seat" x="36" y="48" width="280" height="200" rx="18" fill="#e8eef4"/><rect x="70" y="80" width="90" height="130" rx="8" fill="#1c242c"/><rect x="180" y="120" width="100" height="90" rx="10" fill="#d3dce4"/><circle cx="170" cy="300" r="${36 + s * 4}" fill="#e8eef4"/><rect data-part="window" x="340" y="70" width="240" height="160" rx="16" fill="#d3dce4"/><path d="M370 110h180M370 140h120" stroke="#1c242c" stroke-width="6" stroke-linecap="round"/><rect x="70" y="330" width="200" height="10" fill="#1c242c"/></g>`, s, defs);
}

function opsArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-ops-${variant}`;
  const s = slot % 4;
  const scenes = variant === 1 ? (["cassetta", "raccolto", "serra", "andamento"] as const) : (["mill", "light", "dock", "yarn"] as const);
  const scene = scenes[s]!;
  if (variant === 1) {
    const crate = (x: number, y: number, w: number, h: number) =>
      `<g data-part="crate" transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="4" fill="#3d5a1f"/><path d="M0 ${h * 0.35}h${w}M${w * 0.18} 0v${h}M${w * 0.82} 0v${h}" stroke="#e7efe2" stroke-width="2" opacity=".35"/><ellipse cx="${w * 0.5}" cy="${h * 0.22}" rx="${w * 0.22}" ry="${h * 0.12}" fill="#c45c26" opacity=".8"/></g>`;
    if (s === 1) {
      return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#e7efe2"/><path d="M0 260 C120 220 240 280 360 230 C480 190 560 240 640 210 V420 H0Z" fill="#3d5a1f" opacity=".35"/><path d="M40 300 C90 250 140 270 160 320" fill="#3d5a1f"/><path d="M220 310 C270 240 330 250 350 330" fill="#3d5a1f"/>${crate(420, 240, 140, 90)}<path d="M52 64h220" stroke="#1c2a18" stroke-width="6" stroke-linecap="round"/></g>`, s);
    }
    if (s === 2) {
      return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#d5e4d0"/><rect x="80" y="70" width="480" height="260" fill="#f4f8f0" stroke="#3d5a1f"/><path d="M80 70 L320 20 L560 70" fill="#3d5a1f"/><g fill="#7d9a6a">${Array.from({ length: 8 }, (_, i) => `<rect x="${110 + (i % 4) * 110}" y="${110 + Math.floor(i / 4) * 90}" width="70" height="54" rx="4"/>`).join("")}</g></g>`, s);
    }
    if (s === 3) {
      const bars = [48, 96, 140, 88, 120, 72].map((h, i) => `<rect x="${80 + i * 80}" y="${300 - h}" width="36" height="${h}" rx="3" fill="#3d5a1f"/>`);
      return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#e7efe2"/><path d="M52 64h220M52 88h150" stroke="#1c2a18" stroke-width="6" stroke-linecap="round"/>${bars.join("")}<path d="M80 210l70-40 60 24 80-52 70 18 90-30" fill="none" stroke="#c45c26" stroke-width="3"/></g>`, s);
    }
    return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#e7efe2"/><rect x="28" y="36" width="584" height="348" rx="10" fill="#f4f8f0"/>${crate(70, 180, 160, 110)}${crate(260, 200, 140, 90)}${crate(430, 170, 150, 120)}<path d="M52 64h220M52 88h150" stroke="#1c2a18" stroke-width="6" stroke-linecap="round"/></g>`, s);
  }
  if (s === 1) {
    return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#0b1220"/><path data-part="aurora" d="M0 160 C80 80 160 200 240 90 C320 20 400 170 480 70 C560 10 620 110 640 80 V0 H0Z" fill="#2ec8c0" opacity=".35"/><path d="M0 180 C120 100 220 210 340 110 C460 40 560 160 640 100" fill="none" stroke="#d4a017" stroke-width="2" opacity=".5"/><rect data-part="tower" x="292" y="140" width="22" height="180" fill="#e7e1d4"/><polygon points="280,140 326,140 304,86" fill="#d4a017"/><ellipse cx="304" cy="330" rx="70" ry="12" fill="#000" opacity=".4"/></g>`, s);
  }
  if (s === 2) {
    return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#10151c"/><rect y="250" width="640" height="170" fill="#171e28"/><path data-part="hull" d="M80 250 L160 180 H480 L560 250 Z" fill="#2a3544"/><rect x="200" y="196" width="28" height="54" fill="#9ec8d4" opacity=".35"/><rect x="250" y="196" width="28" height="54" fill="#9ec8d4" opacity=".2"/><g data-part="crane"><path d="M520 80 v200 M520 80 h-140" stroke="#d4a017" stroke-width="6"/><path d="M380 80 v90" stroke="#e7e1d4" stroke-width="2"/><rect x="360" y="168" width="40" height="24" fill="#d4a017"/></g><path d="M0 250 h640" stroke="#d4a017" stroke-width="2" opacity=".4"/></g>`, s);
  }
  if (s === 3) {
    return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#171e28"/><g data-part="loom"><rect x="90" y="70" width="460" height="280" fill="none" stroke="#e7e1d4" stroke-width="3"/>${Array.from({ length: 14 }, (_, i) => `<path d="M110 ${90 + i * 18} h420" stroke="${i % 3 === 0 ? "#d4a017" : "#e7e1d4"}" stroke-width="${i % 3 === 0 ? 3 : 1.2}" opacity=".7"/>`).join("")}</g><ellipse data-part="skein" cx="160" cy="310" rx="40" ry="24" fill="#d4a017"/><ellipse cx="240" cy="318" rx="34" ry="20" fill="#e7e1d4" opacity=".7"/></g>`, s);
  }
  return wrap(id, alt, `<g data-scene="${scene}"><rect width="640" height="420" fill="#10151c"/><g data-part="mill"><path d="M80 280 L180 140 H300 L400 280 Z" fill="#2a3544"/><rect x="200" y="168" width="80" height="112" fill="#171e28"/><rect x="220" y="188" width="18" height="28" fill="#9ec8d4" opacity=".4"/><rect x="246" y="188" width="18" height="28" fill="#9ec8d4" opacity=".25"/><rect x="310" y="90" width="28" height="190" fill="#4a5564"/><rect x="304" y="70" width="40" height="24" fill="#d4a017"/><ellipse cx="240" cy="300" rx="90" ry="14" fill="#000" opacity=".35"/><g data-part="roll"><ellipse cx="480" cy="250" rx="70" ry="70" fill="#e7e1d4"/><ellipse cx="480" cy="250" rx="24" ry="24" fill="#10151c"/><path d="M480 180 v140" stroke="#10151c" stroke-width="2" opacity=".3"/></g></g></g>`, s);
}

function utilityArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-utility-${variant}`;
  const s = slot % 4;
  const tools = variant === 1 ? (["tape", "pocket", "mark", "fold"] as const) : (["shears", "crop", "grid", "pin"] as const);
  const tool = tools[s]!;
  if (variant === 1) {
    const ticks = Array.from({ length: 18 }, (_, i) => `<rect x="${90 + i * 26}" y="168" width="2" height="${i % 5 === 0 ? 36 : 16}"/>`).join("");
    if (s === 1) {
      return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#111318"/><rect data-part="pocket" x="160" y="90" width="320" height="240" rx="18" fill="#1c2228" stroke="#6ec8b8"/><rect x="190" y="190" width="260" height="48" rx="8" fill="#6ec8b8"/><g fill="#111318">${ticks}</g></g>`, s);
    }
    if (s === 2) {
      return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#0e1216"/><rect x="80" y="80" width="480" height="260" fill="none" stroke="#6ec8b8" stroke-dasharray="10 8"/><path data-part="mark" d="M80 80h28M80 80v28M560 80h-28M560 80v28M80 340h28M80 340v-28M560 340h-28M560 340v-28" stroke="#6ec8b8" stroke-width="4"/><path d="M120 200h400" stroke="#e8e4d8" stroke-width="2"/></g>`, s);
    }
    if (s === 3) {
      return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#111318"/><path data-part="fold" d="M160 80h240l80 80v180H160z" fill="#1c2228" stroke="#6ec8b8"/><path d="M400 80v80h80" fill="none" stroke="#6ec8b8" stroke-width="3"/><path d="M200 160h160M200 190h120" stroke="#e8e4d8" stroke-width="2"/></g>`, s);
    }
    return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#111318"/><rect data-part="tape" x="70" y="160" width="500" height="72" rx="12" fill="#6ec8b8"/><g fill="#111318">${ticks}</g><circle cx="${160 + s * 40}" cy="300" r="28" fill="none" stroke="#6ec8b8" stroke-width="3"/><path d="M80 80h200" stroke="#e8e4d8" stroke-width="4"/></g>`, s);
  }
  if (s === 1) {
    return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#f6f3ee"/><rect x="80" y="70" width="480" height="280" fill="none" stroke="#1b1814" stroke-width="2" stroke-dasharray="8 10"/><path data-part="crop" d="M80 70h28M80 70v28M560 70h-28M560 70v28M80 350h28M80 350v-28M560 350h-28M560 350v-28" stroke="#d6452d" stroke-width="4"/><rect x="140" y="130" width="360" height="180" fill="#fff" stroke="#1b1814"/></g>`, s);
  }
  if (s === 2) {
    return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#f6f3ee"/>${Array.from({ length: 8 }, (_, i) => `<path d="M40 ${70 + i * 36}h560" stroke="#1b1814" opacity=".15"/><path d="M${70 + i * 64} 40v340" stroke="#1b1814" opacity=".15"/>`).join("")}<circle data-part="pin" cx="180" cy="140" r="10" fill="#d6452d"/><circle cx="320" cy="220" r="10" fill="#d6452d"/><circle cx="460" cy="300" r="10" fill="#d6452d"/></g>`, s);
  }
  if (s === 3) {
    return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#f0ece4"/><circle data-part="pin" cx="180" cy="120" r="14" fill="#d6452d"/><circle cx="420" cy="280" r="14" fill="#1b1814"/><path d="M180 120 L420 280" stroke="#1b1814" stroke-width="3" stroke-dasharray="6 8"/><rect x="240" y="160" width="160" height="100" fill="none" stroke="#1b1814" stroke-dasharray="8 10"/></g>`, s);
  }
  return wrap(id, alt, `<g data-tool="${tool}"><rect width="640" height="420" fill="#f6f3ee"/><rect x="80" y="70" width="360" height="260" fill="none" stroke="#1b1814" stroke-width="2" stroke-dasharray="8 10"/><g data-part="shears"><path d="M420 90l90 50-40 90-90-48z" fill="#d6452d"/><path d="M448 118l48 28" stroke="#1b1814" stroke-width="5"/><circle cx="438" cy="128" r="8" fill="#1b1814"/></g><circle cx="${140 + s * 24}" cy="300" r="10" fill="#d6452d"/><path data-part="crop" d="M80 70h24M80 70v24M440 70h-24M440 70v24" stroke="#1b1814" stroke-width="3"/></g>`, s);
}

function hospitalityArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-hospitality-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const rooms = ["champagne", "inchiostro", "attico", "silenzio"] as const;
    const room = rooms[s]!;
    const defs = `<linearGradient id="htw${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#243044"/><stop offset="1" stop-color="#0c1018"/></linearGradient><radialGradient id="htl${s}" cx=".5" cy=".18" r=".55"><stop offset="0" stop-color="#f0e6d4" stop-opacity=".85"/><stop offset=".45" stop-color="#d4c4a0" stop-opacity=".4"/><stop offset="1" stop-color="#d4c4a0" stop-opacity="0"/></radialGradient><linearGradient id="htdrap${s}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1f28"/><stop offset=".5" stop-color="#2a3140"/><stop offset="1" stop-color="#12151c"/></linearGradient>`;
    if (s === 1) {
      return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#12151c"/><g data-part="drape"><rect x="40" y="20" width="90" height="380" fill="url(#htdrap${s})"/><rect x="510" y="20" width="90" height="380" fill="url(#htdrap${s})"/><path d="M40 20 C70 80 90 40 130 20" fill="#0c1018"/><path d="M510 20 C550 70 580 30 600 20" fill="#0c1018"/></g><rect data-part="window" x="160" y="48" width="320" height="220" fill="url(#htw${s})"/><rect x="180" y="68" width="280" height="160" fill="#d4c4a0" opacity=".08"/><rect data-part="bed" x="160" y="286" width="320" height="88" rx="6" fill="#242a36"/><rect x="180" y="272" width="120" height="22" rx="6" fill="#f0e6d4" opacity=".4"/></g>`, s, defs);
    }
    if (s === 2) {
      return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#0e1118"/><g data-part="skyline"><rect x="48" y="70" width="544" height="220" fill="#1a1f28"/><rect x="70" y="140" width="36" height="150" fill="#0c1018"/><rect x="120" y="110" width="44" height="180" fill="#0c1018"/><rect x="180" y="160" width="28" height="130" fill="#0c1018"/><rect x="230" y="90" width="70" height="200" fill="#0c1018"/><rect x="320" y="130" width="50" height="160" fill="#0c1018"/><rect x="390" y="80" width="80" height="210" fill="#0c1018"/><rect x="490" y="150" width="70" height="140" fill="#0c1018"/><g fill="#d4c4a0" opacity=".35"><rect x="242" y="120" width="6" height="10"/><rect x="258" y="136" width="6" height="10"/><rect x="410" y="110" width="6" height="10"/><rect x="430" y="150" width="6" height="10"/></g></g><g data-part="brass"><rect x="300" y="300" width="40" height="70" fill="#d4c4a0"/><ellipse cx="320" cy="298" rx="22" ry="8" fill="#f0e6d4"/></g><path d="M48 290h544" stroke="#d4c4a0" stroke-width="1.4"/></g>`, s, defs);
    }
    if (s === 3) {
      return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#12151c"/><g data-part="carpet"><rect x="80" y="250" width="480" height="130" fill="#1a1f28"/><path d="M80 250h480M80 280h480M80 310h480M80 340h480" stroke="#d4c4a0" stroke-width="1" opacity=".18"/></g><g data-part="lamp"><circle cx="320" cy="150" r="70" fill="url(#htl${s})"/><rect x="304" y="150" width="32" height="120" fill="#d4c4a0"/><ellipse cx="320" cy="148" rx="22" ry="8" fill="#f0e6d4" opacity=".55"/></g><rect x="250" y="90" width="8" height="240" fill="#d4c4a0" opacity=".4"/><path d="M40 48h140" stroke="#d4c4a0" stroke-width="1.4"/></g>`, s, defs);
    }
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#12151c"/><rect x="36" y="32" width="568" height="356" fill="#1a1f28"/><rect data-part="window" x="64" y="56" width="236" height="300" fill="url(#htw${s})"/><rect x="88" y="84" width="188" height="156" fill="#d4c4a0" opacity=".16"/><g data-part="lamp"><circle cx="456" cy="168" r="70" fill="url(#htl${s})"/><rect x="440" y="168" width="32" height="110" fill="#d4c4a0"/><ellipse cx="456" cy="164" rx="22" ry="8" fill="#f0e6d4" opacity=".45"/></g><g data-part="ice"><ellipse cx="500" cy="300" rx="36" ry="16" fill="#f0e6d4" opacity=".25"/><path d="M488 286c8-18 28-18 36 0" fill="none" stroke="#d4c4a0" stroke-width="2"/><rect x="502" y="250" width="10" height="40" fill="#d4c4a0"/><path d="M492 250h30l-4 16h-22z" fill="#f0e6d4" opacity=".5"/></g><rect data-part="bed" x="320" y="268" width="240" height="72" rx="5" fill="#242a36"/><rect x="340" y="254" width="80" height="16" rx="4" fill="#f0e6d4" opacity=".3"/></g>`, s, defs);
  }
  const rooms = ["pozzo", "olivo", "fienile", "salice"] as const;
  const room = rooms[s]!;
  const defs = `<linearGradient id="rmw${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa3b4"/><stop offset="1" stop-color="#dfe8ee"/></linearGradient><radialGradient id="fire${s}" cx=".5" cy=".8" r=".6"><stop offset="0" stop-color="#f4c27a"/><stop offset=".45" stop-color="#c45c26" stop-opacity=".85"/><stop offset="1" stop-color="#1f2a24" stop-opacity="0"/></radialGradient><linearGradient id="hill${s}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5e6a62"/><stop offset="1" stop-color="#5e6a62" stop-opacity=".15"/></linearGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#e7e0d2"/><rect x="36" y="40" width="568" height="340" fill="#cfc3ae"/><g data-part="terrace"><path d="M64 264h300" stroke="#1f4a3e" stroke-width="8"/><path d="M80 264v40M140 264v40M200 264v40M260 264v40M320 264v40" stroke="#1f4a3e" stroke-width="4"/></g><g data-part="grove"><ellipse cx="140" cy="150" rx="54" ry="70" fill="#1f4a3e"/><ellipse cx="200" cy="130" rx="70" ry="90" fill="#2a5c48"/><ellipse cx="270" cy="150" rx="50" ry="64" fill="#1f4a3e"/><rect x="132" y="200" width="16" height="64" fill="#3a2a20"/><rect x="192" y="196" width="18" height="68" fill="#3a2a20"/><rect x="262" y="200" width="14" height="64" fill="#3a2a20"/></g><rect data-part="window" x="64" y="64" width="300" height="200" fill="none" stroke="#f4efe4" stroke-width="12"/><rect data-part="desk" x="400" y="210" width="180" height="150" rx="6" fill="#f4efe4"/><rect x="420" y="228" width="140" height="16" fill="#1f4a3e" opacity=".35"/><rect x="420" y="256" width="100" height="10" fill="#1f4a3e" opacity=".2"/></g>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#d9d0c0"/><g data-part="beam"><path d="M40 80 L320 20 L600 80" fill="none" stroke="#3a2a20" stroke-width="14"/><path d="M120 80 L120 300 M200 70 L200 300 M320 40 L320 300 M440 70 L440 300 M520 80 L520 300" stroke="#3a2a20" stroke-width="8" opacity=".7"/></g><rect data-part="linen" x="110" y="200" width="420" height="110" rx="8" fill="#fffaf1"/><rect x="130" y="176" width="150" height="36" rx="10" fill="#e7e0d2"/><rect x="300" y="176" width="150" height="36" rx="10" fill="#e7e0d2"/><rect x="110" y="300" width="420" height="18" fill="#1f4a3e" opacity=".45"/><ellipse cx="180" cy="340" rx="50" ry="14" fill="#c4a070" opacity=".5"/></g>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#cfc3ae"/><rect y="260" width="640" height="160" fill="#5e7a86"/><g data-part="water"><path d="M0 270 C80 250 160 290 240 268 C320 246 400 286 480 264 C560 244 620 270 640 258 V420 H0Z" fill="#3a5a66"/><path d="M0 300 C90 284 180 316 270 298 C360 280 450 312 640 292" fill="none" stroke="#dfe8ee" stroke-width="2" opacity=".35"/></g><g data-part="willow"><path d="M420 20 v180" stroke="#3a2a20" stroke-width="8"/><path d="M420 60 C360 140 340 220 350 300" fill="none" stroke="#1f4a3e" stroke-width="3"/><path d="M420 70 C400 160 430 230 410 320" fill="none" stroke="#1f4a3e" stroke-width="2.4"/><path d="M420 80 C480 150 510 230 500 310" fill="none" stroke="#1f4a3e" stroke-width="3"/><path d="M420 90 C460 170 470 240 455 320" fill="none" stroke="#2a5c48" stroke-width="2"/></g><g data-part="reed"><path d="M80 420 L92 240 M110 420 L118 250 M140 420 L128 230" stroke="#1f4a3e" stroke-width="3"/><ellipse cx="92" cy="236" rx="8" ry="16" fill="#1f4a3e"/><ellipse cx="118" cy="246" rx="7" ry="14" fill="#2a5c48"/></g></g>`, s, defs);
  }
  return wrap(id, alt, `<g data-room="${room}"><rect width="640" height="420" fill="#e7e0d2"/><rect x="28" y="32" width="584" height="356" fill="#cfc3ae"/><g opacity=".35" stroke="#8a7a66" stroke-width="1" fill="none"><path d="M28 80h584M28 140h584M28 210h584M28 280h584M28 340h584"/><path d="M90 32v356M180 32v356M280 32v356M400 32v356M520 32v356"/></g><g data-part="well"><ellipse cx="190" cy="200" rx="86" ry="28" fill="#1f2a24"/><ellipse cx="190" cy="194" rx="70" ry="20" fill="#5e6a62"/><ellipse cx="190" cy="190" rx="48" ry="12" fill="#8aa3b4"/><path d="M120 194 v90 M260 194 v90" stroke="#3a2a20" stroke-width="8"/><path d="M120 284 h140" stroke="#3a2a20" stroke-width="8"/></g><rect data-part="window" x="56" y="56" width="260" height="200" fill="none" stroke="#f4efe4" stroke-width="14"/><rect data-part="bed" x="360" y="200" width="220" height="140" rx="6" fill="#f4efe4"/><rect x="380" y="188" width="80" height="20" rx="6" fill="#fffaf1"/><rect x="470" y="188" width="80" height="20" rx="6" fill="#fffaf1"/><rect x="56" y="268" width="260" height="88" fill="#1f4a3e"/><rect x="90" y="288" width="70" height="50" fill="#3a2a20"/><ellipse cx="125" cy="328" rx="24" ry="16" fill="url(#fire${s})"/></g>`, s, defs);
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

function crudoSlice(x: number, y: number, rot: number, w: number, h: number, s: number, tone = ""): string {
  const hw = w / 2;
  const hh = h / 2;
  const fill = tone || `url(#flesh${s})`;
  return `<g data-part="flesh" transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse cx="0" cy="6" rx="${hw}" ry="${hh}" fill="#000" opacity=".14"/>
    <path d="M${-hw} 0 Q0 ${-hh} ${hw} ${-hh * 0.12} Q${hw * 0.45} ${hh} ${-hw * 0.18} ${hh * 0.68} Q${-hw} ${hh * 0.28} ${-hw} 0Z" fill="${fill}"/>
    <path d="M${-hw * 0.68} ${-hh * 0.12} Q0 ${-hh * 0.42} ${hw * 0.5} ${-hh * 0.04}" fill="none" stroke="#fff" stroke-width="1.1" opacity=".45"/>
    <path d="M${-hw * 0.4} ${hh * 0.08} Q0 ${-hh * 0.08} ${hw * 0.36} ${hh * 0.18}" fill="none" stroke="#fff" stroke-width="0.7" opacity=".3"/>
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

function limeWedge(cx: number, cy: number): string {
  return `<g data-part="citrus" transform="translate(${cx} ${cy}) rotate(-18)">
    <path d="M-22 8 L0 -26 L22 8 Q0 18 -22 8Z" fill="#7dbb3a"/>
    <path d="M-16 6 L0 -18 L16 6 Q0 12 -16 6Z" fill="#e8f4c4"/>
    <path d="M0 -18 L0 10 M-16 6 L0 -18 L16 6" fill="none" stroke="#c4d86a" stroke-width="0.8"/>
    <path d="M-10 -4 Q0 -12 10 -4" fill="none" stroke="#fff" stroke-width="1.2" opacity=".35"/>
  </g>`;
}

function prawn(cx: number, cy: number, rot: number, s: number): string {
  return `<g data-part="flesh" transform="translate(${cx} ${cy}) rotate(${rot})">
    <ellipse cx="4" cy="10" rx="54" ry="16" fill="#000" opacity=".12"/>
    <path d="M-48 4 C-36 -18 -8 -22 18 -8 C36 2 48 8 58 4 L62 12 C50 18 34 16 18 10 C-4 2 -28 6 -44 16Z" fill="url(#flesh${s})"/>
    <g data-part="shell">
      <path d="M-20 -8 C-6 -16 10 -10 18 -2" fill="none" stroke="#b03a28" stroke-width="2.4" opacity=".45"/>
      <path d="M-8 -4 C4 -10 16 -4 24 4" fill="none" stroke="#b03a28" stroke-width="2" opacity=".35"/>
      <path d="M8 0 C18 -4 28 2 34 8" fill="none" stroke="#b03a28" stroke-width="1.6" opacity=".3"/>
    </g>
    <g data-part="antenna">
      <path d="M-48 0 C-70 -28 -86 -22 -96 -8" fill="none" stroke="#c45c3a" stroke-width="1.3"/>
      <path d="M-46 4 C-66 -10 -84 -4 -92 12" fill="none" stroke="#c45c3a" stroke-width="1.1"/>
    </g>
    <path d="M58 4 L78 -8 L74 6 L82 14 L62 12" fill="#d4785c"/>
    <ellipse cx="-40" cy="2" rx="14" ry="10" fill="#e07a4a"/>
    <circle cx="-48" cy="-2" r="2.2" fill="#2a1814"/>
    <path d="M-30 12 C-20 22 -8 20 4 14" fill="none" stroke="#c45c3a" stroke-width="1.2" opacity=".5"/>
  </g>`;
}

function oyster(cx: number, cy: number, rot: number, s: number): string {
  return `<g data-part="shell" transform="translate(${cx} ${cy}) rotate(${rot})">
    <ellipse cx="4" cy="10" rx="48" ry="28" fill="#000" opacity=".16"/>
    <path d="M-46 6 C-40 -22 -8 -34 18 -28 C44 -20 56 4 48 22 C38 38 8 42 -18 32 C-40 22 -50 14 -46 6Z" fill="#6a7a70" stroke="#3a4a44" stroke-width="1.4"/>
    <path d="M-38 4 C-32 -16 -4 -24 20 -18 C40 -12 46 6 38 18 C28 30 4 32 -18 24 C-34 16 -42 10 -38 4Z" fill="#e8efe8"/>
    <g data-part="flesh">
      <path d="M-18 2 C-8 -12 16 -10 26 2 C30 12 18 20 4 18 C-12 16 -22 10 -18 2Z" fill="url(#flesh${s})"/>
      <ellipse cx="2" cy="6" rx="10" ry="6" fill="#e8c4a0" opacity=".7"/>
      <path d="M-10 0 C0 -6 12 -2 16 6" fill="none" stroke="#fff" stroke-width="1.1" opacity=".4"/>
    </g>
    <path d="M-30 -8 C-10 -16 16 -10 28 4" fill="none" stroke="#c5d0c8" stroke-width="1.2" opacity=".5"/>
  </g>`;
}

function tunaBlock(x: number, y: number, rot: number, s: number): string {
  return `<g data-part="flesh" transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="-28" y="4" width="56" height="22" rx="3" fill="#000" opacity=".16"/>
    <path d="M-30 -12 L30 -10 L28 16 L-32 14Z" fill="url(#flesh${s})"/>
    <g data-part="fat-line" fill="none" stroke="#f4e4d0" stroke-width="1.15" opacity=".7">
      <path d="M-22 -6 L24 -4"/>
      <path d="M-18 2 L20 4"/>
      <path d="M-24 8 L16 10"/>
    </g>
    <path d="M-28 -10 L-10 -11 L-12 14 L-30 13Z" fill="#4a0810" opacity=".45"/>
    <path d="M-26 -8 L22 -6" fill="none" stroke="#fff" stroke-width="1.2" opacity=".25"/>
  </g>`;
}

function iceBed(): string {
  return `<g data-part="ice" fill="#e8f2f6">
    <polygon points="180,250 210,238 236,258 214,276 186,268" opacity=".85"/>
    <polygon points="400,246 432,236 454,260 428,278 404,266" opacity=".7"/>
    <polygon points="230,268 258,256 278,274 260,288" opacity=".55"/>
    <polygon points="360,270 390,258 408,278 386,292" opacity=".5"/>
    <path d="M200 244 L214 250" stroke="#fff" stroke-width="1.2" opacity=".6"/>
  </g>`;
}

function crudoStill(s: number, kind: "ricciola" | "gambero" | "ostrica" | "tonno"): string {
  const plate = ceramicPlate(320, 228, s);
  const napkin = `<g data-part="linen"><path d="M168 300l70-18 36 86-74 22z" fill="#f4f7f8" stroke="#cfdbe0"/><path d="M186 308l48-12" stroke="#cfdbe0" stroke-width="1.2"/><path d="M200 336l40-10" stroke="#cfdbe0" stroke-width="1"/></g>`;
  const knife = `<g data-part="knife"><path d="M470 250l86-18 6 12-84 22z" fill="#e8eef2" stroke="#9aa8b0"/><rect x="548" y="228" width="36" height="14" rx="2" fill="#2f4a3e"/><path d="M478 254l70-16" stroke="#fff" stroke-width="1" opacity=".5"/></g>`;
  const food =
    kind === "gambero"
      ? `${iceBed()}
      ${prawn(300, 200, -18, s)}
      ${prawn(360, 232, 12, s)}
      ${prawn(248, 236, -38, s)}
      ${lemonHalf(430, 168, s)}${seaHerb(176, 148)}${oilAndSalt(318, 268)}`
      : kind === "ostrica"
        ? `${iceBed()}
      ${oyster(250, 214, -16, s)}
      ${oyster(340, 198, 10, s)}
      ${oyster(312, 252, -8, s)}
      ${limeWedge(430, 168)}${seaHerb(176, 140)}
      <ellipse cx="470" cy="250" rx="40" ry="16" fill="#dfe8ee" opacity=".55"/>`
        : kind === "tonno"
          ? `<g data-part="plate"><ellipse cx="320" cy="232" rx="176" ry="78" fill="#2a2420"/><ellipse cx="320" cy="224" rx="150" ry="62" fill="#3a322c"/></g>
      ${tunaBlock(250, 210, -8, s)}
      ${tunaBlock(312, 198, 4, s)}
      ${tunaBlock(372, 214, 12, s)}
      ${tunaBlock(300, 242, -2, s)}
      <g data-part="wasabi"><ellipse cx="430" cy="176" rx="16" ry="12" fill="#5a8a32"/><ellipse cx="426" cy="172" rx="6" ry="4" fill="#8aba4a" opacity=".7"/></g>
      <g data-part="soy"><ellipse cx="196" cy="176" rx="22" ry="10" fill="#1a120c"/><ellipse cx="196" cy="174" rx="14" ry="5" fill="#3a2418"/></g>
      ${oilAndSalt(236, 268)}`
          : `${plate}${napkin}
      ${crudoSlice(248, 214, -24, 96, 32, s)}
      ${crudoSlice(300, 198, -8, 108, 34, s)}
      ${crudoSlice(354, 210, 12, 98, 32, s)}
      ${crudoSlice(318, 236, 6, 88, 28, s)}
      ${crudoSlice(266, 244, -14, 78, 24, s)}
      ${lemonHalf(424, 160, s)}${seaHerb(176, 140)}${oilAndSalt(228, 258)}${knife}`;
  const extra = kind === "ricciola" ? "" : kind === "tonno" ? "" : `<g transform="translate(320 220) scale(1.04) translate(-320 -220)">${plate}</g>`;
  return `<g data-dish="${kind}">${marbleVeins()}${kind === "ricciola" ? `<g transform="translate(320 220) scale(1.12) translate(-320 -220)">${food}</g>` : `${extra}<g transform="translate(320 220) scale(1.08) translate(-320 -220)">${food}</g>`}</g>`;
}

function foodArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-food-${variant}`;
  const s = slot % 4;
  const fit: "meet" | "slice" = slot === 0 ? "meet" : "slice";
  if (variant === 1) {
    const kinds = ["ricciola", "gambero", "ostrica", "tonno"] as const;
    const kind = kinds[s]!;
    const flesh =
      kind === "gambero"
        ? ["#f3c4a4", "#e07a4a", "#b03a28"]
        : kind === "ostrica"
          ? ["#f2e6d4", "#d8c4a8", "#c4a078"]
          : kind === "tonno"
            ? ["#c42838", "#7a1020", "#4a0810"]
            : ["#f6ead8", "#e2c4a0", "#c48a62"];
    const defs = `<radialGradient id="pl${s}" cx=".5" cy=".42" r=".52"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8ee"/></radialGradient><linearGradient id="mv${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4eef2"/><stop offset=".45" stop-color="#c5d3dc"/><stop offset="1" stop-color="#dbe6ec"/></linearGradient><linearGradient id="flesh${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${flesh[0]}"/><stop offset=".45" stop-color="${flesh[1]}"/><stop offset="1" stop-color="${flesh[2]}"/></linearGradient><linearGradient id="lem${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e25c2a"/></linearGradient>`;
    const caption = `<path d="M168 48h120M168 68h72" stroke="#12202c" stroke-width="3"/>`;
    return wrap(id, alt, `<rect width="640" height="420" fill="url(#mv${s})"/>${crudoStill(s, kind)}${caption}`, slot, defs, fit);
  }
  const defs = `<radialGradient id="dk${s}" cx=".5" cy=".38" r=".55"><stop offset="0" stop-color="#e25c2a"/><stop offset=".45" stop-color="#c43c2c"/><stop offset="1" stop-color="#3a2420"/></radialGradient><linearGradient id="plin${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ead8"/><stop offset="1" stop-color="#d4b896"/></linearGradient>`;
  const sage = `<g data-part="herb" fill="#7d9a6a"><ellipse cx="292" cy="200" rx="10" ry="5" transform="rotate(-20 292 200)"/><ellipse cx="312" cy="194" rx="11" ry="5" transform="rotate(18 312 194)"/><ellipse cx="328" cy="204" rx="9" ry="4.5" transform="rotate(-12 328 204)"/></g>`;
  const wine = `<g data-part="glass"><ellipse cx="470" cy="210" rx="36" ry="58" fill="#f6ead8" opacity=".12" stroke="#c4a890"/><path d="M456 160c14 0 26 12 26 32" fill="none" stroke="#c4a890" stroke-width="1.6"/><path d="M470 268v40M452 308h36" stroke="#c4a890" stroke-width="2"/><path d="M448 200c8 28 36 28 44 0" fill="#c43c2c" opacity=".35"/></g>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="280" rx="220" ry="96" fill="#000" opacity=".45"/><g data-part="plate"><ellipse cx="328" cy="246" rx="156" ry="66" fill="url(#dk${s})"/></g><g data-part="flesh">${Array.from({ length: 7 }, (_, i) => `<ellipse cx="${270 + i * 16}" cy="${228 + (i % 2) * 6}" rx="14" ry="9" fill="url(#plin${s})"/>`).join("")}</g>${sage}${wine}<path d="M250 228c40-22 96-18 128 12-22 32-86 44-128 20z" fill="#f6ead8" opacity=".35"/><rect x="56" y="48" width="8" height="240" fill="#c43c2c"/>`, slot, defs, fit);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#140e0c"/><g data-part="plate"><ellipse cx="250" cy="250" rx="150" ry="80" fill="#3a2420"/><ellipse cx="250" cy="236" rx="110" ry="50" fill="url(#dk${s})"/></g><g data-part="flesh"><path d="M200 226c28-14 70-10 90 10-14 22-60 30-90 14z" fill="#f6ead8"/><ellipse cx="230" cy="230" rx="16" ry="10" fill="url(#plin${s})"/><ellipse cx="258" cy="226" rx="15" ry="9" fill="url(#plin${s})"/></g>${wine}<rect x="56" y="48" width="8" height="250" fill="#c43c2c"/><path d="M80 64h140" stroke="#f6ead8" stroke-width="3"/>`, slot, defs, fit);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><rect x="70" y="60" width="500" height="300" fill="#241816"/><g data-part="plate"><ellipse cx="260" cy="230" rx="130" ry="70" fill="url(#dk${s})"/></g><g data-part="flesh"><path d="M210 220c30-16 70-12 90 10" fill="#f6ead8"/><ellipse cx="236" cy="224" rx="14" ry="9" fill="url(#plin${s})"/><ellipse cx="264" cy="220" rx="14" ry="9" fill="url(#plin${s})"/><ellipse cx="290" cy="226" rx="13" ry="8" fill="url(#plin${s})"/></g><rect x="420" y="100" width="120" height="200" fill="#321f1b"/><rect x="436" y="120" width="88" height="14" fill="#f6ead8" opacity=".4"/><rect x="436" y="148" width="64" height="8" fill="#c43c2c"/><rect x="70" y="60" width="8" height="300" fill="#c43c2c"/>`, slot, defs, fit);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="272" rx="206" ry="100" fill="#000" opacity=".5"/><g data-part="plate"><ellipse cx="328" cy="250" rx="170" ry="80" fill="#3a2420"/><ellipse cx="328" cy="236" rx="128" ry="56" fill="url(#dk${s})"/><path d="M210 220c30-24 80-36 118-20" fill="none" stroke="#f6ead8" stroke-width="2" opacity=".2"/></g><g data-part="flesh">${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${276 + i * 15}" cy="${222 + (i % 3) * 5}" rx="13" ry="8" fill="url(#plin${s})"/>`).join("")}<path d="M248 220c36-22 84-18 112 10-18 30-72 44-112 24z" fill="#f6ead8" opacity=".4"/><path d="M260 218c20-6 48-4 70 8" fill="none" stroke="#d4b896" stroke-width="1.2"/></g>${sage}<path d="M300 188c-8 6-6 16 4 14 8 10 20 2 14-8 6-12-10-18-18-6z" fill="#7d9a6a"/><circle cx="${300 + s * 8}" cy="214" r="7" fill="#7d9a6a"/><path d="M290 176c6-26 16-38 12-6M318 168c8-30 20-40 12-4M344 174c6-24 16-34 10-2" fill="none" stroke="#f6ead8" stroke-width="1.8" opacity=".4"/>${wine}<rect x="64" y="56" width="8" height="240" fill="#c43c2c"/><path d="M92 72h170M92 98h100" stroke="#f6ead8" stroke-width="3"/>`, slot, defs, fit);
}

function sprockets(): string {
  return Array.from({ length: 9 }, (_, i) => `<rect x="${56 + i * 58}" y="14" width="14" height="10" rx="2" fill="#1a1814"/><rect x="${56 + i * 58}" y="396" width="14" height="10" rx="2" fill="#1a1814"/>`).join("");
}

function scenePozzo(): string {
  return `<g data-part="scene" data-scene="pozzo">
    <rect width="640" height="420" fill="#9aaca8"/>
    <rect y="0" width="640" height="168" fill="#c5d4de"/>
    <path d="M0 150 L220 168 L420 158 L640 176 L640 0 H0Z" fill="#d8e4ea"/>
    <path d="M0 176 L180 196 L640 188 V420 H0Z" fill="#cfc3ae"/>
    <g fill="none" stroke="#8a7a66" stroke-width="1" opacity=".35">
      <path d="M0 220h640M0 260h640M0 300h640M0 340h640M0 380h640"/>
      <path d="M90 176v244M200 176v244M320 176v244M460 176v244M580 176v244"/>
    </g>
    <path d="M0 168 L70 90 L70 420 H0Z" fill="#b8a890"/>
    <path d="M570 80 L640 40 V420 H570Z" fill="#a89880"/>
    <rect x="86" y="110" width="46" height="70" fill="#3a322c"/>
    <rect x="94" y="118" width="30" height="44" fill="#8aa3b4"/>
    <ellipse cx="320" cy="318" rx="118" ry="22" fill="#000" opacity=".22"/>
    <ellipse cx="320" cy="292" rx="108" ry="48" fill="#d7cbb8"/>
    <ellipse cx="320" cy="292" rx="88" ry="36" fill="#8a7a66"/>
    <ellipse cx="320" cy="294" rx="64" ry="24" fill="#1f2a24"/>
    <ellipse cx="328" cy="290" rx="22" ry="8" fill="#8aa3b4" opacity=".4"/>
    <path d="M320 268 V198" stroke="#3a322c" stroke-width="3"/>
    <path d="M300 198 h40 v10 h-40z" fill="#3a322c"/>
    <path d="M280 198 C280 176 360 176 360 198" fill="none" stroke="#3a322c" stroke-width="4"/>
    <path d="M360 198 C400 210 410 250 400 268" fill="none" stroke="#3a322c" stroke-width="2"/>
    <ellipse cx="398" cy="274" rx="10" ry="6" fill="#3a322c"/>
    <path d="M70 90 L570 56 L640 40" fill="none" stroke="#e8dcc8" stroke-width="8" opacity=".25"/>
    <path d="M0 0 L240 0 L0 180Z" fill="#f4e0b0" opacity=".18"/>
  </g>`;
}

function sceneOlivo(): string {
  return `<g data-part="scene" data-scene="olivo">
    <rect width="640" height="420" fill="#d8c4a0"/>
    <rect y="0" width="640" height="168" fill="#e8d4b0"/>
    <path d="M0 0 L220 0 L0 140Z" fill="#f4e0b0" opacity=".35"/>
    <ellipse cx="528" cy="64" r="36" fill="#f6ead8" opacity=".55"/>
    <g data-part="grove">
      <path d="M0 150 C80 128 160 148 240 136 C340 122 430 150 640 130 V250 H0Z" fill="#6a7a48"/>
      <path d="M40 128 C90 96 150 108 186 128 C160 148 90 150 40 128Z" fill="#3d5a28"/>
      <path d="M200 118 C250 82 330 90 368 124 C340 146 250 148 200 118Z" fill="#4a6a30"/>
      <path d="M360 122 C420 86 510 96 560 128 C520 150 430 148 360 122Z" fill="#2c4a18"/>
      <path d="M520 116 C560 88 620 98 640 118 V150 C600 148 560 140 520 116Z" fill="#3d5a28"/>
      <path d="M80 138 C110 114 150 118 168 136 C150 148 110 150 80 138Z" fill="#5a7a32" opacity=".85"/>
      <path d="M280 130 C318 104 360 110 380 130 C360 146 318 148 280 130Z" fill="#6a8a40" opacity=".8"/>
      <path d="M0 186 C120 168 240 190 360 176 C480 162 560 186 640 174 V260 H0Z" fill="#4a5a32"/>
    </g>
    <g data-part="trunk" fill="none" stroke="#3a2a1c" stroke-linecap="round">
      <path d="M96 250 C92 210 100 176 94 150" stroke-width="7"/>
      <path d="M188 248 C184 206 176 168 182 142" stroke-width="6"/>
      <path d="M268 246 C274 204 266 170 270 146" stroke-width="8"/>
      <path d="M356 250 C350 208 360 172 348 144" stroke-width="7"/>
      <path d="M454 248 C460 206 448 168 456 140" stroke-width="6"/>
      <path d="M546 252 C540 214 552 176 544 148" stroke-width="5"/>
    </g>
    <g data-part="terrace">
      <path d="M0 248 L640 236 V420 H0Z" fill="#c4b090"/>
      <path d="M0 292 L640 274 V420 H0Z" fill="#b8a078"/>
      <path d="M0 248 L640 236 V268 L0 282Z" fill="#d8c4a0"/>
      <path d="M0 292 L640 274 V304 L0 322Z" fill="#9a8866"/>
      <g fill="none" stroke="#6a5e52" stroke-width="1.2" opacity=".45">
        <path d="M0 262 L640 248"/>
        <path d="M0 308 L640 290"/>
        <path d="M80 248 v34M180 246 v38M300 244 v42M430 242 v44M540 240 v46"/>
      </g>
      <path d="M0 338 C90 324 180 346 280 332 C400 316 520 340 640 326 V420 H0Z" fill="#8a7a5a"/>
      <path d="M40 360 C70 348 110 352 130 366 C110 378 70 376 40 360Z" fill="#6a5e52" opacity=".5"/>
      <path d="M400 370 C440 354 500 358 540 374 C500 388 440 386 400 370Z" fill="#6a5e52" opacity=".4"/>
    </g>
    <g data-part="vessel">
      <ellipse cx="148" cy="392" rx="36" ry="10" fill="#000" opacity=".18"/>
      <path d="M124 360 C118 378 128 392 148 392 C168 392 178 378 172 360 Z" fill="#9a4a28"/>
      <ellipse cx="148" cy="360" rx="24" ry="8" fill="#6a3220"/>
      <ellipse cx="148" cy="358" rx="16" ry="5" fill="#c47848" opacity=".5"/>
    </g>
    <path d="M0 0 L180 0 L0 120Z" fill="#f4e0b0" opacity=".2"/>
  </g>`;
}

function sceneFienile(): string {
  return `<g data-part="scene" data-scene="fienile">
    <rect width="640" height="420" fill="#c4a070"/>
    <rect y="0" width="640" height="200" fill="#e0b070"/>
    <path d="M0 0 H640 V120 C480 90 300 110 0 70Z" fill="#f0c888" opacity=".7"/>
    <path d="M0 268 H640 V420 H0Z" fill="#8a6a40"/>
    <path d="M0 268 C120 250 260 274 400 258 C520 246 600 266 640 260 V280 H0Z" fill="#6a5e52"/>
    <path d="M168 268 L320 96 L472 268Z" fill="#6a5e52"/>
    <rect x="196" y="168" width="248" height="148" fill="#9a4a28"/>
    <g fill="none" stroke="#6a3220" stroke-width="2" opacity=".55">
      ${Array.from({ length: 9 }, (_, i) => `<path d="M196 ${180 + i * 14} h248"/>`).join("")}
    </g>
    <rect x="292" y="214" width="56" height="102" fill="#1a1814"/>
    <path d="M292 214 h56 v102 h-56z" fill="none" stroke="#3a2420" stroke-width="3"/>
    <rect x="228" y="188" width="32" height="24" fill="#e0b070" opacity=".35"/>
    <rect x="380" y="188" width="32" height="24" fill="#e0b070" opacity=".35"/>
    <path d="M320 96 L320 168" stroke="#1a1814" stroke-width="4"/>
    <ellipse cx="236" cy="330" rx="46" ry="16" fill="#d8c07a" opacity=".7"/>
    <ellipse cx="400" cy="338" rx="54" ry="18" fill="#d8c07a" opacity=".55"/>
    <path d="M210 324 C230 300 270 302 292 322" fill="#c4a050"/>
    <path d="M168 268 L196 168 L196 316 L168 268" fill="#7a3a20" opacity=".35"/>
    <path d="M0 300 C80 288 140 310 200 300" fill="none" stroke="#6a5e52" stroke-width="6" opacity=".3"/>
  </g>`;
}

function sceneRame(): string {
  return `<g data-part="scene" data-scene="rame">
    <rect width="640" height="420" fill="#1a1814"/>
    <rect x="48" y="36" width="544" height="348" fill="#241e1a"/>
    <ellipse cx="320" cy="340" rx="180" ry="22" fill="#000" opacity=".45"/>
    <ellipse cx="320" cy="250" rx="168" ry="78" fill="#6a3220"/>
    <ellipse cx="320" cy="246" rx="150" ry="66" fill="#9a4a28"/>
    <ellipse cx="320" cy="244" rx="128" ry="54" fill="#c47848"/>
    <ellipse cx="320" cy="248" rx="108" ry="40" fill="#3a2218"/>
    <ellipse cx="328" cy="236" rx="70" ry="18" fill="#8aa3b4" opacity=".25"/>
    <path d="M210 250 C240 230 280 228 320 240 C360 228 400 230 430 250" fill="none" stroke="#f3efe6" stroke-width="2" opacity=".25"/>
    <path d="M196 250 C196 210 444 210 444 250" fill="none" stroke="#c47848" stroke-width="8"/>
    <rect x="188" y="248" width="20" height="14" rx="3" fill="#9a4a28"/>
    <rect x="432" y="248" width="20" height="14" rx="3" fill="#9a4a28"/>
    <rect x="72" y="56" width="10" height="280" fill="#9a4a28"/>
    <path d="M100 76 h220" stroke="#c9b496" stroke-width="4"/>
    <circle cx="220" cy="140" r="40" fill="#f3efe6" opacity=".08"/>
  </g>`;
}

function sceneTorchio(): string {
  return `<g data-part="scene" data-scene="torchio">
    <rect width="640" height="420" fill="#1c1814"/>
    <rect y="300" width="640" height="120" fill="#2a221c"/>
    <rect x="120" y="160" width="400" height="180" fill="#3a2e26"/>
    <rect x="150" y="80" width="340" height="90" fill="#2a2420"/>
    <rect x="300" y="40" width="40" height="50" fill="#c9b496"/>
    <circle cx="320" cy="36" r="18" fill="#8a7a66"/>
    <rect x="170" y="176" width="300" height="16" fill="#c9b496"/>
    <rect x="190" y="210" width="260" height="90" fill="#f3efe6"/>
    <path d="M210 230 h220 M210 248 h180 M210 266 h200 M210 284 h140" stroke="#1a1814" stroke-width="3"/>
    <g fill="#c9b496">
      ${Array.from({ length: 6 }, (_, i) => Array.from({ length: 4 }, (_, j) => `<rect x="${200 + i * 40}" y="${330 + j * 14}" width="28" height="10" rx="1"/>`).join("")).join("")}
    </g>
    <circle cx="520" cy="120" r="36" fill="#f0c888" opacity=".35"/>
    <rect x="40" y="48" width="8" height="260" fill="#9a4a28"/>
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
  const analog = `<radialGradient id="edsun${s}" cx=".18" cy=".12" r=".8"><stop offset="0" stop-color="#f4e0b0" stop-opacity=".45"/><stop offset="1" stop-color="#1a1814" stop-opacity="0"/></radialGradient><filter id="grain${s}"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="${20 + s * 7}" result="n"/><feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.22"/></feComponentTransfer></filter>`;
  if (variant === 1) {
    const frame = `<rect x="72" y="48" width="8" height="280" fill="#c81d25"/>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="48" y="36" width="544" height="348" fill="#16181e"/>
        <g transform="translate(72 58) scale(0.375)">${sceneTorchio()}</g>
        <rect x="72" y="58" width="240" height="170" fill="none" stroke="#2a2e38"/>
        <g transform="translate(336 58) scale(0.36)">${sceneRame()}</g>
        <rect x="336" y="58" width="228" height="170" fill="none" stroke="#2a2e38"/>
        <rect x="72" y="248" width="492" height="10" fill="#c81d25"/>
        <g transform="translate(72 268) scale(0.31)">${scenePozzo()}</g>
        <g transform="translate(292 268) scale(0.31)">${sceneFienile()}</g>
        ${frame}`, s, analog);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="40" y="40" width="560" height="340" fill="#16181e"/><g transform="translate(64 64) scale(0.34)">${sceneTorchio()}</g><rect x="64" y="64" width="220" height="160" fill="none" stroke="#2a2e38"/><g transform="translate(308 64) scale(0.42)">${sceneRame()}</g><rect x="308" y="64" width="268" height="268" fill="none" stroke="#2a2e38"/><path d="M332 300h220" stroke="#c81d25" stroke-width="3"/><rect x="560" y="40" width="16" height="340" fill="#c81d25"/>`, s, analog);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#16181e"/><rect x="100" y="36" width="440" height="320" fill="#0e1014"/><g transform="translate(128 48) scale(0.6)">${sceneTorchio()}</g><rect x="128" y="64" width="384" height="230" fill="none" stroke="#2a2e38"/><rect x="128" y="308" width="90" height="8" fill="#c81d25"/><path d="M36 48h80" stroke="#c81d25" stroke-width="6"/>`, s, analog);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><g transform="translate(72 60) scale(0.53)">${sceneRame()}</g><rect x="72" y="60" width="342" height="240" fill="none" stroke="#2a2e38"/><rect x="470" y="52" width="16" height="240" fill="#c81d25"/><path d="M96 348h300" stroke="#c81d25" stroke-width="2"/><rect x="72" y="360" width="140" height="8" fill="#e8e6df"/>`, s, analog);
  }
  if (s === 1) {
    const clips = `<clipPath id="edl${s}"><rect x="36" y="28" width="360" height="364"/></clipPath>${analog}`;
    return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/><g clip-path="url(#edl${s})"><g transform="translate(-40 -20) scale(0.7)">${sceneOlivo()}</g></g><rect x="36" y="28" width="360" height="364" fill="none" stroke="#1a1814"/><rect x="412" y="28" width="196" height="364" fill="#fffdf8"/>${typeColumn()}`, s, clips);
  }
  if (s === 2) {
    const clips = `<clipPath id="edf${s}"><rect x="48" y="36" width="544" height="248"/></clipPath>${analog}`;
    return wrap(id, alt, `<rect width="640" height="420" fill="#e8e0d2"/><rect x="36" y="24" width="568" height="372" fill="#fffdf8" stroke="#ddd4c6"/><g clip-path="url(#edf${s})"><g transform="translate(48 20) scale(0.85)">${sceneFienile()}</g></g><rect x="48" y="36" width="544" height="248" fill="none" stroke="#6a5e52"/><rect x="64" y="304" width="260" height="14" fill="#1a1814"/><rect x="64" y="332" width="180" height="8" fill="#9a4a28"/><rect x="420" y="304" width="140" height="56" fill="#1a1814"/>`, s, clips);
  }
  if (s === 3) {
    const clips = `${analog}<clipPath id="cs0${s}"><rect x="40" y="40" width="270" height="176"/></clipPath><clipPath id="cs1${s}"><rect x="330" y="40" width="270" height="176"/></clipPath><clipPath id="cs2${s}"><rect x="40" y="236" width="270" height="148"/></clipPath><clipPath id="cs3${s}"><rect x="330" y="236" width="270" height="148"/></clipPath>`;
    const rebate = (x: number, y: number, w: number, h: number) =>
      `<g data-part="frame"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#1a1814" stroke-width="2"/><rect x="${x + 8}" y="${y + h - 18}" width="28" height="10" fill="#1a1814"/><rect x="${x + w - 48}" y="${y + 8}" width="36" height="6" fill="#9a4a28"/></g>`;
    return wrap(id, alt, `<rect width="640" height="420" fill="#d8cbb8"/>${sprockets()}
      <rect x="24" y="24" width="592" height="372" fill="#1a1814"/>
      <g clip-path="url(#cs0${s})"><g transform="translate(40 40) scale(0.42)">${scenePozzo()}</g></g>${rebate(40, 40, 270, 176)}
      <g clip-path="url(#cs1${s})"><g transform="translate(330 40) scale(0.42)">${sceneOlivo()}</g></g>${rebate(330, 40, 270, 176)}
      <g clip-path="url(#cs2${s})"><g transform="translate(40 236) scale(0.42)">${sceneFienile()}</g></g>${rebate(40, 236, 270, 148)}
      <g clip-path="url(#cs3${s})"><g transform="translate(330 236) scale(0.42)">${sceneTorchio()}</g></g>${rebate(330, 236, 270, 148)}
      <path d="M40 400h560" stroke="#9a4a28" stroke-width="5"/>`, s, clips);
  }
  const clips = `<clipPath id="edc${s}"><rect x="36" y="36" width="380" height="288"/></clipPath>${analog}`;
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
  if (family === "repo") return repoArt(variant, slot, label);
  if (family === "night") return nightArt(variant, slot, label);
  if (family === "paper") return paperArt(variant, slot, label);
  return perfumeArt(0, slot, label);
}

function repoArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-repo-${variant}`;
  const s = slot % 4;
  const paper = variant === 1 ? "#e8eef6" : "#0b1220";
  const ink = variant === 1 ? "#142033" : "#9ec8d4";
  const accent = variant === 1 ? "#1d4ed8" : "#2ec8c0";
  const mute = variant === 1 ? "#c5d0de" : "#1d2b44";
  const add = variant === 1 ? "#0f766e" : "#3dba84";
  const del = variant === 1 ? "#b45309" : "#d8a03a";
  if (s === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      <path d="M72 40v340" stroke="${mute}" stroke-width="2"/>
      <circle cx="72" cy="72" r="8" fill="${accent}" data-part="node"/>
      <circle cx="72" cy="168" r="8" fill="${ink}" data-part="node"/>
      <circle cx="72" cy="264" r="8" fill="${accent}" data-part="node"/>
      <circle cx="72" cy="348" r="8" fill="${ink}" data-part="node"/>
      <path d="M72 72c80 0 110 48 188 48" fill="none" stroke="${accent}" stroke-width="2" data-part="branch"/>
      <rect x="280" y="100" width="280" height="14" fill="${ink}" opacity=".55"/>
      <rect x="280" y="124" width="190" height="10" fill="${mute}"/>
      <rect x="280" y="196" width="240" height="14" fill="${ink}" opacity=".7"/>
      <rect x="280" y="292" width="260" height="14" fill="${ink}" opacity=".45"/>
      <rect x="112" y="56" width="72" height="16" rx="2" fill="${accent}" data-part="sha"/>`,
      s,
    );
  }
  if (s === 2) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      <rect x="36" y="36" width="260" height="348" fill="${mute}" data-part="gutter"/>
      <rect x="48" y="56" width="120" height="10" fill="${accent}"/>
      <rect x="48" y="84" width="200" height="8" fill="${ink}" opacity=".5"/>
      <rect x="48" y="108" width="168" height="8" fill="${ink}" opacity=".35"/>
      <rect x="48" y="148" width="120" height="10" fill="${accent}"/>
      <rect x="48" y="176" width="188" height="8" fill="${ink}" opacity=".5"/>
      <rect x="320" y="48" width="280" height="320" fill="${variant === 1 ? "#ffffff" : "#152033"}" data-part="diff"/>
      <path d="M336 80h200" stroke="${add}" stroke-width="8" data-part="add"/>
      <path d="M336 112h160" stroke="${add}" stroke-width="8" data-part="add"/>
      <path d="M336 152h180" stroke="${del}" stroke-width="8" data-part="del"/>
      <path d="M336 192h140" stroke="${add}" stroke-width="8" data-part="add"/>
      <path d="M336 232h210" stroke="${ink}" stroke-width="6" opacity=".35"/>
      <path d="M336 268h120" stroke="${del}" stroke-width="8" data-part="del"/>`,
      s,
    );
  }
  if (s === 3) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      <circle cx="180" cy="210" r="78" fill="none" stroke="${mute}" stroke-width="18" data-part="ring"/>
      <circle cx="180" cy="210" r="78" fill="none" stroke="${accent}" stroke-width="18" stroke-dasharray="160 330" data-part="sync"/>
      <rect x="300" y="120" width="280" height="18" fill="${ink}" opacity=".6"/>
      <rect x="300" y="160" width="220" height="12" fill="${mute}"/>
      <rect x="300" y="200" width="250" height="12" fill="${mute}"/>
      <rect x="300" y="248" width="90" height="28" rx="4" fill="${accent}" data-part="sha"/>
      <rect x="400" y="248" width="110" height="28" rx="4" fill="${mute}"/>`,
      s,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="${paper}"/>
    <path d="M80 36v348" stroke="${mute}" stroke-width="3" data-part="spine"/>
    <g data-part="commit">
      <circle cx="80" cy="70" r="9" fill="${accent}"/>
      <rect x="110" y="60" width="420" height="18" fill="${ink}" opacity=".75"/>
      <text x="110" y="108" fill="${accent}" font-size="13" font-family="ui-monospace,monospace">a3f1c2 · main</text>
    </g>
    <g data-part="commit">
      <circle cx="80" cy="160" r="9" fill="${ink}"/>
      <path d="M80 160c90 0 120-40 210-40" fill="none" stroke="${accent}" stroke-width="2" data-part="branch"/>
      <rect x="110" y="150" width="380" height="18" fill="${ink}" opacity=".55"/>
      <text x="300" y="148" fill="${accent}" font-size="12" font-family="ui-monospace,monospace">feat/sync</text>
    </g>
    <g data-part="commit">
      <circle cx="80" cy="250" r="9" fill="${accent}"/>
      <rect x="110" y="240" width="400" height="18" fill="${ink}" opacity=".7"/>
      <text x="110" y="286" fill="${mute}" font-size="12" font-family="ui-monospace,monospace">9b2e18 · in volo</text>
    </g>
    <g data-part="commit">
      <circle cx="80" cy="340" r="9" fill="${ink}"/>
      <rect x="110" y="330" width="340" height="18" fill="${ink}" opacity=".45"/>
    </g>
    <rect x="500" y="54" width="70" height="16" rx="2" fill="${accent}" data-part="sha"/>`,
    s,
  );
}

function nightArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-night-${variant}`;
  const s = slot % 4;
  const paper = variant === 1 ? "#1a0824" : "#14081c";
  const ink = "#f4e8ff";
  const accent = "#ff3d7f";
  const mute = "#4a2860";
  if (s === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      <circle cx="320" cy="210" r="120" fill="none" stroke="${mute}" stroke-width="18"/>
      <circle cx="320" cy="210" r="120" fill="none" stroke="${accent}" stroke-width="18" stroke-dasharray="90 660" transform="rotate(-20 320 210)"/>
      <path d="M80 300 160 220 240 260 320 140 400 200 480 90 560 160" fill="none" stroke="${ink}" stroke-width="4"/>
      <circle cx="320" cy="210" r="8" fill="${accent}"/>`,
      s,
    );
  }
  if (s === 2) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${70 + i * 64}" y="${80 + (i % 3) * 40}" width="36" height="${220 - (i % 4) * 36}" rx="4" fill="${i % 2 ? accent : ink}" opacity="${0.35 + (i % 3) * 0.2}"/>`).join("")}`,
      s,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="${paper}"/>
    <path d="M40 260 90 200 140 240 190 120 250 180 310 80 370 150 430 70 490 130 550 90 620 160" fill="none" stroke="${accent}" stroke-width="5" data-part="wave"/>
    <path d="M40 300 110 250 180 280 250 190 320 240 400 140 480 200 560 120 620 170" fill="none" stroke="${ink}" stroke-width="3" opacity=".55"/>
    <circle cx="310" cy="80" r="10" fill="${accent}"/>
    <rect x="40" y="340" width="560" height="8" rx="4" fill="${mute}"/>`,
    s,
  );
}

function paperArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-paper-${variant}`;
  const s = slot % 4;
  const paper = variant === 1 ? "#f4eef6" : "#f3f6fb";
  const ink = "#142033";
  const accent = variant === 1 ? "#a86c9a" : "#1d4ed8";
  const mute = "#cfd8e6";
  if (s === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      <rect x="70" y="40" width="220" height="300" fill="#fff" stroke="${mute}"/>
      <rect x="310" y="70" width="240" height="270" fill="#fff" stroke="${mute}"/>
      <path d="M90 80h180M90 110h140M90 140h160" stroke="${ink}" stroke-width="6"/>
      <path d="M330 110h180M330 140h120" stroke="${ink}" stroke-width="5"/>
      <rect x="90" y="180" width="70" height="18" fill="${accent}"/>`,
      s,
    );
  }
  if (s === 2) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="${paper}"/>
      <circle cx="160" cy="210" r="70" fill="none" stroke="${mute}" stroke-width="16"/>
      <circle cx="160" cy="210" r="70" fill="none" stroke="${accent}" stroke-width="16" stroke-dasharray="80 360"/>
      <rect x="280" y="90" width="280" height="18" fill="${ink}" opacity=".7"/>
      <rect x="280" y="130" width="220" height="12" fill="${mute}"/>
      <rect x="280" y="170" width="250" height="12" fill="${mute}"/>
      <rect x="280" y="230" width="120" height="28" rx="4" fill="${accent}"/>`,
      s,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="${paper}"/>
    <rect x="80" y="50" width="480" height="320" fill="#fff" stroke="${mute}" data-part="sheet"/>
    <path d="M110 90h400M110 130h320M110 170h360M110 210h280" stroke="${ink}" stroke-width="5"/>
    <rect x="110" y="260" width="90" height="22" fill="${accent}"/>
    <rect x="220" y="260" width="70" height="22" fill="${mute}"/>`,
    s,
  );
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
              : family === "repo"
                ? "commit timeline on paper, branch lines, diff gutter, no logos, no UI chrome"
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
