import type { ProjectKind } from "./types";

export type ProductChoice = "auto" | "app" | "site" | "dashboard";

const KINDS: ProjectKind[] = ["landing", "app", "dashboard", "tool", "game", "site"];

export function isPhoneKind(kind?: string): boolean {
  return kind === "app" || kind === "tool" || kind === "game";
}

export function isDeskKind(kind?: string): boolean {
  return kind === "dashboard" || kind === "site" || kind === "landing";
}

export function inferKind(brief: string): ProjectKind {
  const p = brief.toLowerCase();
  if (/\b(sito web|landing|pagina web)\b/.test(p)) return "site";
  if (/\b(gestional|cruscotto|crm desktop|timesheet|fatturazione ufficio)\b/.test(p))
    return "dashboard";
  return "app";
}

/** Vertical short-clip feed. Original craft, not a TikTok clone. */
export function isClipFeedBrief(brief: string): boolean {
  const p = String(brief || "").toLowerCase();
  return (
    /tik\s*tok|tiktok|douyin/.test(p) ||
    /\breels?\b|\bshorts?\b|\bfyp\b|for\s*you/.test(p) ||
    /video\s*(vertical[ei]?|cort[io]|social|a tutto schermo)/.test(p) ||
    /clip\s*vertical|scroll(?:are)?\s+(?:i\s+)?video|app\s+(?:di\s+)?video/.test(p) ||
    /simile\s+(?:a\s+)?(?:tik|instagram)|tipo\s+(?:tiktok|instagram\s*reel)/.test(p)
  );
}

/** Kind locked in the stored prompt (FORMATO / kind=). Undefined if the prompt is silent. */
export function kindFromPrompt(prompt?: string): ProjectKind | undefined {
  if (!prompt) return undefined;
  const p = prompt.toLowerCase();
  const explicit = p.match(/\bkind\s*=\s*(landing|app|dashboard|tool|game|site)\b/);
  if (explicit && KINDS.includes(explicit[1] as ProjectKind)) {
    return explicit[1] as ProjectKind;
  }
  if (/\bformato:\s*gestionale/.test(p)) return "dashboard";
  if (/\bformato:\s*sito/.test(p)) return "site";
  if (/\bformato:\s*app telefono/.test(p)) return "app";
  return undefined;
}

/**
 * requested/prompt lock beats a historically wrong stored kind.
 * A worker META kind never overwrites a user-chosen or prompt-locked kind.
 */
export function resolveProjectKind(opts: {
  stored?: ProjectKind;
  requested?: ProjectKind;
  prompt?: string;
  worker?: ProjectKind;
}): ProjectKind {
  const fromPrompt = kindFromPrompt(opts.prompt);
  if (opts.requested && KINDS.includes(opts.requested)) return opts.requested;
  if (fromPrompt) return fromPrompt;
  if (opts.stored && KINDS.includes(opts.stored)) return opts.stored;
  if (opts.worker && KINDS.includes(opts.worker)) return opts.worker;
  return "app";
}

export function formatPrefix(kind: ProjectKind, brief = "") {
  if (kind === "site") {
    return "FORMATO: sito web. kind=site. Sezioni, nav in alto, footer. NON un'app telefono. NON un gestionale (niente .orders, inventario, Nuovo pezzo).\n\n";
  }
  if (kind === "dashboard") {
    return "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri. Tabella che si riempie. NON landing, NON tabbar iPhone.\n\n";
  }
  if (isClipFeedBrief(brief)) {
    return "FORMATO: app telefono 390×844. kind=app. Feed verticale a tutto schermo, dock Feed/Crea/Salvati/Profilo. NON 5 tab CRUD, NON voci, NON un sito.\n\n";
  }
  return "FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito.\n\n";
}
