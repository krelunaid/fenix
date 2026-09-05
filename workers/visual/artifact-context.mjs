/** Preserve the entire supported artifact; never turn an edit into a partial rewrite. */
export const MAX_ARTIFACT_CHARS = 120000;

/** @param {string} html */
export function artifactContext(html) {
  if (html.length > MAX_ARTIFACT_CHARS) {
    throw new RangeError("Documento troppo grande per una modifica sicura. La versione precedente resta invariata.");
  }
  return html;
}

/** @param {{choices?: {finish_reason?: string | null, message?: {content?: string | null}}[]}} payload */
export function completeResponseText(payload) {
  const choice = payload.choices?.[0];
  // Some recorded/compatible responses omit finish_reason. Explicit non-stop
  // responses, especially token exhaustion, must never replace a stable app.
  if (choice?.finish_reason != null && choice.finish_reason !== "stop") {
    throw new Error("Risposta del modello incompleta. La versione precedente resta invariata.");
  }
  return choice?.message?.content ?? "";
}
