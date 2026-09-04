import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrefix } from "./infer.ts";
import { tokensFromBrief } from "./design-tokens.ts";
import {
  GRAPHIC_INTENT_PARENT_SHA,
  INTENT_SERIF_PROMPT,
  INTENT_SYSTEM_PROMPT,
  applyGraphicIntent,
  enforceGraphicIntent,
  graphicIntentFromBrief,
  stampGraphicIntent,
} from "./graphic-intent.ts";
import { composeProduct } from "../ai/compose-product.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { applyChromeGuards, craftNavIcon, looksLikeAppleTabIcons } from "./craft-icons.ts";

const SYSTEM = `${formatPrefix("app")}${INTENT_SYSTEM_PROMPT}`;
const SERIF = `${formatPrefix("app")}${INTENT_SERIF_PROMPT}`;
const PERFUME = `${formatPrefix("app")}Essenza: gestione profumi premium, flaconi, note olfattive e guardaroba.`;
const AGENDA = `${formatPrefix("app")}Agenda: appuntamenti, calendario giornaliero, trattamenti e studio.`;
const SYSTEM_ONLY = `${formatPrefix("app")}Taccuino operativo, tipo system-ui iPhone-like, font di sistema primario, elenco e CRUD.`;

const APPLE_DUMP = `<!DOCTYPE html><html><body>
<nav class="fk-tab" aria-label="Navigazione">
<button data-view="home"><svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20H4z"/></svg><span>Oggi</span></button>
<button data-view="new"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg><span>Nuovo</span></button>
<button data-view="list"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h10"/></svg><span>Elenco</span></button>
<button data-view="more"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 20c1.5-4 12.5-4 14 0"/></svg><span>Squadra</span></button>
</nav></body></html>`;

