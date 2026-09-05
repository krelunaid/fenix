/**
 * Domain + format layout grammar. Deterministic, 0 tokens.
 * Different briefs must not share the same phone-shell composition.
 */
import {
  familyFromBrief,
  isProductFamily,
  variantFromBrief,
  type TokenFamily,
} from "./design-tokens.ts";
import { extractBriefAxes } from "./palette-engine.ts";
import { inferKind, kindFromPrompt } from "./infer.ts";
import type { ProjectKind } from "./types.ts";

export type GrammarId =
  | "split-stage"
  | "lookbook"
  | "agenda"
  | "hospitality"
  | "service-board"
  | "ops-desk"
  | "magazine"
  | "pocket-tool"
  | "source-timeline"
  | "phone-seed";

export type GrammarChrome = "tabs" | "desk" | "masthead";

export type LayoutGrammar = {
  id: GrammarId;
  family: TokenFamily | "unknown";
  kind: ProjectKind;
  chrome: GrammarChrome;
  stage: "split" | "plates" | "agenda" | "rooms" | "tickets" | "table" | "magazine" | "tool" | "timeline" | "seed";
  desktop: string;
  tablet: string;
  mobile: string;
  voice: {
    census: string;
    empty: string;
    load: string;
    ok: string;
    err: string;
  };
};

function kindOf(brief: string): ProjectKind {
  return kindFromPrompt(brief) ?? inferKind(brief);
}

function opsDeskGrammar(family: TokenFamily | "unknown", variant: number): LayoutGrammar {
  return {
    id: "ops-desk",
    family,
    kind: "dashboard",
    chrome: "desk",
    stage: "table",
    desktop: "header operativo + KPI + kanban 4 + tabella, niente rail tagliata e niente tabbar",
    tablet: "header + KPI 4 + kanban 2 + tabella scrollabile",
    mobile: "KPI 2×2, lane in colonna, tabella in overflow-x, nav in testata",
    voice: {
      census: variant ? "in flusso" : "in pipeline",
      empty: "Nessuna riga in ledger. Registrane una.",
      load: "Apro il ledger",
      ok: "In ledger",
      err: "La riga non è registrata.",
    },
  };
}

