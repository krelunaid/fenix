/**
 * Ten premium products: 5 realistic briefs × 2 variants.
 * Editorial D/T, domain SVG, original identities. Hand-authored gold standard
 * for the graphic gate — not a vote of Emergent parity.
 */
import { formatPrefix } from "../projects/infer.ts";
import { tokensFromBrief, type TokenFamily } from "../projects/design-tokens.ts";
import { domainIllustration, altForBrief } from "./domain-imagery.ts";
import { craftNavIcon } from "../projects/craft-icons.ts";
import type { ProjectKind } from "../projects/types.ts";

export type PremiumFixtureId =
  | "lumiere-or"
  | "vetro-nebbia"
  | "sfilata-inchiostro"
  | "atelier-osso"
  | "sala-giardini"
  | "studio-lino"
  | "nord-ledger"
  | "orto-flusso"
  | "taglia"
  | "metro-tasca";

type Row = { id: string; title: string; kicker: string; note: string; meta: string };

type Spec = {
  id: PremiumFixtureId;
  family: TokenFamily;
  kind: ProjectKind;
  name: string;
  kicker: string;
  place: string;
  collection: string;
  brief: string;
  tabs: { id: string; label: string }[];
  rows: Row[];
  formTitle: string;
  cta: string;
  extra?: string;
};

