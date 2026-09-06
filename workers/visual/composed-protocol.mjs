import { artifactContext, MAX_ARTIFACT_CHARS } from "./artifact-context.mjs";
import { isComposedVisualArtifact } from "./visual-style.mjs";

/** @param {string} html */
export async function composedBaseShaWeb(html) {
  artifactContext(html);
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Web Crypto entrypoint for Edge/browser runtimes; never trust a model-supplied digest.
 * @param {string} html @param {unknown} plan
 */
export async function applyComposedBuildPlanWeb(html, plan) {
  return applyComposedBuildPlanForDigest(html, plan, await composedBaseShaWeb(html));
}

/** Preserve composition metadata through parseBuildOutput/prepareSrcDoc.
 * Only literal hex colors can enter the response metadata.
 * @param {unknown} input
 */
export function composedBuildPalette(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Palette della composizione mancante");
  const colors = /** @type {Record<string, unknown>} */ (input);
  const palette = /** @type {Record<string,string>} */ ({});
  for (const key of ["bg", "surface", "fg", "muted", "accent"]) {
    const color = colors[key];
    if (typeof color !== "string" || !/^#[a-f0-9]{6}$/i.test(color)) throw new Error("Palette della composizione non valida");
    palette[key] = color;
  }
  return palette;
}

/** Verbatim finds that exist once in every composed seed after slot stamping. */
export const COMPOSED_BUILD_FIND_EXAMPLES = [
  "/*fenix-slot:save*/function save(){",
  "/*fenix-slot:form*/function renderForm(){",
  "/*fenix-slot:render*/function render(){",
];

export const COMPOSED_BUILD_SYSTEM = `Completa le funzionalità richieste dal brief sull'app Fenix già composta.
Non restituire un documento HTML intero. Preserva head e token grafici, ma la bozza NON è il prodotto richiesto.
Adatta nome visibile, schermate, navigazione e icone al BRIEF. Una bozza Note non soddisfa una richiesta di videogiochi. Non limitarti a rifinire un prodotto diverso.
Puoi aggiungere HTML nel body e modificare funzioni JavaScript per realizzare il comportamento richiesto: NON limitarti a cambiare colori o testi se mancano funzioni.
Usa le classi esistenti, le API Fenix.load/save o Fenix.data e le viste già presenti. Nessuna credenziale, import esterno o seconda app.
Il body ha ancore uniche /*fenix-slot:NOME*/ e data-fenix-slot="NOME". Prefissa ogni find con un'ancora copiata verbatim. Modifica le funzioni JS (save, render, form, home) e le definizioni di navigazione/icone per il dominio richiesto, non solo il markup statico in #root: al boot viene sostituito da render().
Non usare come find frammenti SVG (path, d=, gradient, botte, marca splash/header): sono ripetuti e restano invariati.
Esempi validi, unici nel body, da copiare così come sono:
{"find":"${COMPOSED_BUILD_FIND_EXAMPLES[0]}","replace":"${COMPOSED_BUILD_FIND_EXAMPLES[0]} /* hook brief */"}
{"find":"${COMPOSED_BUILD_FIND_EXAMPLES[1]}","replace":"${COMPOSED_BUILD_FIND_EXAMPLES[1]} /* campi brief */"}
{"find":"${COMPOSED_BUILD_FIND_EXAMPLES[2]}","replace":"${COMPOSED_BUILD_FIND_EXAMPLES[2]} /* vista brief */"}
Rispondi SOLO JSON: {"version":1,"baseSha256":"SHA fornito","changes":[{"find":"testo esatto unico nel body originale","replace":"nuovo testo"}]}.
Da 1 a 12 cambiamenti disgiunti sul documento ORIGINALE; find 12–12000 caratteri, replace massimo 24000. Nessuna sostituzione del body intero o del root. Mantieni la navigazione funzionante e realizza le schermate richieste.
Non aggiungere style/link: la direzione grafica è già definita. Mantieni logica, dati e schermate non interessati. Output atomico: niente markdown o META/HTML.`;

export const COMPOSED_PLAN_APPLY_RETRIES = 2;
export const COMPOSED_PLAN_DEGRADED_LOG = "Piano di creazione non applicato; seed composto invariato";

const RETRYABLE_COMPOSED_PLAN = /JSON non valido|Piano di creazione non valido|Target di creazione assente|Target di creazione ambiguo|Target di creazione fuori dal body|ambiguo o fuori dal body|Modifica di creazione non valida|Modifiche di creazione sovrapposte/;
const FENIX_SLOT_RE = /data-fenix-slot="[a-z0-9-]+"|\/\*fenix-slot:[a-z0-9-]+\*\//g;

/** @param {unknown} error */
export function composedPlanError(error) {
  if (error instanceof SyntaxError) return new Error("Piano di creazione JSON non valido");
  if (error instanceof Error) return error;
  return new Error(String(error));
}

/** @param {unknown} error */
export function isRetryableComposedPlanError(error) {
  return composedPlanError(error).name === "IncompleteModelResponse"
    || RETRYABLE_COMPOSED_PLAN.test(composedPlanError(error).message);
}

/** @param {string} html */
export function composedBodyBounds(html) {
  const bodyOpen = /<body\b[^>]*>/i.exec(html);
  const start = bodyOpen ? bodyOpen.index + bodyOpen[0].length : -1;
  const end = String(html || "").toLowerCase().lastIndexOf("</body>");
  if (start < 0 || end < start) return null;
  return { start, end };
}

/** Unique slot tokens already present in the original body.
 * @param {string} html
 */
export function composedSeedAnchors(html) {
  const bounds = composedBodyBounds(html);
  if (!bounds) return [];
  const body = html.slice(bounds.start, bounds.end);
  const seen = new Set();
  const anchors = [];
  const re = new RegExp(FENIX_SLOT_RE.source, "g");
  let match;
  while ((match = re.exec(body))) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);
    if (html.indexOf(token) !== html.lastIndexOf(token)) continue;
    anchors.push(token);
  }
  return anchors;
}

