import { DASHBOARD_CRUD_SCRIPT } from "./fenix-crud-runtime.ts";
export { DASHBOARD_CRUD_SCRIPT };

/** Repair gestionali: modal Nuovo/Annulla/Salva + pelle terracotta/cobalto/avorio. */

export const ARGILLA_PALETTE = {
  bg: "#f3eadc",
  surface: "#fbf6ee",
  fg: "#2b211c",
  muted: "#6e5648",
  accent: "#b85c38",
  line: "#d7c4b0",
};

const FAKE_COPY =
  /Fenix 2:\s*Vite \+ React|Vite \+ React|Persistenza via\s*,?\s*|1 schermate/gi;

export function stripFakeStudioCopy(text: string): string {
  return String(text || "")
    .replace(FAKE_COPY, "")
    .replace(/\(\s*\)\.?/g, "")
    .replace(/:\s*\.?\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\s+:/g, ":")
    .trim();
}

export function scrubTechMessages<T extends { content: string }>(messages: T[] = []): T[] {
  return messages
    .map((m) => ({ ...m, content: stripFakeStudioCopy(m.content) }))
    .filter((m) => m.content.length > 1);
}

export function parseEuro(v: unknown): number {
  let s = String(v ?? "")
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!s) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/[^\d.-]/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function looksLikeBeigeSaas(html: string): boolean {
  const h = String(html || "");
  if (/Barlow Condensed|Fraunces|data-fenix-craft-desk/i.test(h)) return false;
  const beige = /#f5f5f7|#fafafa|#f8f8f8|#ffffff|#f4f4f5|#efe6d4|#f7f1e4/i.test(h);
  const generic = /Inter|Manrope|system-ui|beige|SaaS/i.test(h);
  const fewMarks = (h.match(/<svg/gi) || []).length < 2;
  return (beige && generic) || (beige && fewMarks && /nuovo pezzo|inventario/i.test(h));
}

export function shouldRepairDashboard(html: string, kind?: string): boolean {
  if (kind && kind !== "dashboard") return false;
  if (!html) return false;
  if (/\bfk-tab\b/.test(html)) return false;
  if (/Barlow Condensed/i.test(html) && /#0e0d0b/i.test(html)) return false;
  return /<table/i.test(html) || /nuovo pezzo/i.test(html) || /inventario/i.test(html);
}

export function hasDashboardCrud(html: string): boolean {
  return /data-fenix-crud/.test(html);
}

export function repairDashboardCrud(html: string): string {
  if (!html) return html;
  let next = html.replace(FAKE_COPY, "");
  next = next.replace(/<script[^>]*data-fenix-crud[^>]*>[\s\S]*?<\/script>/gi, "");
  if (/<\/body>/i.test(next)) return next.replace(/<\/body>/i, `${DASHBOARD_CRUD_SCRIPT}</body>`);
  return next + DASHBOARD_CRUD_SCRIPT;
}

const CRAFT_DESK_CSS = `<style data-fenix-craft-desk>
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap");
:root{--bg:#f3eadc;--surface:#fbf6ee;--fg:#2b211c;--muted:#6e5648;--accent:#b85c38;--line:#d7c4b0;--cobalt:#1e3a5f}
html,body{background:var(--bg);color:var(--fg);font:400 15px/1.45 "Source Sans 3",sans-serif}
h1,h2,.brand,header .mark{font-family:"Fraunces",Georgia,serif;color:var(--fg)}
header .mark svg, .fk-appicon{color:var(--accent)}
nav button.on, nav a.on{color:var(--cobalt);border-bottom:2px solid var(--accent)}
table{width:100%;border-collapse:collapse;background:var(--surface)}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
td{padding:10px 12px;border-bottom:1px solid var(--line);color:var(--fg)}
button, .cta{border-radius:2px}
dialog, [role=dialog], .modal{background:var(--surface);color:var(--fg);border:1px solid var(--line);padding:20px 22px;max-width:420px}
</style>`;

const VESSEL_MARK = `<span class="fk-appicon" aria-hidden="true" data-fenix-vessel><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 8h8l-1 11H9L8 8z"/><path d="M9 8V6h6v2"/><path d="M7 8h10"/></svg></span>`;

export function applyCraftDashboardSkin(html: string): string {
  if (!html || /data-fenix-craft-desk/.test(html)) return html;
  if (/Barlow Condensed/i.test(html) && /#0e0d0b/i.test(html)) return html;
  let next = html;
  if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (open) => `${open}${CRAFT_DESK_CSS}`);
  } else {
    next = CRAFT_DESK_CSS + next;
  }
  if (!/data-fenix-vessel/.test(next) && /<header/i.test(next)) {
    next = next.replace(/<header([^>]*)>/i, `<header$1>${VESSEL_MARK}`);
  }
  return next;
}

export function polishDashboardHtml(html: string, kind?: string): string {
  if (!shouldRepairDashboard(html, kind)) return html;
  return repairDashboardCrud(applyCraftDashboardSkin(html));
}
