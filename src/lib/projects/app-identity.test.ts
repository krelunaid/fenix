import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrefix } from "./infer.ts";
import {
  appIdentityIcon,
  appIdentityLabel,
  isAccountantBrief,
  isBarberBrief,
  isFieldProductBrief,
  isLibraryBrief,
  isShopBrief,
  wantsCrispCraftMark,
} from "./app-identity.ts";
import { craftNavIcon } from "./craft-icons.ts";

export const ACQUA_BOTTIGLIA_BRIEF =
  "App acqua bottiglia: home con botte/serbatoio acqua, livello, e tab Ordina. Stile iPhone.";

describe("isFieldProductBrief water detector", () => {
  it("matches the acqua bottiglia / botte/serbatoio brief in either order", () => {
    assert.equal(isFieldProductBrief(ACQUA_BOTTIGLIA_BRIEF), true);
    assert.equal(isFieldProductBrief(formatPrefix("app") + ACQUA_BOTTIGLIA_BRIEF), true);
    assert.equal(isFieldProductBrief("serbatoio acqua e livello in home"), true);
    assert.equal(isFieldProductBrief("App bottiglia d'acqua con botte"), true);
  });

  it("still matches NordAcqua field ops", () => {
    assert.equal(
      isFieldProductBrief(
        "NordAcqua: consegne acqua in campo, gestione dipendenti, storico e statistiche, stile Apple.",
      ),
      true,
    );
  });

  it("keeps barber, accountant, perfume and agenda out", () => {
    const barber = "mi crei un app da parrucchieri stile Barber shop";
    const fiscal = "gestionale per commercialisti, fatture e F24";
    const perfume = "Essenza: gestione profumi da vendere, stile iPhone.";
    const agenda = "Agenda appuntamenti e prenotazioni, stile Apple.";
    assert.equal(isBarberBrief(barber), true);
    assert.equal(isAccountantBrief(fiscal), true);
    assert.equal(isFieldProductBrief(barber), false);
    assert.equal(isFieldProductBrief(fiscal), false);
    assert.equal(isFieldProductBrief(perfume), false);
    assert.equal(isFieldProductBrief(agenda), false);
    assert.equal(isFieldProductBrief("Un diario per escursioni e sentieri, stile iPhone."), false);
  });

  it("uses a water drop mark instead of the generic briefcase", () => {
    assert.equal(appIdentityLabel(ACQUA_BOTTIGLIA_BRIEF, "paper"), "Acqua");
    const water = appIdentityIcon(ACQUA_BOTTIGLIA_BRIEF, "paper");
    const drop = craftNavIcon({ id: "app", label: "Acqua" }).replace(
      'data-craft-nav="1"',
      'data-craft-app="1"',
    );
    const briefcase = craftNavIcon({ id: "app", label: "Ufficio" });
    assert.equal(water, drop);
    assert.notEqual(water, briefcase.replace('data-craft-nav="1"', 'data-craft-app="1"'));
    assert.match(water, /data-craft-app="1"/);
    assert.doesNotMatch(water, /M4\.8 y="8\.8"|M5\.2 8\.6/);
  });
});

export const BARBER_IPHONE_BRIEF = "App barbiere: agenda tagli e clienti, stile iPhone.";
export const LIBRARY_IPHONE_BRIEF = "App libreria: catalogo libri, prestiti e scaffali, stile iPhone.";

describe("library and barber craft identity", () => {
  it("labels barber Taglio and library Libri, never Ufficio scrap", () => {
    assert.equal(isBarberBrief(BARBER_IPHONE_BRIEF), true);
    assert.equal(isLibraryBrief(LIBRARY_IPHONE_BRIEF), true);
    assert.equal(isLibraryBrief(formatPrefix("app") + LIBRARY_IPHONE_BRIEF), true);
    assert.equal(isLibraryBrief("catalogo libri, prestiti e scaffali"), true);
    assert.equal(isLibraryBrief("prestiti e scaffali della sala"), true);
    assert.equal(isLibraryBrief("Essenza: gestione profumi da vendere, stile iPhone."), false);
    assert.equal(isLibraryBrief(BARBER_IPHONE_BRIEF), false);
    assert.equal(isFieldProductBrief(LIBRARY_IPHONE_BRIEF), false);
    assert.equal(isShopBrief(LIBRARY_IPHONE_BRIEF), false);
    assert.equal(appIdentityLabel(BARBER_IPHONE_BRIEF, "booking"), "Taglio");
    assert.equal(appIdentityLabel(LIBRARY_IPHONE_BRIEF, "paper"), "Libri");
    assert.equal(appIdentityLabel(LIBRARY_IPHONE_BRIEF, "utility"), "Libri");
    assert.equal(appIdentityLabel(LIBRARY_IPHONE_BRIEF, "editorial"), "Libri");
    const book = appIdentityIcon(LIBRARY_IPHONE_BRIEF, "paper");
    const scrap = craftNavIcon({ id: "app", label: "Ufficio" }).replace(
      'data-craft-nav="1"',
      'data-craft-app="1"',
    );
    const shears = appIdentityIcon(BARBER_IPHONE_BRIEF, "booking");
    assert.equal(book, craftNavIcon({ id: "app", label: "Libri" }).replace('data-craft-nav="1"', 'data-craft-app="1"'));
    assert.match(book, /M9\.6 8\.6h4\.8M9\.6 12h4\.8/);
    assert.notEqual(book, scrap);
    assert.match(shears, /cy="16\.2" r="2\.15"/);
    assert.notEqual(shears, book);
  });

  it("asks a filled chip for barber, library, and unmatched generic/paper/ops", () => {
    assert.equal(wantsCrispCraftMark(BARBER_IPHONE_BRIEF, "booking"), true);
    assert.equal(wantsCrispCraftMark(LIBRARY_IPHONE_BRIEF, "paper"), true);
    assert.equal(wantsCrispCraftMark("Taglia foto ritaglio in tasca", "utility"), true);
    assert.equal(wantsCrispCraftMark("Atelier Carta: portfolio editoriale", "editorial"), true);
    assert.equal(wantsCrispCraftMark("Nord Ledger kpi di vendita pipeline vendite", "ops"), true);
    assert.equal(wantsCrispCraftMark("Un diario per escursioni e sentieri", "paper"), true);
    assert.equal(wantsCrispCraftMark("Note e promemoria per la giornata", ""), true);
    assert.equal(wantsCrispCraftMark("App acqua bottiglia: botte/serbatoio", "paper"), false);
    assert.equal(wantsCrispCraftMark("Essenza: gestione profumi da vendere", "perfume"), false);
  });
});
