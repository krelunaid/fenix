import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import {
  countAppleTabIcons,
  craftNavIcon,
  ensureMainElementId,
  hasRequestedWorkingHome,
  isAppleChromeSvg,
  isLetterAIcon,
  looksLikeAppleTabIcons,
  looksLikeIosWidgetHome,
  looksLikeSitePhoneChrome,
  applyChromeGuards,
  replaceAppleTabIcons,
  rewriteIosWidgetHome,
  stripPhoneChromeFromSite,
} from "./craft-icons.ts";
import { recoverPersistedProject } from "./recover.ts";
import { canPublishHtml, validateProductHtml } from "./validate-html.ts";

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
  it("maps appointment roles by visible label, independently of legacy ids and order", () => {
    const labels = ["Agenda", "Prenota", "Prenotazioni", "Statistiche", "Team", "Messaggi", "Impostazioni"];
    const svgs = labels.map(label => craftNavIcon({ id: "new", label }, 0));
    assert.equal(new Set(svgs).size, labels.length, "each function needs its own recognizable glyph");
    labels.forEach((label, i) => {
      assert.equal(svgs[i], craftNavIcon({ id: "stats", label }, 3), "visible function must outrank positional fallback/id");
      assert.match(svgs[i]!, /aria-hidden="true"/);
    });
    assert.notEqual(svgs[1], craftNavIcon({ id: "prenota", label: "Check-in" }));
    assert.equal(svgs[3], craftNavIcon({ id: "kpi", label: "KPI" }));
    assert.equal(svgs[4], craftNavIcon({ id: "clienti", label: "Clienti" }));
  });

  it("repairs icon semantics without changing labels, actions, order or unrelated SVG", () => {
    const source = APPLE_APP.replace("<main>x</main>", '<main><svg id="chart"><path d="M1 1h2"/></svg></main>');
    const next = replaceAppleTabIcons(source);
    for (const [id, label] of [["home", "Oggi"], ["new", "Nuovo"], ["list", "Elenco"], ["stats", "Stat"], ["more", "Squadra"]]) {
      assert.ok(next.includes(`<button data-view="${id}">${craftNavIcon({ id: id!, label: label! })}<span>${label}</span></button>`));
    }
    assert.match(next, /<svg id="chart"><path d="M1 1h2"\/><\/svg>/);
    assert.equal(replaceAppleTabIcons(next), next, "repair must be idempotent");
    const unlabeled = APPLE_APP.replace(/<span>[^<]*<\/span>/g, "").replace(/ data-view="[^"]*"/g, "");
    assert.equal(replaceAppleTabIcons(unlabeled), unlabeled, "do not invent semantics for unlabeled icons");
  });

  it("detects the iPhone house/plus/person set and rewrites it", () => {
    assert.equal(looksLikeAppleTabIcons(APPLE_APP), true);
    assert.ok(countAppleTabIcons(APPLE_APP) >= 4);
    const next = replaceAppleTabIcons(APPLE_APP);
    assert.equal(looksLikeAppleTabIcons(next), false);
    assert.ok(next.includes(craftNavIcon({ id: "home", label: "Oggi" })), "Oggi must receive a calendar, not a positional notebook");
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
    assert.ok(recovered.html.includes(craftNavIcon({ id: "home", label: "Oggi" })));
  });

  it("rewrites the 4-widget iPhone home into a first-run product sheet", () => {
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
    assert.doesNotMatch(next, /fk-ledger/);
    assert.match(next, /Niente in lista|in lista/);
    assert.doesNotMatch(next, /<span>Ultimo<\/span>/);
    const recovered = recoverPersistedProject({
      id: "taccuino-home",
      status: "ready",
      html: widget,
      kind: "app",
      updatedAt: Date.now(),
    });
    assert.doesNotMatch(recovered.html, /fk-ledger/);
    assert.match(recovered.html, /Niente in lista|in lista/);
    assert.equal(looksLikeIosWidgetHome(recovered.html), false);
  });

  it("strips bottom-tab phone chrome from a site/landing without touching the form", () => {
    const site = `<!DOCTYPE html><html lang="it"><head><style>
:root{--bg:#1a1410;--fg:#f4efe8}
html, body { height: 100dvh; margin: 0; display: flex; flex-direction: column; font-family: Georgia, serif; background:var(--bg); color:var(--fg); }
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

  it("does not eat JS that queries .bottom-tab button", () => {
    const site = `<!DOCTYPE html><html><head><style>
:root{--bg:#1a1410;--fg:#f4efe8}
html, body { height: 100dvh; margin: 0; display: flex; flex-direction: column; background:var(--bg); color:var(--fg); }
.bottom-tab { display: flex; }
</style></head><body>
<header><nav><a href="#bottega">Bottega</a></nav></header>
<main>
<section id="home"><h1>A</h1></section>
<section id="bottega"><h2>B</h2></section>
<section id="lavori"><h2>C</h2></section>
<section id="visita"><h2>D</h2></section>
</main>
<nav class="bottom-tab"><button data-section="home">Home</button></nav>
<script>
window.Fenix={load:function(){return Promise.resolve([])},save:function(){return Promise.resolve()}};
document.querySelectorAll('.bottom-tab button').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = document.getElementById(btn.dataset.section);
    if (section) section.scrollIntoView();
  });
});
</script>
</body></html>`;
    const next = stripPhoneChromeFromSite(site);
    assert.doesNotMatch(next, /<nav class="bottom-tab"/);
    assert.match(next, /querySelectorAll\('\.bottom-tab button'\)/);
    assert.match(next, /scrollIntoView/);
    const recovered = recoverPersistedProject({
      id: "site-js",
      status: "ready",
      html: site,
      kind: "site",
      requestedKind: "site",
      prompt: "FORMATO: sito web. kind=site.",
      updatedAt: Date.now(),
    });
    assert.equal(recovered.status, "ready");
    assert.doesNotMatch(recovered.html, /<nav class="bottom-tab"/);
  });

  it("keeps the only nav when a site polish result is a 5-tab shell", () => {
    const phone = `<!DOCTYPE html><html><head><style>
