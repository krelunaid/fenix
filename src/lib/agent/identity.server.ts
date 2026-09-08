/**
 * Who is calling the agent proxy. Server-only.
 *
 * Order of trust:
 *   1. A verified Better Auth session (cookie or bearer) when the server is set up
 *      for persistent accounts (DATABASE_URL + BETTER_AUTH_SECRET). Owner hash is
 *      derived from the user id, so it follows the person across devices.
 *   2. Otherwise the owner capability header used by the rest of Fenix (device-bound).
 *
 * Nothing here trusts a client-supplied user id.
 */
import { ownerFromRequest } from "../projects/publish-owner.ts";
import { ownerHash } from "./credits-store.ts";

export type Identity = { hash: string; kind: "session" | "capability"; userId?: string; email?: string | null };

let sessionResolverOverride: ((request: Request) => Promise<{ id: string; email?: string | null } | null>) | null | undefined;
/** Test hook: replace the Better Auth lookup. */
export function setSessionResolverForTests(fn: typeof sessionResolverOverride) {
  sessionResolverOverride = fn;
}

export function serverAccountsConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim() && process.env.BETTER_AUTH_SECRET?.trim());
}

async function sessionUser(request: Request): Promise<{ id: string; email?: string | null } | null> {
  if (sessionResolverOverride !== undefined) return sessionResolverOverride ? sessionResolverOverride(request) : null;
  if (!serverAccountsConfigured()) return null;
  try {
    const { auth } = await import("../auth/server.ts");
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
  } catch (err) {
    console.error("[fenix-agent] session lookup failed", err);
    return null;
  }
}

export async function resolveIdentity(request: Request): Promise<Identity | null> {
  const user = await sessionUser(request);
  if (user?.id) return { hash: ownerHash(`user:${user.id}`), kind: "session", userId: user.id, email: user.email ?? null };
  const cap = ownerFromRequest(request);
  return cap ? { hash: ownerHash(cap), kind: "capability" } : null;
}
