import { artifactContext, MAX_ARTIFACT_CHARS } from "./artifact-context.mjs";
import { isComposedVisualArtifact } from "./visual-style.mjs";
import { COMPOSED_PLAN_DEGRADED_LOG } from "./composed-protocol.mjs";

export { COMPOSED_PLAN_DEGRADED_LOG };

export const COMPOSED_CREATE_APPLIED_LOG = "Documento originale dal modello; seed solo fallback";
export const COMPOSED_CREATE_GRAPHIC_APPLIED_LOG = "Passaggio grafico sul documento originale";
export const COMPOSED_CREATE_GRAPHIC_KEPT_LOG = "Passaggio grafico: resta il documento originale";
export const COMPOSED_DESK_CREATE_APPLIED_LOG = "Documento desktop originale dal modello; seed solo fallback";
export const PHONE_VIEWPORT = { width: 390, height: 844 };
export const DESK_VIEWPORT = { width: 1280, height: 800 };
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
Se il brief chiede feed / reel / video verticali / «simile TikTok»: PRIMO PAINT = CLIP a tutto schermo (clip-stage + clip-frame, poster SVG di scena originale, copy, rail Salva/Avanti). Dock: Feed, Crea, Salvati, Profilo. Tap/swipe cambia clip da Fenix.data. Crea salva titolo+città+nota. Nome originale dal mestiere.
Su viewport ≥768: SALA CINEMATOGRAFICA, non un iPhone boxed e non un poster spalmato a 1280. Wallpaper sfocato dal poster, lastre 9:16 ~480px, colonna copy a destra, dock a pillola. Scene dipinte (città, luce, figura), vietati triangoli vuoti.
VIETATO su quel brief: splash «pronto», «Niente in lista», «Aggiungi la prima voce», tab Home/Aggiungi/Elenco, collection voci, 5 tab CRUD, agenda, 4 KPI.
Vietato clonare marchio TikTok/Instagram, logo nota musicale, «For You».
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

export const COMPOSED_SITE_CREATE_SYSTEM = `Studio visivo Fenix. Scrivi tu un SITO WEB desktop originale, non una patch e non un'app telefono.

Il seed TypeScript/magazine è solo fallback di crash. NON copiarlo. Vietato data-fenix-website, data-fenix-craft, data-grammar="magazine", nav.fk-tab, template t-home, 5 tab, colonna 100dvh da tasca.
Identità, layout editoriale, tipografia, illustrazioni SVG e copy nascono dal brief. Ogni mestiere un volto.

JS in <script> classico. window.Fenix.load e window.Fenix.save (coppia obbligatoria) sul form. Mai localStorage. Mai login o server inventati. Il form salva una richiesta, non finge email inviate.

DEFAULT: desktop-first 1280×800, nav in alto, almeno 4 sezioni, footer con via/orari dal brief, hero a tutta larghezza, max-width ~1120px.
Italiano. Testi veri. Niente lorem, Inter, Manrope, emoji, Grok, Fenix.
Palette DAL MESTIERE in :root --bg --surface --fg --muted --accent --line. Mai #f5f5f7+#0071e3. Contrasto AA 4.5:1.
GRAFICA da battere un builder generico: coppia display+testo dal mestiere, materiale firma in CSS+SVG (niente Unsplash), ritmo 8px, lastre piene, CTA ≥44px.
Vietato clonare Corto, Emergent, Apple, Linear, Stripe, Vercel. Niente dashboard Tailwind da SaaS.

Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"site","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<HTML>>>
<!DOCTYPE html> sito desktop completo
<<<END>>>`;

