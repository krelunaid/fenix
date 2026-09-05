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
  graphicIntentFromBrief,
  enforceGraphicIntent,
  SYSTEM_FONT_STACK,
} from "../projects/graphic-intent.ts";
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
import { appIdentityIcon, isAccountantBrief, isBarberBrief, isFieldProductBrief, isShopBrief } from "../projects/app-identity.ts";
import { glossyWaterMarkSvg, premiumAppMarkSvg, premiumMarkDataUri } from "../projects/premium-mark.ts";
import { craftTokenCss, surfacesFromPalette } from "../projects/craft-tokens.ts";
import { accentButtonPair, contrastRatio } from "../projects/visual-quality.ts";
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

/** Parent SHA of the five-brief before/after. Frozen bffc58f baseline, not a quality score. */
export const GRAPHIC_FIVE_PARENT_SHA = "bffc58f1af1ee22e69b99a0ed3dd65eaba8822f9";

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

function seedNameFromBrief(brief: string): string {
  const raw = String(brief || "")
    .replace(/^FORMATO:[^\n]*\n+/i, "")
    .replace(/\bkind\s*=\s*\w+/gi, "")
    .replace(
      /(?:tipo system-ui|iphone-?like|font di sistema primario|font system-ui primario|serif da rivista|tab Home[^.]*|elenco e CRUD|non clonare[^.]*|cose da fare operative)/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const fallback = isBarberBrief(brief)
    ? "Barber"
    : isAccountantBrief(brief)
      ? "Contabilità"
      : isShopBrief(brief)
        ? "Negozio"
        : grammarFromBrief(brief).id === "agenda"
          ? "Agenda"
          : "Note";
  const named = raw.match(/(?:chiamata|chiamala|nome(?: dell.app)?|titolo)\s*[:=]?\s*["«]([^"»]{1,80})["»]/i)?.[1]?.trim();
  if (named) return named;
  const before = raw.split(/[:.]/)[0]!.trim().replace(/[,;]+$/g, "").trim();
  if (!before || /^(voglio|vorrei|una app|app stile|mi crei|crea(?:mi)?\b)/i.test(before)) return fallback;
  // A short title before ':' is an explicit product name, not a brief to cut.
  // Long descriptive requests get a concise domain name, never half a word.
  if (before.length <= 80 && raw.startsWith(`${before}:`)) return before;
  return before.length <= 28 ? before : fallback;
}

function synthesizeSpec(brief: string): PipelineSpec {
  const tokens = tokensFromBrief(brief);
  const grammar = grammarFromBrief(brief);
  const intent = graphicIntentFromBrief(brief);
  const name = seedNameFromBrief(brief);
  if (intent.chrome === "semantic") {
    return {
      id: `${tokens.family}-seed`,
      name,
      kicker: /^lista/i.test(name) ? "Le tue voci" : "In tasca",
      place: "Personale",
      collection: "voci",
      brief,
      tabs: [
        { id: "home", label: "Home" },
        { id: "nuovo", label: "Aggiungi" },
        { id: "elenco", label: "Elenco" },
        { id: "persona", label: "Persona" },
      ],
      rows: [],
      formTitle: "Nuova voce",
      cta: "Aggiungi",
    };
  }
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
        { id: "diff", label: "Diff" },
      ],
      rows: [
        { id: "v1", title: "Allinea il nastro delle voci", kicker: "main", note: "a3f1c2 · Marta", meta: "allineato" },
        { id: "v2", title: "Chiude il parser sul nastro", kicker: "feat/sync", note: "9b2e18 · Leo", meta: "in-volo" },
        { id: "v3", title: "Riduce il rumore sul diff", kicker: "fix/nastro", note: "c8d044 · Noa", meta: "in-attesa" },
        { id: "v4", title: `${name} in linea`, kicker: "main", note: "11ae90 · voce", meta: "allineato" },
      ],
      formTitle: "Registra una voce",
      cta: "Metti in linea",
    };
  }
  if (isAccountantBrief(brief)) {
    return {
      id: `${tokens.family}-fiscale`,
      name,
      kicker: grammar.voice.census,
      place: "Studio",
      collection: "pratiche",
      brief,
      tabs: [
        { id: "fatture", label: "Fatture" },
        { id: "clienti", label: "Clienti" },
        { id: "bilancio", label: "Bilancio" },
        { id: "pratiche", label: "Pratiche" },
      ],
      rows: [
        { id: "f1", title: "Fattura 104/A", kicker: "emessa", note: "Studio Bianchi · IVA 22%", meta: "€1.240" },
        { id: "f2", title: "F24 trimestre", kicker: "scadenza", note: "Erario · aprile", meta: "€860" },
        { id: "f3", title: "Consulenza 12", kicker: "bozza", note: "Società Nord · pratica", meta: "€420" },
      ],
      formTitle: "Nuova pratica",
      cta: "Registra in studio",
    };
  }
  if (isFieldProductBrief(brief) && grammar.id === "phone-seed") {
    return {
      id: `${tokens.family}-campo`,
      name,
      kicker: "Quadro di controllo",
      place: "In campo",
      collection: "missioni",
      brief,
      tabs: [
        { id: "home", label: "Home" },
        { id: "form", label: "Registra" },
        { id: "history", label: "Storico" },
        { id: "stats", label: "Statistiche" },
        { id: "list", label: "Gestione" },
      ],
      rows: [
        { id: "d1", title: "Marta Neri", kicker: "Attiva", note: "Operatrice · turno A", meta: "1.200 L", status: "ok" },
        { id: "d2", title: "Leo Bianchi", kicker: "Attiva", note: "Operatore · turno B", meta: "980 L", status: "ok" },
        { id: "d3", title: "Noa Greco", kicker: "Pausa", note: "Operatrice · turno A", meta: "640 L", status: "wait" },
        { id: "d4", title: "Pietro Sala", kicker: "Attiva", note: "Responsabile", meta: "1.480 L", status: "ok" },
        { id: "d5", title: "Eva Conti", kicker: "Attiva", note: "Operatrice · turno C", meta: "720 L", status: "ok" },
      ],
      formTitle: "Nuova missione",
      cta: "Registra in campo",
    };
  }
  if (isShopBrief(brief) && tokens.family !== "fashion" && tokens.family !== "perfume") {
    return {
      id: `${tokens.family}-negozio`,
      name,
      kicker: grammar.voice.census,
      place: "Banco",
      collection: "articoli",
      brief,
      tabs: [
        { id: "negozio", label: "Negozio" },
        { id: "cassa", label: "Cassa" },
        { id: "clienti", label: "Clienti" },
        { id: "magazzino", label: "Magazzino" },
      ],
      rows: [
        { id: "n1", title: "Articolo in banco", kicker: "in vendita", note: "scaffale A", meta: "€24" },
        { id: "n2", title: "Riga di magazzino", kicker: "scorta", note: "retro", meta: "12 pz" },
      ],
      formTitle: "Nuovo articolo",
      cta: "Metti in banco",
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
    place: "Studio",
    collection: "voci",
    brief,
    tabs: [
      { id: "home", label: "Tavolo" },
      { id: "nuovo", label: "Registra" },
      { id: "elenco", label: "Archivio" },
      { id: "studio", label: "Studio" },
    ],
    rows: [],
    formTitle: "Nuova riga",
    cta: "Salva nel mestiere",
  };
}

const AGENDA_EDIT_GLYPH =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 5.5 4 4M4.5 19.5l4.7-1.1L19 8.6a2.8 2.8 0 0 0-4-4l-9.4 9.8z"/><path d="m5.6 14.4 3.6 4"/></svg>';
const AGENDA_DEL_GLYPH =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4.5" width="16" height="4" rx="1.2"/><path d="M5.5 8.5v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-10M9.5 12h5"/></svg>';
const AGENDA_ACTION_LABELS: Record<string, string> = {
  prenotato: "Conferma", confermato: "Inizia", "in-corso": "Concludi", concluso: "Riapri",
};
const AGENDA_STATUS_LABELS: Record<string, string> = {
  prenotato: "Da confermare", confermato: "Confermato", "in-corso": "In corso", concluso: "Concluso",
};
const POCKET_EMPTY_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4.5" width="14" height="15" rx="2"/><path d="M8.2 9.2h7.6M8.2 12.4h7.6M8.2 15.6h5"/></svg>';
const FX_SEARCH_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6 20 20"/></svg>';
const FX_EDIT_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.2 5.6 4.2 4.2M5 19l1.2-4.8L16.6 3.8a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L9.8 17.8z"/></svg>';
const FX_PAUSE_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M10 9.2v5.6M14 9.2v5.6"/></svg>';
const FX_CHEVRON_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const FX_EXIT_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4A1.8 1.8 0 0 1 18.2 20h-6.4A1.8 1.8 0 0 1 10 18.2V17"/><path d="M4 12h10M11.2 8.8 14.4 12l-3.2 3.2"/></svg>';

function italianLongDate(d = new Date()): string {
  const raw = d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
}

function agendaActs(id: string, status: string): string {
  const label = AGENDA_ACTION_LABELS[status] || "Conferma";
  return `<div class="slot-actions"><button class="btn sm ghost" data-act="advance" data-id="${id}" aria-label="${label} appuntamento">${label}</button><button class="btn sm ghost" data-act="edit" data-id="${id}" aria-label="Modifica">${AGENDA_EDIT_GLYPH}</button><button class="btn sm ghost" data-act="del" data-id="${id}" aria-label="Archivia">${AGENDA_DEL_GLYPH}</button></div>`;
}

function agendaRailMarkup(spec: PipelineSpec, grammar: LayoutGrammar): string {
  const slots = spec.rows
    .map((e, i) => {
      const state = i === 0 ? "on" : "idle";
      const status = e.status || "prenotato";
      return `<article class="slot" data-id="${e.id}" data-state="${state}" data-status="${status}"><time class="time" datetime="${e.kicker}">${e.kicker}</time><div class="slot-body"><h2>${e.title}</h2><p class="notes slot-detail">${e.note} · ${e.meta}</p><span class="chip slot-status ${status}">${AGENDA_STATUS_LABELS[status] || status}</span>${agendaActs(e.id, status)}</div></article>`;
    })
    .join("");
  return `<div class="day-head"><p class="kicker">${spec.kicker}</p><h2 id="day-label">${spec.rows.length} ${grammar.voice.census}</h2></div><div class="day-rail" data-fenix-rail="day" id="day-rail" role="tabpanel" aria-labelledby="day-label">${slots}</div>`;
}

