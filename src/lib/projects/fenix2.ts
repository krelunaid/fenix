import type { Palette } from "./types";
import type { ProjectFile } from "./files";

const IDS = ["home", "new", "list", "stats", "more"] as const;

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "app"
  );
}

function componentName(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function screenInner(files: ProjectFile[], id: string) {
  return files.find((f) => f.path === `screens/${id}.html`)?.content?.trim() || `<p>${id}</p>`;
}

function htmlToJsx(html: string, comp: string) {
  let j = html
    .replace(/\sclass=/gi, " className=")
    .replace(/\sfor=/gi, " htmlFor=")
    .replace(/\sstroke-width=/gi, " strokeWidth=")
    .replace(/\sstroke-linecap=/gi, " strokeLinecap=")
    .replace(/\sstroke-linejoin=/gi, " strokeLinejoin=")
    .replace(/\sstroke-dasharray=/gi, " strokeDasharray=")
    .replace(/\sfill-rule=/gi, " fillRule=")
    .replace(/\sclip-path=/gi, " clipPath=")
    .replace(/\sviewbox=/gi, " viewBox=")
    .replace(/\stabindex=/gi, " tabIndex=")
    .replace(/\scolspan=/gi, " colSpan=")
    .replace(/\srowspan=/gi, " rowSpan=")
    .replace(/\sautocomplete=/gi, " autoComplete=")
    .replace(/<(img|input|br|hr|meta|link|source)([^>]*?)\/?>/gi, "<$1$2 />");
  j = j.trim() || "<p>Vuoto</p>";
  return `export default function ${comp}() {
  return (
    <div className="fk-screen">
      ${j}
    </div>
  );
}
`;
}

function screenTsx(files: ProjectFile[], id: string) {
  const comp = componentName(id);
  const existing = files.find((f) => f.path === `src/screens/${comp}.tsx`)?.content ?? "";
  if (existing.includes("export default function") && !existing.includes("dangerouslySetInnerHTML")) {
    return existing;
  }
  return htmlToJsx(screenInner(files, id), comp);
}

export function fenix2Files(
  files: ProjectFile[],
  opts: { name: string; palette: Palette },
): ProjectFile[] {
  const pkg = slug(opts.name);
  const { bg, surface, fg, muted, accent } = opts.palette;
  const screens = IDS.map((id) => ({
    path: `src/screens/${componentName(id)}.tsx`,
    content: screenTsx(files, id),
  }));

  const extra = files.filter(
    (f) =>
      !f.path.startsWith("src/") &&
      f.path !== "package.json" &&
      f.path !== "vite.config.ts" &&
      f.path !== "README.md",
  );

  return [
    ...extra,
    ...screens,
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: pkg,
          private: true,
          type: "module",
          scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
          dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
          devDependencies: {
            "@vitejs/plugin-react": "^4.3.4",
            vite: "^6.0.0",
            typescript: "^5.7.0",
          },
        },
        null,
        2,
      ),
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
`,
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${opts.name.replace(/</g, "")}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.tsx",
      content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    },
    {
      path: "src/App.tsx",
      content: `import { useState } from "react";
import Home from "./screens/Home";
import New from "./screens/New";
import List from "./screens/List";
import Stats from "./screens/Stats";
import More from "./screens/More";

const TABS = [
  { id: "home", label: "Home", View: Home },
  { id: "new", label: "Nuovo", View: New },
  { id: "list", label: "Elenco", View: List },
  { id: "stats", label: "Numeri", View: Stats },
  { id: "more", label: "Altro", View: More },
] as const;

export default function App() {
  const [tab, setTab] = useState("home");
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const View = current.View;
  return (
    <div className="app">
      <main className="fk-main">
        <View />
      </main>
      <nav className="fk-tab">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "on" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
`,
    },
    {
      path: "src/index.css",
      content: `:root {
  --bg: ${bg};
  --surface: ${surface};
  --fg: ${fg};
  --muted: ${muted};
  --accent: ${accent};
}
html, body, #root { height: 100%; margin: 0; }
body {
  font: 400 16px/1.4 "IBM Plex Sans", system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
}
.app { height: 100%; display: flex; flex-direction: column; }
.fk-main { flex: 1; min-height: 0; overflow: auto; padding: 16px; }
.fk-tab {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: 64px;
  border-top: 1px solid color-mix(in srgb, var(--fg) 12%, transparent);
  background: var(--bg);
}
.fk-tab button {
  border: 0;
  background: none;
  color: var(--muted);
  font: 600 10px/1.1 system-ui, sans-serif;
}
.fk-tab button.on { color: var(--accent); }
.fk-screen, .fk-screen p, .fk-screen li, .fk-screen span, .fk-screen b { color: var(--fg); }
`,
    },
    {
      path: "README.md",
      content: `# ${opts.name}

App Fenix 2 (Vite + React).

\`\`\`
npm i
npm run dev
\`\`\`

Le schermate sono in \`src/screens/\`. L'anteprima su fenix.kreluna.it monta React.
`,
    },
  ];
}

function stripTsx(src: string) {
  return src
    .replace(/^import[\s\S]*?;\s*/gm, "")
    .replace(/export default function/g, "function")
    .replace(/as const/g, "")
    .replace(/useState<[^>]+>/g, "useState");
}

export function fenix2PreviewHtml(files: ProjectFile[], name = "App") {
  if (!files.some((f) => f.path === "src/App.tsx")) return "";
  const css = files.find((f) => f.path === "src/index.css")?.content ?? "";
  const screens = IDS.map((id) => {
    const comp = componentName(id);
    const src = files.find((f) => f.path === `src/screens/${comp}.tsx`)?.content ?? `function ${comp}(){return <div/>}`;
    return stripTsx(src);
  }).join("\n");
  const app = stripTsx(files.find((f) => f.path === "src/App.tsx")?.content ?? "");
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${name.replace(/</g, "")}</title>
<style>${css}
html,body,#root{height:100%;margin:0}
</style>
</head>
<body>
<div id="root"></div>
<script src="https://unpkg.com/react@18/umd/react.development.js" integrity=""></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel" data-presets="react">
const { useState, useEffect } = React;
${screens}
${app}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
</script>
</body>
</html>`;
}
