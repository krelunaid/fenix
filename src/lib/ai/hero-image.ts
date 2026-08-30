const XAI_IMAGES = "https://api.x.ai/v1/images/generations";

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
  return /fk-tab|data-view=["']home["']/i.test(html);
}

export function injectHero(html: string, url: string) {
  if (!html || !url || !/^https:\/\//i.test(url)) return html;
  let next = html.replace(/^\s*"\s*\/>/m, "").replace(/>\s*"\s*\/>/g, ">");
  const phone = isPhoneApp(next);
  const img = phone
    ? `<img class="fk-hero" src="${url}" alt="" width="400" height="400" style="width:100%;height:140px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 12px"/>`
    : `<img class="fk-hero" src="${url}" alt="" width="1200" height="675" style="width:100%;height:220px;object-fit:cover;border-radius:18px;display:block;margin:0 0 16px"/>`;
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