function tabSvg(tab: { id: string; label: string }, i: number, campo = false): string {
  if (campo && /^home$/i.test(tab.label)) return craftNavIcon({ id: "home", label: "Consegne" });
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
.notes,.look p,.room .notes,.ticket .notes,.fragrance .notes,.commit .notes{color:var(--ink-quiet);font-size:var(--t-subhead,var(--t-footnote));line-height:1.45}
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

function safeAccentInk(t: DesignTokens): string {
  const fill = t.palette.accent;
  const ink = t.palette.accentInk || "#fffdf8";
  if (contrastRatio(fill, ink) >= 4.5) return ink;
  return accentButtonPair(fill).ink;
}

function displayStack(t: DesignTokens): string {
  if (t.fonts.display === "system-ui" || t.fonts.body === "system-ui") {
    return SYSTEM_FONT_STACK;
  }
  const serifFace = /Literata|Newsreader|Fraunces|Garamond|Playfair|Source Serif|Georgia/i.test(
    t.fonts.display,
  );
  if (t.family === "repo" || t.family === "ops") {
    return `"${t.fonts.display}",ui-monospace,"IBM Plex Mono",Menlo,monospace`;
  }
  if (isOperationalApp(t) || t.family === "utility") {
    return `"${t.fonts.display}",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  }
  if (
    serifFace ||
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
  return `"${t.fonts.display}",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
}

function bodyStack(t: DesignTokens): string {
  if (t.fonts.body === "system-ui" || t.fonts.display === "system-ui") {
    return SYSTEM_FONT_STACK;
  }
  if (/Literata|Newsreader|Fraunces|Garamond|Playfair|Source Serif|Georgia/i.test(t.fonts.body)) {
    return `"${t.fonts.body}",ui-serif,Georgia,"Times New Roman",serif`;
  }
  return `"${t.fonts.body}",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
}

function familyChromeCss(t: DesignTokens, grammar: LayoutGrammar): string {
  const operational = isOperationalApp(t);
  const brand = operational
    ? `.brand{font-weight:700;letter-spacing:-.028em;line-height:1.15}
header{align-items:center}`
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
    ? `nav.tabs{border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 86%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px)}
nav.tabs button.on{color:var(--accent);background:transparent}
header{background:var(--surface)}
.week-day.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.week-day.on .kicker,.week-day.on .count{color:var(--accent-ink)}`
    : grammar.chrome === "tabs"
      ? `nav.tabs{border-top:2px solid var(--accent);background:color-mix(in srgb,var(--surface) 86%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px)}
nav.tabs button.on{color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);border-radius:calc(var(--r) * .4)}`
      : `nav.rail{background:color-mix(in srgb,var(--surface) 86%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px)}
nav.rail button.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}`;
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
      ? `.hero{min-height:0;height:auto;overflow:visible;background:transparent}
  .hero .stage{width:100%;line-height:0;display:block}
  .hero svg{width:100%;height:auto;aspect-ratio:640/420;min-height:0;display:block}
  .hero .caption,.plate.hero .caption{position:static;padding:12px 8px 8px;background:none}
  .collection{display:grid;gap:12px;align-content:start;align-items:start}
  .fragrance{display:grid;grid-template-columns:88px 1fr;gap:14px}
  .thumb{width:88px;height:112px;border-radius:calc(var(--r) * .5);overflow:hidden}
  .thumb svg{width:88px;height:112px}`
      : id === "lookbook"
        ? `.lookbook{display:grid;gap:12px}.look{overflow:hidden;padding:0;display:flex;flex-direction:column;margin:0}
  .look .sil{position:relative;height:min(54vh,460px);min-height:280px;margin:0}
  .look .sil svg{position:absolute;inset:0;width:100%;height:100%;display:block}
  .look h2,.look p{flex:0 0 auto}`
        : id === "hospitality"
          ? `.rooms{display:grid;gap:14px}.room{display:grid;grid-template-columns:120px 1fr;gap:14px}.room .thumb{width:120px;height:96px}.room .thumb svg{width:120px;height:96px}.hero{min-height:24vh;max-height:28vh}.hero svg{height:24vh;min-height:140px}`
          : id === "service-board"
            ? `.hero,.hero.plate{min-height:0;height:auto;overflow:visible;background:transparent}
  .hero .stage,.hero.plate .stage{width:100%;line-height:0;display:block}
  .hero svg,.plate.hero svg{width:100%;height:auto;aspect-ratio:640/420;min-height:0;display:block}
  .hero .caption,.plate.hero .caption{position:static;padding:12px 8px 8px;background:none}
  .tickets{display:grid;gap:10px;align-content:start}.ticket{display:grid;grid-template-columns:96px 1fr auto;gap:12px;align-items:center;min-height:88px}
  .ticket .thumb{width:96px;height:80px;overflow:hidden;position:relative;border-radius:calc(var(--r) * .4)}
  .ticket .thumb svg{width:96px;height:80px;display:block}`
            : id === "pocket-tool"
              ? `.hero{min-height:22vh;max-height:26vh}.hero svg{height:22vh;min-height:120px;width:100%}
  .ticket{display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;min-height:76px}
  .ticket .thumb{width:72px;height:56px;overflow:hidden}
  .ticket .thumb svg{width:72px;height:56px;display:block}`
            : id === "agenda"
              ? `.hero{display:none;min-height:0;height:0;margin:0;border:0}
  .day-head{padding:2px 0 8px}
  .day-head h2{font-family:var(--body),ui-sans-serif,system-ui,sans-serif;font-size:var(--t-large);font-weight:700;letter-spacing:-.03em;line-height:1.12;color:var(--ink-loud)}
  .day-rail{display:flex;flex-direction:column;gap:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .slot{display:grid;grid-template-columns:56px minmax(0,1fr);gap:10px;align-items:start;padding:14px 16px;margin:0;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;min-height:64px;box-shadow:none}
  .slot:last-child{border-bottom:0}
  .slot[data-state="on"]{border-color:var(--line);background:transparent}
  .slot:hover,.slot:active{transform:none;filter:none;box-shadow:none;border-color:var(--line)}
  .slot .time{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";font-size:15px;font-weight:650;color:var(--fg);padding-top:3px;letter-spacing:-.015em}
  .slot-body h2{font-family:var(--body),ui-sans-serif,system-ui,sans-serif;font-size:var(--t-headline);font-weight:650;letter-spacing:-.022em;margin:0 0 4px;line-height:1.2;color:var(--ink-loud)}
  .slot-actions{display:flex;flex-wrap:nowrap;gap:4px;margin-top:8px;align-items:center;overflow:visible}
  .slot .btn{margin-top:0;flex:0 0 auto;white-space:nowrap;min-height:44px}
  .slot-actions [data-act="edit"],.slot-actions [data-act="del"]{min-width:44px;min-height:44px;padding:8px}
  .slot-actions .btn svg{display:block;margin:0 auto}
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
            : id === "phone-seed"
              ? `.hero{display:none;min-height:0;height:0;margin:0;border:0}
  .home-overview,.list-pane,.persona-pane{display:flex;flex-direction:column;gap:12px;padding:0;max-width:40rem;width:100%;margin:0 auto}
  .home-hero,.home-aside .card,.persona-pane .card,.persona-privacy,[data-fenix-pane="nuovo"] [data-fenix-crud],.wipe-box{background:color-mix(in srgb,var(--surface) 88%,var(--accent) 8%);border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 0 color-mix(in srgb,var(--fg) 4%,transparent),0 8px 22px color-mix(in srgb,var(--fg) 6%,transparent)}
  .home-hero{padding:16px 16px 14px}
  .home-count{font-family:var(--display);font-size:2.05rem;font-weight:700;letter-spacing:-.05em;line-height:1;margin:2px 0 8px;color:var(--accent);font-variant-numeric:tabular-nums}
  .home-count b{font:inherit}
  .home-count span{display:block;font-family:var(--body);font-size:13px;font-weight:650;letter-spacing:.02em;color:var(--muted);margin-top:6px}
  .home-first{padding:2px 0 0;max-width:none}
  .home-first .mark{width:44px;height:44px;margin:2px 0 10px;color:var(--accent)}
  .home-first .mark svg{width:44px;height:44px;display:block}
  .home-first h2,.list-head h2,.persona-pane > h2{font-family:var(--display);font-size:1.28rem;font-weight:700;letter-spacing:-.03em;line-height:1.15;margin:0 0 6px;color:var(--ink-loud)}
  .home-first .notes,.home-hero > .notes,.persona-pane > .notes{color:var(--muted);font-size:15px;line-height:1.45;margin:0 0 12px}
  .home-first .btn{min-height:48px;width:100%;max-width:280px;padding:14px 22px;font-size:16px;border-radius:14px}
  .home-hero > .btn{min-height:48px;width:100%;max-width:280px;padding:14px 22px;font-size:16px;border-radius:14px}
  .home-aside{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .home-aside .card{margin:0;padding:12px;min-height:0}
  .home-aside h2{font-size:.98rem;margin:0 0 2px}
  .home-aside .notes{margin:0;font-size:13px;line-height:1.35;color:var(--muted)}
  .home-recent{display:flex;flex-direction:column;gap:0;background:color-mix(in srgb,var(--surface) 92%,var(--bg));border:1px solid var(--line);border-radius:16px;overflow:hidden;padding:10px 0 0}
  .home-recent > .kicker{padding:0 16px 8px}
  .home-recent .card{margin:0;padding:12px 16px;border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none;background:transparent}
  .pocket-list{list-style:none;list-style-type:none;margin:0;padding:0;padding-inline-start:0;display:flex;flex-direction:column;gap:0;overflow:visible;background:color-mix(in srgb,var(--surface) 92%,var(--bg));border:1px solid var(--line);border-radius:16px}
  .pocket-list > li{list-style:none;list-style-type:none;display:block;margin:0;padding:0;border-bottom:1px solid var(--line);background:transparent}
  .pocket-list > li:last-child{border-bottom:0}
  .pocket-list > li::marker{content:none;font-size:0}
  .pocket-list .card{margin:0;padding:14px 16px;min-height:64px;border-radius:0;overflow:hidden;max-width:100%;box-sizing:border-box;border:0;box-shadow:none;background:transparent}
  .pocket-list .card h2,.home-recent .card h2{font-size:17px;margin:0;letter-spacing:-.02em;overflow-wrap:anywhere}
  .pocket-list .card .notes,.home-recent .card .notes{margin:6px 0 0;overflow-wrap:anywhere}
  .pocket-list .slot-actions{display:flex;gap:6px;margin-top:10px}
  .pocket-list .slot-actions .btn{min-width:44px;min-height:44px}
  .list-head{padding:2px 2px 4px}
  .persona-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .persona-pane .card{margin:0;padding:14px 16px;min-height:0}
  .persona-privacy{margin:0;padding:14px 16px}
  .persona-pane .btn,.wipe-box .btn{min-height:44px;width:100%;max-width:280px;border-radius:14px}
  .wipe-box{padding:14px 16px;margin:0}
  .wipe-box[data-state="ask"]{border-color:var(--accent)}
  .wipe-actions{display:flex;gap:8px;margin-top:10px}
  .wipe-actions .btn{max-width:none;flex:1}
  .state-empty{padding:16px 14px;border:1px dashed var(--line);border-radius:16px;background:color-mix(in srgb,var(--surface) 70%,transparent)}
  nav.tabs{grid-template-columns:repeat(4,minmax(0,1fr))}
  nav.tabs button span{overflow:visible;max-width:none;text-overflow:clip}
  html[data-grammar="phone-seed"] header{padding:14px 18px 10px}
  html[data-grammar="phone-seed"] .brand{font-size:1.5rem;letter-spacing:-.04em}
  html[data-grammar="phone-seed"] header .place{font-size:13px}
  html[data-grammar="phone-seed"] .app{display:grid;grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"head" "main" "nav";height:100dvh;max-height:100dvh;min-height:100dvh}
  html[data-grammar="phone-seed"] main{min-height:0;overflow:auto;padding:8px 16px 16px}
  html[data-grammar="phone-seed"] nav.tabs{position:relative;bottom:auto;height:calc(72px + env(safe-area-inset-bottom));padding:8px 6px calc(10px + env(safe-area-inset-bottom))}
  html[data-grammar="phone-seed"] nav.tabs button{gap:5px;font:650 12px/1.15 var(--body),sans-serif;min-height:48px;padding:6px 4px}
  html[data-grammar="phone-seed"] nav.tabs svg{width:28px;height:28px;flex:0 0 28px}
  html[data-grammar="phone-seed"] nav.tabs button.on{color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));border-radius:14px;font-weight:650}
  html[data-grammar="phone-seed"] [data-fenix-crud]{padding:18px 16px;border-radius:16px;background:color-mix(in srgb,var(--surface) 88%,var(--accent) 6%)}
  html[data-grammar="phone-seed"] [data-fenix-crud] h2{font-size:1.28rem;margin:0 0 4px}
  html[data-grammar="phone-seed"] [data-fenix-crud] .btn{width:100%;border-radius:14px}
  html[data-chroma="chroma-pulse"] .home-hero,html[data-chroma="ink-terminal"] .home-hero{background:color-mix(in srgb,var(--accent) 16%,var(--surface))}
  html[data-chroma="pastel-studio"] .home-hero,html[data-chroma="luminous-paper"] .home-hero{background:color-mix(in srgb,var(--accent) 10%,var(--surface))}`
            : "";
  return `${stage}
.app{display:grid;grid-template-rows:auto 1fr auto;grid-template-areas:"head" "main" "nav";width:100%;min-height:100dvh}
header{grid-area:head;padding:14px 16px 10px}
nav.tabs{grid-area:nav;display:grid;grid-template-columns:repeat(4,1fr);height:calc(64px + env(safe-area-inset-bottom));padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 86%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px);position:sticky;bottom:0;z-index:8}
nav.tabs button{border:0;background:none;color:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:600 10px/1.1 var(--body),sans-serif;padding:4px 2px;min-height:44px;min-width:44px;touch-action:manipulation}
nav.tabs button.on{color:var(--accent)}
nav.tabs svg{width:24px;height:24px;flex:0 0 24px;overflow:visible;display:block;margin-inline:auto}
main{grid-area:main;min-height:0;overflow:auto;padding:8px 16px 20px}
@media(min-width:768px){
  .app{grid-template-rows:auto 1fr;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"head nav" "main main"}
  header{padding:14px 22px;border-bottom:1px solid var(--line);align-items:center}
  nav.tabs{position:static;display:flex;flex-direction:row;flex-wrap:wrap;height:auto;min-height:56px;border:0;border-bottom:1px solid var(--line);padding:8px 18px;justify-content:flex-end;align-items:center;background:transparent}
  nav.tabs button{flex-direction:row;font:650 13px/1 var(--body),sans-serif;min-height:44px;padding:8px 12px;gap:8px}
  nav.tabs svg{display:block;margin-inline:0}
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
      ? `main{display:grid;grid-template-columns:minmax(240px,.9fr) minmax(280px,1.1fr);gap:16px;align-content:start;align-items:start}
  .hero,.hero.plate,.plate{grid-column:1;grid-row:1;align-self:start;min-height:0;height:auto;overflow:visible;margin:0}
  .hero svg,.plate svg,.hero.plate svg,.plate.hero svg{height:auto;min-height:0;max-height:min(38vh,280px);width:100%;display:block}
  .hero .caption,.plate.hero .caption{position:static;background:none;padding:12px 4px 0}
  .tickets,.span{grid-column:2}`
      : id === "split-stage"
        ? `.hero{min-height:0;height:auto;overflow:visible;background:transparent}
  .hero svg{height:auto;aspect-ratio:640/420;width:100%;min-height:0}
  .hero .caption{position:static;background:none;padding:12px 8px 8px}`
      : id === "agenda"
        ? `.hero{display:none;min-height:0;height:0}
  .day-head{padding-bottom:8px}
  .slot{min-height:80px;padding:16px 18px}
  .week-strip,.week-nav{margin-bottom:12px}`
        : id === "phone-seed"
        ? `.home-overview,.list-pane,.persona-pane{max-width:none}
  .home-overview{display:grid;grid-template-columns:minmax(280px,1.15fr) minmax(240px,.85fr);gap:16px;align-items:start;min-height:0;max-width:960px;margin-inline:auto}
  .home-hero{grid-column:1;margin:0;min-height:0;display:flex;flex-direction:column}
  .home-aside{grid-column:2;margin:0;min-height:0;grid-template-columns:1fr;gap:10px}
  .home-aside .card{height:auto;min-height:0}
  .home-recent{grid-column:1 / -1}
  .home-first .btn,.home-hero > .btn{max-width:none}
  .persona-facts{grid-template-columns:repeat(3,minmax(0,1fr))}
  .list-pane,.persona-pane{max-width:720px;margin-inline:auto;width:100%}
  [data-fenix-pane="nuovo"]{display:flex;justify-content:center}
  [data-fenix-pane="nuovo"] [data-fenix-crud]{width:min(460px,100%)}
  html[data-grammar="phone-seed"] main{padding:22px 28px 40px}
  html[data-grammar="phone-seed"] .app{height:auto;max-height:none;min-height:100dvh;grid-template-rows:auto 1fr;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"head nav" "main main"}
  html[data-grammar="phone-seed"] nav.tabs{position:static;height:auto}`
        : ""
  }
}
@media(min-width:1024px){
  header,nav.tabs{padding-left:40px;padding-right:40px}
  main{padding:28px 40px}
  ${
    id === "split-stage"
      ? `main{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(360px,1.15fr);gap:24px;align-content:start;align-items:start}
  .hero{grid-column:1;grid-row:1;align-self:start;min-height:0;height:auto;overflow:visible;margin:0;position:sticky;top:16px;background:transparent}
  .hero svg{height:auto;min-height:0;aspect-ratio:640/420;width:100%;display:block}
  .hero .caption{position:static;background:none;padding:12px 4px 0}
  .collection,.span{grid-column:2}`
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
            ? `main{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(340px,1.15fr);gap:24px;align-content:start;align-items:start}
  .hero,.plate,.hero.plate{grid-column:1;grid-row:1;align-self:start;min-height:0;height:auto;overflow:visible;margin:0;position:sticky;top:16px}
  .hero svg,.plate svg,.hero.plate svg,.plate.hero svg{height:auto;min-height:0;max-height:min(52vh,420px);width:100%;display:block}
  .hero .caption,.plate.hero .caption{position:static;background:none;padding:12px 4px 0}
  .span,.tickets{grid-column:2}
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
            : id === "phone-seed"
              ? `.app{max-width:1080px;margin-inline:auto}
  main{padding:28px 36px 48px}
  .home-overview{grid-template-columns:minmax(320px,1.1fr) minmax(260px,.9fr);gap:20px;max-width:960px;align-items:start;min-height:0}
  .home-count{font-size:2.4rem}
  .persona-facts{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}`
            : ""
  }
}`;
}

function deskCss(id: GrammarId): string {
  if (id === "source-timeline") {
    return `.app[data-fenix-craft-desk]{display:grid;grid-template-rows:auto auto 1fr;grid-template-areas:"head" "nav" "main";min-height:100dvh;width:100%}