/** @param {string} html @param {string} find */
export function composedFindStatus(html, find) {
  const bounds = composedBodyBounds(html);
  if (!bounds || typeof find !== "string" || find.length < 12) {
    return { usable: false, reason: "invalid", count: 0 };
  }
  const first = html.indexOf(find);
  if (first === -1) return { usable: false, reason: "assente", count: 0 };
  let count = 1;
  let at = first;
  while ((at = html.indexOf(find, at + 1)) !== -1) count++;
  if (count > 1) return { usable: false, reason: "ambiguo", count };
  if (first < bounds.start || first + find.length > bounds.end) {
    return { usable: false, reason: "fuori", count: 1 };
  }
  return { usable: true, reason: "ok", count: 1 };
}

/** @param {string} find */
function quoteFind(find) {
  const compact = String(find).replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 72)}…` : compact;
}

/** @param {string} html @param {string} find @param {{start: number, end: number}} bounds */
function locateUniqueBodyFind(html, find, bounds) {
  const first = html.indexOf(find);
  if (first === -1) {
    throw new Error(`Target di creazione assente: «${quoteFind(find)}» non compare nel documento`);
  }
  let count = 1;
  let at = first;
  while ((at = html.indexOf(find, at + 1)) !== -1) count++;
  if (count > 1) {
    throw new Error(`Target di creazione ambiguo: «${quoteFind(find)}» compare ${count} volte; usa un'ancora /*fenix-slot: o data-fenix-slot`);
  }
  if (first < bounds.start || first + find.length > bounds.end) {
    throw new Error(`Target di creazione fuori dal body: «${quoteFind(find)}»`);
  }
  return { start: first, end: first + find.length };
}

/** @param {unknown} error @param {string} [html] */
export function composedPlanRetryFeedback(error, html) {
  const anchors = html ? composedSeedAnchors(html).slice(0, 16) : [];
  const anchorBlock = anchors.length
    ? `\nAncore uniche (prefissa ogni find con una di queste, copiate verbatim):\n${anchors.join("\n")}`
    : "";
  return `ERRORE SUL PIANO PRECEDENTE:\n${composedPlanError(error).message}\nCopia i find come sottostringhe verbatim dall'HTML ORIGINALE. Ogni find deve essere unico nel body. Non usare path SVG, attributi d= o markup della botte/icona come find. Preferisci /*fenix-slot: o data-fenix-slot. Non sostituire head, style o link. Non cambiare BASE_SHA256. Rispondi SOLO JSON.${anchorBlock}`;
}

/**
 * @param {{prompt: string, instruction?: string, html: string, digest: string, feedback?: string}} input
 */
