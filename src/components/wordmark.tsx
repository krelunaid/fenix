import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M16 8.5 L23 18.5 H9 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 13 L20.5 20.5 H11.5 Z"
        fill="currentColor"
      />
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