header{grid-area:head;padding:12px 16px;border-bottom:1px solid var(--line);align-items:center;gap:16px;overflow:visible}
header .place{max-width:46%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:right}
nav.rail{grid-area:nav;display:flex;gap:4px;overflow:auto;padding:6px 16px;border-bottom:1px solid var(--line)}
nav.rail button{border:0;background:none;color:var(--muted);min-height:44px;padding:8px 10px;font:650 13px/1 var(--body),system-ui,sans-serif;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;border-radius:0}
nav.rail button.on{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}
nav.rail svg{width:16px;height:16px;flex:0 0 16px;overflow:visible;display:block}
@media(max-width:390px){nav.rail{flex-wrap:wrap;overflow:visible}nav.rail button{flex:1 1 calc(50% - 8px);justify-content:center;min-width:44px}}
main{grid-area:main;padding:0;min-width:0;display:flex;flex-direction:column}
.repo-stage{display:grid;grid-template-columns:1fr;min-height:0;flex:1}
.timeline{padding:12px 16px 20px;border-right:0}
.commit{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line);margin:0;background:transparent;border-radius:0;cursor:pointer}
.commit h2{font-family:var(--body);font-size:15px;font-weight:650;letter-spacing:-.02em;margin:0 0 4px}
.commit .slot-actions{display:flex;flex-wrap:nowrap;gap:4px}
.commit .slot-actions .btn{white-space:nowrap;margin-top:0}
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
nav.rail svg{width:18px;height:18px;flex:0 0 18px;overflow:visible;display:block}
nav.rail span{overflow:visible;max-width:none}
@media(max-width:390px){nav.rail{flex-wrap:wrap;overflow:visible}nav.rail button{flex:1 1 calc(50% - 8px);justify-content:center;min-width:44px}}
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
header{grid-area:head;padding:18px 20px;border-bottom:1px solid var(--line);align-items:center}
nav.rail{grid-area:nav;display:flex;gap:6px;overflow:auto;padding:8px 20px;border-bottom:1px solid var(--line)}
nav.rail button{border:0;background:none;color:var(--muted);min-height:44px;padding:8px 12px;font:650 13px/1.2 var(--body),sans-serif;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;border-radius:10px}
nav.rail button.on{color:var(--fg);box-shadow:inset 0 -2px 0 var(--accent)}
nav.rail svg{width:18px;height:18px;flex:0 0 18px;overflow:visible;display:block}
@media(max-width:390px){nav.rail{flex-wrap:wrap;overflow:visible}nav.rail button{flex:1 1 calc(50% - 8px);justify-content:center;min-width:44px}}
main{grid-area:main;padding:20px;min-width:0}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin:0 0 16px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.kpi{background:var(--surface);border:0;border-radius:0;padding:16px 16px 14px;min-height:84px;min-width:0;margin:0}
.kpi b{display:block;font-family:var(--display);font-size:clamp(1.15rem,2.4vw,1.55rem);letter-spacing:-.03em;line-height:1.15;overflow:visible;white-space:normal;word-break:break-word;font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{width:100%;min-width:520px;border-collapse:collapse;background:transparent;border:0}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);font-size:15px}
th{font-size:12px;font-weight:650;letter-spacing:0;text-transform:none;color:var(--muted)}
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
  header{padding:18px 24px}
  nav.rail{padding:8px 24px;justify-content:flex-start}
  main{padding:24px}
  .kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
  .board{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ledger-art{height:120px}
  .ledger-art svg{height:120px}
}
@media(min-width:1024px){header,nav.rail,main{padding-left:32px;padding-right:32px}main{padding-top:24px}}`;
}

function productChromeCss(): string {
  return `/* product-chrome: cards, pills, board, tank, splash — tokens only */
