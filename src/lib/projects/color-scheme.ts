import { dashboardCrudScript, discoverAppCollection, shouldRepairDashboard } from "./dashboard-crud.ts";
import { replaceAppleTabIcons, rewriteIosWidgetHome } from "./craft-icons.ts";
import { scrubCraftMedia } from "../ai/hero-image.ts";

export function isLightHex(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export type SrcPalette = {
  bg?: string;
  surface?: string;
  fg?: string;
  muted?: string;
  accent?: string;
  line?: string;
};

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length >= 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  const m = (i: number) => Math.round(A[i] * (1 - t) + B[i] * t);
  return (
    "#" +
    [m(0), m(1), m(2)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Fill missing tokens from bg luminance so PHONE_KIT never paints dark ink on dark paper. */
export function resolvePalette(input?: string | SrcPalette): Required<SrcPalette> {
  const raw: SrcPalette =
    typeof input === "string" || !input
      ? { bg: typeof input === "string" && input ? input : "#efe6d4" }
      : { ...input };
  const bg = raw.bg || "#efe6d4";
  const light = isLightHex(bg);
  const fg = raw.fg || (light ? "#1c1712" : "#efe6d4");
  const surface =
    raw.surface || (light ? mixHex(bg, "#ffffff", 0.4) : mixHex(bg, "#ffffff", 0.08));
  const muted = raw.muted || (light ? "#5c5348" : "#9a8f7a");
  const accent = raw.accent || "#c45c26";
  const line = raw.line || mixHex(bg, fg, 0.22);
  return { bg, surface, fg, muted, accent, line };
}

export function paletteRootStyle(palette: Required<SrcPalette>): string {
  const p = palette;
  return `<style data-fenix-palette>:root{--bg:${p.bg};--surface:${p.surface};--fg:${p.fg};--muted:${p.muted};--accent:${p.accent};--line:${p.line}}</style>`;
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
html,body{height:100%!important;margin:0;max-width:100%;overflow:hidden;color:var(--fg,#1c1712);background:var(--bg,#efe6d4)}
body{display:flex!important;flex-direction:column!important;min-height:100dvh;max-height:100dvh;font-size:16px;-webkit-font-smoothing:antialiased;touch-action:pan-y}
.fk-top,body>header{flex-shrink:0;padding:14px 16px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.fk-top>div{display:flex;align-items:flex-start;gap:10px;min-width:0}
.fk-appicon{width:36px;height:36px;border-radius:8px;background:var(--fg,#1c1712);color:var(--bg,#efe6d4);display:inline-grid;place-items:center;flex-shrink:0}
.fk-appicon svg{width:20px;height:20px;stroke:currentColor}
.fk-hello{margin:0;font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.15}
.fk-role{margin:4px 0 0;font-size:12px;color:var(--muted,#5c5348);opacity:1}
.fk-date{margin:0 16px 10px;font-size:12px;color:var(--muted,#5c5348)}
.fk-main,body>main,main{
  flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;
  padding:0 16px 28px;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain;
  touch-action:pan-y;
}
.fk-panel{background:var(--surface,#f7f1e4);color:var(--fg,#1c1712);border:1px solid var(--line,#c4b49a);border-radius:4px;padding:16px 14px;margin:0 0 14px}
.fk-panel h2,.fk-panel h3{margin:0 0 12px;font-size:15px;color:var(--fg,#1c1712)}
.fk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line,#c4b49a);border:1px solid var(--line,#c4b49a)}
.fk-stat{background:var(--surface,#f7f1e4);border-radius:0;padding:12px 12px 10px;color:var(--fg,#1c1712)}
.fk-stat b{display:block;font-size:22px;letter-spacing:-.03em;color:var(--fg,#1c1712)}
.fk-stat span{font-size:11px;opacity:.85;color:var(--muted,#5c5348)}
.fk-tile{background:transparent;border:0;border-bottom:1px solid var(--line,#c4b49a);border-radius:0;padding:12px 0}
.fk-tile b{display:block;font-size:18px;margin-top:4px;letter-spacing:-.03em;color:var(--fg,#1c1712)}
.fk-tile span{font-size:12px;color:var(--muted,#5c5348);letter-spacing:.04em;text-transform:uppercase}
.fk-seg{display:flex;background:transparent;border:1px solid var(--line,#c4b49a);border-radius:0;padding:0;gap:0;margin:8px 0 14px}
.fk-seg button{flex:1;border:0;border-right:1px solid var(--line,#c4b49a);background:none;color:var(--fg,#1c1712);border-radius:0;padding:8px 6px;font:600 13px/1 inherit}
.fk-seg button:last-child{border-right:0}
.fk-seg button.on{background:var(--fg,#1c1712);color:var(--bg,#efe6d4);box-shadow:none}
.fk-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:2px;padding:14px 16px;font:700 15px/1 inherit;background:var(--accent,#3d4a1f);color:#fff;letter-spacing:.02em}
.fk-chiprow{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px}
.fk-chip{border:1px solid var(--line,#c4b49a);border-radius:2px;padding:8px 10px;font:650 13px/1 inherit;background:transparent;color:var(--fg,#1c1712)}
.fk-field{display:flex;align-items:center;gap:10px;background:#fbf6ee!important;border:1px solid var(--line,#c4b49a);border-radius:2px;padding:12px 14px;margin:6px 0 14px;color:#1c1712!important}
.fk-field input,.fk-field select,.fk-field textarea,
input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),
textarea,select{
  flex:1;border:0;background:#fbf6ee!important;font:400 16px/1.4 "IBM Plex Sans",system-ui,sans-serif!important;
  color:#1c1712!important;-webkit-text-fill-color:#1c1712!important;caret-color:#1c1712!important;
  outline:none;min-width:0;color-scheme:light!important;opacity:1!important
}
.fk-field input::placeholder,.fk-field textarea::placeholder,
input::placeholder,textarea::placeholder{
  color:#6e5648!important;-webkit-text-fill-color:#6e5648!important;opacity:1!important
}
.fk-lbl{display:block;font-size:11px;font-weight:650;margin:10px 0 0;color:var(--muted,#5c5348);letter-spacing:.08em;text-transform:uppercase}
.fk-sheet{padding:4px 0 8px}
.fk-kicker{margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#5c5348)}
.fk-ledger{margin:12px 0 16px;border-top:1px solid var(--line,#c4b49a)}
.fk-ledger>div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid var(--line,#c4b49a)}
.fk-ledger dt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#5c5348)}
.fk-ledger dd{margin:0;font-size:20px;font-weight:700;letter-spacing:-.03em}
.fk-last{margin:0 0 16px;font-size:14px;color:var(--fg,#1c1712)}
.fk-hero,.fk-hero-craft{width:100%;height:140px;object-fit:cover;border-radius:0;display:block;margin:8px 0 14px;background:var(--line,#c4b49a)}
.fk-tab,.tabbar,nav[aria-label]{
  flex-shrink:0;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;
  height:64px!important;max-height:72px;padding:6px 4px calc(6px + env(safe-area-inset-bottom));
  border-top:1px solid color-mix(in srgb, currentColor 12%, transparent);
  background:var(--bg,#efe6d4);color:var(--muted,#5c5348);
  position:sticky;bottom:0;z-index:20;
}
.fk-tab button,.tabbar button,nav[aria-label] button{
  min-width:0;max-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;margin:0;padding:0 2px!important;border:0;background:none!important;color:inherit;
  font:600 10px/1.1 inherit!important;letter-spacing:.02em;transform:none!important;
}
.fk-tab button.on,.tabbar button.on,nav[aria-label] button.on{color:var(--accent,#3d4a1f)!important;background:none!important;box-shadow:none!important}
.fk-tab svg,.tabbar svg,nav[aria-label] svg,.fk-tab button svg{width:24px!important;height:24px!important;flex:0 0 24px!important;transform:none!important}
.fk-tab span,.tabbar span,nav[aria-label] span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
img[src=""],img:not([src]){display:none!important}
main,.fk-main,main p,main li,main b,.fk-tile,.fk-tile b,.fk-hello,.fk-lbl{color:var(--fg,#1c1712)!important;opacity:1!important}
.fk-role,.fk-date,main .muted,.fk-stat span{color:var(--muted,#5c5348)!important;opacity:1!important}
.fk-btn{color:#fff!important}
</style>`;

const SITE_KIT = `<style data-fenix-site data-fenix-desk>
html,body{height:auto!important;min-height:100%;width:100%!important;margin:0;max-width:none!important;overflow:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;color:var(--fg,#1c1712);background:var(--bg,#efe6d4);font:400 16px/1.5 system-ui,sans-serif}
body{display:block!important;padding:0;overflow:visible!important}
header,body>header,.site-top{padding:16px 24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;position:sticky;top:0;z-index:5;background:var(--surface,#f7f1e4);border-bottom:1px solid var(--line,#c4b49a)}
nav,header nav{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:0;position:static!important;height:auto!important;max-height:none!important;grid-template-columns:none!important;border-top:0!important}
nav a,nav button{border:0;background:none;color:var(--fg,#1c1712);font:650 15px/1.2 system-ui,sans-serif;padding:8px 10px}
.fk-hero,header img, .hero img, img.cover, img.fk-hero, svg.fk-hero, figure.fk-hero{width:100%;height:min(52vh,560px)!important;min-height:280px;object-fit:cover;display:block;border-radius:0;margin:0}
svg.fk-hero{height:min(52vh,560px)!important}
main,body>main{display:block!important;overflow:visible!important;flex:none!important;padding:28px 24px 72px;max-width:1120px;margin:0 auto}
.hero-text h1, main>section:first-of-type h1, .hero h1{font-size:clamp(2.5rem,6vw,4.6rem);letter-spacing:-.03em;line-height:1.08;margin:0 0 12px}
h2{font-size:clamp(1.4rem,3vw,2rem);margin:32px 0 12px}
p,li{opacity:1}
section{margin:0 0 36px}
.card,.fk-tile{background:var(--surface,#f7f1e4);border-radius:8px;padding:16px;margin:0 0 12px;border:1px solid var(--line,#c4b49a);color:var(--fg,#1c1712)}
.gallery, .about{max-width:1120px}
footer{padding:28px 24px;font-size:14px;color:var(--muted,#5c5348)}
img[src=""],img:not([src]){display:none!important}
.fk-tab,.tabbar,nav.bottom-tab,nav.fk-tab{display:none!important}
</style>`;

const DASHBOARD_KIT = `<style data-fenix-site data-fenix-desk>
html,body{height:auto!important;min-height:100%;margin:0;max-width:100%;overflow:auto!important;overflow-x:hidden!important;color:var(--fg,#2b211c);background:var(--bg,#f3eadc);font:400 15px/1.45 "Source Sans 3",system-ui,sans-serif}
body{display:block!important;padding:0}
header,body>header{padding:12px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;border-bottom:1px solid var(--line,#d7c4b0);background:var(--surface,#fbf6ee)}
nav{display:flex;flex-wrap:wrap;gap:4px 8px;padding:0}
nav a,nav button{border:0;background:none;color:var(--muted,#6e5648);font:650 14px/1.2 inherit;padding:8px 10px;border-radius:0;border-bottom:2px solid transparent}
nav button.on,nav a.on{color:var(--cobalt,#1e3a5f);border-bottom-color:var(--accent,#b85c38)}
main,body>main{display:block!important;overflow:visible!important;flex:none!important;padding:22px 24px 64px;max-width:1120px;margin:0 auto}
h1{font-family:"Fraunces",Georgia,serif;font-size:28px;letter-spacing:-.02em;margin:0 0 8px;color:var(--fg,#2b211c)}
h2{font-size:18px;margin:20px 0 10px}
table{width:100%;border-collapse:collapse;background:var(--surface,#fbf6ee)}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line,#d7c4b0);color:var(--fg,#2b211c)}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#6e5648)}
.card,.fk-tile{background:var(--surface,#fbf6ee);border-radius:4px;padding:16px;margin:0 0 12px;border:1px solid var(--line,#d7c4b0);color:var(--fg,#2b211c)}
button,.cta{border-radius:2px}
dialog,[role=dialog],.modal{background:var(--surface,#fbf6ee);color:var(--fg,#2b211c);border:1px solid var(--line,#d7c4b0);padding:20px 22px}
input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),
textarea,select{
  background:#fbf6ee!important;color:#1c1712!important;-webkit-text-fill-color:#1c1712!important;
  caret-color:#1c1712!important;color-scheme:light!important;font-size:16px!important;opacity:1!important
}
input::placeholder,textarea::placeholder{color:#6e5648!important;-webkit-text-fill-color:#6e5648!important;opacity:1!important}
img[src=""],img:not([src]){display:none!important}
</style>`;

export function looksLikeSite(html: string, kind?: string) {
  if (kind === "dashboard" || kind === "site" || kind === "landing") return true;
  if (kind === "app") return false;
  if (/fk-tab|data-view=["']home["']|data-view=["']list["']/i.test(html)) return false;
  return /<footer/i.test(html) || (/<nav/i.test(html) && /href=/i.test(html));
}

export function fenixRuntimeScript(projectId: string, kind?: string) {
  return `<script data-fenix-runtime>
(function(){
  var pid = ${JSON.stringify(projectId)};
  var desk = ${kind === "site" || kind === "landing" || kind === "dashboard" ? "true" : "false"};
  var unwrapBoxes = ${kind === "site" || kind === "landing" ? "true" : "false"};
  var memoryStorage = {};
  var ls = {
    getItem: function(key){ return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null; },
    setItem: function(key, value){ memoryStorage[key] = String(value); },
    removeItem: function(key){ delete memoryStorage[key]; },
    clear: function(){ memoryStorage = {}; },
    key: function(index){ return Object.keys(memoryStorage)[index] || null; },
    get length(){ return Object.keys(memoryStorage).length; }
  };
  function reportBootError(err, kind){
    var msg = "";
    try { msg = err && err.message ? String(err.message) : String(err || "errore"); } catch (e) { msg = "errore"; }
    try { document.documentElement.setAttribute("data-fenix-boot-error", msg.slice(0, 240)); } catch (e) {}
    try {
      window.parent && window.parent.postMessage({
        t: "fenix-boot-error",
        projectId: pid,
        message: msg.slice(0, 400),
        stack: err && err.stack ? String(err.stack).slice(0, 800) : "",
        kind: kind || "error"
      }, "*");
    } catch (e) {}
  }
  try {
    var ET = typeof EventTarget !== "undefined" ? EventTarget.prototype : null;
    if (ET && ET.addEventListener && !ET.__fenixReadyWrap) {
      ET.__fenixReadyWrap = 1;
      var origAdd = ET.addEventListener;
      ET.addEventListener = function(type, fn, opts){
        if (typeof fn === "function" && (type === "DOMContentLoaded" || (type === "load" && (this === window || this === document)))) {
          var wrapped = function(ev){
            try { return fn.call(this, ev); }
            catch (err) { reportBootError(err, "error"); }
          };
          return origAdd.call(this, type, wrapped, opts);
        }
        return origAdd.call(this, type, fn, opts);
      };
    }
  } catch (e) {}
  window.onerror = function(m, _s, _l, _c, err){
    var msg = err && err.message ? String(err.message) : String(m || "");
    if (!msg || /^error$/i.test(msg.trim()) || msg === "Script error.") {
      if (!(err && err.message && err.message !== "error" && msg !== "Script error.")) return true;
    }
    reportBootError(err || new Error(msg || "errore in avvio"), "error");
    return true;
  };
  window.addEventListener("error", function(ev){
    if (ev && ev.target && ev.target !== window && ev.target.nodeType === 1) {
      var node = ev.target;
      if (node.tagName === "IMG") {
        try {
          node.setAttribute("data-fenix-img", "broken");
          node.removeAttribute("src");
        } catch (e) {}
      }
      return;
    }
    var err = ev && ev.error;
    var msg = err && err.message ? String(err.message) : String((ev && ev.message) || "");
    if (!msg || /^error$/i.test(msg.trim())) return;
    reportBootError(err || new Error(msg), "error");
    try { ev.preventDefault(); } catch (e) {}
  }, true);
  window.addEventListener("unhandledrejection", function(ev){
    var r = ev.reason;
    var msg = r && r.message ? String(r.message) : String(r || "unhandledrejection");
    reportBootError(r instanceof Error ? r : new Error(msg), "unhandledrejection");
    try { ev.preventDefault(); } catch (e) {}
  });
  try {
    var sc = document.querySelector("main") || document.getElementById("main") || document.body;
    sc.style.overflowY = "scroll";
    sc.style.webkitOverflowScrolling = "touch";
    sc.style.minHeight = "0";
    sc.style.flex = "1 1 0%";
  } catch (e) {}
  function localKey(col){ return "fenix-db:"+pid+":"+col; }
  function fallbackLoad(col){
    try { return JSON.parse(ls.getItem(localKey(col)) || "null"); }
    catch(e){ return null; }
  }
  function fallbackSave(col, data){
    try { ls.setItem(localKey(col), JSON.stringify(data)); } catch(e){}
    return data;
  }
  function emptyVal(v){
    if (v == null || v === "") return true;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }
  function unwrapLoad(v){
    if (!unwrapBoxes) return v;
    if (v && typeof v === "object" && v._fenix === 1 && Array.isArray(v.items)) return v.items;
    return v;
  }
  function pickLoad(v, col){
    var parent = unwrapLoad(v);
    var local = unwrapLoad(fallbackLoad(col));
    if (emptyVal(parent) && !emptyVal(local)) return local;
    return emptyVal(parent) ? local : parent;
  }
  var inflight = 0;
  function call(op, col, data){
    if (!window.parent || window.parent === window) {
      return Promise.resolve(op === "load" ? unwrapLoad(fallbackLoad(col)) : fallbackSave(col, data));
    }
    var id = Math.random().toString(36).slice(2);
    inflight += 1;
    return new Promise(function(resolve){
      var done = false;
      function finish(v){
        if (done) return;
        done = true;
        inflight = Math.max(0, inflight - 1);
        window.removeEventListener("message", on);
        resolve(op === "load" ? pickLoad(v, col) : unwrapSave(v));
      }
      function unwrapSave(v){
        if (v && typeof v === "object" && "ok" in v) return v;
        if (v === false || v == null) return { ok: false, v: null, durable: 0 };
        return { ok: true, v: v, durable: Array.isArray(v) ? v.length : 0 };
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
        if (done) return;
        try {
          window.parent.postMessage({ t:"fenix-db", id:id, op:op, projectId:pid, col:col, data:data }, "*");
        } catch(err) {}
      }, 400);
      setTimeout(function(){
        if (done) return;
        if (op === "load") finish(fallbackLoad(col));
        else finish({ ok: false, v: null, durable: 0 });
      }, 2500);
    });
  }
  var api = {
    projectId: pid,
    load: function(col){ return call("load", col); },
    save: function(col, data){ fallbackSave(col, data); return call("save", col, data); },
    ready: function(){ document.documentElement.setAttribute("data-fenix-ready","1"); }
  };
  try {
    Object.defineProperty(window, "__fenixHost", { value: api, writable: false, configurable: false });
  } catch (e) { window.__fenixHost = api; }
  try {
    Object.defineProperty(window, "Fenix", {
      configurable: true,
      enumerable: true,
      get: function(){ return api; },
      set: function(){ /* product stub cannot clobber host load/save */ }
    });
  } catch (e) { window.Fenix = api; }
  function audit(){
    try {
      var tabs = document.querySelectorAll("[data-view], [data-tab], .tabbar button, nav.tabs button, .tabs button, nav[aria-label] button").length;
      window.parent && window.parent.postMessage({
        t: "fenix-audit",
        svgs: document.querySelectorAll("svg").length,
        tabs: tabs,
        forms: document.querySelectorAll("form").length,
        inputs: document.querySelectorAll("input, select, textarea").length,
        hasIcon: !!document.querySelector("link[rel=icon]"),
        title: document.title || "",
        vw: window.innerWidth,
        sw: document.documentElement.scrollWidth,
        mainChars: ((document.querySelector("main") || document.body).innerText || "").trim().length
      }, "*");
    } catch (err) {}
  }
  if (document.readyState === "complete") setTimeout(audit, 40);
  else window.addEventListener("load", function(){ setTimeout(audit, 40); });
  var okTries = 0;
  function emitBootOk(){
    if (document.documentElement.getAttribute("data-fenix-boot-error")) return;
    if (inflight > 0 && okTries < 100) {
      okTries += 1;
      setTimeout(emitBootOk, 50);
      return;
    }
    try { document.documentElement.setAttribute("data-fenix-boot-ok", "1"); } catch (e) {}
    try {
      window.parent && window.parent.postMessage({ t: "fenix-boot-ok", projectId: pid }, "*");
    } catch (e) {}
  }
  function armBootOk(){
    function go(){
      setTimeout(function(){
        if (!document.documentElement.getAttribute("data-fenix-boot-error")) emitBootOk();
      }, 600);
    }
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go);
  }
  armBootOk();
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
  function waitReady(cb){
    if (document.documentElement.getAttribute("data-fenix-ready")) { cb(); return; }
    var n = 0;
    var t = setInterval(function(){
      n += 1;
      if (document.documentElement.getAttribute("data-fenix-ready") || n > 40) {
        clearInterval(t);
        cb();
      }
    }, 50);
  }
  var hs = document.createElement("script");
  hs.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  hs.onload = function(){ waitReady(function(){ shoot(); }); };
  hs.onerror = function(){ sendShot(""); };
  document.head.appendChild(hs);
  document.querySelectorAll("nav button, .fk-tab button, .tabbar button").forEach(function(b){
    b.setAttribute("type", "button");
  });
  if (desk) return;
  var items = [];
  function listEl(){
    if (document.querySelector("table thead") && document.querySelector("table tbody")) return null;
    if (window.__fenixCrud) return null;
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
    if (!ul) return;
    if (!items.length) {
      if (ul && ul.id === "fk-saved") ul.innerHTML = '<li class="fk-tile" style="color:#1c1712">Nessun elemento. Compila il form e salva.</li>';
      return;
    }
    var hero = document.querySelector(".fk-hero, img.cover, header img");
    var heroSrc = hero && hero.getAttribute("src");
    ul.innerHTML = items.map(function(it){
      var src = it.foto || it.img || it.image || heroSrc || "";
      var pic = src
        ? '<img src="'+src+'" alt="" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:12px;flex-shrink:0"/>'
        : "";
      return '<li class="fk-tile" style="display:flex;align-items:center;gap:12px;color:#1c1712;background:#f7f1e4;border:1px solid #c4b49a;border-radius:14px;padding:10px 12px">'+pic+'<b style="color:#1c1712">'+labelOf(it)+'</b></li>';
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
    if (window.__fenixCrud) return;
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
  // Strip leaked `" />` tokens from broken LLM markup, never attribute
  // closers on SVG/void tags (`stroke-width="2.2"/>`).
  return html
    .replace(/(<body[^>]*>)\s*"\s*\/>/i, "$1")
    .replace(/^\s*"\s*\/>/gm, "")
    .replace(/>\s*"\s*\/>/g, ">");
}

function markupWithoutStyleOrScript(html: string) {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
}

const FK_CSS_SEL =
  /\.fk-(hello|tab|sheet|main|top|btn|appicon|role|date|ledger|tile|stat|panel|field|lbl|kicker|chip|hero|seg)\b/;

const ESCAPED_STYLE = /\u0026lt;\/?style/i;

/**
 * Phone-kit / product CSS dumped into the DOM as text (missing or escaped
 * <style>). Visible as `.fk-hello {…}` in the preview.
 */
export function looksLikeLeakedCss(html: string): boolean {
  const text = String(html || "");
  if (ESCAPED_STYLE.test(text)) return true;
  const markup = markupWithoutStyleOrScript(text);
  return FK_CSS_SEL.test(markup) && /\{\s*[\w-]+\s*:/.test(markup);
}

/** Inner of main/template is a CSS dump, not markup. */
export function looksLikeCssDump(inner: string): boolean {
  const s = String(inner || "").trim();
  if (!s) return false;
  const withoutStyle = s
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?style\b[^>]*>/gi, " ")
    .trim();
  if (!withoutStyle || /<[a-z]/i.test(withoutStyle)) return false;
  return FK_CSS_SEL.test(withoutStyle) && /\{\s*[\w-]+\s*:/.test(withoutStyle);
}

const CSS_RUN =
  /(?:html\s*,\s*body|:root|\.fk-[\w-]+)[^{]*\{[^{}]*\}(?:\s*(?:html|body|main|header|nav|img|button|input|textarea|select|svg|span|p|h[1-6]|:root|\.[\w-]+|\*|\[(?:data-|aria-|src)[^\]]+\]|:{1,2}[\w()-]+)[^{]*\{[^{}]*\})*/gi;

function splitStyleScript(html: string) {
  const chunks: { code: boolean; text: string }[] = [];
  const re = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index > last) chunks.push({ code: false, text: html.slice(last, m.index) });
    chunks.push({ code: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < html.length) chunks.push({ code: false, text: html.slice(last) });
  return chunks;
}

function injectRescued(html: string, rescued: string) {
  if (!rescued) return html;
  const tag = `<style data-fenix-rescued>${rescued}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${tag}`);
  }
  return `${tag}${html}`;
}

/** Move orphan .fk-* CSS out of body/main into a real <style> in <head>. */
export function repairLeakedCss(html: string): string {
  let next = String(html || "");
  if (!next) return next;
  if (ESCAPED_STYLE.test(next)) {
    next = next.replace(/\u0026lt;(\/?style\b[^&]*)(?:\u0026gt;|>)/gi, "<$1>");
    next = next.replace(/\u0026lt;\/style(?:\u0026gt;|>)/gi, "</style>");
  }
  if (!looksLikeLeakedCss(next)) return next;

  let rescued = "";
  next = next.replace(
    /<(main|template)(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (all, tag: string, attrs: string, inner: string) => {
      if (!looksLikeCssDump(inner)) return all;
      rescued += `${inner}\n`;
      return `<${tag}${attrs}></${tag}>`;
    },
  );
  if (!looksLikeLeakedCss(next)) return injectRescued(next, rescued);

  const rebuilt = splitStyleScript(next)
    .map((chunk) => {
      if (chunk.code) return chunk.text;
      return chunk.text.replace(CSS_RUN, (block) => {
        if (!FK_CSS_SEL.test(block) && !/\.fk-/.test(block)) return block;
        rescued += `${block}\n`;
        return "\n";
      });
    })
    .join("");
  if (!rescued) return next;
  return injectRescued(rebuilt, rescued);
}


/**
 * HTML parser closes <script> at the first </script>, even inside a JS string.
 * That yields `SyntaxError: missing ) after argument list` on about:srcdoc.
 * Escape those embedded closers; leave the real tag intact.
 */
export function escapeEmbeddedScriptEnds(html: string): string {
  const src = String(html || "");
  if (!/<script/i.test(src)) return src;
  let out = "";
  const lower = src.toLowerCase();
  let i = 0;
  while (i < src.length) {
    const open = lower.indexOf("<script", i);
    if (open < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, open);
    const tagEnd = src.indexOf(">", open);
    if (tagEnd < 0) {
      out += src.slice(open);
      break;
    }
    const openTag = src.slice(open, tagEnd + 1);
    out += openTag;
    if (/\bsrc\s*=/i.test(openTag) || /\/\s*>$/.test(openTag)) {
      i = tagEnd + 1;
      continue;
    }
    const scanned = scanScriptBody(src, tagEnd + 1);
    out += scanned.body + scanned.closer;
    i = scanned.end;
  }
  return out;
}

function scanScriptBody(html: string, start: number): { body: string; closer: string; end: number } {
  let i = start;
  let body = "";
  let quote: string | null = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  while (i < html.length) {
    const ch = html[i];
    const two = html.slice(i, i + 2);
    if (quote) {
      if (escaped) {
        body += ch;
        escaped = false;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        body += ch;
        escaped = true;
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
        body += ch;
        i += 1;
        continue;
      }
      if (html.slice(i, i + 8).toLowerCase() === "</script") {
        body += "<\\/script";
        i += 8;
        continue;
      }
      body += ch;
      i += 1;
      continue;
    }
    if (lineComment) {
      body += ch;
      if (ch === "\n") lineComment = false;
      i += 1;
      continue;
    }
    if (blockComment) {
      body += ch;
      if (two === "*/") {
        body += html[i + 1] || "";
        i += 2;
        blockComment = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (two === "//") {
      lineComment = true;
      body += two;
      i += 2;
      continue;
    }
    if (two === "/*") {
      blockComment = true;
      body += two;
      i += 2;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      body += ch;
      i += 1;
      continue;
    }
    if (html.slice(i, i + 8).toLowerCase() === "</script") {
      const closeEnd = html.indexOf(">", i);
      const closer = closeEnd >= 0 ? html.slice(i, closeEnd + 1) : html.slice(i);
      return { body, closer, end: closeEnd >= 0 ? closeEnd + 1 : html.length };
    }
    body += ch;
    i += 1;
  }
  return { body, closer: "", end: html.length };
}

function previewOrigin() {
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin !== "null") {
      return String(window.location.origin || "").replace(/\/$/, "");
    }
  } catch {
    /* opaque frame */
  }
  return "";
}

/** srcdoc has opaque origin: relative /craft-hero.jpg would not load. */
export function absolutizeCraftHero(html: string, origin = previewOrigin()) {
  if (!html) return html;
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) return html;
  return html.replace(/(src=["'])\/craft-hero\.jpg/gi, `$1${base}/craft-hero.jpg`);
}

export function prepareSrcDoc(
  html: string,
  bgOrPalette: string | SrcPalette = "#ffffff",
  projectId = "preview",
  kind?: string,
) {
  if (!html) return "";
  const palette = resolvePalette(bgOrPalette);
  const bg = palette.bg;
  const scheme = isLightHex(bg) ? "light" : "dark";
  let next = sanitizePreviewHtml(html);
  next = repairLeakedCss(next);
  next = scrubCraftMedia(next);
  next = rewriteIosWidgetHome(replaceAppleTabIcons(next));
  if (!/color-scheme/i.test(next)) {
    const meta = `<meta name="color-scheme" content="${scheme}"/>`;
    next = /<head[^>]*>/i.test(next)
      ? next.replace(/<head[^>]*>/i, (open) => `${open}${meta}`)
      : `${meta}${next}`;
  }
  if (/data-fenix-runtime/.test(next)) {
    next = next.replace(/<script[^>]*data-fenix-runtime[^>]*>[\s\S]*?<\/script>/gi, "");
  }
  {
    const runtime = fenixRuntimeScript(projectId, kind);
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
    const kit = kind === "dashboard" ? DASHBOARD_KIT : looksLikeSite(next, kind) ? SITE_KIT : PHONE_KIT;
    next = /<head[^>]*>/i.test(next)
      ? next.replace(/<head[^>]*>/i, (open) => `${open}${kit}`)
      : `${kit}${next}`;
  }
  if (shouldRepairDashboard(html, kind) && !/data-fenix-crud="12"/.test(next)) {
    next = next.replace(/<script[^>]*data-fenix-crud[^>]*>[\s\S]*?<\/script>/gi, "");
    const crud = dashboardCrudScript(discoverAppCollection(html));
    next = /<\/body>/i.test(next)
      ? next.replace(/<\/body>/i, `${crud}</body>`)
      : `${next}${crud}`;
  }
  // Last :root in <head> so the kit's var(--fg,#1c1712) resolves to the
  // project ink, not the phone-kit paper default, after authored CSS.
  if (!/data-fenix-palette/.test(next)) {
    const pal = paletteRootStyle(palette);
    next = /<\/head>/i.test(next)
      ? next.replace(/<\/head>/i, `${pal}</head>`)
      : `${pal}${next}`;
  }
  return escapeEmbeddedScriptEnds(absolutizeCraftHero(next));
}