export const COMPOSED_DASH_CREATE_SYSTEM = `Studio visivo Fenix. Scrivi tu un GESTIONALE DESKTOP originale, non una patch e non un'app telefono.

Il seed è solo fallback di crash. NON copiarlo. Vietato nav.fk-tab in basso, template t-home, colonna iPhone, data-fenix-craft-desk da scheletro.
Identità, chrome (header o sidebar), tabella, filtri, form e numeri nascono dal brief.

JS in <script> classico. window.Fenix.load e window.Fenix.save. CRUD su collezioni [A-Za-z0-9._-]{1,80}. Mai localStorage. Mai login inventato.

DEFAULT: desktop 1280×800, almeno 3 viste data-view, tabella o elenco che si riempie, form nuovo, filtri, KPI onesti.
Italiano. Campi e colonne della stessa entità del brief. Niente lorem, Inter, Manrope, emoji, Grok, Fenix.
Palette DAL MESTIERE. Mai #f5f5f7+#0071e3. Contrasto AA 4.5:1. Controlli stilizzati, non nativi nudi.
GRAFICA: tipo in coppia, superfici distinguibili, ritmo 8px, icone silhouette del mestiere. Vietato clonare Corto, Emergent, Apple, Linear, Stripe.

Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"dashboard","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<HTML>>>
<!DOCTYPE html> gestionale desktop completo
<<<END>>>`;

