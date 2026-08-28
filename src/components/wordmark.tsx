import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 text-foreground", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.08" />
      <rect
        x="1.2"
        y="1.2"
        width="29.6"
        height="29.6"
        rx="7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.35"
      />
      <path d="M16 8 L26 22 H6 Z" fill="currentColor" />
    </svg>
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
        <span className="text-sm font-semibold tracking-tight">Fenix</span>
        <span className="mt-0.5 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          by Kreluna
        </span>
      </span>
    </Link>
  );
}
