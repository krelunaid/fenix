/** Injected into gestionale HTML. %%COL%% is replaced by dashboardCrudScript. */
const CRUD_TEMPLATE = `<script data-fenix-crud="12">
(function(){
  if (window.__fenixCrud >= 12) return;
  window.__fenixCrud = 12;
  var COL = "%%COL%%";
  function qsa(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function qs(s, r){ return (r || document).querySelector(s); }
  function txt(el){ return ((el && (el.textContent || (el.getAttribute && el.getAttribute("aria-label")))) || "").replace(/\\s+/g, " ").trim(); }
  function fold(s){
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  }
  function classify(k){
    if (/^(nome|name|pezzo|articolo|titolo|label)$/.test(k) || /nome/.test(k)) return "nome";
    if (/^(qta|qty|quantita|q|n|pcs|stock)$/.test(k) || /^(qt|quant)/.test(k)) return "qty";
    if (/^(prezzo|price|importo|euro|eur)$/.test(k) || /prezz/.test(k)) return "prezzo";
    if (/^(categoria|cat|tipo|category)$/.test(k) || /categ/.test(k)) return "categoria";
    if (/^(stato|status|state)$/.test(k) || /^stat/.test(k)) return "stato";
    if (/azioni|opz|edit|modifica/.test(k)) return "azioni";
    return "";
  }
  function kindOf(h){
    var k = fold(h);
    return classify(k) || (k.charAt(0) === "p" ? classify(k.slice(1)) : "") || k;
  }
  function isNew(el){
    var t = txt(el).toLowerCase();
    return /nuovo pezzo|add item|\\+\\s*nuovo/.test(t) || /^(?:\\+|\\+\\s*)?(nuovo|aggiungi|crea)\\b/.test(t);
  }
  function isCancel(el){
    var t = txt(el).toLowerCase();
    return /^(annulla|cancel|chiudi|close|×|x)$/.test(t);
  }
  function isEdit(el){ return /^(modifica|edit|apri)$/.test(txt(el).toLowerCase()); }
  function isDel(el){ return /^(elimina|rimuovi|delete|cancella)$/.test(txt(el).toLowerCase()); }
  function isSave(el){
    var t = txt(el).toLowerCase();
    if (el.getAttribute && el.getAttribute("type") === "submit") return true;
    return /^(salva|aggiungi|registra|conferma)(\\b|$)/.test(t);
  }
  function isNavBtn(el){
    if (!el) return false;
    if (el.getAttribute && (el.getAttribute("data-view") || el.getAttribute("data-go"))) return true;
    if (el.closest && el.closest("nav") && /BUTTON|A/i.test(el.tagName)) return true;
    var t = txt(el).toLowerCase();
    return /^(inventario|dashboard|ordini|clienti|magazzino|home)$/.test(t);
  }
  var dlg = qs("dialog") || qs("[role=dialog]") || qs(".modal, .drawer, .sheet, #modal, #dialog, [data-modal]");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "fenix-sheet";
    dlg.innerHTML = '<form id="fenix-crud-form"><label>Nome</label><input id="p-nome" placeholder="Nome"/><label>Categoria</label><input id="p-categoria" placeholder="Terraglia"/><label>Stato</label><input id="p-stato" placeholder="in laboratorio"/><label>Quantità</label><input id="p-qty" type="number" value="1"/><label>Prezzo</label><input id="p-prezzo" type="number" step="0.01"/><div><button type="button" data-fenix="cancel">Annulla</button><button type="button" data-fenix="save">Salva</button></div></form>';
    document.body.appendChild(dlg);
  }
  var editTr = null;
  var canonical = [];
  var hydrated = false;
  var painting = false;
  var restoreTimer = 0;
  function openDlg(){
    if (dlg.parentNode !== document.body) {
      try { document.body.appendChild(dlg); } catch (e) {}
    }
    dlg.hidden = false;
    dlg.removeAttribute("hidden");
    dlg.classList.add("open", "show", "is-open", "active");
    dlg.setAttribute("open", "");
    dlg.style.display = "block";
    if (typeof dlg.showModal === "function") { try { dlg.showModal(); } catch (e) {} }
    var first = dlg.querySelector("input:not([type=hidden]):not([type=number]), textarea");
    if (first && first.focus) first.focus();
  }
  function closeDlg(){
    if (typeof dlg.close === "function") { try { dlg.close(); } catch (e) {} }
    dlg.removeAttribute("open");
    dlg.hidden = true;
    dlg.setAttribute("hidden", "");
    dlg.classList.remove("open", "show", "is-open", "active");
    dlg.style.display = "none";
    editTr = null;
    scheduleRestore();
  }
  function isComputedHidden(el){
    if (!el) return true;
    try {
      var cs = window.getComputedStyle(el);
      if (!cs) return !!el.hidden;
      var d = String(cs.display || "").toLowerCase();
      var v = String(cs.visibility || "").toLowerCase();
      if (d === "none" || v === "hidden") return true;
    } catch (err) {}
    return false;
  }
  function isDlgOpen(el){
    if (!el) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (isComputedHidden(el)) return false;
    var w = 0, h = 0;
    try {
      var r = el.getBoundingClientRect();
      w = r.width; h = r.height;
    } catch (err) {}
    var flagged =
      el.hasAttribute("open") ||
      (typeof el.open === "boolean" && el.open) ||
      el.classList.contains("open") ||
      el.classList.contains("show") ||
      el.classList.contains("is-open") ||
      el.classList.contains("active");
    if (flagged) return w > 1 && h > 1;
    if (el.hidden) return false;
    return w > 1 && h > 1;
  }
  var watchingDlg = false;
  function watchDlgThenBoot(){
    if (watchingDlg || hydrated || !dlg) return;
    watchingDlg = true;
    function go(){
      if (hydrated) return;
      if (isDlgOpen(dlg)) return;
      watchingDlg = false;
      boot(0);
    }
    dlg.addEventListener("close", go);
    try {
      var mo = new MutationObserver(function(){ if (!isDlgOpen(dlg)) go(); });
      mo.observe(dlg, { attributes: true, attributeFilter: ["hidden", "open", "class", "style", "aria-hidden"] });
    } catch (err) {}
  }
  function alias(data, keys, fallback){
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]]) return data[keys[i]];
    }
    return fallback || "";
  }
  function collect(root){
    var data = {};
    qsa("input, select, textarea", root).forEach(function(el){
      var type = (el.type || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "checkbox") return;
      var key = kindOf(el.name || el.id || (el.labels && el.labels[0] ? txt(el.labels[0]) : "") || el.getAttribute("placeholder") || "");
      var val = String(el.value || "").trim();
      if (key && val) data[key] = val;
    });
    data.nome = alias(data, ["nome","name","titolo","pezzo","articolo","label"], "");
    if (!data.nome) {
      var typed = qsa("input, textarea", root).filter(function(el){
        var type = (el.type || "text").toLowerCase();
        return type !== "number" && type !== "hidden" && type !== "submit" && String(el.value || "").trim();
      })[0];
      if (typed) data.nome = String(typed.value).trim();
    }
    data.qty = alias(data, ["qty","qta","quantita","q","amount"], "1");
    data.prezzo = alias(data, ["prezzo","price","importo","euro"], "");
    data.stato = alias(data, ["stato","status","state"], "in laboratorio");
    data.categoria = alias(data, ["categoria","cat","tipo","category"], "");
    return data;
  }
  function tableHeads(table){
    if (!table) return [];
    var ths = qsa("thead th", table);
    if (ths.length) return ths.map(txt);
    return qsa("tr:first-child th", table).map(txt);
  }
  function host(){ return window.__fenixHost || window.Fenix; }
  var writer = Math.random().toString(36).slice(2, 8);
  var localRev = 0;
  function boxOf(v){
    if (v && typeof v === "object" && v._fenix === 1 && Array.isArray(v.items)) return v;
    if (Array.isArray(v)) return { _fenix: 1, rev: 0, items: v, writer: "", at: 0 };
    if (v && typeof v === "object" && Array.isArray(v.items)) return { _fenix: 1, rev: Number(v.rev)||0, items: v.items, writer: v.writer||"", at: 0 };
    if (v && typeof v === "object" && Array.isArray(v.rows)) return { _fenix: 1, rev: Number(v.rev)||0, items: v.rows, writer: v.writer||"", at: 0 };
    return null;
  }
  function itemsOf(v){
    var b = boxOf(v);
    return b ? b.items : (Array.isArray(v) ? v : null);
  }
  function markBoot(extra){
    try {
      var payload = {
        pid: String((host() && host().projectId) || "").slice(0, 8),
        col: COL,
        writer: writer,
        rev: localRev,
        rows: canonical.length || readAllRows().length,
        epoch: Date.now()
      };
      if (extra) Object.keys(extra).forEach(function(k){ payload[k] = extra[k]; });
      document.documentElement.setAttribute("data-fenix-boot", JSON.stringify(payload));
    } catch (e) {}
  }
  function persist(rows){
    var F = host();
    if (!F || !F.save) return Promise.resolve(false);
    var list = Array.isArray(rows) ? rows.map(asRow) : canonical.slice();
    canonical = list;
    localRev += 1;
    var box = { _fenix: 1, rev: localRev, at: Date.now(), writer: writer, items: list };
    function ackOk(v){
      if (!v || v === false) return 0;
      if (typeof v === "object" && "ok" in v) return v.ok ? (v.durable || list.length) : 0;
      var n = Array.isArray(v) ? v.length : (v && Array.isArray(v.items) ? v.items.length : -1);
      return n >= 0 ? n : 0;
    }
    return Promise.resolve(F.save(COL, box)).then(function(ack){
      var n = ackOk(ack);
      if (ack && typeof ack === "object" && ack.v && typeof ack.v === "object" && ack.v.rev) {
        localRev = Math.max(localRev, Number(ack.v.rev) || 0);
      }
      if (n) {
        markBoot({ save: 1, durable: n, col: COL, n: list.length });
        return n;
      }
      return Promise.resolve(F.save(COL, list)).then(function(ack2){
        var n2 = ackOk(ack2);
        if (ack2 && typeof ack2 === "object" && ack2.v && typeof ack2.v === "object" && ack2.v.rev) {
          localRev = Math.max(localRev, Number(ack2.v.rev) || 0);
        }
        markBoot({ save: 1, durable: n2, col: COL, n: list.length, retry: 1 });
        return n2 ? n2 : false;
      });
    }).catch(function(){ return false; });
  }
  function asRow(r){
    if (!r || typeof r !== "object") return { nome: String(r || ""), qty: "1", prezzo: "0", categoria: "", stato: "" };
    var out = { nome: "", qty: "1", prezzo: "0", categoria: "", stato: "" };
    Object.keys(r).forEach(function(k){
      var kind = kindOf(k);
      if (kind && r[k] != null && r[k] !== "" && kind !== "azioni") out[kind] = String(r[k]);
    });
    out.nome = out.nome || r.nome || r.name || "";
    out.qty = out.qty || r.qty || r.qta || "1";
    out.prezzo = out.prezzo || r.prezzo || r.price || "0";
    return out;
  }
  function inventoryTables(){
    return qsa("table").filter(function(table){
      if (table.closest && table.closest("dialog, .modal, form, [role=dialog]")) return false;
      var heads = tableHeads(table);
      var kinds = heads.map(kindOf);
      if (kinds.some(function(k){ return k === "nome" || k === "qty" || k === "prezzo" || k === "categoria"; })) return true;
      return !!qs("tbody", table);
    });
  }
  function readRowsFromTable(table){
    var heads = tableHeads(table);
    var tb = qs("tbody", table) || table;
    return qsa("tr", tb).map(function(tr){
      return asRow(readRowsFromTr(tr, heads));
    }).filter(function(o){ return o.nome && !/modifica|elimina/.test(o.nome); });
  }
  function readAllRows(){
    var best = [];
    inventoryTables().forEach(function(table){
      var rows = readRowsFromTable(table);
      if (rows.length > best.length) best = rows;
    });
    return best;
  }
  function readRows(){ return canonical.length ? canonical.slice() : readAllRows(); }
  function cellFor(h, data){
    var kind = kindOf(h);
    if (kind === "nome") return data.nome || "";
    if (kind === "qty") return data.qty || "1";
    if (kind === "prezzo") return data.prezzo || "";
    if (kind === "stato") return data.stato || "";
    if (kind === "categoria") return data.categoria || "";
    if (kind === "azioni") return "";
    return data[kind] || "";
  }
  function rowHtmlFor(heads, data){
    var cells;
    if (heads && heads.length) {
      cells = heads.map(function(h){
        if (kindOf(h) === "azioni") {
          return '<td><button type="button">Modifica</button> <button type="button">Elimina</button></td>';
        }
        return "<td>"+String(cellFor(h, data)).replace(/</g,"")+"</td>";
      });
      if (!heads.some(function(h){ return kindOf(h) === "azioni"; }) && heads.length >= 4) {
        cells.push('<td><button type="button">Modifica</button> <button type="button">Elimina</button></td>');
      }
    } else {
      cells = [data.nome, data.categoria, data.stato, data.qty, data.prezzo].map(function(v){
        return "<td>"+String(v || "").replace(/</g,"")+"</td>";
      });
      cells.push('<td><button type="button">Modifica</button> <button type="button">Elimina</button></td>');
    }
    return cells.join("");
  }
  function num(v){
    var s = String(v == null ? "" : v).replace(/€/g, "").replace(/\\s/g, "").trim();
    if (!s) return 0;
    if (/^\\d{1,3}(\\.\\d{3})+(,\\d+)?$/.test(s)) s = s.replace(/\\./g, "").replace(",", ".");
    else if (s.indexOf(",") >= 0 && s.indexOf(".") < 0) s = s.replace(",", ".");
    else s = s.replace(/[^\\d.-]/g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function totals(){
    var rows = canonical.length ? canonical : readAllRows();
    var stock = 0, valore = 0;
    rows.forEach(function(r){
      var q = num(r.qty);
      stock += q;
      valore += q * num(r.prezzo);
    });
    return { pezzi: rows.length, stock: stock, valore: Math.round(valore) };
  }
  function refreshSummary(){
    var t = totals();
    var line = t.pezzi + " pezzi • " + t.stock + " in stock • €" + t.valore;
    function setNum(el, n, fallback){
      var b = el.querySelector("b, strong, em, [data-n]");
      if (b) b.textContent = String(n);
      else el.textContent = fallback;
    }
    var items = qsa(".summary-item, .summary .kpi, .summary > div, [data-summary] > *");
    var hit = 0;
    items.forEach(function(el){
      var s = (el.textContent || "").replace(/\\s+/g, " ").trim();
      if (/pezzi/i.test(s) && /in stock/i.test(s) && /€/.test(s)) {
        el.textContent = line; hit++;
      } else if (/pezzi/i.test(s)) {
        setNum(el, t.pezzi, t.pezzi + " pezzi"); hit++;
      } else if (/in stock/i.test(s)) {
        setNum(el, t.stock, t.stock + " in stock"); hit++;
      } else if (/€/.test(s) || /euro/i.test(s) || /valore/i.test(s)) {
        setNum(el, t.valore, "€" + t.valore); hit++;
      }
    });
    qsa(".summary, [data-summary]").forEach(function(box){
      if (!qsa(".summary-item", box).length) box.textContent = line;
    });
    qsa("p, h2, h3, span, small, .sub, .kpi, .muted").forEach(function(el){
      if (el.closest && el.closest("table, form, dialog, .modal, nav")) return;
      var s = (el.textContent || "").replace(/\\s+/g, " ").trim();
      if (s.length > 90) return;
      if (/\\d+\\s*pezzi/.test(s) && /in stock/i.test(s) && /€/.test(s)) el.textContent = line;
    });
  }
  function hideSaved(){
    var ul = document.getElementById("fk-saved");
    if (ul && ul.parentNode) ul.parentNode.removeChild(ul);
  }
  function looksLikeItems(arr){
    if (!Array.isArray(arr) || !arr.length) return false;
    var n = 0, lim = Math.min(arr.length, 6);
    for (var i = 0; i < lim; i++) {
      var r = arr[i];
      if (r && typeof r === "object" && (r.nome || r.name || r.prezzo || r.price || r.qty || r.qta)) n++;
    }
    return n >= 1;
  }
  function spliceRows(arr, rows){
    var sample = arr[0];
    arr.length = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = asRow(rows[i]);
      if (sample && typeof sample === "object" && !Array.isArray(sample)) {
        var o = {};
        Object.keys(sample).forEach(function(k){
          var kind = kindOf(k);
          if (kind && r[kind] != null && r[kind] !== "") o[k] = r[kind];
          else if (r[k] != null) o[k] = r[k];
        });
        if (!o.nome && !o.name) o.nome = r.nome;
        arr.push(o);
      } else arr.push(r);
    }
  }
  function writeIntoOriginalState(rows){
    var keys = ["items","pezzi","rows","inventory","list"];
    var roots = [window];
    ["S","state","app","store","DB","db","DATA","model","inventory"].forEach(function(k){
      try { if (window[k] && typeof window[k] === "object") roots.push(window[k]); } catch (e) {}
    });
    roots.forEach(function(root){
      keys.forEach(function(k){
        try {
          if (Array.isArray(root[k]) && looksLikeItems(root[k])) spliceRows(root[k], rows);
        } catch (e) {}
      });
    });
  }
  function wrapInnerHTML(){
    if (window.__fenixHtmlWrap) return;
    var desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    if (!desc || !desc.set) return;
    window.__fenixHtmlWrap = 1;
    var set = desc.set;
    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function(v){
        set.call(this, v);
        if (painting || !hydrated) return;
        if (this.closest && this.closest("dialog, .modal, form, [role=dialog]")) return;
        var table = this.tagName === "TABLE" ? this : (this.closest && this.closest("table"));
        var summary = (this.classList && (this.classList.contains("summary") || this.classList.contains("summary-item")))
          || (this.closest && this.closest(".summary, [data-summary]"));
        if (!table && !summary) return;
        restoreNow();
      }
    });
  }
  function paintTable(table, rows){
    var tb = qs("tbody", table);
    if (!tb) return;
    var heads = tableHeads(table);
    tb.innerHTML = (rows || []).map(function(r){
      return "<tr data-fenix-row=1>"+rowHtmlFor(heads, asRow(r))+"</tr>";
    }).join("");
  }
  function paintAll(rows){
    if (painting) return;
    painting = true;
    try {
      inventoryTables().forEach(function(table){ paintTable(table, rows); });
      refreshSummary();
    } finally {
      painting = false;
    }
  }
  function namesOf(rows){
    var o = {};
    (rows || []).forEach(function(r){ var n = fold(asRow(r).nome); if (n) o[n] = 1; });
    return o;
  }
  function domMatchesCanonical(){
    if (!canonical.length) return true;
    var want = namesOf(canonical);
    var tables = inventoryTables();
    if (!tables.length) return true;
    for (var i = 0; i < tables.length; i++) {
      var present = namesOf(readRowsFromTable(tables[i]));
      var missing = 0;
      Object.keys(want).forEach(function(n){ if (!present[n]) missing++; });
      if (missing) return false;
      if (readRowsFromTable(tables[i]).length < canonical.length) return false;
    }
    var t = totals();
    var summaries = qsa(".summary, [data-summary]");
    for (var j = 0; j < summaries.length; j++) {
      var s = (summaries[j].textContent || "").replace(/\\s+/g, " ");
      if (!/pezzi/i.test(s) && !/in stock/i.test(s)) continue;
      if (s.indexOf(String(t.pezzi)) < 0) return false;
      if (/in stock/i.test(s) && s.indexOf(String(t.stock)) < 0) return false;
    }
    return true;
  }
  function applyCanonical(rows){
    canonical = (rows || []).map(asRow).filter(function(r){ return r.nome; });
    hydrated = true;
    wrapInnerHTML();
    writeIntoOriginalState(canonical);
    paintAll(canonical);
    hideSaved();
    markBoot({ boot: 1, n: canonical.length, col: COL, rev: localRev });
  }
  function restoreNow(){
    if (!hydrated || painting) return;
    if (domMatchesCanonical()) return;
    applyCanonical(canonical);
  }
  function scheduleRestore(){
    if (!hydrated) return;
    restoreNow();
    [0, 40, 180, 400].forEach(function(ms){
      setTimeout(restoreNow, ms);
    });
  }
  function startWatch(){
    if (window.__fenixCrudWatch) return;
    window.__fenixCrudWatch = 1;
    wrapInnerHTML();
    try {
      var mo = new MutationObserver(function(){
        if (painting || !hydrated) return;
        if (restoreTimer) clearTimeout(restoreTimer);
        restoreTimer = setTimeout(restoreNow, 24);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (err) {}
    window.addEventListener("hashchange", scheduleRestore);
    window.addEventListener("popstate", scheduleRestore);
    document.addEventListener("click", function(e){
      var t = e.target && e.target.closest ? e.target.closest("button, a, [role=button]") : null;
      if (t && isNavBtn(t)) scheduleRestore();
    }, false);
  }
  function addOrUpdate(data){
    if (!data.nome) return false;
    if (!canonical.length) canonical = readAllRows();
    var i = -1;
    var key = fold(data.nome);
    if (editTr && editTr.parentNode) {
      var fromTr = fold(txt(qs("td", editTr)));
      for (var k = 0; k < canonical.length; k++) if (fold(canonical[k].nome) === fromTr) i = k;
    }
    if (i < 0) {
      for (var k2 = 0; k2 < canonical.length; k2++) if (fold(canonical[k2].nome) === key) i = k2;
    }
    var row = asRow(data);
    if (i >= 0) canonical[i] = Object.assign({}, canonical[i], row);
    else canonical.unshift(row);
    applyCanonical(canonical);
    return persist(canonical);
  }
  function findField(names){
    var nodes = qsa("input, select, textarea", dlg);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var type = (el.type || "").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button") continue;
      var key = kindOf(el.name || el.id || (el.labels && el.labels[0] ? txt(el.labels[0]) : "") || el.getAttribute("placeholder") || "");
      for (var j = 0; j < names.length; j++) {
        if (key === names[j] || key.indexOf(names[j]) >= 0) return el;
      }
    }
    return null;
  }
  function fillForm(data){
    var map = [
      [["nome","name","pezzo","titolo"], data.nome],
      [["categoria","cat","tipo"], data.categoria],
      [["stato","status"], data.stato],
      [["qty","qta","quantita","quant"], data.qty],
      [["prezzo","price","importo"], data.prezzo]
    ];
    map.forEach(function(pair){
      var el = findField(pair[0]);
      if (el && pair[1] != null && pair[1] !== "") el.value = pair[1];
    });
  }
  function commitSave(from){
    var root = (from && dlg.contains(from) ? (from.closest("form") || dlg) : dlg);
    var data = collect(root);
    if (!data.nome) return false;
    var saved = addOrUpdate(data);
    if (!saved) return false;
    var f = root.tagName === "FORM" ? root : qs("form", dlg);
    Promise.resolve(saved).then(function(ok){
      if (ok === false || ok === 0) {
        dlg.setAttribute("data-fenix-save-error", "1");
        dlg.setAttribute("data-fenix-durable", "0");
        return;
      }
      dlg.removeAttribute("data-fenix-save-error");
      dlg.setAttribute("data-fenix-durable", String(ok === true ? rowsHint() : ok));
      if (f) try { f.reset(); } catch (err) {}
      closeDlg();
    });
    return true;
  }
  function rowsHint(){
    try { return canonical.length || readRows().length; } catch (e) { return 1; }
  }
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("button, a, [role=button], input[type=submit]") : null;
    if (!t) return;
    if (isNew(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      editTr = null;
      var f = qs("form", dlg);
      if (f) try { f.reset(); } catch (err) {}
      openDlg();
      return;
    }
    if (isCancel(t) || t.getAttribute("data-fenix") === "cancel") {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeDlg();
      return;
    }
    if (isDel(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var row = t.closest("tr");
      var name = fold(txt(qs("td", row)));
      if (!canonical.length) canonical = readAllRows();
      canonical = canonical.filter(function(r){ return fold(r.nome) !== name; });
      applyCanonical(canonical);
      persist(canonical);
      return;
    }
    if (isEdit(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      editTr = t.closest("tr");
      fillForm(editTr ? asRow(readRowsFromTr(editTr, tableHeads(editTr && editTr.closest("table")))) : {});
      openDlg();
      return;
    }
    if (isSave(t) && (dlg.contains(t) || t.getAttribute("data-fenix") === "save")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      commitSave(t);
      return;
    }
    if (isNavBtn(t)) scheduleRestore();
  }, true);
  function readRowsFromTr(tr, heads){
    heads = heads || tableHeads(tr && tr.closest && tr.closest("table"));
    var obj = {};
    qsa("td", tr).forEach(function(td, i){
      var kind = kindOf((heads && heads[i]) || "");
      var val = (td.textContent || "").trim();
      if (kind && kind !== "azioni") obj[kind] = val;
      if (i === 0) obj.nome = obj.nome || val;
    });
    return obj;
  }
  document.addEventListener("submit", function(e){
    var f = e.target;
    if (!f || !(dlg.contains(f) || f.id === "fenix-crud-form")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    commitSave(f);
  }, true);
  function boot(attempt){
    attempt = attempt || 0;
    if (hydrated && canonical.length) return;
    if (dlg && isDlgOpen(dlg)) {
      if (attempt < 12) {
        setTimeout(function(){ boot(attempt + 1); }, 150);
        return;
      }
      if (isComputedHidden(dlg)) {
        /* CSS-hidden modal without hidden attr: continue boot */
      } else {
        watchDlgThenBoot();
        return;
      }
    }
    var F = host();
    if (!F || !F.load) {
      if (attempt < 25) setTimeout(function(){ boot(attempt + 1); }, 80);
      else { hideSaved(); refreshSummary(); }
      return;
    }
    Promise.resolve(F.load(COL)).then(function(a){
      if (hydrated && canonical.length) return;
      var box = boxOf(a);
      if (box && box.rev) localRev = Math.max(localRev, box.rev);
      var rows = (itemsOf(a) || []).map(asRow).filter(function(r){ return r.nome; });
      hideSaved();
      if (box && box.rev > 0) {
        applyCanonical(rows);
        startWatch();
        return;
      }
      if (rows.length) {
        var current = readAllRows();
        if (current.length > rows.length && !(box && box.rev > 0)) {
          canonical = current;
          hydrated = true;
          applyCanonical(current);
          startWatch();
          return;
        }
        applyCanonical(rows);
        startWatch();
        return;
      }
      if (attempt < 8) {
        setTimeout(function(){ boot(attempt + 1); }, 120);
        return;
      }
      var seed = readAllRows();
      if (seed.length) {
        applyCanonical(seed);
        startWatch();
        return;
      }
      refreshSummary();
    });
  }
  hideSaved();
  refreshSummary();
  setTimeout(function(){ boot(0); }, 0);
})();
</script>`;

export function dashboardCrudScript(collection = "items"): string {
  const col = String(collection || "items").replace(/[^a-zA-Z0-9_-]/g, "") || "items";
  return CRUD_TEMPLATE.replace(/%%COL%%/g, col);
}

export const DASHBOARD_CRUD_SCRIPT = dashboardCrudScript("items");
