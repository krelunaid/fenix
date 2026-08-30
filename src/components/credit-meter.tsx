import { CREDITS_GRANT, creditsLabel } from "@/lib/projects/credits";
import { useProjectStore } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

export function CreditMeter({ className }: { className?: string }) {
  const remaining = useProjectStore((s) => s.creditsRemaining);
  const hydrated = useProjectStore((s) => s.hydrated);
  if (!hydrated) return null;

  return (
    <p
      className={cn(
        "inline-flex h-10 min-h-11 items-center rounded-full border border-border bg-card px-3.5 text-sm tabular-nums",
        remaining < 1 ? "text-destructive" : "text-foreground",
        className,
      )}
      title="Creare usa 3 crediti, una modifica 2"
    >
      {creditsLabel(remaining, CREDITS_GRANT)} crediti
    </p>
  );
}
