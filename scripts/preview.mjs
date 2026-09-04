#!/usr/bin/env node
/**
 * Owns :8081, the built-output QA preview.
 *
 * `vite preview` is strictPort, so a leftover server both fails the next start
 * and keeps serving a stale build. Restart kills only a verified preview
 * (pidfile whose cmdline still matches, plus attributed :8081 listeners).
 *
 * Linux uses /proc. macOS / CI without /proc uses `lsof` + `ps` and never
 * SIGKILLs an unattributed process.
 *
 *   node scripts/preview.mjs stop|restart
 */
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PREVIEW_PORT = 8081;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PID_FILE = join(ROOT, ".grok/preview.pid");
const LOG_FILE = join(ROOT, ".grok/preview.log");
const READY_TIMEOUT_MS = Number(process.env.PREVIEW_READY_TIMEOUT_MS || 60000);
const GRACE_MS = 3000;
const POLL_MS = 100;

export function parsePreviewArgs(argv) {
  const [action, ...rest] = argv;
  if (!action) return { error: "usage: node scripts/preview.mjs stop|restart" };
  if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
  if (!["stop", "restart"].includes(action)) {
    return { error: `unknown action: ${action} (expected stop or restart)` };
  }
  return { action };
}

export function hasProcFs(exists = existsSync) {
  return exists("/proc/self");
}

export function parsePid(text) {
  const pid = Number.parseInt(String(text ?? "").trim(), 10);
  // pid 1 is the sandbox init — never the preview, and dangerous to signal.
  return Number.isInteger(pid) && pid > 1 ? pid : null;
}

/** pgid of a process from its /proc/<pid>/stat line. */
export function parsePgid(stat) {
  const line = String(stat ?? "");
  // The comm field is parenthesised and may itself contain spaces; state, ppid
  // and pgrp are the three fields after it.
  const end = line.lastIndexOf(") ");
  if (end === -1) return null;
  const pgid = Number.parseInt(line.slice(end + 2).split(/\s+/)[2], 10);
  return Number.isInteger(pgid) && pgid > 0 ? pgid : null;
}

const TCP_LISTEN = "0A";

