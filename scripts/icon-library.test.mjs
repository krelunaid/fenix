import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENDA_CALENDAR_SVG, ICON_LIBRARY, applyIconRevision, iconSvgForInstruction, sanitizeIconSvg } from "../workers/visual/icon-patch.mjs";

const idOf = (svg) => (svg ? ICON_LIBRARY.find((e) => e.svg === svg)?.id ?? null : null);

test("the requested icon wins over the tab name; unknown icons are refused", () => {
  assert.equal(idOf(iconSvgForInstruction("Cambia solo l'icona della tab Oggi: usa un calendario.")), "calendar");
  assert.equal(idOf(iconSvgForInstruction("cambia icona Elenco: usa una lista")), "list");
  assert.equal(idOf(iconSvgForInstruction("icona tab Oggi: usa un ingranaggio")), "settings");
  assert.equal(idOf(iconSvgForInstruction("cambia l'icona della tab Nuovo con una lente")), "search");
  assert.equal(idOf(iconSvgForInstruction("icona della tab Clienti: metti un omino")), "user");
  assert.equal(idOf(iconSvgForInstruction("icona tab Altro: usa un cuore")), "heart");
  assert.equal(idOf(iconSvgForInstruction("icona della tab Ordini: usa un carrello")), "cart");
  assert.equal(iconSvgForInstruction("cambia l'icona della tab Fantasma: usa un drago"), null);
});

test("every library icon is a sanitizable stroke SVG", () => {
  const ids = new Set();
  for (const entry of ICON_LIBRARY) {
    assert.ok(!ids.has(entry.id), `id duplicato ${entry.id}`);
    ids.add(entry.id);
    assert.ok(sanitizeIconSvg(entry.svg), `svg non valido per ${entry.id}`);
    assert.match(entry.svg, /aria-hidden="true"/);
    assert.ok(entry.svg.length < 2048);
  }
  assert.equal(ICON_LIBRARY[0].svg, AGENDA_CALENDAR_SVG);
});

test("applyIconRevision uses the named icon and refuses unknown ones without spending", () => {
  const html = '<!doctype html><html><body><main><p>Saved data stays here in this view.</p></main><nav><button data-view="list" data-fenix-id="icon:list"><svg viewBox="0 0 24 24"><path d="M2 2h20"/></svg>Elenco</button></nav><script>window.saved="unchanged";</script></body></html>';
  const ok = applyIconRevision({ html, instruction: "cambia icona della tab Elenco: usa un cuore" });
  assert.equal(ok.status, "ok");
  assert.ok(ok.html.includes("M12 20.5s-7.5-4.6"), "heart path inserted");
  assert.ok(!ok.html.includes('rect x="4" y="6"'), "no calendar");
  const unknown = applyIconRevision({ html, instruction: "cambia icona della tab Elenco: usa un drago" });
  assert.equal(unknown.status, "rejected");
  assert.equal(unknown.spent, false);
  assert.match(unknown.reason, /non riconosciuta/);
  assert.equal(unknown.html, html);
});
