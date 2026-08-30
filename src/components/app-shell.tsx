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
import { clearLocalAccount, getLocalAccount } from "@/lib/local-account";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { href: "/#nuovo", label: "Nuovo progetto", icon: Plus, end: false },
  { to: "/vetrina", label: "I miei progetti", icon: FolderKanban, end: false },
  { href: "/#demo", label: "Progetti demo", icon: LayoutGrid, end: false },
] as const;

export function AppShell({
  children,
  rail,
}: {
  children: ReactNode;
  rail?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const account = typeof window !== "undefined" ? getLocalAccount() : null;
  const label = account?.name || "Ospite";
  const initial = label.charAt(0).toUpperCase();

  function esci() {
    clearLocalAccount();
    window.location.assign("/login");
  }

  return (
    <div className="helix-grid min-h-dvh overflow-x-auto text-foreground">
      <div className="flex min-h-dvh w-full min-w-[1100px]">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-white/5 px-3 py-5">
          <Link to="/" className="flex items-center gap-2.5 px-2 no-underline">
            <img src="/fenix-mark.svg" alt="" className="size-8" />
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-semibold tracking-[0.14em]">FENIX</span>
              <span className="mt-1 text-[9px] font-medium tracking-[0.2em] text-muted-foreground">
                BY KRELUNA
              </span>
            </span>
          </Link>

          <nav className="mt-8 flex flex-col gap-0.5 text-[13px]">
            {NAV.map((item) => {
              const active = item.end && pathname === "/";
              const Icon = item.icon;
              const className = cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 no-underline transition-colors",
                active
                  ? "bg-[#5b4dff]/25 text-white"
                  : "text-[#9b93c2] hover:bg-white/5 hover:text-white",
              );
              if ("href" in item) {
                return (
                  <a key={item.label} href={item.href} className={className}>
                    <Icon className="size-4 opacity-80" />
                    {item.label}
                  </a>
                );
              }
              return (
                <Link key={item.label} to={item.to} className={className}>
                  <Icon className="size-4 opacity-80" />
                  {item.label}
                </Link>
              );
            })}
            <a
              href="https://www.kreluna.it"
              className="flex h-10 items-center gap-3 rounded-xl px-3 text-[#9b93c2] no-underline hover:bg-white/5 hover:text-white"
            >
              <Sparkles className="size-4 opacity-80" />
              Prezzi
            </a>
            <a
              href="https://www.kreluna.it"
              className="flex h-10 items-center gap-3 rounded-xl px-3 text-[#9b93c2] no-underline hover:bg-white/5 hover:text-white"
            >
              <HelpCircle className="size-4 opacity-80" />
              Assistenza
            </a>
          </nav>

          <div className="mt-auto px-1">
            <p className="mb-3 flex flex-wrap gap-x-3 text-[11px] text-[#6e6794]">
              <a href="https://www.kreluna.it" className="no-underline hover:text-white">
                Contatti
              </a>
              <a href="https://www.kreluna.it" className="no-underline hover:text-white">
                Privacy
              </a>
              <a href="https://www.kreluna.it" className="no-underline hover:text-white">
                Termini
              </a>
            </p>
            <p className="mb-3 text-[11px] text-[#6e6794]">Kreluna</p>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#16122c] px-3 py-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-[#7c6bff] text-xs font-semibold">
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{label}</span>
                <button type="button" onClick={esci} className="text-[11px] text-[#9b93c2] hover:text-white">
                  Esci
                </button>
              </span>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-end gap-2 px-6 py-4">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full border border-white/10 text-[#9b93c2]"
              aria-label="Aiuto"
            >
              <HelpCircle className="size-4" />
            </button>
            <span className="inline-flex h-9 items-center rounded-full border border-white/10 bg-[#16122c] px-3 text-xs text-[#cfc8ea]">
              Italiano
            </span>
            <button
              type="button"
              onClick={esci}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-[#16122c] pl-1 pr-3 text-xs"
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#7c6bff] font-semibold">
                {initial}
              </span>
              {label}
            </button>
          </header>
          <div className="flex min-w-0 flex-1">
            <div className="min-w-0 flex-1 px-8 pb-10">{children}</div>
            {rail ? (
              <aside className="flex w-[260px] shrink-0 flex-col gap-3 p-4 pr-6">{rail}</aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
