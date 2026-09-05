import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPrefix } from "./infer.ts";
import { tokensFromBrief } from "./design-tokens.ts";
import {
  GRAPHIC_INTENT_PARENT_SHA,
  INTENT_IPHONE_IT_PROMPT,
  INTENT_SERIF_PROMPT,
  INTENT_SYSTEM_PROMPT,
  applyGraphicIntent,
  enforceGraphicIntent,
  graphicIntentFromBrief,
  stampGraphicIntent,
  wantsNativeAppStyle,
} from "./graphic-intent.ts";
import { applyNativeAppStyle, nativeStyleAssignsPalette } from "./native-app-style.ts";
import { composeProduct } from "../ai/compose-product.ts";
import { prepareSrcDoc } from "./color-scheme.ts";
import { applyChromeGuards, craftNavIcon, looksLikeAppleTabIcons } from "./craft-icons.ts";
import { contrastRatio } from "./visual-quality.ts";
import { grammarFromBrief } from "./layout-grammar.ts";

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
  it("applies a native app direction only when requested, preserving data and other formats", () => {
    for (const direction of ["stile Apple", "stile iPhone", "interfaccia iOS", "iPhone-like"]) {
      const brief = `${formatPrefix("app")}Catalogo profumi, ${direction}`;
      assert.equal(wantsNativeAppStyle(brief), true, direction);
      assert.equal(graphicIntentFromBrief(brief).type, "system");
      assert.equal(wantsNativeAppStyle(`Non usare ${direction}`), false);
      const composed = composeProduct(brief);
      assert.match(composed.html, /data-fenix-native-style="v1"/);
      const plain = applyNativeAppStyle(composed.html, false);
      assert.equal(applyNativeAppStyle(plain, true), composed.html);
      assert.equal(applyNativeAppStyle(composed.html, true), composed.html);
      assert.equal(plain.slice(plain.indexOf("</head>")), composed.html.slice(composed.html.indexOf("</head>")));
      assert.deepEqual([...plain.matchAll(/--(?:bg|surface|fg|accent):([^;]+)/g)].map(m => m[0]), [...composed.html.matchAll(/--(?:bg|surface|fg|accent):([^;]+)/g)].map(m => m[0]));
    }
    const commercialisti = `${formatPrefix("dashboard")}mi crei un gestionale per commercialisti`;
    for (const brief of ["App con Apple Pay", "App rivenditore Apple", "App caratteri di sistema", `${formatPrefix("site")}Portfolio stile Apple`, `${formatPrefix("dashboard")}CRM stile iPhone`, commercialisti]) {
      assert.equal(wantsNativeAppStyle(brief), false, brief);
      assert.doesNotMatch(composeProduct(brief).html, /data-fenix-native-style/);
    }
    assert.equal(grammarFromBrief(commercialisti).id, "ops-desk");
    assert.equal(grammarFromBrief(commercialisti).chrome, "desk");
    assert.doesNotMatch(composeProduct(commercialisti).html, /\bfk-tab\b/);
    assert.equal(applyNativeAppStyle("<html><head></head><body>Studio</body></html>", true), "<html><head></head><body>Studio</body></html>");
    assert.equal(graphicIntentFromBrief("App stile Apple, invece serif primario Garamond").type, "serif");
    const nativeLayer = composeProduct(`${formatPrefix("app")}Agenda appuntamenti, stile Apple`).html.match(
      /<style data-fenix-native-style="v1">[\s\S]*?<\/style>/,
    )?.[0] || "";
    assert.match(nativeLayer, /--fenix-type-large-title:34px/);
    assert.match(nativeLayer, /--fenix-type-body:17px/);
    assert.match(nativeLayer, /--fenix-space:8px/);
    assert.match(nativeLayer, /font-variant-numeric:tabular-nums/);
    assert.equal(nativeStyleAssignsPalette(nativeLayer), false);
    assert.doesNotMatch(nativeLayer, /#b51246|#0071e3|#f5f5f7/);
  });

  it("does not treat a shop-name fixture as native style or a house accent", () => {
    const brief = `${formatPrefix("app")}mi crei un app da parrucchieri stile Barber shop`;
    assert.equal(wantsNativeAppStyle(brief), false);
    assert.equal(graphicIntentFromBrief(brief).type, "domain");
    const tokens = tokensFromBrief(brief);
    assert.equal(tokens.family, "booking");
    assert.notEqual(tokens.palette.accent.toLowerCase(), "#b51246");
    assert.notEqual(tokens.fonts.display, "system-ui");
    const html = composeProduct(brief).html;
    assert.doesNotMatch(html, /data-fenix-native-style/);
    assert.doesNotMatch(html, /#b51246|#b01e47|#a61d4c/i);
    const asked = `${brief}, stile iPhone`;
    assert.equal(wantsNativeAppStyle(asked), true);
    assert.equal(graphicIntentFromBrief(asked).type, "system");
    const native = composeProduct(asked);
    const layer = native.html.match(/<style data-fenix-native-style="v1">[\s\S]*?<\/style>/)?.[0] || "";
    assert.equal(nativeStyleAssignsPalette(layer), false);
    assert.equal(native.tokens.palette.accent, tokens.palette.accent);
    const locked = tokensFromBrief(`${brief}, accento #006633`);
    assert.equal(locked.palette.accent, "#006633");
  });

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
    assert.ok(applyChromeGuards(APPLE_DUMP).includes(craftNavIcon({ id: "home", label: "Oggi" })));
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
    assert.ok(next.includes(craftNavIcon({ id: "home", label: "Oggi" })));
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

  it("honors the Italian 'stile iPhone' quality phrasing as system, not domain", () => {
    const intent = graphicIntentFromBrief(INTENT_IPHONE_IT_PROMPT);
    assert.equal(intent.type, "system");
    assert.equal(graphicIntentFromBrief("Voglio una app stile iPhone").type, "system");
    assert.equal(graphicIntentFromBrief("un'app come iPhone, font di sistema").type, "system");
    assert.equal(graphicIntentFromBrief("qualità iPhone, non clonare Apple").type, "system");
    assert.equal(intent.chrome, "domain");
  });

  it("does not invert negation: 'Non usare Literata' is not a serif ask", () => {
    const denied = graphicIntentFromBrief("Non usare Literata");
    assert.equal(denied.type, "domain");
    assert.equal(denied.face, null);
    assert.equal(graphicIntentFromBrief("niente Literata").type, "domain");
    assert.equal(graphicIntentFromBrief("senza serif").type, "domain");
    assert.equal(graphicIntentFromBrief("Non clonare iPhone").type, "domain");
    const still = graphicIntentFromBrief("serif da rivista Literata. Non usare Inter.");
    assert.equal(still.type, "serif");
    assert.equal(still.face, "Literata");
  });

  it("scopes denial to the clause and keeps the last positive type", () => {
    const mixed = graphicIntentFromBrief("Non usare Literata ma system-ui");
    assert.equal(mixed.type, "system");
    assert.equal(mixed.face, null);
    assert.equal(graphicIntentFromBrief("Non usare Literata, usa system-ui").type, "system");
    assert.equal(graphicIntentFromBrief("system-ui. Non usare Literata.").type, "system");
    assert.equal(graphicIntentFromBrief("Non usare system-ui, usa Literata").type, "serif");
  });

  it("recognizes Italian system typography wording, denials and last positive direction", () => {
    for (const wording of ["font di sistema", "caratteri di sistema", "carattere di sistema", "tipografia di sistema", "CARATTERI  DI  SISTEMA"]) {
      assert.equal(graphicIntentFromBrief(`App profumi, ${wording}`).type, "system", wording);
      assert.equal(graphicIntentFromBrief(`Non usare ${wording}`).type, "domain", `denied ${wording}`);
      assert.equal(graphicIntentFromBrief(`Non usare ${wording}, usa Literata`).type, "serif");
      assert.equal(graphicIntentFromBrief(`Literata; invece ${wording}`).type, "system", `last ${wording}`);
      assert.equal(graphicIntentFromBrief(`${wording}; invece Garamond`).type, "serif");
    }
    assert.equal(graphicIntentFromBrief("App profumi: descrivi i caratteri della fragranza").type, "domain");
    assert.equal(graphicIntentFromBrief("Agenda per una tipografia, prenotazioni stampa").type, "domain");
  });

  it("does not stamp semantic chrome from a denied Home/Aggiungi/Persona phrase", () => {
    const denied = graphicIntentFromBrief("Non voglio tab Home Aggiungi Persona");
    assert.equal(denied.chrome, "domain");
    assert.equal(denied.type, "domain");
    const asked = graphicIntentFromBrief("tab Home Aggiungi Persona, non clonare iPhone");
    assert.equal(asked.chrome, "semantic");
    assert.equal(asked.type, "domain");
  });

  it("keeps domain perfume/agenda when Italian iPhone is not asked", () => {
    assert.equal(graphicIntentFromBrief(PERFUME).type, "domain");
    assert.equal(graphicIntentFromBrief(AGENDA).type, "domain");
    assert.equal(graphicIntentFromBrief("Appunti del fornaio, elenco e CRUD.").type, "domain");
  });

  it("enforceGraphicIntent applies system CSS without --body/--display vars", () => {
    const plain = `<!DOCTYPE html><html><head><style>body{font-family:Georgia} h1{font-family:Georgia}</style></head><body><h1>Lista</h1></body></html>`;
    const next = enforceGraphicIntent(plain, "Font system-ui primario");
    assert.match(next, /data-intent-type="system"/);
    assert.match(next, /font-family:ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(next, /font-family:\s*Georgia/);
    assert.match(next, /--body:ui-sans-serif,system-ui,-apple-system/);
    assert.match(next, /--display:ui-sans-serif,system-ui,-apple-system/);
  });

  it("enforceGraphicIntent rewrites font shorthand and qualified typed selectors, not quotes", () => {
    const html = `<!DOCTYPE html><html><head><style>
body{font:16px Georgia}h1{font:32px Georgia}
body.app,h1.title{font-family:Georgia}
p.quote{font-family:Georgia}
</style></head><body class="app"><h1 class="title">Lista</h1><p class="quote">Georgia, 1820</p></body></html>`;
    const next = enforceGraphicIntent(html, "Font system-ui primario");
    assert.match(next, /data-intent-type="system"/);
    assert.match(next, /font:16px ui-sans-serif,system-ui,-apple-system/);
    assert.match(next, /font:32px ui-sans-serif,system-ui,-apple-system/);
    assert.match(next, /body\.app,h1\.title\{font-family:ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(next, /body\{font:16px Georgia/);
    assert.doesNotMatch(next, /h1\{font:32px Georgia/);
    assert.doesNotMatch(next, /body\.app,h1\.title\{font-family:Georgia/);
    assert.match(next, /p\.quote\{font-family:Georgia/);
    assert.match(next, />Georgia, 1820</);
  });

  it("keeps weight/style/size/line-height on font shorthand, does not treat 700 as size", () => {
    const html = `<!DOCTYPE html><html><head><style>
h1.w{font:700 22px/1.2 Georgia}
h1.i{font:italic 600 1.5rem/1.3 Georgia}
h1.s{font:32px Georgia}
h1.q{font:700 22px/1.2 Georgia !important}
h1.title{font:italic 600 1.5rem/1.3 Georgia}
button.cta{font:700 14px/1 Georgia}
p.quote{font-family:Georgia}
</style></head><body class="app"><h1 class="w">Peso</h1><h1 class="i">Corsivo</h1><h1 class="s">Semplice</h1><h1 class="q">Importante</h1><h1 class="title">Qualificato</h1><button class="cta">Ok</button><p class="quote">Georgia, 1820</p></body></html>`;
    const sys = enforceGraphicIntent(html, "Font system-ui primario. Voglio una app stile iPhone.");
    assert.match(sys, /h1\.w\{font:700 22px\/1\.2 ui-sans-serif,system-ui,-apple-system/);
    assert.match(sys, /h1\.i\{font:italic 600 1\.5rem\/1\.3 ui-sans-serif,system-ui,-apple-system/);
    assert.match(sys, /h1\.s\{font:32px ui-sans-serif,system-ui,-apple-system/);
    assert.match(sys, /h1\.q\{font:700 22px\/1\.2 ui-sans-serif,system-ui,-apple-system[^;]* !important/);
    assert.match(sys, /h1\.title\{font:italic 600 1\.5rem\/1\.3 ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(sys, /h1\.w\{font:700 ui-sans-serif/);
    assert.doesNotMatch(sys, /h1\.i\{font:italic 600 ui-sans-serif/);
    assert.match(sys, /button\.cta\{font:700 14px\/1 Georgia/);
    assert.match(sys, /p\.quote\{font-family:Georgia/);
    assert.match(sys, />Georgia, 1820</);
    const ser = enforceGraphicIntent(html, INTENT_SERIF_PROMPT);
    assert.match(ser, /data-intent-type="serif"/);
    assert.match(ser, /h1\.w\{font:700 22px\/1\.2 "Literata"/);
    assert.doesNotMatch(ser, /h1\.w\{font:700 22px\/1\.2 ui-sans-serif/);
    assert.doesNotMatch(ser, /h1\.w\{font:700 "Literata"/);
    assert.match(ser, /button\.cta\{font:700 14px\/1 Georgia/);
    assert.match(ser, /p\.quote\{font-family:Georgia/);
    const src = prepareSrcDoc(sys, { bg: "#efe6d4" }, "intent-shorthand-geom", "app");
    assert.match(src, /font:700 22px\/1\.2 ui-sans-serif,system-ui,-apple-system/);
    assert.doesNotMatch(src, /h1\.w\{font:700 ui-sans-serif/);
  });

  it("keeps size/line-height on four slash spacings including trailing slash+space", () => {
    const html = `<!DOCTYPE html><html><head><style>
h1.a{font:700 22px/1.2 Georgia}
h1.b{font:700 22px/ 1.2 Georgia}
h1.c{font:700 22px /1.2 Georgia}
h1.d{font:700 22px / 1.2 Georgia}
h1.e{font:700 22px/ 1.2 Georgia !important}
p.quote{font-family:Georgia}
</style></head><body><h1 class="a">A</h1><h1 class="b">B</h1><h1 class="c">C</h1><h1 class="d">D</h1><h1 class="e">E</h1><p class="quote">Georgia, 1820</p></body></html>`;
    const sys = enforceGraphicIntent(html, "stile iPhone");
    assert.match(sys, /h1\.a\{font:700 22px\/1\.2 ui-sans-serif/);
    assert.match(sys, /h1\.b\{font:700 22px\/ 1\.2 ui-sans-serif/);
    assert.match(sys, /h1\.c\{font:700 22px \/1\.2 ui-sans-serif/);
    assert.match(sys, /h1\.d\{font:700 22px \/ 1\.2 ui-sans-serif/);
    assert.match(sys, /h1\.e\{font:700 22px\/ 1\.2 ui-sans-serif[^;]* !important/);
    assert.doesNotMatch(sys, /h1\.b\{font:700 22px\/ ui-sans-serif/);
    assert.match(sys, /p\.quote\{font-family:Georgia/);
    const ser = enforceGraphicIntent(html, INTENT_SERIF_PROMPT);
    assert.match(ser, /h1\.b\{font:700 22px\/ 1\.2 "Literata"/);
    assert.doesNotMatch(ser, /h1\.b\{font:700 22px\/ "Literata"/);
  });

  it("keeps original system type when a follow-up only asks for an icon via composeProduct (not a live controller-edit)", () => {
    const follow = `${SYSTEM}\nAggiungi solo l'icona casa.`;
    const intent = graphicIntentFromBrief(follow);
    assert.equal(intent.type, "system");
    assert.equal(intent.chrome, "semantic");
    const html = composeProduct(follow).html;
    assert.match(html, /data-intent-type="system"/);
    assert.match(html, /--body:ui-sans-serif,system-ui,-apple-system/);
    assert.match(html, /<span>Home<\/span>/);
    assert.match(html, /<span>Aggiungi<\/span>/);
  });

  it("does not paint generator metadata or uno/due/tre as user records on SYSTEM", () => {
    const html = composeProduct(SYSTEM).html;
    const visible = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.doesNotMatch(visible, /paper\s*·|glacier|Literata|Karla|anti-clone/);
    assert.doesNotMatch(visible, /Lista in tasca uno|Lista in tasca due|Lista in tasca tre/);
    assert.doesNotMatch(html, /title:"[^"]* uno"/);
    assert.match(html, /items:\[\]/);
    assert.match(html, /home-first/);
    assert.match(html, /Niente in lista/);
    assert.match(html, /<p class="place">Personale<\/p>/);
    assert.match(html, /class="home-first"/);
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] || "";
    const home = html.match(/<section class="home-overview"[\s\S]*?<\/section>/)?.[0] || "";
    assert.doesNotMatch(header, /<p class="kicker">Lista<\/p>/);
    assert.equal((header.match(/<h1 /g) || []).length, 1);
    assert.doesNotMatch(home, /<p class="kicker">Lista<\/p>/);
    assert.match(home, /class="mark"/);
    assert.match(html, /\.home-first \.btn\{min-height:48px;width:100%/);
    const pal = composeProduct(SYSTEM).tokens.palette;
    assert.doesNotMatch(html, /#f5f5f7|#0071e3/);
    assert.ok(contrastRatio(pal.fg, pal.bg) >= 4.5, `fg/bg ${pal.fg} ${pal.bg}`);
    assert.ok(contrastRatio(pal.muted, pal.bg) >= 4.5, `muted/bg ${pal.muted} ${pal.bg}`);
    const italian = composeProduct(`${formatPrefix("app")}${INTENT_IPHONE_IT_PROMPT}. Font system-ui primario, tab Home Aggiungi Persona.`);
    const visIt = italian.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.doesNotMatch(visIt, /anti-clone|glacier|Literata|system-ui uno/);
    assert.match(italian.html, /<span>Home<\/span>/);
    assert.match(italian.html, /<h1 class="brand">Note<\/h1>/);
    assert.doesNotMatch(italian.html.match(/<header[\s\S]*?<\/header>/)?.[0] || "", /Lista/);
    assert.ok(contrastRatio(italian.tokens.palette.fg, italian.tokens.palette.bg) >= 4.5);
    assert.notEqual(composeProduct(SERIF).tokens.fonts.display, "system-ui");
  });

  it("three SYSTEM briefs with palette history stay distinct and not a single petrol", () => {
    const aBrief = SYSTEM;
    const bBrief = `${formatPrefix("app")}${INTENT_IPHONE_IT_PROMPT}. Font system-ui primario, tab Home Aggiungi Persona.`;
    const cBrief = `${formatPrefix("app")}Taccuino di bordo: font di sistema primario, tab Home Aggiungi Persona, elenco e CRUD.`;
    const a = composeProduct(aBrief);
    const rec = (p: typeof a) => ({
      bg: p.tokens.palette.bg,
      surface: p.tokens.palette.surface,
      accent: p.tokens.palette.accent,
    });
    const b = composeProduct(bBrief, { recent: [rec(a)] });
    const c = composeProduct(cBrief, { recent: [rec(a), rec(b)] });
    const sig = (p: typeof a) =>
      `${p.tokens.palette.bg}|${p.tokens.palette.surface}|${p.tokens.palette.accent}`.toLowerCase();
    assert.equal(a.tokens.fonts.display, "system-ui");
    assert.equal(b.tokens.fonts.display, "system-ui");
    assert.equal(c.tokens.fonts.display, "system-ui");
    assert.notEqual(sig(a), sig(b), `a/b collide ${sig(a)}`);
    assert.notEqual(sig(b), sig(c), `b/c collide ${sig(b)}`);
    assert.notEqual(sig(a), sig(c), `a/c collide ${sig(a)}`);
    const accents = [a, b, c].map((p) => p.tokens.palette.accent.toLowerCase());
    assert.ok(new Set(accents).size >= 2, `accents ${accents.join(" ")}`);
    assert.ok(!accents.every((x) => x === "#125e57"), "not a single petrol");
    assert.ok(
      [a, b, c].some((p) => p.tokens.palette.bg.toLowerCase() !== "#eceff3"),
      "not a single #eceff3 sheet",
    );
    const again = composeProduct(aBrief);
    assert.equal(sig(a), sig(again), "same brief must not drift on revision");
    const bAgain = composeProduct(bBrief, { recent: [rec(a)] });
    assert.equal(sig(b), sig(bAgain), "same brief+history must not drift");
    const locked = composeProduct(`${aBrief} Sfondo #0b1f3a, accento #2ec8c0.`);
    assert.equal(locked.tokens.fonts.display, "system-ui");
    assert.equal(locked.tokens.palette.bg.toLowerCase(), "#0b1f3a");
    assert.equal(locked.tokens.palette.accent.toLowerCase(), "#2ec8c0");
    for (const p of [a, b, c]) {
      assert.ok(contrastRatio(p.tokens.palette.fg, p.tokens.palette.bg) >= 4.5);
      assert.doesNotMatch(p.html, /#f5f5f7|#0071e3/);
    }
  });

  it("serif active rail uses accent-ink on accent fill, not accent-on-accent", () => {
    const html = composeProduct(SERIF).html;
    assert.match(html, /nav\.rail button\.on\{background:var\(--accent\);color:var\(--accent-ink\)/);
    assert.doesNotMatch(html, /nav\.rail button\.on\{color:var\(--accent\)\}/);
    assert.match(html, /<span>Copertina<\/span>/);
    assert.match(html, /--body:"Literata"/);
  });
});
