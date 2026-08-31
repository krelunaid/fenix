/** Fingerprint visivo dei prodotti: contrasto, mestiere, niente template SaaS. */

const GENERIC_FONTS = /\b(?:Manrope|Inter|Plus Jakarta(?: Sans)?|Poppins|Nunito(?: Sans)?)\b/i;
const GENERIC_IOS_GRAY = /#f5f5f7/i;
const GENERIC_IOS_BLUE = /#0071e3/i;
const AI_PURPLE = /#7c3aed|#8b5cf6|#a78bfa|#6366f1/i;

export function hexLum(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return 0;
  const to = (s: string) => {
    const n = parseInt(s, 16) / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * to(h.slice(0, 2)) + 0.7152 * to(h.slice(2, 4)) + 0.0722 * to(h.slice(4, 6));
}

export function contrastRatio(a: string, b: string) {
  const l1 = hexLum(a);
  const l2 = hexLum(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function extractCssVars(html: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const block = html.match(/:root\s*\{([^}]+)\}/);
  const body = block?.[1] ?? html.slice(0, 4000);
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    vars[m[1]] = m[2];
  }
  return vars;
}

export type VisualReport = {
  genericFont: boolean;
  genericIosGray: boolean;
  genericIosBlue: boolean;
  aiPurple: boolean;
  contrast: number;
  ok: boolean;
  notes: string[];
};

export function auditCraft(html: string, palette?: { bg: string; fg: string; muted?: string }) {
  const notes: string[] = [];
  const genericFont = GENERIC_FONTS.test(html);
  const genericIosGray = GENERIC_IOS_GRAY.test(html);
  const genericIosBlue = GENERIC_IOS_BLUE.test(html);
  const aiPurple = AI_PURPLE.test(html);
  if (genericFont) notes.push("Font template (Manrope/Inter).");
  if (genericIosGray) notes.push("Grigio iPhone #f5f5f7.");
  if (genericIosBlue && genericIosGray) notes.push("Coppia iOS #f5f5f7 + #0071e3.");
  if (aiPurple) notes.push("Viola AI.");

  const vars = extractCssVars(html);
  const bg = palette?.bg ?? vars.bg ?? vars.ink ?? "";
  const fg = palette?.fg ?? vars.fg ?? vars.ink ?? "";
  const contrast = bg && fg ? contrastRatio(fg, bg) : 0;
  if (contrast && contrast < 4.5) notes.push(`Contrasto fg/bg ${contrast.toFixed(2)} < 4.5.`);

  const muted = palette?.muted ?? vars.muted ?? "";
  if (muted && bg && contrastRatio(muted, bg) < 3) {
    notes.push("Muted sotto AA large-text (3:1).");
  }

  const ok = !genericFont && !aiPurple && !(genericIosGray && genericIosBlue) && contrast >= 4.5;
  return {
    genericFont,
    genericIosGray,
    genericIosBlue,
    aiPurple,
    contrast,
    ok,
    notes,
  } satisfies VisualReport;
}
