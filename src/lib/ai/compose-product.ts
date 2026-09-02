/**
 * Deterministic graphic pipeline: prompt → plan → generate → visual → QA.
 * 0 LLM credits. Seed HTML is the product the worker then polishes.
 */
import { formatPrefix } from "../projects/infer.ts";
import {
  tokensFromBrief,
  tokensInstruction,
  familyFromBrief,
  variantFromBrief,
  type DesignTokens,
} from "../projects/design-tokens.ts";
import {
  grammarFromBrief,
  grammarInstruction,
  type LayoutGrammar,
  type GrammarId,
} from "../projects/layout-grammar.ts";
import { planContract, type BuildContract } from "./build-contract.ts";
import { auditGraphicQuality, type GraphicReport } from "../projects/graphic-quality.ts";
import { domainIllustration, altForBrief } from "./domain-imagery.ts";
import { DASHBOARD_POLISH_INSTRUCTION, SITE_POLISH_INSTRUCTION } from "./app-shell.ts";
import type { Palette, ProjectKind } from "../projects/types.ts";

export type PipelineRow = {
  id: string;
  title: string;
  kicker: string;
  note: string;
  meta: string;
};

export type PipelineSpec = {
  id: string;
  name: string;
  kicker: string;
  place: string;
  collection: string;
  brief: string;
  tabs: { id: string; label: string }[];
  rows: PipelineRow[];
  formTitle: string;
  cta: string;
};

export type ComposedProduct = {
  brief: string;
  tokens: DesignTokens;
  grammar: LayoutGrammar;
  spec?: PipelineSpec;
  html: string;
  polish: string;
  files: { path: string; content: string }[];
};

export type GraphicPipelineRun = {
  brief: string;
  tokens: DesignTokens;
  grammar: LayoutGrammar;
  plan: BuildContract;
  generated: {
    contract: BuildContract;
    spec?: { id: string };
    html: string;
    files: { path: string; content: string }[];
  };
  qa: GraphicReport;
};

export type PipelineFixture = {
  id: string;
  html: string;
  brief: string;
  kind: ProjectKind;
  palette: Palette;
  grammar: string;
};

