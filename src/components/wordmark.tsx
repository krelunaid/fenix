import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <img
      src="/fenix-orb.jpg"
      alt=""
      className={cn("size-8 rounded-full object-cover", className)}
    />
  );
}

export function Wordmark({
  className,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      to="/"
      className={cn(
        "inline-flex items-center gap-2.5 text-foreground no-underline",
        className,
      )}
    >
      <Mark />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">FENIX</span>
        <span className="mt-0.5 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          by Kreluna
        </span>
      </span>
    </Link>
  );
}
