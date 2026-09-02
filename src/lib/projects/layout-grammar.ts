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
  | "phone-seed";

export type GrammarChrome = "tabs" | "desk" | "masthead";

export type LayoutGrammar = {
  id: GrammarId;
  family: TokenFamily | "unknown";
  kind: ProjectKind;
  chrome: GrammarChrome;
  stage: "split" | "plates" | "agenda" | "rooms" | "tickets" | "table" | "magazine" | "tool" | "seed";
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

export function grammarFromBrief(brief: string): LayoutGrammar {
  const family = familyFromBrief(brief);
  const kind = kindOf(brief);
  const variant = variantFromBrief(brief);
  if (!isProductFamily(family)) {
    return {
      id: "phone-seed",
      family,
      kind,
      chrome: kind === "dashboard" || kind === "site" || kind === "landing" ? "desk" : "tabs",
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
      desktop: "flacone a tutta altezza + catalogo editoriale, niente telefono al centro",
      tablet: "stage sopra, catalogo sotto a due colonne",
      mobile: "stage 42vh, lista, tab di mestiere",
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
      desktop: "rail + lookbook a tre lastre, niente inventario",
      tablet: "due lastre",
      mobile: "lastra piena, tab di mestiere",
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
      desktop: "luce di camera + binario orari + camere, non lista magazzino",
      tablet: "orari e camere affiancati",
      mobile: "camere in colonna",
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
      desktop: "piatto in luce + pass tickets + menu, non telefono",
      tablet: "tickets e menu",
      mobile: "tickets in colonna",
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
      desktop: "testata + lastre 7/5, tipografia da rivista",
      tablet: "testata e lastre impilate",
      mobile: "copertina e lastre",
      voice: {
        census: variant ? "in studio" : "in lastre",
        empty: "Nessuna lastra in fascicolo. Aggiungine una.",
        load: "Apro il fascicolo",
        ok: "In fascicolo",
        err: "La lastra non è in pagina.",
      },
    };
  }
  if (family === "ops" || kind === "dashboard") {
    return {
      id: "ops-desk",
      family,
      kind: "dashboard",
      chrome: "desk",
      stage: "table",
      desktop: "figura ledger + KPI con andamento + kanban pipeline + tabella, niente tabbar e niente telefono",
      tablet: "KPI e tabella",
      mobile: "KPI e righe",
      voice: {
        census: variant ? "in flusso" : "in pipeline",
        empty: "Nessuna riga in ledger. Registrane una.",
        load: "Apro il ledger",
        ok: "In ledger",
        err: "La riga non è registrata.",
      },
    };
  }
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
    "Vietato riciclare la stessa phone-shell, «3 in casa», Ciao/Operatore, tab Home/Nuovo/Elenco.",
    "Stati empty/loading/success/error visibili. Motion solo se prefers-reduced-motion: no-preference. Target ≥24px, focus visibile, AA.",
  ].join("\n");
}
