import { CRAFT_GALLERY_FILES } from "./craft-media.ts";
const HERO_MAX_BYTES = 900_000;

/** Versioned ceramic still-life in /public. Never a page screenshot, never a remote CDN. */
export const CRAFT_HERO_SRC = "/craft-hero.jpg";
export const CRAFT_GALLERY_SRC = CRAFT_GALLERY_FILES.map((file) => `/${file}`);

export const CRAFT_HERO_MARKUP = `<img class="fk-hero fk-hero-craft" src="${CRAFT_HERO_SRC}" alt="Ceramiche in terracotta al tornio" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block;background:#cbb392"/>`;

export function nextCraftGallerySrc(index: number) {
  return CRAFT_GALLERY_SRC[index % CRAFT_GALLERY_SRC.length];
}

const DEAD_UNSPLASH: Array<[RegExp, string]> = [
  [
    /https:\/\/images\.unsplash\.com\/photo-1595878715977-2e8f8df18ea7[^"'\s]*/g,
    CRAFT_GALLERY_SRC[3],
  ],
  [
    /https:\/\/images\.unsplash\.com\/photo-1610701596007-11502861dcfa[^"'\s]*/g,
    CRAFT_GALLERY_SRC[0],
  ],
];

export async function generateHeroUrl(
  _apiKey: string,
  _prompt: string,
  _signal?: AbortSignal,
  _aspect: "16:9" | "1:1" = "16:9",
): Promise<string | null> {
  // Only grok-build-0.1 is authorized. It is not an image-generation endpoint.
  // Keep the caller's existing local/SVG imagery instead of calling another model.
  return null;
}

function isPhoneApp(html: string) {
  return /fk-tab|bottom-tab/i.test(html);
}

export function isHeroSrc(url: string) {
  return (
    /^https:\/\//i.test(url) ||
    /^data:image\/(jpeg|jpg|png|webp|gif|avif)/i.test(url)
  );
}

export function isDataImageSrc(url: string) {
  return /^data:image\//i.test(String(url || "").trim());
}

/** Fetch a remote Imagine/CDN URL into a durable data URL. 404/non-image → null. */
export async function materializeHero(url: string, signal?: AbortSignal): Promise<string | null> {
  const src = String(url || "").trim();
  if (!src) return null;
  if (/^data:image\/(jpeg|jpg|png|webp|gif|avif)/i.test(src)) return src;
  if (!/^https:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { signal, redirect: "follow" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > HERO_MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function placeHeroMarkup(html: string, markup: string) {
  let next = html.replace(/^\s*"\s*\/>/m, "").replace(/>\s*"\s*\/>/g, ">");
  if (/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/i.test(next)) {
    return next.replace(/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/i, markup);
  }
  if (/<img[^>]*fk-hero[^>]*>/i.test(next)) {
    return next.replace(/<img[^>]*fk-hero[^>]*>/i, markup);
  }
  if (/<img\b/i.test(next)) {
    return next.replace(/<img\b[^>]*>/i, markup);
  }
  if (/<main\b[^>]*>/i.test(next)) {
    return next.replace(/<main\b[^>]*>/i, (open) => `${open}${markup}`);
  }
  return next;
}

export function injectCraftHero(html: string) {
  if (!html) return html;
  return placeHeroMarkup(html, CRAFT_HERO_MARKUP);
}

export function injectHero(html: string, url: string, alt = "") {
  if (!html || !url || !isHeroSrc(url) || /["<>]/.test(url)) return html;
  if (isDataImageSrc(url) && !isPhoneApp(html)) return injectCraftHero(html);
  const phone = isPhoneApp(html);
  const label = String(alt || "Oggetto del mestiere").replace(/["<>]/g, "").slice(0, 120);
  const img = phone
    ? `<img class="fk-hero" data-imagery="domain" src="${url}" alt="${label}" width="400" height="400" style="width:100%;height:140px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 12px" onerror="this.removeAttribute('src')"/>`
    : `<img class="fk-hero" data-imagery="domain" src="${url}" alt="${label}" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block" onerror="this.removeAttribute('src')"/>`;
  return placeHeroMarkup(html, img);
}

/** Drop page-screenshot data heroes and stock Unsplash. Distinct local crafts, never six copies of the hero. */
export function scrubCraftMedia(html: string) {
  if (!html) return html;
  let next = html;
  let gallery = 0;
  next = next.replace(/https:\/\/images\.unsplash\.com\/[^"'>\s]+/gi, () => nextCraftGallerySrc(gallery++));
  for (const [re, live] of DEAD_UNSPLASH) next = next.replace(re, live);
  if (isPhoneApp(next)) return next;
  next = next.replace(/<img\b([^>]*class=["'][^"']*fk-hero[^"']*["'][^>]*)>/gi, (tag, attrs: string) => {
    const src = String(attrs).match(/\bsrc=["']([^"']*)["']/i)?.[1] || "";
    if (src === CRAFT_HERO_SRC || /\/craft-hero\.jpg(?:\?|$)/.test(src)) return CRAFT_HERO_MARKUP;
    if (/\bfk-hero-craft\b/.test(tag) || !src || isDataImageSrc(src) || /unsplash\.com/i.test(src)) {
      return CRAFT_HERO_MARKUP;
    }
    return tag;
  });
  next = next.replace(/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/gi, (tag) => {
    if (/\bfk-hero-craft\b/.test(tag) && /<img\b/i.test(CRAFT_HERO_MARKUP)) return CRAFT_HERO_MARKUP;
    return tag;
  });
  gallery = 0;
  next = next.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bfk-hero/.test(tag)) return tag;
    if (!/\/craft-hero\.jpg/.test(tag)) return tag;
    const src = nextCraftGallerySrc(gallery++);
    return tag.replace(/src=(["'])[^"']*\/craft-hero\.jpg[^"']*\1/i, `src=$1${src}$1`);
  });
  return next;
}

export function heroAspect(html: string): "16:9" | "1:1" {
  return isPhoneApp(html) ? "1:1" : "16:9";
}