export const PIPELINE_SPECS: PipelineSpec[] = [
  {
    id: "essenza-or",
    name: "Essenza",
    kicker: "Parfums · Milano",
    place: "via della Spiga 11",
    collection: "essenze",
    brief: `${formatPrefix("app")}Essenza: gestione profumi premium, flaconi, note olfattive e guardaroba.`,
    tabs: [
      { id: "collezione", label: "Collezione" },
      { id: "piramide", label: "Piramide" },
      { id: "atelier", label: "Atelier" },
      { id: "pelle", label: "Pelle" },
    ],
    rows: [
      { id: "e1", title: "Bois de Nuit", kicker: "legnosa", note: "vetiver, fumo, cedro", meta: "50 ml" },
      { id: "e2", title: "Acqua Chiara", kicker: "citrica", note: "bergamotto, tè bianco", meta: "30 ml" },
      { id: "e3", title: "Fleur Ambrée", kicker: "orientale", note: "ambra, rosa, vaniglia", meta: "100 ml" },
    ],
    formTitle: "Componi una formula",
    cta: "Registra in collezione",
  },
  {
    id: "essenza-ice",
    name: "Essenza Vetro",
    kicker: "Ghiaccio · Trieste",
    place: "molo Audace 2",
    collection: "essenze",
    brief: `${formatPrefix("app")}Essenza Vetro: gestione profumi premium, flaconi di vetro, note di ghiaccio e nebbia.`,
    tabs: [
      { id: "collezione", label: "Vetrina" },
      { id: "piramide", label: "Accordi" },
      { id: "atelier", label: "Laboratorio" },
      { id: "pelle", label: "Polso" },
    ],
    rows: [
      { id: "e1", title: "Sale Adriatico", kicker: "marina", note: "alghe, sale, cedro bianco", meta: "50 ml" },
      { id: "e2", title: "Nebbia Bora", kicker: "fresca", note: "ghiaccio, tè, vetro", meta: "30 ml" },
      { id: "e3", title: "Pino di Opicina", kicker: "boschiva", note: "pino, resina, aria", meta: "75 ml" },
    ],
    formTitle: "Nuovo accordo",
    cta: "Metti in vetrina",
  },
  {
    id: "vesti-inchiostro",
    name: "Vesti",
    kicker: "Atelier · SS26",
    place: "via della Spiga 14",
    collection: "capi",
    brief: `${formatPrefix("app")}Vesti: moda e vendite, lookbook, capi in passerella e cassa.`,
    tabs: [
      { id: "lookbook", label: "Look" },
      { id: "cassa", label: "Cassa" },
      { id: "clienti", label: "Clienti" },
      { id: "taglio", label: "Taglio" },
    ],
    rows: [
      { id: "c1", title: "Cappotto inchiostro", kicker: "M", note: "in passerella", meta: "€890" },
      { id: "c2", title: "Abito carminio", kicker: "S", note: "venduto", meta: "€640" },
      { id: "c3", title: "Pantalone carta", kicker: "L", note: "in atelier", meta: "€320" },
    ],
    formTitle: "Nuovo capo",
    cta: "Metti in passerella",
  },
  {
    id: "vesti-osso",
    name: "Vesti Osso",
    kicker: "Cucito · Firenze",
    place: "via dei Servi 7",
    collection: "capi",
    brief: `${formatPrefix("app")}Vesti Osso: moda e vendite, lookbook in avorio, capi in osso e cassa.`,
    tabs: [
      { id: "lookbook", label: "Tela" },
      { id: "cassa", label: "Libro" },
      { id: "clienti", label: "Signore" },
      { id: "taglio", label: "Cucito" },
    ],
    rows: [
      { id: "c1", title: "Colonna avorio", kicker: "38", note: "prova", meta: "€720" },
      { id: "c2", title: "Cappotto latte", kicker: "40", note: "in sfilata", meta: "€980" },
      { id: "c3", title: "Gonna osso", kicker: "36", note: "consegnata", meta: "€410" },
    ],
    formTitle: "Nuova tela",
    cta: "Metti in prova",
  },
  {
    id: "locanda-pietra",
    name: "Locanda Pietra",
    kicker: "Ospitalità · Val d'Orcia",
    place: "pozzo della piazza",
    collection: "camere",
    brief: `${formatPrefix("app")}Locanda Pietra: prenotazioni di ospitalità, camere, reception e soggiorno in pietra.`,
    tabs: [
      { id: "reception", label: "Reception" },
      { id: "prenota", label: "Prenota" },
      { id: "camere", label: "Camere" },
      { id: "soggiorno", label: "Soggiorno" },
    ],
    rows: [
      { id: "r1", title: "Camera Pozzo", kicker: "in-house", note: "letto in pietra, finestra sul pozzo", meta: "2 notti" },
      { id: "r2", title: "Suite Olivo", kicker: "arrivo", note: "terrazza e ottone", meta: "1 notte" },
      { id: "r3", title: "Stanza Fienile", kicker: "partenza", note: "lino crudo", meta: "3 notti" },
    ],
    formTitle: "Prenota una camera",
    cta: "Conferma in reception",
  },
  {
    id: "hotel-notte",
    name: "Hotel Notte",
    kicker: "Suite · inchiostro",
    place: "champagne al check-in",
    collection: "camere",
    brief: `${formatPrefix("app")}Hotel Notte: prenotazioni di ospitalità, suite, champagne e check-in in inchiostro di hotel.`,
    tabs: [
      { id: "reception", label: "Lobby" },
      { id: "prenota", label: "Check-in" },
      { id: "camere", label: "Suite" },
      { id: "soggiorno", label: "Notte" },
    ],
    rows: [
      { id: "r1", title: "Suite Champagne", kicker: "in-house", note: "lampada oro, silenzio", meta: "2 notti" },
      { id: "r2", title: "Camera Inchiostro", kicker: "arrivo", note: "tende pesanti", meta: "1 notte" },
      { id: "r3", title: "Attico Ottone", kicker: "firma", note: "vista città", meta: "4 notti" },
    ],
    formTitle: "Apri una suite",
    cta: "Registra il check-in",
  },
  {
    id: "osteria-passo",
    name: "Osteria del Passo",
    kicker: "Cucina · Langhe",
    place: "pass della brigata",
    collection: "comande",
    brief: `${formatPrefix("app")}Osteria del Passo: ristorazione, menu degustazione, comande al passo cucina e sala da pranzo.`,
    tabs: [
      { id: "passo", label: "Passo" },
      { id: "comanda", label: "Comanda" },
      { id: "menu", label: "Menu" },
      { id: "sala", label: "Sala" },
    ],
    rows: [
      { id: "p1", title: "Plin al burro", kicker: "al-passo", note: "tavolo 4", meta: "12 min" },
      { id: "p2", title: "Brasato e polenta", kicker: "in-forno", note: "tavolo 2", meta: "18 min" },
      { id: "p3", title: "Bonet", kicker: "in-sala", note: "tavolo 7", meta: "servito" },
    ],
    formTitle: "Invia una comanda",
    cta: "Manda al passo",
  },
  {
    id: "crudo-mare",
    name: "Crudo Mare",
    kicker: "Crudo · Liguria",
    place: "marmo e agrume",
    collection: "comande",
    brief: `${formatPrefix("app")}Crudo Mare: ristorazione di crudo, marmo, agrume ed erba di mare.`,
    tabs: [
      { id: "passo", label: "Marmo" },
      { id: "comanda", label: "Ordine" },
      { id: "menu", label: "Crudi" },
      { id: "sala", label: "Banchina" },
    ],
    rows: [
      { id: "p1", title: "Ricciola agrume", kicker: "al-passo", note: "erba di mare", meta: "8 min" },
      { id: "p2", title: "Gambero crudo", kicker: "in-forno", note: "olio e sale", meta: "6 min" },
      { id: "p3", title: "Ostrica lime", kicker: "in-sala", note: "marmo freddo", meta: "servito" },
    ],
    formTitle: "Nuovo crudo",
    cta: "Metti sul marmo",
  },
  {
    id: "nord-desk",
    name: "Nord Ledger",
    kicker: "Vendite · Oslo desk",
    place: "pipeline Q3",
    collection: "righe",
    brief: `${formatPrefix("dashboard")}Nord Ledger: cruscotto vendite, kpi di vendita, pipeline vendite e ledger commerciale.`,
    tabs: [
      { id: "pipeline", label: "Pipeline" },
      { id: "nuovo", label: "Nuova riga" },
      { id: "numeri", label: "KPI" },
      { id: "rischi", label: "Rischi" },
    ],
    rows: [
      { id: "r1", title: "Halden Mill", kicker: "chiuso", note: "carta nordica", meta: "€48k" },
      { id: "r2", title: "Tromsø Light", kicker: "trattativa", note: "ottone freddo", meta: "€22k" },
      { id: "r3", title: "Bergen Dock", kicker: "scouting", note: "olio e sale", meta: "€11k" },
      { id: "r4", title: "Ålesund Yarn", kicker: "firma", note: "lana e ottone", meta: "€19k" },
      { id: "r5", title: "Kirkenes Ice", kicker: "scouting", note: "logistica nord", meta: "€9k" },
    ],
    formTitle: "Nuova opportunità",
    cta: "Registra nel ledger",
  },
  {
    id: "atelier-carta",
    name: "Atelier Carta",
    kicker: "Rivista · lastre",
    place: "studio di stampa",
    collection: "lastre",
    brief: `${formatPrefix("site")}Atelier Carta: portfolio editoriale, rivista di lastre fotografiche e rassegna di studio.`,
    tabs: [
      { id: "copertina", label: "Copertina" },
      { id: "lastre", label: "Lastre" },
      { id: "studio", label: "Studio" },
      { id: "visita", label: "Visita" },
    ],
    rows: [
      { id: "l1", title: "Lastra 07 — Pozzo", kicker: "in lastre", note: "rame e carta", meta: "ss26" },
      { id: "l2", title: "Lastra 12 — Olivo", kicker: "in studio", note: "luce nord", meta: "ss26" },
      { id: "l3", title: "Lastra 03 — Fienile", kicker: "in lastre", note: "polvere", meta: "aw25" },
    ],
    formTitle: "Scrivi alla redazione",
    cta: "Invia la visita",
  },
];

