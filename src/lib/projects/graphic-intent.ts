/**
 * Explicit graphic direction from the brief. Domain recipes stay default
 * when the user does not ask. Clone Apple remains the SET gray+#0071e3+SF Pro.
 */
import type { DesignTokens } from "./design-tokens.ts";
import { extractUserColors } from "./palette-engine.ts";
import { inferKind, kindFromPrompt } from "./infer.ts";
import { applyNativeAppStyle } from "./native-app-style.ts";

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

/** Reference cool sheet. Not applied uniquely: SYSTEM uses the adaptive engine + history. */
export const SYSTEM_COOL_PALETTE = {
  bg: "#eceff3",
  surface: "#ffffff",
  elevated: "#f6f7f9",
  fg: "#1b1f24",
  muted: "#5a6570",
  accent: "#125e57",
  line: "#cfd6de",
  accentInk: "#f3fbf9",
  success: "#2f7d57",
  warning: "#b5812a",
};

const DOMAIN_PALETTE_FAMILIES = new Set([
  "perfume",
  "fashion",
  "booking",
  "hospitality",
  "food",
  "editorial",
  "ops",
  "utility",
  "ceramic",
  "repo",
]);

/**
 * Quality phrasing, including the Italian "stile iPhone". Not the Apple SET
 * (gray+#0071e3+SF Pro) and not a clone of screens or marks.
 */