export const COMPOSED_DESK_GRAPHIC_SYSTEM = `Studio visivo Fenix. Vedi uno screenshot DESKTOP 1280×800 del documento originale già scritto da te.

Non è una patch CSS e non è un piano JSON. Non è il seed. Riscrivi il DOCUMENTO COMPLETO per vincere sulla grafica desktop.

Tieni: window.Fenix.load/save, <script> classico valido, italiano, niente localStorage.
Sito: nav in alto, sezioni, footer, hero pieno. Gestionale: header/sidebar, tabella, form, filtri, data-view. Mai tabbar iPhone.
Alza: coppia tipografica dal mestiere, materiale firma CSS+SVG (niente Unsplash), ritmo 8px, contrasto AA, CTA ≥44px, gerarchia editoriale a tutta larghezza.
Vietato: data-fenix-website, data-fenix-craft, Inter, Manrope, SF Pro, emoji, lorem, clonare Corto, Emergent, Apple, Linear, Stripe, Vercel, coppia #f5f5f7+#0071e3.
Se lo screenshot è piatto, boxed al centro, o da dashboard SaaS, rifai i materiali.

Rispondi SOLO:
<<<META>>>
{"name":"","tagline":"","kind":"site","summary":"","palette":{"bg":"#1a1612","surface":"#2a241c","fg":"#e6dcc8","muted":"#9a8f7a","accent":"#c45c26"}}
<<<HTML>>>
<!DOCTYPE html> documento desktop completo
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

/** Website compose seed used as t0 on Mac/PC site create.
 * @param {string} html
 */
export function looksLikeFenixWebsiteSeed(html) {
  const text = String(html || "");
  return /<html\b[^>]*\bdata-fenix-website=/i.test(text) && !isModelCreatedArtifact(text);
}

/** @param {string} html */
export function looksLikePhoneChromeOnDesk(html) {
  return /nav\.fk-tab|class=["'][^"']*\bfk-tab\b|id=["']t-home["']|bottom-tab/i.test(String(html || ""));
}

/** @param {string} kind */
export function deskCreateSystemFor(kind) {
  return String(kind || "").toLowerCase() === "dashboard"
    ? COMPOSED_DASH_CREATE_SYSTEM
    : COMPOSED_SITE_CREATE_SYSTEM;
}

/** @param {string} html */
function deskKindFrom(html) {
  const text = String(html || "");
  if (/<footer\b/i.test(text) && (text.match(/<section\b/gi) || []).length >= 3) return "site";
  return "dashboard";
}

/**
 * @param {string} seed
 * @param {string} created
 * @param {string} [kind]
 */
export function createdDeskDocumentBeatsSeed(seed, created, kind = "site") {
  if (!created || created === seed) return false;
  if (created.length < MIN_CREATED_CHARS || created.length > MAX_ARTIFACT_CHARS) return false;
  if (seed && created.length < Math.floor(String(seed).length * 0.5) && String(seed).length > MIN_CREATED_CHARS) {
    return false;
  }
  if (!/<script\b/i.test(created)) return false;
  if (!hasFenixRuntime(created)) return false;
  if (!createdScriptsAreValid(created)) return false;
  if (CLONE_BAN.test(created)) return false;
  if (looksLikeFenixComposeSeed(created) || looksLikeFenixWebsiteSeed(created)) return false;
  if (looksLikePhoneChromeOnDesk(created)) return false;
  if (/\/\*fenix-slot:/.test(created) && /data-fenix-slot=/.test(created)) return false;
  const deskKind = String(kind || "site").toLowerCase();
  if (deskKind === "dashboard") {
    const views = new Set([...String(created).matchAll(/data-view=["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase()));
    if (views.size < 3) return false;
    if (!/<table\b|<form\b/i.test(created)) return false;
  } else {
    const sections = (created.match(/<section\b/gi) || []).length;
    const views = new Set([...created.matchAll(/data-view=["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase()));
    if (sections < 4 && views.size < 3) return false;
    if (!/<nav\b/i.test(created) || !/<footer\b/i.test(created)) return false;
  }
  return true;
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

/** User iterate must not trigger the create-graphic restyle.
 * Compose direzione / seed-fallback copy is not an iterate.
 * @param {string} [instruction]
 */
export function isUserIterateInstruction(instruction) {
  const text = String(instruction || "").trim();
  if (!text) return false;
  if (/solo fallback|prodotto originale|data-fenix-craft|direzione di mestiere/i.test(text)) return false;
  return /^(aggiungi|cambia|sposta|rimuovi|modifica|togli|metti|alza|abbassa)\b/i.test(text);
}

/**
 * Vertical short-clip feed. Original craft, not a TikTok clone.
 * @param {string} text
 */
export function looksLikeClipFeedBrief(text) {
  const p = String(text || "").toLowerCase();
  return (
    /tik\s*tok|tiktok|douyin/.test(p) ||
    /\breels?\b|\bshorts?\b|\bfyp\b|for\s*you/.test(p) ||
    /video\s*(vertical[ei]?|cort[io]|social|a tutto schermo)/.test(p) ||
    /clip\s*vertical|scroll(?:are)?\s+(?:i\s+)?video|app\s+(?:di\s+)?video/.test(p) ||
    /simile\s+(?:a\s+)?(?:tik|instagram)|tipo\s+(?:tiktok|instagram\s*reel)/.test(p)
  );
}

/**
 * @param {{prompt: string, html: string, instruction?: string, feedback?: string, surface?: string}} input
 */
export function composedGraphicUserContent(input) {
  const desk = input.surface === "desk";
  const feed = !desk && looksLikeClipFeedBrief(`${input.prompt || ""} ${input.instruction || ""}`);
  return [
    `BRIEF:\n${input.prompt}`,
    input.instruction && !isUserIterateInstruction(input.instruction)
      ? `VINCOLI DI MESTIERE:\n${input.instruction}`
      : "",
    `HTML ORIGINALE DA RIFINIRE (tieni JS e dati, alza la grafica):\n${artifactContext(input.html)}`,
    input.feedback || "",
    desk
      ? "Lo screenshot è il desktop 1280×800. Se manca, giudica dall'HTML. Rispondi META+HTML completo."
      : feed
        ? "Lo screenshot è il telefono 390×844. Deve essere UN clip a tutto schermo. Se vedi card/KPI/agenda, rifai. Rispondi META+HTML completo."
        : "Lo screenshot è il telefono 390×844. Se manca, giudica dall'HTML. Rispondi META+HTML completo.",
    feed
      ? "NON clonare TikTok, Instagram, Corto, Emergent, Apple. NON tornare al seed Fenix."
      : "NON clonare Corto, Emergent, Apple. NON tornare al seed Fenix.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {{prompt: string, instruction?: string, feedback?: string, kind?: string}} input
 */
export function composedDeskCreateUserContent(input) {
  const dashboard = String(input.kind || "").toLowerCase() === "dashboard";
  return [
    `BRIEF:\n${input.prompt}`,
    input.instruction
      ? `DIREZIONE (vincoli di mestiere, NON un layout da copiare):\n${input.instruction}`
      : "",
    input.feedback || "",
    dashboard
      ? "Contratto: gestionale desktop, window.Fenix.load/save, almeno 3 data-view, tabella e form, italiano."
      : "Contratto: sito desktop, window.Fenix.load/save sul form, nav in alto, 4 sezioni, footer, italiano.",
    "NON copiare il seed Fenix (data-fenix-website, magazine, craft-desk, tabbar iPhone).",
    "NON clonare Corto, Emergent, Apple. Vinci sulla grafica desktop: materiale firma, tipo in coppia, layout a tutta larghezza.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
export function composedCreateUserContent(input) {
  const feed = looksLikeClipFeedBrief(`${input.prompt || ""} ${input.instruction || ""}`);
  return [
    `BRIEF:\n${input.prompt}`,
    input.instruction
      ? `DIREZIONE (vincoli di mestiere, NON un layout da copiare):\n${input.instruction}`
      : "",
    input.feedback || "",
    feed
      ? "Contratto runtime: window.Fenix.load/save, <script> classico, PRIMO PAINT clip a tutto schermo (clip-stage), dock Feed/Crea/Salvati/Profilo (data-view), italiano, niente lorem. NON agenda, NON 5 tab CRUD, NON «Niente in lista», NON collection voci."
      : "Contratto runtime: window.Fenix.load/save, <script> classico, tab data-view, italiano, niente lorem.",
    "NON copiare CSS/copy/SVG del seed Fenix. NON usare data-fenix-craft, data-grammar, fenix-slot.",
    feed
      ? "NON clonare TikTok, Instagram, Corto, Emergent, Apple. Nome originale. Vinci sulla grafica: clip pieno, overlay, materiale firma. Non card, non 4 KPI."
      : "NON clonare Corto, Emergent, Apple. Il seed TypeScript è solo fallback di parse/sintassi.",
    feed
      ? "Vinci sulla grafica da tasca: un clip 390×844, caption overlay, azioni laterali originali, tipo in coppia."
      : "Vinci sulla grafica da tasca: scena del mestiere, materiale firma, tipo in coppia, icone silhouette. Non 4 KPI. Non dashboard SaaS.",
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

/** @param {string} [reason] */
export function composedGraphicRetryFeedback(reason) {
  return `Il passaggio grafico precedente non è un documento originale valido${reason ? ` (${reason})` : ""}. Riscrivi META+HTML completo. Tieni Fenix.load/save e data-view. Non copiare il seed, non rispondere JSON.`;
}

/**
 * @param {string} current
 * @param {string} text
 * @param {string} [surface]
 * @param {string} [kind]
 * @returns {{html: string, applied: boolean, log: string[]}}
 */
export function applyCreatedGraphicOrKeep(current, text, surface = "desk", kind = "") {
  const created = extractCreatedHtml(text);
  if (!createdDeskDocumentBeatsSeed(current, created, kind || deskKindFrom(created || current))) {
    return { html: current, applied: false, log: [COMPOSED_CREATE_GRAPHIC_KEPT_LOG] };
  }
  return {
    html: markModelCreatedHtml(created),
    applied: true,
    log: [COMPOSED_CREATE_GRAPHIC_APPLIED_LOG],
  };
}

/**
 * @param {string} seed
 * @param {string} text
 * @param {string} [kind]
 * @returns {{html: string, applied: boolean, log: string[]}}
 */
export function applyCreatedDeskDocumentOrSeed(seed, text, kind = "site") {
  const created = extractCreatedHtml(text);
  if (!createdDeskDocumentBeatsSeed(seed, created, kind)) {
    return { html: seed, applied: false, log: [COMPOSED_PLAN_DEGRADED_LOG] };
  }
  return {
    html: markModelCreatedHtml(created),
    applied: true,
    log: [COMPOSED_DESK_CREATE_APPLIED_LOG],
  };
}