function specForBrief(brief: string): PipelineSpec | undefined {
  const exact = PIPELINE_SPECS.find((s) => s.brief === brief);
  if (exact) return exact;
  const family = familyFromBrief(brief);
  const variant = variantFromBrief(brief);
  return PIPELINE_SPECS.find((s) => {
    const t = tokensFromBrief(s.brief);
    return t.family === family && t.variant === variant;
  });
}

function synthesizeSpec(brief: string): PipelineSpec {
  const tokens = tokensFromBrief(brief);
  const grammar = grammarFromBrief(brief);
  const name = brief
    .replace(/^FORMATO:[^\n]*\n+/i, "")
    .split(/[:.]/)[0]!
    .replace(/\bkind\s*=\s*\w+/gi, "")
    .trim()
    .slice(0, 28) || "Atelier";
  return {
    id: `${tokens.family}-seed`,
    name,
    kicker: grammar.voice.census,
    place: tokens.mood.split(",")[0] || "studio",
    collection: "voci",
    brief,
    tabs: [
      { id: "home", label: "Tavolo" },
      { id: "nuovo", label: "Registra" },
      { id: "elenco", label: "Archivio" },
      { id: "studio", label: "Studio" },
    ],
    rows: [
      { id: "v1", title: `${name} uno`, kicker: grammar.voice.census, note: tokens.mood, meta: "01" },
      { id: "v2", title: `${name} due`, kicker: "in prova", note: tokens.dna, meta: "02" },
      { id: "v3", title: `${name} tre`, kicker: "aperto", note: tokens.fonts.display, meta: "03" },
    ],
    formTitle: "Nuova riga",
    cta: "Salva nel mestiere",
  };
}

