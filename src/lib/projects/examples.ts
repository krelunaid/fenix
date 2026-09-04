import type { ExampleBrief } from "./types";

export const EXAMPLES: ExampleBrief[] = [
  {
    id: "corvobar",
    label: "Landing caffè",
    kind: "landing",
    prompt:
      "Sito di un espresso bar operaio a Torino, San Salvario: macchie, bancone di zinco, menu corto scritto a mano, orari, prenota. Tono ruvido, niente luxury.",
  },
  {
    id: "kilnboard",
    label: "Dashboard SaaS",
    kind: "dashboard",
    prompt:
      "Cruscotto scuro per un team di 8 in una fonderia digitale: KPI forno, sprint, rischi. Click su una riga apre il dettaglio. Denso, industriale.",
  },
  {
    id: "vesperapp",
    label: "App meditazione",
    kind: "app",
    prompt:
      "App notturna di respirazione 4-7-8 con timer vero, tre programmi, diario sessioni in window.Fenix.load/save. Atmosfera inchiostro e luna, non wellness rosa.",
  },
  {
    id: "split",
    label: "Tool spese",
    kind: "tool",
    prompt:
      "Programma da contabile per un viaggio in camper tra 4 amici. Aggiungi costi, quote diverse, calcola chi deve a chi al centesimo. Interfaccia da foglio, non da startup.",
  },
  {
    id: "folio",
    label: "Portfolio foto",
    kind: "site",
    prompt:
      "Sito di una fotografa di architettura brutalista a Milano: lastre enormi, poco testo, about secco, contatto. Bianco sporco e acciaio, non gallery Instagram.",
  },
  {
    id: "memory",
    label: "Gioco memory",
    kind: "game",
    prompt:
      "Memory da osteria: 8 coppie di vinili, mosse, timer, partita fino alla vittoria. Legno, etichette, non pastello per bambini.",
  },
];
