/** Pittogrammi da bottega. Mai casetta / plus-in-cerchio / omino iPhone. */

const ATTR =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

export type CraftTabIcon = { id: string; label: string; svg: string };

export const CRAFT_TAB_ICONS: CraftTabIcon[] = [
  {
    id: "home",
    label: "Home",
    svg: `<svg ${ATTR}><path d="M6 3.5h11.5v17H6z"/><path d="M9 3.5v17"/><path d="M12 8h4.2M12 12h4.2M12 16h3"/></svg>`,
  },
  {
    id: "new",
    label: "Nuovo",
    svg: `<svg ${ATTR}><path d="M14 3.5 20.5 10 11 19.5H5.5V14z"/><path d="M13 4.5l6.5 6.5"/><path d="M8 13.5l3 3"/></svg>`,
  },
  {
    id: "list",
    label: "Elenco",
    svg: `<svg ${ATTR}><path d="M8 6h12v13H8z"/><path d="M5 4h12"/><path d="M5 4v12"/><path d="M11 10.5h6M11 14h5"/></svg>`,
  },
  {
    id: "stats",
    label: "Numeri",
    svg: `<svg ${ATTR}><path d="M6 5v14M10 5v14M14 5v14M18 5v14"/><path d="M5 9.5l14 5"/></svg>`,
  },
  {
    id: "more",
    label: "Altro",
    svg: `<svg ${ATTR}><rect x="6" y="3.5" width="12" height="10" rx="1.2"/><path d="M9 13.5v4.5M15 13.5v4.5M8 20h8"/></svg>`,
  },
];

export const CRAFT_APP_ICON = `<svg ${ATTR}><path d="M6 3.5h11.5v17H6z"/><path d="M9 3.5v17"/><path d="M12 8h4.2M12 12h4.2"/></svg>`;

const APPLE_TAB_RES = [
  /M4 10\.5[\s,]12 4l8 6\.5V20H4/,
  /M12 8v8M8 12h8/,
  /M5 7h14M5 12h14M5 17h10/,
  /M5 20V10M12 20V4M19 20v-7/,
  /M5 20c1\.5-4[\s,]12\.5-4[\s,]14 0/,
  /<circle[^>]*cy=["']7["'][^>]*r=["']3["']/,
  /<circle[^>]*cx=["']12["'][^>]*cy=["']12["'][^>]*r=["']8["']/,
];

export function isAppleChromeSvg(svg: string): boolean {
  const s = String(svg || "");
  return APPLE_TAB_RES.some((re) => re.test(s));
}

export function countAppleTabIcons(html: string): number {
  const nav = String(html || "").match(
    /<nav[^>]*(?:fk-tab|aria-label)[^>]*>[\s\S]*?<\/nav>/i,
  )?.[0];
  if (!nav) return 0;
  const svgs = nav.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  return svgs.filter((s) => isAppleChromeSvg(s)).length;
}

export function looksLikeAppleTabIcons(html: string): boolean {
  return countAppleTabIcons(html) >= 3;
}

export function replaceAppleTabIcons(html: string): string {
  if (!html || !looksLikeAppleTabIcons(html)) return html;
  let i = 0;
  return html.replace(
    /(<nav[^>]*(?:fk-tab|aria-label)[^>]*>)([\s\S]*?)(<\/nav>)/i,
    (_full, open: string, inner: string, close: string) => {
      const next = inner.replace(/<svg[\s\S]*?<\/svg>/gi, () => {
        const icon = CRAFT_TAB_ICONS[Math.min(i, CRAFT_TAB_ICONS.length - 1)];
        i += 1;
        return icon.svg.replace("<svg", "<svg width='24' height='24'");
      });
      return `${open}${next}${close}`;
    },
  );
}

export function craftTabNavHtml(): string {
  return CRAFT_TAB_ICONS.map((t, i) => {
    const on = i === 0 ? ' class="on"' : "";
    return `<button type="button" data-view="${t.id}"${on}>${t.svg}<span>${t.label}</span></button>`;
  }).join("");
}
