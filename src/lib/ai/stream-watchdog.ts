/**
 * Abort signal for a streamed generation that only fires when the stream is
 * actually stuck. A fixed `AbortSignal.timeout(180 s)` killed healthy long
 * generations (a 20k-token app takes 4–6 minutes at model speed) and made the
 * Studio show the fallback seed with "Timeout di generazione". The edge function
 * sends a `: ping` heartbeat every 4 s, so "no bytes for `idleMs`" means the
 * connection is dead; `maxMs` is only a safety net against a runaway model.
 */
export type StreamWatchdog = {
  signal: AbortSignal;
  /** Call on every chunk received. */
  touch: () => void;
  /** Stop timers (call in `finally`). */
  stop: () => void;
  /** Why the watchdog aborted, if it did. */
  readonly reason: "idle" | "max" | null;
  /** Human message for the reason (Italian, user-facing). */
  readonly message: string | null;
};

export const STREAM_IDLE_MS = 45_000;
export const STREAM_MAX_MS = 12 * 60_000;

export function createStreamWatchdog({
  idleMs = STREAM_IDLE_MS,
  maxMs = STREAM_MAX_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: {
  idleMs?: number;
  maxMs?: number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
} = {}): StreamWatchdog {
  const controller = new AbortController();
  let reason: "idle" | "max" | null = null;
  let idle: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const abort = (why: "idle" | "max") => {
    if (stopped || controller.signal.aborted) return;
    reason = why;
    controller.abort(new Error(why === "idle" ? "stream idle" : "stream max"));
  };
  const max = setTimer(() => abort("max"), maxMs);
  const arm = () => {
    if (idle) clearTimer(idle);
    idle = setTimer(() => abort("idle"), idleMs);
  };
  arm();
  return {
    signal: controller.signal,
    touch: () => { if (!stopped && !controller.signal.aborted) arm(); },
    stop: () => {
      stopped = true;
      if (idle) clearTimer(idle);
      clearTimer(max);
    },
    get reason() { return reason; },
    get message() {
      if (reason === "idle") return `Timeout di generazione: nessun dato dal modello per ${Math.round(idleMs / 1000)} s. Riprova.`;
      if (reason === "max") return `Timeout di generazione: il modello ha superato ${Math.round(maxMs / 60_000)} minuti. Riprova con un brief più corto.`;
      return null;
    },
  };
}

/** True for the DOM/undici abort errors a watchdog abort produces. */
export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return e.name === "AbortError" || /aborted|stream idle|stream max/i.test(String(e.message || ""));
}
