/** Repair gestionali: modal Nuovo/Annulla/Salva + pelle terracotta/cobalto/avorio. */

export const ARGILLA_PALETTE = {
  bg: "#f3eadc",
  surface: "#fbf6ee",
  fg: "#2b211c",
  muted: "#6e5648",
  accent: "#b85c38",
  line: "#d7c4b0",
};

const FAKE_COPY =
  /Fenix 2:\s*Vite \+ React|Vite \+ React|Persistenza via\s*,?\s*|1 schermate/gi;

export function stripFakeStudioCopy(text: string): string {
  return String(text || "")
    .replace(FAKE_COPY, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

export function scrubTechMessages<T extends { content: string }>(messages: T[] = []): T[] {
  return messages
    .map((m) => ({ ...m, content: stripFakeStudioCopy(m.content) }))
    .filter((m) => m.content.length > 1);
}

export function looksLikeBeigeSaas(html: string): boolean {
  const h = String(html || "");
  if (/Barlow Condensed|Fraunces|data-fenix-craft-desk/i.test(h)) return false;
  const beige = /#f5f5f7|#fafafa|#f8f8f8|#ffffff|#f4f4f5|#efe6d4|#f7f1e4/i.test(h);
  const generic = /Inter|Manrope|system-ui|beige|SaaS/i.test(h);
  const fewMarks = (h.match(/<svg/gi) || []).length < 2;
  return (beige && generic) || (beige && fewMarks && /nuovo pezzo|inventario/i.test(h));
}

export const DASHBOARD_CRUD_SCRIPT = `<script data-fenix-crud>
(function(){
  if (window.__fenixCrud) return;
  window.__fenixCrud = 1;
  function qsa(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function qs(s, r){ return (r || document).querySelector(s); }
  function txt(el){ return ((el && (el.textContent || el.getAttribute && el.getAttribute("aria-label"))) || "").replace(/\\s+/g, " ").trim(); }
  function isNew(el){
    var t = txt(el).toLowerCase();
    return /^(?:\\+|\\+\\s*)?(nuovo|aggiungi|crea)\\b|nuovo pezzo|add item/.test(t);
  }
  function isCancel(el){
    var t = txt(el).toLowerCase();
    return /^(annulla|cancel|chiudi|close|×|x)$/.test(t) || t === "×";
  }
  function isEdit(el){
    var t = txt(el).toLowerCase();
    return /^(modifica|edit|apri)$/.test(t);
  }
  function isDel(el){
    var t = txt(el).toLowerCase();
    return /^(elimina|rimuovi|delete|cancella)$/.test(t);
  }
  var dlg = qs("dialog") || qs("[role=dialog]") || qs(".modal, .drawer, .sheet, #modal");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "fenix-sheet";
    dlg.innerHTML = '<form method="dialog" id="fenix-crud-form"><h2>Nuovo</h2><label>Nome</label><input name="nome" required placeholder="Nome"/><label>Quantità</label><input name="qty" placeholder="1"/><div class="fenix-actions"><button type="button" data-fenix="cancel">Annulla</button><button type="submit">Salva</button></div></form>';
    document.body.appendChild(dlg);
  }
  function openDlg(){
    dlg.hidden = false;
    dlg.removeAttribute("hidden");
    dlg.classList.add("open", "show", "is-open", "active");
    dlg.setAttribute("open", "");
    dlg.style.display = "block";
    if (typeof dlg.showModal === "function") { try { dlg.showModal(); } catch (e) {} }
    var first = dlg.querySelector("input, textarea, select");
    if (first && first.focus) first.focus();
  }
  function closeDlg(){
    if (typeof dlg.close === "function") { try { dlg.close(); } catch (e) {} }
    dlg.removeAttribute("open");
    dlg.hidden = true;
    dlg.setAttribute("hidden", "");
    dlg.classList.remove("open", "show", "is-open", "active");
    dlg.style.display = "none";
  }
  function table(){ return qs("table tbody") || qs("table") || qs("[data-list]"); }
  function persist(rows){
    if (!window.Fenix || !window.Fenix.save) return;
    window.Fenix.save("state", { rows: rows });
    window.Fenix.save("items", rows);
  }
  function readRows(){
    var tb = qs("table tbody");
    if (!tb) return [];
    return qsa("tr", tb).map(function(tr){
      return qsa("td", tr).map(function(td){ return (td.textContent || "").trim(); });
    }).filter(function(r){ return r.some(Boolean); });
  }
  function addRow(data){
    var tb = qs("table tbody");
    if (!tb) return;
    var tr = document.createElement("tr");
    var vals = [data.nome || data.name || data.n || "Pezzo", data.qty || data.quantita || "1", data.stato || "in laboratorio"];
    tr.innerHTML = vals.map(function(v){ return "<td>"+String(v).replace(/</g,"")+"</td>"; }).join("") +
      '<td><button type="button">Modifica</button> <button type="button">Elimina</button></td>';
    tb.insertBefore(tr, tb.firstChild);
    persist(readRows());
  }
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest ? e.target.closest("button, a, [role=button]") : null;
    if (!t) return;
    if (t.getAttribute && t.getAttribute("data-view")) return;
    if (isNew(t)) {
      e.preventDefault();
      e.stopPropagation();
      openDlg();
      return;
    }
    if (isCancel(t) || t.getAttribute("data-fenix") === "cancel") {
      e.preventDefault();
      e.stopPropagation();
      closeDlg();
      return;
    }
    if (isDel(t)) {
      var row = t.closest("tr");
      if (row) { row.parentNode.removeChild(row); persist(readRows()); }
      return;
    }
    if (isEdit(t)) {
      e.preventDefault();
      openDlg();
      var row = t.closest("tr");
      var cells = row ? qsa("td", row) : [];
      var nome = dlg.querySelector("[name=nome], input");
      if (nome && cells[0]) nome.value = cells[0].textContent.trim();
      return;
    }
    if ((t.getAttribute("type") === "submit" || /^salva$/i.test(txt(t).toLowerCase())) && (dlg.contains(t) || t.closest("dialog, [role=dialog], .modal"))) {
      e.preventDefault();
      e.stopPropagation();
      var f = t.closest("form") || qs("form", dlg);
      var data = {};
      if (f) {
        try { new FormData(f).forEach(function(v,k){ if(String(v).trim()) data[k]=String(v).trim(); }); } catch (err) {}
        if (!data.nome) {
          var inp = f.querySelector("input");
          if (inp && inp.value) data.nome = String(inp.value).trim();
        }
      }
      if (!data.nome) return;
      addRow(data);
      if (f) try { f.reset(); } catch (err) {}
      closeDlg();
    }
  }, true);
  document.addEventListener("submit", function(e){
    var f = e.target;
    if (!f || !dlg.contains(f) && f.id !== "fenix-crud-form") return;
    e.preventDefault();
    var data = {};
    try { new FormData(f).forEach(function(v,k){ if(String(v).trim()) data[k]=String(v).trim(); }); } catch (err) {}
    if (!data.nome) {
      var inp = f.querySelector("input");
      if (inp && inp.value) data.nome = String(inp.value).trim();
    }
    if (!data.nome) return;
    addRow(data);
    try { f.reset(); } catch (err) {}
    closeDlg();
  }, true);
})();
</script>`;

export function shouldRepairDashboard(html: string, kind?: string): boolean {
  if (kind && kind !== "dashboard") return false;
  if (!html) return false;
  if (/\bfk-tab\b/.test(html)) return false;
  if (/Barlow Condensed/i.test(html) && /#0e0d0b/i.test(html)) return false;
  return /<table/i.test(html) || /nuovo pezzo/i.test(html) || /inventario/i.test(html);
}

export function hasDashboardCrud(html: string): boolean {
  return /data-fenix-crud/.test(html);
}

export function repairDashboardCrud(html: string): string {
  if (!html) return html;
  let next = html.replace(FAKE_COPY, "");
  if (hasDashboardCrud(next)) return next;
  if (/<\/body>/i.test(next)) return next.replace(/<\/body>/i, `${DASHBOARD_CRUD_SCRIPT}</body>`);
  return next + DASHBOARD_CRUD_SCRIPT;
}

const CRAFT_DESK_CSS = `<style data-fenix-craft-desk>
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap");
:root{--bg:#f3eadc;--surface:#fbf6ee;--fg:#2b211c;--muted:#6e5648;--accent:#b85c38;--line:#d7c4b0;--cobalt:#1e3a5f}
html,body{background:var(--bg);color:var(--fg);font:400 15px/1.45 "Source Sans 3",sans-serif}
h1,h2,.brand,header .mark{font-family:"Fraunces",Georgia,serif;color:var(--fg)}
header .mark svg, .fk-appicon{color:var(--accent)}
nav button.on, nav a.on{color:var(--cobalt);border-bottom:2px solid var(--accent)}
table{width:100%;border-collapse:collapse;background:var(--surface)}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
td{padding:10px 12px;border-bottom:1px solid var(--line);color:var(--fg)}
button, .cta{border-radius:2px}
dialog, [role=dialog], .modal{background:var(--surface);color:var(--fg);border:1px solid var(--line);padding:20px 22px;max-width:420px}
</style>`;

const VESSEL_MARK = `<span class="fk-appicon" aria-hidden="true" data-fenix-vessel><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 8h8l-1 11H9L8 8z"/><path d="M9 8V6h6v2"/><path d="M7 8h10"/></svg></span>`;

export function applyCraftDashboardSkin(html: string): string {
  if (!html || /data-fenix-craft-desk/.test(html)) return html;
  if (/Barlow Condensed/i.test(html) && /#0e0d0b/i.test(html)) return html;
  let next = html;
  if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (open) => `${open}${CRAFT_DESK_CSS}`);
  } else {
    next = CRAFT_DESK_CSS + next;
  }
  if (!/data-fenix-vessel/.test(next) && /<header/i.test(next)) {
    next = next.replace(/<header([^>]*)>/i, `<header$1>${VESSEL_MARK}`);
  }
  return next;
}

export function polishDashboardHtml(html: string, kind?: string): string {
  if (!shouldRepairDashboard(html, kind)) return html;
  return repairDashboardCrud(applyCraftDashboardSkin(html));
}