const SPECS: Spec[] = [
  {
    id: "lumiere-or",
    family: "perfume",
    kind: "app",
    name: "Maison Lumière",
    kicker: "Parfums · Milano",
    place: "via Montebello 9",
    collection: "essenze",
    brief: `${formatPrefix("app")}Maison Lumière: gestione profumi premium, flaconi, note olfattive e guardaroba.`,
    tabs: [
      { id: "collezione", label: "Collezione" },
      { id: "note", label: "Piramide" },
      { id: "atelier", label: "Atelier" },
      { id: "pelle", label: "Pelle" },
    ],
    rows: [
      { id: "e1", title: "Bois de Nuit", kicker: "legnosa", note: "vetiver, fumo, cedro", meta: "50 ml" },
      { id: "e2", title: "Acqua Chiara", kicker: "citrica", note: "bergamotto, tè bianco", meta: "30 ml" },
      { id: "e3", title: "Fleur Ambrée", kicker: "orientale", note: "ambra, rosa, vaniglia", meta: "100 ml" },
    ],
    formTitle: "Componi una formula",
    cta: "Registra in collezione",
  },
  {
    id: "vetro-nebbia",
    family: "perfume",
    kind: "app",
    name: "Vetro di Nebbia",
    kicker: "Ghiaccio · Trieste",
    place: "molo Audace 2",
    collection: "essenze",
    brief: `${formatPrefix("app")}Vetro di Nebbia: gestione profumi premium, flaconi di vetro, note di ghiaccio e nebbia.`,
    tabs: [
      { id: "collezione", label: "Vetrina" },
      { id: "note", label: "Accordi" },
      { id: "atelier", label: "Laboratorio" },
      { id: "pelle", label: "Polso" },
    ],
    rows: [
      { id: "e1", title: "Sale Adriatico", kicker: "marina", note: "alghe, sale, cedro bianco", meta: "50 ml" },
      { id: "e2", title: "Nebbia Bora", kicker: "fresca", note: "ghiaccio, tè, vetro", meta: "30 ml" },
      { id: "e3", title: "Pino di Opicina", kicker: "boschiva", note: "pino, resina, aria", meta: "75 ml" },
    ],
    formTitle: "Nuovo accordo",
    cta: "Metti in vetrina",
  },
  {
    id: "sfilata-inchiostro",
    family: "fashion",
    kind: "app",
    name: "Sfilata",
    kicker: "Atelier · SS26",
    place: "via della Spiga 14",
    collection: "capi",
    brief: `${formatPrefix("app")}Sfilata Atelier: moda e vendite, lookbook, capi in passerella e cassa.`,
    tabs: [
      { id: "lookbook", label: "Look" },
      { id: "vendite", label: "Cassa" },
      { id: "clienti", label: "Clienti" },
      { id: "atelier", label: "Taglio" },
    ],
    rows: [
      { id: "c1", title: "Cappotto inchiostro", kicker: "M", note: "in passerella", meta: "€890" },
      { id: "c2", title: "Abito carminio", kicker: "S", note: "venduto", meta: "€640" },
      { id: "c3", title: "Pantalone carta", kicker: "L", note: "in atelier", meta: "€320" },
    ],
    formTitle: "Nuovo capo",
    cta: "Metti in passerella",
  },
  {
    id: "atelier-osso",
    family: "fashion",
    kind: "app",
    name: "Atelier Osso",
    kicker: "Cucito · Firenze",
    place: "via dei Servi 7",
    collection: "capi",
    brief: `${formatPrefix("app")}Atelier Osso: moda e vendite, lookbook in avorio, capi in osso e cassa.`,
    tabs: [
      { id: "lookbook", label: "Tela" },
      { id: "vendite", label: "Libro" },
      { id: "clienti", label: "Signore" },
      { id: "atelier", label: "Cucito" },
    ],
    rows: [
      { id: "c1", title: "Colonna avorio", kicker: "38", note: "prova", meta: "€720" },
      { id: "c2", title: "Cappotto latte", kicker: "40", note: "in sfilata", meta: "€980" },
      { id: "c3", title: "Gonna osso", kicker: "36", note: "consegnata", meta: "€410" },
    ],
    formTitle: "Nuova tela",
    cta: "Metti in prova",
  },
  {
    id: "sala-giardini",
    family: "booking",
    kind: "app",
    name: "Sala delle Ore",
    kicker: "Trattamenti",
    place: "via dei Giardini 4",
    collection: "prenotazioni",
    brief: `${formatPrefix("app")}Sala delle Ore: prenotazioni di un servizio, agenda, trattamenti e studio.`,
    tabs: [
      { id: "oggi", label: "Oggi" },
      { id: "prenota", label: "Prenota" },
      { id: "agenda", label: "Agenda" },
      { id: "studio", label: "Studio" },
    ],
    rows: [
      { id: "p1", title: "Marta V.", kicker: "09:30", note: "Taglio e piega", meta: "45 min" },
      { id: "p2", title: "Luca B.", kicker: "11:00", note: "Barba e olio", meta: "30 min" },
      { id: "p3", title: "Elena S.", kicker: "16:00", note: "Colore radici", meta: "75 min" },
    ],
    formTitle: "Prenota la sala",
    cta: "Conferma prenotazione",
  },
  {
    id: "studio-lino",
    family: "booking",
    kind: "app",
    name: "Studio Lino",
    kicker: "Tessile · Parma",
    place: "strada della Repubblica 12",
    collection: "prenotazioni",
    brief: `${formatPrefix("app")}Studio Lino: prenotazioni di un servizio di tessile, agenda, trattamenti su lino.`,
    tabs: [
      { id: "oggi", label: "Telaio" },
      { id: "prenota", label: "Prenota" },
      { id: "agenda", label: "Settimana" },
      { id: "studio", label: "Taglio" },
    ],
    rows: [
      { id: "p1", title: "Chiara M.", kicker: "10:00", note: "Orlo pantalone", meta: "40 min" },
      { id: "p2", title: "Paolo R.", kicker: "12:30", note: "Giacca su misura", meta: "90 min" },
      { id: "p3", title: "Nina F.", kicker: "17:00", note: "Lino da tavola", meta: "50 min" },
    ],
    formTitle: "Prenota il telaio",
    cta: "Conferma orario",
  },
  {
    id: "nord-ledger",
    family: "ops",
    kind: "app",
    name: "Nord Ledger",
    kicker: "Vendite · Oslo desk",
    place: "pipeline Q3",
    collection: "righe",
    brief: `${formatPrefix("dashboard")}Nord Ledger: cruscotto vendite, kpi di vendita, pipeline vendite e ledger commerciale.`,
    tabs: [
      { id: "pipeline", label: "Pipeline" },
      { id: "nuovo", label: "Nuova riga" },
      { id: "numeri", label: "KPI" },
      { id: "rischi", label: "Rischi" },
    ],
    rows: [
      { id: "r1", title: "Halden Mill", kicker: "chiuso", note: "carta nordica", meta: "€48k" },
      { id: "r2", title: "Tromsø Light", kicker: "trattativa", note: "ottone freddo", meta: "€22k" },
      { id: "r3", title: "Bergen Dock", kicker: "scouting", note: "olio e sale", meta: "€11k" },
      { id: "r4", title: "Ålesund Yarn", kicker: "firma", note: "lana e ottone", meta: "€19k" },
      { id: "r5", title: "Kirkenes Ice", kicker: "scouting", note: "logistica nord", meta: "€9k" },
    ],
    formTitle: "Nuova opportunità",
    cta: "Registra nel ledger",
  },
  {
    id: "orto-flusso",
    family: "ops",
    kind: "app",
    name: "Orto Flusso",
    kicker: "Raccolto · Pachino",
    place: "casse della settimana",
    collection: "righe",
    brief: `${formatPrefix("dashboard")}Orto Flusso: cruscotto vendite agricole, flusso ordini, harvest e kpi di vendita.`,
    tabs: [
      { id: "pipeline", label: "Casse" },
      { id: "nuovo", label: "Nuovo lotto" },
      { id: "numeri", label: "Resa" },
      { id: "rischi", label: "Clima" },
    ],
    rows: [
      { id: "r1", title: "Datterino rosso", kicker: "pronto", note: "fila 4", meta: "120 kg" },
      { id: "r2", title: "Ciliegino", kicker: "in corso", note: "fila 2", meta: "80 kg" },
      { id: "r3", title: "Basilico", kicker: "semina", note: "serra B", meta: "18 kg" },
      { id: "r4", title: "Zucchina", kicker: "pronto", note: "fila 1", meta: "64 kg" },
      { id: "r5", title: "Melanzana", kicker: "in corso", note: "serra A", meta: "41 kg" },
    ],
    formTitle: "Nuovo lotto",
    cta: "Metti in flusso",
  },
  {
    id: "taglia",
    family: "utility",
    kind: "app",
    name: "Taglia",
    kicker: "Ritaglio in tasca",
    place: "rapporti 1:1 · 4:5 · 16:9",
    collection: "misure",
    brief: `${formatPrefix("tool")}Taglia foto: ritaglio in tasca, convertitore di misure e crocini di taglio.`,
    tabs: [
      { id: "taglio", label: "Taglio" },
      { id: "rapporti", label: "Rapporti" },
      { id: "archivio", label: "Archivio" },
      { id: "info", label: "Segni" },
    ],
    rows: [
      { id: "m1", title: "Copertina", kicker: "4:5", note: "1080 × 1350", meta: "stampa" },
      { id: "m2", title: "Storia", kicker: "9:16", note: "1080 × 1920", meta: "schermo" },
      { id: "m3", title: "Quadro", kicker: "1:1", note: "1600 × 1600", meta: "vetrina" },
    ],
    formTitle: "Nuovo ritaglio",
    cta: "Salva il taglio",
  },
  {
    id: "metro-tasca",
    family: "utility",
    kind: "app",
    name: "Metro tasca",
    kicker: "Misure · nastro",
    place: "m · cm · ft · in",
    collection: "misure",
    brief: `${formatPrefix("tool")}Metro tasca: convertitore di misure in tasca, nastro millimetrato e archivio.`,
    tabs: [
      { id: "taglio", label: "Metro" },
      { id: "rapporti", label: "Scale" },
      { id: "archivio", label: "Prove" },
      { id: "info", label: "Nastro" },
    ],
    rows: [
      { id: "m1", title: "Telaio", kicker: "cm", note: "184 cm", meta: "parete" },
      { id: "m2", title: "Passo", kicker: "m", note: "0.72 m", meta: "scala" },
      { id: "m3", title: "Tavolo", kicker: "in", note: "72 in", meta: "bottega" },
    ],
    formTitle: "Nuova misura",
    cta: "Registra sul nastro",
  },
];

