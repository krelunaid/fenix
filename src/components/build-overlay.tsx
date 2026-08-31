import { useEffect, useState } from "react";
import { Check, Volume2, VolumeX } from "lucide-react";
import { useTalkingKit } from "@/lib/kit-voice";
import { BUILD_STAGES, inferStage } from "@/lib/projects/build-stages";
import { cn } from "@/lib/utils";

const MUTE_KEY = "fenix-kit-muted";

export function BuildOverlay({
  active,
  compact = false,
  steps,
}: {
  active: boolean;
  compact?: boolean;
  steps: string[];
}) {
  const [muted, setMuted] = useState(() => {
    try {
      return sessionStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const levels = useTalkingKit(active && !muted);
  const stage = inferStage(steps);
  const current = steps[steps.length - 1] ?? BUILD_STAGES[stage];

  useEffect(() => {
    try {
      sessionStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [muted]);

  if (!active) return null;

  const leds = (
    <div className="kit-leds flex h-7 items-end gap-[2px]" aria-hidden>
      {levels.map((n, i) => (
        <span
          key={i}
          className="kit-led w-[5px] rounded-sm"
          style={{ height: `${6 + n * 18}px` }}
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

  if (compact) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3">
        <div className="pointer-events-auto flex max-w-[min(100%,36rem)] items-center gap-3 rounded-2xl border border-white/12 bg-[#120c28]/92 px-3 py-2 shadow-soft backdrop-blur-md">
          <img src="/fenix-orb.png" alt="" className="kit-orb h-8 w-auto" />
          {leds}
          <div className="min-w-0 flex-1">
            <ol className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] tracking-[0.12em] uppercase">
              {BUILD_STAGES.map((label, i) => (
                <li
                  key={label}
                  className={cn(
                    i < stage && "text-[#6e6794]",
                    i === stage && "text-white",
                    i > stage && "text-[#6e6794]/70",
                  )}
                >
                  {label}
                </li>
              ))}
            </ol>
            <p className="truncate text-xs text-[#cfc8ea]">{current}</p>
          </div>
          {muteBtn}
        </div>
      </div>
    );
  }

  const done = steps.slice(0, -1);

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-[#07041a]/88 px-6 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#120c28]/95 px-6 py-7">
        <div className="flex flex-col items-center">
          <img
            src="/fenix-orb.png"
            alt=""
            className="kit-orb h-[120px] w-auto bg-transparent"
          />
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
        <ol className="mt-5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] tracking-[0.14em] text-[#9b93c2] uppercase">
          {BUILD_STAGES.map((label, i) => (
            <li key={label} className={cn(i === stage && "text-white")}>
              {label}
            </li>
          ))}
        </ol>
        <p className={cn("mt-2 text-center text-xl font-semibold tracking-tight", "shimmer-text")}>
          {current}
        </p>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#cfc8ea]">
          Ci vogliono circa 5–10 minuti. Pazienza: sta scrivendo le schermate e guardando i pixel. Non chiudere.
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
          <p className="text-center text-[11px] text-[#6e6794]">
            Se dopo 10 minuti è fermo, ricarica. La bozza resta sotto.
          </p>
        </div>
      </div>
    </div>
  );
}
