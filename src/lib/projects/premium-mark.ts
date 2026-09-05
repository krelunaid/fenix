/** Original squircle app mark. Domain colors only — never Apple SET or a copied 3D drop. */

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

/** Glossy water-ops mark: original drop + beveled ring. Not a cloned 3D asset, not Apple SET. */
export function glossyWaterMarkSvg(id: string, colors: PremiumMarkColors): string {
  const uid = esc(id) || "mark";
  const accent = colors.accent || "#0D73C4";
  const fg = colors.fg || "#121C2D";
  const lift = colors.elevated || "#F4F7FB";
  return `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-hidden="true" data-craft-app="1" data-fenix-premium-mark="1" data-fenix-water-mark="1" overflow="visible">
<defs>
  <linearGradient id="wm-plate-${uid}" x1="16" y1="6" x2="108" y2="118" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${fg}"/>
    <stop offset=".48" stop-color="${fg}"/>
    <stop offset="1" stop-color="${accent}"/>
  </linearGradient>
  <radialGradient id="wm-sheen-${uid}" cx="34" cy="24" r="58" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${lift}" stop-opacity=".46"/>
    <stop offset=".55" stop-color="${lift}" stop-opacity=".08"/>
    <stop offset="1" stop-color="${fg}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="wm-well-${uid}" cx="78" cy="92" r="54" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#000" stop-opacity=".28"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="wm-drop-${uid}" x1="44" y1="24" x2="80" y2="94" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#D6F1FF"/>
    <stop offset=".22" stop-color="#7EC8F2"/>
    <stop offset=".55" stop-color="${accent}"/>
    <stop offset="1" stop-color="#052A52"/>
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
<circle cx="60" cy="62" r="41.5" fill="none" stroke="#040910" stroke-opacity=".4" stroke-width="10"/>
<circle cx="60" cy="59.2" r="40" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.2"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${lift}" stroke-opacity=".2" stroke-width="8"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${lift}" stroke-opacity=".96" stroke-width="8" stroke-linecap="round" stroke-dasharray="92 160" transform="rotate(-88 60 60)"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-dasharray="58 194" transform="rotate(-12 60 60)"/>
<ellipse cx="61" cy="89" rx="14" ry="5.5" fill="#041018" opacity=".32"/>
<path filter="url(#wm-soft-${uid})" fill="url(#wm-drop-${uid})" d="M60 26c12.4 17.2 19.4 29.6 19.4 40.6A19.4 19.4 0 0 1 40.6 66.6C40.6 55.6 47.6 43.2 60 26z"/>
<path fill="url(#wm-glass-${uid})" d="M60 26c12.4 17.2 19.4 29.6 19.4 40.6A19.4 19.4 0 0 1 40.6 66.6C40.6 55.6 47.6 43.2 60 26z"/>
<ellipse cx="51.5" cy="41" rx="6.2" ry="8.4" fill="url(#wm-spec-${uid})"/>
<path fill="none" stroke="#EAF7FF" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" d="M47.8 46c2.4-6.4 8.6-10.2 14.2-8.4"/>
<path fill="none" stroke="#083056" stroke-width="1.4" stroke-linecap="round" d="M50.2 73.2c3.4 2.3 7.6 3.5 12 3.2 3.8-.2 7.1-1.5 9.8-3.4"/>
<path fill="none" stroke="#0B4A86" stroke-width="1.2" stroke-linecap="round" opacity=".85" d="M52 78.4c2.9 1.6 6.4 2.4 10 2.2 2.9-.1 5.6-1 7.9-2.4"/>
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
