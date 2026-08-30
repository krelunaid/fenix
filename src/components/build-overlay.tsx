import { Check } from "lucide-react";
import { useTalkingKit } from "@/lib/kit-voice";
import { cn } from "@/lib/utils";

export function BuildOverlay({
  active,
  steps,
}: {
  active: boolean;
  steps: string[];
}) {
  const levels = useTalkingKit(active);
  if (!active) return null;
  const current = steps[steps.length - 1] ?? "Fenix sta lavorando";
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
        <p className="mt-5 text-center text-[13px] font-medium tracking-tight text-[#9b93c2]">
          Fenix sta costruendo
        </p>
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
        <p className="mt-4 text-center text-[11px] text-[#6e6794]">
          Puoi aprire Chat o Codice. Se dopo 10 minuti è fermo, ricarica: spesso l'app sotto c'è già.
        </p>
      </div>
    </div>
  );
}
