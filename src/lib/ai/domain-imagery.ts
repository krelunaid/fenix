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
];

function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&" + "amp;")
    .replace(/"/g, "&" + "quot;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;");
}

function wrap(id: string, alt: string, inner: string): string {
  return `<svg class="domain-art" data-imagery="domain" data-provenance="${esc(id)}" viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
}

function perfumeArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-perfume-${variant}`;
  if (variant === 1) {
    const shift = slot * 18;
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#dce6ee"/>
      <rect x="0" y="300" width="640" height="120" fill="#c5d3de"/>
      <ellipse cx="${420 + shift}" cy="300" rx="120" ry="18" fill="#9aafbd" opacity=".45"/>
      <rect x="${372 + shift}" y="86" width="96" height="214" rx="8" fill="#8eb0c4"/>
      <rect x="${380 + shift}" y="98" width="80" height="190" rx="6" fill="#cfe0ea"/>
      <path d="M${388 + shift} 120h64v150c0 22-14 40-32 40s-32-18-32-40z" fill="#7ea8bc" opacity=".55"/>
      <rect x="${400 + shift}" y="48" width="40" height="42" rx="4" fill="#1a3a52"/>
      <rect x="${408 + shift}" y="36" width="24" height="16" rx="3" fill="#12202c"/>
      <path d="M40 80h180" stroke="#1a3a52" stroke-width="2"/>
      <circle cx="86" cy="210" r="54" fill="none" stroke="#1a3a52" stroke-width="1.4"/>
      <path d="M60 320c40-60 120-60 160 0" fill="none" stroke="#5c6d7a" stroke-width="1.2"/>`,
    );
  }
  const x = 390 + slot * 16;
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="#120e0c"/>
    <ellipse cx="${x + 40}" cy="330" rx="110" ry="22" fill="#000" opacity=".45"/>
    <path d="M${x} 160c8-70 80-70 88 0v150c0 40-18 62-44 62s-44-22-44-62z" fill="#c4a15a"/>
    <path d="M${x + 10} 168c6-54 62-54 68 0v140c0 34-14 52-34 52s-34-18-34-52z" fill="#2a211c"/>
    <rect x="${x + 32}" y="92" width="24" height="72" rx="5" fill="#f4ead8"/>
    <rect x="${x + 28}" y="70" width="32" height="28" rx="4" fill="#c4a15a"/>
    <path d="M48 72h140" stroke="#c4a15a" stroke-width="1.6"/>
    <circle cx="120" cy="240" r="64" fill="#1d1714"/>
    <path d="M70 318c30-40 90-40 120 0" fill="none" stroke="#3a3028" stroke-width="2"/>`,
  );
}

function fashionArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-fashion-${variant}`;
  if (variant === 1) {
    const x = 300 + slot * 20;
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#1a1614"/>
      <path d="M${x} 70l36 28 36-28 22 18-22 48v200l-36 24-36-24V136l-22-48z" fill="#f3ece3"/>
      <path d="M${x + 36} 98v246" stroke="#1a1614" stroke-width="1.4"/>
      <path d="M${x + 18} 168h72" stroke="#c9b496" stroke-width="1.2"/>
      <rect x="48" y="56" width="8" height="280" fill="#c9b496"/>
      <path d="M80 80h140M80 104h90" stroke="#c9b496" stroke-width="2"/>`,
    );
  }
  if (slot === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#161412"/>
      <path d="M300 64l50 36 50-36 28 24-30 70v200L350 390 272 358V194l-28-70z" fill="#c81d25"/>
      <path d="M330 120v210" stroke="#f6f1ea" stroke-width="1.2"/>
      <path d="M48 300h160" stroke="#c81d25" stroke-width="8"/>
      <rect x="48" y="48" width="120" height="8" fill="#f6f1ea"/>`,
    );
  }
  if (slot === 2) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#f6f1ea"/>
      <path d="M250 80h140l12 40H238z" fill="#161412"/>
      <path d="M262 120h40v240h-40zM338 120h40v240h-40z" fill="#161412"/>
      <path d="M262 120h116l-8 28H270z" fill="#c81d25"/>
      <circle cx="140" cy="280" r="50" fill="none" stroke="#161412" stroke-width="2"/>`,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="#f6f1ea"/>
    <path d="M268 72l52-24 52 24 36 40-28 36v220l-60 32-60-32V148l-28-36z" fill="#161412"/>
    <path d="M292 148h88v20H292z" fill="#c81d25"/>
    <path d="M48 64h140M48 88h90" stroke="#161412" stroke-width="3"/>
    <rect x="48" y="300" width="160" height="6" fill="#c81d25"/>`,
  );
}

function bookingArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-booking-${variant}`;
  if (variant === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#f4efe4"/>
      <rect x="40" y="70" width="560" height="280" rx="8" fill="#fffaf1" stroke="#e0d4c4"/>
      <rect x="70" y="110" width="360" height="200" fill="#e8dcc8"/>
      <rect x="90" y="130" width="320" height="12" fill="#8a4b2e"/>
      <path d="M470 150l70 40-24 70-70-40z" fill="#2a2118"/>
      <path d="M490 170l36 20" stroke="#8a4b2e" stroke-width="4"/>
      <circle cx="${160 + slot * 30}" cy="250" r="18" fill="#8a4b2e" opacity=".3"/>`,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="#1f6f68"/>
    <rect x="36" y="48" width="280" height="200" rx="18" fill="#eef3ea"/>
    <rect x="70" y="80" width="90" height="130" rx="8" fill="#1a2a24"/>
    <rect x="180" y="120" width="100" height="90" rx="10" fill="#c9d6c8"/>
    <circle cx="170" cy="300" r="${36 + slot * 4}" fill="#eef3ea"/>
    <rect x="340" y="70" width="240" height="160" rx="16" fill="#c9d6c8"/>
    <path d="M370 110h180M370 140h120" stroke="#1a2a24" stroke-width="6" stroke-linecap="round"/>
    <rect x="70" y="330" width="200" height="10" fill="#1a2a24"/>`,
  );
}

function opsArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-ops-${variant}`;
  const bars = [70, 110, 160, 90, 140].map((h, i) => {
    const x = 80 + i * 70 + slot * 4;
    const y = 300 - h;
    return `<rect x="${x}" y="${y}" width="36" height="${h}" rx="4" fill="${variant ? "#3d5a1f" : "#d4a017"}"/>`;
  });
  if (variant === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#e7efe2"/>
      <rect x="40" y="48" width="560" height="320" rx="12" fill="#f4f8f0"/>
      ${bars.join("")}
      <path d="M80 80h200M80 104h140" stroke="#1c2a18" stroke-width="6" stroke-linecap="round"/>
      <rect x="420" y="72" width="140" height="90" rx="10" fill="#3d5a1f"/>
      <path d="M70 340h500" stroke="#c9d6c0" stroke-width="2"/>`,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="#10151c"/>
    <rect x="36" y="40" width="568" height="340" rx="10" fill="#171e28"/>
    ${bars.join("")}
    <path d="M72 76h220M72 102h160" stroke="#e7e1d4" stroke-width="5" stroke-linecap="round"/>
    <path d="M80 210l70-40 60 20 80-50 70 10" fill="none" stroke="#d4a017" stroke-width="3"/>
    <rect x="430" y="64" width="140" height="72" rx="8" fill="#d4a017"/>`,
  );
}

function utilityArt(variant: 0 | 1, slot: number, alt: string): string {
  const id = `svg-utility-${variant}`;
  if (variant === 1) {
    return wrap(
      id,
      alt,
      `<rect width="640" height="420" fill="#111318"/>
      <rect x="70" y="160" width="500" height="72" rx="12" fill="#6ec8b8"/>
      <g fill="#111318">${Array.from({ length: 18 }, (_, i) => `<rect x="${90 + i * 26}" y="168" width="2" height="${i % 5 === 0 ? 36 : 16}"/>`).join("")}</g>
      <circle cx="${160 + slot * 40}" cy="300" r="28" fill="none" stroke="#6ec8b8" stroke-width="3"/>
      <path d="M80 80h200" stroke="#e8e4d8" stroke-width="4"/>`,
    );
  }
  return wrap(
    id,
    alt,
    `<rect width="640" height="420" fill="#f6f3ee"/>
    <rect x="80" y="70" width="360" height="260" fill="none" stroke="#1b1814" stroke-width="2" stroke-dasharray="8 10"/>
    <path d="M420 90l90 50-40 90-90-48z" fill="#d6452d"/>
    <path d="M448 118l48 28" stroke="#1b1814" stroke-width="5"/>
    <circle cx="${140 + slot * 24}" cy="300" r="10" fill="#d6452d"/>
    <path d="M80 70h24M80 70v24M440 70h-24M440 70v24" stroke="#1b1814" stroke-width="3"/>`,
  );
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
