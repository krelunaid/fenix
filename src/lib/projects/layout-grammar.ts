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
import { inferKind, isClipFeedBrief, isPhoneKind, kindFromPrompt } from "./infer.ts";
import { isLibraryBrief } from "./app-identity.ts";
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
  | "clip-feed"
  | "phone-seed";

export type GrammarChrome = "tabs" | "desk" | "masthead";

export type LayoutGrammar = {
  id: GrammarId;
  family: TokenFamily | "unknown";
  kind: ProjectKind;
  chrome: GrammarChrome;
  stage: "split" | "plates" | "agenda" | "rooms" | "tickets" | "table" | "magazine" | "tool" | "timeline" | "feed" | "seed";
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

export { isClipFeedBrief };

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
  // Format intent wins over domain recipes: a restaurant website is not a kitchen board.
  if (kind === "site" || kind === "landing") return {
    id: "magazine", family, kind, chrome: "masthead", stage: "magazine",
    desktop: "testata e nav superiore, hero 2 colonne, sezioni di offerta e racconto, contatti e footer; niente tabbar e niente 0-KPI operativi",
    tablet: "hero fluido, griglia adattiva, navigazione superiore leggibile",
    mobile: "sezioni in colonna, controlli 44px, niente tabbar o dashboard operativa",
    voice: { census: "in evidenza", empty: "Nessuna richiesta inviata.", load: "Apro il sito", ok: "Richiesta salvata", err: "La richiesta non è stata salvata." },
  };
  if (isPhoneKind(kind) && isClipFeedBrief(brief)) {
    return {
      id: "clip-feed",
      family,
      kind,
      chrome: "tabs",
      stage: "feed",
      desktop: "sala cinematografica a tutta pagina: wallpaper sfocato, lastre 9:16 ~480px, copy a destra, dock a pillola, niente iPhone boxed e niente poster spalmato",
      tablet: "clip a tutta altezza, dock in basso",
      mobile: "clip 100dvh, overlay caption, azioni laterali, dock Feed/Crea/Salvati/Profilo, niente agenda",
      voice: {
        census: "in onda",
        empty: "Nessun clip in feed. Registrane uno.",
        load: "Apro il feed",
        ok: "In onda",
        err: "Il clip non è in feed.",
      },
    };
  }
  // Bookstore / library is a phone craft — never magazine masthead or desk STUDIO.
  if (isLibraryBrief(brief) && kind !== "dashboard") {
    return {
      id: "phone-seed",
      family,
      kind,
      chrome: "tabs",
      stage: "seed",
      desktop: "scaffale editoriale a colonna, prestiti e catalogo, niente hero KPI",
      tablet: "catalogo e prestiti in colonna",
      mobile: "tasca libreria 100dvh, tabbar mestiere",
      voice: {
        census: "in prestito",
        empty: "Nessun libro in scaffale.",
        load: "Apro lo scaffale",
        ok: "In scaffale",
        err: "Il libro non è in catalogo.",
      },
    };
  }
  // Desktop gestionale wins over unknown-family phone-seed and domain tab grammars.
  if (kind === "dashboard") return opsDeskGrammar(family, variant);
  if (family === "repo") {
    return {
      id: "source-timeline",
      family,
      kind: "app",
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
        desktop: "tasca premium a colonna, filled mark, niente hero 0-KPI",
        tablet: "colonna editoriale",
        mobile: "tasca 100dvh, tabbar mestiere",
        voice: {
          census: "in tasca",
          empty: "Niente in lista. Aggiungi la prima voce.",
          load: "Apro l'elenco",
          ok: "In elenco",
          err: "La voce non è salvata.",
        },
      };
    }
    return {
      id: "phone-seed",
      family,
      kind,
      chrome: "tabs",
      stage: "seed",
      desktop: "tasca premium a colonna, filled mark, card piene, niente hero 0-KPI",
      tablet: "colonna editoriale",
      mobile: "tasca 100dvh, tabbar mestiere",
      voice: {
        census: "in tasca",
        empty: "Niente in lista. Aggiungi la prima voce.",
        load: "Apro l'elenco",
        ok: "In elenco",
        err: "La voce non è salvata.",
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
      desktop: "tasca premium a colonna, filled mark, niente hero 0-KPI",
      tablet: "colonna editoriale",
      mobile: "tasca 100dvh, tabbar mestiere",
      voice: {
        census: "in tasca",
        empty: "Niente in lista. Aggiungi la prima voce.",
        load: "Apro l'elenco",
        ok: "In elenco",
        err: "La voce non è salvata.",
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
    "Navigazione device-aware: tabbar solo sotto 768px salvo clip-feed; tablet e desktop usano header/nav in testata. Vietato allargare la tabbar a tutta larghezza. Clip-feed su desktop: sala cinematografica, non tab in testata.",
    "Vietato riciclare la stessa phone-shell, «3 in casa», Ciao/Operatore, tab Home/Nuovo/Elenco.",
    grammar.id === "source-timeline"
      ? "Repository: attività, rami, sync, diff. Vietato home universale hero grigio + due KPI + CTA + empty card. Non copiare GitHub, Apple o Emergent."
      : grammar.id === "clip-feed"
        ? "Feed verticale originale: PRIMO PAINT clip-stage a tutto schermo. Desktop: wallpaper sfocato dal poster, lastre 9:16 ~480px, colonna copy, dock a pillola. Vietato iPhone boxed, poster a 1280, Niente in lista, voci, agenda, 5 tab Home/Nuovo/Elenco/Stats, card KPI. Non clonare TikTok, Instagram, marchio o «For You»."
        : "Stati empty/loading/success/error visibili. Motion solo se prefers-reduced-motion: no-preference. Target ≥24px, focus visibile, AA.",
  ].join("\n");
}
