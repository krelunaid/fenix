import type { ProjectFile } from "./files.ts";
import {
  materializePortableBackend,
  type PortableBackendField,
  type PortableBackendSpec,
} from "./portable-backend.ts";

export type FullstackPalette = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  accent: string;
};

export type FullstackFixture = {
  id: "argilla" | "forno" | "bottega";
  name: string;
  kicker: string;
  spec: PortableBackendSpec;
  palette: FullstackPalette;
};

export const FULLSTACK_FIXTURES: FullstackFixture[] = [
  {
    id: "argilla",
    name: "Argilla Viva",
    kicker: "Magazzino lotti · stessa origine",
    spec: {
      collections: [
        {
          name: "lotti",
          fields: [
            { name: "nome", type: "text", required: true },
            { name: "pezzi", type: "integer", required: true },
            { name: "scaffale", type: "text" },
          ],
        },
      ],
    },
    palette: {
      bg: "#0e0d0b",
      surface: "#1a1814",
      fg: "#f4efe8",
      muted: "#a39486",
      accent: "#c45c26",
    },
  },
  {
    id: "forno",
    name: "Registro forno",
    kicker: "Cotture · stessa origine",
    spec: {
      collections: [
        {
          name: "cotture",
          fields: [
            { name: "titolo", type: "text", required: true },
            { name: "temperatura", type: "integer", required: true },
            { name: "pronta", type: "boolean", required: true },
          ],
        },
      ],
    },
    palette: {
      bg: "#201812",
      surface: "#2a211b",
      fg: "#f3eadc",
      muted: "#a8927e",
      accent: "#d26a2e",
    },
  },
  {
    id: "bottega",
    name: "Bottega ordini",
    kicker: "Commesse · stessa origine",
    spec: {
      collections: [
        {
          name: "ordini",
          fields: [
            { name: "cliente", type: "text", required: true },
            { name: "pezzi", type: "integer", required: true },
            { name: "pronto", type: "boolean", required: true },
          ],
        },
      ],
    },
    palette: {
      bg: "#120c1c",
      surface: "#1c1528",
      fg: "#f4efe8",
      muted: "#9b93c2",
      accent: "#e85d4c",
    },
  },
];

function fieldControl(field: PortableBackendField): string {
  if (field.type === "boolean") {
    return `<label class="check"><input id="f-${field.name}" name="${field.name}" type="checkbox"/> ${field.name}</label>`;
  }
  const type = field.type === "integer" || field.type === "number" ? "number" : "text";
  const required = field.required ? " required" : "";
  return `<label for="f-${field.name}">${field.name}</label><input id="f-${field.name}" name="${field.name}" type="${type}"${required}/>`;
}

