import { CRAFT_APP_ICON, craftTabNavHtml } from "../projects/craft-icons.ts";

/** Cornice telefono già piena: Grok riempie testi e mestiere, non inventa lo scheletro. */
export const APP_SHELL_INSTRUCTION = `Questa è già un'app telefono funzionante.
SOSTITUISCI testi, numeri, icone SVG, nomi delle tab e i campi col BRIEF.
Le 5 icone tab devono essere OGGETTI del mestiere (quaderno, pennino, forno, chiave…), silhouette diverse, leggibili a 24px.
VIETATO: casetta Lucide, plus in cerchio, omino, hamburger, barre iPhone, lettera in un quadrato, emoji.
NON cancellare sezioni. NON lasciare main vuoto. NON fare un sito.
Palette unica dal brief (carta e inchiostro del mestiere, mai clone grigio-sistema + blu-sistema). Date in italiano, non ISO.
Tieni header.fk-top, main, nav.fk-tab, form, liste, Fenix.load/save.
Collezioni Fenix.data: solo [A-Za-z0-9._-]{1,80}, mai "capi vesti".
Ogni tab mostra una vista vera. Form: preventDefault, niente righe vuote.
Restituisci META + FILE screens/home.html new list stats more + HTML montato.`;

export const DASHBOARD_POLISH_INSTRUCTION = `SOSTITUISCI lo scheletro telefono (nav.fk-tab, header.fk-top, 5 tab iPhone) con un gestionale desktop.
kind=dashboard. Header in alto o sidebar — MAI tabbar in basso, MAI class fk-tab.
Elenco/tabella con righe, filtri, form nuovo, numeri. Almeno 3 viste data-view.
Lo schema è unico: ogni campo del form corrisponde alle colonne e all'entità del brief; mai campi inventario dentro un gestionale clienti o viceversa.
CSS reale professionale (superfici chiare, gerarchia, tabella responsive, azioni, dialog, form), niente controlli browser nudi e niente palette marrone fangosa.
Tieni window.Fenix.load/save. Date in italiano.
Restituisci META kind=dashboard + HTML completo montato.`;

export const SITE_POLISH_INSTRUCTION = `FORMATO: sito web. kind=site. Rigenera un sito desktop, nav in alto, almeno 4 sezioni, footer.
NON un'app telefono: niente nav.fk-tab, niente bottom-tab, niente template t-home, niente src/screens/*.tsx, niente 5 tab.
Hero 16:9 persistita, testi veri, form con window.Fenix.load/save. Palette dal mestiere.`;