const SYSTEM_TYPE_RE =
  /system-ui|-apple-system|\b(?:font|caratter[ei]|tipografia)\s+di\s+sistema\b|tipo system\b|iphone-?like|(?:stile|tipo|come(?:\s+(?:un|l['’])?)?|qualit[aà]|da)\s+(?:l['’])?iphone|sans di sistema|ui-sans-serif primario|font system(?:-ui)? primario/i;
const NATIVE_APP_RE = /iphone-?like|(?:stile|tipo|come|design|interfaccia)\s+(?:un\s+|l['’])?(?:apple|iphone|ios)\b/i;
const SERIF_ASK_RE =
  /serif da rivista|serif esplicit|tipo da rivista|didone|serif primario|serif da manifesto|editoriale esplicitamente serif/i;
const NAMED_SERIF_RE =
  /\b(literata|newsreader|fraunces|garamond|cormorant|playfair|source serif(?: 4)?)\b/i;
const SEMANTIC_CHROME_RE =
  /tab(?:s)? home|home aggiungi|aggiungi persona|icone home|home\/aggiungi\/persona/i;
const DENY_WINDOW_RE =
  /(?:non\s+(?:usare|voglio|volere|imporre|clonare|copiare|mettere|applicare)\s+|niente\s+|senza\s+|evita(?:re)?\s+|vietato\s+)([A-Za-zÀ-ÿ0-9][\wÀ-ÿ+#.\-]{0,28}(?:\s+[A-Za-zÀ-ÿ0-9][\wÀ-ÿ+#.\-]{0,16}){0,2})/gi;
/** Contrastive / sentence breaks so a denial does not swallow the next positive clause. */
const CLAUSE_BREAK_RE =
  /(?:[.!?;\n]+|\s*,\s*|\s+(?:ma|però|invece|tuttavia|but|instead|however)\s+)/i;
const TYPED_SEL = String.raw`(?:html|body|h1|h2|h3|\.brand|header)(?:[.#][\w-]+)?`;
const TYPE_FACE_RE = new RegExp(
  String.raw`((?:^|[}>;])\s*${TYPED_SEL}(?:\s*,\s*${TYPED_SEL})*\s*\{[^}]*?)font-family\s*:[^;}]+`,
  "gi",
);
const TYPE_BLOCK_RE = new RegExp(
  String.raw`((?:^|[}>;])\s*${TYPED_SEL}(?:\s*,\s*${TYPED_SEL})*\s*\{)([^}]*)(?=\})`,
  "gi",
);

function splitClauses(text: string): string[] {
  return String(text || "")
    .split(CLAUSE_BREAK_RE)
    .map((part) => part.trim())
    .filter(Boolean);
}

function withoutDenied(text: string): string {
  return splitClauses(text)
    .map((clause) => {
      const re = new RegExp(DENY_WINDOW_RE.source, "gi");
      return clause.replace(re, " ").trim();
    })
    .filter(Boolean)
    .join(" ");
}

export function graphicIntentFromBrief(brief: string): GraphicIntent {
  const raw = String(brief || "");
  const p = withoutDenied(raw);
  const system = SYSTEM_TYPE_RE.test(p) || NATIVE_APP_RE.test(p);
  const named = p.match(NAMED_SERIF_RE)?.[1] || null;
  const serifAsk = SERIF_ASK_RE.test(p) || Boolean(named);
  const semantic = SEMANTIC_CHROME_RE.test(p);
  const chrome: GraphicIntentChrome = semantic ? "semantic" : "domain";
  if (system && serifAsk) {
    // Compare the phrases actually recognized, including Italian synonyms and
    // all named serif faces; English keyword offsets miss "di sistema".
    const lastMatch = (pattern: RegExp) => Math.max(-1, ...Array.from(p.matchAll(new RegExp(pattern.source, "gi")), match => match.index));
    const si = Math.max(lastMatch(SYSTEM_TYPE_RE), lastMatch(NATIVE_APP_RE));
    const ri = Math.max(lastMatch(SERIF_ASK_RE), lastMatch(NAMED_SERIF_RE));
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

/** Head-only structure layer. Never a domain palette and never a shop-name synonym. */
export function wantsNativeAppStyle(brief: string): boolean {
  return (kindFromPrompt(brief) ?? inferKind(brief)) === "app" && NATIVE_APP_RE.test(withoutDenied(brief));
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
    const keepPalette = DOMAIN_PALETTE_FAMILIES.has(tokens.family);
    const user = extractUserColors(brief);
    const userColor = Boolean(user.bg || user.accent);
    return {
      ...tokens,
      fonts: { display: "system-ui", body: "system-ui", href: "" },
      radius: keepPalette || userColor ? tokens.radius : "12px",
    };
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

function fontShorthandTokens(value: string): string[] {
  const out: string[] = [];
  let i = 0;
  const s = String(value || "");
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i += 1;
    if (i >= s.length) break;
    const ch = s[i]!;
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < s.length && s[j] !== ch) j += 1;
      out.push(s.slice(i, Math.min(j + 1, s.length)));
      i = j + 1;
      continue;
    }
    if (/^calc\(/i.test(s.slice(i))) {
      let depth = 0;
      let j = i;
      while (j < s.length) {
        if (s[j] === "(") depth += 1;
        else if (s[j] === ")") {
          depth -= 1;
          j += 1;
          if (depth === 0) break;
          continue;
        }
        j += 1;
      }
      out.push(s.slice(i, j));
      i = j;
      continue;
    }
    let j = i;
    while (j < s.length && !/\s/.test(s[j]!)) j += 1;
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

function isFontSizeToken(tok: string): boolean {
  const head = String(tok || "").split("/")[0] || "";
  if (/^(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i.test(head)) {
    return true;
  }
  if (/^calc\(/i.test(head)) return true;
  return /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm|q|%)$/i.test(head);
}

function rewriteFontShorthand(decl: string, stack: string): string {
  if (/var\(--(?:body|display)\b/.test(decl)) return decl;
  const important = /!important/i.test(decl);
  const bang = important ? " !important" : "";
  const raw = decl.replace(/!important/gi, "").trim().replace(/;+$/, "");
  const m = raw.match(/^(font\s*:\s*)(.+)$/i);
  if (!m) return decl;
  const value = m[2].trim();
  if (/^(inherit|initial|unset|revert|caption|icon|menu|message-box|small-caption|status-bar)(\s|$)/i.test(value)) {
    return decl;
  }
  if (/^var\(/i.test(value)) return decl;
  const tokens = fontShorthandTokens(value);
  let sizeAt = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    if (isFontSizeToken(tokens[i]!)) {
      sizeAt = i;
      break;
    }
  }
  if (sizeAt < 0) {
    return `font:${value}${bang};font-family:${stack}${bang}`;
  }
  let familyAt = sizeAt + 1;
  const sizeTok = tokens[sizeAt]!;
  if (sizeTok.endsWith("/")) {
    if (tokens[familyAt]) familyAt += 1;
  } else if (!sizeTok.includes("/")) {
    const next = tokens[familyAt];
    if (next === "/") {
      familyAt += 1;
      if (tokens[familyAt]) familyAt += 1;
    } else if (next && next.startsWith("/")) {
      familyAt += 1;
    }
  }
  const prefix = tokens.slice(0, familyAt).join(" ").trim();
  const family = tokens.slice(familyAt).join(" ").trim();
  if (!family || /^(inherit|initial|unset|revert|var\()/i.test(family)) return decl;
  return `font:${prefix} ${stack}${bang}`;
}

function applyFaceToTypedSelectors(html: string, stack: string): string {
  let next = html.replace(TYPE_BLOCK_RE, (_all, prefix: string, body: string) => {
    let block = body.replace(/font-family\s*:[^;}]+/gi, (decl: string) => {
      if (/var\(--(?:body|display)\b/.test(decl)) return decl;
      return `font-family:${stack}`;
    });
    block = block.replace(/font\s*:[^;}]+/gi, (decl: string) => rewriteFontShorthand(decl, stack));
    return `${prefix}${block}`;
  });
  next = next.replace(TYPE_FACE_RE, (all, prefix: string) => {
    const decl = all.slice(String(prefix).length);
    if (/var\(--(?:body|display)\b/.test(decl)) return all;
    return `${prefix}font-family:${stack}`;
  });
  return next;
}

function ensureRootFontVars(html: string, display: string, body: string): string {
  const hasDisplay = /--display\s*:/.test(html);
  const hasBody = /--body\s*:/.test(html);
  if (hasDisplay && hasBody) return html;
  const inject = `${hasDisplay ? "" : `--display:${display};`}${hasBody ? "" : `--body:${body};`}`;
  if (/:root\s*\{/.test(html)) {
    return html.replace(/:root\s*\{/, (open) => `${open}${inject}`);
  }
  const block = `:root{${inject}}`;
  if (/<style\b/i.test(html)) {
    return html.replace(/<style\b[^>]*>/i, (open) => `${open}${block}`);
  }
  if (/<head\b/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (open) => `${open}<style>${block}</style>`);
  }
  return `<style>${block}</style>${html}`;
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
    next = applyFaceToTypedSelectors(next, SYSTEM_FONT_STACK);
    next = ensureRootFontVars(next, SYSTEM_FONT_STACK, SYSTEM_FONT_STACK);
  } else if (intent.type === "serif") {
    const face = intent.face || "Literata";
    const stack = serifStack(face);
    next = next.replace(/--display\s*:[^;}]+/g, `--display:${stack}`);
    next = next.replace(/--body\s*:[^;}]+/g, `--body:${stack}`);
    next = next.replace(
      /(html\s*,\s*body\s*\{[^}]*?)font-family\s*:[^;}]+/gi,
      `$1font-family:var(--body, ${stack})`,
    );
    next = applyFaceToTypedSelectors(next, stack);
    next = ensureRootFontVars(next, stack, stack);
    const href = serifHref(face);
    if (!next.includes(href)) {
      next = next.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
      if (/<head\b/i.test(next)) {
        next = next.replace(/<head\b[^>]*>/i, (open) => `${open}\n<link href="${href}" rel="stylesheet"/>`);
      }
    }
  }
  return applyNativeAppStyle(next, wantsNativeAppStyle(brief));
}

export function preservesSemanticChrome(html: string): boolean {
  return /data-intent-chrome="semantic"/.test(String(html || ""));
}

export const INTENT_SYSTEM_PROMPT =
  "Lista in tasca: cose da fare operative, tipo system-ui iPhone-like, font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD. Non clonare marchi o schermate Apple.";

export const INTENT_SERIF_PROMPT =
  "Atelier Carta: portfolio editoriale, rivista di lastre fotografiche, serif da rivista Literata e rassegna di studio.";

/** Exact Italian quality phrasing from the user. Not Apple-clone SET. */
export const INTENT_IPHONE_IT_PROMPT = "Voglio una app stile iPhone";