export function fullstackAppHtml(fixture: FullstackFixture): string {
  const collection = fixture.spec.collections[0]!;
  const fieldsJson = JSON.stringify(collection.fields);
  const p = fixture.palette;
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${fixture.name}</title>
<style>
:root{--bg:${p.bg};--surface:${p.surface};--fg:${p.fg};--muted:${p.muted};--accent:${p.accent}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 Georgia,"Iowan Old Style",serif}
header,main{max-width:760px;margin:0 auto;padding:20px 16px}
h1{font-size:1.7rem;margin:0 0 6px}
.kicker{color:var(--muted);margin:0 0 16px}
.card{background:var(--surface);border-radius:18px;padding:16px;margin:12px 0}
label{display:block;margin:10px 0 4px;color:var(--muted)}
input:not([type=checkbox]){width:100%;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid #3a342c;background:#120f0c;color:var(--fg)}
.check{display:flex;align-items:center;gap:10px;min-height:44px;color:var(--fg)}
button{min-height:44px;min-width:44px;padding:10px 16px;margin:8px 8px 0 0;border:0;border-radius:999px;background:var(--accent);color:#fff;font-weight:700}
button.ghost{background:transparent;color:var(--fg);border:1px solid #3a342c}
button:focus{outline:3px solid #f2c6a6;outline-offset:2px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:10px 6px;border-bottom:1px solid #3a342c}
.status{color:var(--muted);min-height:1.4em}
</style>
</head>
<body>
<header>
  <p class="kicker">${fixture.kicker}</p>
  <h1>${fixture.name}</h1>
  <p id="who" class="status">Accedi per continuare.</p>
</header>
<main>
  <form id="auth" class="card" aria-label="Accesso">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required/>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required minlength="12"/>
    <p>
      <button type="submit">Entra</button>
      <button type="button" id="signup" class="ghost">Crea account</button>
    </p>
    <p id="auth-msg" class="status" role="status"></p>
  </form>
  <section id="app" class="card" hidden>
    <form id="create" aria-label="Nuova riga">
      ${collection.fields.map(fieldControl).join("")}
      <p><button type="submit">Salva</button><button type="button" id="logout" class="ghost">Esci</button></p>
    </form>
    <table>
      <thead><tr>${collection.fields.map((field) => `<th>${field.name}</th>`).join("")}</tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <p id="app-msg" class="status" role="status"></p>
  </section>
</main>
<script>
(function(){
  var COL = ${JSON.stringify(collection.name)};
  var FIELDS = ${fieldsJson};
  var who = document.getElementById("who");
  var auth = document.getElementById("auth");
  var app = document.getElementById("app");
  var authMsg = document.getElementById("auth-msg");
  var appMsg = document.getElementById("app-msg");
  var rows = document.getElementById("rows");
  function msg(el, text){ el.textContent = text || ""; }
  function api(path, opts){
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: Object.assign({"content-type":"application/json"}, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(body){
        if (!res.ok) throw new Error(body.error || "errore");
        return body;
      });
    });
  }
  function readForm(){
    var out = {};
    FIELDS.forEach(function(field){
      var el = document.getElementById("f-" + field.name);
      if (!el) return;
      if (field.type === "boolean") out[field.name] = !!el.checked;
      else if (field.type === "integer") out[field.name] = el.value === "" ? undefined : Number.parseInt(el.value, 10);
      else if (field.type === "number") out[field.name] = el.value === "" ? undefined : Number(el.value);
      else out[field.name] = el.value;
    });
    return out;
  }
  function render(items){
    rows.textContent = "";
    (items || []).forEach(function(item){
      var tr = document.createElement("tr");
      FIELDS.forEach(function(field){
        var td = document.createElement("td");
        td.textContent = item[field.name] == null ? "" : String(item[field.name]);
        tr.appendChild(td);
      });
      rows.appendChild(tr);
    });
  }
  function showApp(email){
    auth.hidden = true;
    app.hidden = false;
    who.textContent = email ? ("Sei " + email) : "Sessione attiva";
    return api("/api/" + COL).then(function(body){ render(body.items || []); });
  }
  function enter(path){
    msg(authMsg, "");
    return api(path, { method: "POST", body: { email: document.getElementById("email").value, password: document.getElementById("password").value } })
      .then(function(body){ return showApp(body.email); })
      .catch(function(err){ msg(authMsg, err.message || "Accesso non riuscito"); });
  }
  auth.addEventListener("submit", function(ev){ ev.preventDefault(); enter("/auth/login"); });
  document.getElementById("signup").addEventListener("click", function(){ enter("/auth/signup"); });
  document.getElementById("create").addEventListener("submit", function(ev){
    ev.preventDefault();
    msg(appMsg, "");
    api("/api/" + COL, { method: "POST", body: readForm() })
      .then(function(){ return api("/api/" + COL); })
      .then(function(body){ render(body.items || []); msg(appMsg, "Salvato."); })
      .catch(function(err){ msg(appMsg, err.message || "Salvataggio non riuscito"); });
  });
  document.getElementById("logout").addEventListener("click", function(){
    api("/auth/logout", { method: "POST" }).finally(function(){
      app.hidden = true;
      auth.hidden = false;
      who.textContent = "Accedi per continuare.";
    });
  });
  fetch("/health", { credentials: "same-origin" }).then(function(res){ return res.json(); }).then(function(body){
    if (body && body.ok && body.origin === "same") who.textContent = who.textContent;
  }).catch(function(){});
})();
</script>
</body>
</html>
`;
}

export function materializeFullstackProject(fixture: FullstackFixture): ProjectFile[] {
  const html = fullstackAppHtml(fixture);
  return [{ path: "index.html", content: html }, ...materializePortableBackend(fixture.spec)];
}