html, body { margin: 0; }
</style></head><body>
<header class="fk-top"><span class="fk-appicon" aria-hidden="true"><svg></svg></span><h1>Bottega Terra</h1></header>
<main class="fk-main"><section data-view="home"><h1>Home</h1></section></main>
<nav class="fk-tab" aria-label="Navigazione">
<button data-view="home">Home</button>
<button data-view="list">Elenco</button>
<button data-view="more">Altro</button>
</nav>
<script>
window.Fenix={load:function(){return Promise.resolve({})},save:function(){return Promise.resolve()}};
document.getElementById('main').innerHTML = 'x';
</script>
</body></html>`;
    assert.equal(looksLikeSitePhoneChrome(phone), true);
    const next = stripPhoneChromeFromSite(phone);
    assert.match(next, /<nav class="fk-tab"/);
    assert.doesNotMatch(next, /fk-appicon/);
    assert.match(next, /<main id="main"/);
    assert.equal(ensureMainElementId(phone).includes('<main id="main"'), true);
    assert.equal(canPublishHtml(next, "site", "bottega-phone"), true, validateProductHtml(next, { kind: "site" }).errors.join(" · "));
  });

  it("draws craft nav icons with a 24 box, round joins, and no letter-A compass", () => {
    const piramide = craftNavIcon({ id: "piramide", label: "Piramide" }, 1);
    assert.equal(isLetterAIcon(piramide), false);
    assert.doesNotMatch(piramide, /M5 19l7-14 7 14/);
    assert.match(piramide, /viewBox="0 0 24 24"/);
    assert.match(piramide, /width="24"/);
    assert.match(piramide, /stroke-linejoin="round"/);
    assert.match(piramide, /data-craft-nav="1"/);
    assert.match(piramide, /data-icon-grid="24"/);
    assert.match(piramide, /overflow="visible"/);
    assert.match(piramide, /stroke-width="1\.9"/);
    const agenda = ["Oggi", "Nuovo", "Settimana", "Archivio"].map((label, i) =>
      craftNavIcon({ id: label.toLowerCase(), label }, i),
    );
    assert.equal(new Set(agenda).size, 4, "agenda tabs must be four distinct glyphs");
    for (const svg of agenda) {
      assert.match(svg, /viewBox="0 0 24 24"/);
      assert.match(svg, /width="24"/);
      assert.match(svg, /height="24"/);
      assert.equal(isAppleChromeSvg(svg), false);
    }
    const tabs = [
      { id: "collezione", label: "Collezione" },
      { id: "piramide", label: "Piramide" },
      { id: "atelier", label: "Atelier" },
      { id: "pelle", label: "Pelle" },
      { id: "pipeline", label: "Pipeline" },
      { id: "nuovo", label: "Nuova riga" },
      { id: "reception", label: "Lobby" },
      { id: "prenota", label: "Check-in" },
    ];
    const drawn = tabs.map((t, i) => craftNavIcon(t, i));
    assert.equal(new Set(drawn).size, drawn.length);
    const kitchen = [
      { id: "passo", label: "Passo" },
      { id: "comanda", label: "Comanda" },
      { id: "menu", label: "Menu" },
      { id: "sala", label: "Sala" },
    ].map((t, i) => craftNavIcon(t, i));
    assert.equal(new Set(kitchen).size, 4, "kitchen tabs must be four distinct glyphs");
    assert.match(kitchen[0]!, /M7\.2 7\.4h9\.6/);
    assert.match(kitchen[0]!, /M7\.2 10\.2H4\.6/);
    assert.match(kitchen[0]!, /M16\.8 10\.2h2\.6/);
    assert.doesNotMatch(kitchen[0]!, /M6\.6 10\.4h10\.8/);
    for (const svg of drawn) {
      assert.equal(isLetterAIcon(svg), false);
      assert.equal(isAppleChromeSvg(svg), false);
    }
  });

  it("keeps original Home/Aggiungi/Persona glyphs distinct from the dumped Apple set", () => {
    const home = craftNavIcon({ id: "home", label: "Home" });
    const add = craftNavIcon({ id: "nuovo", label: "Aggiungi" });
    const person = craftNavIcon({ id: "persona", label: "Persona" });
    const tavolo = craftNavIcon({ id: "home", label: "Tavolo" });
    assert.equal(isAppleChromeSvg(home), false);
    assert.equal(isAppleChromeSvg(add), false);
    assert.equal(isAppleChromeSvg(person), false);
    assert.match(home, /M5 10\.8 12 5\.2 19 10\.8V19\.2H5z/);
    assert.doesNotMatch(home, /M4 10\.5 12 4l8 6\.5V20H4z/);
    assert.match(add, /M12 7\.2v9\.6M7\.2 12h9\.6/);
    assert.match(person, /cy="8\.2" r="2\.4"/);
    assert.doesNotMatch(tavolo, /M5 10\.8 12 5\.2/);
    const elenco = craftNavIcon({ id: "elenco", label: "Elenco" }, 2);
    assert.match(elenco, /M9\.6 8\.6h4\.8M9\.6 12h4\.8/);
    assert.notEqual(elenco, craftNavIcon({ id: "home", label: "Home" }));
    assert.notEqual(elenco, person);
  });

  it("gives accountant and shop functions original glyphs, not Barber shears or a generic notebook", () => {
    const fiscal = ["Fatture", "Clienti", "Bilancio", "Pratiche"].map((label) =>
      craftNavIcon({ id: "new", label }),
    );
    assert.equal(new Set(fiscal).size, 4, "fiscal tabs must be four distinct glyphs");
    assert.match(fiscal[0]!, /M8\.8 8\.6h6\.4/);
    assert.match(fiscal[2]!, /M12 5\.4v12\.8/);
    assert.match(fiscal[3]!, /M5\.4 8\.4h4l1\.5/);
    const shop = ["Negozio", "Cassa", "Clienti", "Magazzino"].map((label) =>
      craftNavIcon({ id: "list", label }),
    );
    assert.equal(new Set(shop).size, 4, "shop tabs must be four distinct glyphs");
    assert.match(shop[0]!, /M4\.8 10 6\.6 6\.2h10\.8/);
    assert.match(shop[3]!, /M5\.4 9 12 5\.6/);
    const shears = craftNavIcon({ id: "app", label: "Taglio" });
    assert.notEqual(fiscal[0], shears);
    assert.notEqual(shop[0], shears);
    assert.notEqual(fiscal[0], craftNavIcon({ id: "elenco", label: "Elenco" }));
    for (const svg of [...fiscal, ...shop]) {
      assert.equal(isLetterAIcon(svg), false);
      assert.equal(isAppleChromeSvg(svg), false);
      assert.match(svg, /data-icon-grid="24"/);
    }
  });

  it("keeps a requested working home under semantic chrome even if leftover widget markup exists", () => {
    const useful = `<!DOCTYPE html><html lang="it" data-intent-chrome="semantic"><body>
