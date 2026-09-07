// Tools the agent can call. Definitions follow the Anthropic tool schema; the
// executor binds them to a sandbox and enforces the contract (paths, sizes,
// timeouts, "no finish before checks pass").
import { canonicalizePath, LIMITS } from "./contract.mjs";
import { runChecks, formatChecks } from "./checks.mjs";

export const TOOLS = [
  {
    name: "list_files",
    description: "Elenca i file del progetto con la dimensione in byte.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_file",
    description: "Legge un file di testo del progetto. Percorsi relativi alla radice, es. public/index.html.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "write_file",
    description: "Crea o sovrascrive un file con il contenuto completo. Usalo per file nuovi o riscritture; per ritocchi preferisci edit_file.",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false },
  },
  {
    name: "edit_file",
    description: "Sostituisce ESATTAMENTE una occorrenza di `search` con `replace` nel file. Fallisce se `search` non esiste o compare più volte: includi abbastanza contesto per renderla unica.",
    input_schema: { type: "object", properties: { path: { type: "string" }, search: { type: "string" }, replace: { type: "string" } }, required: ["path", "search", "replace"], additionalProperties: false },
  },
  {
    name: "delete_file",
    description: "Elimina un file del progetto.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "run",
    description: `Esegue un comando shell nella radice del progetto (Node 22 disponibile, nessun accesso a npm/rete). Timeout massimo ${LIMITS.maxCommandSeconds}s. Output troncato.`,
    input_schema: { type: "object", properties: { command: { type: "string" }, timeout_s: { type: "integer", minimum: 1, maximum: LIMITS.maxCommandSeconds } }, required: ["command"], additionalProperties: false },
  },
  {
    name: "start_server",
    description: "Avvia `node server.mjs` con PORT e DATA_DIR impostati e attende GET /health. Restituisce l'URL o i log d'errore. Riavvia se già attivo.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "http",
    description: "Chiama il server avviato con start_server. Restituisce status, content-type e inizio del body.",
    input_schema: {
      type: "object",
      properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, path: { type: "string" }, body: { type: "string", description: "JSON come stringa" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "server_logs",
    description: "Ultimi log del server avviato con start_server.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "run_checks",
    description: "Esegue i controlli di accettazione (manifest, sintassi, avvio, pagine, API, test, browser). Devono passare tutti prima di finish.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "finish",
    description: "Termina il lavoro. Consentito solo dopo che run_checks è passato senza modifiche successive. Riassumi cosa hai costruito e come si usa.",
    input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false },
  },
];

export function createToolExecutor(sandbox, { log = () => {}, browserChecks = true } = {}) {
  const state = { checksPassed: false, lastChecks: null, dirtySinceChecks: true, writes: 0, commands: 0 };
  const markDirty = () => { state.dirtySinceChecks = true; state.checksPassed = false; };

  const handlers = {
    async list_files() {
      const files = await sandbox.listFiles();
      if (files.length === 0) return "Progetto vuoto.";
      return files.map((f) => `${f.path} (${f.bytes} B)`).join("\n");
    },
    async read_file({ path }) {
      const p = canonicalizePath(path);
      const text = await sandbox.readFile(p);
      return text.length > LIMITS.maxToolOutputChars * 3 ? `${text.slice(0, LIMITS.maxToolOutputChars * 3)}\n… [file troncato a ${LIMITS.maxToolOutputChars * 3} caratteri; usa edit_file con contesto preciso]` : text;
    },
    async write_file({ path, content }) {
      const p = canonicalizePath(path);
      if (typeof content !== "string") throw new Error("content deve essere una stringa.");
      const bytes = await sandbox.writeFile(p, content);
      state.writes += 1;
      markDirty();
      return `Scritto ${p} (${bytes} B).`;
    },
    async edit_file({ path, search, replace }) {
      const p = canonicalizePath(path);
      if (typeof search !== "string" || !search) throw new Error("search vuoto.");
      const text = await sandbox.readFile(p);
      const first = text.indexOf(search);
      if (first < 0) throw new Error(`search non trovato in ${p}. Rileggi il file e copia il testo esatto.`);
      if (text.indexOf(search, first + 1) >= 0) throw new Error(`search compare più volte in ${p}: aggiungi contesto.`);
      const next = text.slice(0, first) + String(replace ?? "") + text.slice(first + search.length);
      await sandbox.writeFile(p, next);
      state.writes += 1;
      markDirty();
      return `Modificato ${p}.`;
    },
    async delete_file({ path }) {
      const p = canonicalizePath(path);
      await sandbox.deleteFile(p);
      markDirty();
      return `Eliminato ${p}.`;
    },
    async run({ command, timeout_s }) {
      if (typeof command !== "string" || !command.trim()) throw new Error("command vuoto.");
      if (/\b(npm|npx|pnpm|yarn|curl|wget|git)\b/.test(command)) {
        return "Comando non consentito nel sandbox (niente npm/rete/git). Il progetto non deve avere dipendenze.";
      }
      state.commands += 1;
      const r = await sandbox.exec({ cmd: command, timeoutMs: Math.min(LIMITS.maxCommandSeconds, timeout_s || 60) * 1000 });
      markDirty();
      return `exit ${r.code}${r.timedOut ? " (TIMEOUT)" : ""} in ${r.ms} ms\n--- stdout ---\n${clip(r.stdout)}\n--- stderr ---\n${clip(r.stderr)}`;
    },
    async start_server() {
      const r = await sandbox.spawnServer({ cmd: "node server.mjs" });
      if (!r.ok) return `Il server NON è partito: ${r.error}\n--- log ---\n${clip(r.logs || "")}`;
      return `Server attivo su ${r.url} (GET /health ok).`;
    },
    async http({ method = "GET", path, body }) {
      if (typeof path !== "string" || !path.startsWith("/")) throw new Error("path deve iniziare con /.");
      const r = await sandbox.fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body });
      return `HTTP ${r.status} ${r.headers["content-type"] || ""}\n${clip(r.text, 4000)}`;
    },
    async server_logs() {
      return clip(sandbox.serverLogs() || "(nessun log)");
    },
    async run_checks() {
      const result = await runChecks(sandbox, { browser: browserChecks, log });
      state.lastChecks = result;
      state.checksPassed = result.ok;
      state.dirtySinceChecks = false;
      return formatChecks(result);
    },
    async finish({ summary }) {
      if (!state.checksPassed || state.dirtySinceChecks) {
        return "RIFIUTATO: finish è consentito solo subito dopo un run_checks passato. Esegui run_checks (e correggi ciò che fallisce).";
      }
      return { done: true, summary: String(summary || "") };
    },
  };

  return {
    state,
    async execute(name, input) {
      const handler = handlers[name];
      if (!handler) return { ok: false, output: `Strumento sconosciuto: ${name}` };
      try {
        const out = await handler(input || {});
        if (out && typeof out === "object" && out.done) return { ok: true, done: true, output: out.summary };
        return { ok: true, output: clip(String(out)) };
      } catch (err) {
        return { ok: false, output: `Errore: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  };
}

function clip(text, max = LIMITS.maxToolOutputChars) {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, Math.floor(max * 0.7))}\n… [${s.length - max} caratteri omessi] …\n${s.slice(-Math.floor(max * 0.3))}`;
}
