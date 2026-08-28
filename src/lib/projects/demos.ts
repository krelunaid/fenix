import type { Palette, ProjectKind } from "./types";

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
  corvo: {
    id: "corvo",
    name: "Caffè Corvo",
    tagline: "L'espresso, al punto.",
    kind: "landing",
    summary: "Pagina prodotto: foto, menu, prenotazione tavolo.",
    palette: {
      bg: "#f5f5f7",
      surface: "#ffffff",
      fg: "#1d1d1f",
      muted: "#6e6e73",
      accent: "#1d1d1f",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Caffè Corvo</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap"/>
<style>
  :root { --bg:#f5f5f7; --ink:#1d1d1f; --muted:#6e6e73; --line:rgba(0,0,0,.08); --card:#fff; }
  * { box-sizing:border-box; margin:0; }
  html { color-scheme:light; scroll-behavior:smooth; }
  body { background:var(--bg); color:var(--ink); font-family:Manrope,ui-sans-serif,system-ui,sans-serif; }
  a { color:inherit; text-decoration:none; }
  header { position:sticky; top:0; z-index:4; display:flex; justify-content:space-between; align-items:center; height:52px; padding:0 28px; background:rgba(245,245,247,.72); backdrop-filter:saturate(180%) blur(20px); }
  .mark { font-weight:600; letter-spacing:-.03em; }
  nav { display:flex; gap:22px; font-size:12px; color:var(--muted); }
  .hero { text-align:center; padding:28px 24px 8px; }
  .hero img { width:min(920px,100%); height:min(62vh,560px); object-fit:cover; border-radius:28px; display:block; margin:0 auto; }
  .hero h1 { margin-top:36px; font-size:clamp(2.6rem,8vw,4.4rem); font-weight:600; letter-spacing:-.045em; line-height:1.04; }
  .hero p { margin:12px auto 0; max-width:28rem; color:var(--muted); font-size:19px; line-height:1.45; }
  .cta { margin-top:28px; height:44px; padding:0 22px; border:0; border-radius:980px; background:var(--ink); color:#fff; font:600 14px Manrope,sans-serif; cursor:pointer; }
  .cta:active { transform:scale(.98); }
  .ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
  .wrap { max-width:920px; margin:0 auto; padding:72px 24px 96px; }
  .split { display:grid; grid-template-columns:1.1fr .9fr; gap:28px; }
  .card { background:var(--card); border-radius:24px; padding:28px; }
  h2 { font-size:28px; letter-spacing:-.03em; font-weight:600; margin-bottom:18px; }
  .item { display:flex; justify-content:space-between; padding:14px 0; border-top:1px solid var(--line); font-size:15px; }
  .item span { color:var(--muted); }
  label { display:block; font-size:12px; color:var(--muted); margin:14px 0 6px; }
  input, select { width:100%; height:44px; border:1px solid var(--line); background:#f5f5f7; border-radius:12px; padding:0 12px; font:15px Manrope,sans-serif; color:var(--ink); }
  .ok { display:none; margin-top:14px; font-size:14px; }
  .hours { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:28px; }
  .hours div { background:var(--card); border-radius:20px; padding:22px; }
  .hours b { display:block; margin-top:8px; font-size:22px; letter-spacing:-.03em; }
  footer { padding:28px; color:var(--muted); font-size:12px; display:flex; justify-content:space-between; }
  @media (max-width:800px) {
    nav { display:none; }
    .split, .hours { grid-template-columns:1fr; }
    .hero img { height:48vh; border-radius:20px; }
  }
</style>
</head>
<body>
<header>
  <div class="mark">Caffè Corvo</div>
  <nav>
    <a href="#menu">Menu</a>
    <a href="#tavolo">Tavolo</a>
    <a href="#orari">Orari</a>
  </nav>
</header>
<section class="hero">
  <img alt="Espresso" src="https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1800&q=80"/>
  <h1>L'espresso. Al punto.</h1>
  <p>Via Mazzini 18, Torino. Tostatura propria, banco di marmo, niente fretta.</p>
  <a href="#tavolo"><button class="cta">Prenota un tavolo</button></a>
</section>
<section class="wrap">
  <div class="split">
    <article class="card" id="menu">
      <h2>Al banco</h2>
      <div class="item"><b>Espresso</b><span>1,40</span></div>
      <div class="item"><b>Macchiato</b><span>1,50</span></div>
      <div class="item"><b>Cappuccino</b><span>1,80</span></div>
      <div class="item"><b>Cornetto al pistacchio</b><span>1,90</span></div>
    </article>
    <article class="card" id="tavolo">
      <h2>Un tavolo</h2>
      <form id="book">
        <label>Nome</label>
        <input name="nome" required placeholder="Anna Rossi"/>
        <label>Persone</label>
        <select name="persone"><option>2</option><option>3</option><option>4</option></select>
        <label>Ora</label>
        <select name="ora"><option>08:30</option><option>09:00</option><option>11:00</option></select>
        <div style="height:18px"></div>
        <button class="cta" type="submit">Richiedi</button>
        <p class="ok" id="ok">Richiesta presa. Ti confermiamo al banco.</p>
      </form>
    </article>
  </div>
  <div class="hours" id="orari">
    <div><span style="color:var(--muted);font-size:12px">Settimana</span><b>7–19</b></div>
    <div><span style="color:var(--muted);font-size:12px">Sabato</span><b>8–14</b></div>
    <div><span style="color:var(--muted);font-size:12px">Domenica</span><b>Chiuso</b></div>
  </div>
</section>
<footer>
  <span>Caffè Corvo</span>
  <span>torino@caffecorvo.it</span>
</footer>
<script>
  document.getElementById("book").addEventListener("submit", function (e) {
    e.preventDefault();
    document.getElementById("ok").style.display = "block";
  });
</script>
</body>
</html>`,
  },
  kiln: {
    id: "kiln",
    name: "Kiln",
    tagline: "Delivery, in chiaro.",
    kind: "dashboard",
    summary: "KPI enormi, sprint, rischi.",
    palette: {
      bg: "#f5f5f7",
      surface: "#ffffff",
      fg: "#1d1d1f",
      muted: "#6e6e73",
      accent: "#1d1d1f",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Kiln</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap"/>
<style>
  :root { --bg:#f5f5f7; --ink:#1d1d1f; --muted:#6e6e73; --line:rgba(0,0,0,.08); --card:#fff; }
  * { box-sizing:border-box; margin:0; }
  html { color-scheme:light; }
  body { background:var(--bg); color:var(--ink); font-family:Manrope,ui-sans-serif,system-ui,sans-serif; min-height:100vh; }
  header { height:52px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; }
  .mark { font-weight:600; letter-spacing:-.03em; }
  .tabs button { height:32px; padding:0 12px; border:0; background:transparent; color:var(--muted); font:500 13px Manrope,sans-serif; border-radius:980px; cursor:pointer; }
  .tabs button.on { background:#fff; color:var(--ink); }
  main { max-width:980px; margin:0 auto; padding:12px 24px 64px; }
  h1 { font-size:clamp(2.2rem,6vw,3.2rem); letter-spacing:-.04em; font-weight:600; }
  .sub { color:var(--muted); margin-top:6px; font-size:15px; }
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:32px 0; }
  .kpi { background:var(--card); border-radius:22px; padding:22px; }
  .kpi span { font-size:12px; color:var(--muted); }
  .kpi b { display:block; margin-top:8px; font-size:40px; letter-spacing:-.04em; font-variant-numeric:tabular-nums; font-weight:600; }
  .list { background:var(--card); border-radius:22px; overflow:hidden; }
  .row { display:grid; grid-template-columns:1.4fr .6fr 1fr auto; gap:12px; align-items:center; padding:16px 22px; border-top:1px solid var(--line); font-size:14px; }
  .bar { height:4px; background:#ececee; border-radius:99px; overflow:hidden; }
  .bar i { display:block; height:100%; background:var(--ink); }
  .chip { font-size:12px; color:var(--muted); }
  [hidden] { display:none !important; }
  @media (max-width:700px) {
    .kpis { grid-template-columns:1fr; }
    .row { grid-template-columns:1fr 1fr; }
  }
</style>
</head>
<body>
<header>
  <div class="mark">Kiln</div>
  <div class="tabs">
    <button class="on" data-act="view" data-view="board">Board</button>
    <button data-act="view" data-view="risk">Rischi</button>
  </div>
</header>
<main id="app"></main>
<script>
  const state = { view: "board" };
  const sprints = [
    { name: "Intake v3", owner: "Lea", bar: 82, risk: "ok" },
    { name: "Billing EU", owner: "Omar", bar: 54, risk: "hold" },
    { name: "Mobile share", owner: "Nia", bar: 91, risk: "ok" },
    { name: "Audit log", owner: "Pia", bar: 28, risk: "hold" },
  ];
  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const el = document.getElementById("app");
    const rows = (state.view === "risk" ? sprints.filter(s => s.risk !== "ok") : sprints)
      .map(s => "<div class='row'><b>"+s.name+"</b><span>"+s.owner+"</span><div class='bar'><i style='width:"+s.bar+"%'></i></div><span class='chip'>"+(s.risk==="ok"?"In linea":"Rischio")+"</span></div>")
      .join("");
    el.innerHTML = "<h1>"+(state.view==="risk"?"Rischi":"Delivery")+"</h1><p class='sub'>8 persone · sprint in corso</p>" +
      (state.view==="board" ? "<div class='kpis'><div class='kpi'><span>Ciclo</span><b>5.4g</b></div><div class='kpi'><span>Throughput</span><b>52</b></div><div class='kpi'><span>Rischi</span><b>2</b></div></div>" : "") +
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
</html>`,
  },
  vesper: {
    id: "vesper",
    name: "Vesper",
    tagline: "Respira.",
    kind: "app",
    summary: "Timer 4-4-4, tre programmi, diario.",
    palette: {
      bg: "#000000",
      surface: "#111111",
      fg: "#f5f5f7",
      muted: "#86868b",
      accent: "#f5f5f7",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>Vesper</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap"/>
<style>
  :root { --bg:#000; --fg:#f5f5f7; --muted:#86868b; }
  * { box-sizing:border-box; margin:0; }
  html,body { min-height:100%; color-scheme:dark; }
  body { background:var(--bg); color:var(--fg); font-family:Manrope,ui-sans-serif,system-ui,sans-serif; min-height:100svh; display:flex; flex-direction:column; }
  header { height:52px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; }
  .mark { font-weight:600; letter-spacing:-.03em; }
  .nav { background:transparent; border:0; color:var(--muted); font:500 13px Manrope,sans-serif; cursor:pointer; }
  .nav.on { color:var(--fg); }
  main { flex:1; display:grid; place-items:center; padding:12px 24px 48px; }
  .stage { text-align:center; }
  .circle { width:min(260px,68vw); height:min(260px,68vw); margin:0 auto 28px; border-radius:50%; border:1px solid rgba(255,255,255,.14); display:grid; place-items:center; transition:transform 4s cubic-bezier(.22,1,.36,1); }
  .circle.in { transform:scale(1.08); }
  .n { font-size:72px; font-weight:600; letter-spacing:-.05em; font-variant-numeric:tabular-nums; }
  .phase { font-size:13px; color:var(--muted); margin-bottom:10px; letter-spacing:-.01em; }
  .btn { margin-top:28px; height:44px; padding:0 26px; border:0; border-radius:980px; background:var(--fg); color:#000; font:600 14px Manrope,sans-serif; cursor:pointer; }
  .progs { display:flex; gap:8px; justify-content:center; margin-top:22px; }
  .chip { height:34px; padding:0 14px; border-radius:980px; border:1px solid rgba(255,255,255,.14); background:transparent; color:var(--muted); font:500 13px Manrope,sans-serif; cursor:pointer; }
  .chip.on { color:var(--fg); border-color:var(--fg); }
  .log { width:min(360px,92vw); }
  .log li { display:flex; justify-content:space-between; padding:14px 0; border-bottom:1px solid rgba(255,255,255,.08); color:var(--muted); font-size:14px; }
  @media (prefers-reduced-motion:reduce) { .circle { transition:none; } }
</style>
</head>
<body>
<header>
  <div class="mark">Vesper</div>
  <div>
    <button class="nav on" data-act="view" data-view="session">Sessione</button>
    <button class="nav" data-act="view" data-view="diario">Diario</button>
  </div>
</header>
<main id="app"></main>
<script>
  const programs = { alba: "Alba", fuoco: "Fuoco", notte: "Notte" };
  const state = { view: "session", prog: "alba", running: false, phase: "Pronto", count: 4, log: JSON.parse(localStorage.getItem("vesper-log") || "[]") };
  let timer = null;
  const seq = [["Inspira",4],["Trattieni",4],["Espira",4]];
  function save() { localStorage.setItem("vesper-log", JSON.stringify(state.log)); }
  function render() {
    document.querySelectorAll("header .nav").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    const el = document.getElementById("app");
    if (state.view === "diario") {
      el.innerHTML = "<div class='log'><p class='phase'>Diario</p>" +
        (state.log.length ? "<ul>" + state.log.map(x => "<li><span>"+x.prog+"</span><span>"+x.at+"</span></li>").join("") + "</ul>" : "<p class='phase'>Nessuna sessione.</p>") + "</div>";
      return;
    }
    el.innerHTML = "<div class='stage'><p class='phase'>"+state.phase+"</p>" +
      "<div class='circle"+(state.phase==="Inspira"?" in":"")+"'><span class='n'>"+state.count+"</span></div>" +
      "<div class='progs'>" + Object.keys(programs).map(k => "<button class='chip"+(state.prog===k?" on":"")+"' data-act='prog' data-k='"+k+"'>"+programs[k]+"</button>").join("") + "</div>" +
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
    state.log.unshift({ prog: programs[state.prog], at: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) });
    save(); render();
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    if (t.dataset.act === "view") state.view = t.dataset.view;
    if (t.dataset.act === "prog" && !state.running) state.prog = t.dataset.k;
    if (t.dataset.act === "toggle") {
      if (state.running) { state.running = false; clearInterval(timer); state.phase = "Pronto"; state.count = 4; }
      else { state.running = true; tick(0); return; }
    }
    render();
  });
  render();
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
      bg: "#f5f5f7",
      surface: "#ffffff",
      fg: "#1d1d1f",
      muted: "#6e6e73",
      accent: "#1d1d1f",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Split</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap"/>
<style>
  :root { --bg:#f5f5f7; --ink:#1d1d1f; --muted:#6e6e73; --line:rgba(0,0,0,.08); }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:Manrope,ui-sans-serif,system-ui,sans-serif; min-height:100svh; }
  main { max-width:420px; margin:0 auto; padding:28px 20px 64px; }
  h1 { font-size:40px; letter-spacing:-.04em; font-weight:600; }
  .sub { color:var(--muted); margin:6px 0 28px; }
  .card { background:#fff; border-radius:22px; padding:18px; margin-bottom:12px; }
  label { display:block; font-size:12px; color:var(--muted); margin-bottom:6px; }
  input { width:100%; height:44px; border:1px solid var(--line); background:#f5f5f7; border-radius:12px; padding:0 12px; font:16px Manrope,sans-serif; }
  .row { display:grid; grid-template-columns:1fr 110px; gap:8px; }
  .cta { margin-top:12px; width:100%; height:44px; border:0; border-radius:980px; background:var(--ink); color:#fff; font:600 14px Manrope,sans-serif; cursor:pointer; }
  .item { display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid var(--line); font-size:14px; }
  .bal b { font-size:28px; letter-spacing:-.04em; font-variant-numeric:tabular-nums; }
  .muted { color:var(--muted); }
</style>
</head>
<body>
<main id="app"></main>
<script>
  const state = {
    people: ["Anna","Luca","Mia","Pia"],
    costs: [{ t:"Cena", n:"Anna", a:80 }, { t:"Taxi", n:"Luca", a:24 }],
  };
  function totals() {
    const paid = Object.fromEntries(state.people.map(p => [p, 0]));
    let sum = 0;
    state.costs.forEach(c => { paid[c.n] += c.a; sum += c.a; });
    const share = state.people.length ? sum / state.people.length : 0;
    return { paid, sum, share, due: state.people.map(p => ({ p, v: +(paid[p]-share).toFixed(2) })) };
  }
  function render() {
    const x = totals();
    document.getElementById("app").innerHTML =
      "<h1>Split</h1><p class='sub'>Quattro amici. I conti tornano.</p>" +
      "<div class='card'><label>Nuova spesa</label><div class='row'><input id='t' placeholder='Cosa'/><input id='a' type='number' placeholder='Euro'/></div>" +
      "<select id='n' style='margin-top:8px;width:100%;height:44px;border-radius:12px;border:1px solid var(--line);padding:0 12px;font:16px Manrope,sans-serif'>" +
      state.people.map(p=>"<option>"+p+"</option>").join("") + "</select>" +
      "<button class='cta' data-act='add'>Aggiungi</button></div>" +
      "<div class='card'>" + state.costs.map(c=>"<div class='item'><span>"+c.t+" · "+c.n+"</span><b>"+c.a.toFixed(2)+" €</b></div>").join("") + "</div>" +
      "<div class='card'>" + x.due.map(d=>"<div class='item bal'><span>"+d.p+"</span><b>"+(d.v>=0?"+":"")+d.v.toFixed(2)+" €</b></div>").join("") +
      "<p class='muted' style='margin-top:8px;font-size:12px'>Totale "+x.sum.toFixed(2)+" € · quota "+x.share.toFixed(2)+" €</p></div>";
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t || t.dataset.act !== "add") return;
    const title = document.getElementById("t").value.trim() || "Spesa";
    const amount = parseFloat(document.getElementById("a").value);
    const who = document.getElementById("n").value;
    if (!amount || amount <= 0) return;
    state.costs.push({ t: title, n: who, a: amount });
    render();
  });
  render();
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
      fg: "#f5f5f7",
      muted: "#86868b",
      accent: "#f5f5f7",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>Giulia Neri</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap"/>
<style>
  :root { --fg:#f5f5f7; --muted:#86868b; }
  * { box-sizing:border-box; margin:0; }
  html { color-scheme:dark; scroll-behavior:smooth; }
  body { background:#000; color:var(--fg); font-family:Manrope,ui-sans-serif,system-ui,sans-serif; }
  header { position:fixed; inset:0 0 auto; z-index:2; display:flex; justify-content:space-between; padding:18px 24px; font-size:13px; }
  nav a { color:var(--muted); margin-left:16px; text-decoration:none; }
  .shot { min-height:100svh; position:relative; }
  .shot img { width:100%; height:100svh; object-fit:cover; display:block; }
  .cap { position:absolute; left:24px; bottom:28px; }
  .cap b { display:block; font-size:22px; letter-spacing:-.03em; }
  .cap span { color:var(--muted); font-size:13px; }
  #about { padding:80px 24px; max-width:560px; }
  h1 { font-size:40px; letter-spacing:-.04em; font-weight:600; }
  p { margin-top:14px; color:var(--muted); line-height:1.55; }
  .cta { display:inline-flex; margin-top:24px; height:44px; align-items:center; padding:0 20px; border-radius:980px; background:var(--fg); color:#000; text-decoration:none; font-weight:600; font-size:14px; }
</style>
</head>
<body>
<header>
  <b>Giulia Neri</b>
  <nav><a href="#p1">Lavori</a><a href="#about">About</a></nav>
</header>
<section class="shot" id="p1">
  <img alt="Torre" src="https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1800&q=80"/>
  <div class="cap"><b>Torre Viale</b><span>Milano · 2024</span></div>
</section>
<section class="shot">
  <img alt="Cortile" src="https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1800&q=80"/>
  <div class="cap"><b>Cortile Magenta</b><span>Milano · 2023</span></div>
</section>
<section class="shot">
  <img alt="Scala" src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=80"/>
  <div class="cap"><b>Scala Brera</b><span>Milano · 2022</span></div>
</section>
<section id="about">
  <h1>Lastre, luce, silenzio.</h1>
  <p>Fotografo architettura a Milano. Commissioni per studi e editori. Lavoro con luce esistente.</p>
  <a class="cta" href="mailto:ciao@giulianeri.it">Scrivimi</a>
</section>
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
      bg: "#f5f5f7",
      surface: "#ffffff",
      fg: "#1d1d1f",
      muted: "#6e6e73",
      accent: "#1d1d1f",
    },
    html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Memory</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap"/>
<style>
  :root { --bg:#f5f5f7; --ink:#1d1d1f; --muted:#6e6e73; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:Manrope,ui-sans-serif,system-ui,sans-serif; min-height:100svh; }
  main { max-width:420px; margin:0 auto; padding:28px 16px 48px; text-align:center; }
  h1 { font-size:40px; letter-spacing:-.04em; font-weight:600; }
  .bar { display:flex; justify-content:space-between; color:var(--muted); font-size:13px; margin:12px 0 20px; font-variant-numeric:tabular-nums; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .card { height:86px; border:0; border-radius:16px; background:#fff; box-shadow:0 8px 24px -18px #000; cursor:pointer; font-size:22px; font-weight:600; color:transparent; }
  .card.on, .card.ok { color:var(--ink); }
  .card.ok { background:#ececee; }
  .cta { margin-top:22px; height:44px; padding:0 22px; border:0; border-radius:980px; background:var(--ink); color:#fff; font:600 14px Manrope,sans-serif; cursor:pointer; }
  .win { margin-top:18px; font-size:18px; }
</style>
</head>
<body>
<main id="app"></main>
<script>
  const glyphs = ["△","○","□","◇","＋","∥","◎","⊞"];
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  const state = { deck: [], open: [], lock: false, moves: 0, t0: Date.now() };
  function deal() {
    state.deck = shuffle(glyphs.concat(glyphs)).map((g,i)=>({ id:i, g, on:false, ok:false }));
    state.open = []; state.lock = false; state.moves = 0; state.t0 = Date.now();
    render();
  }
  function render() {
    const won = state.deck.every(c => c.ok);
    const sec = Math.floor((Date.now()-state.t0)/1000);
    document.getElementById("app").innerHTML =
      "<h1>Memory</h1><div class='bar'><span>"+state.moves+" mosse</span><span>"+sec+" s</span></div>" +
      "<div class='grid'>" + state.deck.map(c =>
        "<button class='card"+(c.on||c.ok?" on":"")+(c.ok?" ok":"")+"' data-act='flip' data-id='"+c.id+"'>"+(c.on||c.ok?c.g:"")+"</button>"
      ).join("") + "</div>" +
      (won ? "<p class='win'>Fatto. "+state.moves+" mosse.</p>" : "") +
      "<button class='cta' data-act='new'>Ricomincia</button>";
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    if (t.dataset.act === "new") { deal(); return; }
    if (state.lock) return;
    const c = state.deck[+t.dataset.id];
    if (!c || c.on || c.ok) return;
    c.on = true; state.open.push(c);
    if (state.open.length === 2) {
      state.moves += 1; state.lock = true;
      const [a,b] = state.open;
      setTimeout(() => {
        if (a.g === b.g) { a.ok = b.ok = true; }
        else { a.on = b.on = false; }
        state.open = []; state.lock = false; render();
      }, 520);
    }
    render();
  });
  deal();
  setInterval(() => { if (!state.deck.every(c=>c.ok)) render(); }, 1000);
</script>
</body>
</html>`,
  },
};
