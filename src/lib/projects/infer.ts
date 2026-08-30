import type { ProjectKind } from "./types";

export type ProductChoice = "auto" | "app" | "site" | "dashboard";

export function inferKind(brief: string): ProjectKind {
  const p = brief.toLowerCase();
  if (/\b(sito web|landing|pagina web)\b/.test(p)) return "site";
  if (/\b(gestional|cruscotto|crm desktop|timesheet|fatturazione ufficio)\b/.test(p))
    return "dashboard";
  return "app";
}

export function formatPrefix(kind: ProjectKind) {
  if (kind === "site") {
    return "FORMATO: sito web. kind=site. Sezioni, nav in alto, footer. NON un'app telefono.\n\n";
  }
  if (kind === "dashboard") {
    return "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri. Tabella che si riempie. NON landing, NON tabbar iPhone.\n\n";
  }
  return "FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito.\n\n";
}
