import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderKanban,
  HelpCircle,
  Home,
  LayoutGrid,
  Plus,
  Sparkles,
} from "lucide-react";
import { CreditMeter } from "@/components/credit-meter";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/vetrina", label: "I miei progetti", icon: FolderKanban, end: false },
] as const;

export function AppShell({
  children,
  rail,
}: {
  children: ReactNode;
  rail?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="helix-grid min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
        <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border/80 px-4 py-5 lg:flex">
          <Link to="/" className="flex items-center gap-2.5 px-2 no-underline">
            <img
              src="/fenix-orb.jpg"
              alt=""
              className="size-9 rounded-full object-cover"
            />
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight">FENIX</span>
              <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-muted-foreground">
                BY KRELUNA
              </span>
            </span>
          </Link>

          <nav className="mt-8 flex flex-col gap-1 text-sm">
            {NAV.map((item) => {
              const active = item.end
                ? pathname === item.to
                : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 no-underline transition-colors",
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-raised hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <a
              href="#brief"
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-muted-foreground no-underline hover:bg-raised hover:text-foreground"
            >
              <Plus className="size-4" />
              Nuovo progetto
            </a>
            <a
              href="#demo"
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-muted-foreground no-underline hover:bg-raised hover:text-foreground"
            >
              <LayoutGrid className="size-4" />
              Progetti demo
            </a>
            <a
              href="https://www.kreluna.it"
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-muted-foreground no-underline hover:bg-raised hover:text-foreground"
            >
              <Sparkles className="size-4" />
              Prezzi
            </a>
            <a
              href="https://www.kreluna.it"
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-muted-foreground no-underline hover:bg-raised hover:text-foreground"
            >
              <HelpCircle className="size-4" />
              Assistenza
            </a>
          </nav>

          <div className="mt-auto rounded-2xl border border-border bg-card px-3 py-3">
            <p className="text-sm font-medium">Ospite</p>
            <p className="text-xs text-muted-foreground">Sala 01</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:inline">
              Italiano
            </span>
            <CreditMeter />
            <span className="grid size-9 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
              F
            </span>
          </header>
          <div className="flex min-w-0 flex-1">
            <div className="min-w-0 flex-1 px-4 pb-16 sm:px-8 lg:px-10">{children}</div>
            {rail ? (
              <aside className="hidden w-[280px] shrink-0 flex-col gap-3 border-l border-border/80 p-4 xl:flex">
                {rail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
