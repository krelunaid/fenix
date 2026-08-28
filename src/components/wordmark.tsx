import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 text-foreground", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M16 8 L26 22 H6 Z" fill="var(--color-background)" />
    </svg>
  );
}

export function Wordmark({
  className,
  compact = false,
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
        {!compact ? (
          <span className="mt-0.5 text-xs tracking-tight text-muted-foreground">
            Studio visivo
          </span>
        ) : null}
      </span>
    </Link>
  );
}
