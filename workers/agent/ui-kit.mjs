// Fenix UI kit — the base stylesheet every generated app ships with.
// The agent gets a consistent, accessible, mobile-first visual grammar for free
// (typography, header, tab bar/sidebar, cards, lists, forms, buttons, badges,
// empty states, toasts, site nav/hero/footer) and only customises tokens in
// styles.css. The file is seeded into the sandbox before the model starts, is
// read-only for the tools, and the gate verifies it is intact and linked.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

export const UI_KIT_PATH = "public/fenix-ui.css";
export const UI_KIT_HREF = "/fenix-ui.css";
export const UI_KIT_VERSION = 2;
export const UI_KIT_CSS = readFileSync(join(HERE, "runtime", "fenix-ui.css"), "utf8");
export const UI_KIT_HASH = createHash("sha256").update(UI_KIT_CSS).digest("hex").slice(0, 16);

/** Prompt cheat-sheet: what the model needs to use the kit well, and nothing more. */
export const UI_KIT_PROTECTED_SELECTORS = [
  ".fx-app", ".fx-body", ".fx-main", ".fx-header", ".fx-tabbar", ".fx-tab",
  ".fx-card", ".fx-item", ".fx-kpi", ".fx-btn", ".fx-input", ".fx-select",
  ".fx-textarea", ".fx-dialog", ".fx-sheet", ".fx-empty", ".fx-toast",
];

export const UI_KIT_CHEATSHEET = `# Fenix UI kit (public/fenix-ui.css, v${UI_KIT_VERSION}) — already in the project, read-only
Link it FIRST in every page, then your stylesheet: <link rel="stylesheet" href="/fenix-ui.css"><link rel="stylesheet" href="/styles.css">.
styles.css = tokens for this brief + domain-specific rules only (never re-declare buttons/cards/inputs from scratch). Choose colours from the real activity, not a generic purple/blue default:
  :root{--fx-accent:#…; --fx-accent-ink:#fff; --fx-accent-soft:#…; --fx-bg:#…; --fx-surface:#…; --fx-ink:#…; --fx-font-display:"Fraunces",serif /* only if the brief wants a display font */}
HARD RULE: styles.css must never contain a rule whose complete selector is exactly one of these protected kit selectors: ${UI_KIT_PROTECTED_SELECTORS.join(", ")}. Do not copy their declarations. Customise them only with :root tokens, or add a new domain class such as .bakery-product or .barber-appointment and style that class. Pseudo/selectors such as .barber-appointment:hover are fine when they start from your own domain class.
App skeleton (phone: bottom tab bar; desktop: same nav becomes a sidebar automatically):
  <div class="fx-app"><nav class="fx-tabbar" aria-label="Sezioni"><a class="fx-tab" href="/" aria-current="page">SVG<span>Oggi</span></a>…</nav>
  <div class="fx-body"><header class="fx-header"><h1 class="fx-h1">Titolo</h1><span class="fx-spacer"></span><button class="fx-btn fx-btn-s">Azione</button></header>
  <main class="fx-main" id="main">…</main></div></div>
Site skeleton: <div class="fx-site"><nav class="fx-nav"><a class="fx-brand" href="/">…</a><div class="fx-nav-links">…</div><button class="fx-nav-toggle fx-btn fx-btn-icon fx-btn-secondary fx-hide-desktop" aria-label="Menu" aria-expanded="false">SVG</button></nav><div class="fx-nav-menu" hidden>…</div>
  <main><section class="fx-hero"><div><p class="fx-eyebrow">…</p><h1 class="fx-display">…</h1><p class="fx-lead">…</p><div class="fx-actions">…</div></div><div class="fx-hero-media">…</div></section>
  <section class="fx-band"><div class="fx-inner">…</div></section></main><footer class="fx-footer"><div class="fx-inner">…</div></footer></div>
Blocks: .fx-card / .fx-card-l / .fx-card-accent · .fx-section + .fx-section-title · .fx-grid (auto cards) · .fx-grid-2 · .fx-stack · .fx-row / .fx-row-between
Lists: <ul class="fx-list"><li><a class="fx-item" href="…"><span class="fx-lead-icon">SVG</span><span><span class="fx-title">…</span><br><span class="fx-sub">…</span></span><span class="fx-badge fx-badge-ok">Confermato</span></a></li></ul>
KPIs: <div class="fx-kpis"><div class="fx-kpi"><span class="fx-kpi-value">12</span><span class="fx-kpi-label">Oggi</span></div>…</div>
Forms: <form class="fx-form"><div class="fx-field"><label class="fx-label" for="x">…</label><input class="fx-input" id="x"><p class="fx-hint">…</p><p class="fx-error" hidden></p></div>
  <select class="fx-select">, <textarea class="fx-textarea">, <label class="fx-check"><input type="checkbox"> …</label>, .fx-segmented (buttons with aria-pressed), .fx-search (svg + .fx-input)
  <div class="fx-actions"><button class="fx-btn" type="submit">Salva</button><button class="fx-btn fx-btn-secondary" type="button">Annulla</button></div></form>
Buttons: .fx-btn (primary) · .fx-btn-secondary · .fx-btn-ghost · .fx-btn-danger · .fx-btn-s · .fx-btn-icon (needs aria-label) · .fx-btn-block · .fx-fab (floating +)
Feedback: .fx-empty (svg + .fx-h3 + p + .fx-btn) for every empty list · .fx-toast (+ .is-visible / .is-error, aria-live="polite") · .fx-alert / .fx-alert-danger · .fx-skeleton · .fx-badge(-ok|-warn|-danger|-accent)
Dialog: <dialog class="fx-dialog"><form method="dialog" class="fx-sheet">…</form></dialog> (bottom sheet on phone, centered on desktop)
Tables (desktop data): <div class="fx-table-wrap"><table class="fx-table">…</table></div>; on phone prefer .fx-list
Type: .fx-display .fx-h1 .fx-h2 .fx-h3 .fx-lead .fx-muted .fx-small .fx-eyebrow .fx-num · dark mode: <html data-theme="dark"> only if the brief asks
Icons: SVG from the icons tool inside .fx-tab / .fx-lead-icon / .fx-btn / .fx-empty (24px grid; class="fx-icon" elsewhere). Never emoji.`;

