// Docker sandbox: one container per job, project directory bind-mounted at /work,
// commands run through `docker exec`, server port published on 127.0.0.1 only.
// Same interface as LocalSandbox (it extends it: file I/O happens on the mounted
// host directory, execution happens inside the container).
//
// Requirements on the host: docker CLI + daemon. Image default is the Playwright
// image (Node 22 + Chromium) so browser checks work; override with AGENT_DOCKER_IMAGE.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { LocalSandbox, capOutput, freePort, OUTPUT_CAP } from "./local.mjs";
import { LIMITS } from "../contract.mjs";

export const DEFAULT_IMAGE = process.env.AGENT_DOCKER_IMAGE || "mcr.microsoft.com/playwright:v1.55.0-noble";
const INTERNAL_PORT = 3000;

/** spawn without a shell on the host; captures capped output; hard timeout. */
export function runArgs(bin, args, { timeoutMs = 60_000, env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(bin, args, { env: env ? { ...process.env, ...env } : process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (d) => { if (stdout.length < OUTPUT_CAP * 2) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < OUTPUT_CAP * 2) stderr += d; });
    child.on("error", (err) => { clearTimeout(timer); resolve({ code: 127, stdout, stderr: `${stderr}${err.message}`, timedOut, ms: Date.now() - started }); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 137 : 1), stdout: capOutput(stdout), stderr: capOutput(stderr), timedOut, ms: Date.now() - started });
    });
  });
}

function envArgs(env = {}) {
  return Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
}

export class DockerSandbox extends LocalSandbox {
  constructor({ root, name, image, docker = "docker", network = "none", hostPort }) {
    super({ root });
    this.kind = "docker";
    this.name = name;
    this.image = image;
    this.docker = docker;
    this.network = network;
    this.hostPort = hostPort;
  }

  static async create({ jobId = `job-${Date.now().toString(36)}`, baseDir, image = DEFAULT_IMAGE, docker = "docker", network = "none", memory = "1g", cpus = "1", pids = "256" } = {}) {
    const local = await LocalSandbox.create({ jobId, baseDir });
    const name = `fenix-agent-${jobId.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 60);
    const hostPort = await freePort();
    await mkdir(join(local.root, ".fenix", "data"), { recursive: true });
    const args = [
      "run", "-d", "--rm", "--name", name,
      "-v", `${local.root}:/work`, "-w", "/work",
      "--memory", memory, "--cpus", cpus, "--pids-limit", pids,
      "--network", network === "none" ? "bridge" : network, // port publishing needs a network; egress is blocked below
      "-p", `127.0.0.1:${hostPort}:${INTERNAL_PORT}`,
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "-e", "HOME=/work", "-e", "NO_COLOR=1", "-e", "CI=1",
      image, "sleep", "infinity",
    ];
    const started = await runArgs(docker, args, { timeoutMs: 120_000 });
    if (started.code !== 0) {
      await local.destroy();
      throw new Error(`docker run fallito: ${started.stderr || started.stdout}`);
    }
    const sandbox = new DockerSandbox({ root: local.root, name, image, docker, network, hostPort });
    if (network === "none") {
      // Bridge network is required to publish the port; block outbound traffic from inside instead.
      await sandbox.exec({ cmd: "command -v iptables >/dev/null 2>&1 && iptables -P OUTPUT DROP && iptables -A OUTPUT -o lo -j ACCEPT || true", timeoutMs: 10_000 });
    }
    return sandbox;
  }

  async exec({ cmd, timeoutMs = LIMITS.maxCommandSeconds * 1000, env = {}, cwd }) {
    const inner = `timeout -s KILL ${Math.ceil(timeoutMs / 1000)} sh -c ${shellQuote(cmd)}`;
    const args = ["exec", "-w", cwd ? `/work/${cwd}` : "/work", ...envArgs(env), this.name, "sh", "-c", inner];
    const result = await runArgs(this.docker, args, { timeoutMs: timeoutMs + 5000 });
    return { ...result, timedOut: result.timedOut || result.code === 137 };
  }

  async spawnServer({ cmd = "node server.mjs", env = {}, healthPath = "/health", timeoutMs = LIMITS.serverStartSeconds * 1000 } = {}) {
    await this.stopServer();
    const logPath = ".fenix/server.log";
    const launch = `cd /work && (${cmd}) > ${logPath} 2>&1 & echo $!`;
    const started = await this.exec({
      cmd: launch,
      env: { PORT: String(INTERNAL_PORT), HOST: "0.0.0.0", DATA_DIR: "/work/.fenix/data", NODE_ENV: "development", ...env },
      timeoutMs: 10_000,
    });
    const pid = Number(started.stdout.trim().split(/\s+/).pop());
    const url = `http://127.0.0.1:${this.hostPort}`;
    const deadline = Date.now() + timeoutMs;
    let lastError = "";
    let ok = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}${healthPath}`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) { ok = true; break; }
        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    const readLogs = async () => (await this.exec({ cmd: `cat ${logPath} 2>/dev/null | tail -c ${OUTPUT_CAP}`, timeoutMs: 5000 })).stdout;
    const handle = {
      port: this.hostPort,
      url,
      logs: () => this._lastLogs || "",
      alive: () => true,
      stop: async () => {
        this._lastLogs = await readLogs();
        if (Number.isFinite(pid)) await this.exec({ cmd: `kill -TERM -${pid} 2>/dev/null || kill -TERM ${pid} 2>/dev/null; sleep 0.2; kill -KILL ${pid} 2>/dev/null; true`, timeoutMs: 5000 });
        if (this.server === handle) this.server = null;
      },
    };
    if (!ok) {
      const logs = await readLogs();
      await handle.stop();
      return { ok: false, error: `Health non raggiunto entro ${timeoutMs} ms (${lastError}).`, logs };
    }
    this.server = handle;
    return { ok: true, port: this.hostPort, url };
  }

  serverLogs() {
    return this._lastLogs || "";
  }

  internalServerUrl() {
    return this.server ? `http://127.0.0.1:${INTERNAL_PORT}` : null;
  }

  async destroy() {
    await this.stopServer();
    await runArgs(this.docker, ["rm", "-f", this.name], { timeoutMs: 30_000 });
    await super.destroy();
  }
}

export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
