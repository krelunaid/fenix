// In-memory job store with bounded concurrency, TTL cleanup and abort support.
// Lessons from the visual worker: caller-bound jobs, random ids, no unbounded maps.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export class JobStore {
  constructor({ concurrency = 2, maxQueued = 20, ttlMs = 60 * 60_000, maxEvents = 400, dataDir = null, diskTtlMs = 7 * 24 * 60 * 60_000 } = {}) {
    this.jobs = new Map();
    /** When set, finished jobs are also written to <dataDir>/jobs/<id>.json and survive restarts. */
    this.dataDir = dataDir;
    this.diskTtlMs = diskTtlMs;
    this.queue = [];
    this.running = 0;
    this.concurrency = concurrency;
    this.maxQueued = maxQueued;
    this.ttlMs = ttlMs;
    this.maxEvents = maxEvents;
    this.timer = setInterval(() => this.sweep(), 60_000);
    this.timer.unref?.();
  }

  create({ owner, input, run }) {
    const queued = this.queue.length;
    if (queued >= this.maxQueued) throw Object.assign(new Error("Troppi lavori in coda. Riprova tra poco."), { status: 429 });
    const job = {
      id: randomUUID(),
      owner,
      input,
      status: "queued",
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      events: [],
      result: null,
      error: null,
      abort: new AbortController(),
      position: queued + 1,
    };
    this.jobs.set(job.id, job);
    this.queue.push({ job, run });
    this.pump();
    return job;
  }

  get(id, owner) {
    const job = this.jobs.get(id);
    if (!job || job.owner !== owner) return null;
    return job;
  }

  /** Like get(), but also finds finished jobs persisted on disk (read-only view). */
  async find(id, owner) {
    const live = this.get(id, owner);
    if (live) return live;
    if (!this.dataDir || !/^[A-Za-z0-9-]{8,64}$/.test(id)) return null;
    try {
      const raw = JSON.parse(await readFile(join(this.dataDir, "jobs", `${id}.json`), "utf8"));
      if (!raw || raw.owner !== owner) return null;
      return { ...raw, abort: new AbortController(), fromDisk: true };
    } catch {
      return null;
    }
  }

  async persist(job) {
    if (!this.dataDir) return;
    try {
      const dir = join(this.dataDir, "jobs");
      await mkdir(dir, { recursive: true });
      const snapshot = {
        id: job.id, owner: job.owner, input: job.input, status: job.status,
        createdAt: job.createdAt, startedAt: job.startedAt, endedAt: job.endedAt,
        events: job.events, result: job.result, error: job.error,
      };
      const tmp = join(dir, `${job.id}.json.tmp`);
      await writeFile(tmp, JSON.stringify(snapshot), "utf8");
      await rename(tmp, join(dir, `${job.id}.json`));
    } catch (err) {
      console.error("[fenix-agent] job persist failed", err);
    }
  }

  cancel(id, owner) {
    const job = this.get(id, owner);
    if (!job) return false;
    if (job.status === "queued") {
      this.queue = this.queue.filter((q) => q.job !== job);
      job.status = "cancelled";
      job.endedAt = Date.now();
    } else if (job.status === "running") {
      job.abort.abort();
    }
    return true;
  }

  pump() {
    while (this.running < this.concurrency && this.queue.length) {
      const { job, run } = this.queue.shift();
      this.running += 1;
      job.status = "running";
      job.startedAt = Date.now();
      const onEvent = (e) => {
        job.events.push(e);
        if (job.events.length > this.maxEvents) job.events.splice(0, job.events.length - this.maxEvents);
      };
      Promise.resolve()
        .then(() => run({ job, onEvent, signal: job.abort.signal }))
        .then((result) => {
          job.result = result;
          job.status = job.abort.signal.aborted ? "cancelled" : result?.ok ? "ok" : "failed";
        })
        .catch((err) => {
          job.error = err instanceof Error ? err.message : String(err);
          job.status = "failed";
        })
        .finally(() => {
          job.endedAt = Date.now();
          this.running -= 1;
          void this.persist(job);
          this.pump();
        });
    }
    this.queue.forEach((q, i) => { q.job.position = i + 1; });
  }

  sweep(now = Date.now()) {
    for (const [id, job] of this.jobs) {
      if (job.endedAt && now - job.endedAt > this.ttlMs) this.jobs.delete(id);
    }
    void this.sweepDisk(now);
  }

  async sweepDisk(now = Date.now()) {
    if (!this.dataDir) return;
    const dir = join(this.dataDir, "jobs");
    let names = [];
    try { names = await readdir(dir); } catch { return; }
    for (const n of names) {
      if (!n.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(await readFile(join(dir, n), "utf8"));
        if (raw?.endedAt && now - raw.endedAt > this.diskTtlMs) await rm(join(dir, n), { force: true });
      } catch { /* skip unreadable */ }
    }
  }

  publicView(job, { full = false } = {}) {
    return {
      id: job.id,
      status: job.status,
      position: job.status === "queued" ? job.position : undefined,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      endedAt: job.endedAt,
      events: full ? job.events : job.events.slice(-40),
      error: job.error,
      result: job.result
        ? {
            outcome: job.result.outcome,
            ok: job.result.ok,
            summary: job.result.summary,
            checks: job.result.checks,
            stats: job.result.stats,
            files: full ? job.result.files : job.result.files?.map((f) => ({ path: f.path, bytes: f.bytes })),
          }
        : null,
    };
  }

  close() {
    clearInterval(this.timer);
  }
}
