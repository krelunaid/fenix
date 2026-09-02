import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrefix } from "./infer.ts";
import { grammarFromBrief } from "./layout-grammar.ts";
import { familyFromBrief, tokensFromBrief, variantFromBrief } from "./design-tokens.ts";

const BRIEFS = {
  essenza: `${formatPrefix("app")}Essenza: gestione profumi premium, flaconi, note olfattive e guardaroba.`,
  essenzaIce: `${formatPrefix("app")}Essenza Vetro: gestione profumi premium, flaconi di vetro, note di ghiaccio e nebbia.`,
  vesti: `${formatPrefix("app")}Vesti: moda e vendite, lookbook, capi in passerella e cassa.`,
  vestiOsso: `${formatPrefix("app")}Vesti Osso: moda e vendite, lookbook in avorio, capi in osso e cassa.`,
  locanda: `${formatPrefix("app")}Locanda Pietra: prenotazioni di ospitalità, camere, reception e soggiorno in pietra.`,
  osteria: `${formatPrefix("app")}Osteria del Passo: ristorazione, menu degustazione, comande al passo cucina e sala da pranzo.`,
  nord: `${formatPrefix("dashboard")}Nord Ledger: cruscotto vendite, kpi di vendita, pipeline vendite e ledger commerciale.`,
  carta: `${formatPrefix("site")}Atelier Carta: portfolio editoriale, rivista di lastre fotografiche e rassegna di studio.`,
};

describe("layout grammar from brief", () => {
  it("gives six hard briefs six different grammars and keeps dual perfume/fashion directions apart", () => {
    const ids = [
      grammarFromBrief(BRIEFS.essenza).id,
      grammarFromBrief(BRIEFS.vesti).id,
      grammarFromBrief(BRIEFS.locanda).id,
      grammarFromBrief(BRIEFS.osteria).id,
      grammarFromBrief(BRIEFS.nord).id,
      grammarFromBrief(BRIEFS.carta).id,
    ];
    assert.deepEqual(ids, ["split-stage", "lookbook", "hospitality", "service-board", "ops-desk", "magazine"]);
    assert.equal(new Set(ids).size, 6);
    assert.equal(grammarFromBrief(BRIEFS.nord).chrome, "desk");
    assert.equal(grammarFromBrief(BRIEFS.carta).chrome, "masthead");
    assert.match(grammarFromBrief(BRIEFS.essenza).desktop, /niente tabbar/i);
    assert.match(grammarFromBrief(BRIEFS.essenza).mobile, /tabbar solo/i);
    assert.equal(familyFromBrief(BRIEFS.essenza), "perfume");
    assert.equal(variantFromBrief(BRIEFS.essenza), 0);
    assert.equal(variantFromBrief(BRIEFS.essenzaIce), 1);
    assert.equal(variantFromBrief(BRIEFS.vesti), 0);
    assert.equal(variantFromBrief(BRIEFS.vestiOsso), 1);
    const a = tokensFromBrief(BRIEFS.essenza);
    const b = tokensFromBrief(BRIEFS.essenzaIce);
    assert.notEqual(a.palette.bg, b.palette.bg);
    assert.notEqual(a.fonts.display, b.fonts.display);
  });

  it("gives a repository brief the source-timeline grammar, not a phone seed", () => {
    const brief = `${formatPrefix("app")}RepoVoci: registro delle voci di un repository, commit, rami, stato di sync e timeline/diff.`;
    const g = grammarFromBrief(brief);
    assert.equal(familyFromBrief(brief), "repo");
    assert.equal(g.id, "source-timeline");
    assert.equal(g.chrome, "desk");
    assert.match(g.desktop, /niente hero/i);
  });

  it("assigns distant non-product domains distinct grammars, not one phone seed", () => {
    const clinica = grammarFromBrief(`${formatPrefix("app")}Clinica Aurora: agenda di uno studio medico, pazienti, slot e terapie.`);
    const pulse = grammarFromBrief(`${formatPrefix("app")}Pulse Radio: palinsesto live, playlist e impulsi di una radio notturna ad alta croma.`);
    const docs = grammarFromBrief(`${formatPrefix("site")}Carta Luce: manuale di knowledge, documenti e wiki di studio in luce diurna.`);
    const pastel = grammarFromBrief(`${formatPrefix("app")}Studio Pastello: didattica e wellness, lezioni in pastello.`);
    const signal = grammarFromBrief(`${formatPrefix("tool")}Segnale Mono: strumento a contrasto alto, segnale unico, niente colore di mestiere.`);
    const ids = [clinica.id, pulse.id, docs.id, pastel.id, signal.id];
    assert.equal(new Set(ids).size, 5, ids.join(","));
    assert.equal(clinica.id, "agenda");
    assert.equal(pulse.id, "split-stage");
    assert.equal(docs.id, "magazine");
    assert.equal(pastel.id, "service-board");
    assert.equal(signal.id, "pocket-tool");
  });
});
