import type { Palette, ProjectKind } from "@/lib/projects/types";

const MOTIFS: { test: RegExp; d: string }[] = [
  { test: /caff|coffee|espresso|bar\b|roast/i, d: "M10 12h12v8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-8zm12 2h2a3 3 0 0 1 0 6h-2M12 8c0-2 2-3 4-3" },
  { test: /pane|forno|bakery|bread|pasticc/i, d: "M8 18c0-6 16-6 16 0v2H8v-2zm2-2c1-4 12-4 12 0" },
  { test: /medit|yoga|zen|calm|breath|sleep/i, d: "M16 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 14c1-5 5-7 6-7s5 2 6 7" },
  { test: /spes|soldi|money|pay|finan|bank|budget/i, d: "M8 12h16v10H8V12zm8-4a4 4 0 0 1 4 4H12a4 4 0 0 1 4-4zm-6 9h12" },
  { test: /foto|photo|portfolio|camera|studio/i, d: "M8 12h4l2-3h4l2 3h4v10H8V12zm8 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" },
  { test: /memory|gioco|game|play|puzzle/i, d: "M10 10h5v5h-5zM17 10h5v5h-5zM10 17h5v5h-5zM17 17h5v5h-5z" },
  { test: /dash|saas|crm|analit|metric/i, d: "M8 22V12h5v10H8zm6 0V8h5v14h-5zm6 0v-7h4v7h-4z" },
  { test: /ristor|trattor|menu|food|cucina|chef/i, d: "M11 8v16M9 8h4M21 8c0 4-2 5-2 8v8M19 8h4" },
  { test: /moda|fashion|abito|cloth/i, d: "M10 8l6-2 6 2-2 6v12H12V14L10 8z" },
  { test: /viagg|travel|hotel|flight/i, d: "M6 18l10-6 10 6-4 2-6-3-6 3zM16 6v6" },
];

function motifPath(seed: string) {
  for (const m of MOTIFS) {
    if (m.test.test(seed)) return m.d;
  }
  return "M16 8 L24 22 H8 Z";
}

export function productIconSvg(input: {
  name: string;
  kind: ProjectKind;
  palette: Palette;
  prompt?: string;
}) {
  const seed = `${input.name} ${input.prompt ?? ""} ${input.kind}`;
  const tile = input.palette.fg || "#efe6d4";
  const mark = input.palette.bg || "#16110c";
  const d = motifPath(seed);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${tile}"/><path d="${d}" fill="none" stroke="${mark}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function productIconHref(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function ensureProductIcon(
  html: string,
  input: { name: string; kind: ProjectKind; palette: Palette; prompt?: string },
) {
  const svg = productIconSvg(input);
  const href = productIconHref(svg);
  const hasSvgIcon =
    /rel=["']icon["'][^>]*data:image\/svg/i.test(html) ||
    /data:image\/svg[^"']*rel=["']icon["']/i.test(html);

  let next = html;
  if (!hasSvgIcon) {
    next = next.replace(/<link[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*>/gi, "");
    const iconLinks = `<link rel="icon" type="image/svg+xml" href="${href}"><link rel="apple-touch-icon" href="${href}">`;
    if (/<head[^>]*>/i.test(next)) {
      next = next.replace(/<head[^>]*>/i, (m) => `${m}${iconLinks}`);
    } else if (/<title>/i.test(next)) {
      next = next.replace(/<title>/i, `${iconLinks}<title>`);
    } else {
      next = iconLinks + next;
    }
  } else if (!/apple-touch-icon/i.test(next)) {
    next = next.replace(/<link[^>]*rel=["']icon["'][^>]*>/i, (m) => `${m}<link rel="apple-touch-icon" href="${href}">`);
  }

  const withoutData = next.replace(/data:image\/svg[^"']+/g, "");
  const hasVisibleMark = /viewBox=["']0 0 32 32["']/i.test(withoutData);
  if (!hasVisibleMark && /<h1\b/i.test(next)) {
    const mark = `<span data-product-mark aria-hidden="true" style="display:inline-flex;width:32px;height:32px;flex:none;vertical-align:middle;margin-right:10px">${svg}</span>`;
    next = next.replace(/<h1\b/i, `${mark}<h1`);
  }

  return next;
}
