import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { test } from "node:test";

const PREVIEW = "http://127.0.0.1:8081";

async function probe(url, ms = 800) {
  try {
    return await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(ms) });
  } catch {
    return null;
  }
}

async function waitOk(url, ms = 30000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    const res = await probe(url, 1500);
    if (res?.ok) return res;
    last = res ? `status ${res.status} for ${url}` : `no listener for ${url}`;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(last || `timeout ${url}`);
}

test("pnpm preview serves home and studio with HTTP 200", async (t) => {
  let child = null;
  const existing = await probe(`${PREVIEW}/`, 600);
  if (!existing) {
    const built = existsSync("dist") || existsSync(".output");
    if (!built) {
      t.skip("nessun bundle: avvia dopo pnpm build");
      return;
    }
    child = spawn("pnpm", ["preview"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });
  }
  try {
    // Clone B (preview-cross-clone) can kill :8081 between probes. Never fetch
    // without a timeout, and never trust a single existing 200.
    const home = await waitOk(`${PREVIEW}/`);
    assert.equal(home.status, 200, `home ${home.status}`);
    const studio = await waitOk(`${PREVIEW}/studio/preview-smoke`);
    assert.equal(studio.status, 200, `studio ${studio.status}`);
  } finally {
    if (child?.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  }
});
