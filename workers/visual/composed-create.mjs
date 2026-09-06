import { MAX_ARTIFACT_CHARS } from "./artifact-context.mjs";
import { isComposedVisualArtifact } from "./visual-style.mjs";
import { COMPOSED_PLAN_DEGRADED_LOG } from "./composed-protocol.mjs";

export { COMPOSED_PLAN_DEGRADED_LOG };

export const COMPOSED_CREATE_APPLIED_LOG = "Documento originale dal modello; seed solo fallback";
export const COMPOSED_CREATE_RETRY = 1;
export const MIN_CREATED_CHARS = 2500;
export const MODEL_CREATE_ATTR = "data-fenix-model-create";

const CLONE_BAN =
  /gentleman barber|il dettaglio fa la differenza|taglio\s*&\s*stile|unsplash\.com|images\.unsplash|emergent\.sh|sf pro|san francisco text/i;

export const COMPOSED_CREATE_SYSTEM = `Studio visivo Fenix. Scrivi tu il prodotto: un documento HTML originale, non una patch.

Il seed TypeScript è solo fallback di crash. NON copiarlo. Vietato data-fenix-craft, data-grammar, data-fenix-slot, /*fenix-slot, #root da composizione, lookbook-*, fk-stat da scheletro, splash Fenix.
Identità, layout, tipografia, icone SVG e copy nascono dal brief. Ogni mestiere un look diverso.

JS in <script> classico. Mai \${espressione} nel markup. Dati: window.Fenix.load e window.Fenix.save (coppia obbligatoria). CRUD: window.Fenix.data.query/insert/update/remove con collection [A-Za-z0-9._-]{1,80}. Mai localStorage. Mai login o server inventati.

DEFAULT: app telefono 390×844, colonna 100dvh, 4–5 tab in basso con data-view, SVG 24 originali diverse, form che salvano, liste oneste, empty solo se length===0.
Italiano. Testi veri (città, prezzi, orari, nomi dal brief). Niente lorem, "Welcome to your app", Ciao/Operatore, Grok, Fenix, Inter, Manrope, emoji.
Palette DAL MESTIERE in :root --bg --surface --fg --muted --accent --line. Mai la coppia clone #f5f5f7+#0071e3. Contrasto AA 4.5:1.
Qualità nativa da tasca: tipo, ritmo 8px, materiali, motion ridotto. Vietato clonare Corto, Emergent, Apple, SF Symbols, Unsplash hotlink.
rel=icon SVG originale. CTA visibile. Target ≥44px. prefers-reduced-motion.

Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"app","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<HTML>>>
<!DOCTYPE html> documento completo originale
<<<END>>>`;

/** @param {string} html */
export function isModelCreatedArtifact(html) {
  return new RegExp(`<html\\b[^>]*\\b${MODEL_CREATE_ATTR}=["']1["']`, "i").test(String(html || ""));
}

/** Seed chrome the model must not ship as the product.
 * @param {string} html
 */
export function looksLikeFenixComposeSeed(html) {
  return isComposedVisualArtifact(html) && !isModelCreatedArtifact(html);
}

/** @param {string} html */
export function markModelCreatedHtml(html) {
  const source = String(html || "");
  if (!source || isModelCreatedArtifact(source)) return source;
  return source.replace(/<html\b([^>]*)>/i, (full, attrs) => {
    if (new RegExp(`\\b${MODEL_CREATE_ATTR}=`, "i").test(attrs)) return full;
    return `<html${attrs} ${MODEL_CREATE_ATTR}="1">`;
  });
}

/** @param {string} html */
export function hasFenixRuntime(html) {
  const text = String(html || "");
  return /\bFenix\.load\b/.test(text) && /\bFenix\.save\b/.test(text);
}

/** @param {string} html */
export function createdScriptsAreValid(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html || "")))) {
    const attrs = match[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']?(module|application\/json|importmap)/i.test(attrs)) continue;
    const body = String(match[2] || "").trim();
    if (!body) continue;
    try {
      new Function(body);
    } catch {
      return false;
    }
  }
  if (/\$\{/.test(String(html || "").replace(/<script\b[\s\S]*?<\/script>/gi, " "))) return false;
  return true;
}

/** @param {string} text */
export function extractCreatedHtml(text) {
  const source = String(text || "");
  const htmlMatch = source.match(/<!DOCTYPE html[\s\S]*?<\/html>/i) || source.match(/<html[\s\S]*?<\/html>/i);
  if (!htmlMatch) return "";
  const html = htmlMatch[0].startsWith("<!DOCTYPE") ? htmlMatch[0] : `<!DOCTYPE html>\n${htmlMatch[0]}`;
  return html.length >= 80 ? html : "";
}

/**
 * @param {string} seed
 * @param {string} created
 */
export function createdDocumentBeatsSeed(seed, created) {
  if (!created || created === seed) return false;
  if (created.length < MIN_CREATED_CHARS || created.length > MAX_ARTIFACT_CHARS) return false;
  if (!/<script\b/i.test(created)) return false;
  if (!hasFenixRuntime(created)) return false;
  if (!/data-view\s*=/i.test(created)) return false;
  if (looksLikeFenixComposeSeed(created)) return false;
  if (/\/\*fenix-slot:/.test(created) && /data-fenix-slot=/.test(created)) return false;
  if (CLONE_BAN.test(created)) return false;
  if (!createdScriptsAreValid(created)) return false;
  return true;
}

/**
 * @param {{prompt: string, instruction?: string, feedback?: string}} input
 */
export function composedCreateUserContent(input) {
  return [
    `BRIEF:\n${input.prompt}`,
    input.instruction
      ? `DIREZIONE (vincoli di mestiere, NON un layout da copiare):\n${input.instruction}`
      : "",
    input.feedback || "",
    "Contratto runtime: window.Fenix.load/save, <script> classico, tab data-view, italiano, niente lorem.",
    "NON copiare CSS/copy/SVG del seed Fenix. NON usare data-fenix-craft, data-grammar, fenix-slot.",
    "NON clonare Corto, Emergent, Apple. Il seed TypeScript è solo fallback di parse/sintassi.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** @param {string} [reason] */
export function composedCreateRetryFeedback(reason) {
  return `Il documento precedente non è un'app originale valida${reason ? ` (${reason})` : ""}. Riscrivi META+HTML completo dal brief. Non copiare il seed, non rispondere JSON, non restituire un piano find/replace.`;
}

/**
 * @param {string} seed
 * @param {string} text
 * @returns {{html: string, applied: boolean, log: string[]}}
 */
export function applyCreatedDocumentOrSeed(seed, text) {
  const created = extractCreatedHtml(text);
  if (!createdDocumentBeatsSeed(seed, created)) {
    return { html: seed, applied: false, log: [COMPOSED_PLAN_DEGRADED_LOG] };
  }
  return {
    html: markModelCreatedHtml(created),
    applied: true,
    log: [COMPOSED_CREATE_APPLIED_LOG],
  };
}
