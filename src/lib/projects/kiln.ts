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
header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--line);background:#12110e;gap:12px;flex-wrap:wrap}
.mark{display:flex;align-items:center;gap:10px;font-size:1.4rem}
.mark svg{width:28px;height:28px}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tabs button{height:32px;padding:0 12px;border:1px solid var(--line);background:transparent;color:var(--muted);font:600 12px "IBM Plex Mono",monospace;cursor:pointer}
.tabs button.on{border-color:var(--accent);color:var(--accent)}
main{max-width:1120px;margin:0 auto;padding:20px 18px 72px}
h1{font-size:clamp(2rem,5vw,3rem);margin-bottom:6px}
.sub{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:18px 0}
.kpi{background:var(--surface);border:1px solid var(--line);padding:12px 14px}
.kpi span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.kpi b{display:block;margin-top:6px;font-family:"Barlow Condensed",sans-serif;font-size:1.9rem;color:var(--accent);letter-spacing:.02em;line-height:1}
.grid2{display:grid;grid-template-columns:1.4fr .8fr;gap:12px}
.panel{background:var(--surface);border:1px solid var(--line);padding:14px 16px;margin-bottom:12px}
.list{border:1px solid var(--line)}
.row{display:grid;grid-template-columns:1.5fr .6fr .8fr .7fr auto;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--line);font-size:13px}
.row:first-child{border-top:0}
.bar{height:4px;background:#2a261f;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.chip{font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.chip.ok{color:var(--ok)}
.chip.hold{color:var(--hold)}
.spark{width:100%;height:88px;display:block;background:#12110e;border:1px solid var(--line)}
.log{font-size:12px;color:var(--muted)}
.log li{display:grid;grid-template-columns:64px 1fr;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
.cta{height:36px;padding:0 12px;border:1px solid var(--accent);background:transparent;color:var(--accent);font:600 11px "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
input,textarea{width:100%;border:1px solid var(--line);background:#12110e;color:var(--fg);padding:8px 10px;font:inherit}
label{display:block;font-size:10px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin:8px 0 4px}
.crew{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.crew div{border:1px solid var(--line);padding:12px}
.crew b{display:block;font-family:"Barlow Condensed",sans-serif;font-size:1.2rem}
[hidden]{display:none!important}
@media(max-width:900px){
  .kpis,.crew{grid-template-columns:1fr 1fr}
  .grid2,.row{grid-template-columns:1fr 1fr}
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
    <button type="button" class="on" data-view="board">Forno</button>
    <button type="button" data-view="risk">Rischi</button>
    <button type="button" data-view="turno">Turno B</button>
  </div>
</header>
<main id="app"></main>
<script>
  const defaultState = {
    view: "board",
    acks: [],
    notes: [
      { t: "06:12", n: "Lea", m: "Crogiolo 3 in linea, 1284°." },
      { t: "06:40", n: "Omar", m: "Stampo EU in hold: cassaforma calda." },
    ],
  };
  let state = Object.assign({}, defaultState);
  const sprints = [
    { name: "Colata notturna", owner: "Lea", bar: 82, risk: "ok", heat: 1284, alloy: "EN-GJL-250", kg: 1840 },
    { name: "Stampo EU", owner: "Omar", bar: 54, risk: "hold", heat: 1190, alloy: "EN-GJS-400", kg: 960 },
    { name: "Lingottiera 3", owner: "Nia", bar: 91, risk: "ok", heat: 1310, alloy: "C45", kg: 2200 },
    { name: "Scarti crogiolo", owner: "Pia", bar: 28, risk: "hold", heat: 980, alloy: "recupero", kg: 310 },
    { name: "Piastra ponte", owner: "Lea", bar: 67, risk: "ok", heat: 1260, alloy: "S355", kg: 1540 },
    { name: "Anima 12", owner: "Nia", bar: 44, risk: "hold", heat: 1104, alloy: "CuSn12", kg: 420 },
  ];
  const spark = [1180,1210,1240,1268,1284,1272,1288,1294,1280,1286,1291,1284];
  const crew = [
    { n: "Lea V.", r: "Forno", s: "in linea" },
    { n: "Omar K.", r: "Stampi", s: "hold" },
    { n: "Nia R.", r: "Lingotti", s: "in linea" },
    { n: "Pia M.", r: "Scarti", s: "hold" },
    { n: "Enzo B.", r: "Crogiolo", s: "in linea" },
    { n: "Marta F.", r: "Qualità", s: "in linea" },
    { n: "Ugo T.", r: "Carroponte", s: "in linea" },
    { n: "Sara D.", r: "Log", s: "banco" },
  ];
  function save(){ if (window.Fenix) void window.Fenix.save("state", { acks: state.acks, notes: state.notes, view: state.view }); }
  function sparkPath(){
    const w=640,h=88,max=1320,min=1160;
    return spark.map((v,i)=>{
      const x=(i/(spark.length-1))*w;
      const y=h-8-((v-min)/(max-min))*(h-16);
      return (i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1);
    }).join(" ");
  }
  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const el = document.getElementById("app");
    const holds = sprints.filter(s => s.risk !== "ok");
    const kg = sprints.reduce((n,s)=>n+s.kg,0);
    if (state.view === "board") {
      el.innerHTML = "<h1>Banco forno</h1><p class='sub'>8 persone · turno B · crogiolo 3 · 06:00–14:00</p>" +
        "<div class='kpis'>" +
        "<div class='kpi'><span>Temp. forno</span><b>1284°</b></div>" +
        "<div class='kpi'><span>Colate / t</span><b>14</b></div>" +
        "<div class='kpi'><span>Rischi aperti</span><b>"+holds.length+"</b></div>" +
        "<div class='kpi'><span>Scarti</span><b>4.2%</b></div>" +
        "<div class='kpi'><span>Metallo t</span><b>"+(kg/1000).toFixed(1)+"</b></div>" +
        "<div class='kpi'><span>Pressione</span><b>1.8b</b></div></div>" +
        "<div class='grid2'><div class='panel'><h2>Temperatura crogiolo 3</h2>" +
        "<svg class='spark' viewBox='0 0 640 88' preserveAspectRatio='none'><path d='"+sparkPath()+"' fill='none' stroke='#d4782a' stroke-width='3'/></svg>" +
        "<p class='sub' style='margin-top:8px'>Ultima ora · 1160–1320°</p></div>" +
        "<div class='panel'><h2>Allarmi</h2><ul class='log'>" +
        holds.map(s=>"<li><span>"+s.heat+"°</span><span>"+s.name+" · "+s.owner+" · "+s.alloy+"</span></li>").join("") +
        "</ul></div></div>" +
        "<div class='list'>" + sprints.map(s =>
          "<div class='row'><b>"+s.name+"</b><span>"+s.owner+"</span><span>"+s.alloy+"</span><div class='bar'><i style='width:"+s.bar+"%'></i></div><span class='chip "+s.risk+"'>"+(s.risk==="ok"?"In linea":"Rischio")+"</span></div>"
        ).join("") + "</div>";
      return;
    }
    if (state.view === "risk") {
      el.innerHTML = "<h1>Rischi colata</h1><p class='sub'>Hold aperti · ack resta in Fenix</p>" +
        holds.map(s => {
          const ack = state.acks.indexOf(s.name) >= 0;
          return "<div class='panel'><div class='row' style='grid-template-columns:1fr auto;border:0;padding:0'><b>"+s.name+"</b><span class='chip hold'>"+(ack?"preso":"aperto")+"</span></div>" +
            "<p class='log' style='margin-top:8px'>"+s.owner+" · "+s.alloy+" · "+s.heat+"° · "+s.kg+" kg · avanzamento "+s.bar+"%</p>" +
            "<p class='log'>Cassaforma o crogiolo fuori fascia. Non colare finché qualità non firma.</p>" +
            (ack ? "<p class='chip ok'>Ack di banco.</p>" : "<button class='cta' data-act='ack' data-k='"+s.name+"'>Prendi in carico</button>") +
            "</div>";
        }).join("");
      return;
    }
    el.innerHTML = "<h1>Turno B</h1><p class='sub'>Squadra · log · note di forno</p>" +
      "<div class='crew'>" + crew.map(c => "<div><span class='sub'>"+c.r+"</span><b>"+c.n+"</b><span class='chip "+(c.s==="hold"?"hold":"ok")+"'>"+c.s+"</span></div>").join("") + "</div>" +
      "<div class='panel' style='margin-top:14px'><h2>Log banco</h2><ul class='log'>" +
      state.notes.map(n => "<li><span>"+n.t+"</span><span>"+n.n+" — "+n.m+"</span></li>").join("") +
      "</ul><label>Nuova nota</label><textarea id='note' rows='2' placeholder='Es. termocoppia 2 instabile'></textarea>" +
      "<div style='margin-top:10px'><button class='cta' data-act='note'>Registra</button></div></div>";
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act], [data-view]");
    if (!t) return;
    if (t.dataset.view) { state.view = t.dataset.view; save(); render(); return; }
    if (t.dataset.act === "ack") {
      if (state.acks.indexOf(t.dataset.k) < 0) state.acks.push(t.dataset.k);
      save(); render(); return;
    }
    if (t.dataset.act === "note") {
      const m = (document.getElementById("note").value || "").trim();
      if (!m) return;
      const t0 = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      state.notes.unshift({ t: t0, n: "Banco", m: m });
      save(); render();
    }
  });
  async function boot(){
    try {
      if (window.Fenix && window.Fenix.load) {
        const r = await window.Fenix.load("state");
        if (r && typeof r === "object") state = Object.assign(state, r);
      }
    } catch (e) {}
    render();
  }
  boot();
</script>
</body>
</html>`;
