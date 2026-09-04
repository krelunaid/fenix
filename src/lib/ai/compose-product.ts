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
  type TokenOptions,
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
import { craftNavIcon } from "../projects/craft-icons.ts";
import type { Palette, ProjectKind } from "../projects/types.ts";

export type PipelineRow = {
  id: string;
  title: string;
  kicker: string;
  note: string;
  meta: string;
  status?: string;
  dayOffset?: number;
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

/** Parent SHA of the five-brief before/after. Frozen 6a3dd1c baseline, not a quality score. */
export const GRAPHIC_FIVE_PARENT_SHA = "6a3dd1c135de83345e7ae77ec170767cf16988a5";

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
      { id: "e4", title: "Pelle di Sera", kicker: "cuoiata", note: "zafferano, pelle, fumo", meta: "50 ml" },
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
      { id: "e4", title: "Vetro di Molo", kicker: "salina", note: "sale, ghiaccio, muschio", meta: "50 ml" },
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
      { id: "c1", title: "Cappotto latte", kicker: "40", note: "in sfilata", meta: "€980" },
      { id: "c2", title: "Colonna avorio", kicker: "38", note: "prova", meta: "€720" },
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
      { id: "r4", title: "Camera Salice", kicker: "arrivo", note: "sponda e canne", meta: "2 notti" },
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
      { id: "r4", title: "Suite Silenzio", kicker: "partenza", note: "tappeto e ottone", meta: "1 notte" },
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
      { id: "p4", title: "Tajarin 40 tuorli", kicker: "al-passo", note: "tavolo 9", meta: "9 min" },
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
      { id: "p4", title: "Tonno sale", kicker: "in-sala", note: "agrumi", meta: "servito" },
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
  if (tokens.family === "repo" || grammar.id === "source-timeline") {
    return {
      id: `${tokens.family}-seed`,
      name,
      kicker: grammar.voice.census,
      place: tokens.mood.split(",")[0] || "linea",
      collection: "voci",
      brief,
      tabs: [
        { id: "attivita", label: "Attività" },
        { id: "rami", label: "Rami" },
        { id: "sync", label: "Sync" },
        { id: "scarto", label: "Scarto" },
      ],
      rows: [
        { id: "v1", title: "Allinea il nastro delle voci", kicker: "main", note: "a3f1c2 · Marta", meta: "allineato" },
        { id: "v2", title: "Chiude lo scarto sul parser", kicker: "feat/sync", note: "9b2e18 · Leo", meta: "in-volo" },
        { id: "v3", title: "Riduce il rumore sul diff", kicker: "fix/nastro", note: "c8d044 · Noa", meta: "in-attesa" },
        { id: "v4", title: `${name} in linea`, kicker: "main", note: "11ae90 · voce", meta: "allineato" },
      ],
      formTitle: "Registra una voce",
      cta: "Metti in linea",
    };
  }
  if (grammar.id === "agenda" || tokens.family === "booking") {
    const clinical = /clinic|medic|pazient|terap|ospedal|dentist/.test(brief);
    const place = clinical ? "Studio" : /lino|tessile|tessuto/.test(brief) ? "Atelier" : "Sala";
    return {
      id: `${tokens.family}-agenda`,
      name,
      kicker: `Oggi · ${place}`,
      place,
      collection: "slot",
      brief,
      tabs: [
        { id: "oggi", label: "Oggi" },
        { id: "nuovo", label: "Nuovo" },
        { id: "settimana", label: "Settimana" },
        { id: "archivio", label: "Archivio" },
      ],
      rows: clinical
        ? [
            { id: "s1", title: "Prima visita", kicker: "09:30", note: "Studio 1 · Marta", meta: "45 min", status: "prenotato", dayOffset: 0 },
            { id: "s2", title: "Controllo", kicker: "11:00", note: "Studio 2 · Leo", meta: "30 min", status: "confermato", dayOffset: 0 },
            { id: "s3", title: "Terapia", kicker: "14:30", note: "Ambulatorio · Noa", meta: "60 min", status: "in-corso", dayOffset: 0 },
            { id: "s4", title: "Referto", kicker: "17:00", note: "Accoglienza", meta: "20 min", status: "prenotato", dayOffset: 1 },
          ]
        : [
            { id: "s1", title: "Taglio e piega", kicker: "09:30", note: `${place} · Marta`, meta: "45 min", status: "prenotato", dayOffset: 0 },
            { id: "s2", title: "Colore", kicker: "11:00", note: "Poltrona 2 · Leo", meta: "90 min", status: "confermato", dayOffset: 0 },
            { id: "s3", title: "Trattamento", kicker: "14:30", note: "Sala nord · Noa", meta: "60 min", status: "in-corso", dayOffset: 0 },
            { id: "s4", title: "Consulenza", kicker: "17:00", note: "Accoglienza", meta: "20 min", status: "prenotato", dayOffset: 1 },
          ],
      formTitle: "Nuovo slot",
      cta: "Metti in agenda",
    };
  }
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

function agendaRailMarkup(spec: PipelineSpec, grammar: LayoutGrammar): string {
  const slots = spec.rows
    .map((e, i) => {
      const state = i === 0 ? "on" : "idle";
      const status = e.status || "prenotato";
      return `<article class="slot" data-id="${e.id}" data-state="${state}" data-status="${status}"><time class="time" datetime="${e.kicker}">${e.kicker}</time><div class="slot-body"><h2>${e.title}</h2><p class="notes"><span class="chip ${status}">${status}</span> · ${e.note} · ${e.meta}</p><div class="slot-actions"><button class="btn sm ghost" data-act="advance" data-id="${e.id}" aria-label="Avanza stato ${status}">Avanza slot</button><button class="btn sm ghost" data-act="edit" data-id="${e.id}">Modifica</button><button class="btn sm ghost" data-act="del" data-id="${e.id}">Archivia</button></div></div></article>`;
    })
    .join("");
  return `<div class="day-head"><p class="kicker">${spec.kicker}</p><h2 id="day-label">${spec.rows.length} ${grammar.voice.census}</h2></div><div class="day-rail" data-fenix-rail="day" id="day-rail" role="tabpanel" aria-labelledby="day-label">${slots}</div>`;
}

function tabSvg(tab: { id: string; label: string }, i: number): string {
  return craftNavIcon(tab, i);
}

function typeRampCss(t: DesignTokens): string {
  const h2 =
    t.family === "editorial"
      ? "clamp(1.35rem, 3vw, 2.05rem)"
      : t.family === "ops" || t.family === "repo"
        ? "1.08rem"
        : t.family === "fashion" || t.family === "perfume"
          ? "clamp(1.22rem, 2.4vw, 1.7rem)"
          : t.family === "booking"
            ? "var(--t-headline)"
            : "clamp(1.18rem, 2.2vw, 1.55rem)";
  return `.brand{font-size:var(--t-h1);color:var(--ink-loud);letter-spacing:-.03em;font-weight:700}
.card h2,.look h2,.slot h2,.ticket h2,.room h2,.deal h2,.plate h2,.fragrance h2,.commit h2{font-size:var(--t-h2,${h2});color:var(--ink-loud);font-weight:650;letter-spacing:-.022em}
.notes,.look p,.room .notes,.ticket .notes,.fragrance .notes,.commit .notes{color:var(--ink-quiet);font-size:var(--t-footnote);line-height:1.35}
.kicker{color:var(--muted)}
.hero .caption h2,.plate.hero .caption h2,.day-head h2{font-size:var(--t-large);color:var(--ink-loud);letter-spacing:-.03em;font-weight:700;line-height:1.15}`;
}

function kickerCss(t: DesignTokens): string {
  if (t.family === "ops" || t.family === "repo" || t.family === "booking") {
    return `.kicker,header .place{font-size:var(--t-caption);letter-spacing:.02em;text-transform:none;font-variant-numeric:tabular-nums;color:var(--muted)}`;
  }
  if (t.family === "food" || t.family === "hospitality") {
    return `.kicker,header .place{font-size:13px;letter-spacing:.01em;text-transform:none;color:var(--muted)}`;
  }
  return `.kicker,header .place{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}`;
}

function isOperationalApp(t: DesignTokens): boolean {
  return t.family === "booking" && t.variant === 0;
}

function displayStack(t: DesignTokens): string {
  if (t.family === "repo" || t.family === "ops") {
    return `"${t.fonts.display}",ui-monospace,"IBM Plex Mono",Menlo,monospace`;
  }
  if (isOperationalApp(t) || t.family === "utility") {
    return `"${t.fonts.display}",ui-sans-serif,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
  }
  if (
    t.family === "perfume" ||
    t.family === "fashion" ||
    t.family === "food" ||
    t.family === "editorial" ||
    t.family === "hospitality" ||
    t.family === "ceramic" ||
    t.family === "paper" ||
    (t.family === "booking" && t.variant === 1)
  ) {
    return `"${t.fonts.display}",ui-serif,Georgia,"Times New Roman",serif`;
  }
  return `"${t.fonts.display}",ui-sans-serif,system-ui,sans-serif`;
}

function familyChromeCss(t: DesignTokens, grammar: LayoutGrammar): string {
  const operational = isOperationalApp(t);
  const brand = operational
    ? `.brand{font-weight:700;letter-spacing:-.028em}`
    : t.family === "perfume"
      ? `.brand{font-style:italic;font-weight:600;letter-spacing:-.035em}`
      : t.family === "fashion"
        ? `.brand{letter-spacing:-.05em;text-transform:uppercase;font-size:clamp(1.35rem,5.4vw,2rem);font-weight:700}`
        : t.family === "food"
          ? `.brand{font-weight:700;letter-spacing:-.028em}`
          : t.family === "repo"
            ? `.brand{font-family:${displayStack(t)};letter-spacing:0;font-size:clamp(1.05rem,2.4vw,1.35rem);font-weight:600}`
            : t.family === "booking"
              ? `.brand{font-weight:650;letter-spacing:-.03em}`
              : "";
  const nav = operational
    ? `nav.tabs{border-top:1px solid var(--line);background:var(--surface)}
nav.tabs button.on{color:var(--accent);background:transparent}
header{background:var(--surface)}
.week-day.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.week-day.on .kicker,.week-day.on .count{color:var(--accent-ink)}`
    : grammar.chrome === "tabs"
      ? `nav.tabs{border-top:2px solid var(--accent);background:var(--surface)}
nav.tabs button.on{color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);border-radius:calc(var(--r) * .4)}`
      : `nav.rail button.on{color:var(--accent)}`;
  const matter =
    t.family === "food"
      ? `.ticket{border-left:4px solid var(--accent)}`
      : t.family === "fashion"
        ? `.look,.btn,nav.tabs button.on{border-radius:0}`
        : t.family === "perfume"
          ? `.fragrance{border-radius:calc(var(--r) * .65)}`
          : t.family === "repo"
            ? `.commit .sha{font-family:${displayStack(t)}}`
            : "";
  const rail = operational
    ? `html[data-family]::before{content:"";position:fixed;top:0;left:0;right:0;height:0;background:transparent;z-index:50;pointer-events:none}`
    : `html[data-family]::before{content:"";position:fixed;top:0;left:0;right:0;height:3px;background:var(--accent);z-index:50;pointer-events:none}`;
  return `/* family-chrome ${t.family}/${grammar.id} */
${rail}
${brand}
${nav}
${matter}`;
}

function phoneCss(id: GrammarId): string {
  const stage =
    id === "split-stage"
      ? `.hero{min-height:38vh}.hero svg{height:38vh;min-height:220px}.fragrance{display:grid;grid-template-columns:88px 1fr;gap:14px}.thumb{width:88px;height:112px;border-radius:calc(var(--r) * .5);overflow:hidden}.thumb svg{width:88px;height:112px}`
      : id === "lookbook"
        ? `.lookbook{display:grid;gap:12px}.look{overflow:hidden;padding:0;display:flex;flex-direction:column;margin:0}
  .look .sil{position:relative;height:min(54vh,460px);min-height:280px;margin:0}
  .look .sil svg{position:absolute;inset:0;width:100%;height:100%;display:block}
  .look h2,.look p{flex:0 0 auto}`
        : id === "hospitality"
          ? `.rooms{display:grid;gap:14px}.room{display:grid;grid-template-columns:120px 1fr;gap:14px}.room .thumb{width:120px;height:96px}.room .thumb svg{width:120px;height:96px}.hero{min-height:24vh;max-height:28vh}.hero svg{height:24vh;min-height:140px}`
          : id === "service-board"
            ? `.hero,.hero.plate{min-height:42vh}.hero svg,.plate.hero svg{height:42vh;min-height:260px;width:100%}
  .tickets{display:grid;gap:10px}.ticket{display:grid;grid-template-columns:96px 1fr auto;gap:12px;align-items:center;min-height:88px}
  .ticket .thumb{width:96px;height:80px;overflow:hidden;position:relative;border-radius:calc(var(--r) * .4)}
  .ticket .thumb svg{width:96px;height:80px;display:block}`
            : id === "pocket-tool"
              ? `.hero{min-height:22vh;max-height:26vh}.hero svg{height:22vh;min-height:120px;width:100%}
  .ticket{display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;min-height:76px}
  .ticket .thumb{width:72px;height:56px;overflow:hidden}
  .ticket .thumb svg{width:72px;height:56px;display:block}`
            : id === "agenda"
              ? `.hero{display:none;min-height:0;height:0;margin:0;border:0}
  .day-head{padding:2px 0 10px}
  .day-head h2{font-family:var(--body),ui-sans-serif,system-ui,sans-serif;font-size:var(--t-large);font-weight:700;letter-spacing:-.03em;line-height:1.12;color:var(--ink-loud)}
  .day-rail{display:flex;flex-direction:column;gap:8px}
  .slot{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;align-items:start;padding:14px 16px;margin:0;border:1px solid var(--line);border-radius:calc(var(--r) * .45);background:var(--surface);min-height:72px;box-shadow:inset 3px 0 0 var(--accent)}
  .slot[data-state="on"]{border-color:var(--accent)}
  .slot .time{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";font-size:var(--t-footnote);font-weight:700;color:var(--accent);padding-top:3px;letter-spacing:-.01em}
  .slot-body h2{font-family:var(--body),ui-sans-serif,system-ui,sans-serif;font-size:var(--t-headline);font-weight:650;letter-spacing:-.022em;margin:0 0 4px;line-height:1.2;color:var(--ink-loud)}
  .slot-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .slot .btn{margin-top:0}
  .week-strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:0 0 14px}
  .week-day{appearance:none;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:calc(var(--r) * .55);min-height:64px;min-width:0;padding:6px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:650 11px/1.1 var(--body),ui-sans-serif,system-ui,sans-serif;touch-action:manipulation}
  .week-day.on{border-color:var(--accent);color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
  .week-day b{font-size:var(--t-headline);letter-spacing:-.02em}
  .week-day .count{font-size:10px;color:var(--muted);font-weight:650}
  .week-day.on .count{color:var(--accent)}
  .week-nav{display:flex;align-items:center;gap:6px;margin:0 0 10px}
  .week-nav .week-range{flex:1;text-align:center;font:650 12px/1.3 var(--body),ui-sans-serif,system-ui,sans-serif;color:var(--muted);font-variant-numeric:tabular-nums}
  .week-nav .btn{min-height:40px;padding:8px 10px;width:auto}
  .day-rail ~ [data-fenix-crud]{display:none}`
            : "";
  return `${stage}
.app{display:grid;grid-template-rows:auto 1fr auto;grid-template-areas:"head" "main" "nav";width:100%;min-height:100dvh}
header{grid-area:head;padding:14px 16px 10px}
nav.tabs{grid-area:nav;display:grid;grid-template-columns:repeat(4,1fr);height:calc(64px + env(safe-area-inset-bottom));padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 94%,transparent);position:sticky;bottom:0;z-index:8}
nav.tabs button{border:0;background:none;color:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:600 10px/1.1 var(--body),sans-serif;padding:4px;min-height:44px;min-width:44px;touch-action:manipulation}
nav.tabs button.on{color:var(--accent)}
nav.tabs svg{width:24px;height:24px;flex:0 0 24px;overflow:hidden;display:block}
main{grid-area:main;min-height:0;overflow:auto;padding:8px 16px 20px}
@media(min-width:768px){
  .app{grid-template-rows:auto 1fr;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"head nav" "main main"}
  header{padding:14px 22px;border-bottom:1px solid var(--line);align-items:center}
  nav.tabs{position:static;display:flex;flex-direction:row;flex-wrap:wrap;height:auto;min-height:56px;border:0;border-bottom:1px solid var(--line);padding:8px 18px;justify-content:flex-end;align-items:center;background:transparent}
  nav.tabs button{flex-direction:row;font:650 13px/1 var(--body),sans-serif;min-height:44px;padding:8px 12px;gap:8px}
  nav.tabs svg{display:${id === "agenda" ? "block" : "none"}}
  main{padding:20px 22px 28px}
  .lookbook{grid-template-columns:minmax(0,1.32fr) minmax(0,1fr);grid-template-rows:1fr 1fr;gap:14px;align-items:stretch;min-height:calc(100vh - 124px)}
  .look{margin:0;min-height:0}
  .look .sil{flex:1;height:auto;min-height:0}
  .look .sil svg{position:absolute;inset:0;width:100%;height:100%}
  .look:first-child{grid-column:1;grid-row:1 / span 2}
  .hero{min-height:32vh}
  .ticket{grid-template-columns:128px 1fr auto;min-height:104px}
  .ticket .thumb{width:128px;height:100px}
  .ticket .thumb svg{width:128px;height:100px}
  .rooms{grid-template-columns:minmax(0,1.28fr) minmax(0,1fr);grid-template-rows:1fr 1fr auto;gap:14px;align-items:stretch}
  .room{grid-template-columns:1fr;gap:10px;margin:0;min-height:0;display:flex;flex-direction:column}
  .room .thumb{width:100%;height:140px;flex:0 0 auto}
  .room:first-child{grid-column:1;grid-row:1 / span 2}
  .room:first-child .thumb{flex:1;height:auto;min-height:280px}
  ${
    id === "service-board"
      ? `main{display:grid;grid-template-columns:minmax(240px,.9fr) minmax(280px,1.1fr);gap:16px;align-content:start}
  .hero,.hero.plate,.plate{grid-column:1;grid-row:1 / span 8;min-height:0;height:calc(100vh - 140px);max-height:calc(100vh - 140px);margin:0}
  .hero svg,.plate svg,.hero.plate svg,.plate.hero svg{height:100%;min-height:0;max-height:100%}
  .tickets,.span,.card{grid-column:2}`
      : id === "agenda"
        ? `.hero{display:none;min-height:0;height:0}
  .day-head{padding-bottom:8px}
  .slot{min-height:80px;padding:16px 18px}
  .week-strip,.week-nav{margin-bottom:12px}`
        : ""
  }
}
@media(min-width:1024px){
  header,nav.tabs{padding-left:40px;padding-right:40px}
  main{padding:28px 40px}
  ${
    id === "split-stage"
      ? `main{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(360px,1.15fr);gap:24px;align-content:start}
  .hero{grid-column:1;grid-row:1 / span 6;min-height:0;height:calc(100vh - 128px);max-height:calc(100vh - 128px);margin:0;position:sticky;top:16px}
  .hero svg{height:100%;min-height:0;max-height:100%}
  .span,.card,.fragrance{grid-column:2}`
      : id === "lookbook"
        ? `.lookbook{grid-template-columns:minmax(0,1.28fr) minmax(0,1fr);grid-template-rows:1fr 1fr;gap:16px;align-items:stretch;min-height:calc(100vh - 132px)}
  .look{margin:0;min-height:0}
  .look .sil{flex:1;min-height:0;height:auto}
  .look .sil svg{position:absolute;inset:0;width:100%;height:100%}
  .look:first-child{grid-column:1;grid-row:1 / span 2}
  .hero.banner{display:none}`
        : id === "hospitality"
          ? `.hero{display:none}
  .rooms{grid-template-columns:minmax(0,1.32fr) minmax(0,1fr);grid-template-rows:1fr 1fr auto;gap:18px;min-height:calc(100vh - 132px);align-items:stretch}
  .room{display:flex;flex-direction:column;gap:10px;margin:0;min-height:0}
  .room .thumb{width:100%;height:160px;flex:0 0 auto}
  .room .thumb svg{width:100%;height:100%;display:block}
  .room:first-child{grid-column:1;grid-row:1 / span 2}
  .room:first-child .thumb{flex:1;height:auto;min-height:320px}
  .room:nth-child(4){grid-column:1 / -1;display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:center}
  .room:nth-child(4) .thumb{height:140px;flex:none}`
          : id === "service-board"
            ? `main{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(340px,1.15fr);gap:24px;align-content:start}
  .hero,.plate,.hero.plate{grid-column:1;grid-row:1 / span 8;min-height:0;height:calc(100vh - 128px);max-height:calc(100vh - 128px);margin:0;position:sticky;top:16px}
  .hero svg,.plate svg,.hero.plate svg,.plate.hero svg{height:100%;min-height:0;max-height:100%}
  .span,.tickets,.card{grid-column:2}
  .ticket{grid-template-columns:148px 1fr auto;min-height:118px;gap:14px}
  .ticket .thumb{width:148px;height:112px}
  .ticket .thumb svg{width:148px;height:112px}`
            : id === "agenda"
              ? `.hero{display:none}
  main{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:28px;align-content:start}
  .day-head,.week-strip,.week-nav{grid-column:1 / -1}
  .day-rail{grid-column:1;min-height:0}
  .slot{padding:18px 20px;min-height:88px}
  .day-rail ~ [data-fenix-crud]{display:block;grid-column:2;grid-row:2 / span 8;align-self:start;margin:0}`
            : ""
  }
}`;
}

function deskCss(id: GrammarId): string {
  if (id === "source-timeline") {
    return `.app[data-fenix-craft-desk]{display:grid;grid-template-rows:auto auto 1fr;grid-template-areas:"head" "nav" "main";min-height:100dvh;width:100%}
header{grid-area:head;padding:12px 16px;border-bottom:1px solid var(--line);align-items:center;gap:16px;overflow:visible}
header .place{max-width:46%;overflow:visible;white-space:normal;text-align:right}
nav.rail{grid-area:nav;display:flex;gap:4px;overflow:auto;padding:6px 16px;border-bottom:1px solid var(--line)}
nav.rail button{border:0;background:none;color:var(--muted);min-height:40px;padding:8px 10px;font:650 13px/1 var(--body),system-ui,sans-serif;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;border-radius:0}
nav.rail button.on{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}
nav.rail svg{width:16px;height:16px;flex:0 0 16px;overflow:hidden;display:block}
main{grid-area:main;padding:0;min-width:0;display:flex;flex-direction:column}
.repo-stage{display:grid;grid-template-columns:1fr;min-height:0;flex:1}
.timeline{padding:12px 16px 20px;border-right:0}
.commit{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line);margin:0;background:transparent;border-radius:0;cursor:pointer}
.commit h2{font-family:var(--body);font-size:15px;font-weight:650;letter-spacing:-.02em;margin:0 0 4px}
.sha{font-variant-numeric:tabular-nums;font-size:12px;color:var(--accent);letter-spacing:.04em}
.branches{padding:12px 16px 20px;background:var(--surface);border-top:1px solid var(--line)}
.branch{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.diff-pane{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;padding:12px 16px 24px;background:var(--elevated);border-top:1px solid var(--line);min-height:180px}
.diff-pane .add{color:var(--success)}
.diff-pane .del{color:var(--warning)}
.sync-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.timeline-art{height:96px;overflow:hidden;border-bottom:1px solid var(--line);margin:0}
.timeline-art svg{width:100%;height:96px;display:block}
.hero{display:none}
.kpis{display:none}
@media(min-width:768px){
  header,nav.rail{padding-left:24px;padding-right:24px}
  .repo-stage{grid-template-columns:minmax(0,1.35fr) minmax(220px,.75fr);min-height:calc(100vh - 108px)}
  .branches{border-top:0;border-left:1px solid var(--line)}
  .timeline{padding:16px 22px 28px}
  .diff-pane{grid-column:1 / -1}
  .timeline-art{height:120px}
  .timeline-art svg{height:120px}
}
@media(min-width:1024px){
  header,nav.rail{padding-left:32px;padding-right:32px}
  .repo-stage{grid-template-columns:minmax(0,1.4fr) minmax(260px,.7fr)}
  .commit{grid-template-columns:88px 1fr auto;padding:14px 0}
}`;
  }
  if (id === "magazine") {
    return `.app{display:grid;grid-template-rows:auto auto 1fr auto;grid-template-areas:"head" "nav" "main" "foot";min-height:100dvh}
header.mast{grid-area:head;display:flex;justify-content:space-between;align-items:end;gap:24px;padding:22px 20px 14px;border-bottom:1px solid var(--line)}
nav.rail{grid-area:nav;display:flex;gap:8px;flex-wrap:wrap;padding:10px 20px 14px}
nav.rail button{border:1px solid var(--line);background:var(--surface);color:var(--fg);min-height:44px;padding:10px 16px;border-radius:0;font:650 13px/1 var(--body),sans-serif;display:inline-flex;align-items:center;gap:8px}
nav.rail button.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
nav.rail svg{width:18px;height:18px;flex:0 0 18px;overflow:hidden;display:block}
main{grid-area:main;padding:16px 20px}
.lastre{display:grid;grid-template-columns:1fr;gap:16px}
.plate{min-height:200px;overflow:hidden;display:flex;flex-direction:column}
.plate svg{height:200px;width:100%;flex:0 0 auto}
#copertina .hero{min-height:min(48vh,360px);margin:0}
#copertina .hero svg{height:min(48vh,360px);width:100%;display:block}
footer{grid-area:foot;padding:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media(min-width:768px){
  header.mast,nav.rail,main,footer{padding-left:32px;padding-right:32px}
  main{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(240px,.82fr);gap:16px;align-items:stretch}
  #copertina{grid-column:1;grid-row:1;display:flex;flex-direction:column;min-height:calc(100vh - 196px);gap:12px}
  #copertina .hero{flex:1;margin:0;min-height:0}
  #copertina .hero svg{height:100%;min-height:0}
  #lastre{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:12px;min-height:calc(100vh - 196px)}
  #lastre .plate{flex:1;margin:0;min-height:0;padding:0}
  #lastre .plate svg{flex:1;height:auto;min-height:88px}
  #lastre .plate h2,#lastre .plate p{padding:8px 12px}
  #studio,[data-fenix-crud]{grid-column:1 / -1}
}
@media(min-width:1024px){
  header.mast,nav.rail,main,footer{padding-left:40px;padding-right:40px}
  main{gap:20px}
  #copertina,#lastre{min-height:calc(100vh - 188px)}
}`;
  }
  return `.app[data-fenix-craft-desk]{display:grid;grid-template-rows:auto auto 1fr;grid-template-areas:"head" "nav" "main";min-height:100dvh;height:auto;width:100%}
header{grid-area:head;padding:14px 16px;border-bottom:1px solid var(--line);align-items:center}
nav.rail{grid-area:nav;display:flex;gap:6px;overflow:auto;padding:8px 16px;border-bottom:1px solid var(--line)}
nav.rail button{border:0;background:none;color:var(--muted);min-height:44px;padding:8px 12px;font:650 13px/1 var(--body),sans-serif;white-space:nowrap;display:inline-flex;align-items:center;gap:8px}
nav.rail button.on{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}
nav.rail svg{width:18px;height:18px;flex:0 0 18px;overflow:hidden;display:block}
main{grid-area:main;padding:16px;min-width:0}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;min-height:84px;min-width:0}
.kpi b{display:block;font-family:var(--display);font-size:clamp(1.05rem,2.2vw,1.45rem);letter-spacing:-.03em;line-height:1.2;overflow:visible;white-space:normal;word-break:break-word;font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;min-width:520px;border-collapse:collapse;background:var(--surface);border:1px solid var(--line)}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);font-size:14px}
th{font-size:11px;letter-spacing:.08em;color:var(--muted)}
td:last-child{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";font-weight:650}
.board{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}
.lane{min-width:0;border-top:3px solid var(--line)}
.lane[data-lane=scouting]{border-top-color:color-mix(in srgb,var(--muted) 55%, var(--accent))}
.lane[data-lane=trattativa]{border-top-color:var(--warning)}
.lane[data-lane=firma]{border-top-color:var(--accent)}
.lane[data-lane=chiuso]{border-top-color:var(--success)}
.deal{cursor:pointer}
.ledger-art{height:88px;overflow:hidden;border:1px solid var(--line);border-radius:var(--r);margin:0 0 14px;background:var(--elevated)}
.ledger-art svg{width:100%;height:88px;display:block}
.spark i:nth-child(odd){opacity:.88}
.spark i:nth-child(even){opacity:1}
@media(min-width:768px){
  .app[data-fenix-craft-desk]{grid-template-columns:1fr;grid-template-rows:auto auto 1fr;grid-template-areas:"head" "nav" "main"}
  header{padding:14px 24px}
  nav.rail{padding:8px 24px;justify-content:flex-start}
  main{padding:22px 24px}
  .kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
  .board{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ledger-art{height:120px}
  .ledger-art svg{height:120px}
}
@media(min-width:1024px){header,nav.rail,main{padding-left:32px;padding-right:32px}main{padding-top:24px}}`;
}

function visualKitCss(t: DesignTokens, grammar: LayoutGrammar): string {
  const desk = grammar.chrome !== "tabs";
  return `${typeRampCss(t)}
${kickerCss(t)}
.toast,.state-load,.state-err{position:fixed;left:16px;right:16px;bottom:calc(80px + env(safe-area-inset-bottom));padding:12px 14px;border-radius:var(--r);background:var(--elevated);border:1px solid var(--line);z-index:30;box-shadow:0 18px 40px color-mix(in srgb,var(--fg) 16%,transparent)}
@media(min-width:768px){.toast,.state-load,.state-err{bottom:24px;left:auto;right:24px;width:min(360px,calc(100vw - 48px))}}
.state-load[hidden],.toast[hidden],.state-err[hidden]{display:none}
.state-load:not([hidden]){display:flex;align-items:center;gap:10px}
.state-load:not([hidden]):before{content:"";width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:fenix-spin .8s linear infinite}
@keyframes fenix-spin{to{transform:rotate(360deg)}}
.state-empty{padding:28px 16px;color:var(--muted);text-align:left;border:0;border-top:1px dashed var(--line);border-radius:0}
.state-empty .btn{margin:16px 0 0;display:inline-flex}
.btn{appearance:none;border:0;cursor:pointer;font:650 14px/1 var(--body),system-ui,sans-serif;border-radius:${t.family === "editorial" || t.family === "fashion" ? "0" : "999px"};padding:12px 18px;background:var(--accent);color:var(--accent-ink);min-height:44px;min-width:44px}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn.sm{padding:8px 12px;min-height:40px;font-size:13px}
.btn:hover,.deal:hover,.look:hover,.ticket:hover,.room:hover,.fragrance:hover,.plate:hover,.commit:hover,.slot:hover{filter:brightness(1.06);box-shadow:0 10px 28px color-mix(in srgb,var(--fg) 16%,transparent);border-color:var(--accent)}
.btn:active,.deal:active,.look:active,.ticket:active,.room:active,.fragrance:active{transform:translateY(1px) scale(.98);filter:brightness(.94)}
.look[data-state=on],.fragrance[data-state=on],.room[data-state=on],.deal[data-state=on],.ticket[data-state=on],.plate[data-state=on]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 14px 32px color-mix(in srgb,var(--fg) 14%,transparent)}
.look[data-state=on] h2:after,.fragrance[data-state=on] h2:after{content:" · in prova";color:var(--accent);font-size:.62em;letter-spacing:.04em}
label{display:block;font-size:11px;letter-spacing:.08em;color:var(--muted);margin:12px 0 6px}
input,select,textarea{width:100%;font:inherit;padding:12px 14px;border-radius:calc(var(--r) * .55);border:1px solid var(--line);background:var(--elevated);color:var(--fg);min-height:44px}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pill,.chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;border:1px solid var(--line);font-size:11px;letter-spacing:.06em;color:var(--muted)}
.chip.ok,.chip.chiuso,.chip.in-house,.chip.al-passo,.chip.in-sala,.chip.allineato,.chip.concluso,.chip.confermato{color:var(--success);border-color:color-mix(in srgb,var(--success) 45%,var(--line))}
.chip.wait,.chip.trattativa,.chip.firma,.chip.in-cottura,.chip.in-forno,.chip.arrivo,.chip.in-volo,.chip.in-attesa,.chip.prenotato,.chip.in-corso{color:var(--warning);border-color:color-mix(in srgb,var(--warning) 45%,var(--line))}
.notes{color:var(--muted);font-size:14px;line-height:1.45}
.spark{display:flex;gap:3px;align-items:flex-end;height:28px;margin-top:10px}
.spark i{display:block;width:7px;border-radius:2px 2px 0 0;background:var(--accent)}
.board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.lane{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px;min-height:168px}
.lane > .kicker{margin-bottom:10px;display:flex;justify-content:space-between;gap:8px}
.deal{background:var(--elevated);border:1px solid var(--line);border-radius:calc(var(--r) * .7);padding:12px 14px;margin:0 0 10px}
.deal h2{font-family:var(--display);font-size:1.05rem;margin:0 0 4px;letter-spacing:-.03em;line-height:1.15}
.thumb{width:56px;height:56px;border-radius:calc(var(--r) * .45);overflow:hidden;border:1px solid var(--line);background:var(--elevated);flex-shrink:0}
.thumb svg{width:56px;height:56px;display:block}
@media(prefers-reduced-motion:no-preference){
  .btn,.card,.look,.slot,.ticket,.room,.plate,.deal,.fragrance,.commit{transition:transform .18s ease, box-shadow .18s ease, filter .18s ease, border-color .18s ease}
  .btn:hover,.deal:hover,.look:hover,.ticket:hover,.room:hover,.fragrance:hover,.plate:hover,.commit:hover,.slot:hover{transform:translateY(-2px)}
  .hero svg,.sil svg,.plate svg{animation:fenix-breathe 14s ease-in-out infinite}
  @keyframes fenix-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.01)}}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