/**
 * Writes the kit into the sandbox (create and edit alike) so the model can link
 * it. Returns what happened for the job log.
 */
export async function seedUiKit(sandbox) {
  let existing = null;
  try { existing = await sandbox.readFile(UI_KIT_PATH); } catch { /* missing */ }
  if (existing === UI_KIT_CSS) return { seeded: false, updated: false };
  await sandbox.writeFile(UI_KIT_PATH, UI_KIT_CSS);
  return { seeded: existing == null, updated: existing != null };
}

export function isUiKitPath(path) {
  return String(path || "").replace(/^\.?\//, "") === UI_KIT_PATH;
}

/**
 * Gate: the kit is present and untouched, and every page links it before any
 * other stylesheet. Returns a list of problems (empty = ok).
 */
export async function uiKitProblems({ files, readFile }) {
  const problems = [];
  const has = files.some((f) => f.path === UI_KIT_PATH);
  if (!has) return [`${UI_KIT_PATH} mancante: non eliminarlo, è la base grafica.`];
  const css = await readFile(UI_KIT_PATH);
  if (css !== UI_KIT_CSS) problems.push(`${UI_KIT_PATH} modificato: ripristinalo (ridefinisci i token in styles.css, non nel kit).`);
  for (const f of files.filter((x) => /^public\/.*\.html$/.test(x.path))) {
    const html = await readFile(f.path);
    const links = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)].map((m) => m[0]);
    const kitIndex = links.findIndex((l) => /href=["'](?:\.?\/)?fenix-ui\.css["']/i.test(l));
    if (kitIndex < 0) problems.push(`${f.path}: manca <link rel="stylesheet" href="/fenix-ui.css">`);
    else if (kitIndex !== 0) problems.push(`${f.path}: /fenix-ui.css deve essere il primo stylesheet (prima di styles.css)`);
    const body = html.replace(/<head[\s\S]*?<\/head>/i, "");
    const uses = (body.match(/class=["'][^"']*\bfx-/g) || []).length;
    if (uses < 4) problems.push(`${f.path}: usa le classi del kit (fx-app/fx-site, fx-main, fx-card, fx-btn…), trovate ${uses}`);
  }
  const stylesEntry = files.find((f) => f.path === "public/styles.css");
  if (stylesEntry) {
    const custom = (await readFile(stylesEntry.path)).replace(/\/\*[\s\S]*?\*\//g, "");
    const protectedSelectors = new Set(UI_KIT_PROTECTED_SELECTORS);
    for (const match of custom.matchAll(/([^{}]+)\{/g)) {
      for (const raw of match[1].split(",")) {
        const selector = raw.trim();
        if (protectedSelectors.has(selector)) problems.push(`public/styles.css: non ridefinire ${selector}; usa i token :root o una classe di dominio`);
      }
    }
  }
  return problems;
}
