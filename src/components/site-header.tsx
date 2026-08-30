import { Link } from "@tanstack/react-router";
import { CreditMeter } from "@/components/credit-meter";
import { Wordmark } from "@/components/wordmark";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />;
  }
  if (user) {
    return (
      <SignedIn>
        <UserButton />
      </SignedIn>
    );
  }
  return (
    <SignedOut>
      <Link
        to="/login"
        className="inline-flex h-9 items-center rounded-full bg-white px-3.5 text-xs font-semibold text-[#1d1d1f] no-underline hover:opacity-90"
      >
        Accedi
      </Link>
    </SignedOut>
  );
}

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
        <CreditMeter className="ml-1" />
        <AuthSlot />
      </nav>
    </header>
  );
}
