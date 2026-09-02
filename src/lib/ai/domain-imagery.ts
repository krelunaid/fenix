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
  { id: "svg-fashion-0", family: "fashion", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cappotto con fodera carminio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-fashion-1", family: "fashion", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "abito colonna in osso, cucitura nera", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-booking-0", family: "booking", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "sala con poltrona, finestra e orologio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-booking-1", family: "booking", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "tavolo da taglio, lino e forbici", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-ops-0", family: "ops", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "ledger, barre e finestra nord", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-ops-1", family: "ops", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "cassette di raccolto e andamento", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-utility-0", family: "utility", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "forbici e crocini di taglio", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-utility-1", family: "utility", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "nastro millimetrato in tasca", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-hospitality-0", family: "hospitality", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "camera in pietra, letto e finestra sul pozzo", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-hospitality-1", family: "hospitality", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "suite d'hotel, lampada oro e champagne", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-food-0", family: "food", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "piatto al passo, plin e vino", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-food-1", family: "food", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "crudo su marmo, agrume e erba di mare", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-editorial-0", family: "editorial", variant: 0, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "lastra fotografica su carta da rivista", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
  { id: "svg-editorial-1", family: "editorial", variant: 1, license: "CC0", source: "repository-native SVG originale Fenix", year: 2026, subject: "studio notturno, cornice e segnale rosso", notes: "Nessun asset Apple/Emergent. Nessun hotlink." },
];

function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&" + "amp;")
    .replace(/"/g, "&" + "quot;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}

