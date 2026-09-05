/** Original squircle app mark. Domain colors only — never Apple SET or a copied 3D drop. */

import { craftNavIcon } from "./craft-icons.ts";

function innerSvg(svg: string): string {
  return String(svg || "")
    .replace(/^<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "");
}

function esc(id: string): string {
  return String(id || "mark").replace(/[^a-zA-Z0-9_-]/g, "");
}

export type PremiumMarkColors = {
  accent: string;
  fg: string;
  bg: string;
  elevated?: string;
};

/**
 * Crisp filled water-drop chip. Readable at favicon and 48px header size.
 * Navy plate + opaque drop — never a pale outline or 18% wash.
 */
export function crispWaterDropMarkSvg(id: string): string {
  const uid = esc(id) || "mark";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-hidden="true" data-craft-app="1" data-fenix-premium-mark="1" data-fenix-water-mark="1" data-fenix-water-header="1">
<defs>
  <linearGradient id="cwd-plate-${uid}" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#0F3A5C"/>
    <stop offset="1" stop-color="#082338"/>
  </linearGradient>
  <linearGradient id="cwd-drop-${uid}" x1="11" y1="6" x2="22" y2="26" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#E0F2FE"/>
    <stop offset=".38" stop-color="#38BDF8"/>
    <stop offset="1" stop-color="#0284C7"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="32" height="32" rx="9" fill="url(#cwd-plate-${uid})"/>
<g transform="translate(16 16.6) scale(1.22) translate(-12 -13)">
  <path fill="url(#cwd-drop-${uid})" d="M12 4.4c3.8 4.8 5.6 8.2 5.6 11a5.6 5.6 0 0 1-11.2 0C6.4 12.6 8.2 9.2 12 4.4z"/>
</g>
<ellipse cx="13.4" cy="12.2" rx="2.2" ry="3" fill="#fff" fill-opacity=".62"/>
</svg>`;
}

function crispChipOpen(id: string, extraAttr: string, defs: string): string {
  const uid = esc(id) || "mark";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-hidden="true" data-craft-app="1" data-fenix-premium-mark="1" data-fenix-crisp-mark="1" ${extraAttr}>
<defs>
  <linearGradient id="ccm-plate-${uid}" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#0F3A5C"/>
    <stop offset="1" stop-color="#082338"/>
  </linearGradient>
${defs}
</defs>
<rect x="0" y="0" width="32" height="32" rx="9" fill="url(#ccm-plate-${uid})"/>`;
}

/**
 * Crisp filled shears chip. Navy plate + opaque gold blades — not a faint X outline.
 */
export function crispBarberMarkSvg(id: string): string {
  const uid = esc(id) || "mark";
  return `${crispChipOpen(
    id,
    'data-fenix-barber-mark="1"',
    `  <linearGradient id="cbm-glyph-${uid}" x1="8" y1="5" x2="24" y2="26" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#FEF3C7"/>
    <stop offset=".45" stop-color="#FDE68A"/>
    <stop offset="1" stop-color="#D97706"/>
  </linearGradient>`,
  )}
<g transform="translate(16 16.4) scale(1.18) translate(-12 -13)">
  <path fill="url(#cbm-glyph-${uid})" fill-rule="evenodd" d="M7.5 16.2a2.65 2.65 0 1 1 0 5.3 2.65 2.65 0 0 1 0-5.3zm0 1.75a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/>
  <path fill="url(#cbm-glyph-${uid})" fill-rule="evenodd" d="M16.5 16.2a2.65 2.65 0 1 1 0 5.3 2.65 2.65 0 0 1 0-5.3zm0 1.75a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/>
  <path fill="url(#cbm-glyph-${uid})" d="M9.4 16.2 17.6 5.6c.48-.58 1.32-.5 1.72.16l.58.92c.3.48.1 1.12-.4 1.44L10.8 17.5z"/>
  <path fill="url(#cbm-glyph-${uid})" d="M14.6 16.2 6.4 5.6c-.48-.58-1.32-.5-1.72.16l-.58.92c-.3.48-.1 1.12.4 1.44L13.2 17.5z"/>
  <circle cx="12" cy="16.7" r="1.2" fill="url(#cbm-glyph-${uid})"/>
</g>
<ellipse cx="12.6" cy="10.4" rx="2" ry="2.6" fill="#fff" fill-opacity=".5"/>
</svg>`;
}