/** Socket inodes of the LISTEN sockets on `port` in a /proc/net/tcp{,6} dump. */
export function parseListenerInodes(procNetTcp, port) {
  const wanted = `:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  const inodes = [];
  for (const line of String(procNetTcp ?? "").split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 10 || cols[3] !== TCP_LISTEN || !cols[1].endsWith(wanted)) continue;
    if (/^\d+$/.test(cols[9])) inodes.push(cols[9]);
  }
  return inodes;
}

export function parsePsPgid(text) {
  const n = Number.parseInt(String(text ?? "").trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Pids in `lsof -nP -iTCP:<port> -sTCP:LISTEN` output (macOS / BSD). */
export function parseLsofListenPids(text) {
  const pids = [];
  for (const line of String(text ?? "").split("\n")) {
    if (!line.trim() || /^COMMAND\b/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length < 2) continue;
    const pid = parsePid(cols[1]);
    if (pid !== null) pids.push(pid);
  }
  return [...new Set(pids)];
}

/** Real macOS cmdline is `.../vite/bin/vite.js preview`, not `vite preview`. */
export const VITE_PREVIEW_RE = /(?:^|[/\\\s])vite(?:\.js)?\s+preview(?:\s|$)/;

export function looksLikePreviewProcess(cmdline) {
  // /proc/<pid>/cmdline is NUL-separated.
  const argv = String(cmdline ?? "")
    .split("\0")
    .filter(Boolean)
    .join(" ");
  // The sandbox service runs scripts/preview-thumbnail.mjs in this box, and
  // this script can be running concurrently: neither is ever a target.
  if (/\bpreview[\w-]*\.mjs\b/.test(argv)) return false;
  if (/\b(?:npm|pnpm|yarn)\b.*\brun\s+preview:(?:stop|restart)\b/.test(argv)) return false;
  return (
    /\brun\s+preview(?:\s|$)/.test(argv) ||
    /\b(?:npm|pnpm|yarn)\s+preview(?:\s|$)/.test(argv) ||
    VITE_PREVIEW_RE.test(argv)
  );
}

export function looksLikePreviewLeader(cmdline) {
  const argv = String(cmdline ?? "")
    .split("\0")
    .filter(Boolean)
    .join(" ");
  if (!looksLikePreviewProcess(argv)) return false;
  return /with-app-env\.mjs/.test(argv) || /\b(?:npm|pnpm|yarn)\b/.test(argv);
}

export function looksLikePreviewChild(cmdline) {
  const argv = String(cmdline ?? "")
    .split("\0")
    .filter(Boolean)
    .join(" ");
  return looksLikePreviewProcess(argv) && VITE_PREVIEW_RE.test(argv);
}

export function requirePreviewCmdline(env = process.env, proc = hasProcFs) {
  if (env.FENIX_PREVIEW_REQUIRE_CMDLINE === "1") return true;
  if (env.FENIX_PREVIEW_REQUIRE_CMDLINE === "0") return false;
  return !proc();
}

/**
 * Pids to signal. Port owners are owners by definition; the pidfile pid is only
 * a claim left by an earlier run — pids are re-used across hibernate/revive, so
 * signal it only when its command line still looks like the preview.
 *
 * When `pgidOf` is provided, a verified listener child (vite preview) whose
 * leader (with-app-env / npm|pnpm preview) is also preview expands to the
 * group leader so a clone without the pidfile can still SIGTERM the group.
 * Unknown port holders are never added.
 */
export function previewOwners({
  portPids,
  pidFilePid,
  cmdlineOf,
  pgidOf,
  requireCmdline = false,
}) {
  const owners = new Set();

  const consider = (pid) => {
    if (pid == null) return;
    if (requireCmdline && !looksLikePreviewProcess(cmdlineOf(pid))) return;
    owners.add(pid);
    if (typeof pgidOf !== "function") return;
    const cmd = cmdlineOf(pid);
    const leader = parsePid(String(pgidOf(pid) ?? ""));
    if (!leader || leader === pid) return;
    const leaderCmd = cmdlineOf(leader);
    if (looksLikePreviewChild(cmd) && looksLikePreviewLeader(leaderCmd)) {
      owners.add(leader);
    }
  };

  for (const pid of portPids) consider(pid);
  if (
    pidFilePid !== null &&
    !owners.has(pidFilePid) &&
    looksLikePreviewProcess(cmdlineOf(pidFilePid))
  ) {
    consider(pidFilePid);
  }
  return [...owners];
}

async function waitForExit(pids, { isAlive, sleep, timeoutMs, pollMs }) {
  let remaining = pids.filter((pid) => isAlive(pid));
  for (let waited = 0; remaining.length > 0 && waited < timeoutMs; waited += pollMs) {
    await sleep(pollMs);
    remaining = remaining.filter((pid) => isAlive(pid));
  }
  return remaining;
}

/**
 * SIGTERM every live pid, then SIGKILL whatever outlives the grace period.
 * Returns `{ signalled, killed, stubborn }` — `stubborn` is still alive after
 * the SIGKILL wait, which means the port is not reliably free.
 */
export async function terminatePids(
  pids,
  { kill, isAlive, sleep, graceMs = GRACE_MS, pollMs = POLL_MS },
) {
  const signalled = pids.filter((pid) => isAlive(pid));
  for (const pid of signalled) kill(pid, "SIGTERM");
  const killed = await waitForExit(signalled, { isAlive, sleep, timeoutMs: graceMs, pollMs });
  for (const pid of killed) kill(pid, "SIGKILL");
  const stubborn = await waitForExit(killed, { isAlive, sleep, timeoutMs: graceMs, pollMs });
  return { signalled, killed, stubborn };
}

/**
 * What `stop` reports. `after` is the post-kill port check: `unattributed: true`
 * means a listener exists whose pid could not be resolved, so it may not claim
 * the port is free.
 */
export function stopOutcome({ signalled, stubborn, after }) {
  const held = [...new Set([...stubborn, ...after.pids])];
  if (held.length > 0) {
    return { ok: false, error: `port ${PREVIEW_PORT} is still held by pid(s) ${held.join(", ")}` };
  }
  if (after.unattributed) {
    return {
      ok: false,
      error: `port ${PREVIEW_PORT} is held by a process this script cannot see`,
    };
  }
  const message =
    signalled.length > 0
      ? `stopped pid(s) ${signalled.join(", ")} — port ${PREVIEW_PORT} is free`
      : `nothing was listening on ${PREVIEW_PORT}`;
  return { ok: true, message };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

function pgidOf(pid) {
  if (hasProcFs()) {
    try {
      return parsePgid(readFileSync(`/proc/${pid}/stat`, "utf8"));
    } catch {
      return null;
    }
  }
  try {
    const out = execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parsePsPgid(out);
  } catch {
    return null;
  }
}

function killPid(pid, signal) {
  // restart() detaches the server into its own process group, so signal the
  // group to reach `vite` under the `npm` wrapper. Only for a leader: `-pid` on
  // a pid that leads no group still reaches any unrelated group numbered pid.
  if (pgidOf(pid) === pid) {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // The group exited between the pgid read and the signal.
    }
  }
  try {
    process.kill(pid, signal);
  } catch {
    // Exited between the liveness check and the signal.
  }
}

function cmdlineOf(pid) {
  if (hasProcFs()) {
    try {
      return readFileSync(`/proc/${pid}/cmdline`, "utf8");
    } catch {
      return "";
    }
  }
  try {
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function readPidFile() {
  try {
    return parsePid(readFileSync(PID_FILE, "utf8"));
  } catch {
    return null;
  }
}

function pidsForSocketInodes(inodes) {
  const targets = new Set([...inodes].map((inode) => `socket:[${inode}]`));
  const pids = [];
  for (const entry of readdirSync("/proc")) {
    const pid = parsePid(entry);
    if (pid === null || pid === process.pid) continue;
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      // Exited mid-scan, or owned by another user.
      continue;
    }
    for (const fd of fds) {
      try {
        if (targets.has(readlinkSync(`/proc/${pid}/fd/${fd}`))) {
          pids.push(pid);
          break;
        }
      } catch {
        // fd closed mid-scan.
      }
    }
  }
  return pids;
}

function readProcPortOwners() {
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let dump;
    try {
      dump = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const inode of parseListenerInodes(dump, PREVIEW_PORT)) inodes.add(inode);
  }
  const pids = inodes.size > 0 ? pidsForSocketInodes(inodes) : [];
  return { pids, unattributed: inodes.size > 0 && pids.length === 0 };
}

function readLsofPortOwners() {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${PREVIEW_PORT}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { pids: parseLsofListenPids(out), unattributed: false };
  } catch (err) {
    // lsof exits 1 when nothing matches — the port is free.
    if (err && (err.status === 1 || err.code === 1)) return { pids: [], unattributed: false };
    return { pids: [], unattributed: null };
  }
}

/**
 * `{ pids, unattributed }` — `unattributed: true` when the port has a listener
 * whose owning pid could not be resolved. `null` means the scanner itself failed.
 */
function portOwners() {
  if (hasProcFs()) return readProcPortOwners();
  return readLsofPortOwners();
}

export function probePort(port = PREVIEW_PORT, host = "127.0.0.1", timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (held) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(held);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function stop(announce = true) {
  const requireCmdline = requirePreviewCmdline();
  const scanned = portOwners();
  const owners = previewOwners({
    portPids: scanned.pids,
    pidFilePid: readPidFile(),
    cmdlineOf,
    pgidOf,
    requireCmdline,
  });
  const { signalled, stubborn } = await terminatePids(owners, { kill: killPid, isAlive, sleep });

  const after = portOwners();
  let unattributed = after.unattributed === true;
  if (after.unattributed === null || (requireCmdline && after.pids.length === 0)) {
    const held = await probePort();
    if (held && after.pids.length === 0) unattributed = true;
  }
  const outcome = stopOutcome({ signalled, stubborn, after: { pids: after.pids, unattributed } });
  if (!outcome.ok) {
    console.error(`[preview] ${outcome.error}`);
    return false;
  }
  rmSync(PID_FILE, { force: true });
  if (announce) console.log(`[preview] ${outcome.message}`);
  return true;
}

async function waitForReady(failure) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline && failure() === null) {
    try {
      // Any HTTP response means the server is bound; a 404 is still ready.
      await fetch(PREVIEW_URL, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await sleep(250);
    }
  }
  return false;
}

async function restart() {
  if (!(await stop())) return 1;

  mkdirSync(dirname(LOG_FILE), { recursive: true });
  const log = openSync(LOG_FILE, "a");
  const bin = join(ROOT, "node_modules", ".bin");
  const child = spawn(process.execPath, [join(ROOT, "scripts/with-app-env.mjs"), "vite", "preview"], {
    cwd: ROOT,
    detached: true,
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH || ""}` },
    stdio: ["ignore", log, log],
  });
  child.unref();
  writeFileSync(PID_FILE, `${child.pid}\n`);

  let failure = null;
  child.on("error", (err) => {
    failure = `vite preview could not be spawned: ${err.message}`;
  });
  child.on("exit", (code, signal) => {
    failure = `vite preview exited early (${signal ?? `code ${code}`})`;
  });

  if (!(await waitForReady(() => failure))) {
    const secs = Math.round(READY_TIMEOUT_MS / 1000);
    const why =
      failure ??
      `nothing answered on ${PREVIEW_URL} within ${secs}s — check that vite.config.ts ` +
        `still sets preview.port ${PREVIEW_PORT}`;
    console.error(`[preview] ${why} — see ${LOG_FILE}`);
    // A server that binds a few seconds later would serve a build the agent has
    // already been told to distrust.
    await stop(false);
    return 1;
  }
  console.log(`[preview] serving ${PREVIEW_URL} (pid ${child.pid}, log ${LOG_FILE})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parsePreviewArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`[preview] ${args.error}`);
    process.exit(1);
  }
  process.exitCode = args.action === "stop" ? ((await stop()) ? 0 : 1) : await restart();
}
