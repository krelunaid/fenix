export function isLightHex(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const NAV_GUARD = `<script data-officina-guard>
document.addEventListener("click", function (e) {
  var n = e.target;
  if (n && n.nodeType !== 1) n = n.parentElement;
  var a = n && n.closest ? n.closest("a") : null;
  if (!a) return;
  var href = a.getAttribute("href") || "";
  if (href.charAt(0) === "#") {
    e.preventDefault();
    var id = decodeURIComponent(href.slice(1));
    var el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  e.preventDefault();
}, true);
</script>`;

const PHONE_KIT = `<style data-fenix-phone>
html,body{height:100%!important;margin:0;max-width:100%;overflow:hidden!important;color:var(--fg,#111);background:var(--bg,#f4f6fa)}
body{display:flex!important;flex-direction:column!important;min-height:100dvh;font-size:16px;-webkit-font-smoothing:antialiased}
.fk-top,body>header{flex-shrink:0;padding:14px 16px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.fk-hello{margin:0;font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.15}
.fk-role{margin:4px 0 0;font-size:12px;color:var(--muted,#3a3a3c);opacity:1}
.fk-date{margin:0 16px 10px;font-size:12px;color:var(--muted,#3a3a3c)}
.fk-main,body>main,main{
  flex:1 1 0%!important;min-height:0!important;overflow-y:scroll!important;
  padding:0 16px 28px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
}
.fk-panel{background:var(--fg,#1d1d1f);color:#f5f5f7;border-radius:22px;padding:18px 16px;margin:0 0 14px}
.fk-panel h2,.fk-panel h3{margin:0 0 12px;font-size:15px;color:#f5f5f7}
.fk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fk-stat{background:color-mix(in srgb,#fff 12%,transparent);border-radius:14px;padding:12px 12px 10px;color:#fff}
.fk-stat b{display:block;font-size:22px;letter-spacing:-.03em;color:#fff}
.fk-stat span{font-size:11px;opacity:.85;color:#fff}
.fk-tile{background:var(--surface,#fff);border:1px solid var(--line,#d2d2d7);border-radius:16px;padding:14px}
.fk-tile b{display:block;font-size:20px;margin-top:8px;letter-spacing:-.03em;color:var(--fg,#1d1d1f)}
.fk-tile span{font-size:12px;color:var(--muted,#3a3a3c)}
.fk-seg{display:flex;background:var(--line,#e5e5ea);border-radius:999px;padding:3px;gap:2px;margin:8px 0 14px}
.fk-seg button{flex:1;border:0;background:none;color:var(--fg,#1d1d1f);border-radius:999px;padding:8px 6px;font:600 13px/1 system-ui,sans-serif}
.fk-seg button.on{background:var(--surface,#fff);color:var(--fg,#1d1d1f);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.fk-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:16px;padding:14px 16px;font:700 16px/1 system-ui,sans-serif;background:var(--accent,#0071e3);color:#fff}
.fk-chiprow{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px}
.fk-chip{border:0;border-radius:12px;padding:10px 12px;font:650 13px/1 system-ui,sans-serif;background:color-mix(in srgb,var(--accent,#0071e3) 18%,#fff);color:var(--fg,#1d1d1f)}
.fk-field{display:flex;align-items:center;gap:10px;background:var(--surface,#fff);border:1px solid var(--line,#c7c7cc);border-radius:14px;padding:12px 14px;margin:6px 0 14px;color:var(--fg,#1d1d1f)}
.fk-field input,.fk-field select,.fk-field textarea{flex:1;border:0;background:none;font:inherit;color:var(--fg,#1d1d1f);outline:none;min-width:0}
.fk-lbl{display:block;font-size:12px;font-weight:650;margin:10px 0 0;color:var(--fg,#1d1d1f)}
.fk-tab,.tabbar,nav[aria-label]{
  flex-shrink:0;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;
  height:64px!important;max-height:72px;padding:6px 4px calc(6px + env(safe-area-inset-bottom));
  border-top:1px solid color-mix(in srgb, currentColor 12%, transparent);
  background:var(--bg,#f4f6fa);color:var(--muted,#6b7280);
  position:sticky;bottom:0;z-index:20;
}
.fk-tab button,.tabbar button,nav[aria-label] button{
  min-width:0;max-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;margin:0;padding:0 2px!important;border:0;background:none!important;color:inherit;
  font:600 10px/1.1 system-ui,sans-serif!important;transform:none!important;
}
.fk-tab button.on,.tabbar button.on,nav[aria-label] button.on{color:var(--accent,#1a73c7)!important;background:none!important;box-shadow:none!important}
.fk-tab svg,.tabbar svg,nav[aria-label] svg,.fk-tab button svg{width:24px!important;height:24px!important;flex:0 0 24px!important;transform:none!important}
.fk-tab span,.tabbar span,nav[aria-label] span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fk-hero{width:100%;height:160px;object-fit:cover;border-radius:20px;display:block;margin:8px 0 14px;background:#e8e8ed}
img[src=""],img:not([src]){display:none!important}
main,.fk-main,main p,main li,main b,.fk-tile,.fk-tile b,.fk-tile span,.fk-panel,.fk-hello,.fk-lbl{color:var(--fg,#1d1d1f)!important;opacity:1!important}
.fk-role,.fk-date,main .muted{color:#3a3a3c!important;opacity:1!important}
.fk-btn,.fk-panel,.fk-panel h2,.fk-panel h3,.fk-stat,.fk-stat b,.fk-stat span{color:#f5f5f7!important}
.fk-btn{color:#fff!important}
</style>`;

const SITE_KIT = `<style data-fenix-site>
html,body{height:auto!important;min-height:100%;margin:0;max-width:100%;overflow:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;color:var(--fg,#1d1d1f);background:var(--bg,#f5f5f7);font:400 16px/1.45 -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
body{display:block!important;padding:0 0 48px}
header,body>header,.site-top{padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px}
nav{display:flex;flex-wrap:wrap;gap:4px 2px;padding:0 12px 8px}
nav a,nav button{border:0;background:none;color:var(--fg,#1d1d1f);font:650 14px/1.2 system-ui,sans-serif;padding:8px 10px}
.fk-hero,header img, .hero img, img.cover{width:100%;height:200px;object-fit:cover;display:block;border-radius:0}
main,body>main{display:block!important;overflow:visible!important;flex:none!important;padding:20px 16px 32px;max-width:40rem;margin:0 auto}
h1{font-size:28px;letter-spacing:-.03em;line-height:1.15;margin:0 0 10px;color:#1d1d1f}
h2{font-size:20px;margin:28px 0 10px;color:#1d1d1f}
p,li{color:#1d1d1f;opacity:1}
section{margin:0 0 28px}
.card,.fk-tile{background:#fff;border-radius:16px;padding:16px;margin:0 0 12px;border:1px solid #e5e5ea;color:#1d1d1f}
footer{padding:24px 16px;font-size:13px;color:#3a3a3c}
img[src=""],img:not([src]){display:none!important}
</style>`;

function looksLikeSite(html: string, kind?: string) {
  if (/fk-tab|data-view=["']home["']|data-view=["']list["']/i.test(html)) return false;
  if (kind === "app" || kind === "dashboard") return false;
  if (kind === "site" || kind === "landing") return true;
  return /<footer/i.test(html) || (/<nav/i.test(html) && /href=/i.test(html));
}

export function fenixRuntimeScript(projectId: string) {
  return `<script data-fenix-runtime>
(function(){
  var pid = ${JSON.stringify(projectId)};
  try {
    var sc = document.querySelector("main") || document.getElementById("main") || document.body;
    sc.style.overflowY = "scroll";
    sc.style.webkitOverflowScrolling = "touch";
    sc.style.minHeight = "0";
    sc.style.flex = "1 1 0%";
  } catch (e) {}
  try {
    void window.localStorage;
  } catch (e) {
    var memoryStorage = {};
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: function(key){ return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null; },
        setItem: function(key, value){ memoryStorage[key] = String(value); },
        removeItem: function(key){ delete memoryStorage[key]; },
        clear: function(){ memoryStorage = {}; },
        key: function(index){ return Object.keys(memoryStorage)[index] || null; },
        get length(){ return Object.keys(memoryStorage).length; }
      }
    });
  }
  function localKey(col){ return "fenix-db:"+pid+":"+col; }
  function fallbackLoad(col){
    try { return JSON.parse(localStorage.getItem(localKey(col)) || "null"); }
    catch(e){ return null; }
  }
  function fallbackSave(col, data){
    try { localStorage.setItem(localKey(col), JSON.stringify(data)); } catch(e){}
    return data;
  }
  function call(op, col, data){
    if (!window.parent || window.parent === window) {
      return Promise.resolve(op === "load" ? fallbackLoad(col) : fallbackSave(col, data));
    }
    var id = Math.random().toString(36).slice(2);
    return new Promise(function(resolve){
      var done = false;
      function finish(v){
        if (done) return;
        done = true;
        window.removeEventListener("message", on);
        resolve(v);
      }
      function on(e){
        var m = e.data;
        if (!m || m.t !== "fenix-db" || m.id !== id) return;
        finish(m.v);
      }
      window.addEventListener("message", on);
      try {
        window.parent.postMessage({ t:"fenix-db", id:id, op:op, projectId:pid, col:col, data:data }, "*");
      } catch(err) {
        finish(op === "load" ? fallbackLoad(col) : fallbackSave(col, data));
      }
      setTimeout(function(){
        finish(op === "load" ? fallbackLoad(col) : fallbackSave(col, data));
      }, 800);
    });
  }
  window.Fenix = {
    projectId: pid,
    load: function(col){ return call("load", col); },
    save: function(col, data){ fallbackSave(col, data); return call("save", col, data); }
  };
  function audit(){
    try {
      var tabs = document.querySelectorAll("[data-view], [data-tab], .tabbar button, nav.tabs button, .tabs button, nav[aria-label] button").length;
      window.parent && window.parent.postMessage({
        t: "fenix-audit",
        svgs: document.querySelectorAll("svg").length,
        tabs: tabs,
        forms: document.querySelectorAll("form").length,
        inputs: document.querySelectorAll("input, select, textarea").length,
        hasIcon: !!document.querySelector("link[rel='icon'], link[rel=\"icon\"]"),
        title: document.title || "",
        vw: window.innerWidth,
        sw: document.documentElement.scrollWidth,
        mainChars: ((document.querySelector("main") || document.body).innerText || "").trim().length
      }, "*");
    } catch (err) {}
  }
  if (document.readyState === "complete") setTimeout(audit, 40);
  else window.addEventListener("load", function(){ setTimeout(audit, 40); });
  function sendShot(data){
    try { window.parent && window.parent.postMessage({ t: "fenix-shot", data: data || "" }, "*"); } catch (e) {}
  }
  function shoot(){
    try {
      if (!window.html2canvas) { sendShot(""); return; }
      window.html2canvas(document.documentElement, {
        scale: 1,
        width: 390,
        windowWidth: 390,
        windowHeight: 844,
        useCORS: true,
        logging: false,
        backgroundColor: null
      }).then(function(c){
        sendShot(c.toDataURL("image/jpeg", 0.62));
      }).catch(function(){ sendShot(""); });
    } catch (e) { sendShot(""); }
  }
  var hs = document.createElement("script");
  hs.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  hs.onload = function(){ setTimeout(shoot, 80); };
  hs.onerror = function(){ sendShot(""); };
  document.head.appendChild(hs);
  document.querySelectorAll("nav button, .fk-tab button, .tabbar button").forEach(function(b){
    b.setAttribute("type", "button");
  });
  var items = [];
  function listEl(){
    var ul = document.getElementById("fk-saved")
      || document.querySelector("[data-list], .fk-list, #elenco, #lista");
    if (ul) return ul;
    var main = document.querySelector('[data-view="list"], #view-list, main') || document.body;
    ul = document.createElement("ul");
    ul.id = "fk-saved";
    ul.style.cssText = "list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px";
    main.appendChild(ul);
    return ul;
  }
  function labelOf(it){
    if (!it || typeof it !== "object") return String(it || "");
    return it.nome || it.name || it.n || it.capo || it.t || it.v || Object.keys(it).filter(function(k){return it[k];}).map(function(k){return it[k];}).join(" · ");
  }
  function renderItems(){
    var ul = listEl();
    if (!items.length) {
      if (ul && ul.id === "fk-saved") ul.innerHTML = '<li class="fk-tile" style="color:#1d1d1f">Nessun elemento. Compila il form e salva.</li>';
      return;
    }
    var hero = document.querySelector(".fk-hero, img.cover, header img");
    var heroSrc = hero && hero.getAttribute("src");
    ul.innerHTML = items.map(function(it){
      var src = it.foto || it.img || it.image || heroSrc || "";
      var pic = src
        ? '<img src="'+src+'" alt="" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:12px;flex-shrink:0"/>'
        : "";
      return '<li class="fk-tile" style="display:flex;align-items:center;gap:12px;color:#1d1d1f;background:#fff;border:1px solid #e5e5ea;border-radius:14px;padding:10px 12px">'+pic+'<b style="color:#1d1d1f">'+labelOf(it)+'</b></li>';
    }).join("");
    document.querySelectorAll("p, .fk-role").forEach(function(p){
      if (/nessun elemento/i.test(p.textContent || "")) p.style.display = "none";
    });
    var stat = document.querySelector(".fk-stat b, [data-count]");
    if (stat) stat.textContent = String(items.length);
  }
  function persist(){
    if (window.Fenix) {
      window.Fenix.save("items", items);
      window.Fenix.load("state").then(function(st){
        var next = st && typeof st === "object" ? st : {};
        next.items = items;
        window.Fenix.save("state", next);
      });
    }
  }
  if (window.Fenix && window.Fenix.load) {
    Promise.all([window.Fenix.load("items"), window.Fenix.load("state")]).then(function(pair){
      var a = pair[0], st = pair[1];
      if (Array.isArray(a) && a.length) items = a;
      else if (st && Array.isArray(st.items) && st.items.length) items = st.items;
      renderItems();
    });
  }
  document.addEventListener("click", function(e){
    var chip = e.target.closest && e.target.closest(".fk-chip, [data-chip]");
    if (!chip) return;
    document.querySelectorAll(".fk-chip, [data-chip]").forEach(function(c){ c.classList.remove("on"); });
    chip.classList.add("on");
  }, true);
  document.addEventListener("submit", function(e){
    e.preventDefault();
    e.stopPropagation();
    var f = e.target;
    if (!f || !f.querySelector) return;
    var data = {};
    try { new FormData(f).forEach(function(v,k){ if(String(v).trim()) data[k]=String(v); }); } catch(err) {}
    var on = document.querySelector(".fk-chip.on, [data-chip].on");
    if (on && !data.categoria) data.categoria = (on.textContent || "").trim();
    if (!data.nome && !data.name && !data.n) {
      var first = f.querySelector("input, select, textarea");
      if (first && first.value) data.nome = String(first.value);
    }
    if (!Object.keys(data).length) return;
    items.unshift(data);
    persist();
    renderItems();
    try { f.reset(); } catch(err) {}
    var btn = f.querySelector('button[type="submit"], button:not([type]), .fk-btn');
    if (btn) {
      var old = btn.textContent;
      btn.textContent = "Salvato";
      setTimeout(function(){ btn.textContent = old; }, 1400);
    }
    var listBtn = document.querySelector('[data-view="list"]');
    if (listBtn) setTimeout(function(){ listBtn.click(); renderItems(); }, 200);
  }, true);
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("nav button, .fk-tab button, .tabbar button, [data-view], [data-go]");
    if (!b) return;
    var view = b.getAttribute("data-view") || b.getAttribute("data-go");
    if (!view) {
      var sp = b.querySelector("span");
      view = (sp && sp.textContent ? sp.textContent : "").trim().toLowerCase();
    }
    if (!view) return;
    var nav = b.closest("nav") || document.querySelector(".fk-tab, .tabbar, nav");
    if (nav) nav.querySelectorAll("button").forEach(function(x){ x.classList.toggle("on", x === b); });
    document.querySelectorAll("[data-screen]").forEach(function(el){
      el.hidden = String(el.getAttribute("data-screen")).toLowerCase() !== String(view).toLowerCase();
    });
    setTimeout(renderItems, 280);
  }, true);
})();
</script>`;
}

export function sanitizePreviewHtml(html: string) {
  return html
    .replace(/(<body[^>]*>)\s*"\s*\/>/i, "$1")
    .replace(/^\s*"\s*\/>/gm, "")
    .replace(/>\s*"\s*\/>/g, ">")
    .replace(/"\s*\/>/g, "");
}

export function prepareSrcDoc(html: string, bg: string, projectId = "preview", kind?: string) {
  if (!html) return "";
  const scheme = isLightHex(bg) ? "light" : "dark";
  let next = sanitizePreviewHtml(html);
  if (!/color-scheme/i.test(next)) {
    const meta = `<meta name="color-scheme" content="${scheme}"/>`;
    next = /<head[^>]*>/i.test(next)
      ? next.replace(/<head[^>]*>/i, (open) => `${open}${meta}`)
      : `${meta}${next}`;
  }
  if (!/data-fenix-runtime/.test(next)) {
    const runtime = fenixRuntimeScript(projectId);
    next = /<head[^>]*>/i.test(next)
      ? next.replace(/<head[^>]*>/i, (open) => `${open}${runtime}`)
      : `${runtime}${next}`;
  }
  if (!/data-officina-guard/.test(next)) {
    next = /<\/body>/i.test(next)
      ? next.replace(/<\/body>/i, `${NAV_GUARD}</body>`)
      : `${next}${NAV_GUARD}`;
  }
  if (!/data-fenix-phone/.test(next) && !/data-fenix-site/.test(next)) {
    const kit = looksLikeSite(next, kind) ? SITE_KIT : PHONE_KIT;
    next = /<head[^>]*>/i.test(next)
      ? next.replace(/<head[^>]*>/i, (open) => `${open}${kit}`)
      : `${kit}${next}`;
  }
  return next;
}

