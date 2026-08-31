export const CORVO_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Caffè Corvo — San Salvario</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,700&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%231c1712'/%3E%3Cpath d='M7 22c4-1 6-6 6-11 4 3 8 4 12 3-3 6-8 10-12 11-2-1-4-2-6-3z' fill='%23cfc6b6'/%3E%3C/svg%3E"/>
<style>
:root{--bg:#cfc6b6;--surface:#e7dfd1;--fg:#1c1712;--muted:#5a4e42;--accent:#3d4f4a;--line:#8a7c6c;--zinc:#6b7a76}
*{box-sizing:border-box;margin:0}
html{color-scheme:light;scroll-behavior:smooth}
body{background:var(--bg);color:var(--fg);font:400 16px/1.45 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit;text-decoration:none}
h1,h2{font-family:Newsreader,Georgia,serif;font-weight:700;letter-spacing:-.03em}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:2px solid var(--fg);background:var(--surface)}
.mark{display:flex;align-items:center;gap:10px;font-family:Newsreader,serif;font-size:1.35rem}
.mark svg{width:28px;height:28px}
nav{display:flex;gap:18px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.hero{display:grid;grid-template-columns:1.1fr .9fr;min-height:62vh;border-bottom:2px solid var(--fg)}
.hero img,.hero-art{width:100%;height:100%;object-fit:cover;min-height:280px;display:block;background:#3d4f4a}
.hero-copy{padding:36px 28px;background:var(--fg);color:var(--bg);display:flex;flex-direction:column;justify-content:flex-end;gap:14px}
.hero-copy p{max-width:28rem;color:#d4cbb8}
.cta{align-self:flex-start;height:44px;padding:0 18px;border:1px solid var(--bg);background:transparent;color:var(--bg);font:600 13px/1 "IBM Plex Sans",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.cta.solid{background:var(--accent);border-color:var(--accent);color:#f3ece0}
.wrap{max-width:960px;margin:0 auto;padding:48px 18px 72px}
.split{display:grid;grid-template-columns:1.1fr .9fr;gap:28px}
.board{background:var(--fg);color:var(--bg);padding:28px;border:2px solid var(--fg)}
.board h2{margin-bottom:16px}
.item{display:flex;justify-content:space-between;padding:10px 0;border-top:1px dashed #6b7a76;font-variant-numeric:tabular-nums}
.item span{color:#cfc6b6}
.card{background:var(--surface);border:1px solid var(--line);padding:24px}
label{display:block;font-size:12px;color:var(--muted);margin:12px 0 4px;text-transform:uppercase;letter-spacing:.06em}
input,select{width:100%;height:42px;border:1px solid var(--line);background:#f4efe6;padding:0 10px;font:inherit;color:var(--fg);border-radius:2px}
.hours{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:36px}
.hours div{border:1px solid var(--line);padding:18px;background:var(--surface)}
.hours b{display:block;margin-top:6px;font-family:Newsreader,serif;font-size:1.5rem}
footer{padding:22px 18px;border-top:2px solid var(--fg);display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
.ok{display:none;margin-top:12px;font-size:14px}
@media(max-width:800px){
  nav{display:none}
  .hero,.split,.hours{grid-template-columns:1fr}
  .hero{min-height:0}
  .hero img,.hero-art{height:42vh}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto}}
</style>
</head>
<body>
<header>
  <div class="mark" aria-hidden="false">
    <svg viewBox="0 0 32 32" fill="none"><path d="M7 22c4-1 6-6 6-11 4 3 8 4 12 3-3 6-8 10-12 11-2-1-4-2-6-3z" fill="#1c1712"/></svg>
    Caffè Corvo
  </div>
  <nav>
    <a href="#menu">Menu</a>
    <a href="#tavolo">Tavolo</a>
    <a href="#orari">Orari</a>
    <a href="#dove">Dove</a>
  </nav>
</header>
<section class="hero">
  <svg class="hero-art" viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Banco di zinco, tazzine e macchia d'olio" preserveAspectRatio="xMidYMid slice">
    <rect width="640" height="420" fill="#6b7a76"/>
    <rect y="240" width="640" height="180" fill="#3d4f4a"/>
    <rect y="228" width="640" height="18" fill="#8a9a94"/>
    <ellipse cx="160" cy="228" rx="70" ry="10" fill="#2a3532"/>
    <path d="M120 170h80v58h-80z" fill="#1c1712"/>
    <path d="M132 158h56v14h-56z" fill="#cfc6b6"/>
    <circle cx="160" cy="186" r="18" fill="#e7dfd1"/>
    <path d="M210 210c20-30 80-28 90 4" stroke="#1c1712" stroke-width="10" fill="none" opacity=".35"/>
    <rect x="360" y="150" width="220" height="80" fill="#5a4e42"/>
    <rect x="380" y="168" width="70" height="44" fill="#cfc6b6"/>
    <rect x="470" y="168" width="88" height="44" fill="#1c1712"/>
    <text x="24" y="40" fill="#e7dfd1" font-size="18" font-family="Georgia,serif">via Madama Cristina 41</text>
  </svg>
  <div class="hero-copy">
    <p>San Salvario · via Madama Cristina 41</p>
    <h1>Macchia sul banco. Espresso al punto.</h1>
    <p>Tostatura propria, menu corto a mano, niente luxury. Prenota un tavolo o vieni al bancone di zinco.</p>
    <a href="#tavolo"><button class="cta" type="button">Un tavolo</button></a>
  </div>
</section>
<section class="wrap" id="menu">
  <div class="split">
    <article class="board">
      <h2>Al banco</h2>
      <div class="item"><b>Espresso</b><span>1,20</span></div>
      <div class="item"><b>Macchiato</b><span>1,30</span></div>
      <div class="item"><b>Cappuccino</b><span>1,60</span></div>
      <div class="item"><b>Maritozzo</b><span>1,80</span></div>
      <div class="item"><b>Acqua del rubinetto</b><span>—</span></div>
    </article>
    <article class="card" id="tavolo">
      <h2>Prenota</h2>
      <form id="book">
        <label>Nome</label>
        <input name="nome" required placeholder="Anna Rossi"/>
        <label>Persone</label>
        <select name="persone"><option>2</option><option>3</option><option>4</option></select>
        <label>Ora</label>
        <select name="ora"><option>07:30</option><option>08:00</option><option>11:00</option></select>
        <div style="height:16px"></div>
        <button class="cta solid" type="submit">Segna il tavolo</button>
        <p class="ok" id="ok">Preso. Ti confermiamo al banco, niente SMS.</p>
      </form>
      <div id="booked"></div>
    </article>
  </div>
</section>
<section class="wrap" id="orari">
  <div class="hours">
    <div><span>Lun–Ven</span><b>6:30–19</b></div>
    <div><span>Sabato</span><b>7–14</b></div>
    <div><span>Domenica</span><b>Chiuso</b></div>
  </div>
</section>
<section class="wrap" id="dove">
  <article class="card">
    <h2>Dove</h2>
    <p>Via Madama Cristina 41, San Salvario. Entrata sul zinco, niente vetrina lucida. Paghi al banco.</p>
  </article>
</section>
<footer>
  <span>Caffè Corvo · San Salvario</span>
  <span>banco@caffecorvo.it</span>
</footer>
<script>
  let books = [];
  function save(){ if (window.Fenix) void window.Fenix.save("state", { books: books }); }
  function renderBooks(){
    const box = document.getElementById("booked");
    box.innerHTML = books.map(function(b){ return "<div class='item'><b>"+b.nome+" · "+b.persone+"</b><span>"+b.ora+"</span></div>"; }).join("");
  }
  document.getElementById("book").addEventListener("submit", function (e) {
    e.preventDefault();
    const f = e.target;
    const nome = (f.nome.value || "").trim();
    if (!nome) return;
    books.unshift({ nome: nome, persone: f.persone.value, ora: f.ora.value });
    save();
    renderBooks();
    document.getElementById("ok").style.display = "block";
    f.reset();
  });
  function markReady(){document.documentElement.setAttribute("data-fenix-ready","1")}
async function boot(){
    try {
      if (window.Fenix && window.Fenix.load) {
        const r = await window.Fenix.load("state");
        if (r && Array.isArray(r.books)) books = r.books;
      }
    } catch (err) {}
    renderBooks();
    markReady();
  }
  boot();
</script>
</body>
</html>`;