describe("graphic intent from brief", () => {
  it("keeps parent SHA at 76414c7 and does not invent a score", () => {
    assert.equal(GRAPHIC_INTENT_PARENT_SHA, "76414c75ce4dc1b2f66343fc0ed1160be0c1b45b");
  });

  it("honors explicit system/iPhone-like type and semantic Home/Aggiungi/Persona chrome", () => {
    const intent = graphicIntentFromBrief(SYSTEM);
    assert.equal(intent.type, "system");
    assert.equal(intent.chrome, "semantic");
    const tokens = tokensFromBrief(SYSTEM);
    assert.equal(tokens.fonts.display, "system-ui");
    assert.equal(tokens.fonts.body, "system-ui");
    assert.equal(tokens.fonts.href, "");
    assert.notEqual(tokens.fonts.display, "Literata");
    const html = composeProduct(SYSTEM).html;
    assert.match(html, /data-intent-type="system"/);
    assert.match(html, /data-intent-chrome="semantic"/);
    assert.match(html, /--display:ui-sans-serif,system-ui,-apple-system/);
    assert.match(html, /--body:ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.match(html, /<span>Home<\/span>/);
    assert.match(html, /<span>Aggiungi<\/span>/);
    assert.match(html, /<span>Persona<\/span>/);
    assert.doesNotMatch(html, /<span>Tavolo<\/span>/);
    assert.equal(looksLikeAppleTabIcons(html), false);
    const src = prepareSrcDoc(html, tokens.palette, "intent-system", "app");
    assert.match(src, /<span>Home<\/span>/);
    assert.match(src, /<span>Aggiungi<\/span>/);
    assert.match(src, /data-intent-type="system"/);
    assert.match(src, /--body:ui-sans-serif,system-ui,-apple-system/);
  });

  it("honors explicit serif/Literata and does not force system as primary", () => {
    const intent = graphicIntentFromBrief(SERIF);
    assert.equal(intent.type, "serif");
    assert.equal(intent.face, "Literata");
    assert.equal(intent.chrome, "domain");
    const tokens = tokensFromBrief(SERIF);
    assert.equal(tokens.fonts.display, "Literata");
    assert.equal(tokens.fonts.body, "Literata");
    assert.match(tokens.fonts.href, /Literata/);
    const html = composeProduct(SERIF).html;
    assert.match(html, /data-intent-type="serif"/);
    assert.match(html, /--display:"Literata",ui-serif,Georgia/);
    assert.match(html, /--body:"Literata",ui-serif,Georgia/);
    assert.doesNotMatch(html, /--body:"Figtree"/);
    const src = prepareSrcDoc(html, tokens.palette, "intent-serif", composeProduct(SERIF).grammar.kind);
    assert.match(src, /--display:"Literata"/);
    assert.doesNotMatch(src, /font:400 16px\/1\.5 system-ui,sans-serif/);
  });

  it("keeps domain perfume and agenda recipes when the brief does not ask", () => {
    const perfume = tokensFromBrief(PERFUME);
    const agenda = tokensFromBrief(AGENDA);
    assert.equal(graphicIntentFromBrief(PERFUME).type, "domain");
    assert.equal(graphicIntentFromBrief(AGENDA).type, "domain");
    assert.equal(perfume.fonts.display, "Cormorant Garamond");
    assert.equal(agenda.fonts.display, "Figtree");
    assert.notEqual(perfume.fonts.display, agenda.fonts.display);
    assert.match(composeProduct(PERFUME).html, /Cormorant Garamond/);
    assert.match(composeProduct(AGENDA).html, /Figtree/);
    assert.doesNotMatch(composeProduct(AGENDA).html, /data-intent-type="system"/);
    assert.doesNotMatch(composeProduct(AGENDA).html, /<span>Home<\/span>/);
  });

  it("does not rewrite stamped semantic chrome, still rewrites a dumped iPhone set", () => {
    assert.equal(looksLikeAppleTabIcons(APPLE_DUMP), true);
    assert.match(applyChromeGuards(APPLE_DUMP), /M6 3\.5h11\.5v17H6z/);
    const stamped = stampGraphicIntent(APPLE_DUMP, SYSTEM);
    assert.match(stamped, /data-intent-type="system"/);
    assert.match(stamped, /data-intent-chrome="semantic"/);
    const kept = applyChromeGuards(stamped);
    assert.match(kept, /M4 10\.5 12 4l8 6\.5V20H4z/);
    assert.doesNotMatch(kept, /M6 3\.5h11\.5v17H6z/);
  });

  it("still rewrites dumped iPhone chrome when system type is asked without Home tabs", () => {
    assert.equal(graphicIntentFromBrief(SYSTEM_ONLY).chrome, "domain");
    const stamped = stampGraphicIntent(APPLE_DUMP, SYSTEM_ONLY);
    assert.match(stamped, /data-intent-type="system"/);
    assert.match(stamped, /data-intent-chrome="domain"/);
    const next = applyChromeGuards(stamped);
    assert.match(next, /M6 3\.5h11\.5v17H6z/);
    assert.doesNotMatch(next, /M4 10\.5 12 4l8 6\.5V20H4z/);
  });

  it("overwrites a domain stamp when the real brief asks for serif", () => {
    const domain = stampGraphicIntent("<!DOCTYPE html><html lang='it'><body></body></html>", PERFUME);
    assert.match(domain, /data-intent-type="domain"/);
    const serif = stampGraphicIntent(domain, SERIF);
    assert.match(serif, /data-intent-type="serif"/);
    assert.doesNotMatch(serif, /data-intent-type="domain"/);
  });

  it("enforceGraphicIntent restores system type after a repair that dropped Karla in", () => {
    const dropped = `<!DOCTYPE html><html lang="it"><head>
<link href="https://fonts.googleapis.com/css2?family=Karla&display=swap" rel="stylesheet"/>
<style>:root{--display:"Karla",sans-serif;--body:"Karla",sans-serif}html,body{font-family:Karla,sans-serif}</style>
</head><body><main>lista</main></body></html>`;
    const next = enforceGraphicIntent(dropped, SYSTEM);
    assert.match(next, /data-intent-type="system"/);
    assert.match(next, /--body:ui-sans-serif,system-ui,-apple-system/);
    assert.match(next, /--display:ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(next, /fonts\.googleapis\.com/);
    assert.doesNotMatch(next, /--body:"Karla"/);
    assert.match(next, /font-family:var\(--body/);
  });

  it("maps Home/Aggiungi/Persona labels to original glyphs, not Apple geometry or id=home", () => {
    const home = craftNavIcon({ id: "home", label: "Home" }, 0);
    const tavolo = craftNavIcon({ id: "home", label: "Tavolo" }, 0);
    const add = craftNavIcon({ id: "nuovo", label: "Aggiungi" }, 1);
    const person = craftNavIcon({ id: "persona", label: "Persona" }, 3);
    assert.match(home, /M5 10\.8 12 5\.2 19 10\.8V19\.2H5z/);
    assert.doesNotMatch(home, /M4 10\.5 12 4l8 6\.5V20H4z/);
    assert.doesNotMatch(tavolo, /M5 10\.8 12 5\.2/);
    assert.match(add, /M12 7\.2v9\.6M7\.2 12h9\.6/);
    assert.doesNotMatch(add, /M12 8v8M8 12h8/);
    assert.match(person, /cy="8\.2"/);
    assert.doesNotMatch(person, /cy="7"/);
  });

  it("applyGraphicIntent is a no-op on domain tokens", () => {
    const perfume = tokensFromBrief(PERFUME);
    assert.equal(applyGraphicIntent(perfume, PERFUME).fonts.display, perfume.fonts.display);
  });
});
