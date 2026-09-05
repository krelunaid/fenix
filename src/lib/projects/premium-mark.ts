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

/** 120-grid squircle with a progress ring and the sector glyph. Lighting is CSS/SVG, not a bitmap. */
export function premiumAppMarkSvg(
  id: string,
  colors: PremiumMarkColors,
  glyphSvg: string,
): string {
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