/**
 * Crisp filled book chip. Navy plate + opaque cream volume — not a dim scrap outline.
 */
export function crispBookMarkSvg(id: string): string {
  const uid = esc(id) || "mark";
  return `${crispChipOpen(
    id,
    'data-fenix-book-mark="1"',
    `  <linearGradient id="cbk-cover-${uid}" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#F8FAFC"/>
    <stop offset=".4" stop-color="#E0F2FE"/>
    <stop offset="1" stop-color="#7DD3FC"/>
  </linearGradient>
  <linearGradient id="cbk-spine-${uid}" x1="8" y1="6" x2="12" y2="26" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#38BDF8"/>
    <stop offset="1" stop-color="#0369A1"/>
  </linearGradient>`,
  )}
<path fill="url(#cbk-cover-${uid})" d="M8.2 6.2h13.4c1.15 0 1.9.85 1.9 1.9v16.1c0 .72-.62 1.28-1.42 1.28H9.55c-1.55 0-2.45-.92-2.45-2.25V8.15c0-1.08.92-1.95 2.1-1.95z"/>
<path fill="url(#cbk-spine-${uid})" d="M8.2 6.2h2.85v18.95H9.55c-1.55 0-2.45-.92-2.45-2.25V8.15c0-1.08.92-1.95 2.1-1.95z"/>
<path fill="#fff" fill-opacity=".7" d="M13.15 10.15h6.35v1.2H13.15zm0 3.15h6.35v1.2H13.15zm0 3.15h4.7v1.2H13.15z"/>
<path fill="#38BDF8" d="M20.55 6.2h2.05v7.35l-1.02-1.25-1.03 1.25z"/>
<ellipse cx="14.2" cy="9.6" rx="2.1" ry="2.8" fill="#fff" fill-opacity=".42"/>
</svg>`;
}

/** Navy chip + opaque sector glyph. Used for generic utility / editorial / ops. */
export function crispFilledGlyphMarkSvg(id: string, glyphSvg: string): string {
  const glyph = innerSvg(glyphSvg);
  return `${crispChipOpen(id, 'data-fenix-glyph-mark="1"', "")}
<g fill="#E0F2FE" stroke="#E0F2FE" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.4 3.4) scale(1.05)">
${glyph}
</g>
</svg>`;
}

/** Dispatch a water-quality filled chip from the sector identity label. */
export function crispAppMarkSvg(id: string, label: string): string {
  const key = String(label || "").toLowerCase().trim();
  if (/acqua|bottiglia|serbatoio|botte|livello/.test(key)) return crispWaterDropMarkSvg(id);
  if (/taglio|cucito/.test(key)) return crispBarberMarkSvg(id);
  if (/libri|bibliotec|catalogo/.test(key)) return crispBookMarkSvg(id);
  return crispFilledGlyphMarkSvg(id, craftNavIcon({ id: "app", label }));
}