${desk ? deskCss(grammar.id) : phoneCss(grammar.id)}
${familyChromeCss(t, grammar)}
/* ${t.family}/${t.variant} device-aware */`;
}

function jsRows(rows: PipelineRow[]): string {
  return rows
    .map((r) => {
      const extra =
        (r.status ? `,status:${JSON.stringify(r.status)}` : "") +
        (r.dayOffset != null ? `,dayOffset:${r.dayOffset}` : "");
      return `{id:${JSON.stringify(r.id)},title:${JSON.stringify(r.title)},kicker:${JSON.stringify(r.kicker)},note:${JSON.stringify(r.note)},meta:${JSON.stringify(r.meta)}${extra}}`;
    })
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
  const bootMain =
    grammar.id === "source-timeline"
      ? `<section class="repo-stage" data-repo-stage="activity"><div class="timeline-art">${hero}</div></section>`
      : grammar.id === "agenda"
        ? agendaRailMarkup(spec, grammar)
        : `<div class="hero">${hero}</div>`;
  const navButtons = spec.tabs
    .map(
      (tab, i) =>
        `  <button type="button" data-view="${tab.id}" data-fenix-id="icon:${tab.id}"${i === 0 ? ' class="on"' : ""}>${tabSvg(tab, i)}<span>${tab.label}</span></button>`,
    )
    .join("\n");
  const h2 =
    tokens.family === "editorial"
      ? "clamp(1.35rem, 3vw, 2.05rem)"
      : tokens.family === "ops" || tokens.family === "repo"
        ? "1.08rem"
        : tokens.family === "fashion" || tokens.family === "perfume"
          ? "clamp(1.22rem, 2.4vw, 1.7rem)"
          : tokens.family === "booking"
            ? "var(--t-headline)"
            : "clamp(1.18rem, 2.2vw, 1.55rem)";
  const large = isOperationalApp(tokens) ? "2.125rem" : "1.75rem";
  return `<!DOCTYPE html>
