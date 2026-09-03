/**
 * Graphic quality gate. Compilation is not enough for ready/publish.
 * Structured, reproducible findings. No self-assigned scores without evidence.
 */
import { familyFromBrief, isProductFamily, tokensFromBrief, type TokenFamily } from "./design-tokens.ts";
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
const HOTLINK = /images\.unsplash\.com|emergent\.sh\/|apple\.com\/[^\s"']+\.(?:png|jpe?g|webp|gif|svg)/i;
const BOXED_APP = /\.app\s*\{[^}]*width\s*:\s*min\(\s*(?:1000|1040|1080|1100)px/i;
const PRODUCT_STAGE = /class=["'][^"']*\b(?:hero|sil|look)\b/i;

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

/** Visible product text, scripts stripped. Fail-closed on leaked JS tokens. */
export function leakedRuntimeText(html: string): boolean {
  const vis = markup(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  return /\bundefined\b/.test(vis) || /\bNaN\b/.test(vis) || /(^|[^A-Za-z])null([^A-Za-z]|$)/.test(vis);
}

/** CSS that paints compressed/overlapping/clipped tabs or cards — blocks ready without a browser. */
export function staticClippingHint(html: string): boolean {
  const css = (String(html || "").match(/<style\b[\s\S]*?<\/style>/gi) || []).join("\n");
  const squeezedTabs =
    /nav(?:\.fk-tab)?[^{]*\{[^}]*(?:overflow\s*:\s*(?:hidden|clip)|flex-wrap\s*:\s*nowrap)[^}]*\}/i.test(
      css,
    ) &&
    /(?:nav(?:\.fk-tab)?\s+button|\.fk-tab button)[^{]*\{[^}]*min-width\s*:\s*(?:1[2-9]\d|[2-9]\d{2})px/i.test(
      css,
    );
  const negMargin =
    /(?:nav(?:\.fk-tab)?\s+button|\.fk-tab button)[^{]*\{[^}]*margin-(?:left|right)\s*:\s*-/i.test(
      css,
    );
  const absTile =
    /(?:\.fk-tile|\.card|\.overlap)[^{]*\{[^}]*position\s*:\s*absolute/i.test(css);
  return squeezedTabs || negMargin || absTile;
}
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

function silBlocks(html: string): string[] {
  return String(html || "").match(/<div[^>]*class=["'][^"']*\bsil\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi) || [];
}

function hasDomainMark(html: string): boolean {
  return /data-imagery\s*=\s*(?:\\?["']|")domain(?:\\?["']|")/i.test(html);
}

function abstractImagery(html: string): boolean {
  if (!PRODUCT_STAGE.test(html)) return false;
  if (hasDomainMark(html)) return false;
  return true;
}

function cardClone(html: string): boolean {
  if (hasDomainMark(html)) return false;
  const css = html.match(/\.sil\s*\{[^}]+\}/i)?.[0] || "";
  const emptySil = /<div[^>]*class=["'][^"']*\bsil\b[^"']*["'][^>]*>\s*<\/div>/i.test(html);
  if (emptySil && /linear-gradient/i.test(css)) return true;
  const sils = silBlocks(html);
  if (sils.length < 3) return false;
  const original = sils.filter((s) => /<svg[\s\S]{180,}/i.test(s) || /<img\b/i.test(s));
  return original.length === 0;
}

function emptyProductAlt(html: string): boolean {
  const tags = String(html || "").match(/<img\b[^>]*>/gi) || [];
  return tags.some((tag) => {
    if (!/fk-hero|\bhero\b|data-imagery=["']domain["']/i.test(tag)) return false;
    return !/\balt=/.test(tag) || /\balt=(""|'')/.test(tag);
  });
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
  clipping: number;
  overlap: number;
  leakedText: boolean;
};

/** DOM probe for Playwright. Measures the painted screen, not the source string. */
export function collectRenderedGraphic(): RenderedGraphicMetrics {
  const main = document.querySelector("main, .fk-main, #root, #app") || document.body;
  const rect = main.getBoundingClientRect();
  const area = Math.max(1, rect.width * rect.height);
  let covered = 0;
  const colors = new Set<string>();
  for (const el of main.querySelectorAll<HTMLElement>(
    "h1,h2,h3,p,li,article,button,a,img,svg,figure,label,td,th,dt,dd,span,b,strong,time,table,.hero,.sil,.look,.card,.kpi,.day,.measure,.fragrance,.ticket,.room,.deal,.lane,.plate,.board,.lookbook,.rooms,.tickets",
  )) {
    const b = el.getBoundingClientRect();
    if (b.width < 8 || b.height < 8) continue;
    const interW = Math.max(0, Math.min(rect.right, b.right) - Math.max(rect.left, b.left));
    const interH = Math.max(0, Math.min(rect.bottom, b.bottom) - Math.max(rect.top, b.top));
    covered += interW * interH;
    const c = getComputedStyle(el).color;
    if (c) colors.add(c);
  }
  const text = String((main as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
  let clipping = 0;
  let overlap = 0;
  const seen = new Set<HTMLElement>();
  const boxes: { el: HTMLElement; r: DOMRect; parent: HTMLElement | null; clip: boolean }[] = [];
  const push = (node: HTMLElement, clip: boolean) => {
    if (seen.has(node)) {
      const prev = boxes.find((b) => b.el === node);
      if (prev && clip) prev.clip = true;
      return;
    }
    seen.add(node);
    const tag = node.tagName;
    if (tag === "SVG" || tag === "IMG" || tag === "PATH" || node.closest("svg")) return;
    const r = node.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    boxes.push({ el: node, r, parent: node.parentElement, clip });
  };
  for (const node of document.querySelectorAll<HTMLElement>("nav button, .fk-tab button, [data-view], .fk-tile")) {
    push(node, true);
  }
  for (const node of document.querySelectorAll<HTMLElement>(".card")) {
    push(node, false);
  }
  for (const box of boxes) {
    if (!box.clip) continue;
    const r = box.r;
    let scrollX = false;
    let parent = box.parent;
    while (parent && parent !== document.body) {
      const cs = getComputedStyle(parent);
      const ox = cs.overflowX;
      const oy = cs.overflowY;
      if (ox === "auto" || ox === "scroll") scrollX = true;
      const clipX = ox === "hidden" || ox === "clip";
      const clipY = oy === "hidden" || oy === "clip";
      if (clipX || clipY) {
        const pr = parent.getBoundingClientRect();
        const shell = parent.tagName === "HTML" || parent.tagName === "BODY";
        if (!shell) {
          if (clipX && (r.right > pr.right + 8 || r.left < pr.left - 8)) clipping += 1;
          else if (clipY && (r.bottom > pr.bottom + 8 || r.top < pr.top - 8)) clipping += 1;
        }
        break;
      }
      parent = parent.parentElement;
    }
    if (!scrollX && (r.right > window.innerWidth + 8 || r.left < -8)) clipping += 1;
  }
  const byParent = new Map<HTMLElement, DOMRect[]>();
  for (const box of boxes) {
    if (!box.parent) continue;
    const list = byParent.get(box.parent) || [];
    list.push(box.r);
    byParent.set(box.parent, list);
  }
  for (const list of byParent.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const area = w * h;
        const smaller = Math.min(a.width * a.height, b.width * b.height);
        if (area >= 24 && smaller > 0 && area / smaller >= 0.22) overlap += 1;
      }
    }
  }
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
    visibleCards: document.querySelectorAll("article, .card, .look, .slot, .fragrance, .fk-tile, .kpi, .measure").length,
    emptyStateVisible: /nessun elemento/i.test(text),
    rowCount: document.querySelectorAll("[data-id], article, .card, li, tr").length,
    deadRatio: Math.max(0, 1 - covered / area),
    uniqueTextColors: colors.size,
    nativeUnstyledInputs: inputs,
    overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    title: document.title || "",
    consoleErrors: 0,
    clipping,
    overlap,
    leakedText: /\bundefined\b/.test(text) || /\bNaN\b/.test(text) || /(^|\s)null(\s|$)/.test(text),
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
  const product = isProductFamily(family);

  if (leakedRuntimeText(text) || opts?.rendered?.leakedText) {
    findings.push(
      finding(
        "state",
        "fail",
        "leaked-runtime-text",
        "Testo visibile undefined/null/NaN.",
        "token JS in pagina",
      ),
    );
  }

  if (staticClippingHint(text)) {
    findings.push(
      finding(
        "responsive",
        "fail",
        "clipping-css",
        "Tab o schede compresse, sovrapposte o tagliate.",
        "layout CSS",
      ),
    );
  }

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
  if (genericNav && product) {
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
  if (product && imgs < 2) {
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

  if (product && abstractImagery(text)) {
    findings.push(
      finding(
        "imagery",
        "fail",
        "abstract-imagery",
        "Hero/card con forme geometriche o gradienti al posto di imagery di dominio.",
        "manca data-imagery=domain su .hero/.sil/.look",
      ),
    );
  }

  if (product && cardClone(text)) {
    findings.push(
      finding(
        "imagery",
        "fail",
        "card-clone",
        "Tre o più card clone con lo stesso gradiente e senza illustrazione.",
        `${silBlocks(text).length} .sil vuoti`,
      ),
    );
  }

  if (product && BOXED_APP.test(text)) {
    findings.push(
      finding(
        "density",
        "fail",
        "boxed-canvas",
        "Desktop boxed (max 1080/1100) con bande vuote ai lati.",
        ".app width:min(1080px) o 1100px",
      ),
    );
  }

  if (HOTLINK.test(text)) {
    findings.push(
      finding(
        "imagery",
        "fail",
        "hotlink-stock",
        "Hotlink di stock (Unsplash/Emergent/Apple) al posto di asset originali.",
        (text.match(HOTLINK) || ["hotlink"])[0],
      ),
    );
  }

  if (product && emptyProductAlt(text)) {
    findings.push(
      finding("a11y", "fail", "empty-alt", "Imagery di prodotto senza alt text.", "img hero alt vuoto"),
    );
  }

  const vars = extractCssVars(text);
  const terracotta =
    (TERRACOTTA_BG.test(vars.bg || "") || TERRACOTTA_BG.test(text.slice(0, 2500))) &&
    (TERRACOTTA_ACCENT.test(vars.accent || "") || TERRACOTTA_ACCENT.test(text.slice(0, 2500)));
  if (terracotta && product && family !== "ceramic") {
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

  if (
    family === "repo" &&
    /class=["'][^"']*\bkpi\b/.test(text) &&
    !/data-repo-stage|data-hash=/.test(text)
  ) {
    findings.push(
      finding(
        "hierarchy",
        "fail",
        "template-home",
        "Home universale a KPI su un brief di repository, senza timeline/diff.",
        "kpi senza data-repo-stage",
      ),
    );
  }

  const fallbackClone = /#101114/i.test(vars.bg || "") && /#e1693f/i.test(vars.accent || "");
  if (fallbackClone) {
    findings.push(
      finding(
        "color",
        "fail",
        "static-fallback",
        "Palette caduta sul fallback unico #101114/#e1693f.",
        `${vars.bg} / ${vars.accent}`,
      ),
    );
  }

  if (PLACEHOLDER_GRAY.test(text) && product) {
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
  } else if (vis.length < 160 && product) {
    findings.push(
      finding("density", "fail", "sparse-product", "Prodotto di mestiere con home troppo sparsa.", `chars=${vis.length}`),
    );
  }

  const nativeInputs = count(/<(?:input|select|textarea)\b(?![^>]*class=)/gi, text);
  const styledInputs = count(/<(?:input|select|textarea)\b[^>]*class=/gi, text);
  if (nativeInputs >= 2 && styledInputs === 0 && product) {
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
  if (product && weakCtas >= 2 && strongCtas < 2) {
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
    const deadLimit = product ? 0.58 : 0.78;
    if (rendered.deadRatio > deadLimit) {
      findings.push(
        finding(
          "density",
          "fail",
          "dead-zone-render",
          "Dead zone misurata: gran parte del main senza contenuto.",
          `deadRatio=${rendered.deadRatio.toFixed(2)} limit=${deadLimit}`,
        ),
      );
    }
    if (product && family !== "ops" && opts?.kind !== "dashboard" && rendered.visibleImages < 1) {
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
    if ((rendered.clipping || 0) > 0 || (rendered.overlap || 0) > 0) {
      findings.push(
        finding(
          "responsive",
          "fail",
          "clipping-render",
          "Clipping o sovrapposizioni visibili.",
          `clip=${rendered.clipping} overlap=${rendered.overlap}`,
        ),
      );
    }
    if (rendered.leakedText) {
      findings.push(
        finding("state", "fail", "leaked-runtime-text", "Testo visibile undefined/null/NaN.", "token JS in pagina"),
      );
    }
    if (rendered.consoleErrors > 0) {
      findings.push(
        finding("console", "fail", "console-error", "Errori in console.", `n=${rendered.consoleErrors}`),
      );
    }
    if (rendered.uniqueTextColors <= 1 && product) {
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
