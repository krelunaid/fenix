/** Bounded visual refinement for composed apps: no HTML/JS or palette rewrite. */
export const VISUAL_STYLE_SELECTORS = [
  "header", ".brand", "main", ".card", ".home-hero", ".home-aside .card",
  ".home-count", ".home-count b", ".slot", ".ticket", ".room", ".look",
  ".kpi", ".measure", ".day-head", ".week-strip", ".field", ".btn",
  "#tabs button", ".notes", ".kicker",
];
const MARKER = 'data-fenix-visual-style="v1"';
const MEDIA = { mobile: "(max-width: 599px)", tablet: "(min-width: 600px) and (max-width: 1023px)", desktop: "(min-width: 1024px)" };

/** @param {string} html */
export function isComposedVisualArtifact(html) {
  return /<html\b[^>]*\bdata-grammar=["'][^"']+["']/i.test(html)
    && /<style\b[^>]*\bdata-fenix-craft(?:\s|>)/i.test(html)
    && /<main\b[^>]*\bid=["']root["']/i.test(html)
    && /<nav\b[^>]*\bid=["']tabs["']/i.test(html);
}

/** @param {unknown} value @param {number} min @param {number} max @param {string} unit */
function bounded(value, min, max, unit = "") {
  if (typeof value !== "string") return false;
  const number = unit ? value.endsWith(unit) ? value.slice(0, -unit.length) : "" : value;
  return /^-?\d+(?:\.\d+)?$/.test(number) && Number(number) >= min && Number(number) <= max;
}

/** @param {string} property @param {unknown} value */
function declaration(property, value) {
  if (property === "box-shadow") {
    if (value === "none") return "none";
    if (value === "subtle") return "0 3px 14px color-mix(in srgb,var(--fg) 8%,transparent)";
  }
  if (property === "padding" && typeof value === "string") {
    const parts = value.split(" ");
    if (parts.length >= 1 && parts.length <= 4 && parts.every(part => bounded(part, 0, 32, "px"))) return value;
  }
  const ranges = {
    "gap": [0, 32, "px"], "border-radius": [0, 28, "px"],
    "font-size": [14, 40, "px"], "font-weight": [400, 750, ""],
    "line-height": [1.1, 1.7, ""], "letter-spacing": [-0.03, 0.1, "em"],
  };
  if (Object.hasOwn(ranges, property)) {
    const [min, max, unit] = ranges[/** @type {keyof typeof ranges} */ (property)];
    if (bounded(value, Number(min), Number(max), String(unit))) return String(value);
  }
  throw new Error(`Stile non consentito: ${property}`);
}

/** @param {string} html @param {unknown} plan */
export function applyVisualStylePlan(html, plan) {
  if (!isComposedVisualArtifact(html)) throw new Error("Contratto visuale non supportato");
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) throw new Error("Piano visuale non valido");
  const p = /** @type {{version?:unknown,rules?:unknown}} */ (plan);
  if (Object.keys(plan).some(key => !["version", "rules"].includes(key)) || p.version !== 1 || !Array.isArray(p.rules) || p.rules.length < 1 || p.rules.length > 24) throw new Error("Piano visuale non valido");
  const seen = new Set();
  const css = p.rules.map(rule => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule) || Object.keys(rule).some(key => !["selector", "viewport", "declarations"].includes(key))) throw new Error("Regola visuale non valida");
    const { selector, viewport = "all", declarations } = rule;
    if (!VISUAL_STYLE_SELECTORS.includes(selector) || !["all", "mobile", "tablet", "desktop"].includes(viewport)) throw new Error("Target visuale non consentito");
    const key = `${viewport}:${selector}`;
    if (seen.has(key)) throw new Error("Target visuale duplicato");
    seen.add(key);
    if (!declarations || typeof declarations !== "object" || Array.isArray(declarations)) throw new Error("Dichiarazioni visuali non valide");
    const entries = Object.entries(declarations);
    if (!entries.length || entries.length > 8) throw new Error("Dichiarazioni visuali non valide");
    // Match the composed grammar's specificity without !important: its base
    // phone-seed rules otherwise silently override an accepted visual plan.
    const block = `html[data-grammar] ${selector}{${entries.map(([property, value]) => `${property}:${declaration(property, value)}`).join(";")}}`;
    return viewport === "all" ? block : `@media ${MEDIA[/** @type {keyof typeof MEDIA} */ (viewport)]}{${block}}`;
  }).join("\n");
  // Only replace our own head-only layer. Runtime, content, icons and palette
  // remain byte-identical; navigation can rebuild main without losing styles.
  const headEnd = html.search(/<\/head\s*>/i);
  const bodyStart = html.search(/<body\b/i);
  if (headEnd < 0 || bodyStart < headEnd) throw new Error("Head visuale non valido");
  const head = html.slice(0, headEnd);
  const existing = /<style data-fenix-visual-style="v1">[\s\S]*?<\/style>\n?/g;
  if ([...head.matchAll(existing)].length > 1) throw new Error("Layer visuale duplicato");
  const next = head.replace(existing, "") + `<style ${MARKER}>${css}</style>\n` + html.slice(headEnd);
  if (next === html) throw new Error("Stile invariato: nessuna modifica applicata");
  if (next.length > 120000) throw new Error("Artifact visuale troppo grande");
  return next;
}