export function grammarFromBrief(brief: string): LayoutGrammar {
  const family = familyFromBrief(brief);
  const kind = kindOf(brief);
  const variant = variantFromBrief(brief);
  // Desktop gestionale wins over unknown-family phone-seed and domain tab grammars.
  if (kind === "dashboard") return opsDeskGrammar(family, variant);
  if (family === "repo") {
    return {
      id: "source-timeline",
      family,
      kind: kind === "site" || kind === "landing" ? kind : "app",
      chrome: "desk",
      stage: "timeline",
      desktop: variant
        ? "testata editoriale + colonna diff a tutta altezza + rami, niente hero KPI"
        : "testata tecnica + timeline commit + rami/sync, niente hero grigio e niente 2 KPI",
      tablet: "nav in testata, timeline e rami in colonna densa",
      mobile: "timeline in colonna, rami in nastro, nav in testata, niente tabbar Home/Nuovo",
      voice: {
        census: variant ? "in luce" : "in voce",
        empty: "Nessuna voce in linea. Registra un commit.",
        load: "Allineo il repo",
        ok: "In linea",
        err: "Sync non registrato.",
      },
    };
  }
  if (!isProductFamily(family)) {
    const axes = extractBriefAxes(brief);
    if (axes.domain === "clinical") {
      return {
        id: "agenda",
        family,
        kind,
        chrome: "tabs",
        stage: "agenda",
        desktop: "luce clinica + agenda a binario, niente hero KPI",
        tablet: "giornata e slot in colonna",
        mobile: "slot in colonna, tabbar mestiere",
        voice: {
          census: "in cura",
          empty: "Nessuno slot in agenda. Aprine uno.",
          load: "Apro l'agenda",
          ok: "In agenda",
          err: "Lo slot non è confermato.",
        },
      };
    }
    if (axes.domain === "music") {
      return {
        id: "split-stage",
        family,
        kind,
        chrome: "tabs",
        stage: "split",
        desktop: "palco a tutta altezza + palinsesto, niente tabbar",
        tablet: "palco e lista in colonna",
        mobile: "palco 42vh, lista, tabbar",
        voice: {
          census: "in onda",
          empty: "Nessun brano in palinsesto. Mettine uno.",
          load: "Apro il palco",
          ok: "In onda",
          err: "Il brano non è in linea.",
        },
      };
    }
    if (axes.domain === "docs") {
      return {
        id: "magazine",
        family,
        kind: kind === "app" ? "site" : kind,
        chrome: "masthead",
        stage: "magazine",
        desktop: "testata + lastre di documento a tutta larghezza",
        tablet: "copertina e fascicolo in colonna",
        mobile: "copertina, lastre, nav in testata",
        voice: {
          census: "in fascicolo",
          empty: "Nessuna lastra. Scrivine una.",
          load: "Apro il fascicolo",
          ok: "In fascicolo",
          err: "Lastra non registrata.",
        },
      };
    }
    if (axes.domain === "studio") {
      return {
        id: "service-board",
        family,
        kind,
        chrome: "tabs",
        stage: "tickets",
        desktop: "bacheca lezioni, niente inventario",
        tablet: "biglietti in colonna",
        mobile: "biglietti, tabbar mestiere",
        voice: {
          census: "in studio",
          empty: "Nessuna lezione in bacheca. Aprine una.",
          load: "Apro lo studio",
          ok: "In studio",
          err: "Lezione non registrata.",
        },
      };
    }
    if (axes.tone === "austere") {
      return {
        id: "pocket-tool",
        family,
        kind: kind === "app" ? "tool" : kind,
        chrome: "tabs",
        stage: "tool",
        desktop: "nastro di misura a tutta larghezza, niente KPI",
        tablet: "nastro e registro",
        mobile: "nastro in tasca",
        voice: {
          census: "sul nastro",
          empty: "Nessuna misura. Prendine una.",
          load: "Apro il nastro",
          ok: "Sul nastro",
          err: "Misura non registrata.",
        },
      };
    }
    return {
      id: "phone-seed",
      family,
      kind,
      chrome: kind === "site" || kind === "landing" ? "desk" : "tabs",
      stage: "seed",
      desktop: "scheletro di mestiere, non boxed 1080",
      tablet: "colonna utile",
      mobile: "tasca 100dvh",
      voice: {
        census: "in lavorazione",
        empty: "Nessuna riga. Compila e salva.",
        load: "Carico",
        ok: "Salvato",
        err: "Non salvato. Riprova.",
      },
    };
  }
  if (family === "perfume") {
    return {
      id: "split-stage",
      family,
      kind,
      chrome: "tabs",
      stage: "split",
      desktop: "header + nav in testata, flacone a tutta altezza + catalogo, niente tabbar e niente telefono al centro",
      tablet: "header con nav in riga, stage e catalogo in colonna",
      mobile: "stage 42vh, lista, tabbar solo in basso",
      voice: {
        census: variant ? "in vetrina" : "in collezione",
        empty: "Nessuna essenza in guardaroba. Componine una.",
        load: "Apro il guardaroba",
        ok: "In collezione",
        err: "La formula non è registrata.",
      },
    };
  }
  if (family === "fashion") {
    return {
      id: "lookbook",
      family,
      kind,
      chrome: "tabs",
      stage: "plates",
      desktop: "header atelier + lookbook a tre lastre, niente inventario e niente tabbar",
      tablet: "nav in testata, due lastre",
      mobile: "lastra piena, tabbar solo in basso",
      voice: {
        census: variant ? "in prova" : "in passerella",
        empty: "Nessun capo in prova. Mettine uno in tela.",
        load: "Apro l'atelier",
        ok: "In passerella",
        err: "Il capo non è in libro.",
      },
    };
  }
  if (family === "hospitality") {
    return {
      id: "hospitality",
      family,
      kind,
      chrome: "tabs",
      stage: "rooms",
      desktop: "header reception + luce di camera + binario orari, non lista magazzino",
      tablet: "nav in testata, orari e camere affiancati",
      mobile: "camere in colonna, tabbar solo in basso",
      voice: {
        census: variant ? "in house" : "camere pronte",
        empty: "Nessun arrivo in reception. Prenota una camera.",
        load: "Apro la reception",
        ok: "Camera confermata",
        err: "Prenotazione non registrata.",
      },
    };
  }
  if (family === "food") {
    return {
      id: "service-board",
      family,
      kind,
      chrome: "tabs",
      stage: "tickets",
      desktop: "header di passo + piatto in luce + ticket a nastro, non telefono",
      tablet: "nav in testata, tickets e menu",
      mobile: "tickets in colonna, tabbar solo in basso",
      voice: {
        census: variant ? "al crudo" : "al passo",
        empty: "Nessun piatto al passo. Invia una comanda.",
        load: "Apro la cucina",
        ok: "In servizio",
        err: "La comanda non è partita.",
      },
    };
  }
  if (family === "editorial") {
    return {
      id: "magazine",
      family,
      kind: kind === "app" ? "site" : kind,
      chrome: "masthead",
      stage: "magazine",
      desktop: "testata di rivista + lastre 7/5, niente tabbar",
      tablet: "testata e lastre impilate, nav in riga",
      mobile: "copertina e lastre, rail in chip non tabbar",
      voice: {
        census: variant ? "in studio" : "in lastre",
        empty: "Nessuna lastra in fascicolo. Aggiungine una.",
        load: "Apro il fascicolo",
        ok: "In fascicolo",
        err: "La lastra non è in pagina.",
      },
    };
  }
  if (family === "ops") return opsDeskGrammar(family, variant);
  if (family === "utility") {
    return {
      id: "pocket-tool",
      family,
      kind,
      chrome: "tabs",
      stage: "tool",
      desktop: "tavolo di taglio a due colonne",
      tablet: "tavolo e prove",
      mobile: "metro in tasca",
      voice: {
        census: "sul nastro",
        empty: "Nessuna misura. Prendine una.",
        load: "Apro il nastro",
        ok: "Sul nastro",
        err: "Misura non registrata.",
      },
    };
  }
  return {
    id: "agenda",
    family,
    kind,
    chrome: "tabs",
    stage: "agenda",
    desktop: "luce di sala + agenda a binario orario",
    tablet: "giornata e form",
    mobile: "slot in colonna",
    voice: {
      census: "in agenda",
      empty: "Nessuna prenotazione in agenda. Aprine una.",
      load: "Apro l'agenda",
      ok: "In agenda",
      err: "Lo slot non è confermato.",
    },
  };
}

export function grammarInstruction(grammar: LayoutGrammar): string {
  return [
    `GRAMMATICA DI LAYOUT (legge, ${grammar.id}):`,
    `chrome=${grammar.chrome} stage=${grammar.stage}`,
    `desktop: ${grammar.desktop}`,
    `tablet: ${grammar.tablet}`,
    `mobile: ${grammar.mobile}`,
    `voce: ${grammar.voice.census}; empty="${grammar.voice.empty}"`,
    "Navigazione device-aware: tabbar solo sotto 768px; tablet e desktop usano header/nav in testata. Vietato allargare la tabbar a tutta larghezza.",
    "Vietato riciclare la stessa phone-shell, «3 in casa», Ciao/Operatore, tab Home/Nuovo/Elenco.",
    grammar.id === "source-timeline"
      ? "Repository: attività, rami, sync, diff. Vietato home universale hero grigio + due KPI + CTA + empty card. Non copiare GitHub, Apple o Emergent."
      : "Stati empty/loading/success/error visibili. Motion solo se prefers-reduced-motion: no-preference. Target ≥24px, focus visibile, AA.",
  ].join("\n");
}