function layoutCss(family: TokenFamily): string {
  if (family === "fashion") {
    return `.lookbook{display:grid;grid-template-columns:1fr;gap:12px}
.look{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;min-height:280px}
.sil{min-height:180px;background:var(--elevated)}
.sil svg,.hero svg{width:100%;height:180px;display:block}
@media(min-width:768px){
  .app{display:grid;grid-template-columns:minmax(200px,240px) 1fr;width:100%;min-height:100dvh;height:auto;align-items:stretch}
  header{grid-column:1;border-right:1px solid var(--line);flex-direction:column;align-items:flex-start;gap:16px}
  .tabs{grid-column:1;display:flex;flex-direction:column;height:auto;border:0;border-right:1px solid var(--line);padding:16px}
  .tabs button{flex-direction:row;font-size:13px;min-height:44px;gap:10px}
  main{grid-column:2;grid-row:1 / span 2;padding:24px 28px;display:block}
  .lookbook{grid-template-columns:repeat(3,1fr);gap:16px}
  .sil{min-height:240px}
  .sil svg,.hero svg{height:240px;min-height:240px}
}
@media(min-width:1024px){main{padding:28px 40px}.lookbook{gap:20px}}`;
  }
  if (family === "ops") {
    return `table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line)}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}
th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.kpis{display:grid;grid-template-columns:1fr;gap:12px;margin:0 0 16px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;min-height:92px}
.kpi b{display:block;font-size:1.6rem;letter-spacing:-.03em}
@media(min-width:768px){
  .app{display:grid;grid-template-columns:minmax(200px,240px) 1fr;width:100%;min-height:100dvh;height:auto;align-items:stretch}
  header{grid-column:1;border-right:1px solid var(--line)}
  .tabs{grid-column:1;display:flex;flex-direction:column;height:auto;border:0;border-right:1px solid var(--line);padding:16px}
  .tabs button{flex-direction:row;font-size:13px;min-height:44px;gap:10px}
  main{grid-column:2;grid-row:1 / span 2;padding:24px 28px}
  .kpis{grid-template-columns:repeat(3,1fr)}
  .hero{min-height:36vh}
  .hero svg{height:36vh;min-height:240px}
}
@media(min-width:1024px){main{padding:28px 40px}.kpis{grid-template-columns:repeat(4,1fr)}}`;
  }
  if (family === "utility") {
    return `.board{display:grid;gap:14px}
.measure{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
@media(min-width:768px){
  .app{display:grid;grid-template-columns:minmax(200px,240px) 1fr;width:100%;min-height:100dvh;height:auto;align-items:stretch}
  header{grid-column:1;border-right:1px solid var(--line)}
  .tabs{grid-column:1;display:flex;flex-direction:column;height:auto;border:0;border-right:1px solid var(--line);padding:16px}
  .tabs button{flex-direction:row;font-size:13px;min-height:44px;gap:10px}
  main{grid-column:2;grid-row:1 / span 2;padding:24px 28px;display:grid;grid-template-columns:1.1fr .9fr;gap:20px;align-content:start}
  .hero,.span{grid-column:1 / -1}
  .hero{min-height:36vh}
  .hero svg{height:36vh;min-height:240px}
}
@media(min-width:1024px){main{grid-template-columns:1.2fr .8fr;padding:32px 40px}}`;
  }
  return `.notes{color:var(--muted);font-size:13px}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}
@media(min-width:768px){
  .app{display:grid;grid-template-columns:minmax(220px,260px) 1fr;width:100%;min-height:100dvh;height:auto}
  header{grid-column:1;flex-direction:column;align-items:flex-start;border-right:1px solid var(--line);gap:16px}
  .tabs{grid-column:1;display:flex;flex-direction:column;height:auto;border:0;border-right:1px solid var(--line);padding:14px}
  .tabs button{flex-direction:row;gap:10px;font-size:13px;min-height:44px}
  main{grid-column:2;grid-row:1 / span 2;padding:24px 32px;display:grid;grid-template-columns:minmax(260px,.95fr) minmax(300px,1.05fr);gap:18px;align-content:start}
  .hero{grid-column:1;grid-row:1 / span 12;min-height:52vh;margin-bottom:0}
  .hero svg{height:100%;min-height:52vh}
  .span,.card,.day,.fragrance,.slot{grid-column:2}
}
@media(min-width:1024px){
  main{padding:32px 40px;gap:22px}
  .hero{min-height:64vh}
  .hero svg{min-height:64vh}
}`;
}