<html lang="it" data-family="${tokens.family}" data-grammar="${grammar.id}"${desk ? " data-fenix-craft-desk" : ""}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="color-scheme" content="${scheme}"/>
<title>${spec.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="${tokens.fonts.href}" rel="stylesheet"/>
<style data-fenix-phone data-fenix-site data-fenix-craft>
:root{color-scheme:${scheme};--bg:${p.bg};--surface:${p.surface};--elevated:${p.elevated};--fg:${p.fg};--muted:${p.muted};--accent:${p.accent};--line:${p.line};--accent-ink:${p.accentInk};--success:${p.success};--warning:${p.warning};--r:${tokens.radius};--display:${displayStack(tokens)};--body:"${tokens.fonts.body}",ui-sans-serif,system-ui,sans-serif;--t-h1:${tokens.type.h1};--t-h2:${h2};--t-body:${tokens.type.body};--t-large:${large};--t-headline:1.0625rem;--t-footnote:.8125rem;--t-caption:.6875rem;--ink-loud:${p.fg};--ink-quiet:${p.muted}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--fg);font:400 ${tokens.type.body}/1.29 var(--body),ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
body{min-height:100dvh}
.app{min-height:100dvh;display:flex;flex-direction:column;width:100%}
header{padding:16px 18px 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.brand{font-family:var(--display);font-size:${tokens.type.h1};font-weight:650;letter-spacing:-.04em;line-height:1.1;color:var(--fg)}
header .place{color:var(--muted);max-width:42%;overflow:visible;white-space:normal;text-align:right;line-height:1.3}
main{flex:1;min-height:0;overflow-y:auto;padding:8px 16px 24px;-webkit-overflow-scrolling:touch}
.hero,.sil,.plate{position:relative;border-radius:var(--r);overflow:hidden;margin-bottom:14px;border:1px solid var(--line);background:var(--elevated);min-height:200px}
.hero svg,.sil svg,.plate svg{width:100%;height:220px;display:block}
.hero .caption,.plate.hero .caption{position:absolute;left:0;right:0;bottom:0;padding:18px 20px 16px;background:linear-gradient(transparent,color-mix(in srgb,var(--bg) 92%,transparent) 22%,var(--bg));pointer-events:none}
.hero .caption h2,.plate.hero .caption h2{font-family:var(--display);font-size:clamp(1.28rem,2.6vw,1.85rem);letter-spacing:-.03em;margin:0;color:var(--fg)}
.card,.slot,.ticket,.room,.look,.kpi,.measure{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:12px}
.card h2,.look h2,.slot h2,.ticket h2,.room h2,.deal h2,.plate h2,.fragrance h2{font-family:var(--display);font-size:1.25rem;font-weight:600;margin:0 0 4px;letter-spacing:-.03em;color:var(--fg)}
.look{padding:0;overflow:hidden}
.look h2,.look p{padding:0 14px}
.look h2{padding-top:12px}
.look p{padding-bottom:14px;color:var(--muted)}
.room h2,.room p,.room .notes{flex:0 0 auto}
${visualKitCss(tokens, grammar)}
</style>
</head>
<body>
<div class="app"${deskAttr}>
<header class="${headerExtra.trim()}">
  <div>
    <p class="kicker">${spec.kicker}</p>
    <h1 class="brand">${spec.name}</h1>
  </div>
  <p class="place">${spec.place}</p>
</header>
<nav class="${navClass}" id="tabs" aria-label="Navigazione">
${navButtons}
</nav>
<main id="root">${bootMain}</main>
${grammar.chrome === "masthead" ? `<footer>${spec.name} · lastre originali · niente stock</footer>` : ""}
</div>
<div class="toast" id="toast" hidden>${grammar.voice.ok}</div>
<div class="state-load" id="load" hidden>${grammar.voice.load}</div>
<div class="state-err" id="err" hidden role="alert">${grammar.voice.err}</div>
<script>
const COL=${JSON.stringify(spec.collection)};
const defaultData={items:[${jsRows(spec.rows)}]};
let data=structuredClone(defaultData);
let view=${JSON.stringify(homeView)};
let selectedDay="";
let editId=null;
const arts=${JSON.stringify(cards)};
const hero=${JSON.stringify(hero)};
const tabDefs=${JSON.stringify(spec.tabs)};
const glyphs=${JSON.stringify(spec.tabs.map((t, i) => tabSvg(t, i)))};
const grammarId=${JSON.stringify(grammar.id)};
const tokenVariant=${tokens.variant};
const chroma=${JSON.stringify(tokens.chroma)};
const emptyVoice=${JSON.stringify(grammar.voice.empty)};
const census=${JSON.stringify(grammar.voice.census)};
const formTitle=${JSON.stringify(spec.formTitle)};
const cta=${JSON.stringify(spec.cta)};
const kicker=${JSON.stringify(spec.kicker)};
const place=${JSON.stringify(spec.place)};
const AGENDA_CYCLE={prenotato:"confermato",confermato:"in-corso","in-corso":"concluso",concluso:"prenotato"};
function isoDay(d){
  var y=d.getFullYear();
  var m=("0"+(d.getMonth()+1)).slice(-2);
  var day=("0"+d.getDate()).slice(-2);
  return y+"-"+m+"-"+day;
}
function nowDate(){
  var n=typeof window!=="undefined"?window.__FENIX_NOW:null;
  return n!=null && isFinite(Number(n))?new Date(Number(n)):new Date();
}
function todayIso(){ return isoDay(nowDate()); }
function isIsoDay(s){
  if(!s || String(s).length!==10) return false;
  var p=String(s).split("-");
  return p.length===3 && p[0].length===4 && p[1].length===2 && p[2].length===2;
}
function isHm(s){
  if(!s || String(s).length!==5 || s.charAt(2)!==":") return false;
  var h=Number(s.slice(0,2)), m=Number(s.slice(3));
  return isFinite(h) && isFinite(m) && h>=0 && h<24 && m>=0 && m<60;
}
function shiftIso(iso, delta){
  var p=String(iso||"").split("-");
  var base=nowDate();
  var d=new Date(Number(p[0])||base.getFullYear(), (Number(p[1])||1)-1, (Number(p[2])||1)+(delta|0));
  return isoDay(d);
}
function mondayOf(iso){
  var src=isIsoDay(iso)?iso:todayIso();
  var p=src.split("-");
  var d=new Date(Number(p[0]), (Number(p[1])||1)-1, Number(p[2])||1);
  var wd=d.getDay();
  d.setDate(d.getDate()+(wd===0?-6:1-wd));
  return isoDay(d);
}
function weekDays(anchor){
  var src=anchor && isIsoDay(anchor)?anchor:(selectedDay && isIsoDay(selectedDay)?selectedDay:todayIso());
  var mondayIso=mondayOf(src);
  var p=mondayIso.split("-");
  var monday=new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
  var labels=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
  return labels.map(function(label,i){
    var d=new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+i);
    return {label:label, iso:isoDay(d), n:d.getDate()};
  });
}
function monthName(iso){
  var months=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  var p=String(iso||"").split("-");
  return months[(Number(p[1])||1)-1]||"";
}
function weekRangeLabel(days){
  if(!days||!days.length) return "";
  var a=days[0].iso, b=days[days.length-1].iso;
  var da=a.split("-"), db=b.split("-");
  var na=Number(da[2]), nb=Number(db[2]);
  var ma=monthName(a), mb=monthName(b);
  if(da[0]===db[0] && da[1]===db[1]) return na+"–"+nb+" "+ma;
  if(da[0]===db[0]) return na+" "+ma+" – "+nb+" "+mb;
  return na+" "+ma+" "+da[0]+" – "+nb+" "+mb+" "+db[0];
}
function hydrateAgenda(){
  if(grammarId!=="agenda") return;
  if(!selectedDay || !isIsoDay(selectedDay)) selectedDay=todayIso();
  var today=todayIso();
  data.items.forEach(function(e,i){
    if(!e.status) e.status=["prenotato","confermato","in-corso","concluso"][i%4];
    if(e.day && isIsoDay(e.day)) return;
    var off=Number(e.dayOffset);
    e.day=shiftIso(today, isFinite(off)?(off|0):(i%7));
  });
}
var persistBusy=false;
function cloneData(){ try { return JSON.parse(JSON.stringify(data)); } catch(err) { return {items:(data.items||[]).slice()}; } }
function saveOnce(){
  if(!window.Fenix || !window.Fenix.save) return Promise.resolve({ok:true});
  return Promise.resolve(window.Fenix.save(COL, data)).then(function(res){
    if(res && typeof res==="object" && "ok" in res && res.ok===false){
      var msg=res.error||res.message||(res.timeout?"Tempo scaduto.":"Salvataggio non riuscito.");
      var err=new Error(msg);
      err.fenix=res;
      throw err;
    }
    return res||{ok:true};
  });
}
function save(){
  return saveOnce().catch(function(){
    return new Promise(function(ok){ setTimeout(ok, 180); }).then(saveOnce);
  });
}
function flashErr(msg){
  var n=document.getElementById("err");
  if(n){ n.hidden=false; if(msg) n.textContent=msg; }
  document.documentElement.setAttribute("data-fenix-flash","err");
  var ferr=document.querySelector("[data-fenix-form-error]");
  if(ferr){ ferr.hidden=false; ferr.textContent=msg||"Salvataggio non riuscito. Riprova."; }
}
function restoreForm(keep){
  var f=document.getElementById("fnew");
  if(!f||!keep) return;
  if(f.n) f.n.value=keep.n||"";
  if(f.ora) f.ora.value=keep.ora||"";
  if(f.data) f.data.value=keep.data||"";
  if(f.luogo) f.luogo.value=keep.luogo||"";
  if(f.cliente) f.cliente.value=keep.cliente||"";
  if(f.k) f.k.value=keep.k||"";
  if(f.note) f.note.value=keep.note||"";
}
function persistThen(afterOk){
  if(persistBusy) return Promise.resolve(false);
  persistBusy=true;
  return save().then(function(){
    persistBusy=false;
    ping(true);
    if(afterOk) afterOk();
    else render();
    return true;
  }).catch(function(err){
    persistBusy=false;
    flashErr(err && err.message ? err.message : "Salvataggio non riuscito.");
    ping(false);
    return false;
  });
}
function commitForm(f){
  if(!f || f.id!=="fnew") return false;
  if(persistBusy) return false;
  if(typeof f.checkValidity==="function" && !f.checkValidity()){
    if(typeof f.reportValidity==="function") f.reportValidity();
    var bad=f.querySelector(":invalid");
    if(bad){ bad.setAttribute("aria-invalid","true"); try{ bad.focus(); }catch(err){} }
    var ferr=f.querySelector("[data-fenix-form-error]");
    if(ferr){ ferr.hidden=false; ferr.textContent="Controlla i campi obbligatori."; }
    ping(false);
    return false;
  }
  var nome=(f.n && f.n.value || "").trim(); if(!nome){
    if(f.n){ f.n.setAttribute("aria-invalid","true"); try{ f.n.focus(); }catch(err){} }
    ping(false); return false;
  }
  var wasEdit=!!editId;
  var snap=cloneData();
  var snapView=view, snapEdit=editId, snapDay=selectedDay;
  var keep={n:nome,ora:"",data:"",luogo:"",cliente:"",k:(f.k&&f.k.value||""),note:(f.note&&f.note.value||"")};
  var nextView=tabDefs[0].id;
  var nextDay=selectedDay;
  if(grammarId==="agenda"){
    hydrateAgenda();
    var ora=(f.ora&&f.ora.value||"").trim();
    if(!isHm(ora)){
      if(f.ora){ f.ora.setAttribute("aria-invalid","true"); try{ f.ora.focus(); }catch(err){} }
      ping(false); return false;
    }
    var giorno=(f.data&&f.data.value||"").trim();
    if(!isIsoDay(giorno)){
      if(f.data){ f.data.setAttribute("aria-invalid","true"); try{ f.data.focus(); }catch(err){} }
      ping(false); return false;
    }
    var luogo=(f.luogo&&f.luogo.value||"").trim()||place;
    var cliente=(f.cliente&&f.cliente.value||"").trim()||"—";
    keep.ora=ora; keep.data=giorno; keep.luogo=luogo; keep.cliente=cliente;
    var prev=wasEdit?data.items.find(function(x){return x.id===editId;}):null;
    var row={id:wasEdit?editId:("n"+Date.now()),title:nome,kicker:ora,note:luogo+" · "+cliente,meta:(prev&&prev.meta)||"30 min",status:(prev&&prev.status)||"prenotato",day:giorno};
    if(wasEdit){
      var idx=data.items.findIndex(function(x){return x.id===editId;});
      if(idx>=0) data.items[idx]=row;
    } else {
      data.items.unshift(row);
    }
    nextDay=giorno;
    nextView=giorno===todayIso()?tabDefs[0].id:tabDefs[2].id;
  } else {
    data.items.unshift({id:"n"+Date.now(),title:nome,kicker:(f.k&&f.k.value||"").trim()||census,note:(f.note&&f.note.value||"").trim()||"—",meta:"nuovo"});
    nextView=tabDefs[0].id;
  }
  return persistThen(function(){
    editId=null;
    selectedDay=nextDay;
    view=nextView;
    try { f.reset(); } catch(err) {}
    render();
  }).then(function(ok){
    if(ok) return true;
    data=snap;
    view=snapView;
    editId=snapEdit;
    selectedDay=snapDay;
    restoreForm(keep);
    return false;
  });
}
function ping(ok){
  var n=document.getElementById(ok?"toast":"err");
  if(!n) return;
  n.hidden=false;
  document.documentElement.setAttribute("data-fenix-flash", ok?"ok":"err");
  setTimeout(function(){ n.hidden=true; document.documentElement.removeAttribute("data-fenix-flash"); }, 1600);
}
function renderTabs(){
  var nav=document.getElementById("tabs");
  nav.innerHTML=tabDefs.map(function(t,i){
    return '<button type="button" data-view="'+t.id+'" data-fenix-id="icon:'+t.id+'" class="'+(view===t.id?"on":"")+'">'+glyphs[i]+"<span>"+t.label+"</span></button>";
  }).join("");
}
function emptyBox(){ return '<div class="state-empty" data-state="empty"><p>'+emptyVoice+'</p><button class="btn" type="button" data-view="'+tabDefs[1].id+'">'+cta+"</button></div>"; }
function chip(k){ return '<span class="chip '+k+'">'+k+"</span>"; }
function renderPerfume(){
  var plates=[hero].concat(arts);
  var html='<div class="hero">'+hero+'<div class="caption"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2></div></div>";
  if(!data.items.length) return html+emptyBox();
  data.items.forEach(function(e,i){
    html+='<article class="card fragrance" data-id="'+e.id+'" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+(plates[i%plates.length]||hero)+'</div><div><p class="kicker">'+e.kicker+"</p><h2>"+e.title+'</h2><p class="notes">'+e.note+'</p><div class="row" style="display:flex;justify-content:space-between;gap:8px;margin-top:8px"><span>'+e.meta+'</span><button class="btn sm ghost" data-act="wear" data-id="'+e.id+'">Tieni a portata</button></div></div></article>';
  });
  return html;
}
function renderLookbook(){
  if(!data.items.length) return emptyBox();
  var plates=[hero].concat(arts);
  var html='<div class="lookbook">';
  data.items.forEach(function(e,i){
    html+='<article class="look" data-id="'+e.id+'" data-act="wear" data-state="'+(i===0?"on":"idle")+'"><div class="sil">'+(plates[i%plates.length]||hero)+"</div><h2>"+e.title+"</h2><p>"+e.kicker+" · "+e.note+" · "+e.meta+"</p></article>";
  });
  return html+"</div>";
}
function renderRooms(){
  var plates=[hero].concat(arts);
  var html='<div class="hero">'+hero+'<div class="caption"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2></div></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="rooms">';
  data.items.forEach(function(e,i){
    html+='<article class="room" data-id="'+e.id+'" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+(plates[i%plates.length]||hero)+'</div><div><p>'+chip(e.kicker)+'</p><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+'</p><button class="btn sm ghost" data-act="advance" data-id="'+e.id+'">Avanza soggiorno</button></div></article>';
  });
  return html+"</div>";
}
function renderTickets(){
  var plates=[hero].concat(arts);
  var html='<div class="hero plate">'+hero+'<div class="caption"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2></div></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="tickets">';
  data.items.forEach(function(e,i){
    html+='<article class="ticket" data-id="'+e.id+'" data-act="advance" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+(plates[i%plates.length]||hero)+'</div><div><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></div>"+chip(e.kicker)+"</article>";
  });
  return html+"</div>";
}
function spark(seed, amp){
  seed=Math.abs(Number(seed)||1);
  amp=amp||1;
  var bits=[];
  for(var i=0;i<6;i++){
    var n=24+((seed*(19+i*17)+i*31)%72);
    n=Math.max(22,Math.min(96,Math.round(n*amp)));
    bits.push('<i style="height:'+n+'%"></i>');
  }
  return '<span class="spark" data-spark="'+seed+'" aria-hidden="true">'+bits.join("")+"</span>";
}
function euroOf(meta){
  return Number(String(meta||"").replace(/[^0-9]/g,""))||0;
}
function fmtEuro(n){
  if(n>=1000) return "€"+Math.round(n/1000)+"k";
  return "€"+n;
}
function renderDesk(){
  var values=data.items.map(function(x){return euroOf(x.meta);});
  var total=values.reduce(function(a,b){return a+b;},0);
  var openRows=data.items.filter(function(x){return !/chiuso|pronto/.test(x.kicker);});
  var open=openRows.length;
  var openSum=openRows.reduce(function(a,x){return a+euroOf(x.meta);},0);
  var closed=data.items.length-open;
  var closedSum=Math.max(0,total-openSum);
  var avg=data.items.length?Math.round(total/data.items.length):0;
  var html='<div class="ledger-art" aria-hidden="true">'+hero+"</div>";
  html+='<div class="kpis">';
  html+='<div class="kpi" data-kpi="book"><span class="kicker">Book</span><b>'+fmtEuro(total)+"</b>"+spark(total||11,1)+"</div>";
  html+='<div class="kpi" data-kpi="open"><span class="kicker">Aperte</span><b>'+open+" · "+fmtEuro(openSum)+"</b>"+spark(openSum||13,.92)+"</div>";
  html+='<div class="kpi" data-kpi="won"><span class="kicker">Chiuso</span><b>'+closed+" · "+fmtEuro(closedSum)+"</b>"+spark(closedSum||17,.78)+"</div>";
  html+='<div class="kpi" data-kpi="ticket"><span class="kicker">Ticket medio</span><b>'+fmtEuro(avg)+"</b>"+spark(avg||19,.84)+"</div></div>";
  var lanes=["scouting","trattativa","firma","chiuso"];
  html+='<div class="board" role="list">';
  lanes.forEach(function(lane){
    var rows=data.items.filter(function(x){return x.kicker===lane;});
    html+='<div class="lane" data-lane="'+lane+'"><p class="kicker">'+lane+" <span>"+rows.length+'</span></p>';
    rows.forEach(function(e,i){
      html+='<article class="deal" data-id="'+e.id+'" data-act="advance" data-state="'+(i===0?"on":"idle")+'"><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></article>";
    });
    html+="</div>";
  });
  html+='</div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Stato</th><th>Nota</th><th>Meta</th></tr></thead><tbody>';
  data.items.forEach(function(e){
    html+='<tr data-id="'+e.id+'"><td>'+e.title+"</td><td>"+chip(e.kicker)+"</td><td>"+e.note+"</td><td>"+e.meta+"</td></tr>";
  });
  html+="</tbody></table></div>";
  if(!data.items.length) html+=emptyBox();
  return html;
}
function renderMagazine(){
  var plates=[hero].concat(arts);
  var html='<section id="copertina"><div class="hero">'+hero+'</div><div class="card span"><p class="kicker">'+kicker+"</p><h2>"+specName()+" in lastre</h2><p class=\\"notes\\">Rivista di lastre fotografiche. Niente stock, niente telefono boxed.</p></div></section>";
  html+='<section id="lastre" class="lastre">';
  data.items.forEach(function(e,i){
    html+='<article class="plate card" data-id="'+e.id+'" data-act="wear" data-state="'+(i===0?"on":"idle")+'">'+(plates[i%plates.length]||hero)+"<h2>"+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></article>";
  });
  html+="</section>";
  html+='<section id="studio" class="card span"><p class="kicker">Studio</p><h2>'+data.items.length+" lastre in fascicolo</h2><p class=\\"notes\\">"+place+"</p></section>";
  html+=renderForm();
  if(!data.items.length) html+=emptyBox();
  return html;
}
function specName(){ return ${JSON.stringify(spec.name)}; }
function renderForm(){
${
  grammar.id === "agenda"
    ? `  var editing=editId?data.items.find(function(x){return x.id===editId;}):null;
  var title=editing?editing.title:"";
  var ora=editing?editing.kicker:"";
  var luogo="";
  var cliente="";
  var giorno=editing&&editing.day?editing.day:(selectedDay||todayIso());
  if(editing&&editing.note){
    var parts=String(editing.note).split(" · ");
    luogo=parts[0]||"";
    cliente=parts.slice(1).join(" · ");
  }
  return '<section class="card span" data-fenix-crud data-agenda-form="'+(editing?"edit":"create")+'"><p class="kicker">'+(editing?"Modifica":"Nuovo")+'</p><h2>'+(editing?"Aggiorna slot":formTitle)+'</h2><form id="fnew"><label for="n">Prestazione</label><input class="field" id="n" name="n" required placeholder="Es. Taglio e piega" value="'+title+'"><label for="ora">Ora</label><input class="field" id="ora" name="ora" type="time" required placeholder="09:30" value="'+(ora||"09:00")+'"><label for="data">Data</label><input class="field" id="data" name="data" type="date" required value="'+giorno+'"><label for="luogo">Luogo</label><input class="field" id="luogo" name="luogo" placeholder="Sala 1" value="'+luogo+'"><label for="cliente">Cliente</label><input class="field" id="cliente" name="cliente" placeholder="Nome del cliente" value="'+cliente+'"><p class="notes" data-fenix-form-error role="alert" hidden>Controlla i campi obbligatori.</p><button class="btn" type="button" data-act="save" style="margin-top:14px;width:100%">'+(editing?"Salva modifiche":cta)+'</button></form></section>';`
    : `  return '<section class="card span" data-fenix-crud><p class="kicker">Nuovo</p><h2>'+formTitle+'</h2><form id="fnew"><label for="n">Nome</label><input class="field" id="n" name="n" required placeholder="Nome"><label for="k">Dettaglio</label><input class="field" id="k" name="k" placeholder="stato, taglia, ora"><label for="note">Nota</label><input class="field" id="note" name="note" placeholder="materia"><button class="btn" type="submit" style="margin-top:14px;width:100%">'+cta+"</button></form></section>";`
}
}
function renderList(){
  var html='<div class="card span"><p class="kicker">Archivio</p><h2>'+data.items.length+" voci</h2></div>";
  if(!data.items.length) html+=emptyBox();
  data.items.forEach(function(e){
    html+='<div class="card" data-id="'+e.id+'"><div style="display:flex;justify-content:space-between;gap:8px"><h2>'+e.title+'</h2><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Archivia</button></div><p class="notes">'+(e.status?chip(e.status)+" · ":"")+e.note+" · "+e.meta+(e.kicker?" · "+e.kicker:"")+(e.day?" · "+e.day:"")+"</p></div>";
  });
  return html;
}
function renderStats(){
  return '<div class="hero">'+hero+'</div><div class="card span"><p class="kicker">Studio</p><h2>'+data.items.length+" "+census+'</h2><p class="notes">'+place+"</p></div>";
}
function slotMarkup(e,i){
  var st=e.status||"prenotato";
  return '<article class="slot" data-id="'+e.id+'" data-day="'+(e.day||"")+'" data-state="'+(i===0?"on":"idle")+'" data-status="'+st+'"><time class="time" datetime="'+e.kicker+'">'+e.kicker+'</time><div class="slot-body"><h2>'+e.title+'</h2><p class="notes">'+chip(st)+" · "+e.note+" · "+e.meta+'</p><div class="slot-actions"><button class="btn sm ghost" data-act="advance" data-id="'+e.id+'" aria-label="Avanza stato '+st+'">Avanza slot</button><button class="btn sm ghost" data-act="edit" data-id="'+e.id+'">Modifica</button><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Archivia</button></div></div></article>';
}
function renderAgenda(){
  hydrateAgenda();
  var focus=view===tabDefs[2].id?selectedDay:todayIso();
  var rows=data.items.filter(function(e){return e.day===focus;}).slice().sort(function(a,b){return String(a.kicker).localeCompare(String(b.kicker));});
  var html='<div class="day-head"><p class="kicker">'+kicker+" · "+focus+'</p><h2 id="day-label">'+rows.length+" "+census+"</h2></div>";
  html+='<div class="day-rail" data-fenix-rail="day" id="day-rail" role="tabpanel" aria-labelledby="day-label">';
  if(!rows.length) html+=emptyBox();
  else rows.forEach(function(e,i){ html+=slotMarkup(e,i); });
  return html+"</div>"+renderForm();
}
function renderWeek(){
  hydrateAgenda();
  var days=weekDays(selectedDay);
  var html='<div class="week-nav" data-fenix-week-nav>';
  html+='<button class="btn sm ghost" type="button" data-act="week-prev" aria-label="Settimana precedente">←</button>';
  html+='<p class="week-range" data-week-range="'+days[0].iso+'/'+days[6].iso+'" aria-live="polite">'+weekRangeLabel(days)+"</p>";
  html+='<button class="btn sm ghost" type="button" data-act="week-today" aria-label="Torna a oggi">Oggi</button>';
  html+='<button class="btn sm ghost" type="button" data-act="week-next" aria-label="Settimana successiva">→</button>';
  html+="</div>";
  html+='<div class="week-strip" role="tablist" aria-label="Settimana" data-fenix-week>';
  days.forEach(function(d){
    var n=data.items.filter(function(e){return e.day===d.iso;}).length;
    var on=selectedDay===d.iso;
    html+='<button type="button" role="tab" class="week-day'+(on?" on":"")+'" data-day="'+d.iso+'" data-day-label="'+d.label+'" aria-selected="'+(on?"true":"false")+'" aria-controls="day-rail" id="tab-day-'+d.iso+'" tabindex="'+(on?"0":"-1")+'" aria-label="'+d.label+" "+d.n+", "+n+" "+census+'"><span class="kicker">'+d.label+'</span><b>'+d.n+'</b><span class="count" data-count="'+n+'">'+n+"</span></button>";
  });
  html+="</div>";
  return html+renderAgenda();
}

function shaOf(e){
  var m=(e.note||"").match(/[a-f0-9]{6}/i);
  return m?m[0]:(e.id||"000000").slice(0,6);
}
function renderSource(mode){
  mode=mode||"activity";
  var html="";
  if(mode==="activity" || mode==="branches"){
    html+='<section class="repo-stage" data-repo-stage="'+(mode==="branches"?"branches":"activity")+'">';
    html+='<div class="timeline"><div class="timeline-art">'+(mode==="branches"?arts[1]||hero:hero)+'</div>';
    if(!data.items.length) html+=emptyBox();
    data.items.forEach(function(e,i){
      html+='<article class="commit" data-id="'+e.id+'" data-hash="'+shaOf(e)+'" data-act="wear" data-state="'+(i===0?"on":"idle")+'"><span class="sha">'+shaOf(e)+'</span><div><h2>'+e.title+'</h2><p class="notes">'+e.note+' · '+e.kicker+'</p></div>'+chip(e.meta||e.kicker)+"</article>";
    });
    html+="</div>";
    var branches={};
    data.items.forEach(function(e){ branches[e.kicker]=(branches[e.kicker]||0)+1; });
    html+='<aside class="branches" data-repo-stage="branches"><p class="kicker">Rami</p>';
    Object.keys(branches).forEach(function(b){
      html+='<div class="branch"><b>'+b+'</b><span class="chip">'+branches[b]+" voci</span></div>";
    });
    var aligned=data.items.filter(function(x){return /allineato/.test(x.meta||"");}).length;
    html+='<div class="sync-row"><span>Allineati</span><b>'+aligned+" / "+data.items.length+"</b></div>";
    html+='<div class="sync-row"><span>In volo</span><b>'+data.items.filter(function(x){return /volo/.test(x.meta||"");}).length+"</b></div>";
    html+="</aside></section>";
  }
  if(mode==="sync"){
    html+='<section class="timeline" data-repo-stage="sync"><div class="timeline-art">'+(arts[2]||hero)+'</div>';
    html+='<div class="sync-row"><span>Origine</span><b>'+place+"</b></div>";
    html+='<div class="sync-row"><span>Voci</span><b>'+data.items.length+"</b></div>";
    html+='<div class="sync-row"><span>Allineati</span><b>'+data.items.filter(function(x){return /allineato/.test(x.meta||"");}).length+"</b></div>";
    html+='<div class="sync-row"><span>In attesa</span><b>'+data.items.filter(function(x){return /attesa/.test(x.meta||"");}).length+"</b></div>";
    html+="</section>"+renderForm();
  }
  if(mode==="diff" || mode==="activity"){
    html+='<section class="diff-pane" data-repo-stage="diff"><p class="kicker">Scarto</p>';
    html+='<div class="add">+ nastro delle voci, niente hero KPI</div>';
    html+='<div class="add">+ rami in colonna, stato sync visibile</div>';
    html+='<div class="del">- home universale grigia</div>';
    html+='<div class="del">- due riquadri vuoti</div></section>';
  }
  return html;
}
function renderHome(){
  if(grammarId==="lookbook") return renderLookbook();
  if(grammarId==="hospitality") return renderRooms();
  if(grammarId==="service-board") return renderTickets();
  if(grammarId==="ops-desk") return renderDesk();
  if(grammarId==="magazine") return renderMagazine();
  if(grammarId==="source-timeline") return renderSource("activity");
  if(grammarId==="agenda") return renderAgenda();
  if(grammarId==="pocket-tool") return renderTool();
  if(grammarId==="phone-seed") return renderList();
  return renderPerfume();
}
function renderTool(){
  var html='<div class="hero">'+hero+'<div class="caption"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2></div></div>";
  if(!data.items.length) return html+emptyBox();
  data.items.forEach(function(e,i){
    html+='<article class="ticket" data-id="'+e.id+'" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+(arts[i%arts.length]||hero)+'</div><div><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></div>"+chip(e.kicker)+"</article>";
  });
  return html;
}
function render(){
  if(grammarId==="agenda") hydrateAgenda();
  renderTabs();
  var root=document.getElementById("root");
  var id=view;
  if(grammarId==="source-timeline"){
    if(id===tabDefs[0].id) root.innerHTML=renderSource("activity");
    else if(id===tabDefs[1].id) root.innerHTML=renderSource("branches");
    else if(id===tabDefs[2].id) root.innerHTML=renderSource("sync");
    else root.innerHTML=renderSource("diff");
  } else if(id===tabDefs[0].id) root.innerHTML=renderHome();
  else if(id===tabDefs[1].id) root.innerHTML=renderForm();
  else if(id===tabDefs[2].id) root.innerHTML=grammarId==="ops-desk"?renderDesk():grammarId==="agenda"?renderWeek():renderList();
  else root.innerHTML=grammarId==="magazine"?renderForm():renderStats();
  root.setAttribute("data-state", data.items.length?"ready":"empty");
  root.setAttribute("data-fenix-view", view);
}
document.getElementById("tabs").addEventListener("click",function(e){
  var b=e.target.closest("[data-view]"); if(!b) return; view=b.getAttribute("data-view"); render();
});
document.getElementById("root").addEventListener("click",function(e){
  var jump=e.target.closest("[data-view]");
  if(jump){ view=jump.getAttribute("data-view"); render(); return; }
  var dayBtn=e.target.closest(".week-day[data-day]");
  if(dayBtn && grammarId==="agenda"){
    selectedDay=dayBtn.getAttribute("data-day");
    render();
    var focused=document.querySelector('[data-day="'+selectedDay+'"]');
    if(focused) focused.focus();
    return;
  }
  var b=e.target.closest("[data-act]"); if(!b) return;
  var id=b.getAttribute("data-id");
  var act=b.getAttribute("data-act");
  if(act==="week-prev"||act==="week-next"||act==="week-today"){
    if(grammarId!=="agenda") return;
    if(act==="week-today") selectedDay=todayIso();
    else selectedDay=shiftIso(selectedDay||todayIso(), act==="week-next"?7:-7);
    view=tabDefs[2].id;
    render();
    var focusedWeek=document.querySelector('[data-day="'+selectedDay+'"]');
    if(focusedWeek) focusedWeek.focus();
    return;
  }
  if(act==="save"){ commitForm(b.closest("form") || document.getElementById("fnew")); return; }
  if(persistBusy) return;
  if(act==="del"){
    var snapDel=cloneData();
    data.items=data.items.filter(function(x){return x.id!==id;});
    persistThen().then(function(ok){ if(!ok){ data=snapDel; render(); } });
    return;
  }
  if(act==="edit"){ editId=id; view=tabDefs[1].id; render(); return; }
  if(act==="wear"){
    var row=data.items.find(function(x){return x.id===id;});
    if(!row) return;
    var snapWear=cloneData();
    data.items=[row].concat(data.items.filter(function(x){return x.id!==id;}));
    persistThen(function(){
      if(grammarId!=="source-timeline") view=tabDefs[2].id;
      render();
    }).then(function(ok){ if(!ok){ data=snapWear; render(); } });
    return;
  }
  if(act==="advance"){
    var item=data.items.find(function(x){return x.id===id;});
    if(!item) return;
    var snapAdv=cloneData();
    if(grammarId==="agenda"){
      item.status=AGENDA_CYCLE[item.status]||"confermato";
    } else {
      var cycle={scouting:"trattativa",trattativa:"firma",firma:"chiuso",chiuso:"scouting","in-forno":"al-passo","al-passo":"in-sala","in-sala":"in-forno",arrivo:"in-house","in-house":"partenza",partenza:"arrivo"};
      item.kicker=cycle[item.kicker]||item.kicker;
    }
    persistThen().then(function(ok){ if(!ok){ data=snapAdv; render(); } });
  }
});
document.getElementById("root").addEventListener("keydown",function(e){
  if(e.key==="Enter"){
    var form=e.target.closest && e.target.closest("#fnew");
    if(form && e.target.tagName!=="TEXTAREA"){
      e.preventDefault();
      commitForm(form);
      return;
    }
  }
  var btn=e.target.closest && e.target.closest(".week-day[data-day]");
  if(!btn || grammarId!=="agenda") return;
  var days=weekDays(selectedDay);
  var i=days.findIndex(function(d){return d.iso===btn.getAttribute("data-day");});
  if(i<0) return;
  var nextIso=null;
  if(e.key==="ArrowRight"||e.key==="ArrowDown"){
    nextIso=i===days.length-1?shiftIso(days[0].iso,7):days[i+1].iso;
  } else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){
    nextIso=i===0?shiftIso(days[6].iso,-7):days[i-1].iso;
  } else if(e.key==="Home") nextIso=days[0].iso;
  else if(e.key==="End") nextIso=days[days.length-1].iso;
  else return;
  e.preventDefault();
  selectedDay=nextIso;
  render();
  var n=document.querySelector('[data-day="'+selectedDay+'"]');
  if(n) n.focus();
});
document.getElementById("root").addEventListener("submit",function(e){
  var f=e.target && e.target.closest ? (e.target.closest("form") || e.target) : e.target;
  if(!f || f.id!=="fnew") return;
  e.preventDefault();
  commitForm(f);
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
    grammar.id === "source-timeline"
      ? "Chrome da registro di repository: testata + rail, timeline commit, rami, stato sync, scarto/diff. Vietato hero grigio, due KPI, empty card, clone GitHub."
      : grammar.id === "agenda"
        ? "Chrome da agenda: binario orario, tab Oggi/Nuovo/Settimana/Archivio, tipo 17/headline, target 44px. Vietato hero KPI, tab Home/Elenco, riquadri vuoti."
        : grammar.chrome === "desk"
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

export function composeProduct(brief: string, opts?: TokenOptions): ComposedProduct {
  const tokens = tokensFromBrief(brief, opts);
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
