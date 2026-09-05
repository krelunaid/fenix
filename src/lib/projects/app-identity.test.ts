import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrefix } from "./infer.ts";
import {
  appIdentityIcon,
  appIdentityLabel,
  isAccountantBrief,
  isBarberBrief,
  isFieldProductBrief,
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
