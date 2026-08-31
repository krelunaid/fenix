/** Injected into gestionale HTML. No ${} — product JS, not a template. */
export const DASHBOARD_CRUD_SCRIPT = `<script data-fenix-crud="6">
(function(){
  if (window.__fenixCrud >= 6) return;
  window.__fenixCrud = 6;
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
  var dlg = qs("dialog") || qs("[role=dialog]") || qs(".modal, .drawer, .sheet, #modal, #dialog, [data-modal]");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "fenix-sheet";
    dlg.innerHTML = '<form id="fenix-crud-form"><label>Nome</label><input id="p-nome" placeholder="Nome"/><label>Categoria</label><input id="p-categoria" placeholder="Terraglia"/><label>Stato</label><input id="p-stato" placeholder="in laboratorio"/><label>Quantità</label><input id="p-qty" type="number" value="1"/><label>Prezzo</label><input id="p-prezzo" type="number" step="0.01"/><div><button type="button" data-fenix="cancel">Annulla</button><button type="button" data-fenix="save">Salva</button></div></form>';
    document.body.appendChild(dlg);
  }
  var editTr = null;
  function openDlg(){
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
  function headers(){
    return qsa("table thead th").map(function(th){ return txt(th); });
  }
  function host(){ return window.__fenixHost || window.Fenix; }
  function persist(rows){
    var F = host();
    if (!F || !F.save) return Promise.resolve();
    return Promise.all([
      Promise.resolve(F.save("items", rows)),
      Promise.resolve(F.save("state", { items: rows, rows: rows }))
    ]);
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
  function readRows(){
    var heads = headers();
    return qsa("table tbody tr").map(function(tr){
      var obj = {};
      qsa("td", tr).forEach(function(td, i){
        var kind = kindOf(heads[i] || "");
        var val = (td.textContent || "").trim();
        if (kind === "azioni") return;
        if (kind) obj[kind] = val;
        if (i === 0) obj.nome = obj.nome || val;
      });
      return asRow(obj);
    }).filter(function(o){ return o.nome && !/modifica|elimina/.test(o.nome); });
  }
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
  function rowHtml(data){
    var heads = headers();
    var cells;
    if (heads.length) {
      cells = heads.map(function(h){
        if (kindOf(h) === "azioni") {
          return '<td><button type="button">Modifica</button> <button type="button">Elimina</button></td>';
        }
        return "<td>"+String(cellFor(h, data)).replace(/</g,"")+"</td>";
      });
      if (!heads.some(function(h){ return kindOf(h) === "azioni"; })) {
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
    var rows = readRows();
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
    if (hit) return;
    var box = qs(".summary, [data-summary]");
    if (box && !qsa(".summary-item", box).length) {
      box.textContent = line;
      return;
    }
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
  function paint(rows){
    var tb = qs("table tbody");
    if (!tb || !rows || !rows.length) return;
    tb.innerHTML = rows.map(function(r){
      return "<tr data-fenix-row=1>"+rowHtml(asRow(r))+"</tr>";
    }).join("");
  }
  function addOrUpdate(data){
    if (!data.nome) return false;
    var tb = qs("table tbody") || qs("table");
    if (!tb) return false;
    if (editTr && editTr.parentNode) {
      editTr.innerHTML = rowHtml(data);
    } else {
      var tr = document.createElement("tr");
      tr.setAttribute("data-fenix-row", "1");
      tr.innerHTML = rowHtml(data);
      if (tb.tagName === "TABLE") tb.appendChild(tr);
      else tb.insertBefore(tr, tb.firstChild);
    }
    var saved = persist(readRows());
    hideSaved();
    refreshSummary();
    return saved;
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
    Promise.race([
      Promise.resolve(saved),
      new Promise(function(res){ setTimeout(res, 2000); })
    ]).then(function(){
      if (f) try { f.reset(); } catch (err) {}
      closeDlg();
    });
    return true;
  }
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("button, a, [role=button], input[type=submit]") : null;
    if (!t) return;
    if (t.getAttribute && t.getAttribute("data-view")) return;
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
      if (row && row.parentNode) row.parentNode.removeChild(row);
      persist(readRows());
      hideSaved();
      refreshSummary();
      return;
    }
    if (isEdit(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      editTr = t.closest("tr");
      fillForm(editTr ? asRow(readRowsFromTr(editTr)) : {});
      openDlg();
      return;
    }
    if (isSave(t) && (dlg.contains(t) || t.getAttribute("data-fenix") === "save")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      commitSave(t);
    }
  }, true);
  function readRowsFromTr(tr){
    var heads = headers();
    var obj = {};
    qsa("td", tr).forEach(function(td, i){
      var kind = kindOf(heads[i] || "");
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
    if (paintedFromHost) return;
    if (dlg && (dlg.hasAttribute("open") || dlg.classList.contains("open") || !dlg.hidden)) {
      if (attempt < 12) setTimeout(function(){ boot(attempt + 1); }, 150);
      return;
    }
    var F = host();
    if (!F || !F.load) {
      if (attempt < 25) setTimeout(function(){ boot(attempt + 1); }, 80);
      else { hideSaved(); refreshSummary(); }
      return;
    }
    Promise.all([F.load("items"), F.load("state")]).then(function(pair){
      if (paintedFromHost) return;
      var a = pair[0], st = pair[1];
      var rows = Array.isArray(a) && a.length ? a : (st && (Array.isArray(st.items) ? st.items : st.rows));
      hideSaved();
      if (Array.isArray(rows) && rows.length) {
        var current = readRows();
        if (current.length > rows.length) {
          paintedFromHost = true;
          refreshSummary();
          return;
        }
        paint(rows);
        paintedFromHost = true;
        refreshSummary();
        return;
      }
      if (attempt < 8) {
        setTimeout(function(){ boot(attempt + 1); }, 120);
        return;
      }
      refreshSummary();
    });
  }
  var paintedFromHost = false;
  hideSaved();
  refreshSummary();
  setTimeout(function(){ boot(0); }, 0);
})();
</script>`;
