import type { Palette, ProjectKind } from "./types.ts";
import { CATENARIA_HTML } from "./catenaria.ts";
import { GROTTAGLIE_HTML } from "./grottaglie.ts";
import { CORVO_HTML } from "./corvo.ts";
import { KILN_HTML } from "./kiln.ts";

export type DemoSeed = {
  id: string;
  name: string;
  tagline: string;
  kind: ProjectKind;
  summary: string;
  palette: Palette;
  html: string;
};

export const DEMOS: Record<string, DemoSeed> = {
  grottaglie: {
    id: "grottaglie",
    name: "Fornace Grottaglie",
    tagline: "Forni, pezzi e ordini in bottega",
    kind: "app",
    summary: "Ceramica a Grottaglie: cotture, pezzi, ordini. Direzione visiva terracotta/calce.",
    palette: {
      bg: "#e8dcc8",
      surface: "#f4ebe0",
      fg: "#3b2a22",
      muted: "#8a6f5c",
      accent: "#b85c38",
    },
    html: GROTTAGLIE_HTML,
  },
  catenaria: {
    id: "catenaria",
    name: "Officina Catenaria",
    tagline: "Acciaio, olio e bici d'epoca a Bologna",
    kind: "app",
    summary: "Appuntamenti, magazzino pezzi e riparazioni. Si usa.",
    palette: {
      bg: "#1a1612",
      surface: "#2a241c",
      fg: "#e6dcc8",
      muted: "#9a8f7a",
      accent: "#c45c26",
    },
    html: CATENARIA_HTML,
  },
  corvo: {
    id: "corvo",
    name: "Caffè Corvo",
    tagline: "L'espresso, al punto.",
    kind: "landing",
    summary: "Banco di zinco a San Salvario: menu corto, prenotazione tavolo.",
    palette: {
      bg: "#cfc6b6",
      surface: "#e7dfd1",
      fg: "#1c1712",
      muted: "#5a4e42",
      accent: "#3d4f4a",
    },
    html: CORVO_HTML,
  },
  kiln: {
    id: "kiln",
    name: "Kiln",
    tagline: "Colata, in chiaro.",
    kind: "dashboard",
    summary: "Cruscotto forno: temperatura, colate, rischi.",
    palette: {
      bg: "#0e0d0b",
      surface: "#1c1a16",
      fg: "#e8e0d0",
      muted: "#8a8274",
      accent: "#d4782a",
    },
    html: KILN_HTML,
  },
  vesper: {
    id: "vesper",
    name: "Vesper",
    tagline: "Respira.",
    kind: "app",
    summary: "Timer 4-4-4, tre programmi, diario.",
    palette: {
      bg: "#08070c",
      surface: "#14121a",
      fg: "#e6dcc4",
      muted: "#8a8170",
      accent: "#c9b896",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>Vesper</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Sans:wght@400;500&display=swap"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2308070c'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23c9b896' stroke-width='1.4'/%3E%3C/svg%3E"/>
<style>
  :root { --bg:#08070c; --fg:#e6dcc4; --muted:#8a8170; }
  * { box-sizing:border-box; margin:0; }
  html,body { min-height:100%; color-scheme:dark; }
  body { background:var(--bg); color:var(--fg); font-family:"IBM Plex Sans",system-ui,sans-serif; min-height:100svh; display:flex; flex-direction:column; }
  header { height:52px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; }
  .mark { font-family:"Cormorant Garamond",serif; font-weight:600; letter-spacing:-.03em; font-size:1.4rem; }
  .nav { background:transparent; border:0; color:var(--muted); font:500 13px "IBM Plex Sans",sans-serif; cursor:pointer; }
  .nav.on { color:var(--fg); }
  main { flex:1; display:grid; place-items:center; padding:12px 24px 48px; }
  .stage { text-align:center; }
  .circle { width:min(260px,68vw); height:min(260px,68vw); margin:0 auto 28px; border-radius:50%; border:1px solid rgba(201,184,150,.28); display:grid; place-items:center; transition:transform 4s cubic-bezier(.22,1,.36,1); }
  .circle.in { transform:scale(1.08); }
  .n { font-family:"Cormorant Garamond",serif; font-size:72px; font-weight:600; letter-spacing:-.05em; font-variant-numeric:tabular-nums; }
  .phase { font-size:13px; color:var(--muted); margin-bottom:10px; letter-spacing:.12em; text-transform:uppercase; }
  .btn { margin-top:28px; height:44px; padding:0 26px; border:1px solid var(--fg); border-radius:2px; background:transparent; color:var(--fg); font:600 13px "IBM Plex Sans",sans-serif; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
  .progs { display:flex; gap:8px; justify-content:center; margin-top:22px; }
  .chip { height:34px; padding:0 14px; border-radius:2px; border:1px solid rgba(201,184,150,.28); background:transparent; color:var(--muted); font:500 13px "IBM Plex Sans",sans-serif; cursor:pointer; }
  .chip.on { color:var(--fg); border-color:var(--fg); }
  .log { width:min(360px,92vw); }
  .log li { display:flex; justify-content:space-between; padding:14px 0; border-bottom:1px solid rgba(201,184,150,.14); color:var(--muted); font-size:14px; }
  .card { width:min(360px,92vw); text-align:left; }
  .card p { color:var(--muted); margin-top:10px; line-height:1.5; }
  @media (prefers-reduced-motion:reduce) { .circle { transition:none; } }
</style>
</head>
<body>
<header>
  <div class="mark">Vesper</div>
  <div>
    <button class="nav on" data-act="view" data-view="session">Sessione</button>
    <button class="nav" data-act="view" data-view="diario">Diario</button>
    <button class="nav" data-act="view" data-view="programmi">Programmi</button>
  </div>
</header>
<main id="app"></main>
<script>
  const programs = { alba: { name: "Alba", note: "4-4-4. Tre cicli, luce bassa." }, fuoco: { name: "Fuoco", note: "4-4-4. Ritmo stretto, nove passi." }, notte: { name: "Notte", note: "4-4-4. Chiude la giornata." } };
  const state = { view: "session", prog: "alba", running: false, phase: "Pronto", count: 4, log: [] };
  let timer = null;
  const seq = [["Inspira",4],["Trattieni",4],["Espira",4]];
  function save() { if (window.Fenix) void window.Fenix.save("state", { log: state.log, prog: state.prog }); }
  function render() {
    document.querySelectorAll("header .nav").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const el = document.getElementById("app");
    if (state.view === "diario") {
      el.innerHTML = "<div class='log'><p class='phase'>Diario</p>" +
        (state.log.length ? "<ul>" + state.log.map(x => "<li><span>"+x.prog+"</span><span>"+x.at+"</span></li>").join("") + "</ul>" : "<p class='phase'>Nessuna sessione.</p>") + "</div>";
      return;
    }
    if (state.view === "programmi") {
      el.innerHTML = "<div class='card'><p class='phase'>Tre programmi</p>" +
        Object.keys(programs).map(k => "<p><b style='color:var(--fg)'>"+programs[k].name+"</b> — "+programs[k].note+"</p>").join("") +
        "<p class='phase' style='margin-top:18px'>Scelto: "+programs[state.prog].name+"</p></div>";
      return;
    }
    el.innerHTML = "<div class='stage'><p class='phase'>"+state.phase+"</p>" +
      "<div class='circle"+(state.phase==="Inspira"?" in":"")+"'><span class='n'>"+state.count+"</span></div>" +
      "<div class='progs'>" + Object.keys(programs).map(k => "<button class='chip"+(state.prog===k?" on":"")+"' data-act='prog' data-k='"+k+"'>"+programs[k].name+"</button>").join("") + "</div>" +
      "<button class='btn' data-act='toggle'>"+(state.running?"Interrompi":"Inizia")+"</button></div>";
  }
  function tick(step) {
    if (!state.running) return;
    const [phase, secs] = seq[step % 3];
    state.phase = phase; state.count = secs; render();
    let left = secs;
    timer = setInterval(() => {
      left -= 1; state.count = Math.max(left, 0); render();
      if (left <= 0) { clearInterval(timer); if (step + 1 >= 9) finish(); else tick(step + 1); }
    }, 1000);
  }
  function finish() {
    state.running = false; state.phase = "Fine"; state.count = 0;
    state.log.unshift({ prog: programs[state.prog].name, at: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) });
    save(); render();
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    if (t.dataset.act === "view") state.view = t.dataset.view;
    if (t.dataset.act === "prog" && !state.running) { state.prog = t.dataset.k; save(); }
    if (t.dataset.act === "toggle") {
      if (state.running) { state.running = false; clearInterval(timer); state.phase = "Pronto"; state.count = 4; }
      else { state.running = true; tick(0); return; }
    }
    render();
  });
  function markReady(){document.documentElement.setAttribute("data-fenix-ready","1")}
  async function boot(){
    try {
      if (window.Fenix && window.Fenix.load) {
        const r = await window.Fenix.load("state");
        if (r && typeof r === "object") {
          if (Array.isArray(r.log)) state.log = r.log;
          if (r.prog) state.prog = r.prog;
        }
      }
    } catch (err) {}
    render();
    markReady();
  }
  boot();
</script>
</body>
</html>`,
  },
  split: {
    id: "split",
    name: "Split",
    tagline: "Chi deve a chi.",
    kind: "tool",
    summary: "Dividi le spese. Saldi corretti.",
    palette: {
      bg: "#efe6d4",
      surface: "#f7f1e4",
      fg: "#1c1814",
      muted: "#5c5348",
      accent: "#3d4a1f",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Split</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23efe6d4'/%3E%3Cpath d='M8 8h16v16H8z' fill='none' stroke='%233d4a1f' stroke-width='1.6'/%3E%3C/svg%3E"/>
<style>
  :root { --bg:#efe6d4; --ink:#1c1814; --muted:#5c5348; --line:#c4b49a; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:"IBM Plex Mono",ui-monospace,monospace; min-height:100svh; }
  header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--line); }
  .nav { background:transparent; border:0; color:var(--muted); font:600 12px "IBM Plex Mono",monospace; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; }
  .nav.on { color:var(--ink); }
  main { max-width:420px; margin:0 auto; padding:28px 20px 64px; }
  h1 { font-size:32px; letter-spacing:-.04em; font-weight:600; }
  .sub { color:var(--muted); margin:6px 0 28px; }
  .card { background:#f7f1e4; border:1px solid var(--line); border-radius:2px; padding:18px; margin-bottom:12px; }
  label { display:block; font-size:12px; color:var(--muted); margin-bottom:6px; }
  input { width:100%; height:44px; border:1px solid var(--line); background:#efe6d4; border-radius:2px; padding:0 12px; font:16px "IBM Plex Mono",monospace; }
  .row { display:grid; grid-template-columns:1fr 110px; gap:8px; }
  .cta { margin-top:12px; width:100%; height:44px; border:1px solid var(--ink); border-radius:2px; background:var(--ink); color:#efe6d4; font:600 13px "IBM Plex Mono",monospace; cursor:pointer; }
  .item { display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid var(--line); font-size:14px; }
  .bal b { font-size:28px; letter-spacing:-.04em; font-variant-numeric:tabular-nums; }
  .muted { color:var(--muted); }
</style>
</head>
<body>
<header>
  <b>Split</b>
  <div>
    <button class="nav on" data-act="view" data-view="spese">Spese</button>
    <button class="nav" data-act="view" data-view="saldi">Saldi</button>
    <button class="nav" data-act="view" data-view="persone">Persone</button>
  </div>
</header>
<main id="app"></main>
<script>
  const state = {
    view: "spese",
    people: ["Anna","Luca","Mia","Pia"],
    costs: [{ t:"Cena", n:"Anna", a:80 }, { t:"Taxi", n:"Luca", a:24 }],
  };
  function save(){ if (window.Fenix) void window.Fenix.save("state", { people: state.people, costs: state.costs }); }
  function totals() {
    const paid = Object.fromEntries(state.people.map(p => [p, 0]));
    let sum = 0;
    state.costs.forEach(c => { paid[c.n] = (paid[c.n]||0) + c.a; sum += c.a; });
    const share = state.people.length ? sum / state.people.length : 0;
    return { paid, sum, share, due: state.people.map(p => ({ p, v: +(paid[p]-share).toFixed(2) })) };
  }
  function render() {
    document.querySelectorAll("header .nav").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const x = totals();
    const el = document.getElementById("app");
    if (state.view === "saldi") {
      el.innerHTML = "<h1>Saldi</h1><p class='sub'>Quota "+x.share.toFixed(2)+" € su "+x.sum.toFixed(2)+" €</p>" +
        "<div class='card'>" + x.due.map(d=>"<div class='item bal'><span>"+d.p+"</span><b>"+(d.v>=0?"+":"")+d.v.toFixed(2)+" €</b></div>").join("") + "</div>";
      return;
    }
    if (state.view === "persone") {
      el.innerHTML = "<h1>Persone</h1><p class='sub'>Chi parteciperà al conto.</p>" +
        "<div class='card'>" + state.people.map(p=>"<div class='item'><span>"+p+"</span><span class='muted'>"+(x.paid[p]||0).toFixed(2)+" €</span></div>").join("") +
        "<label style='margin-top:12px'>Nuovo nome</label><input id='np' placeholder='Nome'/>" +
        "<button class='cta' data-act='add-p'>Aggiungi</button></div>";
      return;
    }
    el.innerHTML =
      "<h1>Spese</h1><p class='sub'>Quattro amici. I conti tornano.</p>" +
      "<div class='card'><label>Nuova spesa</label><div class='row'><input id='t' placeholder='Cosa'/><input id='a' type='number' placeholder='Euro'/></div>" +
      "<select id='n' style='margin-top:8px;width:100%;height:44px;border-radius:2px;border:1px solid var(--line);padding:0 12px;font:inherit'>" +
      state.people.map(p=>"<option>"+p+"</option>").join("") + "</select>" +
      "<button class='cta' data-act='add'>Aggiungi</button></div>" +
      "<div class='card'>" + state.costs.map(c=>"<div class='item'><span>"+c.t+" · "+c.n+"</span><b>"+c.a.toFixed(2)+" €</b></div>").join("") + "</div>";
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    if (t.dataset.act === "view") { state.view = t.dataset.view; render(); return; }
    if (t.dataset.act === "add-p") {
      const name = (document.getElementById("np").value || "").trim();
      if (!name || state.people.indexOf(name) >= 0) return;
      state.people.push(name); save(); render(); return;
    }
    if (t.dataset.act !== "add") return;
    const title = document.getElementById("t").value.trim() || "Spesa";
    const amount = parseFloat(document.getElementById("a").value);
    const who = document.getElementById("n").value;
    if (!amount || amount <= 0) return;
    state.costs.push({ t: title, n: who, a: amount });
    save(); render();
  });
  function markReady(){document.documentElement.setAttribute("data-fenix-ready","1")}
  async function boot(){
    try {
      if (window.Fenix && window.Fenix.load) {
        const r = await window.Fenix.load("state");
        if (r && Array.isArray(r.people) && Array.isArray(r.costs)) {
          state.people = r.people; state.costs = r.costs;
        }
      }
    } catch (err) {}
    render();
    markReady();
  }
  boot();
</script>
</body>
</html>`,
  },
  folio: {
    id: "folio",
    name: "Giulia Neri",
    tagline: "Architettura, Milano.",
    kind: "site",
    summary: "Portfolio a pieno formato, tre lastre, contatto.",
    palette: {
      bg: "#000000",
      surface: "#111111",
      fg: "#e8e0d4",
      muted: "#8a8274",
      accent: "#e8e0d4",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>Giulia Neri</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;500&display=swap"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23000000'/%3E%3Cpath d='M6 26V8h4l6 12 6-12h4v18h-4V14l-6 12-6-12v12H6z' fill='%23e8e0d4'/%3E%3C/svg%3E"/>
<style>
  :root { --bg:#000000; --fg:#e8e0d4; --muted:#8a8274; }
  * { box-sizing:border-box; margin:0; }
  html { color-scheme:dark; scroll-behavior:smooth; }
  body { background:var(--bg); color:var(--fg); font-family:"IBM Plex Sans",system-ui,sans-serif; }
  header { position:fixed; inset:0 0 auto; z-index:2; display:flex; justify-content:space-between; padding:18px 24px; font-size:13px; font-family:"Instrument Serif",serif; }
  nav a { color:var(--muted); margin-left:16px; text-decoration:none; font-family:"IBM Plex Sans",sans-serif; }
  .shot { min-height:100svh; position:relative; }
  .shot svg { width:100%; height:100svh; display:block; }
  .cap { position:absolute; left:24px; bottom:28px; }
  .cap b { display:block; font-family:"Instrument Serif",serif; font-size:22px; letter-spacing:-.03em; }
  .cap span { color:var(--muted); font-size:13px; }
  #about { padding:80px 24px; max-width:560px; }
  h1 { font-family:"Instrument Serif",serif; font-size:40px; letter-spacing:-.04em; font-weight:400; }
  p { margin-top:14px; color:var(--muted); line-height:1.55; }
  .cta { display:inline-flex; margin-top:24px; height:44px; align-items:center; padding:0 20px; border:1px solid var(--fg); border-radius:0; background:transparent; color:var(--fg); text-decoration:none; font-weight:600; font-size:12px; letter-spacing:.12em; text-transform:uppercase; }
  form { margin-top:24px; display:grid; gap:10px; }
  input, textarea { height:44px; border:1px solid #3a342c; background:#111; color:var(--fg); padding:0 12px; font:inherit; }
  textarea { height:88px; padding:10px 12px; }
  .ok { display:none; margin-top:10px; }
</style>
</head>
<body>
<header>
  <b>Giulia Neri</b>
  <nav><a href="#p1">Lavori</a><a href="#about">About</a><a href="#contatto">Contatto</a></nav>
</header>
<section class="shot" id="p1">
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Torre Viale">
    <rect width="1200" height="800" fill="#111"/>
    <rect x="420" y="40" width="220" height="720" fill="#2a2a28"/>
    <rect x="460" y="80" width="28" height="640" fill="#0a0a0a"/>
    <rect x="560" y="80" width="28" height="640" fill="#0a0a0a"/>
    <rect x="200" y="280" width="180" height="480" fill="#1a1a18"/>
    <rect x="700" y="200" width="160" height="560" fill="#181816"/>
  </svg>
  <div class="cap"><b>Torre Viale</b><span>Milano · 2024</span></div>
</section>
<section class="shot" id="p2">
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cortile Magenta">
    <rect width="1200" height="800" fill="#0c0c0c"/>
    <rect x="80" y="120" width="1040" height="560" fill="#1c1c1a"/>
    <rect x="140" y="180" width="400" height="440" fill="#10100e"/>
    <rect x="660" y="180" width="400" height="440" fill="#10100e"/>
    <rect x="560" y="180" width="80" height="440" fill="#2a2a26"/>
  </svg>
  <div class="cap"><b>Cortile Magenta</b><span>Milano · 2023</span></div>
</section>
<section class="shot" id="p3">
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scala Brera">
    <rect width="1200" height="800" fill="#090909"/>
    <path d="M80 720 L520 80 H680 L1120 720 Z" fill="#161614"/>
    <path d="M200 720 L560 160 H640 L1000 720" fill="none" stroke="#e8e0d4" stroke-width="2" opacity=".35"/>
    <rect x="80" y="680" width="1040" height="40" fill="#222"/>
  </svg>
  <div class="cap"><b>Scala Brera</b><span>Milano · 2022</span></div>
</section>
<section id="about">
  <h1>Lastre, luce, silenzio.</h1>
  <p>Fotografo architettura a Milano. Commissioni per studi e editori. Lavoro con luce esistente.</p>
</section>
<section id="contatto" style="padding:0 24px 80px;max-width:560px">
  <h1>Contatto</h1>
  <form id="mail">
    <input name="nome" required placeholder="Nome"/>
    <input name="mail" required type="email" placeholder="Email"/>
    <textarea name="msg" required placeholder="Commissione"></textarea>
    <button class="cta" type="submit">Invia</button>
  </form>
  <p class="ok" id="ok">Preso. Rispondo dal banco, non da un CRM.</p>
</section>
<script>
  let notes = [];
  function save(){ if (window.Fenix) void window.Fenix.save("state", { notes: notes }); }
  document.getElementById("mail").addEventListener("submit", function(e){
    e.preventDefault();
    const f = e.target;
    const nome = (f.nome.value||"").trim();
    const mail = (f.mail.value||"").trim();
    const msg = (f.msg.value||"").trim();
    if (!nome || !mail || !msg) return;
    notes.unshift({ nome: nome, mail: mail, msg: msg });
    save();
    document.getElementById("ok").style.display = "block";
    f.reset();
  });
  function markReady(){document.documentElement.setAttribute("data-fenix-ready","1")}
  async function boot(){
    try {
      if (window.Fenix && window.Fenix.load) {
        const r = await window.Fenix.load("state");
        if (r && Array.isArray(r.notes)) notes = r.notes;
      }
    } catch (err) {}
    markReady();
  }
  boot();
</script>
</body>
</html>`,
  },
  memory: {
    id: "memory",
    name: "Memory",
    tagline: "Otto coppie.",
    kind: "game",
    summary: "Memory giocabile: flip, mosse, vittoria.",
    palette: {
      bg: "#1a1410",
      surface: "#2a2118",
      fg: "#ead9b2",
      muted: "#9a8468",
      accent: "#d4782a",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>Memory</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=IBM+Plex+Mono:wght@400;600&display=swap"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%231a1410'/%3E%3Crect x='8' y='7' width='16' height='18' fill='none' stroke='%23d4782a' stroke-width='1.6'/%3E%3Ccircle cx='16' cy='16' r='3' fill='%23ead9b2'/%3E%3C/svg%3E"/>
<style>
  :root { --bg:#1a1410; --ink:#ead9b2; --muted:#9a8468; --accent:#d4782a; --plate:#2a2118; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:"IBM Plex Mono",ui-monospace,monospace; min-height:100svh; color-scheme:dark; }
  header { display:flex; justify-content:space-between; padding:16px; }
  .nav { background:transparent; border:0; color:var(--muted); font:600 11px "IBM Plex Mono",monospace; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
  .nav.on { color:var(--ink); }
  main { max-width:420px; margin:0 auto; padding:12px 16px 48px; text-align:center; }
  h1 { font-family:"Playfair Display",serif; font-size:40px; letter-spacing:-.04em; font-weight:600; }
  .bar { display:flex; justify-content:space-between; color:var(--muted); font-size:12px; margin:12px 0 20px; font-variant-numeric:tabular-nums; letter-spacing:.08em; text-transform:uppercase; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .card { height:86px; border:1px solid #3a2e22; border-radius:2px; background:var(--plate); cursor:pointer; font-size:22px; font-weight:600; color:transparent; }
  .card.on, .card.ok { color:var(--ink); }
  .card.ok { background:#3a2a1c; border-color:var(--accent); color:var(--accent); }
  .cta { margin-top:22px; height:44px; padding:0 22px; border:1px solid var(--ink); border-radius:0; background:transparent; color:var(--ink); font:600 12px "IBM Plex Mono",monospace; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
  .win { margin-top:18px; font-family:"Playfair Display",serif; font-size:18px; }
  .copy { text-align:left; color:var(--muted); line-height:1.5; margin-top:12px; }
</style>
</head>
<body>
<header>
  <b>Memory</b>
  <div>
    <button class="nav on" data-act="view" data-view="gioco">Gioco</button>
    <button class="nav" data-act="view" data-view="record">Record</button>
    <button class="nav" data-act="view" data-view="regole">Regole</button>
  </div>
</header>
<main id="app"></main>
<script>
  const glyphs = ["△","○","□","◇","＋","∥","◎","⊞"];
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  const state = { view: "gioco", deck: [], open: [], lock: false, moves: 0, t0: Date.now(), best: null };
  function save(){ if (window.Fenix) void window.Fenix.save("state", { best: state.best }); }
  function deal() {
    state.deck = shuffle(glyphs.concat(glyphs)).map((g,i)=>({ id:i, g, on:false, ok:false }));
    state.open = []; state.lock = false; state.moves = 0; state.t0 = Date.now();
    render();
  }
  function render() {
    document.querySelectorAll("header .nav").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const el = document.getElementById("app");
    if (state.view === "record") {
      el.innerHTML = "<h1>Record</h1><p class='copy'>"+(state.best ? "Miglior partita: "+state.best.moves+" mosse in "+state.best.sec+" s." : "Nessun record. Chiudi una partita.")+"</p>";
      return;
    }
    if (state.view === "regole") {
      el.innerHTML = "<h1>Regole</h1><p class='copy'>Otto coppie. Gira due carte. Se coincidono restano. Conta le mosse e il tempo. Record salvato in Fenix.</p>";
      return;
    }
    const won = state.deck.every(c => c.ok);
    const sec = Math.floor((Date.now()-state.t0)/1000);
    el.innerHTML =
      "<h1>Memory</h1><div class='bar'><span>"+state.moves+" mosse</span><span>"+sec+" s</span></div>" +
      "<div class='grid'>" + state.deck.map(c =>
        "<button class='card"+(c.on||c.ok?" on":"")+(c.ok?" ok":"")+"' data-act='flip' data-id='"+c.id+"'>"+(c.on||c.ok?c.g:"")+"</button>"
      ).join("") + "</div>" +
      (won ? "<p class='win'>Fatto. "+state.moves+" mosse.</p>" : "") +
      "<button class='cta' data-act='new'>Ricomincia</button>";
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    if (t.dataset.act === "view") { state.view = t.dataset.view; render(); return; }
    if (t.dataset.act === "new") { deal(); return; }
    if (state.view !== "gioco" || state.lock) return;
    const c = state.deck[+t.dataset.id];
    if (!c || c.on || c.ok) return;
    c.on = true; state.open.push(c);
    if (state.open.length === 2) {
      state.moves += 1; state.lock = true;
      const [a,b] = state.open;
      setTimeout(() => {
        if (a.g === b.g) { a.ok = b.ok = true; }
        else { a.on = b.on = false; }
        state.open = []; state.lock = false;
        if (state.deck.every(x => x.ok)) {
          const sec = Math.floor((Date.now()-state.t0)/1000);
          if (!state.best || state.moves < state.best.moves) state.best = { moves: state.moves, sec: sec };
          save();
        }
        render();
      }, 520);
    }
    render();
  });
  function markReady(){document.documentElement.setAttribute("data-fenix-ready","1")}
  async function boot(){
    try {
      if (window.Fenix && window.Fenix.load) {
        const r = await window.Fenix.load("state");
        if (r && r.best) state.best = r.best;
      }
    } catch (err) {}
    deal();
    markReady();
  }
  boot();
  setInterval(() => { if (state.view==="gioco" && state.deck.length && !state.deck.every(c=>c.ok)) render(); }, 1000);
</script>
</body>
</html>`,
  },
};
