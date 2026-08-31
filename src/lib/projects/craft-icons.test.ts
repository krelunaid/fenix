import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import {
  countAppleTabIcons,
  looksLikeAppleTabIcons,
  looksLikeIosWidgetHome,
  looksLikeSitePhoneChrome,
  replaceAppleTabIcons,
  rewriteIosWidgetHome,
  stripPhoneChromeFromSite,
} from "./craft-icons.ts";
import { recoverPersistedProject } from "./recover.ts";
import { validateProductHtml } from "./validate-html.ts";

const APPLE_NAV = `<nav class="fk-tab" aria-label="Navigazione">
<button data-view="home"><svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20H4z"/></svg><span>Oggi</span></button>
<button data-view="new"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg><span>Nuovo</span></button>
<button data-view="list"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h10"/></svg><span>Elenco</span></button>
<button data-view="stats"><svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg><span>Stat</span></button>
<button data-view="more"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 20c1.5-4 12.5-4 14 0"/></svg><span>Squadra</span></button>
</nav>`;

const APPLE_APP = `<!DOCTYPE html><html><body>
<main>x</main>${APPLE_NAV}
<script>window.Fenix={load:function(){return Promise.resolve({})},save:function(){}}</script>
</body></html>`;

describe("craft icons vs Apple chrome", () => {
  it("detects the iPhone house/plus/person set and rewrites it", () => {
    assert.equal(looksLikeAppleTabIcons(APPLE_APP), true);
    assert.ok(countAppleTabIcons(APPLE_APP) >= 4);
    const next = replaceAppleTabIcons(APPLE_APP);
    assert.equal(looksLikeAppleTabIcons(next), false);
    assert.match(next, /M6 3\.5h11\.5v17H6z/);
    assert.match(next, /Oggi/);
    assert.doesNotMatch(next, /M4 10\.5 12 4l8 6\.5V20H4z/);
  });

  it("keeps APP_SHELL publishable as an app because it no longer ships Apple tabs", () => {
    assert.equal(looksLikeAppleTabIcons(APP_SHELL_HTML), false);
    const report = validateProductHtml(APP_SHELL_HTML, { kind: "app" });
    assert.equal(report.ok, true, report.errors.join(" · "));
  });

  it("rejects leftover Apple tabs on a phone app and recover rewrites them", () => {
    const report = validateProductHtml(APPLE_APP, { kind: "app" });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /pittogrammi del mestiere/i.test(e)));
    const recovered = recoverPersistedProject({
      id: "taccuino",
      status: "ready",
      html: APPLE_APP,
      kind: "app",
      updatedAt: Date.now(),
    });
    assert.equal(looksLikeAppleTabIcons(recovered.html), false);
    assert.match(recovered.html, /M6 3\.5h11\.5v17H6z/);
  });

  it("rewrites the 4-widget iPhone home into a ledger", () => {
    const widget = `<!DOCTYPE html><html><body>
<nav class="fk-tab" aria-label="Navigazione"><button data-view="home">Oggi</button><button data-view="new">Nuovo</button><button data-view="list">Elenco</button></nav>
<script>
var S={items:[],limit:100,team:[]};
var views={
    home:function(){
      return '<div class="fk-panel"><h3>Oggi</h3><div class="fk-grid2"><div class="fk-stat"><b>0</b><span>attivita</span></div><div class="fk-stat"><b>4.5</b><span>ore</span></div><div class="fk-stat"><b>0</b><span>pezzi</span></div><div class="fk-stat"><b>65</b><span>%</span></div></div></div><div class="fk-grid2"><div class="fk-tile"><span>Ultimo</span><b>—</b></div><div class="fk-tile"><span>Stato</span><b>In corso</b></div></div><button type="button" class="fk-btn" data-go="new">Nuova attivita</button>';
    },
    new:function(){ return 'x'; }
};
</script>
</body></html>`;
    assert.equal(looksLikeIosWidgetHome(widget), true);
    const next = rewriteIosWidgetHome(widget);
    assert.equal(looksLikeIosWidgetHome(next), false);
    assert.match(next, /fk-ledger/);
    assert.doesNotMatch(next, /<span>Ultimo<\/span>/);
    const recovered = recoverPersistedProject({
      id: "taccuino-home",
      status: "ready",
      html: widget,
      kind: "app",
      updatedAt: Date.now(),
    });
    assert.match(recovered.html, /fk-ledger/);
    assert.equal(looksLikeIosWidgetHome(recovered.html), false);
  });

  it("strips bottom-tab phone chrome from a site/landing without touching the form", () => {
    const site = `<!DOCTYPE html><html lang="it"><head><style>
html, body { height: 100dvh; margin: 0; display: flex; flex-direction: column; font-family: Georgia, serif; }
main { flex: 1; overflow: auto; padding: 1rem; }
.bottom-tab { display: flex; background: #111; }
</style></head><body>
<header><span class="fk-appicon" aria-hidden="true"><svg></svg></span>
<nav><a href="#bottega">La Bottega</a></nav></header>
<main>
<section id="home"><h1>Bottega Terra</h1></section>
<section id="bottega"><h2>La Bottega</h2></section>
<section id="lavori"><h2>I Lavori</h2></section>
<section id="visita"><h2>Visita</h2>
<form id="contact-form"><input id="name"><button type="submit">Invia</button></form>
</section>
<script>window.Fenix={load:function(){return Promise.resolve([])},save:function(){return Promise.resolve()}}</script>
</main>
<nav class="bottom-tab">
<button data-section="home"><span>Home</span></button>
<button data-section="bottega"><span>Bottega</span></button>
</nav>
</body></html>`;
    assert.equal(looksLikeSitePhoneChrome(site), true);
    const next = stripPhoneChromeFromSite(site);
    assert.doesNotMatch(next, /bottom-tab/);
    assert.doesNotMatch(next, /fk-appicon/);
    assert.doesNotMatch(next, /100dvh/);
    assert.match(next, /contact-form/);
    assert.match(next, /Bottega Terra/);
    const recovered = recoverPersistedProject({
      id: "8b04fd98-106c-46f5-ac9a-1e929028c476",
      status: "ready",
      html: site,
      kind: "site",
      requestedKind: "site",
      prompt: "FORMATO: sito web. kind=site. Bottega Terra",
      updatedAt: Date.now(),
    });
    assert.doesNotMatch(recovered.html, /bottom-tab/);
    assert.doesNotMatch(recovered.html, /fk-appicon/);
    assert.equal(recovered.status, "ready");
  });
});
