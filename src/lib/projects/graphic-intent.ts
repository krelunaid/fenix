/**
 * Explicit graphic direction from the brief. Domain recipes stay default
 * when the user does not ask. Clone Apple remains the SET gray+#0071e3+SF Pro.
 */
import type { DesignTokens } from "./design-tokens.ts";

export type GraphicIntentType = "system" | "serif" | "domain";
export type GraphicIntentChrome = "semantic" | "domain";

export type GraphicIntent = {
  type: GraphicIntentType;
  chrome: GraphicIntentChrome;
  face: string | null;
};

/** Parent SHA of the intent-preservation before/after. Not a quality score. */
export const GRAPHIC_INTENT_PARENT_SHA = "76414c75ce4dc1b2f66343fc0ed1160be0c1b45b";

export const SYSTEM_FONT_STACK =
  'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

const SYSTEM_TYPE_RE =
  /system-ui|-apple-system|font di sistema|tipo system\b|iphone-?like|sans di sistema|ui-sans-serif primario|font di sistema primario/i;
const SERIF_ASK_RE =
  /serif da rivista|serif esplicit|tipo da rivista|didone|serif primario|serif da manifesto/i;
const NAMED_SERIF_RE =
  /\b(literata|newsreader|fraunces|garamond|cormorant|playfair|source serif(?: 4)?)\b/i;
const SEMANTIC_CHROME_RE =
  /tab(?:s)? home|home aggiungi|aggiungi persona|icone home|home\/aggiungi\/persona/i;

export function graphicIntentFromBrief(brief: string): GraphicIntent {
  const p = String(brief || "");
  const system = SYSTEM_TYPE_RE.test(p);
  const named = p.match(NAMED_SERIF_RE)?.[1] || null;
  const serifAsk = SERIF_ASK_RE.test(p) || Boolean(named);
  const semantic = SEMANTIC_CHROME_RE.test(p);
  const chrome: GraphicIntentChrome = semantic ? "semantic" : "domain";
  if (system && serifAsk) {
    const lower = p.toLowerCase();
    const si = Math.max(lower.lastIndexOf("system"), lower.lastIndexOf("iphone"));
    const ri = Math.max(lower.lastIndexOf("serif"), lower.lastIndexOf("literata"));
    if (si > ri) return { type: "system", chrome, face: null };
  } else if (system) {
    return { type: "system", chrome, face: null };
  }
  if (serifAsk) {
    return {
      type: "serif",
      chrome,
      face: titledSerif(named || "Literata"),
    };
  }
  return { type: "domain", chrome, face: null };
}

function titledSerif(raw: string): string {
  const s = String(raw || "Literata").trim();
  if (/source\s*serif/i.test(s)) return "Source Serif 4";
  if (/cormorant/i.test(s)) return "Cormorant Garamond";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function serifHref(face: string): string {
  if (/newsreader/i.test(face)) {
    return "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,700&display=swap";
  }
  if (/fraunces/i.test(face)) {
    return "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap";
  }
  if (/cormorant/i.test(face)) {
    return "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600;1,700&display=swap";
  }
  if (/playfair/i.test(face)) {
    return "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&display=swap";
  }
  if (/source serif/i.test(face)) {
    return "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap";
  }
  return "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500;7..72,700&display=swap";
}

function serifStack(face: string): string {
  return `"${face}",ui-serif,Georgia,"Times New Roman",serif`;
}

export function applyGraphicIntent(tokens: DesignTokens, brief: string): DesignTokens {
  const intent = graphicIntentFromBrief(brief);
  if (intent.type === "system") {
    return { ...tokens, fonts: { display: "system-ui", body: "system-ui", href: "" } };
  }
  if (intent.type === "serif") {
    const face = intent.face || "Literata";
    return { ...tokens, fonts: { display: face, body: face, href: serifHref(face) } };
  }
  return tokens;
}

function setHtmlDataAttr(attrs: string, name: string, value: string): string {
  const re = new RegExp(`${name}="[^"]*"`);
  if (re.test(attrs)) return attrs.replace(re, `${name}="${value}"`);
  return `${attrs} ${name}="${value}"`;
}

export function stampGraphicIntent(html: string, brief: string): string {
  const text = String(html || "");
  if (!text || !/<html\b/i.test(text)) return text;
  const intent = graphicIntentFromBrief(brief);
  return text.replace(/<html\b([^>]*)>/i, (_all, attrs: string) => {
    let next = setHtmlDataAttr(attrs || "", "data-intent-type", intent.type);
    next = setHtmlDataAttr(next, "data-intent-chrome", intent.chrome);
    return `<html${next}>`;
  });
}

/** After planner/generate/repair, restore explicit type so prepareSrcDoc cannot drop it. */
export function enforceGraphicIntent(html: string, brief: string): string {
  let next = stampGraphicIntent(html, brief);
  const intent = graphicIntentFromBrief(brief);
  if (intent.type === "system") {
    next = next.replace(/--display\s*:[^;}]+/g, `--display:${SYSTEM_FONT_STACK}`);
    next = next.replace(/--body\s*:[^;}]+/g, `--body:${SYSTEM_FONT_STACK}`);
    next = next.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
    next = next.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, "");
    next = next.replace(
      /(html\s*,\s*body\s*\{[^}]*?)font-family\s*:[^;}]+/gi,
      `$1font-family:var(--body, ${SYSTEM_FONT_STACK})`,
    );
  } else if (intent.type === "serif") {
    const face = intent.face || "Literata";
    const stack = serifStack(face);
    next = next.replace(/--display\s*:[^;}]+/g, `--display:${stack}`);
    next = next.replace(/--body\s*:[^;}]+/g, `--body:${stack}`);
    const href = serifHref(face);
    if (!next.includes(href)) {
      next = next.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
      if (/<head\b/i.test(next)) {
        next = next.replace(/<head\b[^>]*>/i, (open) => `${open}\n<link href="${href}" rel="stylesheet"/>`);
      }
    }
  }
  return next;
}

export function preservesSemanticChrome(html: string): boolean {
  return /data-intent-chrome="semantic"/.test(String(html || ""));
}

export const INTENT_SYSTEM_PROMPT =
  "Lista in tasca: cose da fare operative, tipo system-ui iPhone-like, font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD. Non clonare marchi o schermate Apple.";

export const INTENT_SERIF_PROMPT =
  "Atelier Carta: portfolio editoriale, rivista di lastre fotografiche, serif da rivista Literata e rassegna di studio.";