function tabSvg(i: number): string {
  const paths = [
    '<path d="M8 4h8v16H8z"/><path d="M10 7h4M11 2.5h2v2h-2z"/>',
    '<path d="M5 19l7-14 7 14"/><path d="M8 13h8"/>',
    '<path d="M4 18V9l8-4 8 4v9"/><path d="M9 18v-5h6v5"/>',
    '<rect x="6" y="5" width="12" height="14" rx="2"/><path d="M9 9h6M9 13h6"/>',
  ];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${paths[i % 4]}</svg>`;
}

function phoneCss(id: GrammarId): string {
  const split =
    id === "split-stage"
      ? `.hero{min-height:42vh}.hero svg{height:42vh;min-height:220px}`
      : id === "lookbook"
        ? `.lookbook{display:grid;gap:12px}.look{overflow:hidden}.sil svg{height:180px}`
        : id === "hospitality"
          ? `.rooms{display:grid;gap:12px}.room{display:grid;grid-template-columns:96px 1fr;gap:12px}`
          : id === "service-board"
            ? `.tickets{display:grid;gap:10px}.ticket{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:center}`
            : "";
  return `${split}
.tabs{flex-shrink:0;height:calc(64px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(4,1fr);padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 92%,transparent)}
.tabs button{border:0;background:none;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:3px;font:600 10px/1.1 var(--body),sans-serif;padding:4px;min-height:44px;min-width:44px}
.tabs button.on{color:var(--accent)}
.tabs svg{width:22px;height:22px}
@media(min-width:768px){
  .app{display:grid;grid-template-columns:minmax(200px,240px) 1fr;width:100%;min-height:100dvh;height:auto;align-items:stretch}
  header{grid-column:1;flex-direction:column;align-items:flex-start;border-right:1px solid var(--line);gap:16px}
  .tabs{grid-column:1;display:flex;flex-direction:column;height:auto;border:0;border-right:1px solid var(--line);padding:16px}
  .tabs button{flex-direction:row;font-size:13px;min-height:44px;gap:10px;justify-content:flex-start}
  main{grid-column:2;grid-row:1 / span 2;padding:24px 28px}
  .hero{min-height:36vh}
  .hero svg{height:36vh;min-height:240px}
  .lookbook{grid-template-columns:repeat(2,1fr)}
  .rooms,.tickets{grid-template-columns:1fr}
}
@media(min-width:1024px){
  .app{grid-template-columns:minmax(220px,260px) 1fr}
  main{padding:28px 40px;display:grid;grid-template-columns:minmax(280px,.9fr) minmax(320px,1.1fr);gap:22px;align-content:start}
  .hero{grid-column:1;grid-row:1 / span 20;min-height:64vh;margin:0}
  .hero svg{height:100%;min-height:64vh}
  .span,.card,.lookbook,.rooms,.tickets,.day,.fragrance,.plate{grid-column:2}
  .lookbook{grid-template-columns:repeat(3,1fr);grid-column:2}
}`;
}

function deskCss(id: GrammarId): string {
  if (id === "magazine") {
    return `.mast{display:flex;justify-content:space-between;align-items:end;gap:24px;padding:28px 40px 18px;border-bottom:1px solid var(--line)}
.rail{display:flex;gap:8px;flex-wrap:wrap;padding:0 40px 18px}
.rail button{border:1px solid var(--line);background:var(--surface);color:var(--fg);min-height:44px;padding:10px 16px;border-radius:0;font:650 13px/1 var(--body),sans-serif}
.rail button.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.lastre{display:grid;grid-template-columns:1fr;gap:16px}
.plate{min-height:220px;overflow:hidden}
.plate svg{height:220px}
footer{padding:24px 40px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media(min-width:768px){.lastre{grid-template-columns:1.4fr 1fr}.plate svg{height:280px}}
@media(min-width:1024px){main{padding:28px 40px}.lastre{grid-template-columns:1.4fr 1fr;gap:28px}.hero svg,.plate svg{min-height:320px;height:42vh}}`;
  }
  return `.app[data-fenix-craft-desk]{display:grid;grid-template-columns:1fr;min-height:100dvh;height:auto}
.rail{display:flex;gap:8px;overflow:auto;padding:10px 16px;border-bottom:1px solid var(--line)}
.rail button{border:0;background:none;color:var(--muted);min-height:44px;padding:8px 12px;font:650 13px/1 var(--body),sans-serif;white-space:nowrap}
.rail button.on{color:var(--accent)}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 16px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;min-height:92px}
.kpi b{display:block;font-family:var(--display);font-size:1.7rem;letter-spacing:-.03em}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line)}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);font-size:14px}
th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.board{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 18px}
@media(min-width:768px){
  .app[data-fenix-craft-desk]{grid-template-columns:minmax(200px,240px) 1fr}
  header{border-right:1px solid var(--line);flex-direction:column;align-items:flex-start}
  .rail{grid-column:1;flex-direction:column;border:0;border-right:1px solid var(--line);padding:16px}
  main{grid-column:2;grid-row:1 / span 2;padding:24px 28px}
  .kpis{grid-template-columns:repeat(4,1fr)}
  .board{grid-template-columns:repeat(4,1fr)}
  .ops-hero{min-height:28vh}
  .ops-hero svg{height:28vh;min-height:160px}
}
@media(min-width:1024px){main{padding:28px 40px}}`;
}

function visualKitCss(t: DesignTokens, grammar: LayoutGrammar): string {
  const desk = grammar.chrome !== "tabs";
  return `.toast,.state-load,.state-err{position:fixed;left:16px;right:16px;bottom:calc(80px + env(safe-area-inset-bottom));padding:12px 14px;border-radius:var(--r);background:var(--elevated);border:1px solid var(--line);z-index:30;box-shadow:0 18px 40px color-mix(in srgb,var(--fg) 16%,transparent)}
