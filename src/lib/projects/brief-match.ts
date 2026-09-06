/** Conservative rejection of the known generic fallback, not a semantic score. */
export function genericBriefMismatch(html: string, brief: string): string | null {
  if (!brief.trim() || /\b(?:note|notes|notepad|appunti|taccuino|to.?do)\b/i.test(brief)) return null;
  const visible = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const noteHeading = /<h[12]\b[^>]*>\s*Note\s*<\/h[12]>/i.test(visible);
  const genericCopy = /In tasca|Niente in lista|Le voci restano nella lista/i.test(visible);
  return noteHeading && genericCopy
    ? "È rimasta la bozza generica Note: il prodotto richiesto non è stato realizzato."
    : null;
}
