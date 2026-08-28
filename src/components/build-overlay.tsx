import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function BuildOverlay({
  active,
  steps,
}: {
  active: boolean;
  steps: string[];
}) {
  if (!active) return null;
  const current = steps[steps.length - 1] ?? "Fenix sta lavorando";
  const done = steps.slice(0, -1);

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 px-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card px-6 py-7">
        <p className="text-[13px] font-medium tracking-tight text-muted-foreground">
          Fenix sta costruendo
        </p>
        <p className={cn("mt-3 text-2xl font-semibold tracking-tight", "shimmer-text")}>
          {current}
        </p>
        {done.length ? (
          <ul className="mt-4 space-y-1.5">
            {done.map((s) => (
              <li
                key={s}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Check className="size-3.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Scrivo l'app e la faccio girare qui. Poi mi parli e la cambio.
        </p>
      </div>
    </div>
  );
}
