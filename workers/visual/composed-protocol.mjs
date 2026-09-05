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

export const COMPOSED_BUILD_SYSTEM = `Completa le funzionalità richieste dal brief sull'app Fenix già composta.
Non restituire un documento HTML intero. Preserva head, palette, tipografia, icone e layout esistenti.
Puoi aggiungere HTML nel body e modificare funzioni JavaScript per realizzare il comportamento richiesto: NON limitarti a cambiare colori o testi se mancano funzioni.
Usa le classi esistenti, le API Fenix.load/save o Fenix.data e le viste già presenti. Nessuna credenziale, import esterno o seconda app.
Rispondi SOLO JSON: {"version":1,"baseSha256":"SHA fornito","changes":[{"find":"testo esatto unico nel body originale","replace":"nuovo testo"}]}.
Da 1 a 12 cambiamenti disgiunti sul documento ORIGINALE; find 12–12000 caratteri, replace massimo 24000. Nessuna sostituzione del body intero, del root o della navigazione.
Non aggiungere style/link: la direzione grafica è già definita. Mantieni logica, dati e schermate non interessati. Output atomico: niente markdown o META/HTML.`;

export const COMPOSED_PLAN_APPLY_RETRIES = 2;
export const COMPOSED_PLAN_DEGRADED_LOG = "Piano di creazione non applicato; seed composto invariato";

const RETRYABLE_COMPOSED_PLAN = /JSON non valido|Piano di creazione non valido|Target di creazione assente|ambiguo o fuori dal body|Modifica di creazione non valida|Modifiche di creazione sovrapposte/;

/** @param {unknown} error */
export function composedPlanError(error) {
  if (error instanceof SyntaxError) return new Error("Piano di creazione JSON non valido");
  if (error instanceof Error) return error;
  return new Error(String(error));
}

/** @param {unknown} error */
export function isRetryableComposedPlanError(error) {
  return RETRYABLE_COMPOSED_PLAN.test(composedPlanError(error).message);
}

/** @param {unknown} error */
export function composedPlanRetryFeedback(error) {
  return `ERRORE SUL PIANO PRECEDENTE:\n${composedPlanError(error).message}\nCopia i find come sottostringhe verbatim dall'HTML ORIGINALE. Ogni find deve essere unico nel body. Non sostituire head, style o link. Non cambiare BASE_SHA256. Rispondi SOLO JSON.`;
}

/**
 * @param {{prompt: string, instruction?: string, html: string, digest: string, feedback?: string}} input
 */
export function composedBuildUserContent(input) {
  return [
    `BRIEF:\n${input.prompt}`,
    `DIREZIONE:\n${input.instruction || ""}`,
    input.feedback || "",
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
 * @param {string} text
 * @param {(feedback: string) => Promise<string>} [retryPlan]
 * @returns {Promise<{html: string, applied: boolean, attempts: number, log: string[], error?: Error}>}
 */
export async function applyComposedBuildPlanOrSeed(html, applyPlan, text, retryPlan) {
  let lastError;
  let current = text;
  let attempts = 0;
  for (let attempt = 0; attempt <= COMPOSED_PLAN_APPLY_RETRIES; attempt++) {
    attempts = attempt + 1;
    try {
      const result = await applyPlan(parseComposedBuildPlan(current));
      return { html: result, applied: true, attempts, log: [] };
    } catch (error) {
      lastError = composedPlanError(error);
      if (attempt === COMPOSED_PLAN_APPLY_RETRIES || !retryPlan || !isRetryableComposedPlanError(lastError)) {
        break;
      }
      try {
        current = await retryPlan(composedPlanRetryFeedback(lastError));
      } catch (retryError) {
        lastError = composedPlanError(retryError);
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
  const bodyOpen = /<body\b[^>]*>/i.exec(html);
  const start = bodyOpen ? bodyOpen.index + bodyOpen[0].length : -1;
  const end = html.toLowerCase().lastIndexOf("</body>");
  if (start < 0 || end < start) throw new Error("Body della composizione non valido");
  const edits = value.changes.map(change => {
    if (!change || typeof change !== "object" || Array.isArray(change)
      || Object.keys(change).some(key => !["find", "replace"].includes(key))
      || typeof change.find !== "string" || typeof change.replace !== "string"
      || change.find.length < 12 || change.find.length > 12000 || change.replace.length > 24000
      || change.find === change.replace || /<\/?(?:html|head|body|style)\b|<link\b/i.test(change.replace)) {
      throw new Error("Modifica di creazione non valida");
    }
    const at = html.indexOf(change.find);
    if (at < start || at + change.find.length > end || html.indexOf(change.find, at + 1) !== -1) {
      throw new Error("Target di creazione assente, ambiguo o fuori dal body");
    }
    return { start: at, end: at + change.find.length, text: change.replace };
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
