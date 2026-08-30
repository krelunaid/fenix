import { Link } from "@tanstack/react-router";
import { CreditMeter } from "@/components/credit-meter";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 px-6 py-5 sm:px-10",
        className,
      )}
    >
      <Wordmark />
      <nav className="flex items-center gap-1 text-sm">
        <Link
          to="/vetrina"
          className="inline-flex h-10 min-h-11 items-center rounded-full px-3 text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground"
        >
          Vetrina
        </Link>
        <a
          href="https://www.kreluna.it"
          className="hidden h-10 min-h-11 items-center rounded-full px-3 text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground sm:inline-flex"
        >
          Kreluna
        </a>
        <a
          href="https://helix.kreluna.it"
          className="hidden h-10 min-h-11 items-center rounded-full px-3 text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground sm:inline-flex"
        >
          Helix
        </a>
        <CreditMeter className="ml-1" />
      </nav>
    </header>
  );
}
