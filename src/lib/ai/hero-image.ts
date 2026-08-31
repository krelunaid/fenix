const XAI_IMAGES = "https://api.x.ai/v1/images/generations";
const HERO_MAX_BYTES = 900_000;

/** Versioned ceramic still-life in /public. Never a page screenshot, never a remote CDN. */
export const CRAFT_HERO_SRC = "/craft-hero.jpg";

export const CRAFT_HERO_MARKUP = `<img class="fk-hero fk-hero-craft" src="${CRAFT_HERO_SRC}" alt="Ceramiche in terracotta al tornio" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block;background:#cbb392"/>`;

const DEAD_UNSPLASH: Array<[RegExp, string]> = [
  [
    /https:\/\/images\.unsplash\.com\/photo-1595878715977-2e8f8df18ea7[^"'\s]*/g,
    CRAFT_HERO_SRC,
  ],
  [
    /https:\/\/images\.unsplash\.com\/photo-1610701596007-11502861dcfa[^"'\s]*/g,
    CRAFT_HERO_SRC,
  ],
];

export async function generateHeroUrl(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
  aspect: "16:9" | "1:1" = "16:9",
) {
  const res = await fetch(XAI_IMAGES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt: `Photorealistic close-up of the craft itself (clay, kiln, tools, hands, vessels). No text, no logo, no watermark, no website, no UI, no screenshot, no browser chrome, no navbar, no form, no page collage. Subject: ${prompt.slice(0, 280)}`,
      aspect_ratio: aspect,
      quality: "low",
      n: 1,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { url?: string }[] };
  const url = json.data?.[0]?.url?.trim();
  return url || null;
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

export function injectHero(html: string, url: string) {
  if (!html || !url || !isHeroSrc(url) || /["<>]/.test(url)) return html;
  if (isDataImageSrc(url) && !isPhoneApp(html)) return injectCraftHero(html);
  const phone = isPhoneApp(html);
  const img = phone
    ? `<img class="fk-hero" src="${url}" alt="" width="400" height="400" style="width:100%;height:140px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 12px" onerror="this.removeAttribute('src')"/>`
    : `<img class="fk-hero" src="${url}" alt="" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block" onerror="this.removeAttribute('src')"/>`;
  return placeHeroMarkup(html, img);
}

/** Drop page-screenshot data heroes and known-dead product photos. Idempotent. */
export function scrubCraftMedia(html: string) {
  if (!html) return html;
  let next = html;
  for (const [re, live] of DEAD_UNSPLASH) next = next.replace(re, live);
  if (isPhoneApp(next)) return next;
  next = next.replace(/<img\b([^>]*class=["'][^"']*fk-hero[^"']*["'][^>]*)>/gi, (tag, attrs: string) => {
    const src = String(attrs).match(/\bsrc=["']([^"']*)["']/i)?.[1] || "";
    if (src === CRAFT_HERO_SRC || /\/craft-hero\.jpg(?:\?|$)/.test(src)) return CRAFT_HERO_MARKUP;
    if (/\bfk-hero-craft\b/.test(tag) || !src || isDataImageSrc(src) || /unsplash\.com\/photo-1610701596007/.test(src)) {
      return CRAFT_HERO_MARKUP;
    }
    return tag;
  });
  next = next.replace(/<svg[^>]*fk-hero[^>]*>[\s\S]*?<\/svg>/gi, (tag) => {
    if (/\bfk-hero-craft\b/.test(tag) && /<img\b/i.test(CRAFT_HERO_MARKUP)) return CRAFT_HERO_MARKUP;
    return tag;
  });
  return next;
}

export function heroAspect(html: string): "16:9" | "1:1" {
  return isPhoneApp(html) ? "1:1" : "16:9";
}