.state-load[hidden],.toast[hidden],.state-err[hidden]{display:none}
.state-empty{padding:36px 16px;color:var(--muted);text-align:center;border:1px dashed var(--line);border-radius:var(--r)}
.state-empty:before{content:"";display:block;width:40px;height:40px;margin:0 auto 12px;border:1.5px dashed var(--line);border-radius:50%}
.btn{appearance:none;border:0;cursor:pointer;font:650 14px/1 var(--body),system-ui,sans-serif;border-radius:999px;padding:12px 18px;background:var(--accent);color:var(--accent-ink);min-height:44px;min-width:44px;letter-spacing:.01em}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn.sm{padding:8px 12px;min-height:40px;font-size:13px}
label{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}
input,select,textarea{width:100%;font:inherit;padding:12px 14px;border-radius:calc(var(--r) * .55);border:1px solid var(--line);background:var(--elevated);color:var(--fg);min-height:44px}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pill,.chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;border:1px solid var(--line);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.chip.ok,.chip.chiuso,.chip.in-house,.chip.al-passo{color:var(--success);border-color:color-mix(in srgb,var(--success) 45%,var(--line))}
.chip.wait,.chip.trattativa,.chip.firma,.chip.in-cottura,.chip.in-forno{color:var(--warning);border-color:color-mix(in srgb,var(--warning) 45%,var(--line))}
.notes{color:var(--muted);font-size:14px;line-height:1.45}
.kicker{color:var(--muted);font-size:11px;letter-spacing:.16em;text-transform:uppercase}
.spark{display:flex;gap:3px;align-items:flex-end;height:28px;margin-top:10px}
.spark i{display:block;width:7px;border-radius:2px 2px 0 0;background:var(--accent)}
.board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.lane{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px;min-height:188px}
.lane > .kicker{margin-bottom:10px;display:flex;justify-content:space-between;gap:8px}
.deal{background:var(--elevated);border:1px solid var(--line);border-radius:calc(var(--r) * .7);padding:12px 14px;margin:0 0 10px}
.deal h2{font-family:var(--display);font-size:1.12rem;margin:0 0 4px;letter-spacing:-.03em;line-height:1.15}
.ops-hero svg{height:148px}
.thumb{width:56px;height:56px;border-radius:calc(var(--r) * .45);overflow:hidden;border:1px solid var(--line);background:var(--elevated);flex-shrink:0}
.thumb svg{width:56px;height:56px;display:block}
.fragrance{display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:start}
@media(prefers-reduced-motion:no-preference){
  .btn,.card,.look,.slot,.ticket,.room,.plate,.deal{transition:transform .2s ease, box-shadow .2s ease}
  .btn:hover,.deal:hover,.look:hover{transform:translateY(-1px)}
  .hero svg,.sil svg,.plate svg{animation:fenix-breathe 12s ease-in-out infinite}
  @keyframes fenix-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.012)}}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
${desk ? deskCss(grammar.id) : phoneCss(grammar.id)}
/* ${t.family}/${t.variant} */`;
}

function jsRows(rows: PipelineRow[]): string {
  return rows
    .map(
      (r) =>
        `{id:${JSON.stringify(r.id)},title:${JSON.stringify(r.title)},kicker:${JSON.stringify(r.kicker)},note:${JSON.stringify(r.note)},meta:${JSON.stringify(r.meta)}}`,
    )
    .join(",");
}

function productHtml(spec: PipelineSpec, tokens: DesignTokens, grammar: LayoutGrammar): string {
  const p = tokens.palette;
  const scheme = Number.parseInt(p.bg.slice(1, 3), 16) < 80 ? "dark" : "light";
  const alt = altForBrief(spec.brief);
  const hero = domainIllustration(tokens.family, tokens.variant, alt, 0);
  const cards = spec.rows.map((_, i) => domainIllustration(tokens.family, tokens.variant, alt, i + 1));
  const desk = grammar.chrome !== "tabs";
  const homeView = spec.tabs[0]!.id;
  const deskAttr = desk ? ` data-fenix-craft-desk${grammar.kind === "dashboard" ? " data-fenix-crud" : ""}` : "";
  const navClass = desk ? (grammar.chrome === "masthead" ? "rail" : "rail") : "tabs";
  const headerExtra = grammar.chrome === "masthead" ? " mast" : "";
  const navButtons = spec.tabs
    .map(
      (tab, i) =>
        `  <button type="button" data-view="${tab.id}"${i === 0 ? ' class="on"' : ""}>${tabSvg(i)}<span>${tab.label}</span></button>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="it"${desk ? ' data-fenix-craft-desk' : ""}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="color-scheme" content="${scheme}"/>