export function composedBuildUserContent(input) {
  const anchors = composedSeedAnchors(input.html);
  return [
    `BRIEF:\n${input.prompt}`,
    `DIREZIONE:\n${input.instruction || ""}`,
    input.feedback || "",
    anchors.length ? `ANCORE UNICHE:\n${anchors.join("\n")}` : "",
    `BASE_SHA256:${input.digest}`,
    `HTML ORIGINALE:\n${artifactContext(input.html)}`,
  ].filter(Boolean).join("\n");
}

/** @param {string} text */
export function parseComposedBuildPlan(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw composedPlanError(error);
  }
}

/**
 * Parse+apply against the original html. Retryable plan errors call retryPlan
 * at most COMPOSED_PLAN_APPLY_RETRIES times with the same seed. Exhausted
 * retries return the seed unchanged — never a full rewrite.
 * @param {string} html
 * @param {(plan: unknown) => string | Promise<string>} applyPlan
 * @param {string | (() => Promise<string>)} text
 * @param {(feedback: string) => Promise<string>} [retryPlan]
 * @returns {Promise<{html: string, applied: boolean, attempts: number, log: string[], error?: Error}>}
 */
export async function applyComposedBuildPlanOrSeed(html, applyPlan, text, retryPlan) {
  let lastError;
  let current = "";
  let attempts = 0;
  for (let attempt = 0; attempt <= COMPOSED_PLAN_APPLY_RETRIES; attempt++) {
    attempts = attempt + 1;
    try {
      current = attempt === 0
        ? (typeof text === "function" ? await text() : text)
        : await retryPlan?.(composedPlanRetryFeedback(lastError, html)) || "";
      const result = await applyPlan(parseComposedBuildPlan(current));
      return { html: result, applied: true, attempts, log: [] };
    } catch (error) {
      lastError = composedPlanError(error);
      if (attempt === COMPOSED_PLAN_APPLY_RETRIES || !retryPlan || !isRetryableComposedPlanError(lastError)) {
        break;
      }
    }
  }
  return {
    html,
    applied: false,
    attempts,
    log: [COMPOSED_PLAN_DEGRADED_LOG],
    error: lastError,
  };
}

/** Atomic, hash-bound literal edits. Not a functional/visual success gate.
 * Internal shared validator: digest must be computed from html by the runtime wrapper.
 * @param {string} html @param {unknown} plan @param {string} digest
 */
export function applyComposedBuildPlanForDigest(html, plan, digest) {
  artifactContext(html);
  if (!isComposedVisualArtifact(html)) throw new Error("Composizione iniziale non supportata");
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("Piano di creazione non valido o riferito a un'altra versione");
  }
  const value = /** @type {Record<string, unknown>} */ (plan);
  if (!/^[a-f0-9]{64}$/.test(digest)
    || Object.keys(value).some(key => !["version", "baseSha256", "changes"].includes(key))
    || value.version !== 1 || value.baseSha256 !== digest
    || !Array.isArray(value.changes) || value.changes.length < 1 || value.changes.length > 12) {
    throw new Error("Piano di creazione non valido o riferito a un'altra versione");
  }
  const bounds = composedBodyBounds(html);
  if (!bounds) throw new Error("Body della composizione non valido");
  const edits = value.changes.map(change => {
    if (!change || typeof change !== "object" || Array.isArray(change)
      || Object.keys(change).some(key => !["find", "replace"].includes(key))
      || typeof change.find !== "string" || typeof change.replace !== "string"
      || change.find.length < 12 || change.find.length > 12000 || change.replace.length > 24000
      || change.find === change.replace || /<\/?(?:html|head|body|style)\b|<link\b/i.test(change.replace)) {
      throw new Error("Modifica di creazione non valida");
    }
    const at = locateUniqueBodyFind(html, change.find, bounds);
    return { start: at.start, end: at.end, text: change.replace };
  }).sort((a, b) => a.start - b.start);
  if (edits.some((edit, i) => i > 0 && edit.start < edits[i - 1].end)) {
    throw new Error("Modifiche di creazione sovrapposte");
  }
  let result = html;
  for (const edit of edits.slice().reverse()) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  if (result.length > MAX_ARTIFACT_CHARS) throw new Error("Composizione risultante troppo grande");
  if (!isComposedVisualArtifact(result)) throw new Error("La modifica elimina il contratto della composizione");
  return result;
}
