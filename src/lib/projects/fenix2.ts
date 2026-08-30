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

function esc(html: string) {
  return html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function screenInner(files: ProjectFile[], id: string) {
  return files.find((f) => f.path === `screens/${id}.html`)?.content?.trim() || `<p>${id}</p>`;
}

function componentName(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function fenix2Files(
  files: ProjectFile[],
  opts: { name: string; palette: Palette },
): ProjectFile[] {
  const pkg = slug(opts.name);
  const { bg, surface, fg, muted, accent } = opts.palette;
  const screens = IDS.map((id) => ({
    path: `src/screens/${componentName(id)}.tsx`,
    content: `export default function ${componentName(id)}() {
  return (
    <div
      className="fk-screen"
      dangerouslySetInnerHTML={{ __html: \`${esc(screenInner(files, id))}\` }}
    />
  );
}
`,
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
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("home");
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
  font: 400 16px/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
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

Le schermate sono in \`src/screens/\`. L'anteprima su fenix.kreluna.it monta gli stessi contenuti.
`,
    },
  ];
}