function tabSvg(tab: { id: string; label: string }, i: number): string {
  return craftNavIcon(tab, i);
}

function jsRows(spec: Spec): string {
  return spec.rows
    .map(
      (r) =>
        `{id:${JSON.stringify(r.id)},title:${JSON.stringify(r.title)},kicker:${JSON.stringify(r.kicker)},note:${JSON.stringify(r.note)},meta:${JSON.stringify(r.meta)}}`,
    )
    .join(",");
}

export function premiumHtml(spec: Spec): string {
  const t = tokensFromBrief(spec.brief);
  const p = t.palette;
  const scheme = Number.parseInt(p.bg.slice(1, 3), 16) < 80 ? "dark" : "light";
  const alt = altForBrief(spec.brief);
  const hero = domainIllustration(t.family, t.variant, alt, 0);
  const cards = spec.rows.map((_, i) => domainIllustration(t.family, t.variant, alt, i + 1));
  const first = spec.tabs[0]!.id;
  const homeView = first;
  return `<!DOCTYPE html>
<html lang="it"${spec.family === "ops" ? " data-fenix-craft-desk" : ""}>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="color-scheme" content="${scheme}"/>
<title>${spec.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="${t.fonts.href}" rel="stylesheet"/>
<style data-fenix-phone>
:root{color-scheme:${scheme};--bg:${p.bg};--surface:${p.surface};--elevated:${p.elevated};--fg:${p.fg};--muted:${p.muted};--accent:${p.accent};--line:${p.line};--accent-ink:${p.accentInk};--r:${t.radius}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--fg);font:400 ${t.type.body}/1.45 "${t.fonts.body}",system-ui,sans-serif}
body{min-height:100dvh}
.app{min-height:100dvh;height:100dvh;display:flex;flex-direction:column;width:100%}
header{padding:16px 18px 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.brand{font-family:"${t.fonts.display}",Georgia,serif;font-size:${t.type.h1};font-weight:650;letter-spacing:-.03em;line-height:1.1}
header p,.kicker{color:var(--muted);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
main{flex:1;min-height:0;overflow-y:auto;padding:8px 16px 24px;-webkit-overflow-scrolling:touch}
.hero{position:relative;border-radius:var(--r);overflow:hidden;margin-bottom:14px;border:1px solid var(--line);background:var(--elevated);min-height:240px}
.hero svg,.sil svg{width:100%;height:240px;display:block}
.card,.slot,.measure,.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:12px}
.card h2,.look h2,.slot h2,.measure h2{font-family:"${t.fonts.display}",Georgia,serif;font-size:1.25rem;font-weight:600;margin:0 0 4px}
.btn{appearance:none;border:0;cursor:pointer;font:600 14px/1 "${t.fonts.body}",system-ui,sans-serif;border-radius:999px;padding:12px 16px;background:var(--accent);color:var(--accent-ink);min-height:44px}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn.sm{padding:8px 12px;min-height:40px;font-size:13px}
label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:10px 0 4px}
input,select,textarea{width:100%;font:inherit;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--elevated);color:var(--fg)}
.tabs{flex-shrink:0;height:calc(64px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(4,1fr);padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 92%,transparent)}
.tabs button{border:0;background:none;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:3px;font:600 10px/1.1 "${t.fonts.body}",sans-serif;padding:4px}
.tabs button.on{color:var(--accent)}
.tabs svg{width:22px;height:22px;flex:0 0 22px;overflow:hidden;display:block}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.empty{padding:28px 8px;color:var(--muted);text-align:center}
.day{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:8px;margin-bottom:12px}
.slot{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:center;padding:12px;border-bottom:1px solid var(--line);margin:0}
${layoutCss(t.family)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="app">
<header>
  <div>
    <p>${spec.kicker}</p>
    <h1 class="brand">${spec.name}</h1>
  </div>
  <p>${spec.place}</p>
</header>
<main id="root"><div class="hero">${hero}</div></main>
<nav class="tabs" id="tabs">
${spec.tabs.map((tab, i) => `  <button type="button" data-view="${tab.id}"${i === 0 ? ' class="on"' : ""}>${tab.label}</button>`).join("\n")}
</nav>
</div>
<script>
const defaultData={items:[${jsRows(spec)}]};
let data=structuredClone(defaultData);
let view=${JSON.stringify(homeView)};
const arts=${JSON.stringify(cards)};
const hero=${JSON.stringify(hero)};
const tabDefs=${JSON.stringify(spec.tabs)};
const glyphs=${JSON.stringify(spec.tabs.map((t, i) => tabSvg(t, i)))};
function save(){ if(window.Fenix) void window.Fenix.save("state", data); }
function renderTabs(){
  document.getElementById("tabs").innerHTML=tabDefs.map(function(t,i){
    return '<button type="button" data-view="'+t.id+'" class="'+(view===t.id?"on":"")+'">'+glyphs[i]+"<span>"+t.label+"</span></button>";
  }).join("");
}
function renderHome(){
  var html='<div class="hero">'+hero+'</div>';
  html+='<div class="card span"><p class="kicker">${spec.kicker}</p><h2>${spec.rows.length} in casa</h2><p class="notes">${spec.place}. Tocca una riga, registra, archivia.</p></div>';
  if(${JSON.stringify(spec.family)}==="fashion"){
    var plates=[hero].concat(arts);
    html+='<div class="lookbook">';
    data.items.forEach(function(e,i){
      html+='<article class="look" data-id="'+e.id+'"><div class="sil">'+(plates[i%plates.length]||hero)+'</div><h2>'+e.title+'</h2><p>'+e.kicker+' · '+e.note+'</p></article>';
    });
    html+="</div>";
    return html;
  }
  if(${JSON.stringify(spec.family)}==="ops"){
    html+='<div class="kpis">';
    html+='<div class="kpi"><span class="kicker">Voci</span><b>'+data.items.length+'</b></div>';
    html+='<div class="kpi"><span class="kicker">Aperte</span><b>'+data.items.filter(function(x){return !/chiuso|pronto/.test(x.kicker);}).length+'</b></div>';
    html+='<div class="kpi"><span class="kicker">Luogo</span><b>${spec.place}</b></div>';
    html+='</div><table><thead><tr><th>Nome</th><th>Stato</th><th>Nota</th><th>Meta</th></tr></thead><tbody>';
    data.items.forEach(function(e){
      html+='<tr data-id="'+e.id+'"><td>'+e.title+'</td><td>'+e.kicker+'</td><td>'+e.note+'</td><td>'+e.meta+'</td></tr>';
    });
    html+="</tbody></table>";
    return html;
  }
  if(${JSON.stringify(spec.family)}==="booking"){
    html+='<div class="day">';
    data.items.forEach(function(e){
      html+='<article class="slot" data-id="'+e.id+'"><time>'+e.kicker+'</time><div><h2>'+e.title+'</h2><p class="notes">'+e.note+' · '+e.meta+'</p></div><button class="btn ghost sm" data-act="del" data-id="'+e.id+'">Fine</button></article>';
    });
    if(!data.items.length) html+='<p class="empty">Nessuna prenotazione in agenda. Aprine una da Prenota.</p>';
    html+="</div>";
    return html;
  }
  data.items.forEach(function(e,i){
    html+='<article class="card fragrance" data-id="'+e.id+'"><p class="kicker">'+e.kicker+'</p><h2>'+e.title+'</h2><p class="notes">'+e.note+'</p><div class="row"><span>'+e.meta+'</span><button class="btn sm ghost" data-act="wear" data-id="'+e.id+'">Tieni a portata</button></div></article>';
  });
  return html;
}
function renderForm(){
  return '<div class="card span"><p class="kicker">Nuovo</p><h2>${spec.formTitle}</h2><form id="fnew"><label for="n">Nome</label><input class="field" id="n" name="n" required placeholder="Nome"><label for="k">Dettaglio</label><input class="field" id="k" name="k" placeholder="famiglia, taglia, ora"><label for="note">Nota</label><input class="field" id="note" name="note" placeholder="materia"><button class="btn" type="submit" style="margin-top:14px;width:100%">${spec.cta}</button></form></div>';
}
function renderList(){
  var html='<div class="card span"><p class="kicker">Archivio</p><h2>'+data.items.length+' voci</h2></div>';
  if(!data.items.length) html+='<p class="empty">Nessuna voce in archivio. Componine una.</p>';
  data.items.forEach(function(e){
    html+='<div class="card" data-id="'+e.id+'"><div class="row"><h2>'+e.title+'</h2><button class="btn sm ghost" data-act="del" data-id="'+e.id+'">Archivia</button></div><p class="notes">'+e.note+' · '+e.meta+'</p></div>';
  });
  return html;
}
function renderStats(){
  return '<div class="hero">'+hero+'</div><div class="card span"><p class="kicker">Studio</p><h2>'+data.items.length+' in lavorazione</h2><p class="notes">${spec.place}</p></div>';
}
function render(){
  renderTabs();
  var root=document.getElementById("root");
  var id=view;
  if(id===tabDefs[0].id) root.innerHTML=renderHome();
  else if(id===tabDefs[1].id) root.innerHTML=renderForm();
  else if(id===tabDefs[2].id) root.innerHTML=renderList();
  else root.innerHTML=renderStats();
}
document.getElementById("tabs").addEventListener("click",function(e){
  var b=e.target.closest("[data-view]"); if(!b) return; view=b.getAttribute("data-view"); render();
});
document.getElementById("root").addEventListener("click",function(e){
  var b=e.target.closest("[data-act]"); if(!b) return;
  var id=b.getAttribute("data-id");
  if(b.getAttribute("data-act")==="del"){ data.items=data.items.filter(function(x){return x.id!==id;}); save(); render(); }
  if(b.getAttribute("data-act")==="wear"){ var row=data.items.find(function(x){return x.id===id;}); if(row){ data.items=[row].concat(data.items.filter(function(x){return x.id!==id;})); save(); view=tabDefs[2].id; render(); } }
});
document.getElementById("root").addEventListener("submit",function(e){
  e.preventDefault();
  var f=e.target;
  if(f.id!=="fnew") return;
  var nome=(f.n.value||"").trim(); if(!nome) return;
  data.items.unshift({id:"n"+Date.now(),title:nome,kicker:(f.k.value||"").trim()||"—",note:(f.note.value||"").trim()||"—",meta:"nuovo"});
  f.reset(); save(); view=tabDefs[0].id; render();
});
function markReady(){ document.documentElement.setAttribute("data-fenix-ready","1"); }
async function boot(){ try{ if(window.Fenix&&window.Fenix.load){ var r=await window.Fenix.load("state"); if(r&&typeof r==="object"&&Array.isArray(r.items)) data=r; } }catch(err){} render(); markReady(); }
boot();
setTimeout(function(){ if(!document.documentElement.getAttribute("data-fenix-ready")) { render(); markReady(); } }, 500);
</script>
</body>
</html>`;
}

export function loadPremiumSpecs(): Spec[] {
  return SPECS;
}

export function loadPremiumFixtures() {
  return SPECS.map((spec) => {
    const tokens = tokensFromBrief(spec.brief);
    return {
      id: spec.id,
      family: spec.family,
      kind: spec.kind,
      brief: spec.brief,
      html: premiumHtml(spec),
      palette: tokens.palette,
      mustPass: true as const,
    };
  });
}
