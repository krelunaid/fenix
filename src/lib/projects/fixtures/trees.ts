import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectFile } from "../files.ts";

const here = dirname(fileURLToPath(import.meta.url));

const SITE_HTML = readFileSync(join(here, "music-site-no-fenix.html"), "utf8");
const DASH_HTML = readFileSync(join(here, "argilla-viva.html"), "utf8");
const APP_HTML = readFileSync(join(here, "valid-app.html"), "utf8");

/** Sito multi-file: sorgenti portabili; solo i riferimenti espliciti vengono eseguiti. */
export const SITE_MULTIFILE: ProjectFile[] = [
  { path: "index.html", content: SITE_HTML },
  {
    path: "css/theme.css",
    content: ":root{--accent:#e85d4c}body{margin:0;font-family:Georgia,serif}",
  },
  {
    path: "js/nav.js",
    content: "document.querySelectorAll('nav a').forEach(function(a){a.addEventListener('click',function(){})})",
  },
  {
    path: "pages/orari.html",
    content: "<!DOCTYPE html><html lang='it'><body><h1>Orari</h1><p>Mar–Dom 10–19</p></body></html>",
  },
  { path: "README.md", content: "# Onda\nSito vetrina. Nessun server." },
];

/** Dashboard con dati e API mock nel tree. Nessun backend inventato. */
export const DASHBOARD_MOCK: ProjectFile[] = [
  {
    path: "index.html",
    content: DASH_HTML.replace(
      /<\/head>/i,
      '<link rel="stylesheet" href="./css/theme.css"></head>',
    ).replace(/<\/body>/i, '<script src="./js/app.js"></script></body>'),
  },
  {
    path: "data/ordini.json",
    content: `${JSON.stringify(
      {
        collezione: "argilla_viva",
        ordini: [
          { id: "o1", cliente: "Bottega Sud", pezzi: 12, stato: "in cottura" },
          { id: "o2", cliente: "Studio Luce", pezzi: 4, stato: "pronto" },
        ],
      },
      null,
      2,
    )}\n`,
  },
  {
    path: "js/app.js",
    content:
      "window.FenixMock={async listOrdini(){const r=await fetch('./data/ordini.json');return r.json()}}",
  },
  {
    path: "css/theme.css",
    content: "table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #d7c4b0}",
  },
];

/** App con componenti sorgente. L'HTML resta l'anteprima eseguibile. */
export const APP_COMPONENTS: ProjectFile[] = [
  { path: "index.html", content: APP_HTML },
  {
    path: "src/App.tsx",
    content: `export default function App(){
  return (<main className="fk-main"><Home /></main>);
}
function Home(){ return <Card title="Oggi" />; }
`,
  },
  {
    path: "src/components/Card.tsx",
    content: `export default function Card(props:{title:string}){
  return <article className="fk-card"><h2>{props.title}</h2></article>;
}
`,
  },
  {
    path: "src/screens/Home.tsx",
    content: `export default function Home(){
  return <div className="fk-screen"><p>Registro</p></div>;
}
`,
  },
];