.fx-date{margin:0 0 12px;font-size:15px;font-weight:500;color:var(--muted);letter-spacing:-.01em}
.fx-date::first-letter{text-transform:uppercase}
.fx-large{font-family:var(--display);font-size:1.85rem;font-weight:750;letter-spacing:-.04em;line-height:1.1;margin:0 0 4px;color:var(--fg)}
.fx-sub{margin:0 0 14px;font-size:15px;line-height:1.4;color:var(--muted)}
.fx-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 0 12px}
.fx-toolbar h2{margin:0}
.fx-nuovo{appearance:none;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:8px 14px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font:650 14px/1.2 var(--body),system-ui,sans-serif}
.fx-search{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 14px;margin:0 0 12px;border:1px solid var(--line);border-radius:14px;background:var(--elevated);color:var(--muted)}
.fx-search svg{width:18px;height:18px;flex:0 0 18px}
.fx-search input{border:0;background:transparent;color:var(--fg);font:400 17px/1.4 var(--body),system-ui,sans-serif;min-height:46px;width:100%;outline:none}
.fx-pills,.fx-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.fx-pill,.fx-filter{appearance:none;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:999px;min-height:36px;padding:6px 13px;font:650 13px/1.2 var(--body),system-ui,sans-serif}
.fx-filter{border-radius:12px;min-height:40px;display:inline-flex;align-items:center;gap:6px}
.fx-filter svg{width:16px;height:16px}
.fx-pill.on,.fx-filter.on,.fx-seg button.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.fx-board{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px;margin:0 0 14px;border-radius:22px;background:var(--fg);color:var(--bg)}
.fx-board .fx-cell{padding:12px 12px 10px;border-radius:14px;background:color-mix(in srgb,var(--bg) 12%,transparent);min-height:72px}
.fx-board .fx-cell b{display:block;font:750 1.35rem/1.1 var(--display),system-ui,sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fx-board .fx-cell span{display:block;margin-top:4px;font-size:12px;opacity:.78}
.fx-board .fx-cell[data-warn] b{color:color-mix(in srgb,var(--warning) 70%,var(--bg))}
.fx-tank{margin:0 0 14px;padding:16px 16px 14px;border-radius:22px;background:var(--fg);color:var(--bg)}
.fx-tank .fx-seg{margin:0 0 14px;border-color:color-mix(in srgb,var(--bg) 22%,transparent)}
.fx-tank .fx-seg button{color:color-mix(in srgb,var(--bg) 82%,transparent);border-right-color:color-mix(in srgb,var(--bg) 18%,transparent)}
.fx-tank .fx-seg button.on{background:var(--bg);color:var(--fg)}
.fx-tank-well{position:relative;height:168px;border-radius:18px;overflow:hidden;background:color-mix(in srgb,var(--bg) 10%,transparent);border:1px solid color-mix(in srgb,var(--bg) 16%,transparent)}
.fx-tank-well i{position:absolute;left:0;right:0;bottom:0;background:var(--accent);border-radius:0}
.fx-tank-well b{position:absolute;inset:0;display:grid;place-items:center;font:750 2.1rem/1 var(--display),system-ui,sans-serif;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.fx-tank p{margin:12px 0 0;font:650 15px/1.3 var(--body),system-ui,sans-serif;font-variant-numeric:tabular-nums}
.fx-ok{display:inline-flex;align-items:center;justify-content:center;margin:12px auto 0;min-height:36px;padding:8px 14px;border-radius:999px;background:color-mix(in srgb,var(--success) 22%,var(--fg));color:var(--bg);font:650 13px/1.2 var(--body),system-ui,sans-serif}
.fx-seg{display:flex;overflow:hidden;margin:0 0 14px;border:1px solid var(--line);border-radius:12px}
.fx-seg button{flex:1;border:0;border-right:1px solid var(--line);background:var(--surface);color:var(--fg);min-height:44px;padding:8px 6px;font:650 13px/1.2 var(--body),system-ui,sans-serif}
.fx-seg button:last-child{border-right:0}
.fx-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:16px;margin:0 0 14px}
.fx-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fx-metric{padding:12px;border-radius:14px;background:color-mix(in srgb,var(--accent) 8%,var(--elevated));min-height:72px}
.fx-metric b{display:block;font:750 1.2rem/1.15 var(--display),system-ui,sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fx-metric:first-child b{color:var(--accent)}
.fx-metric span{display:block;margin-top:4px;font-size:12px;color:var(--muted)}
.fx-trend{display:inline-flex;align-items:center;min-height:26px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--success) 16%,var(--surface));color:var(--success);font:650 12px/1 var(--body),system-ui,sans-serif;font-variant-numeric:tabular-nums}
.fx-proj{margin-top:12px;padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--fg)}
.fx-proj b{color:var(--accent)}
.fx-hi-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.fx-hi-row:last-child{border-bottom:0}
.fx-hi-ico{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent);flex:0 0 36px}
.fx-hi-ico svg{width:18px;height:18px}
.fx-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
.fx-table{width:100%;border-collapse:collapse;min-width:320px}
.fx-table th,.fx-table td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:middle}
.fx-table th{font-size:12px;font-weight:650;color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--surface))}
.fx-table tr:last-child td{border-bottom:0}
.fx-table .name b{display:block;font-size:15px;letter-spacing:-.02em}
.fx-table .name small{display:block;margin-top:2px;color:var(--muted);font-size:12px}
.fx-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);vertical-align:middle}
.fx-dot.wait{background:var(--warning)}
.fx-iconbtn{appearance:none;border:1px solid var(--accent);background:transparent;color:var(--accent);width:36px;height:36px;border-radius:10px;display:inline-grid;place-items:center;padding:0}
.fx-iconbtn svg{width:16px;height:16px}
.fx-record{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:start;padding:14px;margin:0 0 10px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
.fx-record h2{font-size:1.15rem;margin:0 0 4px}
.fx-ico{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}
.fx-ico svg{width:22px;height:22px}
.fx-badge{display:inline-flex;margin-top:8px;min-height:22px;padding:2px 8px;border-radius:999px;border:1px solid var(--warning);color:var(--warning);font:650 11px/1.2 var(--body),system-ui,sans-serif}
.fx-badge.ok{border-color:var(--success);color:var(--success)}
.fx-total{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--accent);font:650 13px/1 var(--body),system-ui,sans-serif;font-variant-numeric:tabular-nums}
.fx-jump{display:flex;align-items:center;gap:12px;padding:14px;margin:0 0 14px;border:1px solid var(--accent);border-radius:18px;background:var(--surface);color:var(--fg)}
.fx-jump svg:last-child{margin-left:auto;width:18px;height:18px;color:var(--muted)}
.fx-splash{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--bg);color:var(--fg)}
.fx-splash[hidden]{display:none}
.fx-splash .fx-mark{width:88px;height:88px;border-radius:26px;overflow:hidden;box-shadow:0 12px 32px color-mix(in srgb,var(--fg) 12%,transparent)}
.fx-splash .fx-mark svg{width:88px;height:88px;display:block}
.fx-splash strong{font:750 1.45rem/1.1 var(--display),system-ui,sans-serif;letter-spacing:-.03em}
.fx-spin{width:22px;height:22px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:fenix-spin .8s linear infinite}
.fx-splash .notes{font-size:14px;color:var(--muted)}
.app-mark{border-radius:14px;overflow:hidden;padding:0}
.app-mark svg[data-fenix-premium-mark]{width:44px;height:44px;display:block}
html[data-grammar="ops-desk"] .table-wrap thead th{background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent);font-weight:650}
html[data-fenix-campo]{--navy:var(--inverse);--water:var(--brand);--ok-loud:var(--ok)}
html[data-fenix-campo],html[data-fenix-campo] body{background:var(--surface-2);color:var(--on-surface)}
html[data-fenix-campo] header{position:sticky;top:0;z-index:6;padding:12px 16px 10px;background:color-mix(in srgb,var(--surface) 78%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(16px);backdrop-filter:saturate(1.6) blur(16px)}
html[data-fenix-campo]:has(nav.tabs button:first-child.on) header{display:none}
html[data-fenix-campo] nav.tabs{background:color-mix(in srgb,var(--surface) 82%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(18px);backdrop-filter:saturate(1.8) blur(18px)}
html[data-fenix-campo] .home-hero{background:transparent;border:0;box-shadow:none;padding:0}
html[data-fenix-campo] .home-aside,html[data-fenix-campo] .home-recent{display:none}
html[data-fenix-campo] .home-count,html[data-fenix-campo] .home-hero>.btn{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
html[data-fenix-campo] #fk-saved,html[data-fenix-campo] [data-fenix-kit-list]{display:none}
html[data-fenix-campo] .fx-hello-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:4px 0 4px}
html[data-fenix-campo] .fx-hello{margin:0;font:750 var(--fx-t-display)/1.05 var(--display),system-ui,sans-serif;letter-spacing:-.04em;color:var(--on-surface)}
html[data-fenix-campo] .fx-role{margin:4px 0 0;font:500 var(--fx-t-14)/1.3 var(--body),system-ui,sans-serif;color:var(--muted)}
html[data-fenix-campo] .fx-date{margin:0 0 16px;font:500 var(--fx-t-14)/1.3 var(--body),system-ui,sans-serif;color:color-mix(in srgb,var(--on-surface) 48%,#94a3b8)}
html[data-fenix-campo] .fx-exit{width:40px;height:40px;border:0;border-radius:50%;background:var(--brand-soft);color:var(--brand-2);display:grid;place-items:center;flex:0 0 40px}
html[data-fenix-campo] .fx-exit svg{width:18px;height:18px}
html[data-fenix-campo] .fx-inverse{margin:0 0 12px;padding:16px 16px 14px;border-radius:var(--fx-r3);background:var(--inverse);color:#f8fafc;box-shadow:var(--shadow-card)}
html[data-fenix-campo] .fx-hero{box-shadow:var(--shadow-float);background:linear-gradient(180deg,color-mix(in srgb,#1e293b 52%,var(--inverse)) 0%,var(--inverse) 32%)}
html[data-fenix-campo] .fx-shell-kicker{margin:0 0 12px;font:650 var(--fx-t-14)/1.3 var(--body),system-ui,sans-serif;letter-spacing:-.01em;color:color-mix(in srgb,#f8fafc 78%,transparent)}
html[data-fenix-campo] .fx-inverse .fx-board,html[data-fenix-campo] .fx-inverse .fx-tank{background:transparent;color:inherit;margin:0;padding:0;border-radius:0;box-shadow:none}
html[data-fenix-campo] .fx-inverse .fx-board{display:grid;grid-template-columns:1fr 1fr;gap:8px}
html[data-fenix-campo] .fx-inverse .fx-cell{padding:12px;border-radius:var(--fx-r2);min-height:72px;background:var(--tile);border:0}
html[data-fenix-campo] .fx-inverse .fx-cell b{color:#fff;font-size:var(--fx-t-20)}
html[data-fenix-campo] .fx-inverse .fx-cell span{color:color-mix(in srgb,#f8fafc 70%,transparent)}
html[data-fenix-campo] .fx-inverse .fx-cell[data-warn] b{color:var(--warn)}
html[data-fenix-campo] .fx-toggle{display:flex;margin:0 0 14px;padding:4px;border-radius:var(--fx-pill);background:rgba(255,255,255,.1);border:0;overflow:hidden}
html[data-fenix-campo] .fx-toggle button{flex:1;border:0;background:transparent;color:color-mix(in srgb,#f8fafc 78%,transparent);min-height:36px;border-radius:var(--fx-pill);font:650 var(--fx-t-14)/1.2 var(--body),system-ui,sans-serif}
html[data-fenix-campo] .fx-toggle button.on{background:#fff;color:var(--inverse)}
html[data-fenix-campo] .fx-tank-frame{display:grid;grid-template-columns:minmax(0,1fr) 28px;gap:8px;align-items:stretch}
html[data-fenix-campo] .fx-tank-well{height:168px;border-radius:var(--fx-r3);overflow:hidden;background:rgba(2,8,20,.38);border:1.5px solid color-mix(in srgb,#fff 30%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 26%,transparent),inset 0 -10px 18px rgba(2,8,20,.18)}
html[data-fenix-campo] .fx-tank-grid{position:absolute;inset:0;background:repeating-linear-gradient(to bottom,transparent 0 24%,color-mix(in srgb,#fff 16%,transparent) 24% calc(24% + 1px));pointer-events:none}
html[data-fenix-campo] .fx-tank-well i{background:linear-gradient(180deg,var(--brand-3) 0%,var(--brand) 42%,var(--brand-2) 100%);box-shadow:inset 0 14px 22px color-mix(in srgb,#fff 28%,transparent),0 -8px 16px color-mix(in srgb,var(--brand) 35%,transparent)}
html[data-fenix-campo] .fx-tank-well b{color:#fff;font-size:var(--fx-t-display);text-shadow:0 1px 0 rgba(15,23,42,.35)}
html[data-fenix-campo] .fx-axis{list-style:none;margin:0;padding:2px 0;display:flex;flex-direction:column;justify-content:space-between;font:650 10px/1 var(--body),system-ui,sans-serif;color:color-mix(in srgb,#f8fafc 62%,transparent);text-align:right}
html[data-fenix-campo] .fx-ok{display:flex;margin:12px 0 0;width:100%;background:#10B981;color:#fff;border-radius:var(--fx-pill);min-height:40px;box-shadow:0 8px 18px color-mix(in srgb,#10B981 32%,transparent)}
html[data-fenix-campo] .fx-pills{position:sticky;top:0;z-index:3;padding:2px 0;background:color-mix(in srgb,var(--surface-2) 88%,transparent)}
html[data-fenix-campo] .fx-pill,html[data-fenix-campo] .fx-filter{border-width:1.5px;border-color:var(--border,var(--line));background:var(--surface);color:var(--on-surface)}
html[data-fenix-campo] .fx-pill.on,html[data-fenix-campo] .fx-filter.on{background:var(--brand);color:#fff;border-color:var(--brand)}
html[data-fenix-campo] .fx-card,html[data-fenix-campo] .fx-record,html[data-fenix-campo] .fx-table-wrap,html[data-fenix-campo] .fx-jump{box-shadow:var(--shadow-card);border-color:var(--border,var(--line))}
html[data-fenix-campo] .fx-metric{background:var(--surface-3)}
html[data-fenix-campo] .fx-metric b{color:var(--brand-2)}
html[data-fenix-campo] .fx-who{margin:4px 0 0;color:var(--brand-2);font:650 var(--fx-t-14)/1.3 var(--body),system-ui,sans-serif}
html[data-fenix-campo] .fx-badge{background:color-mix(in srgb,var(--warn) 18%,#fff);border-color:var(--warn);color:#92400e}
html[data-fenix-campo] .fx-badge.ok{background:color-mix(in srgb,var(--ok) 16%,#fff);border-color:var(--ok);color:#047857}
html[data-fenix-campo] .fx-trend{background:color-mix(in srgb,var(--ok) 16%,#fff);color:#047857}
html[data-fenix-campo] .fx-dot{background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 18%,transparent)}
html[data-fenix-campo] .fx-bars{display:flex;align-items:flex-end;gap:8px;height:88px;margin:12px 0 0;padding:10px 10px 0;border-radius:var(--fx-r2);background:var(--surface-3)}
html[data-fenix-campo] .fx-bars i{flex:1;border-radius:6px 6px 0 0;background:var(--brand-2);min-height:8px}
html[data-fenix-campo] .fx-splash{background:var(--surface-2)}
html[data-fenix-campo] .fx-splash .fx-mark{width:96px;height:96px;border-radius:28px;overflow:visible;box-shadow:var(--shadow-float)}
html[data-fenix-campo] .fx-splash .fx-mark svg{width:96px;height:96px}
.fx-board,.fx-tank,.fx-card{border-radius:var(--fx-r3,22px)}
`;
}

function visualKitCss(t: DesignTokens, grammar: LayoutGrammar): string {
  const desk = grammar.chrome !== "tabs";
  return `${typeRampCss(t)}
${kickerCss(t)}
${productChromeCss()}
.toast,.state-load,.state-err{position:fixed;left:16px;right:16px;bottom:calc(80px + env(safe-area-inset-bottom));padding:12px 14px;border-radius:var(--r);background:var(--elevated);border:1px solid var(--line);z-index:30;box-shadow:0 18px 40px color-mix(in srgb,var(--fg) 16%,transparent)}
@media(min-width:768px){.toast,.state-load,.state-err{bottom:24px;left:auto;right:24px;width:min(360px,calc(100vw - 48px))}}
.state-load[hidden],.toast[hidden],.state-err[hidden]{display:none}
.state-load:not([hidden]){display:flex;align-items:center;gap:10px}
.state-load:not([hidden]):before{content:"";width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:fenix-spin .8s linear infinite}
@keyframes fenix-spin{to{transform:rotate(360deg)}}
.state-empty{padding:28px 16px;color:var(--muted);text-align:left;border:0;border-top:1px dashed var(--line);border-radius:0}
.state-empty .btn{margin:16px 0 0;display:inline-flex;min-height:48px;min-width:min(100%,280px);padding:14px 22px}
.btn{appearance:none;border:0;cursor:pointer;font:650 14px/1 var(--body),system-ui,sans-serif;border-radius:${t.family === "editorial" || t.family === "fashion" ? "0" : "999px"};padding:12px 18px;background:var(--accent);color:var(--accent-ink);min-height:44px;min-width:44px}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn.sm{padding:8px 12px;min-height:40px;font-size:13px}
.btn:hover,.deal:hover,.look:hover,.ticket:hover,.room:hover,.fragrance:hover,.plate:hover,.commit:hover,.slot:hover{filter:brightness(1.06);box-shadow:0 10px 28px color-mix(in srgb,var(--fg) 16%,transparent);border-color:var(--accent)}
.btn:active,.deal:active,.look:active,.ticket:active,.room:active,.fragrance:active{transform:translateY(1px) scale(.98);filter:brightness(.94)}
.look[data-state=on],.fragrance[data-state=on],.room[data-state=on],.deal[data-state=on],.ticket[data-state=on],.plate[data-state=on]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 14px 32px color-mix(in srgb,var(--fg) 14%,transparent)}
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
    .map((r, i) => {
      const extra =
        (r.status ? `,status:${JSON.stringify(r.status)}` : "") +
        (r.dayOffset != null ? `,dayOffset:${r.dayOffset}` : "") +
        `,slot:${i}`;
      return `{id:${JSON.stringify(r.id)},title:${JSON.stringify(r.title)},kicker:${JSON.stringify(r.kicker)},note:${JSON.stringify(r.note)},meta:${JSON.stringify(r.meta)}${extra}}`;
    })
    .join(",");
}

function productHtml(spec: PipelineSpec, tokens: DesignTokens, grammar: LayoutGrammar): string {
  const p = tokens.palette;
  const scheme = Number.parseInt(p.bg.slice(1, 3), 16) < 80 ? "dark" : "light";
  const alt = altForBrief(spec.brief);
  const slices = spec.rows.map((_, i) => domainIllustration(tokens.family, tokens.variant, alt, i, "slice"));
  const meets =
    tokens.family === "perfume" || tokens.family === "food"
      ? spec.rows.map((_, i) => domainIllustration(tokens.family, tokens.variant, alt, i, "meet"))
      : [];
  const hero = meets[0] || slices[0] || domainIllustration(tokens.family, tokens.variant, alt, 0);
  const desk = grammar.chrome !== "tabs";
  const homeView = spec.tabs[0]!.id;
  const deskAttr = desk ? ` data-fenix-craft-desk${grammar.kind === "dashboard" ? " data-fenix-crud" : ""}` : "";
  const navClass = desk ? (grammar.chrome === "masthead" ? "rail" : "rail") : "tabs";
  const headerExtra = grammar.chrome === "masthead" ? " mast" : "";
  const accentInk = safeAccentInk(tokens);
  const identityGlyph = appIdentityIcon(spec.brief, tokens.family);
  const campo = isFieldProductBrief(spec.brief) && grammar.id === "phone-seed";
  const premiumMark = campo
    ? glossyWaterMarkSvg(spec.id, p)
    : premiumAppMarkSvg(spec.id, p, identityGlyph);
  const markHref = premiumMarkDataUri(premiumMark);
  const bootDate = italianLongDate();
  const pocketEmpty = `<section class="home-overview" data-fenix-pane="home"><div class="home-hero"><p class="kicker">Panoramica</p><p class="fx-date">${bootDate}</p><div class="fx-board" aria-label="Sintesi"><div class="fx-cell"><b>0</b><span>Oggi</span></div><div class="fx-cell"><b>0</b><span>Media</span></div><div class="fx-cell"><b>0</b><span>Voci</span></div><div class="fx-cell" data-warn><b>0</b><span>Aperti</span></div></div><div class="fx-tank"><div class="fx-seg" role="tablist"><button type="button" class="on">Oggi</button><button type="button">Settimana</button><button type="button">Mese</button></div><div class="fx-tank-well"><i style="height:0%"></i><b>0%</b></div><p>0 / 0 · obiettivo</p></div><p class="home-count" data-count="0"><b>0</b><span>voci sul dispositivo</span></p><div class="home-first" data-state="empty"><div class="mark" aria-hidden="true">${POCKET_EMPTY_MARK}</div><h2>Niente in lista</h2><p class="notes">Aggiungi la prima voce. Qui non ci sono dati di prova.</p><button class="btn" type="button" data-view="${spec.tabs[1]!.id}">${spec.cta}</button></div></div><aside class="home-aside"><article class="card"><p class="kicker">Elenco</p><h2>Vuoto</h2><p class="notes">Le azioni restano nella lista.</p></article><article class="card"><p class="kicker">Privacy</p><h2>Solo qui</h2><p class="notes">Storage locale, senza profilo.</p></article></aside></section>`;
  const splash = desk
    ? ""
    : `<div class="fx-splash" id="fx-splash" data-fenix-splash><span class="fx-mark">${premiumMark}</span><strong>${spec.name}</strong><span class="fx-spin" aria-hidden="true"></span><p class="notes">${campo ? "Apertura" : grammar.voice.load}…</p></div>`;
  const bootMain =
    grammar.id === "source-timeline"
      ? `<section class="repo-stage" data-repo-stage="activity"><div class="timeline-art">${hero}</div></section>`
      : grammar.id === "agenda"
        ? agendaRailMarkup(spec, grammar)
        : grammar.id === "phone-seed"
          ? pocketEmpty
          : `<div class="hero">${hero}</div>`;
  const navButtons = spec.tabs
    .map(
      (tab, i) =>
        `  <button type="button" data-view="${tab.id}" data-fenix-id="icon:${tab.id}"${i === 0 ? ' class="on"' : ""}>${tabSvg(tab, i, campo)}<span>${tab.label}</span></button>`,
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
<html lang="it" data-family="${tokens.family}" data-grammar="${grammar.id}" data-chroma="${tokens.chroma}" data-intent-type="${graphicIntentFromBrief(spec.brief).type}" data-intent-chrome="${graphicIntentFromBrief(spec.brief).chrome}"${desk ? " data-fenix-craft-desk" : ""}${campo ? " data-fenix-campo" : ""}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="color-scheme" content="${scheme}"/>
<title>${spec.name}</title>
<link rel="icon" type="image/svg+xml" href="${markHref}"/>
${tokens.fonts.href ? `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="${tokens.fonts.href}" rel="stylesheet"/>` : "<!-- system stack: no Google Fonts -->"}
<style data-fenix-phone data-fenix-site data-fenix-craft>
:root{color-scheme:${scheme};--bg:${p.bg};--surface:${p.surface};--elevated:${p.elevated};--fg:${p.fg};--muted:${p.muted};--accent:${p.accent};--line:${p.line};--accent-ink:${accentInk};--success:${p.success};--warning:${p.warning};--navy:${p.fg};--water:${p.accent};--ok-loud:${p.success};${craftTokenCss(surfacesFromPalette(p, campo))};--r:${tokens.radius};--display:${displayStack(tokens)};--body:${bodyStack(tokens)};--t-h1:${tokens.type.h1};--t-h2:${h2};--t-body:${tokens.type.body};--t-large:${large};--t-headline:1.0625rem;--t-callout:1rem;--t-subhead:.9375rem;--t-footnote:.8125rem;--t-caption:.6875rem;--space:8px;--ink-loud:${p.fg};--ink-quiet:${p.muted}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--fg);font:400 ${tokens.type.body}/1.29 var(--body);-webkit-font-smoothing:antialiased}
body{min-height:100dvh}
.app{min-height:100dvh;display:flex;flex-direction:column;width:100%}
header{padding:16px 18px 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.brand{font-family:var(--display);font-size:${tokens.type.h1};font-weight:650;letter-spacing:-.04em;line-height:1.1;color:var(--fg);overflow-wrap:anywhere;min-width:0}
.brand-group{display:flex;align-items:center;gap:12px;min-width:0}
.brand-group>div{min-width:0}
.app-mark{width:44px;height:44px;flex:0 0 44px;border-radius:12px;display:grid;place-items:center;background:var(--elevated);color:var(--fg);border:1px solid var(--line);box-shadow:none}
.app-mark svg{width:26px;height:26px;stroke-width:2;overflow:visible}
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
${campo ? "html[data-fenix-campo] nav.tabs{grid-template-columns:repeat(5,minmax(0,1fr))}" : ""}
</style>
</head>
<body>
${splash}
<div class="app"${deskAttr}>
<header class="${headerExtra.trim()}">
  <div class="brand-group">
    ${desk ? "" : `<span class="app-mark" data-fenix-id="icon:app" aria-hidden="true">${premiumMark}</span>`}
    <div>
    ${grammar.id === "phone-seed" || grammar.id === "agenda" ? "" : `<p class="kicker">${spec.kicker}</p>`}
    <h1 class="brand">${spec.name}</h1>
    </div>
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
var wipeAsk=false;
const arts=${JSON.stringify(slices)};
const meets=${JSON.stringify(meets)};
const hero=${JSON.stringify(hero)};
const tabDefs=${JSON.stringify(spec.tabs)};
const glyphs=${JSON.stringify(spec.tabs.map((t, i) => tabSvg(t, i, campo)))};
const grammarId=${JSON.stringify(grammar.id)};
const tokenVariant=${tokens.variant};
const chroma=${JSON.stringify(tokens.chroma)};
const emptyVoice=${JSON.stringify(grammar.voice.empty)};
const census=${JSON.stringify(grammar.voice.census)};
const formTitle=${JSON.stringify(spec.formTitle)};
const cta=${JSON.stringify(spec.cta)};
const kicker=${JSON.stringify(spec.kicker)};
const place=${JSON.stringify(spec.place)};
const campoProduct=${campo ? "true" : "false"};
const AGENDA_CYCLE={prenotato:"confermato",confermato:"in-corso","in-corso":"concluso",concluso:"prenotato"};
const AGENDA_ACTION_LABELS=${JSON.stringify(AGENDA_ACTION_LABELS)};
const AGENDA_STATUS_LABELS=${JSON.stringify(AGENDA_STATUS_LABELS)};
const AGENDA_EDIT_GLYPH=${JSON.stringify(AGENDA_EDIT_GLYPH)};
const AGENDA_DEL_GLYPH=${JSON.stringify(AGENDA_DEL_GLYPH)};
const FX_SEARCH_MARK=${JSON.stringify(FX_SEARCH_MARK)};
const FX_EDIT_MARK=${JSON.stringify(FX_EDIT_MARK)};
const FX_PAUSE_MARK=${JSON.stringify(FX_PAUSE_MARK)};
const FX_CHEVRON_MARK=${JSON.stringify(FX_CHEVRON_MARK)};
const FX_EXIT_MARK=${JSON.stringify(FX_EXIT_MARK)};
const FX_DROP_MARK='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.8s5.8 6.6 5.8 10.2a5.8 5.8 0 0 1-11.6 0C6.2 11.4 12 4.8 12 4.8z"/></svg>';
(function dismissSplash(){
  var splash=document.getElementById("fx-splash");
  if(!splash) return;
  if(document.documentElement.getAttribute("data-fx-splash")==="hold") return;
  setTimeout(function(){ splash.setAttribute("hidden",""); }, 720);
})();
const KICKER_CYCLE={scouting:"trattativa",trattativa:"firma",firma:"chiuso",chiuso:"scouting","in-forno":"al-passo","al-passo":"in-sala","in-sala":"in-forno",arrivo:"in-house","in-house":"partenza",partenza:"arrivo"};
function artOf(item, fit){
  var slot=0;
  if(item && item.slot!=null && isFinite(Number(item.slot))) slot=((Number(item.slot)%4)+4)%4;
  if(fit==="meet" && meets.length) return meets[slot]||hero;
  return arts[slot]||hero;
}
function ensureSlots(){
  data.items.forEach(function(e,i){ if(e.slot==null || !isFinite(Number(e.slot))) e.slot=i%4; });
}
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
function agendaDateLabel(iso){
  var p=String(iso).split("-");
  var date=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]),12);
  if(!isFinite(date.getTime())) return iso;
  return date.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
}
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
var persistDepth=0;
var persistTail=Promise.resolve(true);
var flashGen=0;
function cloneOf(x){ try { return JSON.parse(JSON.stringify(x)); } catch(err) { return {items:((x&&x.items)||[]).slice()}; } }
function cloneData(){ return cloneOf(data); }
var confirmed=cloneData();
var pendingOps=[];
function applyOp(state, op){
  if(!state || !op) return state;
  if(!state.items) state.items=[];
  if(op.kind==="advance"){
    var item=state.items.find(function(x){return x.id===op.id;});
    if(!item) return state;
    if(grammarId==="agenda") item.status=AGENDA_CYCLE[item.status]||"confermato";
    else item.kicker=KICKER_CYCLE[item.kicker]||item.kicker;
  } else if(op.kind==="del"){
    state.items=state.items.filter(function(x){return x.id!==op.id;});
  } else if(op.kind==="wipe"){
    state.items=[];
  } else if(op.kind==="wear"){
    var worn=state.items.find(function(x){return x.id===op.id;});
    if(!worn) return state;
    state.items=[worn].concat(state.items.filter(function(x){return x.id!==op.id;}));
  } else if(op.kind==="create"){
    state.items.unshift(cloneOf(op.row));
  } else if(op.kind==="edit"){
    var item=state.items.find(function(x){return x.id===op.id;});
    if(!item || !op.patch) return state;
    Object.keys(op.patch).forEach(function(k){
      if(op.patch[k]!==undefined) item[k]=op.patch[k];
    });
  }
  return state;
}
function replayPending(){
  data=cloneOf(confirmed);
  pendingOps.forEach(function(op){ applyOp(data, op); });
}
function payloadForHead(){
  var state=cloneOf(confirmed);
  if(pendingOps[0]) applyOp(state, pendingOps[0]);
  return state;
}
function markQueue(){
  try{
    if(pendingOps.length) document.documentElement.setAttribute("data-fenix-queue", String(pendingOps.length));
    else document.documentElement.removeAttribute("data-fenix-queue");
  }catch(err){}
}
function saveOnce(){
  if(!window.Fenix || !window.Fenix.save) return Promise.resolve({ok:true});
  var payload=pendingOps.length?payloadForHead():cloneData();
  return Promise.resolve().then(function(){
    return window.Fenix.save(COL, payload);
  }).then(function(res){
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
  flashGen+=1;
  var n=document.getElementById("err");
  var toast=document.getElementById("toast");
  if(toast) toast.hidden=true;
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
function captureForm(){
  var f=document.getElementById("fnew");
  if(!f) return null;
  return {
    n:f.n&&f.n.value||"",
    ora:f.ora&&f.ora.value||"",
    data:f.data&&f.data.value||"",
    luogo:f.luogo&&f.luogo.value||"",
    cliente:f.cliente&&f.cliente.value||"",
    k:f.k&&f.k.value||"",
    note:f.note&&f.note.value||""
  };
}
function renderKeepForm(){
  var keep=captureForm();
  render();
  if(keep) restoreForm(keep);
}
function markPersist(on){
  persistBusy=!!on;
  try{
    if(on) document.documentElement.setAttribute("data-fenix-persist","busy");
    else document.documentElement.removeAttribute("data-fenix-persist");
  }catch(err){}
}
function persistThen(afterOk, afterFail){
  persistDepth+=1;
  markPersist(true);
  markQueue();
  persistTail=persistTail.catch(function(){ return true; }).then(function(){
    return Promise.resolve().then(function(){
      return save();
    }).then(function(){
      if(pendingOps[0]){
        confirmed=payloadForHead();
        pendingOps.shift();
      }
      replayPending();
      markQueue();
      ping(true);
      try {
        if(afterOk) afterOk();
        else renderKeepForm();
      } catch (e) {}
      return true;
    }).catch(function(err){
      if(pendingOps.length) pendingOps.shift();
      replayPending();
      markQueue();
      renderKeepForm();
      try { if(afterFail) afterFail(); } catch (e2) {}
      flashErr(err && err.message ? err.message : "Salvataggio non riuscito.");
      ping(false);
      return false;
    }).then(function(ok){
      persistDepth-=1;
      if(persistDepth<=0){ persistDepth=0; markPersist(false); }
      return ok;
    });
  });
  return persistTail;
}
function enqueueOp(op, afterOk, afterFail){
  pendingOps.push(op);
  replayPending();
  markQueue();
  renderKeepForm();
  return persistThen(afterOk, afterFail);
}
function commitForm(f){
  if(!f || f.id!=="fnew") return false;
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
  var snapView=view, snapEdit=editId, snapDay=selectedDay;
  var keep={n:nome,ora:"",data:"",luogo:"",cliente:"",k:(f.k&&f.k.value||""),note:(f.note&&f.note.value||"")};
  var nextView=tabDefs[0].id;
  var nextDay=selectedDay;
  var createdId=null;
  var row=null;
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
    createdId=wasEdit?editId:("n"+Date.now());
    if(wasEdit){
      row=null;
    } else {
      row={id:createdId,title:nome,kicker:ora,note:luogo+" · "+cliente,meta:"30 min",status:"prenotato",day:giorno,slot:confirmed.items.length%4};
    }
    nextDay=giorno;
    nextView=giorno===todayIso()?tabDefs[0].id:tabDefs[2].id;
  } else {
    createdId=wasEdit?editId:("n"+Date.now());
    if(!wasEdit){
      row={id:createdId,title:nome,kicker:(f.k&&f.k.value||"").trim(),note:(f.note&&f.note.value||"").trim(),meta:"",slot:confirmed.items.length%4};
    }
    nextView=tabDefs[0].id;
  }
  var op;
  if(wasEdit){
    op={kind:"edit",id:createdId,patch:grammarId==="agenda"
      ? {title:nome,kicker:keep.ora,note:keep.luogo+" · "+keep.cliente,day:keep.data}
      : {title:nome,kicker:(f.k&&f.k.value||"").trim(),note:(f.note&&f.note.value||"").trim()}};
  } else {
    op={kind:"create",id:createdId,row:row};
  }
  return enqueueOp(op, function(){
    editId=null;
    selectedDay=nextDay;
    view=nextView;
    try { f.reset(); } catch(err) {}
    render();
  }, function(){
    view=snapView;
    editId=snapEdit;
    selectedDay=snapDay;
    render();
    restoreForm(keep);
  });
}
function ping(ok){
  flashGen+=1;
  var gen=flashGen;
  var toast=document.getElementById("toast");
  var err=document.getElementById("err");
  var ferr=document.querySelector("[data-fenix-form-error]");
  if(ok){
    if(err) err.hidden=true;
    if(ferr) ferr.hidden=true;
    if(toast) toast.hidden=false;
  } else {
    if(toast) toast.hidden=true;
    if(err) err.hidden=false;
  }
  document.documentElement.setAttribute("data-fenix-flash", ok?"ok":"err");
  setTimeout(function(){
    if(gen!==flashGen) return;
    if(toast) toast.hidden=true;
    if(err) err.hidden=true;
    document.documentElement.removeAttribute("data-fenix-flash");
  }, 1600);
}
function renderTabs(){
  var nav=document.getElementById("tabs");
  nav.innerHTML=tabDefs.map(function(t,i){
    return '<button type="button" data-view="'+t.id+'" data-fenix-id="icon:'+t.id+'" class="'+(view===t.id?"on":"")+'">'+glyphs[i]+"<span>"+t.label+"</span></button>";
  }).join("");
}
function emptyBox(){ return '<div class="state-empty" data-state="empty"><p>'+emptyVoice+'</p><button class="btn" type="button" data-view="'+tabDefs[1].id+'">'+cta+"</button></div>"; }
function pocketLine(e){
  var parts=[];
  function add(v){
    v=String(v||"").trim();
    if(!v || v==="—" || v==="nuovo" || v===census) return;
    parts.push(v);
  }
  add(e.note); add(e.kicker); add(e.meta);
  return parts.join(" · ");
}
function pocketEmptyInner(){
  return '<div class="mark" aria-hidden="true">${POCKET_EMPTY_MARK}</div><h2>Niente in lista</h2><p class="notes">Aggiungi la prima voce. Qui non ci sono dati di prova.</p><button class="btn" type="button" data-view="'+tabDefs[1].id+'">'+cta+"</button>";
}
function italianLongDateJs(){
  var raw=nowDate().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  return raw?raw.charAt(0).toUpperCase()+raw.slice(1):"";
}
function litersOf(meta){
  var n=Number(String(meta||"").replace(/[^0-9]/g,""));
  return isFinite(n)?n:0;
}
function fmtLiters(n){
  return n.toLocaleString("it-IT")+" L";
}
function goalOf(){
  return Math.max(1500, data.items.length*300);
}
function phonePane(id){
  var tab=tabDefs.filter(function(t){return t.id===id;})[0]||{};
  var key=(tab.id+" "+tab.label).toLowerCase();
  if(/statist|numeri|kpi|bilancio/.test(key)) return "stats";
  if(/storico|cronolog/.test(key)) return "history";
  if(/nuovo|nuova|aggiungi|registra/.test(key)) return "form";
  if(/persona|profilo|impostaz/.test(key)) return "persona";
  if(/elenco|lista|gestione|dipendent|clienti/.test(key)) return "list";
  if(id===tabDefs[0].id) return "home";
  if(id===tabDefs[1].id) return "form";
  if(id===tabDefs[2].id) return "list";
  return "persona";
}
function paneTab(pane){
  for(var i=0;i<tabDefs.length;i++){
    if(phonePane(tabDefs[i].id)===pane) return tabDefs[i].id;
  }
  return tabDefs[Math.min(1,tabDefs.length-1)].id;
}
function fxBoardMarkup(n){
  var total=data.items.reduce(function(a,e){return a+litersOf(e.meta);},0);
  var open=data.items.filter(function(e){return /pausa|wait|bozza|scadenza/i.test(e.kicker||"");}).length;
  var avg=n?Math.round(total/n):0;
  var today=total||n;
  var third=campoProduct?"Dipendenti":"Voci";
  var fourth=campoProduct?"Sotto obiettivo":"Aperti";
  var first=campoProduct?"Totale oggi":"Oggi";
  var second=campoProduct?"Media":"Media";
  return '<div class="fx-board" aria-label="Sintesi"><div class="fx-cell"><b>'+(total?fmtLiters(today):String(n))+'</b><span>'+first+'</span></div><div class="fx-cell"><b>'+(total?fmtLiters(avg):"0")+'</b><span>'+second+'</span></div><div class="fx-cell"><b>'+n+'</b><span>'+third+'</span></div><div class="fx-cell"'+(open?' data-warn':'')+'><b>'+open+'</b><span>'+fourth+'</span></div></div>';
}
function fxTankMarkup(n){
  var total=data.items.reduce(function(a,e){return a+litersOf(e.meta);},0);
  var goal=goalOf();
  var pct=goal?Math.min(100,Math.round((total||n)/goal*100)):0;
  if(!total && n) pct=Math.min(100,Math.round(n/Math.max(n,4)*100));
  var html='<div class="fx-tank"><div class="'+(campoProduct?"fx-toggle":"fx-seg")+'" role="tablist"><button type="button" class="on">Oggi</button><button type="button">Settimana</button><button type="button">Mese</button></div>';
  html+='<div class="fx-tank-frame"><div class="fx-tank-well"><span class="fx-tank-grid" aria-hidden="true"></span><i style="height:'+pct+'%"></i><b>'+pct+"%</b></div>";
  html+='<ol class="fx-axis" aria-hidden="true"><li>100</li><li>75</li><li>50</li><li>25</li><li>0</li></ol></div>';
  html+="<p>"+(total?fmtLiters(total)+" / "+fmtLiters(goal):n+" / "+n)+(campoProduct?" — "+pct+"%":" · obiettivo")+"</p>";
  if(pct>=100 && n) html+='<p class="fx-ok">'+(campoProduct?"Obiettivo raggiunto. Bene.":"Obiettivo raggiunto")+"</p>";
  return html+"</div>";
}
function renderPocketHome(){
  var n=data.items.length;
  var formId=paneTab("form");
  var listId=paneTab("list");
  var html='<section class="home-overview" data-fenix-pane="home"><div class="home-hero">';
  if(campoProduct){
    html+='<div class="fx-hello-row"><div><p class="fx-hello">Missioni</p><p class="fx-role">Quadro di controllo</p></div><button class="fx-exit" type="button" aria-label="Esci">'+FX_EXIT_MARK+"</button></div>";
    html+='<p class="fx-date">'+italianLongDateJs()+'</p><div class="fx-inverse"><p class="fx-shell-kicker">Panoramica — oggi</p>'+fxBoardMarkup(n)+'</div><div class="fx-inverse fx-hero"><p class="fx-shell-kicker">Volume in campo</p>'+fxTankMarkup(n)+"</div>";
  } else {
    html+='<p class="kicker">Panoramica</p><p class="fx-date">'+italianLongDateJs()+"</p>"+fxBoardMarkup(n)+fxTankMarkup(n);
  }
  if(campoProduct){
    html+='<p class="home-count" data-count="'+n+'"><b>'+n+'</b><span>'+(n===1?"dipendente in campo":"dipendenti in campo")+"</span></p>";
  } else {
    html+='<p class="home-count" data-count="'+n+'"><b>'+n+'</b><span>'+(n===1?"voce sul dispositivo":"voci sul dispositivo")+"</span></p>";
  }
  if(!n){
    html+='<div class="home-first" data-state="empty">'+pocketEmptyInner()+"</div></div>";
    html+='<aside class="home-aside"><article class="card"><p class="kicker">Elenco</p><h2>Vuoto</h2><p class="notes">Le azioni restano nella lista.</p></article><article class="card"><p class="kicker">Privacy</p><h2>Solo qui</h2><p class="notes">Storage locale, senza profilo.</p></article></aside>';
  } else if(campoProduct){
    html+='<button class="btn" type="button" data-view="'+formId+'">'+cta+"</button></div>";
  } else {
    html+='<p class="notes">Ultime voci dal dispositivo. Niente dati di prova.</p><button class="btn" type="button" data-view="'+tabDefs[1].id+'">'+cta+"</button></div>";
    html+='<aside class="home-aside"><article class="card"><p class="kicker">Elenco</p><h2>'+n+(n===1?" voce":" voci")+'</h2><p class="notes">Apri Elenco per le azioni sulle voci.</p></article><article class="card"><p class="kicker">Privacy</p><h2>Solo qui</h2><p class="notes">Storage locale, senza profilo.</p></article></aside>';
    html+='<div class="home-recent" data-fenix-recent><p class="kicker">Recenti</p>';
    data.items.slice(0,3).forEach(function(e){
      var line=pocketLine(e);
      html+='<article class="card" data-id="'+e.id+'"><h2>'+e.title+'</h2>'+(line?'<p class="notes">'+line+"</p>":"")+'<button class="btn sm ghost" type="button" data-view="'+listId+'">Apri elenco</button></article>';
    });
    html+="</div>";
  }
  return html+"</section>";
}
function renderPocketList(){
  var n=data.items.length;
  var formId=paneTab("form");
  var html='<section class="list-pane" data-fenix-pane="elenco">';
  if(campoProduct){
    html+='<p class="fx-large">Gestione</p><div class="fx-pills"><button type="button" class="fx-pill on">Dipendenti</button><button type="button" class="fx-pill">Missioni</button><button type="button" class="fx-pill">Firme</button><button type="button" class="fx-pill">Luoghi</button></div>';
    html+='<div class="fx-toolbar"><div class="list-head"><h2>Dipendenti ('+n+')</h2></div><button class="fx-nuovo" type="button" data-act="fx-new">+ Nuovo</button></div>';
  } else {
    html+='<div class="fx-toolbar"><div class="list-head"><p class="kicker">Gestione</p><h2>'+n+" "+(n===1?"voce":"voci")+'</h2></div><button class="fx-nuovo" type="button" data-act="fx-new">+ Nuovo</button></div>';
    html+='<p class="notes">Archivio completo, con azioni sulle voci.</p>';
  }
  html+='<div class="fx-search">'+FX_SEARCH_MARK+'<input type="search" placeholder="Cerca per nome..." aria-label="Cerca"></div>';
  if(campoProduct){
    html+='<div class="fx-pills"><button type="button" class="fx-pill on">Tutti i ruoli</button><button type="button" class="fx-pill">Operatore</button><button type="button" class="fx-pill">Responsabile</button></div>';
    html+='<div class="fx-pills"><button type="button" class="fx-pill on">Tutti</button><button type="button" class="fx-pill">Attivi</button><button type="button" class="fx-pill">Sospesi</button><button type="button" class="fx-pill on">Ordina: Nome</button></div>';
  } else {
    html+='<div class="fx-pills"><button type="button" class="fx-pill on">Tutti</button><button type="button" class="fx-pill">Attivi</button><button type="button" class="fx-pill">Sospesi</button></div>';
  }
  if(!n){
    html+='<div class="state-empty" data-state="empty"><p>Nessuna voce in elenco. Compila e salva; non inventiamo righe.</p><button class="btn" type="button" data-view="'+formId+'">'+cta+"</button></div>";
    return html+"</section>";
  }
  html+='<div class="fx-table-wrap"><table class="fx-table"><thead><tr><th>Nome</th><th>Obiettivo</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>';
  data.items.forEach(function(e){
    var wait=/pausa|wait|bozza|scadenza/i.test(e.kicker||"");
    html+='<tr data-id="'+e.id+'"><td class="name"><b>'+e.title+"</b><small>"+(e.note||e.kicker||"")+'</small></td><td>'+(e.meta||"—")+'</td><td><span class="fx-dot'+(wait?" wait":"")+'" title="'+(e.kicker||"")+'"></span></td><td><button class="fx-iconbtn" data-act="edit" data-id="'+e.id+'" aria-label="Modifica">'+FX_EDIT_MARK+'</button> <button class="fx-iconbtn" data-act="del" data-id="'+e.id+'" aria-label="Archivia">'+FX_PAUSE_MARK+"</button></td></tr>";
  });
  html+="</tbody></table></div>";
  html+='<ul class="pocket-list" hidden aria-hidden="true">';
  data.items.forEach(function(e){
    var line=pocketLine(e);
    html+='<li class="card" data-id="'+e.id+'"><h2>'+e.title+'</h2>'+(line?'<p class="notes">'+line+"</p>":"")+"</li>";
  });
  return html+"</ul></section>";
}
function renderPocketHistory(){
  var n=data.items.length;
  var total=data.items.reduce(function(a,e){return a+litersOf(e.meta);},0);
  var html='<section class="list-pane" data-fenix-pane="storico"><div class="fx-toolbar"><div><p class="fx-large">Storico</p><p class="fx-sub">'+(campoProduct?n+" missioni in archivio":n+" "+(n===1?"voce":"voci"))+'</p></div><span class="fx-total">'+(total?fmtLiters(total):n+" voci")+"</span></div>";
  html+='<div class="fx-pills"><button type="button" class="fx-pill">Oggi</button><button type="button" class="fx-pill">7 giorni</button><button type="button" class="fx-pill">Mese</button><button type="button" class="fx-pill">Anno</button><button type="button" class="fx-pill on">Tutto</button></div>';
  html+='<div class="fx-filters"><button type="button" class="fx-filter">Dipendente</button><button type="button" class="fx-filter">Mese</button><button type="button" class="fx-filter">Luogo</button></div>';
  if(!n){
    html+='<div class="state-empty" data-state="empty"><p>Nessuna voce in elenco. Compila e salva; non inventiamo righe.</p></div>';
    return html+"</section>";
  }
  data.items.forEach(function(e){
    var wait=/pausa|wait|bozza|scadenza/i.test(e.kicker||"");
    html+='<article class="fx-record" data-id="'+e.id+'"><span class="fx-ico" aria-hidden="true">'+FX_DROP_MARK+'</span><div><h2>'+(e.meta||e.title)+'</h2><p class="notes">'+italianLongDateJs()+(e.note?" · "+e.note:"")+'</p><p class="fx-who">'+e.title+'</p><span class="fx-badge'+(wait?"":" ok")+'">'+(wait?"Da firmare":"Firmata")+'</span></div><div><button class="fx-iconbtn" data-act="edit" data-id="'+e.id+'" aria-label="Modifica">'+FX_EDIT_MARK+'</button> '+FX_CHEVRON_MARK+'</div></article>';
  });
  return html+"</section>";
}
function renderPocketStats(){
  var n=data.items.length;
  var total=data.items.reduce(function(a,e){return a+litersOf(e.meta);},0);
  var week=total?Math.round(total*6.2):n*8;
  var avg=n?Math.round((total||n)/n):0;
  var html='<section class="persona-pane" data-fenix-pane="statistiche"><p class="fx-large">Statistiche</p><p class="fx-sub">'+(campoProduct?"Quadro di controllo in campo":"Quadro di controllo")+'</p>';
  html+='<div class="fx-jump"><span class="fx-hi-ico" aria-hidden="true">'+FX_DROP_MARK+'</span><div><b>Sintesi personale</b><p class="notes">Apri il dettaglio della tua attivita</p></div>'+FX_CHEVRON_MARK+'</div>';
  html+='<div class="fx-seg"><button type="button" class="on">Panoramica</button><button type="button">Confronto</button><button type="button">Classifica</button></div>';
  html+='<div class="fx-card"><div class="fx-toolbar"><p class="kicker">'+(campoProduct?"Riepilogo — mese corrente":"Riepilogo")+'</p><span class="fx-trend">+'+(n?12:0)+'%</span></div><div class="fx-grid">';
  html+='<div class="fx-metric"><b>'+(total?fmtLiters(total):n)+'</b><span>Oggi</span></div>';
  html+='<div class="fx-metric"><b>'+(total?fmtLiters(week):week)+'</b><span>Settimana</span></div>';
  html+='<div class="fx-metric"><b>'+(total?fmtLiters(avg):avg)+'</b><span>Media</span></div>';
  html+='<div class="fx-metric"><b>'+n+'</b><span>'+(campoProduct?"Squadra":"Voci")+'</span></div>';
  html+='<div class="fx-metric"><b>'+(n?Math.max(1,n-1):0)+'</b><span>Attivi</span></div>';
  html+='<div class="fx-metric"><b>'+(n?1:0)+'</b><span>In pausa</span></div></div>';
  if(campoProduct){
    html+='<div class="fx-bars" aria-hidden="true"><i style="height:42%"></i><i style="height:68%"></i><i style="height:54%"></i><i style="height:88%"></i><i style="height:61%"></i><i style="height:74%"></i></div>';
  }
  html+='<div class="fx-proj"><b>Proiezione fine mese</b><p class="notes">'+(total?fmtLiters(Math.round((total||1)*22)):n*22)+" se il ritmo resta questo</p></div></div>";
  html+='<div class="fx-card"><p class="kicker">In evidenza</p>';
  (n?data.items.slice(0,3):[]).forEach(function(e){
    html+='<div class="fx-hi-row"><span class="fx-hi-ico">'+FX_DROP_MARK+"</span><div><b>"+e.title+'</b><p class="notes">'+(e.meta||e.note||e.kicker)+"</p></div></div>";
  });
  if(!n) html+='<p class="notes">Quando salvi una voce, i numeri si aggiornano da qui.</p>';
  return html+"</div></section>";
}
function renderPocketPersona(){
  var n=data.items.length;
  var html='<section class="persona-pane" data-fenix-pane="persona"><p class="kicker">Dispositivo</p><h2>Storage locale</h2><p class="notes">Le voci restano sul dispositivo. Nessun profilo, nessun nome inventato.</p><div class="persona-facts">';
  html+='<article class="card"><p class="kicker">Voci salvate</p><p class="home-count" data-count="'+n+'"><b>'+n+"</b></p></article>";
  html+='<article class="card"><p class="kicker">Collezione</p><p class="notes">'+COL+"</p></article>";
  html+='<article class="card"><p class="kicker">Archivio</p><p class="notes">locale, senza account</p></article></div>';
  html+='<article class="persona-privacy card"><p class="kicker">Privacy</p><h2>Nessun profilo</h2><p class="notes">Nessuna identita finta da mostrare. Solo il conteggio e lo svuotamento dello storage locale.</p></article>';
  if(n && wipeAsk){
    html+='<div class="wipe-box" data-fenix-wipe data-state="ask"><p class="notes">Conferma: tutte le voci sul dispositivo verranno rimosse. Azione definitiva.</p><div class="wipe-actions"><button class="btn ghost" type="button" data-act="wipe-cancel">Annulla</button><button class="btn" type="button" data-act="wipe-confirm">Conferma svuota</button></div></div>';
  } else if(n){
    html+='<div class="wipe-box" data-fenix-wipe data-state="idle"><button class="btn ghost" type="button" data-act="wipe-ask">Svuota elenco locale</button></div>';
  } else {
    html+='<p class="notes" data-fenix-wipe-empty>Quando salvi una voce, il conteggio sale da qui. Non riempiamo la scheda.</p>';
  }
  return html+"</section>";
}
function chip(k){ return '<span class="chip '+k+'">'+k+"</span>"; }
function renderPerfume(){
  var featured=data.items[0];
  var html='<div class="hero"><div class="stage">'+artOf(featured,"meet")+'</div><div class="caption"><p class="kicker">'+kicker+'</p><h2>'+(featured?featured.title:specName())+'</h2><p class="notes">'+(featured?featured.kicker+(featured.meta?" · "+featured.meta:""):data.items.length+" "+census)+"</p></div></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="collection">';
  data.items.forEach(function(e,i){
    html+='<article class="card fragrance" data-id="'+e.id+'" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+artOf(e,"slice")+'</div><div><p class="kicker">'+e.kicker+"</p><h2>"+e.title+'</h2><p class="notes">'+e.note+'</p><div class="row" style="display:flex;justify-content:space-between;gap:8px;margin-top:8px"><span>'+e.meta+'</span><button class="btn sm ghost" data-act="wear" data-id="'+e.id+'">Tieni a portata</button></div></div></article>';
  });
  return html+"</div>";
}
function renderLookbook(){
  if(!data.items.length) return emptyBox();
  var html='<div class="lookbook">';
  data.items.forEach(function(e,i){
    html+='<article class="look" data-id="'+e.id+'" data-act="wear" data-state="'+(i===0?"on":"idle")+'"><div class="sil">'+artOf(e,"slice")+"</div><h2>"+e.title+"</h2><p>"+e.kicker+" · "+e.note+" · "+e.meta+"</p></article>";
  });
  return html+"</div>";
}
function renderRooms(){
  var html='<div class="hero">'+hero+'<div class="caption"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2></div></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="rooms">';
  data.items.forEach(function(e,i){
    html+='<article class="room" data-id="'+e.id+'" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+artOf(e,"slice")+'</div><div><p>'+chip(e.kicker)+'</p><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+'</p><button class="btn sm ghost" data-act="advance" data-id="'+e.id+'">Avanza soggiorno</button></div></article>';
  });
  return html+"</div>";
}
function renderTickets(){
  var featured=data.items[0];
  var html='<div class="hero plate"><div class="stage">'+artOf(featured,"meet")+'</div><div class="caption"><p class="kicker">'+kicker+'</p><h2>'+(featured?featured.title:specName())+'</h2><p class="notes">'+(featured?featured.note+(featured.meta?" · "+featured.meta:""):data.items.length+" "+census)+"</p></div></div>";
  if(!data.items.length) return html+emptyBox();
  html+='<div class="tickets">';
  data.items.forEach(function(e,i){
    html+='<article class="ticket" data-id="'+e.id+'" data-act="advance" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+artOf(e,"slice")+'</div><div><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></div>"+chip(e.kicker)+"</article>";
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
  var html='<section id="copertina"><div class="hero">'+hero+'</div><div class="card span"><p class="kicker">'+kicker+"</p><h2>"+specName()+" in lastre</h2><p class=\\"notes\\">Rivista di lastre fotografiche. Niente stock, niente telefono boxed.</p></div></section>";
  html+='<section id="lastre" class="lastre">';
  data.items.forEach(function(e,i){
    html+='<article class="plate card" data-id="'+e.id+'" data-act="wear" data-state="'+(i===0?"on":"idle")+'">'+artOf(e,"slice")+"<h2>"+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></article>";
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
    : `  var editing=editId?data.items.find(function(x){return x.id===editId;}):null;
  var title=editing?editing.title:"";
  var det=editing?editing.kicker:"";
  var nota=editing?editing.note:"";
  return '<section class="card span" data-fenix-crud><p class="kicker">'+(editing?"Modifica":"Nuovo")+'</p><h2>'+(editing?"Aggiorna voce":formTitle)+'</h2>'+(grammarId==="phone-seed"?'<p class="notes">Campi sul dispositivo. Conferma visibile dopo Salva.</p>':'')+'<form id="fnew"><label for="n">Nome</label><input class="field" id="n" name="n" required placeholder="Nome" value="'+title+'"><label for="k">Dettaglio</label><input class="field" id="k" name="k" placeholder="stato, taglia, ora" value="'+det+'"><label for="note">Nota</label><input class="field" id="note" name="note" placeholder="materia" value="'+nota+'"><p class="notes" data-fenix-form-error role="alert" hidden>Controlla i campi obbligatori.</p><button class="btn" type="button" data-act="save" style="margin-top:14px;width:100%">'+(editing?"Salva modifiche":cta)+'</button></form></section>';`
}
}
function renderList(){
  var html='<div class="card span"><p class="kicker">Archivio</p><h2>'+data.items.length+" voci</h2></div>";
  if(!data.items.length) html+=emptyBox();
  data.items.forEach(function(e){
    html+='<div class="card" data-id="'+e.id+'"><div style="display:flex;justify-content:space-between;gap:8px"><h2>'+e.title+'</h2><div class="slot-actions"><button class="btn sm ghost" data-act="edit" data-id="'+e.id+'">Modifica</button><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Archivia</button></div></div><p class="notes">'+(e.status?chip(e.status)+" · ":"")+e.note+" · "+e.meta+(e.kicker?" · "+e.kicker:"")+(e.day?" · "+e.day:"")+"</p></div>";
  });
  return html;
}
function renderStats(){
  return '<div class="hero">'+hero+'</div><div class="card span"><p class="kicker">Studio</p><h2>'+data.items.length+" "+census+'</h2><p class="notes">'+place+"</p></div>";
}
function slotMarkup(e,i){
  var st=e.status||"prenotato";
  var advanceLabel=AGENDA_ACTION_LABELS[st]||"Conferma";
  return '<article class="slot" data-id="'+e.id+'" data-day="'+(e.day||"")+'" data-state="'+(i===0?"on":"idle")+'" data-status="'+st+'"><time class="time" datetime="'+e.kicker+'">'+e.kicker+'</time><div class="slot-body"><h2>'+e.title+'</h2><p class="notes slot-detail">'+e.note+" · "+e.meta+'</p><span class="chip slot-status '+st+'">'+(AGENDA_STATUS_LABELS[st]||st)+'</span><div class="slot-actions"><button class="btn sm ghost" data-act="advance" data-id="'+e.id+'" aria-label="'+advanceLabel+' appuntamento">'+advanceLabel+'</button><button class="btn sm ghost" data-act="edit" data-id="'+e.id+'" aria-label="Modifica">'+AGENDA_EDIT_GLYPH+'</button><button class="btn sm ghost" data-act="del" data-id="'+e.id+'" aria-label="Archivia">'+AGENDA_DEL_GLYPH+'</button></div></div></article>';
}
function renderAgenda(){
  hydrateAgenda();
  var focus=view===tabDefs[2].id?selectedDay:todayIso();
  var rows=data.items.filter(function(e){return e.day===focus;}).slice().sort(function(a,b){return String(a.kicker).localeCompare(String(b.kicker));});
  var html='<div class="day-head"><p class="kicker"><time datetime="'+focus+'">'+agendaDateLabel(focus)+'</time></p><h2 id="day-label">'+rows.length+" "+census+"</h2></div>";
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
      html+='<article class="commit" data-id="'+e.id+'" data-hash="'+shaOf(e)+'" data-act="wear" data-state="'+(i===0?"on":"idle")+'"><span class="sha">'+shaOf(e)+'</span><div><h2>'+e.title+'</h2><p class="notes">'+e.note+' · '+e.kicker+'</p><div class="slot-actions"><button class="btn sm ghost" data-act="edit" data-id="'+e.id+'">Modifica</button><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Archivia</button></div></div>'+chip(e.meta||e.kicker)+"</article>";
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
    var head=data.items[0]||{id:"000000",title:"nastro"};
    html+='<section class="diff-pane" data-repo-stage="diff"><p class="kicker">Diff · '+shaOf(head)+'</p>';
    html+='<div class="add">+ allineaNastro(voci)</div>';
    html+='<div class="add">+ statoSync in colonna rami</div>';
    html+='<div class="del">- parser.rumore(linea)</div>';
    html+='<div class="del">- nastro vuoto in attesa</div></section>';
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
  if(grammarId==="phone-seed") return renderPocketHome();
  return renderPerfume();
}
function renderTool(){
  var html='<div class="hero">'+hero+'<div class="caption"><p class="kicker">'+kicker+"</p><h2>"+data.items.length+" "+census+"</h2></div></div>";
  if(!data.items.length) return html+emptyBox();
  data.items.forEach(function(e,i){
    html+='<article class="ticket" data-id="'+e.id+'" data-state="'+(i===0?"on":"idle")+'"><div class="thumb">'+artOf(e,"slice")+'</div><div><h2>'+e.title+'</h2><p class="notes">'+e.note+" · "+e.meta+"</p></div>"+chip(e.kicker)+"</article>";
  });
  return html;
}
function render(){
  if(grammarId==="agenda") hydrateAgenda();
  ensureSlots();
  renderTabs();
  var root=document.getElementById("root");
  var id=view;
  if(grammarId==="source-timeline"){
    if(id===tabDefs[0].id) root.innerHTML=renderSource("activity");
    else if(id===tabDefs[1].id) root.innerHTML=renderSource("branches");
    else if(id===tabDefs[2].id) root.innerHTML=renderSource("sync");
    else root.innerHTML=renderSource("diff");
  } else if(grammarId==="phone-seed"){
    var pane=phonePane(id);
    if(pane==="home") root.innerHTML=renderHome();
    else if(pane==="form") root.innerHTML='<div data-fenix-pane="nuovo">'+renderForm()+"</div>";
    else if(pane==="history") root.innerHTML=renderPocketHistory();
    else if(pane==="stats") root.innerHTML=renderPocketStats();
    else if(pane==="list") root.innerHTML=renderPocketList();
    else root.innerHTML=renderPocketPersona();
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
  var chip=e.target.closest(".fx-pills button, .fx-filters button, .fx-seg button, .fx-toggle button");
  if(chip && chip.parentNode){
    var sibs=chip.parentNode.querySelectorAll("button");
    for(var ci=0;ci<sibs.length;ci++) sibs[ci].classList.remove("on");
    chip.classList.add("on");
  }
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
  if(act==="fx-new"){
    var formTab=tabDefs.filter(function(t){return /nuovo|aggiungi|registra/i.test(t.id+" "+t.label);})[0];
    if(formTab){ view=formTab.id; render(); return; }
    var rootNew=document.getElementById("root");
    if(rootNew) rootNew.innerHTML='<div data-fenix-pane="nuovo">'+renderForm()+"</div>";
    return;
  }
  if(act==="save"){ commitForm(b.closest("form") || document.getElementById("fnew")); return; }
  if(act==="wipe-local"||act==="wipe-ask"){
    if(!data.items.length) return;
    wipeAsk=true;
    render();
    return;
  }
  if(act==="wipe-cancel"){
    wipeAsk=false;
    render();
    return;
  }
  if(act==="wipe-confirm"){
    if(!data.items.length){ wipeAsk=false; render(); return; }
    wipeAsk=false;
    enqueueOp({kind:"wipe"}, function(){ view=tabDefs[3]?tabDefs[3].id:tabDefs[0].id; render(); }, null);
    return;
  }
  if(act==="del"){
    enqueueOp({kind:"del",id:id}, null, null);
    return;
  }
  if(act==="edit"){
    editId=id;
    view=grammarId==="source-timeline"?tabDefs[2].id:tabDefs[1].id;
    render();
    return;
  }
  if(act==="wear"){
    if(!data.items.some(function(x){return x.id===id;})) return;
    enqueueOp({kind:"wear",id:id}, function(){
      if(grammarId!=="source-timeline") view=tabDefs[2].id;
      render();
    }, null);
    return;
  }
  if(act==="advance"){
    if(!data.items.some(function(x){return x.id===id;})) return;
    enqueueOp({kind:"advance",id:id}, null, null);
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
var bootDone=false;
function finishBoot(fromLoad){
  var keep=captureForm();
  hydrateAgenda();
  if(!bootDone){
    confirmed=cloneData();
    bootDone=true;
  } else if(fromLoad && !pendingOps.length){
    confirmed=cloneData();
  }
  replayPending();
  markQueue();
  render();
  if(keep) restoreForm(keep);
  markReady();
}
async function boot(){
  var load=document.getElementById("load");
  if(load) load.hidden=false;
  var fromLoad=false;
  try{
    if(window.Fenix&&window.Fenix.load){
      var r=await window.Fenix.load(COL);
      if(r&&typeof r==="object"&&Array.isArray(r.items)){
        data=r;
        fromLoad=true;
      }
    }
  }catch(err){ var box=document.getElementById("err"); if(box) box.hidden=false; }
  if(load) load.hidden=true;
  finishBoot(fromLoad);
}
boot();
setTimeout(function(){ if(bootDone) return; finishBoot(false); }, 500);
</script>
</body>
</html>`;
}

function polishFor(tokens: DesignTokens, grammar: LayoutGrammar, brief = ""): string {
  const intent = graphicIntentFromBrief(brief);
  const chrome =
    intent.chrome === "semantic"
      ? "Mantieni tab Home/Aggiungi/Persona e icone semantiche richieste (path originali). Vietato Ciao/Operatore. Non sostituirle solo perché comuni."
      : grammar.id === "source-timeline"
      ? "Chrome da registro di repository: testata + rail, timeline commit, rami, stato sync, diff. Vietato hero grigio, due KPI, empty card, clone GitHub."
      : grammar.id === "agenda"
        ? "Chrome da agenda: binario orario, tab Oggi/Nuovo/Settimana/Archivio, tipo 17/headline, target 44px. Vietato hero KPI, tab Home/Elenco, riquadri vuoti."
        : grammar.chrome === "desk"
        ? DASHBOARD_POLISH_INSTRUCTION
        : grammar.chrome === "masthead"
          ? SITE_POLISH_INSTRUCTION
          : "Mantieni chrome di mestiere e tab dal brief. Vietato Ciao/Operatore e tab Home/Nuovo/Elenco.";
  return [
    tokensInstruction(tokens, brief),
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
  const html = enforceGraphicIntent(productHtml(used, tokens, grammar), brief);
  return {
    brief,
    tokens,
    grammar,
    spec,
    html,
    polish: polishFor(tokens, grammar, brief),
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
