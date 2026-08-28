import type { ExampleBrief } from "./types";

export const EXAMPLES: ExampleBrief[] = [
  {
    id: "corvobar",
    label: "Landing caffè",
    kind: "landing",
    prompt: "Landing per un espresso bar a Torino: menu corto, orari, prenota un tavolo. Tono caldo, da bar vero.",
  },
  {
    id: "kilnboard",
    label: "Dashboard SaaS",
    kind: "dashboard",
    prompt: "Dashboard per un team di 8: KPI, sprint, rischi. Si clicca e si cambia vista.",
  },
  {
    id: "vesperapp",
    label: "App meditazione",
    kind: "app",
    prompt: "App di respirazione con timer 4-4-4 funzionante, tre programmi e un diario delle sessioni.",
  },
  {
    id: "split",
    label: "Tool spese",
    kind: "tool",
    prompt: "Programma per dividere le spese di un viaggio tra 4 amici. Aggiungi costi, calcola chi deve a chi.",
  },
  {
    id: "folio",
    label: "Portfolio foto",
    kind: "site",
    prompt: "Sito portfolio di una fotografa di architettura a Milano. Foto grandi, about, contatto.",
  },
  {
    id: "memory",
    label: "Gioco memory",
    kind: "game",
    prompt: "Gioco memory nel browser: 8 coppie, mosse, timer, ricomincia. Si gioca fino alla vittoria.",
  },
];
