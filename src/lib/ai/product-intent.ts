/** Product requirements are independent of palette/layout recipes. */
export type ProductIntent = {
  domain: "arcade";
  screens: string[];
  entities: { name: string; fields: string[]; crud: boolean }[];
  journeys: { id: string; steps: string[] }[];
  acceptance: string[];
  assumptions: string[];
};

export function productIntent(brief: string, kind: string): ProductIntent | null {
  if (!["app", "game"].includes(kind)) return null;
  if (!/\b(?:videogiochi|videogames|mini[ -]?giochi|arcade)\b/i.test(brief)) return null;
  // A shop/review/catalog request is a different product, not a playable arcade.
  if (/\b(?:negozio|vendere|recensioni|catalogo|ecommerce|shop)\b/i.test(brief)) return null;
  if (/\b(?:multiplayer|login|account|pagamenti|online)\b/i.test(brief)) return null;
  return {
    domain: "arcade",
    screens: ["scopri", "gioca", "preferiti", "record", "impostazioni"],
    entities: [{ name: "arcade", fields: ["favorites", "records", "nickname"], crud: true }],
    journeys: [
      { id: "partita", steps: ["scegli un gioco", "avvia", "interagisci", "concludi", "vedi il risultato", "rigioca"] },
      { id: "persistenza", steps: ["salva preferito", "ricarica", "ritrova preferito", "rimuovi preferito"] },
    ],
    acceptance: ["Almeno un gioco realmente giocabile, non un elenco di note", "Cinque schermate distinte", "Record solo da partite reali", "Errore di salvataggio visibile senza falsa conferma"],
    assumptions: ["Richiesta generica: raccolta locale di minigiochi; niente multiplayer, pagamenti o account non richiesti"],
  };
}