function wrap(id: string, alt: string, inner: string, slot = 0, extraDefs = ""): string {
  const gid = `${id.replace(/[^a-z0-9]/gi, "")}s${slot}n${inner.length}`;
  return `<svg class="domain-art" data-imagery="domain" data-provenance="${esc(id)}" data-slot="${slot}" viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid slice"><defs><filter id="${gid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed="${11 + slot * 5}" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="g2"><feFuncA type="table" tableValues="0 0.26"/></feComponentTransfer><feBlend in="SourceGraphic" in2="g2" mode="multiply"/></filter><filter id="${gid}sh"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-opacity=".34"/></filter><radialGradient id="${gid}vg" cx=".48" cy=".42" r=".78"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>${extraDefs}</defs><g filter="url(#${gid})">${inner}</g><rect width="640" height="420" fill="url(#${gid}vg)" pointer-events="none"/></svg>`;
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

function fashionArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-fashion-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const defs = `<linearGradient id="osfab${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8ef"/><stop offset=".45" stop-color="#f3ece3"/><stop offset="1" stop-color="#c9b496"/></linearGradient><linearGradient id="ossh${s}" x1=".2" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><radialGradient id="osfl${s}" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#3a322c"/><stop offset="1" stop-color="#1a1614"/></radialGradient>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="url(#osfl${s})"/><rect y="318" width="640" height="102" fill="#120f0d"/><ellipse cx="320" cy="328" rx="118" ry="16" fill="#000" opacity=".4"/><rect x="314" y="300" width="12" height="46" fill="#c9b496"/><ellipse cx="320" cy="348" rx="34" ry="7" fill="#c9b496"/><path d="M232 86h176l22 34H210z" fill="url(#osfab${s})"/><path d="M228 118c8 8 18 12 40 12h104c22 0 32-4 40-12v210c-10 36-46 58-92 58s-82-22-92-58z" fill="url(#osfab${s})"/><path d="M268 130c18 22 86 22 104 0" fill="none" stroke="#c9b496" stroke-width="1.4"/><path d="M248 118v208M392 118v208" stroke="#1a1614" stroke-width="1" opacity=".25"/><path d="M300 200h40" stroke="#c9b496" stroke-width="1.2"/><circle cx="308" cy="168" r="3" fill="#1a1614"/><circle cx="308" cy="196" r="3" fill="#1a1614"/><circle cx="308" cy="224" r="3" fill="#1a1614"/><path d="M40 48h132" stroke="#c9b496" stroke-width="2"/><rect x="40" y="70" width="88" height="6" fill="#c9b496"/>`, s, defs);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#241f1c"/><rect y="340" width="640" height="80" fill="#1a1614"/><path d="M210 64c18-8 42-10 70-4 20-18 56-22 86-6 24-4 54 6 74 22l-16 36H226z" fill="#f3ece3"/><path d="M236 118h48v230c0 18-10 28-24 28s-24-10-24-28zM356 118h48v230c0 18-10 28-24 28s-24-10-24-28z" fill="url(#osfab${s})"/><path d="M284 118h72v16H284z" fill="#c9b496"/><path d="M260 118v230M380 118v230" stroke="#1a1614" stroke-width="1.1" opacity=".3"/><path d="M248 200c-8 40-6 90 6 148M392 200c8 40 6 90-6 148" fill="none" stroke="#c9b496" stroke-width="1" opacity=".5"/><circle cx="96" cy="300" r="28" fill="none" stroke="#c9b496" stroke-width="1.3"/><path d="M48 52h120" stroke="#c9b496" stroke-width="2"/>`, s, defs);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#1a1614"/><rect x="40" y="40" width="200" height="340" fill="#241f1c"/><path d="M86 86h108M86 114h72" stroke="#c9b496" stroke-width="2"/><circle cx="140" cy="210" r="54" fill="none" stroke="#c9b496" stroke-width="1.2"/><circle cx="140" cy="210" r="8" fill="#c9b496"/><path d="M320 70l48 20 48-20 26 32-20 44v216l-54 30-54-30V146l-20-44z" fill="url(#osfab${s})"/><path d="M368 92v250" stroke="#1a1614" stroke-width="1.1"/><path d="M346 148c16 10 28 10 44 0" fill="none" stroke="#c9b496" stroke-width="1.4"/><circle cx="354" cy="178" r="3.2" fill="#1a1614"/><circle cx="354" cy="206" r="3.2" fill="#1a1614"/><circle cx="354" cy="234" r="3.2" fill="#1a1614"/><path d="M338 300h60" stroke="#c9b496" stroke-width="1"/>`, s, defs);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="url(#osfl${s})"/><rect y="332" width="640" height="88" fill="#120f0d"/><ellipse cx="322" cy="336" rx="130" ry="18" fill="#000" opacity=".45"/><rect x="316" y="312" width="10" height="40" fill="#c9b496"/><ellipse cx="321" cy="354" rx="38" ry="8" fill="#c9b496"/><path d="M268 48l52 28 52-28 28 20-20 48v228l-60 36-60-36V124l-20-48z" fill="url(#osfab${s})"/><path d="M320 76v248" stroke="#1a1614" stroke-width="1.15"/><path d="M296 156c16 14 32 14 48 0" fill="none" stroke="#c9b496" stroke-width="1.5"/><path d="M292 200h56M296 236h48" stroke="#c9b496" stroke-width="1.1"/><circle cx="302" cy="188" r="3.2" fill="#1a1614"/><circle cx="302" cy="216" r="3.2" fill="#1a1614"/><circle cx="302" cy="244" r="3.2" fill="#1a1614"/><path d="M40 48h7v280H40z" fill="#c9b496"/><path d="M64 70h140M64 96h88" stroke="#c9b496" stroke-width="2"/><rect x="64" y="300" width="110" height="6" fill="#c9b496"/>`, s, defs);
  }
  const defs = `<linearGradient id="infab${s}" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#2a2420"/><stop offset=".5" stop-color="#161412"/><stop offset="1" stop-color="#0c0a09"/></linearGradient><linearGradient id="inlin${s}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c81d25"/><stop offset="1" stop-color="#7a1016"/></linearGradient><radialGradient id="inrm${s}" cx=".5" cy=".15" r=".9"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#e8dcc8"/></radialGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="url(#inrm${s})"/><rect y="0" width="640" height="56" fill="#ddd0bc"/><rect y="328" width="640" height="92" fill="#d7cbb8"/><ellipse cx="320" cy="336" rx="140" ry="20" fill="#000" opacity=".1"/><path d="M210 72h220l24 42H186z" fill="url(#inlin${s})"/><path d="M204 114c10 10 22 14 48 14h136c26 0 38-4 48-14v206c-12 40-52 64-116 64s-104-24-116-64z" fill="url(#inlin${s})"/><path d="M248 128c24 28 120 28 144 0" fill="none" stroke="#f6f1ea" stroke-width="1.2" opacity=".5"/><path d="M236 114v206M404 114v206" stroke="#f6f1ea" stroke-width="1" opacity=".25"/><path d="M186 320c40 18 90 28 134 28s94-10 134-28v18c-40 20-92 32-134 32s-94-12-134-32z" fill="#161412" opacity=".35"/><path d="M40 300h160" stroke="#c81d25" stroke-width="8"/><rect x="40" y="40" width="120" height="7" fill="#161412"/>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#f6f1ea"/><rect y="0" width="640" height="48" fill="#efe6d8"/><rect y="340" width="640" height="80" fill="#e4d9c8"/><path d="M188 58c40-16 90-18 132-6 28-14 72-16 110-2 18 4 40 16 58 28l-18 38H206z" fill="url(#infab${s})"/><path d="M228 118h46v236c0 16-8 26-22 26s-24-10-24-26zM366 118h46v236c0 16-8 26-22 26s-24-10-24-26z" fill="url(#infab${s})"/><path d="M274 118h92v14H274z" fill="#c81d25"/><path d="M248 118v236M392 118v236" stroke="#f6f1ea" stroke-width="1" opacity=".2"/><path d="M236 210c-6 46-4 100 8 164M404 210c6 46 4 100-8 164" fill="none" stroke="#c81d25" stroke-width="1.2" opacity=".45"/><circle cx="108" cy="292" r="44" fill="none" stroke="#161412" stroke-width="1.6"/><path d="M88 292h40" stroke="#c81d25" stroke-width="3"/><path d="M48 52h128M48 74h80" stroke="#161412" stroke-width="2.4"/>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#fffdf8"/><rect x="36" y="36" width="220" height="348" fill="#161412"/><path d="M64 80h160M64 108h110" stroke="#f6f1ea" stroke-width="2"/><circle cx="146" cy="210" r="48" fill="none" stroke="#c81d25" stroke-width="1.6"/><circle cx="146" cy="210" r="7" fill="#c81d25"/><path d="M320 58l36 26 36-26 22 20-16 38v72H314V116l-16-38z" fill="url(#infab${s})"/><rect x="314" y="194" width="80" height="12" fill="#c81d25"/><path d="M300 206c42 64 44 132 14 188" fill="none" stroke="#161412" stroke-width="42"/><path d="M408 206c-42 64-44 132-14 188" fill="none" stroke="#161412" stroke-width="42"/><path d="M300 206c42 64 44 132 14 188" fill="none" stroke="#c81d25" stroke-width="1.6" opacity=".55"/><rect x="40" y="320" width="180" height="8" fill="#c81d25"/>`, s, defs);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="url(#inrm${s})"/><rect y="0" width="640" height="52" fill="#ddd0bc"/><rect y="338" width="640" height="82" fill="#d7cbb8"/><ellipse cx="324" cy="344" rx="128" ry="18" fill="#000" opacity=".12"/><rect x="318" y="318" width="10" height="44" fill="#3a3028"/><ellipse cx="323" cy="364" rx="36" ry="8" fill="#3a3028"/><path d="M250 46l54-16 54 16 44 36-26 42v228l-72 40-72-40V140l-26-42z" fill="url(#infab${s})"/><path d="M304 78l-20 46v214" fill="none" stroke="#f6f1ea" stroke-width="1" opacity=".28"/><path d="M278 136h84v18H278z" fill="url(#inlin${s})"/><path d="M292 176c18 16 46 16 64 0" fill="none" stroke="#c81d25" stroke-width="1.8"/><path d="M268 250h36M268 250v8M340 250h36M376 250v8" fill="none" stroke="#f6f1ea" stroke-width="1.4"/><circle cx="292" cy="210" r="3.4" fill="#f6f1ea"/><circle cx="292" cy="238" r="3.4" fill="#f6f1ea"/><circle cx="292" cy="266" r="3.4" fill="#f6f1ea"/><path d="M250 318c36 16 80 24 118 24s82-8 118-24v16c-36 18-80 28-118 28s-82-10-118-28z" fill="#c81d25" opacity=".75"/><path d="M48 52h148M48 76h96" stroke="#161412" stroke-width="2.6"/><rect x="48" y="308" width="150" height="6" fill="#c81d25"/>`, s, defs);
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

function foodArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-food-${variant}`;
  const s = slot % 4;
  if (variant === 1) {
    const defs = `<radialGradient id="pl${s}" cx=".5" cy=".42" r=".52"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8ee"/></radialGradient><linearGradient id="mv${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef3f6"/><stop offset=".5" stop-color="#d5e0e6"/><stop offset="1" stop-color="#eef3f6"/></linearGradient><linearGradient id="flesh${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4c4a8"/><stop offset=".5" stop-color="#e28a6a"/><stop offset="1" stop-color="#c45c3a"/></linearGradient><linearGradient id="lem${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e25c2a"/></linearGradient>`;
    const marble = `<path d="M20 80c80 40 120-30 200 8 70-36 140 24 220-10 80 30 140 4 190 20" fill="none" stroke="#9aa8b0" stroke-width="1.2" opacity=".35"/><path d="M0 210c90-20 150 30 240 8 80 24 150-20 230 12 70-16 120 10 170-8" fill="none" stroke="#c5d0d6" stroke-width="2" opacity=".5"/><path d="M40 320c70-30 130 10 200-16 90 28 160-12 250 8" fill="none" stroke="#8a9aa4" stroke-width="1" opacity=".3"/>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="url(#mv${s})"/>${marble}<ellipse cx="300" cy="250" rx="210" ry="110" fill="#dfe8ee"/><ellipse cx="300" cy="236" rx="168" ry="86" fill="url(#pl${s})"/><path d="M210 210c40-16 70-8 86 16 18-22 54-18 78 8-8 28-54 44-90 34-32 6-62-10-74-58z" fill="url(#flesh${s})"/><path d="M230 214c20-4 40 0 48 12M268 208c16-6 36 2 44 14" fill="none" stroke="#fff" stroke-width="1.1" opacity=".45"/><path d="M390 196c28-10 48 6 40 28-18 8-40 4-40-28z" fill="url(#lem${s})"/><path d="M398 200c12 2 22 10 18 22" fill="none" stroke="#fff" stroke-width=".8" opacity=".5"/><path d="M168 200c24-40 16-70-8-86" fill="none" stroke="#2f6b4a" stroke-width="2"/><path d="M160 130c-16 8-8 28 6 22 12 16 28 6 22-10 8-18-12-28-28-12z" fill="#2f6b4a"/><path d="M148 64h110M148 86h70" stroke="#12202c" stroke-width="3"/>`, s, defs);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#e4eef2"/>${marble}<ellipse cx="250" cy="248" rx="176" ry="96" fill="url(#pl${s})"/><ellipse cx="236" cy="232" rx="70" ry="28" fill="url(#flesh${s})"/><path d="M200 224c24-8 50-4 64 12" fill="none" stroke="#fff" stroke-width="1.2" opacity=".4"/><path d="M310 200c36-18 70-8 78 18-22 16-58 24-78 8z" fill="#d4785c"/><circle cx="250" cy="208" r="16" fill="#e25c2a"/><path d="M430 150c18-8 42 4 46 28 2 22-16 48-40 62-18 10-40 8-52-6 6-28 20-62 46-84z" fill="#f4f7f8" stroke="#cfdbe0"/><path d="M418 186c10-16 28-20 38-8" fill="none" stroke="#cfdbe0" stroke-width="1.4"/><ellipse cx="452" cy="210" rx="14" ry="22" fill="#e25c2a" opacity=".12"/><path d="M40 56h140" stroke="#12202c" stroke-width="3"/>`, s, defs);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#dfe8ee"/><rect x="70" y="56" width="500" height="308" fill="#ffffff"/><path d="M90 120c80 20 120-30 210 6 70-20 140 16 220-8" fill="none" stroke="#c5d0d6" stroke-width="1.4"/>${marble}<ellipse cx="250" cy="220" rx="126" ry="74" fill="url(#pl${s})"/><path d="M190 210c30-18 70-10 90 14 16-20 48-14 70 10-12 24-54 38-90 28-36 4-64-16-70-52z" fill="url(#flesh${s})"/><circle cx="280" cy="198" r="14" fill="#e25c2a"/><rect x="400" y="108" width="132" height="200" fill="#12202c"/><rect x="416" y="128" width="100" height="10" fill="#eef3f6"/><rect x="416" y="154" width="78" height="7" fill="#2f6b4a"/><rect x="416" y="176" width="64" height="7" fill="#e25c2a"/><path d="M70 56h500" stroke="#2f6b4a" stroke-width="5"/>`, s, defs);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#eef3f6"/>${marble}<ellipse cx="328" cy="258" rx="220" ry="118" fill="#dfe8ee"/><ellipse cx="328" cy="240" rx="176" ry="90" fill="url(#pl${s})"/><path d="M220 222c44-28 96-16 124 16 36-32 92-18 128 20-24 36-86 56-138 48-52 6-94-18-114-84z" fill="#8fb7a0"/><path d="M248 214c28-12 56-6 70 12M330 206c24-14 52-6 66 14" fill="none" stroke="#dfeee4" stroke-width="1.4" opacity=".7"/><path d="M236 200c18-6 40 0 52 14 8-16 30-20 48-6-6 18-28 28-52 22-22 4-42-8-48-30z" fill="url(#flesh${s})"/><circle cx="${250 + s * 10}" cy="198" r="16" fill="#e25c2a"/><path d="M400 176c22-10 40 4 34 24-16 6-34 2-34-24z" fill="url(#lem${s})"/><path d="M168 168c18-36 8-64-14-78" fill="none" stroke="#2f6b4a" stroke-width="2"/><path d="M154 104c-14 8-6 26 8 20 10 14 26 4 20-10 6-16-12-24-28-10z" fill="#2f6b4a"/><ellipse cx="360" cy="268" rx="36" ry="10" fill="#fff" opacity=".25"/><path d="M168 72h110M168 94h70" stroke="#12202c" stroke-width="3"/>`, s, defs);
  }
  const defs = `<radialGradient id="dk${s}" cx=".5" cy=".38" r=".55"><stop offset="0" stop-color="#e25c2a"/><stop offset=".45" stop-color="#c43c2c"/><stop offset="1" stop-color="#3a2420"/></radialGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="280" rx="220" ry="96" fill="#000" opacity=".45"/><ellipse cx="328" cy="246" rx="156" ry="66" fill="url(#dk${s})"/><path d="M250 228c40-22 96-18 128 12-22 32-86 44-128 20z" fill="#f6ead8"/><path d="M280 180c8-28 20-40 16-8M310 170c6-32 22-44 14-6M340 176c8-26 18-36 12-4" fill="none" stroke="#f6ead8" stroke-width="2" opacity=".35"/><ellipse cx="470" cy="210" rx="36" ry="58" fill="#f6ead8" opacity=".12" stroke="#c4a890"/><path d="M456 160c14 0 26 12 26 32" fill="none" stroke="#c4a890" stroke-width="1.6"/><rect x="56" y="48" width="8" height="240" fill="#c43c2c"/>`, s, defs);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#140e0c"/><ellipse cx="250" cy="250" rx="150" ry="80" fill="#3a2420"/><ellipse cx="250" cy="236" rx="110" ry="50" fill="url(#dk${s})"/><path d="M200 226c28-14 70-10 90 10-14 22-60 30-90 14z" fill="#f6ead8"/><ellipse cx="470" cy="210" rx="40" ry="64" fill="#f6ead8" opacity=".15" stroke="#c4a890"/><path d="M454 158c16 0 28 14 28 34" fill="none" stroke="#c4a890" stroke-width="2"/><rect x="56" y="48" width="8" height="250" fill="#c43c2c"/><path d="M80 64h140" stroke="#f6ead8" stroke-width="3"/>`, s, defs);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><rect x="70" y="60" width="500" height="300" fill="#241816"/><ellipse cx="260" cy="230" rx="130" ry="70" fill="url(#dk${s})"/><path d="M210 220c30-16 70-12 90 10" fill="#f6ead8"/><rect x="420" y="100" width="120" height="200" fill="#321f1b"/><rect x="436" y="120" width="88" height="14" fill="#f6ead8" opacity=".4"/><rect x="436" y="148" width="64" height="8" fill="#c43c2c"/><rect x="70" y="60" width="8" height="300" fill="#c43c2c"/>`, s, defs);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="272" rx="206" ry="100" fill="#000" opacity=".5"/><ellipse cx="328" cy="250" rx="170" ry="80" fill="#3a2420"/><ellipse cx="328" cy="236" rx="128" ry="56" fill="url(#dk${s})"/><path d="M248 220c36-22 84-18 112 10-18 30-72 44-112 24z" fill="#f6ead8"/><path d="M270 214c24 8 48 6 64-8" fill="none" stroke="#7d9a6a" stroke-width="2"/><circle cx="${300 + s * 8}" cy="214" r="7" fill="#7d9a6a"/><path d="M290 176c6-26 16-38 12-6M318 168c8-30 20-40 12-4M344 174c6-24 16-34 10-2" fill="none" stroke="#f6ead8" stroke-width="1.8" opacity=".4"/><rect x="64" y="56" width="8" height="240" fill="#c43c2c"/><path d="M92 72h170M92 98h100" stroke="#f6ead8" stroke-width="3"/>`, s, defs);
}

function editorialArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-editorial-${variant}`;
  const s = slot % 4;
  const sprockets = Array.from({ length: 9 }, (_, i) => `<rect x="${56 + i * 58}" y="18" width="14" height="10" rx="2" fill="#1a1814"/><rect x="${56 + i * 58}" y="392" width="14" height="10" rx="2" fill="#1a1814"/>`).join("");
  if (variant === 1) {
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="48" y="36" width="544" height="348" fill="#16181e"/><rect x="72" y="58" width="240" height="170" fill="#1e2128"/><circle cx="192" cy="140" r="36" fill="#e8e6df" opacity=".1"/><rect x="336" y="58" width="228" height="170" fill="#1e2128"/><path d="M360 90h180M360 118h130" stroke="#e8e6df" stroke-width="6"/><rect x="72" y="248" width="492" height="10" fill="#c81d25"/><rect x="72" y="278" width="200" height="70" fill="#1e2128"/><rect x="292" y="278" width="272" height="70" fill="#1e2128"/>`, s);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="40" y="40" width="560" height="340" fill="#16181e"/><rect x="64" y="64" width="220" height="160" fill="#1e2128"/><circle cx="174" cy="140" r="40" fill="#e8e6df" opacity=".08"/><rect x="308" y="64" width="268" height="268" fill="#1e2128"/><path d="M332 280h220" stroke="#c81d25" stroke-width="3"/><rect x="560" y="40" width="16" height="340" fill="#c81d25"/><path d="M64 340h220" stroke="#c81d25" stroke-width="2"/>`, s);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#16181e"/><rect x="100" y="36" width="440" height="320" fill="#0e1014"/><rect x="128" y="64" width="384" height="230" fill="#1e2128"/><circle cx="320" cy="170" r="58" fill="#e8e6df" opacity=".08"/><rect x="128" y="308" width="90" height="8" fill="#c81d25"/><path d="M36 48h80" stroke="#c81d25" stroke-width="6"/>`, s);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="${48 + s * 6}" y="36" width="390" height="300" fill="#16181e"/><rect x="${72 + s * 6}" y="60" width="342" height="240" fill="#1e2128"/><circle cx="${186 + s * 16}" cy="168" r="52" fill="#e8e6df" opacity=".1"/><rect x="470" y="52" width="16" height="240" fill="#c81d25"/><path d="M96 348h300" stroke="#c81d25" stroke-width="2"/><rect x="72" y="360" width="140" height="8" fill="#e8e6df"/>`, s);
  }
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#e8e0d2"/>${sprockets}<rect x="40" y="40" width="270" height="190" fill="#fffdf8" stroke="#ddd4c6"/><rect x="58" y="56" width="234" height="140" fill="#6a5e52"/><circle cx="140" cy="120" r="28" fill="#c9b496"/><path d="M210 86c24 8 40 28 36 52-30 8-54-8-60-36z" fill="#3d5a1f" opacity=".7"/><rect x="330" y="40" width="270" height="190" fill="#fffdf8" stroke="#ddd4c6"/><rect x="348" y="56" width="234" height="140" fill="#c9b496"/><rect x="370" y="80" width="190" height="90" fill="#6a5e52"/><circle cx="430" cy="125" r="22" fill="#f3efe6" opacity=".35"/><rect x="40" y="250" width="270" height="140" fill="#fffdf8" stroke="#ddd4c6"/><rect x="58" y="268" width="234" height="100" fill="#9a4a28" opacity=".4"/><path d="M80 300h180M80 324h120" stroke="#1a1814" stroke-width="6"/><rect x="330" y="250" width="270" height="140" fill="#fffdf8" stroke="#ddd4c6"/><rect x="348" y="268" width="234" height="100" fill="#1a1814"/><circle cx="430" cy="318" r="26" fill="#c9b496" opacity=".5"/><path d="M40 400h560" stroke="#9a4a28" stroke-width="5"/>`, s);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/><rect x="32" y="28" width="300" height="364" fill="#1a1814"/><rect x="52" y="52" width="260" height="210" fill="#6a5e52"/><circle cx="182" cy="140" r="44" fill="#c9b496" opacity=".55"/><path d="M120 200c40-60 120-70 170-20" fill="none" stroke="#3d5a1f" stroke-width="8"/><rect x="52" y="280" width="260" height="88" fill="#9a4a28" opacity=".35"/><rect x="356" y="28" width="252" height="364" fill="#fffdf8"/><path d="M384 72h196M384 104h150M384 136h180M384 168h120" stroke="#1a1814" stroke-width="7" stroke-linecap="square"/><rect x="384" y="214" width="196" height="8" fill="#9a4a28"/><rect x="384" y="248" width="160" height="90" fill="#c9b496"/><circle cx="464" cy="292" r="24" fill="#6a5e52"/>`, s);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#e8e0d2"/><rect x="70" y="40" width="500" height="340" fill="#fffdf8" stroke="#ddd4c6"/><rect x="96" y="64" width="448" height="210" fill="#c9b496"/><rect x="118" y="84" width="404" height="170" fill="#6a5e52"/><circle cx="250" cy="160" r="40" fill="#f3efe6" opacity=".3"/><path d="M320 120c40-10 80 10 90 48-36 16-80 8-100-20z" fill="#3d5a1f" opacity=".55"/><rect x="118" y="292" width="240" height="12" fill="#1a1814"/><rect x="118" y="318" width="160" height="8" fill="#9a4a28"/><rect x="400" y="292" width="120" height="50" fill="#1a1814"/>`, s);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/>${sprockets}<rect x="36" y="36" width="380" height="320" fill="#fffdf8" stroke="#ddd4c6"/><rect x="56" y="56" width="340" height="230" fill="#c9b496"/><rect x="74" y="74" width="304" height="194" fill="#6a5e52"/><circle cx="${170 + s * 12}" cy="150" r="36" fill="#f3efe6" opacity=".28"/><path d="M220 110c36-8 70 12 74 46-28 14-64 10-84-16z" fill="#3d5a1f" opacity=".6"/><rect x="56" y="300" width="340" height="8" fill="#9a4a28"/><rect x="56" y="322" width="200" height="10" fill="#1a1814"/><rect x="436" y="52" width="168" height="240" fill="#9a4a28" opacity=".14"/><path d="M456 88h128M456 120h96M456 152h112" stroke="#1a1814" stroke-width="5"/><rect x="456" y="200" width="128" height="64" fill="#6a5e52"/>`, s);
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
