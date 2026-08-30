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

export function fenixRuntimeScript(projectId: string) {
  return `<script data-fenix-runtime>
(function(){
  var pid = ${JSON.stringify(projectId)};
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
      var tabs = document.querySelectorAll("[data-view], [data-tab], .tabbar button, nav.tabs button, .tabs [data-view]").length;
      window.parent && window.parent.postMessage({
        t: "fenix-audit",
        svgs: document.querySelectorAll("svg").length,
        tabs: tabs,
        forms: document.querySelectorAll("form").length,
        inputs: document.querySelectorAll("input, select, textarea").length,
        hasIcon: !!document.querySelector("link[rel='icon'], link[rel=\"icon\"]"),
        title: document.title || ""
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
      window.html2canvas(document.documentElement, { scale: 0.42, useCORS: true, logging: false }).then(function(c){
        sendShot(c.toDataURL("image/jpeg", 0.55));
      }).catch(function(){ sendShot(""); });
    } catch (e) { sendShot(""); }
  }
  var hs = document.createElement("script");
  hs.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  hs.onload = function(){ setTimeout(shoot, 80); };
  hs.onerror = function(){ sendShot(""); };
  document.head.appendChild(hs);
})();
</script>`;
}

export function prepareSrcDoc(html: string, bg: string, projectId = "preview") {
  if (!html) return "";
  const scheme = isLightHex(bg) ? "light" : "dark";
  let next = html;
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
  return next;
}
