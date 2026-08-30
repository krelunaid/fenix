import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const OPEN = ["/login", "/sito/"];

export function RequireAccount({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const open = OPEN.some((p) => pathname === p || pathname.startsWith(p));
  if (open) return <>{children}</>;
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#07041a] text-sm text-[#9b93c2]">
        Apro Fenix…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}
