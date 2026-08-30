/** Cornice iOS già piena: Grok riempie, non inventa lo scheletro. */
export const APP_SHELL_INSTRUCTION = `Questa è già un'app telefono funzionante.
SOSTITUISCI testi, numeri, icone SVG, nomi delle tab e i campi col BRIEF.
NON cancellare sezioni. NON lasciare main vuoto. NON fare un sito.
NON scrivere Apple, iOS, Fenix, Grok nel prodotto (titoli, ruoli, tagline).
Tieni header.fk-top, main, nav.fk-tab, form, liste, Fenix.load/save.
Ogni tab mostra una vista vera. Form: preventDefault, niente righe vuote.
Restituisci META + HTML completo (e FILE screens se puoi).`;

export const APP_SHELL_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>App</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%231d1d1f' d='M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7z'/></svg>"/>
<style>
:root{--bg:#f5f5f7;--surface:#fff;--fg:#1d1d1f;--muted:#86868b;--accent:#0071e3;--line:#d2d2d7}
html,body{height:100%;margin:0}
body{font:400 16px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;min-height:100dvh;overflow:hidden}
</style>
</head>
<body>
<header class="fk-top">
  <div>
    <h1 class="fk-hello">Ciao</h1>
    <p class="fk-role">Operatore</p>
  </div>
  <button type="button" class="fk-chip" data-act="share">Condividi</button>
</header>
<p class="fk-date" id="data"></p>
<main class="fk-main" id="main"></main>
<nav class="fk-tab" aria-label="Navigazione">
  <button type="button" data-view="home" class="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10.5 12 4l8 6.5V20H4z"/></svg><span>Home</span></button>
  <button type="button" data-view="new"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg><span>Nuovo</span></button>
  <button type="button" data-view="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h10"/></svg><span>Elenco</span></button>
  <button type="button" data-view="stats"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg><span>Numeri</span></button>
  <button type="button" data-view="more"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="7" r="3"/><path d="M5 20c1.5-4 12.5-4 14 0"/></svg><span>Altro</span></button>
</nav>
<script>
(function(){
  var S={items:[], limit:100, team:[]};
  function load(){
    var p=window.Fenix&&window.Fenix.load?window.Fenix.load("state"):null;
    Promise.resolve(p).then(function(v){ if(v&&typeof v==="object") S=Object.assign(S,v); show(current); });
  }
  function save(){ if(window.Fenix&&window.Fenix.save) window.Fenix.save("state", S); }
  var current="home";
  var views={
    home:function(){
      return '<div class="fk-panel"><h3>Oggi</h3><div class="fk-grid2"><div class="fk-stat"><b>'+S.items.length+'</b><span>registri</span></div><div class="fk-stat"><b>'+S.limit+'</b><span>limite</span></div><div class="fk-stat"><b>'+S.team.length+'</b><span>squadra</span></div><div class="fk-stat"><b>0</b><span>avanzamento</span></div></div></div><div class="fk-grid2"><div class="fk-tile"><span>Ultimo</span><b>'+(S.items[0]?S.items[0].t:"—")+'</b></div><div class="fk-tile"><span>Stato</span><b>Pronto</b></div></div><button type="button" class="fk-btn" data-go="new">Registra</button>';
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
