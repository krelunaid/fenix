// In-memory job store with bounded concurrency, TTL cleanup and abort support.
// Lessons from the visual worker: caller-bound jobs, random ids, no unbounded maps.
import { randomUUID } from "node:crypto";

export class JobStore {
  constructor({ concurrency = 2, maxQueued = 20, ttlMs = 60 * 60_000, maxEvents = 400 } = {}) {
    this.jobs = new Map();
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
          this.pump();
        });
    }
    this.queue.forEach((q, i) => { q.job.position = i + 1; });
  }

  sweep(now = Date.now()) {
    for (const [id, job] of this.jobs) {
      if (job.endedAt && now - job.endedAt > this.ttlMs) this.jobs.delete(id);
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