<title>${spec.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="${tokens.fonts.href}" rel="stylesheet"/>
<style>
:root{color-scheme:${scheme};--bg:${p.bg};--surface:${p.surface};--elevated:${p.elevated};--fg:${p.fg};--muted:${p.muted};--accent:${p.accent};--line:${p.line};--accent-ink:${p.accentInk};--success:${p.success};--warning:${p.warning};--r:${tokens.radius};--display:"${tokens.fonts.display}",Georgia,serif;--body:"${tokens.fonts.body}",system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--fg);font:400 ${tokens.type.body}/1.45 var(--body),system-ui,sans-serif}
body{min-height:100dvh}
.app{min-height:100dvh;display:flex;flex-direction:column;width:100%}
header{padding:16px 18px 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.brand{font-family:var(--display);font-size:${tokens.type.h1};font-weight:650;letter-spacing:-.03em;line-height:1.1}
header p{color:var(--muted);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
main{flex:1;min-height:0;overflow-y:auto;padding:8px 16px 24px;-webkit-overflow-scrolling:touch}
.hero,.sil,.plate,.ops-hero{position:relative;border-radius:var(--r);overflow:hidden;margin-bottom:14px;border:1px solid var(--line);background:var(--elevated);min-height:200px}
.hero svg,.sil svg,.plate svg,.ops-hero svg{width:100%;height:220px;display:block}
.card,.slot,.ticket,.room,.look,.kpi,.measure{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:12px}
.card h2,.look h2,.slot h2,.ticket h2,.room h2,.deal h2,.plate h2{font-family:var(--display);font-size:1.25rem;font-weight:600;margin:0 0 4px;letter-spacing:-.03em}
.look{padding:0;overflow:hidden}
.look h2,.look p{padding:0 14px}
.look p{padding-bottom:14px}
${visualKitCss(tokens, grammar)}
</style>
</head>
<body>
<div class="app"${deskAttr}>
<header class="${headerExtra.trim()}">
  <div>
    <p>${spec.kicker}</p>
    <h1 class="brand">${spec.name}</h1>
  </div>
  <p>${spec.place}</p>
</header>
<nav class="${navClass}" id="tabs" aria-label="Navigazione">
${navButtons}
</nav>
<main id="root"><div class="hero">${hero}</div></main>
${grammar.chrome === "masthead" ? `<footer>Atelier Carta · lastre originali · niente stock</footer>` : ""}
</div>
<div class="toast" id="toast" hidden>${grammar.voice.ok}</div>
<div class="state-load" id="load" hidden>${grammar.voice.load}</div>
<div class="state-err" id="err" hidden>${grammar.voice.err}</div>
<script>
const COL=${JSON.stringify(spec.collection)};
const defaultData={items:[${jsRows(spec.rows)}]};
let data=structuredClone(defaultData);
let view=${JSON.stringify(homeView)};
const arts=${JSON.stringify(cards)};
const hero=${JSON.stringify(hero)};
const tabDefs=${JSON.stringify(spec.tabs)};
const glyphs=${JSON.stringify(spec.tabs.map((_, i) => tabSvg(i)))};
const grammarId=${JSON.stringify(grammar.id)};
const emptyVoice=${JSON.stringify(grammar.voice.empty)};
const census=${JSON.stringify(grammar.voice.census)};
const formTitle=${JSON.stringify(spec.formTitle)};
const cta=${JSON.stringify(spec.cta)};
const kicker=${JSON.stringify(spec.kicker)};
const place=${JSON.stringify(spec.place)};
function save(){ if(window.Fenix) void window.Fenix.save(COL, data); }
function ping(ok){
  var n=document.getElementById(ok?"toast":"err");
  if(!n) return;
  n.hidden=false;
  setTimeout(function(){ n.hidden=true; }, 1600);
}
function renderTabs(){
  var nav=document.getElementById("tabs");
  nav.innerHTML=tabDefs.map(function(t,i){
    return '<button type="button" data-view="'+t.id+'" class="'+(view===t.id?"on":"")+'">'+glyphs[i]+"<span>"+t.label+"</span></button>";
  }).join("");
}
function emptyBox(){ return '<p class="state-empty">'+emptyVoice+"</p>"; }
function chip(k){ return '<span class="chip '+k+'">'+k+"</span>"; }
function renderPerfume(){
  var html='<div class="hero">'+hero+"</div>";
  html+='<div class="card span"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2><p class=\\"notes\\">"+place+". Flacone in luce, note in pagina, guardaroba persistito.</p></div>";
  if(!data.items.length) return html+emptyBox();
  data.items.forEach(function(e,i){
    html+='<article class="card fragrance" data-id="'+e.id+'"><div class="thumb">'+(arts[i%arts.length]||hero)+'</div><div><p class="kicker">'+e.kicker+"</p><h2>"+e.title+'</h2><p class="notes">'+e.note+'</p><div class="row" style="display:flex;justify-content:space-between;gap:8px;margin-top:8px"><span>'+e.meta+'</span><button class="btn sm ghost" data-act="wear" data-id="'+e.id+'">Tieni a portata</button></div></div></article>';
  });
  return html;
}
function renderLookbook(){
  var html='<div class="hero">'+hero+"</div>";
  html+='<div class="card span"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2><p class=\\"notes\\">Lastre di sfilata, non magazzino.</p></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="lookbook">';
  data.items.forEach(function(e,i){
    html+='<article class="look" data-id="'+e.id+'"><div class="sil">'+(arts[i%arts.length]||hero)+"</div><h2>"+e.title+"</h2><p>"+e.kicker+" · "+e.note+" · "+e.meta+"</p></article>";
  });
  return html+"</div>";
}
function renderRooms(){
  var html='<div class="hero">'+hero+"</div>";
  html+='<div class="card span"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2><p class=\\"notes\\">"+place+". Binario arrivi, non lista magazzino.</p></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="rooms">';
  data.items.forEach(function(e,i){
    html+='<article class="room" data-id="'+e.id+'"><div class="thumb">'+(arts[i%arts.length]||hero)+"</div><div><p>"+chip(e.kicker)+"</p><h2>"+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+'</p><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Chiudi soggiorno</button></div></article>';
  });
  return html+"</div>";
}
function renderTickets(){
  var html='<div class="hero plate">'+hero+"</div>";
  html+='<div class="card span"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2><p class=\\"notes\\">Pass della brigata. Piatto in luce, ticket al passo.</p></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="tickets">';
  data.items.forEach(function(e){
    html+='<article class="ticket" data-id="'+e.id+'"><time>'+e.meta+"</time><div><h2>"+e.title+'</h2><p class="notes">'+e.note+"</p></div>"+chip(e.kicker)+"</article>";
  });
  return html+"</div>";
}
function spark(){
  return '<span class="spark" aria-hidden="true"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:90%"></i><i style="height:62%"></i></span>';
}
function renderDesk(){
  var open=data.items.filter(function(x){return !/chiuso|pronto/.test(x.kicker);}).length;
  var html='<div class="ops-hero">'+hero+"</div>";
  html+='<div class="kpis">';
  html+='<div class="kpi"><span class="kicker">Voci</span><b>'+data.items.length+"</b>"+spark()+"</div>";
  html+='<div class="kpi"><span class="kicker">Aperte</span><b>'+open+"</b>"+spark()+"</div>";
  html+='<div class="kpi"><span class="kicker">Chiuso</span><b>'+(data.items.length-open)+"</b>"+spark()+"</div>";
  html+='<div class="kpi"><span class="kicker">Luogo</span><b>'+place+"</b></div></div>";
  var lanes=["scouting","trattativa","firma","chiuso"];
  html+='<div class="board" role="list">';
  lanes.forEach(function(lane){
    var rows=data.items.filter(function(x){return x.kicker===lane;});
    html+='<div class="lane"><p class="kicker">'+lane+" <span>"+rows.length+'</span></p>';
    rows.forEach(function(e){
      html+='<article class="deal" data-id="'+e.id+'"><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></article>";
    });
    html+="</div>";
  });
  html+="</div><table><thead><tr><th>Nome</th><th>Stato</th><th>Nota</th><th>Meta</th></tr></thead><tbody>";
  data.items.forEach(function(e){
    html+='<tr data-id="'+e.id+'"><td>'+e.title+"</td><td>"+chip(e.kicker)+"</td><td>"+e.note+"</td><td>"+e.meta+"</td></tr>";
  });
  html+="</tbody></table>";
  if(!data.items.length) html+=emptyBox();
  return html;
}
function renderMagazine(){
  var html='<section id="copertina"><div class="hero">'+hero+'</div><div class="card span"><p class="kicker">'+kicker+"</p><h2>"+specName()+" in lastre</h2><p class=\\"notes\\">Rivista di lastre fotografiche. Niente stock, niente telefono boxed.</p></div></section>";
  html+='<section id="lastre" class="lastre">';
  data.items.forEach(function(e,i){
    html+='<article class="plate card" data-id="'+e.id+'">'+(arts[i%arts.length]||hero)+"<h2>"+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></article>";
  });
  html+="</section>";
  html+='<section id="studio" class="card span"><p class="kicker">Studio</p><h2>'+data.items.length+" lastre in fascicolo</h2><p class=\\"notes\\">"+place+"</p></section>";
  html+=renderForm();
  if(!data.items.length) html+=emptyBox();
  return html;
}
function specName(){ return ${JSON.stringify(spec.name)}; }
function renderForm(){
  return '<section class="card span" data-fenix-crud><p class="kicker">Nuovo</p><h2>'+formTitle+'</h2><form id="fnew"><label for="n">Nome</label><input class="field" id="n" name="n" required placeholder="Nome"><label for="k">Dettaglio</label><input class="field" id="k" name="k" placeholder="stato, taglia, ora"><label for="note">Nota</label><input class="field" id="note" name="note" placeholder="materia"><button class="btn" type="submit" style="margin-top:14px;width:100%">'+cta+"</button></form></section>";
}
function renderList(){
  var html='<div class="card span"><p class="kicker">Archivio</p><h2>'+data.items.length+" voci</h2></div>";
  if(!data.items.length) html+=emptyBox();
  data.items.forEach(function(e){
    html+='<div class="card" data-id="'+e.id+'"><div style="display:flex;justify-content:space-between;gap:8px"><h2>'+e.title+'</h2><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Archivia</button></div><p class="notes">'+e.note+" · "+e.meta+"</p></div>";
  });
  return html;
}
function renderStats(){
  return '<div class="hero">'+hero+'</div><div class="card span"><p class="kicker">Studio</p><h2>'+data.items.length+" "+census+'</h2><p class="notes">'+place+"</p></div>";
}
function renderHome(){
  if(grammarId==="lookbook") return renderLookbook();
  if(grammarId==="hospitality") return renderRooms();
  if(grammarId==="service-board") return renderTickets();
  if(grammarId==="ops-desk") return renderDesk();
  if(grammarId==="magazine") return renderMagazine();
  return renderPerfume();
}
function render(){
  renderTabs();
  var root=document.getElementById("root");
  var id=view;
  if(id===tabDefs[0].id) root.innerHTML=renderHome();
  else if(id===tabDefs[1].id) root.innerHTML=renderForm();
  else if(id===tabDefs[2].id) root.innerHTML=grammarId==="ops-desk"?renderDesk():renderList();
  else root.innerHTML=grammarId==="magazine"?renderForm():renderStats();
}
document.getElementById("tabs").addEventListener("click",function(e){
  var b=e.target.closest("[data-view]"); if(!b) return; view=b.getAttribute("data-view"); render();
});
document.getElementById("root").addEventListener("click",function(e){
  var b=e.target.closest("[data-act]"); if(!b) return;
  var id=b.getAttribute("data-id");
  if(b.getAttribute("data-act")==="del"){ data.items=data.items.filter(function(x){return x.id!==id;}); save(); ping(true); render(); }
  if(b.getAttribute("data-act")==="wear"){ var row=data.items.find(function(x){return x.id===id;}); if(row){ data.items=[row].concat(data.items.filter(function(x){return x.id!==id;})); save(); ping(true); view=tabDefs[2].id; render(); } }
});
document.getElementById("root").addEventListener("submit",function(e){
  e.preventDefault();
  var f=e.target;
  if(f.id!=="fnew") return;
  var nome=(f.n.value||"").trim(); if(!nome) return;
  data.items.unshift({id:"n"+Date.now(),title:nome,kicker:(f.k.value||"").trim()||census,note:(f.note.value||"").trim()||"—",meta:"nuovo"});
  f.reset(); save(); ping(true); view=tabDefs[0].id; render();
});
function markReady(){ document.documentElement.setAttribute("data-fenix-ready","1"); }
async function boot(){
  var load=document.getElementById("load");
  if(load) load.hidden=false;
  try{ if(window.Fenix&&window.Fenix.load){ var r=await window.Fenix.load(COL); if(r&&typeof r==="object"&&Array.isArray(r.items)) data=r; } }catch(err){ var box=document.getElementById("err"); if(box) box.hidden=false; }
  if(load) load.hidden=true;
  render(); markReady();
}
boot();
setTimeout(function(){ if(!document.documentElement.getAttribute("data-fenix-ready")) { render(); markReady(); } }, 500);
</script>
</body>
</html>`;
}

function polishFor(tokens: DesignTokens, grammar: LayoutGrammar): string {
  const chrome =
    grammar.chrome === "desk"
      ? DASHBOARD_POLISH_INSTRUCTION
      : grammar.chrome === "masthead"
        ? SITE_POLISH_INSTRUCTION
        : "Mantieni chrome di mestiere e tab dal brief. Vietato Ciao/Operatore e tab Home/Nuovo/Elenco.";
  return [
    tokensInstruction(tokens),
    grammarInstruction(grammar),
    chrome,
    "Il seed HTML è già il prodotto. Rifinisci copy se serve, non riciclare lo scheletro telefono, non boxed 1080, non placeholder geometrici.",
    "Stati empty/loading/success/error visibili. Motion solo con prefers-reduced-motion: no-preference. Target ≥24px, focus visibile, AA.",
  ].join("\n");
}

export function composeProduct(brief: string): ComposedProduct {
  const tokens = tokensFromBrief(brief);
  const grammar = grammarFromBrief(brief);
  const spec = specForBrief(brief);
  const used = spec || synthesizeSpec(brief);
  const html = productHtml(used, tokens, grammar);
  return {
    brief,
    tokens,
    grammar,
    spec,
    html,
    polish: polishFor(tokens, grammar),
    files: [{ path: "index.html", content: html }],
  };
}

export function seedHtmlForBrief(brief: string): string {
  return composeProduct(brief).html;
}

export function runGraphicPipeline(brief: string): GraphicPipelineRun {
  const plan = planContract(brief);
  const composed = composeProduct(brief);
  const qa = auditGraphicQuality(composed.html, { brief, kind: plan.kind });
  return {
    brief,
    tokens: composed.tokens,
    grammar: composed.grammar,
    plan,
    generated: {
      contract: plan,
      spec: composed.spec ? { id: composed.spec.id } : undefined,
      html: composed.html,
      files: composed.files,
    },
    qa,
  };
}

export function loadPipelineFixtures(): PipelineFixture[] {
  return PIPELINE_SPECS.map((spec) => {
    const composed = composeProduct(spec.brief);
    return {
      id: spec.id,
      html: composed.html,
      brief: spec.brief,
      kind: composed.grammar.kind,
      palette: composed.tokens.palette,
      grammar: composed.grammar.id,
    };
  });
}
