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
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#1a1614"/><path d="M240 90h160l18 36H222z" fill="#f3ece3"/><path d="M250 126h48v250h-48zM342 126h48v250h-48z" fill="#f3ece3"/><path d="M298 126h44v18H298z" fill="#c9b496"/><path d="M274 126v250M366 126v250" stroke="#1a1614" stroke-width="1.2" opacity=".35"/><rect x="40" y="48" width="6" height="300" fill="#c9b496"/><path d="M62 70h140M62 94h88" stroke="#c9b496" stroke-width="2"/>`, s);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#241f1c"/><path d="M300 48l36 28 36-28 22 16-18 40v70l-40 14-40-14V104l-18-40z" fill="#f3ece3"/><path d="M318 96h36M322 118h28" stroke="#c9b496" stroke-width="1.2" fill="none"/><path d="M288 178h96v8H288z" fill="#c9b496"/><path d="M292 186h40v200h-40zM348 186h40v200h-40z" fill="#f3ece3"/><circle cx="120" cy="280" r="36" fill="none" stroke="#c9b496" stroke-width="1.4"/><path d="M48 56h130" stroke="#c9b496" stroke-width="2"/>`, s);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#1a1614"/><path d="M268 70l52 22 52-22 28 36-22 48v210l-58 32-58-32V154l-22-48z" fill="#f3ece3"/><path d="M320 92v250" stroke="#1a1614" stroke-width="1.1"/><path d="M296 150c16 12 32 12 48 0" fill="none" stroke="#c9b496" stroke-width="1.4"/><circle cx="308" cy="178" r="3.5" fill="#1a1614"/><circle cx="308" cy="204" r="3.5" fill="#1a1614"/><circle cx="308" cy="230" r="3.5" fill="#1a1614"/><rect x="40" y="56" width="120" height="8" fill="#c9b496"/><path d="M40 80h90" stroke="#c9b496" stroke-width="2"/>`, s);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1614"/><path d="M278 52l42 30 42-30 26 18-22 50v220l-46 30-46-30V138l-22-50z" fill="#f3ece3"/><path d="M320 82v250" stroke="#1a1614" stroke-width="1.2"/><path d="M300 168h40M304 206h32" stroke="#c9b496" stroke-width="1.1"/><path d="M298 146c14 12 30 12 44 0" fill="none" stroke="#c9b496" stroke-width="1.4"/><rect x="40" y="48" width="7" height="300" fill="#c9b496"/><path d="M64 72h150M64 98h96" stroke="#c9b496" stroke-width="2"/><circle cx="128" cy="292" r="7" fill="#c9b496"/>`, s);
  }
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#161412"/><path d="M220 100h200l22 40H198z" fill="#c81d25"/><path d="M236 140h52v250H236zM352 140h52v250h-52z" fill="#c81d25"/><path d="M236 140h168l-12 28H248z" fill="#161412" opacity=".35"/><path d="M262 140v250M378 140v250" stroke="#f6f1ea" stroke-width="1" opacity=".4"/><path d="M40 292h180" stroke="#c81d25" stroke-width="10"/><rect x="40" y="40" width="132" height="8" fill="#f6f1ea"/><path d="M40 64h88" stroke="#f6f1ea" stroke-width="3"/>`, s);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#f6f1ea"/><path d="M250 56h140l16 44H234z" fill="#161412"/><path d="M258 100h48v268h-48zM334 100h48v268h-48z" fill="#161412"/><path d="M258 100h124l-8 22H266z" fill="#c81d25"/><path d="M282 100v268M358 100v268" stroke="#f6f1ea" stroke-width="1" opacity=".25"/><circle cx="128" cy="268" r="52" fill="none" stroke="#161412" stroke-width="2"/><path d="M104 268h48" stroke="#c81d25" stroke-width="3"/><path d="M48 48h120M48 70h72" stroke="#161412" stroke-width="3"/>`, s);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#fffdf8"/><path d="M288 48l32 24 32-24 20 18-16 36v70H284V102l-16-36z" fill="#161412"/><rect x="284" y="178" width="72" height="12" fill="#c81d25"/><path d="M270 190c40 70 40 140 10 200" fill="none" stroke="#161412" stroke-width="46" stroke-linecap="butt"/><path d="M370 190c-40 70-40 140-10 200" fill="none" stroke="#161412" stroke-width="46"/><path d="M270 190c40 70 40 140 10 200" fill="none" stroke="#c81d25" stroke-width="2" opacity=".5"/><rect x="40" y="48" width="110" height="8" fill="#161412"/><path d="M40 320h160" stroke="#c81d25" stroke-width="6"/>`, s);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#f6f1ea"/><path d="M262 58l50-20 50 20 40 40-28 44v230l-62 36-62-36V166l-28-44z" fill="#161412"/><path d="M312 86l-22 48v210" fill="none" stroke="#f6f1ea" stroke-width="1" opacity=".35"/><path d="M286 148h76v20H286z" fill="#c81d25"/><path d="M298 186c16 18 44 18 60 0" fill="none" stroke="#c81d25" stroke-width="2"/><circle cx="300" cy="220" r="3.2" fill="#f6f1ea"/><circle cx="300" cy="248" r="3.2" fill="#f6f1ea"/><circle cx="300" cy="276" r="3.2" fill="#f6f1ea"/><rect x="292" y="318" width="36" height="10" fill="#3a3028"/><path d="M48 56h140M48 80h90" stroke="#161412" stroke-width="3"/><rect x="48" y="304" width="160" height="6" fill="#c81d25"/>`, s);
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
    const defs = `<radialGradient id="pl${s}" cx=".5" cy=".42" r=".52"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8ee"/></radialGradient><linearGradient id="mv${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef3f6"/><stop offset=".5" stop-color="#d5e0e6"/><stop offset="1" stop-color="#eef3f6"/></linearGradient>`;
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="url(#mv${s})"/><ellipse cx="320" cy="258" rx="236" ry="122" fill="#dfe8ee"/><ellipse cx="320" cy="240" rx="180" ry="92" fill="url(#pl${s})"/><ellipse cx="292" cy="222" rx="72" ry="30" fill="#8fb7a0"/><circle cx="368" cy="214" r="24" fill="#e25c2a"/><circle cx="248" cy="230" r="11" fill="#2f6b4a"/><path d="M200 210c40-16 80 8 70 28" fill="none" stroke="#2f6b4a" stroke-width="2"/><path d="M150 64h100M150 86h64" stroke="#12202c" stroke-width="3"/>`, s, defs);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#e4eef2"/><ellipse cx="240" cy="250" rx="170" ry="90" fill="url(#pl${s})"/><path d="M170 240c30-20 70-12 90 12 28-24 70-16 100 10-20 28-70 44-110 36-40 2-70-16-80-58z" fill="#8fb7a0"/><circle cx="250" cy="220" r="16" fill="#e25c2a"/><ellipse cx="470" cy="210" rx="46" ry="70" fill="#ffffff" stroke="#cfdbe0"/><ellipse cx="470" cy="210" rx="30" ry="50" fill="#e25c2a" opacity=".15"/><path d="M454 160c20 0 32 16 32 36" fill="none" stroke="#12202c" stroke-width="2"/><path d="M40 56h140" stroke="#12202c" stroke-width="3"/>`, s, defs);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#dfe8ee"/><rect x="80" y="70" width="480" height="280" fill="#ffffff"/><ellipse cx="250" cy="220" rx="120" ry="70" fill="url(#pl${s})"/><circle cx="240" cy="210" r="28" fill="#8fb7a0"/><circle cx="280" cy="200" r="14" fill="#e25c2a"/><rect x="400" y="120" width="120" height="180" fill="#12202c"/><rect x="416" y="140" width="88" height="12" fill="#eef3f6"/><rect x="416" y="168" width="70" height="8" fill="#2f6b4a"/><path d="M80 70h480" stroke="#2f6b4a" stroke-width="4"/>`, s, defs);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#eef3f6"/><path d="M40 80c80 40 120-20 200 10 90-30 160 20 240-8 70 24 120 8 160 24v314H0z" fill="#d5e0e6" opacity=".5"/><ellipse cx="320" cy="250" rx="210" ry="110" fill="#dfe8ee"/><ellipse cx="320" cy="236" rx="170" ry="86" fill="url(#pl${s})"/><path d="M210 220c40-30 90-20 120 10 40-36 90-20 130 16-30 40-90 60-140 54-50 4-90-20-110-80z" fill="#8fb7a0"/><circle cx="${250 + s * 10}" cy="210" r="18" fill="#e25c2a"/><circle cx="360" cy="200" r="10" fill="#2f6b4a"/><path d="M240 200c20-30 40-28 36 4" fill="none" stroke="#8fb7a0" stroke-width="2" opacity=".6"/><path d="M180 80h90M180 102h56" stroke="#12202c" stroke-width="3"/>`, s, defs);
  }
  const defs = `<radialGradient id="dk${s}" cx=".5" cy=".38" r=".55"><stop offset="0" stop-color="#e25c2a"/><stop offset=".45" stop-color="#c43c2c"/><stop offset="1" stop-color="#3a2420"/></radialGradient>`;
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#1a1210"/><ellipse cx="330" cy="280" rx="220" ry="96" fill="#000" opacity=".45"/><ellipse cx="328" cy="246" rx="156" ry="66" fill="url(#dk${s})"/><path d="M250 228c40-22 96-18 128 12-22 32-86 44-128 20z" fill="#f6ead8"/><path d="M280 180c8-28 20-40 16-8M310 170c6-32 22-44 14-6M340 176c8-26 18-36 12-4" fill="none" stroke="#f6ead8" stroke-width="2" opacity=".35"/><rect x="56" y="48" width="8" height="240" fill="#c43c2c"/>`, s, defs);
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
  if (variant === 1) {
    if (s === 1) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="80" y="48" width="280" height="200" fill="#16181e"/><rect x="100" y="68" width="240" height="160" fill="#1e2128"/><rect x="380" y="80" width="180" height="140" fill="#16181e"/><rect x="396" y="96" width="148" height="108" fill="#1e2128"/><rect x="80" y="268" width="480" height="8" fill="#c81d25"/><circle cx="200" cy="148" r="40" fill="#e8e6df" opacity=".12"/>`, s);
    }
    if (s === 2) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="48" y="48" width="544" height="324" fill="#16181e"/><rect x="80" y="80" width="200" height="140" fill="#1e2128"/><rect x="300" y="80" width="250" height="250" fill="#1e2128"/><rect x="560" y="48" width="14" height="324" fill="#c81d25"/><circle cx="180" cy="150" r="36" fill="#e8e6df" opacity=".1"/><path d="M80 340h470" stroke="#c81d25" stroke-width="2"/>`, s);
    }
    if (s === 3) {
      return wrap(id, alt, `<rect width="640" height="420" fill="#16181e"/><rect x="120" y="40" width="400" height="300" fill="#0e1014"/><rect x="148" y="68" width="344" height="220" fill="#1e2128"/><circle cx="320" cy="170" r="54" fill="#e8e6df" opacity=".08"/><rect x="148" y="300" width="80" height="8" fill="#c81d25"/><path d="M40 48h80" stroke="#c81d25" stroke-width="6"/>`, s);
    }
    return wrap(id, alt, `<rect width="640" height="420" fill="#0e1014"/><rect x="${60 + s * 8}" y="40" width="370" height="290" fill="#16181e"/><rect x="${84 + s * 8}" y="64" width="322" height="230" fill="#1e2128"/><rect x="478" y="56" width="14" height="230" fill="#c81d25"/><circle cx="${190 + s * 18}" cy="170" r="50" fill="#e8e6df" opacity=".12"/><path d="M110 336h280" stroke="#c81d25" stroke-width="2"/><rect x="80" y="348" width="130" height="8" fill="#e8e6df"/>`, s);
  }
  if (s === 1) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/><rect x="48" y="40" width="250" height="180" fill="#fffdf8" stroke="#ddd4c6"/><rect x="68" y="60" width="210" height="140" fill="#6a5e52"/><rect x="320" y="40" width="250" height="180" fill="#fffdf8" stroke="#ddd4c6"/><rect x="340" y="60" width="210" height="140" fill="#c9b496"/><rect x="48" y="240" width="250" height="140" fill="#fffdf8" stroke="#ddd4c6"/><rect x="68" y="256" width="210" height="100" fill="#9a4a28" opacity=".35"/><rect x="320" y="240" width="250" height="140" fill="#fffdf8" stroke="#ddd4c6"/><path d="M48 390h522" stroke="#9a4a28" stroke-width="5"/>`, s);
  }
  if (s === 2) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/><rect x="40" y="36" width="280" height="348" fill="#1a1814"/><rect x="60" y="60" width="240" height="200" fill="#6a5e52"/><circle cx="180" cy="150" r="40" fill="#f3efe6" opacity=".2"/><rect x="340" y="36" width="260" height="348" fill="#fffdf8"/><path d="M368 80h200M368 110h150M368 140h180" stroke="#1a1814" stroke-width="8" stroke-linecap="square"/><rect x="368" y="200" width="200" height="8" fill="#9a4a28"/>`, s);
  }
  if (s === 3) {
    return wrap(id, alt, `<rect width="640" height="420" fill="#e8e0d2"/><rect x="80" y="50" width="480" height="320" fill="#fffdf8" stroke="#ddd4c6"/><rect x="110" y="80" width="420" height="200" fill="#c9b496"/><rect x="130" y="100" width="380" height="160" fill="#6a5e52"/><circle cx="320" cy="180" r="48" fill="#f3efe6" opacity=".28"/><rect x="110" y="300" width="220" height="12" fill="#1a1814"/><rect x="110" y="324" width="140" height="8" fill="#9a4a28"/>`, s);
  }
  return wrap(id, alt, `<rect width="640" height="420" fill="#f3efe6"/><rect x="40" y="32" width="372" height="312" fill="#fffdf8" stroke="#ddd4c6"/><rect x="64" y="56" width="324" height="220" fill="#c9b496"/><rect x="80" y="72" width="292" height="188" fill="#6a5e52"/><circle cx="${188 + s * 14}" cy="154" r="44" fill="#f3efe6" opacity=".32"/><rect x="432" y="56" width="164" height="228" fill="#9a4a28" opacity=".12"/><path d="M64 296h324" stroke="#9a4a28" stroke-width="6"/><rect x="64" y="328" width="190" height="10" fill="#1a1814"/>`, s);
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
