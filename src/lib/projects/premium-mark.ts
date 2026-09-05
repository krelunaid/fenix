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
  <linearGradient id="wm-drop-${uid}" x1="48" y1="28" x2="78" y2="92" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#8FD0F2"/>
    <stop offset=".42" stop-color="${accent}"/>
    <stop offset="1" stop-color="#083A6E"/>
  </linearGradient>
  <radialGradient id="wm-spec-${uid}" cx="50" cy="42" r="16" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".92"/>
    <stop offset=".45" stop-color="#fff" stop-opacity=".28"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <filter id="wm-soft-${uid}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#04101C" flood-opacity=".38"/>
  </filter>
</defs>
<rect x="2" y="2" width="116" height="116" rx="32" fill="url(#wm-plate-${uid})"/>
<rect x="2" y="2" width="116" height="116" rx="32" fill="url(#wm-sheen-${uid})"/>
<rect x="2" y="2" width="116" height="116" rx="32" fill="url(#wm-well-${uid})"/>
<circle cx="60" cy="61" r="41" fill="none" stroke="#0A1422" stroke-opacity=".35" stroke-width="9"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${lift}" stroke-opacity=".22" stroke-width="8"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${lift}" stroke-opacity=".94" stroke-width="7.2" stroke-linecap="round" stroke-dasharray="78 174" transform="rotate(-72 60 60)"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${accent}" stroke-width="7.2" stroke-linecap="round" stroke-dasharray="52 200" transform="rotate(-18 60 60)"/>
<ellipse cx="61" cy="88" rx="13" ry="5" fill="#041018" opacity=".28"/>
<path filter="url(#wm-soft-${uid})" fill="url(#wm-drop-${uid})" d="M60 27c11.8 16.4 18.6 28.4 18.6 39.2A18.6 18.6 0 0 1 41.4 66.2C41.4 55.4 48.2 43.4 60 27z"/>
<path fill="url(#wm-spec-${uid})" d="M52 38c4.2-3.6 11.4-3.2 14.8 1.4 1.6 2.2.4 5.2-2.2 6.1-3.6 1.3-8.6-.6-10.8-3.8-1.4-2-1.4-2.8-1.8-3.7z"/>
<path fill="none" stroke="#083056" stroke-width="1.35" stroke-linecap="round" d="M50.5 72.2c3.2 2.2 7.2 3.4 11.4 3.2 3.6-.2 6.8-1.4 9.4-3.2"/>
<path fill="none" stroke="#0B4A86" stroke-width="1.15" stroke-linecap="round" opacity=".8" d="M52.2 77.6c2.8 1.5 6.1 2.3 9.6 2.1 2.8-.1 5.4-1 7.6-2.3"/>
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