<nav class="fk-tab"><button data-view="home">Home</button></nav>
<script>
var S={items:[{t:"Pane",n:"forno"}]};
var views={
    home:function(){
      return '<section class="fk-sheet"><h2>'+S.items.length+' in lista</h2><article class="card" data-id="1"><h2>'+S.items[0].t+'</h2></article><button data-act="save">Salva</button></section>';
    },
    new:function(){ return 'x'; }
};
</script>
<div class="fk-grid2 leftover"><div class="fk-stat"><b>0</b></div><div class="fk-stat"><b>1</b></div><div class="fk-stat"><b>2</b></div><div class="fk-stat"><b>3</b></div></div>
<div class="fk-tile"><span>Ultimo</span></div><div class="fk-tile"><span>Stato</span></div>
</body></html>`;
    assert.equal(looksLikeIosWidgetHome(useful), true);
    assert.equal(hasRequestedWorkingHome(useful), true);
    const kept = applyChromeGuards(useful);
    assert.match(kept, /S\.items\[0\]\.t/);
    assert.match(kept, /in lista/);
    assert.doesNotMatch(kept, /Niente in lista/);
    assert.doesNotMatch(kept, /Compila e salva la prima riga/);
  });

  it("still rewrites a dumped 4-tile iPhone home (security gate) even when semantic is stamped", () => {
    const widget = `<!DOCTYPE html><html lang="it" data-intent-chrome="semantic"><body>
<nav class="fk-tab"><button data-view="home">Oggi</button></nav>
<script>
var S={items:[],limit:100,team:[]};
var views={
    home:function(){
      return '<div class="fk-panel"><h3>Oggi</h3><div class="fk-grid2"><div class="fk-stat"><b>0</b><span>attivita</span></div><div class="fk-stat"><b>4.5</b><span>ore</span></div><div class="fk-stat"><b>0</b><span>pezzi</span></div><div class="fk-stat"><b>65</b><span>%</span></div></div></div><div class="fk-grid2"><div class="fk-tile"><span>Ultimo</span><b>—</b></div><div class="fk-tile"><span>Stato</span><b>In corso</b></div></div>';
    },
    new:function(){ return 'x'; }
};
</script>
</body></html>`;
    assert.equal(looksLikeIosWidgetHome(widget), true);
    assert.equal(hasRequestedWorkingHome(widget), false);
    const next = applyChromeGuards(widget);
    assert.equal(looksLikeIosWidgetHome(next), false);
    assert.match(next, /Niente in lista|in lista/);
    assert.doesNotMatch(next, /<span>Ultimo<\/span>/);
  });
});
