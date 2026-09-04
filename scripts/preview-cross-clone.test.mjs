import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { looksLikePreviewChild, looksLikePreviewLeader, probePort } from "./preview.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PID_FILE = join(ROOT, ".grok/preview.pid");
const PREVIEW_BIN = join(ROOT, "scripts/preview.mjs");

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHeld(ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await probePort()) return true;
    await sleep(50);
  }
  return false;
}

async function waitFree(ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!(await probePort())) return true;
    await sleep(50);
  }
  return false;
}

function pgidOf(pid) {
  try {
    return Number.parseInt(
      execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], {
        encoding: "utf8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
      10,
    );
  } catch {
    return null;
  }
}

function cmdlineOf(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean).join(" ");
  } catch {
    /* macOS */
  }
  try {
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function childrenOf(ppid) {
  const kids = [];
  try {
    for (const name of readdirSync("/proc")) {
      if (!/^\d+$/.test(name)) continue;
      try {
        const stat = readFileSync(`/proc/${name}/stat`, "utf8");
        const end = stat.lastIndexOf(") ");
        const pp = Number.parseInt(stat.slice(end + 2).split(/\s+/)[1], 10);
        if (pp === ppid) kids.push(Number(name));
      } catch {
        /* skip */
      }
    }
  } catch {
    try {
      return execFileSync("ps", ["-o", "pid=", "--ppid", String(ppid)], {
        encoding: "utf8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .trim()
        .split(/\s+/)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => n > 1);
    } catch {
      return [];
    }
  }
  return kids;
}

function killTree(pid) {
  if (!pid) return;
  const pgid = pgidOf(pid);
  if (pgid && pgid > 1) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
  if (alive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }
}

function listenPids() {
  try {
    const out = execFileSync("lsof", ["-nP", "-iTCP:8081", "-sTCP:LISTEN"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return [
      ...new Set(
        out
          .split("\n")
          .slice(1)
          .map((l) => Number.parseInt(l.trim().split(/\s+/)[1], 10))
          .filter((n) => n > 1),
      ),
    ];
  } catch {
    return [];
  }
}

async function waitPreviewChild(leaderPid, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const kids = childrenOf(leaderPid);
    for (const kid of kids) {
      const cmd = cmdlineOf(kid);
      if (looksLikePreviewChild(cmd) || /vite(?:\.js)?/.test(cmd)) return kid;
    }
    const pids = listenPids().filter((p) => p !== leaderPid);
    for (const pid of pids) {
      const cmd = cmdlineOf(pid);
      if (looksLikePreviewChild(cmd) || /vite(?:\.js)?/.test(cmd)) return pid;
    }
    await sleep(50);
  }
  return childrenOf(leaderPid)[0] ?? listenPids().find((p) => p !== leaderPid) ?? null;
}

test("clone B restart kills clone A's vite.js preview group and takes 8081", async () => {
  execFileSync(process.execPath, [PREVIEW_BIN, "stop"], { cwd: ROOT, stdio: "ignore" });
  assert.equal(await waitFree(), true, "8081 still held after stop");

  const cloneA = mkdtempSync(join(tmpdir(), "fenix-preview-a-"));
  mkdirSync(join(cloneA, "scripts"));
  mkdirSync(join(cloneA, "node_modules/vite/bin"), { recursive: true });
  writeFileSync(
    join(cloneA, "node_modules/vite/bin/vite.js"),
    `import http from "node:http";
http.createServer((_q, r) => { r.writeHead(200); r.end("clone-a"); }).listen(8081, "127.0.0.1");
`,
  );
  writeFileSync(
    join(cloneA, "scripts/with-app-env.mjs"),
    `import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vite = join(root, "node_modules/vite/bin/vite.js");
const child = spawn(process.execPath, [vite, "preview"], { stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
`,
  );

  const leader = spawn(
    process.execPath,
    [join(cloneA, "scripts/with-app-env.mjs"), "vite", "preview"],
    { cwd: cloneA, detached: true, stdio: "ignore" },
  );
  leader.unref();
  const leaderPid = leader.pid;
  assert.ok(leaderPid);
  const leaderPgid = pgidOf(leaderPid) ?? leaderPid;
  let childPid = null;

  try {
    assert.equal(await waitHeld(), true, "clone A did not bind 8081");
    const fromA = await fetch("http://127.0.0.1:8081/").then((r) => r.text());
    assert.equal(fromA, "clone-a");
    childPid = await waitPreviewChild(leaderPid);
    const childCmd = childPid ? cmdlineOf(childPid) : "";
    const leaderCmd = cmdlineOf(leaderPid);
    // Leader is `with-app-env.mjs vite preview`; the listener is the vite.js child.
    assert.match(leaderCmd, /with-app-env\.mjs/);
    assert.equal(looksLikePreviewLeader(leaderCmd), true);
    if (childCmd) {
      assert.match(childCmd, /vite(?:\.js)?(?:\s+preview|\s*$)/);
      assert.equal(looksLikePreviewChild(childCmd), true);
    } else {
      assert.match(leaderCmd, /with-app-env\.mjs.*\bvite\s+preview\b/);
    }

    writeFileSync(PID_FILE, "99999\n"); // stale pidfile in clone B
    const restart = spawn(process.execPath, [PREVIEW_BIN, "restart"], {
      cwd: ROOT,
      env: { ...process.env, FENIX_PREVIEW_REQUIRE_CMDLINE: "1" },
      stdio: "ignore",
    });
    const code = await new Promise((resolve) => restart.on("exit", resolve));
    assert.equal(code, 0, "clone B preview.mjs restart failed");
    const deadBy = Date.now() + 8000;
    while (alive(leaderPid) && Date.now() < deadBy) await sleep(50);
    assert.equal(alive(leaderPid), false, "clone A leader still alive");
    if (childPid) {
      while (alive(childPid) && Date.now() < deadBy) await sleep(50);
      assert.equal(alive(childPid), false, "clone A vite.js child still alive");
    }
    assert.equal(await waitHeld(12000), true, "clone B did not take 8081");
    const body = await fetch("http://127.0.0.1:8081/").then((r) => r.text());
    assert.notEqual(body, "clone-a");
    if (existsSync(PID_FILE)) {
      const bPid = Number.parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
      assert.ok(bPid > 1 && bPid !== leaderPid);
    }
  } finally {
    killTree(leaderPgid);
    killTree(leaderPid);
    killTree(childPid);
    for (const pid of listenPids()) {
      const cmd = cmdlineOf(pid);
      if (cmd.includes(cloneA) || pid === childPid || pid === leaderPid) killTree(pid);
    }
    try {
      const leftover = await fetch("http://127.0.0.1:8081/")
        .then((r) => r.text())
        .catch(() => "");
      if (leftover === "clone-a") {
        for (const pid of listenPids()) killTree(pid);
      }
    } catch {
      /* port free */
    }
    try {
      rmSync(cloneA, { recursive: true, force: true });
    } catch {
      /* gone */
    }
  }
});
