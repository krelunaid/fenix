import { useEffect, useRef, useState } from "react";
import { Check, Volume2, VolumeX } from "lucide-react";
import { useTalkingKit } from "@/lib/kit-voice";
import { BUILD_STAGES, inferStage } from "@/lib/projects/build-stages";
import { EXIT_LABEL, isLockFocusAllowed } from "@/lib/projects/studio-lock";
import { cn } from "@/lib/utils";

const MUTE_KEY = "fenix-kit-muted";

export function BuildOverlay({
  active,
  compact = false,
  steps,
  startedAt,
  error,
  onRetry,
  retryLabel = "Riprova. Lo ricostruisco.",
  hasDraft = false,
}: {
  active: boolean;
  compact?: boolean;
  steps: string[];
  startedAt?: number;
  error?: string;
  onRetry?: () => void;
  retryLabel?: string;
  hasDraft?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(() => {
    try {
      return sessionStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  void compact;
  const levels = useTalkingKit(active && !muted);
  const stage = inferStage(steps);
  const current = steps[steps.length - 1] ?? BUILD_STAGES[stage];
  const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt || now)) / 1000));
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);

  useEffect(() => {
    try {
      sessionStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [muted]);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;
    const lockRoot: HTMLElement = root;
    const focusables = () => {
      const back = document.querySelector<HTMLElement>(`[aria-label="${EXIT_LABEL}"]`);
      const inner = [
        ...lockRoot.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === lockRoot);
      const items = [...(back ? [back] : []), ...inner, lockRoot];
      return items.filter((el, i, arr) => arr.indexOf(el) === i);
    };
    const first = focusables().find((el) => el !== document.querySelector(`[aria-label="${EXIT_LABEL}"]`)) ?? lockRoot;
    first.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        lockRoot.focus();
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      if (event.shiftKey) {
        (index <= 0 ? items[items.length - 1] : items[index - 1]).focus();
      } else {
        (index === items.length - 1 || index === -1 ? items[0] : items[index + 1]).focus();
      }
    }
    function onFocusIn(event: FocusEvent) {
      if (isLockFocusAllowed(event.target, lockRoot)) return;
      event.preventDefault();
      lockRoot.focus();
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [active]);

  if (!active && !error) return null;

  if (error && !active) {
    const shell = (
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#120c28] px-6 py-6">
        <p className="text-[10px] tracking-[0.14em] text-[#9b93c2] uppercase">Bloccato</p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-white">{error}</p>
        <p className="mt-2 text-sm leading-relaxed text-[#cfc8ea]">
          {hasDraft
            ? "La bozza stabile resta sotto. Puoi riprovare senza perdere quello che c’è."
            : "Nessuna anteprima ancora. Riprova: il credito di questo tentativo è rimborsato."}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#120c28]"
          >
            {retryLabel}
          </button>
        ) : null}
        {steps.length ? (
          <ul className="mt-4 space-y-1.5">
            {steps.slice(-4).map((s) => (
              <li key={s} className="flex items-center gap-2 text-xs text-[#9b93c2]">
                <Check className="size-3.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
    if (hasDraft) {
      return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3">
          <div className="pointer-events-auto">{shell}</div>
        </div>
      );
    }
    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-[#07041a] px-6">
        {shell}
      </div>
    );
  }

  const progress = (
    <div
      className="mt-1 grid grid-cols-4 gap-1"
      role="progressbar"
      aria-label={`Avanzamento Fenix: ${BUILD_STAGES[stage]}`}
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={stage + 1}
      aria-valuetext={`${BUILD_STAGES[stage]}, tempo trascorso ${elapsed}`}
    >
      {BUILD_STAGES.map((label, i) => (
        <span
          key={label}
          title={label}
          className={cn(
            "h-1 rounded-full bg-white/10",
            i < stage && "bg-[#8576ff]",
            i === stage && "bg-[#b8afff] motion-safe:animate-pulse",
          )}
        />
      ))}
    </div>
  );

  const muteBtn = (
    <button
      type="button"
      onClick={() => setMuted((m) => !m)}
      className="grid size-8 place-items-center rounded-full text-[#9b93c2] hover:text-white"
      aria-label={muted ? "Riattiva audio kit" : "Silenzia kit"}
      title={muted ? "Riattiva" : "Silenzia"}
    >
      {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
    </button>
  );

  const live = (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-fenix-lock-live="1">
      Fenix sta creando. Fase {BUILD_STAGES[stage]}. {current}.
    </div>
  );

  const done = steps.slice(0, -1);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fenix-lock-title"
      data-fenix-lock="1"
      data-lock-stage={BUILD_STAGES[stage]}
      className="absolute inset-0 z-20 grid place-items-center bg-[#07041a] px-6"
    >
      {live}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#120c28] px-6 py-7">
        <div className="flex flex-col items-center">
          <img src="/fenix-orb.png" alt="" className="kit-orb h-[120px] w-auto bg-transparent" />
          <div className="kit-leds mt-1 flex h-10 items-end gap-[3px]" aria-hidden>
            {levels.map((n, i) => (
              <span
                key={i}
                className="kit-led w-[7px] rounded-sm"
                style={{ height: `${8 + n * 28}px` }}
              />
            ))}
          </div>
        </div>
        <p
          id="fenix-lock-title"
          className="mt-5 text-center text-xl font-semibold tracking-tight text-white"
        >
          Fenix sta creando
        </p>
        <ol className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] tracking-[0.14em] text-[#9b93c2] uppercase">
          {BUILD_STAGES.map((label, i) => (
            <li key={label} className={cn(i === stage && "text-white")}>
              {label}
            </li>
          ))}
        </ol>
        {progress}
        <p className={cn("mt-2 text-center text-sm font-medium tracking-tight", "shimmer-text")}>
          {current}
        </p>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#cfc8ea]">
          Ci vogliono circa 5–10 minuti. Pazienza: sta scrivendo le schermate e guardando i pixel.
          Non chiudere. Dopo 10 minuti Fenix si ferma e mostra Riprendi.
        </p>
        {done.length ? (
          <ul className="mt-4 space-y-1.5">
            {done.map((s) => (
              <li key={s} className="flex items-center gap-2 text-xs text-[#9b93c2]">
                <Check className="size-3.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex items-center justify-center gap-2">
          {muteBtn}
          <p className="text-center text-[11px] text-[#9b93c2]">Controllo live · {elapsed}</p>
        </div>
      </div>
    </div>
  );
}