export const APP_SHELL_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>App</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap"/>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%231c1712' d='M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7z'/></svg>"/>
<style>
:root{--bg:#efe6d4;--surface:#f7f1e4;--fg:#1c1712;--muted:#5c5348;--accent:#3d4a1f;--line:#c4b49a}
html,body{height:100%;margin:0}
body{font:400 16px/1.4 "IBM Plex Sans",system-ui,sans-serif;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;min-height:100dvh;overflow:hidden}
</style>
</head>
<body>
<header class="fk-top">
  <div>
    <span class="fk-appicon" data-fenix-id="icon:app" aria-hidden="true">${CRAFT_APP_ICON.replace("<svg", "<svg width='20' height='20'")}</span>
    <div>
    <h1 class="fk-hello">Ciao</h1>
    <p class="fk-role">Operatore</p>
    </div>
  </div>
  <button type="button" class="fk-chip" data-act="share">Condividi</button>
</header>
<p class="fk-date" id="data"></p>
<main class="fk-main" id="main"></main>
<nav class="fk-tab" aria-label="Navigazione">
  ${craftTabNavHtml()}
</nav>
<script>
(function(){
  var S={items:[], limit:100, team:[]};
  function load(){
    var p=window.Fenix&&window.Fenix.load?window.Fenix.load("state"):null;
    Promise.resolve(p).then(function(v){ if(v&&typeof v==="object") S=Object.assign(S,v); show(current); document.documentElement.setAttribute("data-fenix-ready","1"); });
  }
  function save(){ if(window.Fenix&&window.Fenix.save) window.Fenix.save("state", S); }
  var current="home";
  var views={
    home:function(){
      return '<section class="fk-sheet"><p class="fk-kicker">Oggi</p><dl class="fk-ledger"><div><dt>Voci</dt><dd>'+S.items.length+'</dd></div><div><dt>Limite</dt><dd>'+S.limit+'</dd></div><div><dt>Squadra</dt><dd>'+S.team.length+'</dd></div></dl><p class="fk-last">'+(S.items[0]?S.items[0].t+' · '+S.items[0].n:'Nessuna riga. Compila e salva.')+'</p><button type="button" class="fk-btn" data-go="new">Nuova riga</button></section>';
    },
    new:function(){
      return '<label class="fk-lbl">Valore</label><form class="fk-field" id="fnew"><input name="v" placeholder="Es. 100" required/><button class="fk-btn" type="submit">Salva</button></form><div class="fk-chiprow"><button type="button" class="fk-chip" data-chip="50">+50</button><button type="button" class="fk-chip" data-chip="100">+100</button><button type="button" class="fk-chip" data-chip="250">+250</button></div>';
    },
    list:function(){
      if(!S.items.length) return '<p class="fk-role">Nessun elemento. Registrane uno.</p>';
      return S.items.map(function(it,i){return '<div class="fk-tile" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>'+it.t+'</b> <span>'+it.n+'</span> <button type="button" class="fk-chip" data-del="'+i+'">Rimuovi</button></div>';}).join("");
    },
    stats:function(){
      return '<div class="fk-panel"><h3>Numeri</h3><div class="fk-grid2"><div class="fk-stat"><b>'+S.items.length+'</b><span>totale</span></div><div class="fk-stat"><b>'+S.limit+'</b><span>obiettivo</span></div></div></div>';
    },
    more:function(){
      return '<label class="fk-lbl">Nome</label><form id="fteam" class="fk-field"><input name="n" placeholder="Nome e cognome" required/><button class="fk-btn" type="submit">Aggiungi</button></form>'+(S.team.length?S.team.map(function(n,i){return '<div class="fk-tile" style="display:flex;justify-content:space-between;margin-top:8px"><b>'+n+'</b><button type="button" class="fk-chip" data-un="'+i+'">Rimuovi</button></div>';}).join(""):'<p class="fk-role">Nessun operatore.</p>');
    }
  };
  function show(id){
    current=id;
    document.getElementById("main").innerHTML=views[id]();
    document.querySelectorAll(".fk-tab button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-view")===id); });
  }
  document.getElementById("data").textContent=new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
  document.addEventListener("click", function(e){
    var t=e.target.closest("[data-view],[data-go],[data-chip],[data-del],[data-un]");
    if(!t) return;
    if(t.dataset.view||t.dataset.go) show(t.dataset.view||t.dataset.go);
    if(t.dataset.chip){ S.items.unshift({n:+t.dataset.chip,t:new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}); save(); show("list"); }
    if(t.dataset.del){ S.items.splice(+t.dataset.del,1); save(); show("list"); }
    if(t.dataset.un){ S.team.splice(+t.dataset.un,1); save(); show("more"); }
  });
  document.addEventListener("submit", function(e){
    e.preventDefault();
    var f=e.target;
    if(f.id==="fnew"){
      var v=(f.v.value||"").trim(); if(!v) return;
      S.items.unshift({n:v,t:new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})});
      f.reset(); save(); show("list");
    }
    if(f.id==="fteam"){
      var n=(f.n.value||"").trim(); if(!n) return;
      S.team.push(n); f.reset(); save(); show("more");
    }
  });
  show("home");
  load();
})();
</script>
</body>
</html>
`;
