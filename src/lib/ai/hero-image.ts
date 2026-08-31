const XAI_IMAGES = "https://api.x.ai/v1/images/generations";
const HERO_MAX_BYTES = 900_000;

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
      prompt: `Photorealistic photo, no text, no logo, no watermark. Subject: ${prompt.slice(0, 280)}`,
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

export function injectHero(html: string, url: string) {
  if (!html || !url || !isHeroSrc(url) || /["<>]/.test(url)) return html;
  let next = html.replace(/^\s*"\s*\/>/m, "").replace(/>\s*"\s*\/>/g, ">");
  const phone = isPhoneApp(next);
  const img = phone
    ? `<img class="fk-hero" src="${url}" alt="" width="400" height="400" style="width:100%;height:140px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 12px" onerror="this.removeAttribute('src')"/>`
    : `<img class="fk-hero" src="${url}" alt="" width="1600" height="900" style="width:100%;height:min(52vh,560px);min-height:280px;object-fit:cover;display:block" onerror="this.removeAttribute('src')"/>`;
  if (/class=["'][^"']*fk-hero/.test(next)) {
    return next.replace(/<img[^>]*fk-hero[^>]*>/i, img);
  }
  if (/<img\b/i.test(next)) {
    return next.replace(/<img\b[^>]*>/i, img);
  }
  if (/<main\b[^>]*>/i.test(next)) {
    return next.replace(/<main\b[^>]*>/i, (open) => `${open}${img}`);
  }
  return next;
}

export function heroAspect(html: string): "16:9" | "1:1" {
  return isPhoneApp(html) ? "1:1" : "16:9";
}
