// Local sandbox: a throwaway directory + child processes in their own process
// group. Used for development, tests and as the reference implementation of the
// sandbox interface. It is NOT an isolation boundary — use the Docker sandbox in
// production (same interface, see ./docker.mjs).
//
// Interface (shared with DockerSandbox):
//   sandbox.root                        host directory of the project
//   sandbox.exec({ cmd, timeoutMs, env, cwd }) -> { code, stdout, stderr, timedOut, ms }
//   sandbox.spawnServer({ cmd, env, port }) -> { port, stop(), logs() }
//   sandbox.fetch(path, init)            HTTP request to a server started with spawnServer
//   sandbox.readFile / writeFile / deleteFile / listFiles
//   sandbox.destroy()
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir, stat, unlink, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { canonicalizePath, LIMITS } from "../contract.mjs";

export const OUTPUT_CAP = 64_000;

export function capOutput(text, cap = OUTPUT_CAP) {
  if (text.length <= cap) return text;
  const head = text.slice(0, Math.floor(cap * 0.7));
  const tail = text.slice(-Math.floor(cap * 0.25));
  return `${head}\n… [${text.length - head.length - tail.length} caratteri omessi] …\n${tail}`;
}

function killGroup(child, signal = "SIGTERM") {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* already gone */ }
  }
}

/** Run a shell command with a hard timeout; captures capped stdout/stderr. */
export function runCommand({ cmd, cwd, env = {}, timeoutMs = LIMITS.maxCommandSeconds * 1000, signal }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("/bin/sh", ["-c", cmd], {
      cwd,
      env: { PATH: process.env.PATH, HOME: cwd, NODE_ENV: "development", CI: "1", NO_COLOR: "1", ...env },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child, "SIGKILL");
    }, timeoutMs);
    const abort = () => killGroup(child, "SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (d) => { if (stdout.length < OUTPUT_CAP * 2) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < OUTPUT_CAP * 2) stderr += d; });
    child.on("error", (err) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({ code: 127, stdout, stderr: `${stderr}${err.message}`, timedOut, ms: Date.now() - started });
    });
    child.on("close", (code, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({
        code: code ?? (exitSignal ? 137 : 1),
        stdout: capOutput(stdout),
        stderr: capOutput(stderr),
        timedOut,
        ms: Date.now() - started,
      });
    });
  });
}

async function waitForHealth(url, timeoutMs, isAlive) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    if (!isAlive()) return { ok: false, error: "Il processo del server è terminato." };
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return { ok: true };
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: false, error: `Health non raggiunto entro ${timeoutMs} ms (${lastError}).` };
}

