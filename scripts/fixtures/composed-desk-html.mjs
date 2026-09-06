/** Original desktop site used by Mac/PC create fixtures. Not a Fenix magazine seed. */
export function originalSiteHtml(name = "Atelier Luce") {
  const services = Array.from({ length: 8 }, (_, i) => {
    return `<article class="band"><svg viewBox="0 0 24 24"><path d="M4 ${6 + i}h16M6 18h12"/></svg><h3>Servizio ${i + 1}</h3><p>Consulenza in sala, ${18 + (i % 6)}:00, Brera. Materiali e tempi dichiarati prima di iniziare.</p></article>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${name}</title>
<style>
:root{--bg:#16110e;--surface:#241c18;--fg:#f3ebe3;--muted:#b9a89a;--accent:#c45c26;--line:#3b302a}
html,body{margin:0;background:var(--bg);color:var(--fg);font-family:Palatino,ui-serif,Georgia,serif}
body{min-height:100vh}
header,footer{display:flex;justify-content:space-between;align-items:center;padding:24px 64px;border-bottom:1px solid var(--line)}
footer{border-bottom:0;border-top:1px solid var(--line);font-size:14px}
nav{display:flex;gap:28px}
nav a{color:inherit;min-height:44px;display:inline-flex;align-items:center;text-decoration:none}
.hero{padding:72px 64px;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
h1{margin:0;font-size:clamp(2.6rem,6vw,4.8rem);letter-spacing:-.04em;line-height:.95}
.cta{display:inline-flex;align-items:center;min-height:48px;padding:12px 22px;background:var(--accent);color:#16110e;font-weight:700;border:0;border-radius:14px}
section{padding:64px;border-top:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
form{display:grid;gap:12px;max-width:420px}
input,textarea,button.cta{min-height:48px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--fg);font-size:17px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8}
@media(max-width:800px){.hero,.grid{grid-template-columns:1fr}header,footer,.hero,section{padding:24px}}
</style>
</head>
<body>
<header><strong>${name}</strong><nav><a href="#servizi">Servizi</a><a href="#studio">Studio</a><a href="#orari">Orari</a><a href="#contatti">Contatti</a></nav></header>
<main>
<section class="hero" id="inizio"><div><p>Brera · luce calda</p><h1>${name}</h1><p>Tagli su misura, tre poltrone, prenotazione in un tocco. Nessuna conferma automatica.</p><a class="cta" href="#contatti">Chiedi disponibilità</a></div>
<svg viewBox="0 0 240 240" width="240" height="240"><path d="M40 200V40h40l40 80 40-80h40v160h-48V96l-32 64-32-64v104H40z"/></svg></section>
<section id="servizi"><h2>Servizi</h2><div class="grid">${services}</div></section>
<section id="studio"><h2>Studio</h2><p>Via Madonnina 12, Milano. Sala prove con luce nord e materiali dichiarati.</p></section>
<section id="orari"><h2>Orari</h2><p>Martedì–sabato 10:00–19:30. Domenica e lunedì chiusi.</p></section>
<section id="contatti"><h2>Contatti</h2>
<form id="c"><label>Nome<input name="name" required></label><label>Email<input name="email" type="email" required></label><button class="cta" type="submit">Salva richiesta</button><p id="st"></p></form>
</section>
</main>
<footer><span>${name} · Via Madonnina 12</span><a href="#inizio">Su ↑</a></footer>
<script>
(function(){
  var form=document.getElementById("c");
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var name=(form.name.value||"").trim();
    if(!name) return;
    Promise.resolve(window.Fenix.load("requests")).then(function(prev){
      var items=(prev&&prev.items)||[];
      items.push({name:name,email:form.email.value});
      return window.Fenix.save("requests",{items:items});
    }).then(function(){ document.getElementById("st").textContent="Richiesta salvata."; });
  });
})();
</script>
</body>
</html>`;
}

export function graphicSiteHtml(name = "Atelier Luce") {
  return originalSiteHtml(name)
    .replace("letter-spacing:-.04em", "letter-spacing:-.05em")
    .replace("<p>Brera · luce calda</p>", '<p class="kicker">Sala · Brera</p>')
    .replace(
      "background:var(--bg);color:var(--fg)",
      "background:radial-gradient(80% 50% at 100% 0,rgba(196,92,38,.18),transparent),var(--bg);color:var(--fg)",
    );
}

export function createdSiteMetaHtml(name = "Atelier Luce") {
  return `<<<META>>>
{"name":"${name}","tagline":"Sala Brera","kind":"site","summary":"Sito del salone","palette":{"bg":"#16110e","surface":"#241c18","fg":"#f3ebe3","muted":"#b9a89a","accent":"#c45c26"}}
<<<HTML>>>
${originalSiteHtml(name)}
<<<END>>>`;
}

export function createdGraphicSiteMetaHtml(name = "Atelier Luce") {
  return `<<<META>>>
{"name":"${name}","tagline":"Sala Brera","kind":"site","summary":"Sito del salone","palette":{"bg":"#16110e","surface":"#241c18","fg":"#f3ebe3","muted":"#b9a89a","accent":"#c45c26"}}
<<<HTML>>>
${graphicSiteHtml(name)}
<<<END>>>`;
}

export function originalDashboardHtml(name = "Registro Sala") {
  const rows = Array.from({ length: 16 }, (_, i) => `<tr><td>Marta ${i + 1}</td><td>Taglio</td><td>18:${String(10 + (i % 40)).padStart(2, "0")}</td></tr>`).join("");
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<title>${name}</title>
<style>
:root{--bg:#12151a;--surface:#1b2128;--fg:#eef2f6;--muted:#8b98a6;--accent:#3d8a7a;--line:#2c3640}
body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif}
.app{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
aside{padding:24px;border-right:1px solid var(--line);background:var(--surface)}
aside button{display:block;width:100%;min-height:44px;margin:0 0 8px;border:0;background:transparent;color:var(--muted);text-align:left}
aside button.on{color:var(--accent)}
main{padding:32px}
table{width:100%;border-collapse:collapse}
td,th{padding:12px 8px;border-bottom:1px solid var(--line);text-align:left}
form{display:grid;gap:10px;max-width:360px}
input,button.cta{min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
button.cta{background:var(--accent);color:#07110f;font-weight:700;border:0}
:focus-visible{outline:3px solid var(--accent)}
</style>
</head>
<body>
<div class="app">
<aside>
<button data-view="oggi" class="on">Oggi</button>
<button data-view="nuovo">Nuovo</button>
<button data-view="archivio">Archivio</button>
</aside>
<main>
<section data-view="oggi"><h1>${name}</h1><table><thead><tr><th>Cliente</th><th>Servizio</th><th>Ora</th></tr></thead><tbody id="tb">${rows}</tbody></table></section>
<section data-view="nuovo" hidden><form id="f"><label>Nome<input name="nome" required></label><label>Servizio<input name="servizio" value="Taglio"></label><button class="cta" type="submit">Salva</button></form></section>
<section data-view="archivio" hidden><p id="kpi">0 in archivio</p></section>
</main>
</div>
<script>
(function(){
  var data={rows:[]};
  function draw(){ document.getElementById("kpi").textContent=data.rows.length+" in archivio"; }
  document.getElementById("f").addEventListener("submit", function(e){
    e.preventDefault();
    var nome=(e.target.nome.value||"").trim();
    if(!nome) return;
    data.rows.push({nome:nome,servizio:e.target.servizio.value});
    window.Fenix.save("desk", data); draw();
  });
  document.querySelectorAll("aside button").forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll("aside button").forEach(function(b){ b.classList.remove("on"); });
      btn.classList.add("on");
      var view=btn.getAttribute("data-view");
      document.querySelectorAll("main [data-view]").forEach(function(p){ p.hidden = p.getAttribute("data-view")!==view; });
    });
  });
  Promise.resolve(window.Fenix.load("desk")).then(function(s){ if(s&&s.rows) data=s; draw(); });
})();
</script>
</body>
</html>`;
}

export function createdDashMetaHtml(name = "Registro Sala") {
  return `<<<META>>>
{"name":"${name}","tagline":"Gestionale","kind":"dashboard","summary":"Prenotazioni","palette":{"bg":"#12151a","surface":"#1b2128","fg":"#eef2f6","muted":"#8b98a6","accent":"#3d8a7a"}}
<<<HTML>>>
${originalDashboardHtml(name)}
<<<END>>>`;
}