/** Glossy water-ops mark: original drop + beveled ring. Not a cloned 3D asset, not Apple SET. */
export function glossyWaterMarkSvg(id: string, colors: PremiumMarkColors): string {
  const uid = esc(id) || "mark";
  const accent = colors.accent || "#0EA5E9";
  const fg = colors.fg || "#0F172A";
  const lift = colors.elevated || "#F8FAFC";
  const track = "#E8EEF4";
  return `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-hidden="true" data-craft-app="1" data-fenix-premium-mark="1" data-fenix-water-mark="1" overflow="visible">
<defs>
  <linearGradient id="wm-plate-${uid}" x1="60" y1="4" x2="60" y2="118" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1E293B"/>
    <stop offset=".42" stop-color="${fg}"/>
    <stop offset="1" stop-color="${fg}"/>
  </linearGradient>
  <radialGradient id="wm-sheen-${uid}" cx="40" cy="18" r="62" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${lift}" stop-opacity=".38"/>
    <stop offset=".5" stop-color="${lift}" stop-opacity=".08"/>
    <stop offset="1" stop-color="${fg}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="wm-well-${uid}" cx="78" cy="92" r="54" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#000" stop-opacity=".28"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="wm-drop-${uid}" x1="44" y1="24" x2="80" y2="94" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#E0F2FE"/>
    <stop offset=".2" stop-color="#7DD3FC"/>
    <stop offset=".52" stop-color="${accent}"/>
    <stop offset="1" stop-color="#0369A1"/>
  </linearGradient>
  <radialGradient id="wm-spec-${uid}" cx="49" cy="40" r="14" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="1"/>
    <stop offset=".35" stop-color="#fff" stop-opacity=".55"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="wm-glass-${uid}" cx="62" cy="58" r="22" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <filter id="wm-soft-${uid}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3.5" stdDeviation="2.6" flood-color="#04101C" flood-opacity=".45"/>
  </filter>
</defs>
<rect x="2" y="2" width="116" height="116" rx="32" fill="url(#wm-plate-${uid})"/>
<rect x="2" y="2" width="116" height="116" rx="32" fill="url(#wm-sheen-${uid})"/>
<rect x="2" y="2" width="116" height="116" rx="32" fill="url(#wm-well-${uid})"/>
<circle cx="60" cy="62" r="38" fill="none" stroke="#020617" stroke-opacity=".45" stroke-width="11"/>
<circle cx="60" cy="60" r="37" fill="none" stroke="${track}" stroke-width="9"/>
<circle cx="60" cy="58.6" r="37" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4"/>
<circle cx="60" cy="60" r="37" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round" stroke-dasharray="58 174" transform="rotate(-20 60 60)"/>
<ellipse cx="61" cy="90" rx="15" ry="6" fill="#020617" opacity=".34"/>
<path filter="url(#wm-soft-${uid})" fill="url(#wm-drop-${uid})" d="M60 26c12.4 17.2 19.4 29.6 19.4 40.6A19.4 19.4 0 0 1 40.6 66.6C40.6 55.6 47.6 43.2 60 26z"/>
<path fill="url(#wm-glass-${uid})" d="M60 26c12.4 17.2 19.4 29.6 19.4 40.6A19.4 19.4 0 0 1 40.6 66.6C40.6 55.6 47.6 43.2 60 26z"/>
<ellipse cx="51.5" cy="41" rx="6.2" ry="8.4" fill="url(#wm-spec-${uid})"/>
<path fill="none" stroke="#0369A1" stroke-width="1.5" stroke-linecap="round" d="M49.6 70.8c3.6 2.2 8.2 3.3 12.8 2.9 3.6-.3 6.8-1.4 9.4-3.1"/>
<path fill="none" stroke="#075985" stroke-width="1.25" stroke-linecap="round" d="M51.2 76.6c3.2 1.7 7.2 2.5 11.2 2.2 3-.2 5.8-1.1 8.2-2.5"/>
</svg>`;
}

/** 120-grid squircle with a progress ring and the sector glyph. Lighting is CSS/SVG, not a bitmap. */
export function premiumAppMarkSvg(
  id: string,
  colors: PremiumMarkColors,
  glyphSvg: string,
  opts?: { water?: boolean },
): string {
  if (opts?.water) return glossyWaterMarkSvg(id, colors);
  const uid = esc(id) || "mark";
  const accent = colors.accent || "#173a63";
  const fg = colors.fg || "#142033";
  const bg = colors.bg || "#f4f6fa";
  const lift = colors.elevated || bg;
  const glyph = innerSvg(glyphSvg);
  return `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-hidden="true" data-craft-app="1" data-fenix-premium-mark="1" overflow="visible">
<defs>
  <linearGradient id="pm-bg-${uid}" x1="18" y1="8" x2="104" y2="116" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${fg}"/>
    <stop offset=".55" stop-color="${fg}"/>
    <stop offset="1" stop-color="${accent}"/>
  </linearGradient>
  <radialGradient id="pm-hi-${uid}" cx="34" cy="26" r="48" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${lift}" stop-opacity=".38"/>
    <stop offset="1" stop-color="${fg}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect x="2" y="2" width="116" height="116" rx="30" fill="url(#pm-bg-${uid})"/>
<rect x="2" y="2" width="116" height="116" rx="30" fill="url(#pm-hi-${uid})"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${bg}" stroke-opacity=".28" stroke-width="7"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${bg}" stroke-opacity=".92" stroke-width="7" stroke-linecap="round" stroke-dasharray="86 166" transform="rotate(-90 60 60)"/>
<g fill="none" stroke="${bg}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" transform="translate(36 34) scale(2)">
${glyph}
</g>
</svg>`;
}

export function premiumMarkDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
