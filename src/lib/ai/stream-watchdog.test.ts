import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createStreamWatchdog, isAbortError, STREAM_IDLE_MS, STREAM_MAX_MS } from "./stream-watchdog.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("stream watchdog", () => {
  it("does not abort while chunks keep arriving, even past the old 180 s budget", async () => {
    const w = createStreamWatchdog({ idleMs: 40, maxMs: 10_000 });
    for (let i = 0; i < 8; i += 1) { await sleep(15); w.touch(); }
    assert.equal(w.signal.aborted, false);
    assert.equal(w.reason, null);
    w.stop();
    await sleep(60);
    assert.equal(w.signal.aborted, false, "stopped watchdog never fires");
  });

  it("aborts with reason idle when no bytes arrive", async () => {
    const w = createStreamWatchdog({ idleMs: 30, maxMs: 10_000 });
    await sleep(70);
    assert.equal(w.signal.aborted, true);
    assert.equal(w.reason, "idle");
    assert.match(w.message || "", /Timeout di generazione: nessun dato/);
    w.stop();
  });

  it("aborts with reason max when the stream outlives the hard cap", async () => {
    const w = createStreamWatchdog({ idleMs: 1_000, maxMs: 40 });
    const keepAlive = setInterval(() => w.touch(), 5);
    await sleep(90);
    clearInterval(keepAlive);
    assert.equal(w.reason, "max");
    assert.match(w.message || "", /superato/);
    w.stop();
  });

  it("touch after abort does not resurrect the signal; defaults are sane", () => {
    const w = createStreamWatchdog({ idleMs: 1, maxMs: 1 });
    w.stop();
    w.touch();
    assert.equal(w.reason, null);
    assert.ok(STREAM_IDLE_MS >= 30_000 && STREAM_IDLE_MS <= 90_000);
    assert.ok(STREAM_MAX_MS >= 8 * 60_000);
    assert.equal(isAbortError(Object.assign(new Error("x"), { name: "AbortError" })), true);
    assert.equal(isAbortError(new Error("stream idle")), true);
    assert.equal(isAbortError(new Error("HTML non valido")), false);
  });
});