export async function freePort() {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export class LocalSandbox {
  constructor({ root, dataDir = null }) {
    this.root = root;
    this.kind = "local";
    this.server = null;
    this.abort = new AbortController();
    /** Optional persistent directory for the project's SQLite data (published apps). */
    this.dataDir = dataDir;
  }

  static async create({ jobId = `job-${Date.now().toString(36)}`, baseDir = join(tmpdir(), "fenix-agent"), dataDir = null } = {}) {
    await mkdir(baseDir, { recursive: true });
    const root = await mkdtemp(join(baseDir, `${jobId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60)}-`));
    await mkdir(join(root, ".fenix"), { recursive: true });
    if (dataDir) await mkdir(dataDir, { recursive: true });
    return new LocalSandbox({ root, dataDir });
  }

  resolve(path) {
    this.abort.signal.throwIfAborted();
    return join(this.root, canonicalizePath(path));
  }

  async assertNoLinks(path) {
    let current = this.root;
    for (const part of ["", ...canonicalizePath(path).split("/")]) {
      if (part) current = join(current, part);
      try {
        if ((await lstat(current)).isSymbolicLink()) throw new Error("Symlink non consentito.");
      } catch (err) { if (err.code !== "ENOENT") throw err; }
    }
  }

  async readFile(path) {
    await this.assertNoLinks(path);
    return readFile(this.resolve(path), "utf8");
  }

  async writeFile(path, content) {
    await this.assertNoLinks(path);
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > LIMITS.maxFileBytes) throw new Error(`File troppo grande (${bytes} byte).`);
    const full = this.resolve(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    return bytes;
  }

  /** Internal runtime files (checks scripts) live under .fenix/, outside the model's reach. */
  async writeRuntimeFile(name, content) {
    const full = join(this.root, ".fenix", name.replace(/[^A-Za-z0-9._-]/g, "_"));
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    return `.fenix/${name}`;
  }

  async deleteFile(path) {
    await this.assertNoLinks(path);
    await unlink(this.resolve(path));
  }

  /** List project files (relative paths + bytes), skipping reserved dirs. */
  async listFiles() {
    const out = [];
    const walk = async (dir, rel) => {
      let entries = [];
      try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.name === ".fenix" || e.name === "node_modules" || e.name === ".git") continue;
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(join(dir, e.name), p);
        else if (e.isFile()) {
          const s = await stat(join(dir, e.name));
          out.push({ path: p, bytes: s.size });
        }
      }
    };
    await walk(this.root, "");
    return out;
  }

  async exec({ cmd, timeoutMs, env, cwd }) {
    this.abort.signal.throwIfAborted();
    return runCommand({ cmd, cwd: cwd ? this.resolve(cwd) : this.root, env, timeoutMs, signal: this.abort.signal });
  }

  /** Start the project's server and wait for /health. Only one server at a time. */
  async spawnServer({ cmd = "node server.mjs", env = {}, healthPath = "/health", timeoutMs = LIMITS.serverStartSeconds * 1000 } = {}) {
    this.abort.signal.throwIfAborted();
    await this.stopServer();
    const port = await freePort();
    const dataDir = this.dataDir || join(this.root, ".fenix", "data");
    await mkdir(dataDir, { recursive: true });
    const child = spawn("/bin/sh", ["-c", cmd], {
      cwd: this.root,
      env: { PATH: process.env.PATH, HOME: this.root, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir, NODE_ENV: "development", NO_COLOR: "1", ...env },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    const push = (d) => { if (logs.length < OUTPUT_CAP * 2) logs += d; };
    child.stdout.on("data", push);
    child.stderr.on("data", push);
    let alive = true;
    child.on("close", () => { alive = false; });
    child.on("error", (err) => { alive = false; push(`\n${err.message}`); });
    const health = await waitForHealth(`http://127.0.0.1:${port}${healthPath}`, timeoutMs, () => alive);
    const handle = {
      port,
      url: `http://127.0.0.1:${port}`,
      logs: () => capOutput(logs),
      alive: () => alive,
      stop: async () => {
        killGroup(child, "SIGTERM");
        await new Promise((r) => setTimeout(r, 150));
        if (alive) killGroup(child, "SIGKILL");
        if (this.server === handle) this.server = null;
      },
    };
    if (!health.ok) {
      await handle.stop();
      return { ok: false, error: health.error, logs: capOutput(logs) };
    }
    this.server = handle;
    return { ok: true, port, url: handle.url };
  }

  async stopServer() {
    if (this.server) await this.server.stop();
    this.server = null;
  }

  /** HTTP call against the running server (from the host side). */
  async fetch(path, init = {}) {
    if (!this.server) throw new Error("Nessun server avviato: usa start_server prima.");
    const res = await fetch(`${this.server.url}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(init.timeoutMs ?? 10_000),
    });
    const text = await res.text();
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text };
  }

  serverLogs() {
    return this.server ? this.server.logs() : "";
  }

  /** URL of the running server as seen from INSIDE the sandbox (for browser checks). */
  internalServerUrl() {
    return this.server ? this.server.url : null;
  }

  async destroy() {
    await this.cancel();
    await this.stopServer();
    await rm(this.root, { recursive: true, force: true });
  }

  async cancel() {
    this.abort.abort();
    await this.stopServer();
  }
}
