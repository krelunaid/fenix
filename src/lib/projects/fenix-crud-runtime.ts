/** Injected into gestionale HTML. No ${} — product JS, not a template. */
export const DASHBOARD_CRUD_SCRIPT = `<script data-fenix-crud="2">
(function(){
  if (window.__fenixCrud >= 2) return;
  window.__fenixCrud = 2;
  function qsa(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function qs(s, r){ return (r || document).querySelector(s); }
  function txt(el){ return ((el && (el.textContent || (el.getAttribute && el.getAttribute("aria-label")))) || "").replace(/\\s+/g, " ").trim(); }
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
      var key = String(el.name || el.id || "").toLowerCase().replace(/^p-/, "").replace(/^fld-/, "");
      if (!key) {
        var lab = (el.labels && el.labels[0] ? txt(el.labels[0]) : "") || el.getAttribute("placeholder") || "";
        key = lab.toLowerCase().replace(/[^a-z0-9]+/g, "");
      }
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
    data.qty = alias(data, ["qty","quantita","qta","q","amount"], "1");
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
    if (!F || !F.save) return;
    F.save("items", rows);
    F.save("state", { items: rows, rows: rows });
  }
  function readRows(){
    var heads = headers().map(function(h){ return h.toLowerCase(); });
    return qsa("table tbody tr").map(function(tr){
      var obj = {};
      qsa("td", tr).forEach(function(td, i){
        var h = heads[i] || "";
        if (/modifica|elimina|azioni|opz/.test(h)) return;
        var val = (td.textContent || "").trim();
        if (h) obj[h] = val;
        if (i === 0) obj.nome = obj.nome || val;
      });
      return obj;
    }).filter(function(o){ return o.nome && !/modifica|elimina/.test(o.nome); });
  }
  function cellFor(h, data){
    var k = h.toLowerCase();
    if (/nome|pezzo|articolo/.test(k)) return data.nome || "";
    if (/qty|quant/.test(k)) return data.qty || "1";
    if (/prezz|price|euro/.test(k)) return data.prezzo || "";
    if (/stat/.test(k)) return data.stato || "";
    if (/categ|tipo/.test(k)) return data.categoria || "";
    return data[k] || "";
  }
  function rowHtml(data){
    var heads = headers();
    var cells;
    if (heads.length) {
      cells = heads.map(function(h){
        if (/azioni|opz/.test(h.toLowerCase())) {
          return '<td><button type="button">Modifica</button> <button type="button">Elimina</button></td>';
        }
        return "<td>"+String(cellFor(h, data)).replace(/</g,"")+"</td>";
      });
      if (!heads.some(function(h){ return /azioni|opz/.test(h.toLowerCase()); })) {
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
    persist(readRows());
    return true;
  }
  function commitSave(from){
    var root = (from && dlg.contains(from) ? (from.closest("form") || dlg) : dlg);
    var data = collect(root);
    if (!data.nome) return false;
    if (!addOrUpdate(data)) return false;
    var f = root.tagName === "FORM" ? root : qs("form", dlg);
    if (f) try { f.reset(); } catch (err) {}
    closeDlg();
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
      return;
    }
    if (isEdit(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      editTr = t.closest("tr");
      var cells = editTr ? qsa("td", editTr) : [];
      var nomeEl = dlg.querySelector("#p-nome, [name=nome], input:not([type=number]):not([type=hidden])");
      if (nomeEl && cells[0]) nomeEl.value = cells[0].textContent.trim();
      openDlg();
      return;
    }
    if (isSave(t) && (dlg.contains(t) || t.getAttribute("data-fenix") === "save")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      commitSave(t);
    }
  }, true);
  document.addEventListener("submit", function(e){
    var f = e.target;
    if (!f || !(dlg.contains(f) || f.id === "fenix-crud-form")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    commitSave(f);
  }, true);
  function boot(){
    var F = host();
    if (!F || !F.load) return;
    Promise.all([F.load("items"), F.load("state")]).then(function(pair){
      var a = pair[0], st = pair[1];
      var rows = Array.isArray(a) && a.length ? a : (st && (st.items || st.rows));
      if (!Array.isArray(rows) || !rows.length) return;
      var tb = qs("table tbody");
      if (!tb) return;
      tb.innerHTML = rows.map(function(r){
        var d = typeof r === "object" ? r : { nome: String(r) };
        d.nome = d.nome || d.name || "";
        return "<tr data-fenix-row=1>"+rowHtml(d)+"</tr>";
      }).join("");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>`;
