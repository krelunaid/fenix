// Docker sandbox: one container per job, no host mounts or published ports.
// File I/O, server requests and commands remain inside the networkless container.
//
// Requirements on the host: docker CLI + daemon. Image default is the Playwright
// image (Node 22 + Chromium) so browser checks work; override with AGENT_DOCKER_IMAGE.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { capOutput, OUTPUT_CAP } from "./local.mjs";
import { LIMITS, canonicalizePath } from "../contract.mjs";
import { ContainerFiles } from "./container-files.mjs";

export const DEFAULT_IMAGE = process.env.AGENT_DOCKER_IMAGE || "fenix-agent-sandbox:local";
const INTERNAL_PORT = 3000;

/** spawn without a shell on the host; captures capped output; hard timeout. */
export function runArgs(bin, args, { timeoutMs = 60_000, env, input = '', outputCap = OUTPUT_CAP } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(bin, args, { env: env ? { ...process.env, ...env } : process.env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.on('error',()=>{});
    child.stdin.end(input);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (d) => { if (stdout.length < outputCap * 2) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < OUTPUT_CAP * 2) stderr += d; });
    child.on("error", (err) => { clearTimeout(timer); resolve({ code: 127, stdout, stderr: `${stderr}${err.message}`, timedOut, ms: Date.now() - started }); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 137 : 1), stdout: capOutput(stdout, outputCap), stderr: capOutput(stderr), timedOut, ms: Date.now() - started });
    });
  });
}

function envArgs(env = {}) {
  return Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
}

export class DockerSandbox extends ContainerFiles {
  constructor({ root, name, image, docker = "docker", network = "none", hostPort }) {
    super();
    this.server = null;
    this.closed = false;
    this.kind = "docker";
    this.name = name;
    this.image = image;
    this.docker = docker;
    this.network = network;
    this.hostPort = hostPort;
  }

  static async create({ jobId = `job-${Date.now().toString(36)}`, baseDir, image = DEFAULT_IMAGE, docker = "docker", network = "none", memory = "1g", cpus = "1", pids = "256" } = {}) {
    if(network !== 'none') throw new Error('Sandbox requires network=none');
    const name = `fenix-agent-${randomUUID()}`;
    const hostPort = INTERNAL_PORT;
    const args = [
      "run", "-d", "--rm", "--name", name,
      "--read-only", "--user", "1000:1000", "--init",
      "--tmpfs", "/work:rw,nosuid,nodev,size=128m,uid=1000,gid=1000",
      "--tmpfs", "/tmp:rw,nosuid,nodev,size=128m,uid=1000,gid=1000", "-w", "/work",
      "--memory", memory, "--cpus", cpus, "--pids-limit", pids,
      "--network", "none",
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "-e", "HOME=/work", "-e", "NO_COLOR=1", "-e", "CI=1",
      image, "sleep", "infinity",
    ];
    const started = await runArgs(docker, args, { timeoutMs: 120_000 });
    if (started.code !== 0) {
      throw new Error(`docker run fallito: ${started.stderr || started.stdout}`);
    }
    const sandbox = new DockerSandbox({ name, image, docker, network, hostPort });
    try { await sandbox.writeRuntimeFile('ready','ready'); }
    catch(e) { await sandbox.destroy(); throw e; }
    return sandbox;
  }

  async exec({ cmd, timeoutMs = LIMITS.maxCommandSeconds * 1000, env = {}, cwd }) {
    if(this.closed)throw Error('Sandbox closed');
    const inner = `timeout -s KILL ${Math.ceil(timeoutMs / 1000)} sh -c ${shellQuote(cmd)}`;
    const args = ["exec", "-w", cwd ? `/work/${canonicalizePath(cwd)}` : "/work", ...envArgs(env), this.name, "sh", "-c", inner];
    const result = await runArgs(this.docker, args, { timeoutMs: timeoutMs + 5000 });
    if(result.timedOut || result.code === 137 || result.code === 124) await this.cancel();
    return { ...result, timedOut: result.timedOut || result.code === 137 };
  }

  async spawnServer({ cmd = "node server.mjs", env = {}, healthPath = "/health", timeoutMs = LIMITS.serverStartSeconds * 1000 } = {}) {
    await this.stopServer();
    const logPath = ".fenix/server.log";
    const launch = `mkdir -p /work/.fenix/data; cd /work; setsid sh -c ${shellQuote(cmd)} > ${logPath} 2>&1 < /dev/null & echo $!`;
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
        const res = await this.fetch(healthPath);
        if (res.status === 200) { ok = true; break; }
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
        if (Number.isSafeInteger(pid) && pid > 1) await this.exec({ cmd: `kill -KILL -${pid} 2>/dev/null; true`, timeoutMs: 5000 });
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
    await this.cancel();
  }

  async stopServer() { if(this.server && !this.closed) await this.server.stop(); this.server=null; }
  async cancel() {
    if(this.closed)return;
    this.closed=true;this.server=null;
    const r=await runArgs(this.docker,['rm','-f',this.name],{timeoutMs:30000});
    if(r.code!==0){this.closed=false;throw Error('Container cleanup failed: '+r.stderr);}
  }
  async containerNode(code, input) {
    if(this.closed)throw Error('Sandbox closed');
    const r=await runArgs(this.docker,['exec','-i',this.name,'node','-e',code],{input:JSON.stringify(input),timeoutMs:10000,outputCap:LIMITS.maxProjectBytes*2});
    if(r.code!==0 || r.timedOut)throw Error('Container operation failed: '+r.stderr);
    return JSON.parse(r.stdout);
  }
  async fetch(path, init={}) {
    if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('Invalid local path');
    return this.containerNode(`const fs=require('node:fs');const q=JSON.parse(fs.readFileSync(0,'utf8'));(async()=>{const r=await fetch('http://127.0.0.1:3000'+q.path,{...q.init,redirect:'error',signal:AbortSignal.timeout(3000)});const text=await r.text();if(text.length>64000)throw Error('response too large');console.log(JSON.stringify({status:r.status,headers:Object.fromEntries(r.headers),text}));})().catch(e=>{console.error(e.message);process.exitCode=1})`,{path,init});
  }
}

export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
