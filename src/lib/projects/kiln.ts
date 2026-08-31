export const KILN_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>Kiln — fonderia digitale</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230e0d0b'/%3E%3Cpath d='M8 24h16v2H8zM10 24V12l6-6 6 6v12' fill='none' stroke='%23d4782a' stroke-width='2'/%3E%3C/svg%3E"/>
<style>
:root{--bg:#0e0d0b;--surface:#1c1a16;--fg:#e8e0d0;--muted:#8a8274;--accent:#d4782a;--line:#3a342c;--ok:#8fad6e;--hold:#c45c26}
*{box-sizing:border-box;margin:0}
html,body{min-height:100%;background:var(--bg);color:var(--fg);font:400 14px/1.4 "IBM Plex Mono",ui-monospace,monospace;color-scheme:dark}
h1,h2,.mark{font-family:"Barlow Condensed",sans-serif;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--line);background:#12110e}
.mark{display:flex;align-items:center;gap:10px;font-size:1.4rem}
.mark svg{width:28px;height:28px}
.tabs button{height:32px;padding:0 12px;border:1px solid var(--line);background:transparent;color:var(--muted);font:600 12px "IBM Plex Mono",monospace;cursor:pointer}
.tabs button.on{border-color:var(--accent);color:var(--accent)}
main{max-width:1080px;margin:0 auto;padding:20px 18px 64px}
h1{font-size:clamp(2rem,5vw,3rem);margin-bottom:6px}
.sub{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:22px 0}
.kpi{background:var(--surface);border:1px solid var(--line);padding:16px}
.kpi span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.kpi b{display:block;margin-top:8px;font-family:"Barlow Condensed",sans-serif;font-size:2.4rem;color:var(--accent);letter-spacing:.02em}
.list{border:1px solid var(--line)}
.row{display:grid;grid-template-columns:1.6fr .7fr 1fr auto;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--line);font-size:13px}
.row:first-child{border-top:0}
.bar{height:3px;background:#2a261f;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.chip{font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.chip.ok{color:var(--ok)}
.chip.hold{color:var(--hold)}
[hidden]{display:none!important}
@media(max-width:800px){
  .kpis{grid-template-columns:1fr}
  .row{grid-template-columns:1fr 1fr}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<header>
  <div class="mark">
    <svg viewBox="0 0 32 32" fill="none"><path d="M8 24h16v2H8zM10 24V12l6-6 6 6v12" stroke="#d4782a" stroke-width="2"/></svg>
    Kiln
  </div>
  <div class="tabs">
    <button class="on" data-act="view" data-view="board">Forno</button>
    <button data-act="view" data-view="risk">Rischi</button>
  </div>
</header>
<main id="app"></main>
<script>
  const state = { view: "board" };
  const sprints = [
    { name: "Colata notturna", owner: "Lea", bar: 82, risk: "ok" },
    { name: "Stampo EU", owner: "Omar", bar: 54, risk: "hold" },
    { name: "Lingottiera 3", owner: "Nia", bar: 91, risk: "ok" },
    { name: "Scarti crogiolo", owner: "Pia", bar: 28, risk: "hold" },
  ];
  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const el = document.getElementById("app");
    const rows = (state.view === "risk" ? sprints.filter(s => s.risk !== "ok") : sprints)
      .map(s => "<div class='row'><b>"+s.name+"</b><span>"+s.owner+"</span><div class='bar'><i style='width:"+s.bar+"%'></i></div><span class='chip "+s.risk+"'>"+(s.risk==="ok"?"In linea":"Rischio")+"</span></div>")
      .join("");
    el.innerHTML = "<h1>"+(state.view==="risk"?"Rischi colata":"Banco forno")+"</h1><p class='sub'>8 persone · turno B · crogiolo 3</p>" +
      (state.view==="board" ? "<div class='kpis'><div class='kpi'><span>Temp. forno</span><b>1280°</b></div><div class='kpi'><span>Colate / t</span><b>14</b></div><div class='kpi'><span>Rischi aperti</span><b>2</b></div></div>" : "") +
      "<div class='list'>"+rows+"</div>";
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    if (t.dataset.act === "view") state.view = t.dataset.view;
    render();
  });
  render();
</script>
</body>
</html>`;
