/** Original phone app used by create-protocol fixtures. Not a Fenix compose seed. */
export function originalCreateHtml(name = "Atelier Nova") {
  const rows = Array.from({ length: 28 }, (_, i) => {
    return `<li data-row="${i}"><svg viewBox="0 0 24 24"><path d="M5 ${6 + (i % 8)}h14"/></svg> Prenotazione ${i + 1} · taglio · 18:${String(10 + (i % 40)).padStart(2, "0")}</li>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${name}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 12h16'/></svg>"/>
<style>
:root{--bg:#1b1410;--surface:#2a211c;--fg:#f4ece4;--muted:#b9a89a;--accent:#c45c26;--line:#3a302a}
html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font-family:ui-serif,Georgia,serif}
.app{display:flex;flex-direction:column;height:100dvh}
header{padding:20px 18px 12px}
h1{margin:0;font-size:28px;letter-spacing:-.03em}
main{flex:1;overflow:auto;padding:12px 18px 28px}
nav{display:flex;height:64px;border-top:1px solid var(--line);background:var(--surface)}
nav button{flex:1;background:none;border:0;color:var(--muted)}
nav button.on{color:var(--accent)}
.card{background:var(--surface);border-radius:18px;padding:16px;margin:0 0 12px}
form{display:grid;gap:10px}
input,button.cta{min-height:48px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:17px}
button.cta{background:var(--accent);color:#1b1410;font-weight:700;border:0}
input.field,button.cta,:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8}
ul{margin:0;padding:0;list-style:none}
li{display:flex;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)}
@media(prefers-reduced-motion:reduce){*{transition:none}}
</style>
</head>
<body>
<div class="app">
<header><h1>${name}</h1><p>Sala prove · tagli su misura in centro</p></header>
<main>
<section data-view="sala" class="card">
<h2>Oggi in sala</h2>
<p>Tre prenotazioni aperte. Prossima: 18:20 Marta in poltrona 2.</p>
<button class="cta" type="button" data-go="prenota">Prenota adesso</button>
<ul>${rows}</ul>
</section>
<section data-view="prenota" hidden>
<form id="f">
<label>Nome<input class="field" name="nome" required></label>
<label>Servizio<input class="field" name="servizio" value="Taglio"></label>
<button class="cta" type="submit">Salva</button>
</form>
</section>
<section data-view="agenda" hidden><ul id="list"></ul></section>
<section data-view="incassi" hidden><p id="kpi">0 in agenda</p></section>
<section data-view="team" hidden><p>Team di sala. Niente pannello staff pubblico.</p></section>
</main>
<nav id="tabs">
<button data-view="sala" class="on"><svg viewBox="0 0 24 24"><path d="M4 10h16v10H4z"/></svg>Sala</button>
<button data-view="prenota"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Prenota</button>
<button data-view="agenda"><svg viewBox="0 0 24 24"><path d="M6 7h12M6 12h12M6 17h8"/></svg>Agenda</button>
<button data-view="incassi"><svg viewBox="0 0 24 24"><path d="M5 19V9h4v10H5zm6 0V5h4v14h-4zm6 0v-6h4v6h-4z"/></svg>Incassi</button>
<button data-view="team"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 19c1.5-3 4-5 7-5s5.5 2 7 5"/></svg>Team</button>
</nav>
</div>
<script>
(function(){
  var KEY="state";
  var data={rows:[]};
  function persist(){ window.Fenix.save(KEY, data); }
  function draw(){
    var list=document.getElementById("list");
    list.replaceChildren();
    data.rows.forEach(function(r,i){
      var row=document.createElement("li");
      var label=document.createElement("span"); label.textContent=r.nome+" · "+r.servizio;
      var remove=document.createElement("button"); remove.textContent="Elimina";
      remove.onclick=function(){data.rows.splice(i,1);persist();draw();};
      row.append(label,remove);list.append(row);
    });
    if(!data.rows.length) list.textContent="Nessuna prenotazione";
    document.getElementById("kpi").textContent=data.rows.length+" in agenda";
  }
  document.getElementById("f").addEventListener("submit", function(e){
    e.preventDefault();
    var nome=(e.target.nome.value||"").replace(/\\s+/g," ").trim();
    if(!nome) return;
    data.rows.push({nome:nome, servizio:(e.target.servizio.value||"").trim()});
    persist(); draw();
  });
  document.querySelectorAll("nav button").forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll("nav button").forEach(function(b){ b.classList.remove("on"); });
      btn.classList.add("on");
      var view=btn.getAttribute("data-view");
      document.querySelectorAll("main [data-view]").forEach(function(p){ p.hidden = p.getAttribute("data-view")!==view; });
    });
  });
  Promise.resolve(window.Fenix.load(KEY)).then(function(s){ if(s&&s.rows) data=s; draw(); });
})();
</script>
</body>
</html>`;
}

export function createdMetaHtml(name = "Atelier Nova") {
  const html = originalCreateHtml(name);
  return `<<<META>>>
{"name":"${name}","tagline":"Sala prove","kind":"app","summary":"Prenotazioni di sala","palette":{"bg":"#1b1410","surface":"#2a211c","fg":"#f4ece4","muted":"#b9a89a","accent":"#c45c26"}}
<<<HTML>>>
${html}
<<<END>>>`;
}
