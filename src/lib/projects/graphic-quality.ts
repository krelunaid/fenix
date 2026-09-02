/**
 * Graphic quality gate. Compilation is not enough for ready/publish.
 * Structured, reproducible findings. No self-assigned scores without evidence.
 */
import { familyFromBrief, tokensFromBrief, type TokenFamily } from "./design-tokens.ts";
import { looksLikeIosWidgetHome } from "./craft-icons.ts";
import { auditCraft, extractCssVars } from "./visual-quality.ts";

export type GraphicAxis =
  | "hierarchy"
  | "density"
  | "originality"
  | "color"
  | "imagery"
  | "controls"
  | "state"
  | "responsive"
  | "a11y"
  | "console";

export type GraphicFinding = {
  axis: GraphicAxis;
  severity: "fail" | "warn" | "pass";
  code: string;
  summary: string;
  evidence: string;
};

export type GraphicReport = {
  ok: boolean;
  score: number;
  threshold: typeof GRAPHIC_SCORE_THRESHOLD;
  findings: GraphicFinding[];
  family: TokenFamily | "unknown";
};

export const GRAPHIC_SCORE_THRESHOLD = 72;

const GENERIC_TABS = /\b(?:Home|Nuovo|Elenco|Numeri|Altro)\b/;
const GENERIC_HELLO = /<h1[^>]*>\s*Ciao\s*<\/h1>/i;
const GENERIC_ROLE = /<(?:p|span)[^>]*fk-role[^>]*>\s*Operatore\s*</i;
const EMPTY_LABEL = /nessun elemento/i;
const TERRACOTTA_BG = /#efe6d4|#e8dcc8|#f7f1e4|#fbf6ee/i;
const TERRACOTTA_ACCENT = /#c45c26|#b85c38|#c45c26/i;
const CLONE_GRAY = /#f5f5f7/i;
const CLONE_BLUE = /#0071e3|#0a84ff|#007aff/i;
const CLONE_FACE = /San Francisco|\bSF Pro\b|-apple-system|BlinkMacSystemFont/i;
const PLACEHOLDER_GRAY = /background(?:-color)?\s*:\s*(?:#(?:c{3,6}|d{3,6}|e5e5e5|eeeeee)|gray(?:text)?)/i;
const DEAD_MINHEIGHT = /min-height\s*:\s*(?:[5-9]\d|1[0-9]\d)vh/i;
const WEAK_CTA = />(?:Salva|Rimuovi|OK|Invia)<\/button>/gi;

function finding(
  axis: GraphicAxis,
  severity: GraphicFinding["severity"],
  code: string,
  summary: string,
  evidence: string,
): GraphicFinding {
  return { axis, severity, code, summary, evidence: evidence.slice(0, 180) };
}

function markup(html: string): string {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
}

/** Markup plus JS template strings: generated apps paint into an empty <main>. */
function contentText(html: string): string {
  return String(html || "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\n|\\t/g, " ")
    .replace(/['"`]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function count(re: RegExp, src: string): number {
  return (String(src || "").match(re) || []).length;
}

function isProductFamily(family: TokenFamily | "unknown"): boolean {
  return family === "perfume" || family === "fashion" || family === "booking";
}

export type RenderedGraphicMetrics = {
  mainChars: number;
  headingCount: number;
  visibleImages: number;
  visibleCards: number;
  emptyStateVisible: boolean;
  rowCount: number;
  deadRatio: number;
  uniqueTextColors: number;
  nativeUnstyledInputs: number;
  overflowX: number;
  title: string;
  consoleErrors: number;
};

/** DOM probe for Playwright. Measures the painted screen, not the source string. */
export function collectRenderedGraphic(): RenderedGraphicMetrics {
  const main = document.querySelector("main, .fk-main, #root, #app") || document.body;
  const rect = main.getBoundingClientRect();
  const area = Math.max(1, rect.width * rect.height);
  let covered = 0;
  const colors = new Set<string>();
  for (const el of main.querySelectorAll<HTMLElement>("h1,h2,h3,p,li,article,button,a,img,svg,figure,label,td,dt,dd")) {
    const b = el.getBoundingClientRect();
    if (b.width < 8 || b.height < 8) continue;
    const interW = Math.max(0, Math.min(rect.right, b.right) - Math.max(rect.left, b.left));
    const interH = Math.max(0, Math.min(rect.bottom, b.bottom) - Math.max(rect.top, b.top));
    covered += interW * interH;
    const c = getComputedStyle(el).color;
    if (c) colors.add(c);
  }
  const text = String((main as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
  const images = [...document.querySelectorAll("img, svg, canvas, .hero, .sil")].filter((n) => {
    const b = n.getBoundingClientRect();
    return b.width >= 24 && b.height >= 20;
  }).length;
  const inputs = [...document.querySelectorAll<HTMLElement>("input, textarea, select")].filter((el) => {
    const s = getComputedStyle(el);
    return s.appearance === "auto" && s.backgroundColor === "rgba(0, 0, 0, 0)" && s.borderStyle === "none";
  }).length;
  return {
    mainChars: text.length,
    headingCount: document.querySelectorAll("h1,h2,h3").length,
    visibleImages: images,
    visibleCards: document.querySelectorAll("article, .card, .look, .slot, .fragrance, .fk-tile").length,
    emptyStateVisible: /nessun elemento/i.test(text),
    rowCount: document.querySelectorAll("[data-id], article, .card, li, tr").length,
    deadRatio: Math.max(0, 1 - covered / area),
    uniqueTextColors: colors.size,
    nativeUnstyledInputs: inputs,
    overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    title: document.title || "",
    consoleErrors: 0,
  };
}

export function auditGraphicQuality(
  html: string,
  opts?: { brief?: string; kind?: string; rendered?: RenderedGraphicMetrics },
): GraphicReport {
  const text = String(html || "");
  const brief = String(opts?.brief || "");
  const family = brief ? familyFromBrief(brief) : "unknown";
  const tokens = brief ? tokensFromBrief(brief) : null;
  const vis = contentText(text);
  const body = markup(text);
  const findings: GraphicFinding[] = [];
  const craft = auditCraft(text);

  const cloneSet = CLONE_GRAY.test(text) && CLONE_BLUE.test(text) && CLONE_FACE.test(text);
  if (cloneSet) {
    findings.push(
      finding(
        "originality",
        "fail",
        "apple-clone",
        "Clone di chrome Apple (grigio sistema + blu + SF).",
        "Coppia #f5f5f7 + #0071e3 + San Francisco/SF Pro.",
      ),
    );
  } else {
    findings.push(
      finding("originality", "pass", "anti-clone", "Nessun clone Apple rilevato.", "set grigio+blu+SF assente"),
    );
  }

  if (looksLikeIosWidgetHome(text)) {
    findings.push(
      finding(
        "hierarchy",
        "fail",
        "skeletal-home",
        "Home scheletrica (4 riquadri + Ultimo/Stato).",
        "looksLikeIosWidgetHome",
      ),
    );
  }

  if (GENERIC_HELLO.test(text) && GENERIC_ROLE.test(text)) {
    findings.push(
      finding(
        "hierarchy",
        "fail",
        "generic-chrome",
        "Chrome generico Ciao/Operatore, nessuna identità di prodotto.",
        "h1 Ciao + .fk-role Operatore",
      ),
    );
  }

  const tabLabels = [...text.matchAll(/<(?:button|a)[^>]*data-view[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const genericNav =
    tabLabels.length >= 4 && tabLabels.filter((l) => GENERIC_TABS.test(l)).length >= 3;
  if (genericNav && isProductFamily(family)) {
    findings.push(
      finding(
        "hierarchy",
        "fail",
        "generic-nav",
        "Navigazione identica (Home/Nuovo/Elenco) su un prodotto di mestiere.",
        tabLabels.slice(0, 5).join(" · "),
      ),
    );
  }

  const emptyHit = EMPTY_LABEL.test(text);
  const listItems =
    count(/<(?:li|article|tr)\b/gi, body) +
    count(/class=["'][^"']*(?:card|fk-tile|look|fragrance|slot)[^"']*["']/gi, body);
  const dataRows =
    count(/\{id:\s*["'][^"']+["']/g, text) + count(/id:\s*["'][a-z]?\d/g, text);
  if (emptyHit && (listItems >= 3 || dataRows >= 3)) {
    findings.push(
      finding(
        "state",
        "fail",
        "empty-contradiction",
        "Empty state «Nessun elemento» con righe già presenti.",
        `empty=true items≈${Math.max(listItems, dataRows)}`,
      ),
    );
  }

  const imgs = count(/<img\b/gi, text) + count(/<svg\b/gi, text) + count(/class=["'][^"']*hero/gi, text);
  if (isProductFamily(family) && imgs < 2) {
    findings.push(
      finding(
        "imagery",
        "fail",
        "no-product-image",
        "Prodotto senza immagine, texture o flacone/abito/sala.",
        `svg/img/hero=${imgs} famiglia=${family}`,
      ),
    );
  }

  const vars = extractCssVars(text);
  const terracotta =
    (TERRACOTTA_BG.test(vars.bg || "") || TERRACOTTA_BG.test(text.slice(0, 2500))) &&
    (TERRACOTTA_ACCENT.test(vars.accent || "") || TERRACOTTA_ACCENT.test(text.slice(0, 2500)));
  if (terracotta && isProductFamily(family) && family !== "ceramic") {
    findings.push(
      finding(
        "color",
        "fail",
        "repeat-palette",
        "Palette beige/terracotta su un brief che non è ceramica.",
        `${vars.bg || "?"} / ${vars.accent || "?"} famiglia=${family}`,
      ),
    );
  }

  if (PLACEHOLDER_GRAY.test(text) && isProductFamily(family)) {
    findings.push(
      finding("imagery", "fail", "gray-placeholder", "Placeholder grigi al posto di materiali.", "background #ccc/#ddd"),
    );
  }

  if (DEAD_MINHEIGHT.test(text) && vis.length < 220) {
    findings.push(
      finding("density", "fail", "dead-zone", "Zona vuota da min-height enorme con poco contenuto.", `chars=${vis.length}`),
    );
  }

  if (vis.length < 80) {
    findings.push(
      finding("density", "fail", "empty-main", "Schermata quasi vuota.", `testo visibile ${vis.length} caratteri`),
    );
  } else if (vis.length < 160 && isProductFamily(family)) {
    findings.push(
      finding("density", "fail", "sparse-product", "Prodotto di mestiere con home troppo sparsa.", `chars=${vis.length}`),
    );
  }

  const nativeInputs = count(/<(?:input|select|textarea)\b(?![^>]*class=)/gi, text);
  const styledInputs = count(/<(?:input|select|textarea)\b[^>]*class=/gi, text);
  if (nativeInputs >= 2 && styledInputs === 0 && isProductFamily(family)) {
    findings.push(
      finding(
        "controls",
        "fail",
        "naked-controls",
        "Controlli browser nudi, senza classe né kit.",
        `input senza class=${nativeInputs}`,
      ),
    );
  }

  const weakCtas = count(WEAK_CTA, text);
  const strongCtas = count(/<(?:button|a)[^>]*>[^<]{6,40}<\/(?:button|a)>/gi, text);
  if (isProductFamily(family) && weakCtas >= 2 && strongCtas < 2) {
    findings.push(
      finding("controls", "fail", "weak-cta", "CTA deboli (solo Salva/Rimuovi).", `weak=${weakCtas}`),
    );
  }

  if (craft.aiPurple) {
    findings.push(finding("color", "fail", "ai-purple", "Viola AI da template.", craft.notes.join(" · ")));
  }
  if (craft.genericFont) {
    findings.push(finding("originality", "fail", "template-font", "Font da template (Inter/Manrope).", craft.notes.join(" · ")));
  }

  const rendered = opts?.rendered;
  if (rendered) {
    if (rendered.emptyStateVisible && rendered.rowCount >= 3) {
      findings.push(
        finding(
          "state",
          "fail",
          "empty-contradiction-render",
          "Empty state visibile con elenco pieno (screenshot/DOM).",
          `rows=${rendered.rowCount} title=${rendered.title}`,
        ),
      );
    }
    if (rendered.deadRatio > 0.78) {
      findings.push(
        finding(
          "density",
          "fail",
          "dead-zone-render",
          "Dead zone misurata: gran parte del main senza contenuto.",
          `deadRatio=${rendered.deadRatio.toFixed(2)}`,
        ),
      );
    }
    if (isProductFamily(family) && rendered.visibleImages < 1) {
      findings.push(
        finding("imagery", "fail", "no-image-render", "Nessuna immagine visibile nel viewport.", `images=${rendered.visibleImages}`),
      );
    }
    if (rendered.headingCount < 1) {
      findings.push(finding("hierarchy", "fail", "no-heading", "Nessun titolo visibile.", "h1-h3=0"));
    }
    if (rendered.overflowX > 8) {
      findings.push(
        finding("responsive", "fail", "overflow-x", "Overflow orizzontale.", `px=${rendered.overflowX}`),
      );
    }
    if (rendered.consoleErrors > 0) {
      findings.push(
        finding("console", "fail", "console-error", "Errori in console.", `n=${rendered.consoleErrors}`),
      );
    }
    if (rendered.uniqueTextColors <= 1 && isProductFamily(family)) {
      findings.push(
        finding("color", "warn", "flat-ink", "Un solo inchiostro visibile, gerarchia debole.", `colors=${rendered.uniqueTextColors}`),
      );
    }
  }

  if (!findings.some((f) => f.axis === "a11y")) {
    const hasFocus = /:focus-visible|:focus\b/.test(text);
    findings.push(
      hasFocus
        ? finding("a11y", "pass", "focus", "Focus visibile dichiarato.", ":focus-visible")
        : finding("a11y", "warn", "focus-missing", "Focus visibile assente nel CSS del prodotto.", "no :focus-visible"),
    );
  }

  if (tokens && !findings.some((f) => f.severity === "fail" && f.axis === "color")) {
    findings.push(
      finding("color", "pass", "tokens", `Famiglia ${tokens.family} distinta.`, tokens.dna),
    );
  }

  const fails = findings.filter((f) => f.severity === "fail");
  const warns = findings.filter((f) => f.severity === "warn");
  const score = Math.max(0, 100 - fails.length * 16 - warns.length * 4);
  return {
    ok: fails.length === 0 && score >= GRAPHIC_SCORE_THRESHOLD,
    score,
    threshold: GRAPHIC_SCORE_THRESHOLD,
    findings,
    family,
  };
}

export function formatGraphicErrors(report: GraphicReport): string {
  return report.findings
    .filter((f) => f.severity === "fail")
    .map((f) => `${f.code}: ${f.summary}`)
    .join(" · ")
    .slice(0, 240);
}
