/**
 * Email/password accounts on the server (Better Auth, same origin `/api/auth/*`),
 * with the browser-only account as an explicit, labelled fallback.
 *
 * Outcome semantics matter here:
 *   - "server":  the server accepted the credentials → a real session cookie exists.
 *   - "local":   the server is not configured (no DB / auth unreachable) → the old
 *                localStorage account was used and the caller must SAY SO.
 *   - throws:    the server answered and refused (wrong password, email taken…) →
 *                never silently fall back to a local account in that case.
 */
import { authClient, authEnabled } from "./client";
import { localSignIn, localSignUp } from "../local-account";

export type AccountOutcome = { mode: "server" | "local"; email: string; name: string };

function looksUnconfigured(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
  if (status && status >= 500) return true;
  if (status === 404) return true;
  return /failed to fetch|networkerror|load failed|econnrefused|not configured|non configurat|internal server/.test(message);
}

async function serverSignUp(email: string, password: string, name: string) {
  const { data, error } = await authClient.signUp.email({ email, password, name });
  if (error) throw Object.assign(new Error(error.message || "Registrazione rifiutata."), { status: error.status });
  return data;
}

async function serverSignIn(email: string, password: string) {
  const { data, error } = await authClient.signIn.email({ email, password });
  if (error) throw Object.assign(new Error(error.message || "Accesso rifiutato."), { status: error.status });
  return data;
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<AccountOutcome> {
  const mail = email.trim().toLowerCase();
  const nome = name.trim() || mail.split("@")[0] || "Utente";
  if (authEnabled) {
    try {
      await serverSignUp(mail, password, nome);
      // Keep the local marker in sync so the rest of the app (which still reads it) works.
      try { await localSignUp(mail, password, nome); } catch { await localSignIn(mail, password).catch(() => {}); }
      return { mode: "server", email: mail, name: nome };
    } catch (err) {
      if (!looksUnconfigured(err)) throw translate(err);
    }
  }
  await localSignUp(mail, password, nome);
  return { mode: "local", email: mail, name: nome };
}

export async function signInWithEmail(email: string, password: string): Promise<AccountOutcome> {
  const mail = email.trim().toLowerCase();
  if (authEnabled) {
    try {
      const data = await serverSignIn(mail, password);
      const nome = (data as { user?: { name?: string } } | null)?.user?.name || mail.split("@")[0] || "Utente";
      try { await localSignIn(mail, password); } catch { await localSignUp(mail, password, nome).catch(() => {}); }
      return { mode: "server", email: mail, name: nome };
    } catch (err) {
      if (!looksUnconfigured(err)) throw translate(err);
    }
  }
  const session = await localSignIn(mail, password);
  return { mode: "local", email: session.email, name: session.name };
}

function translate(err: unknown): Error {
  const message = String((err as { message?: string } | null)?.message || "");
  if (/invalid email or password|invalid password|credential/i.test(message)) return new Error("Email o password non corretti.");
  if (/already exist|already registered|user_already/i.test(message)) return new Error("Questa email è già iscritta. Entra.");
  if (/password.*(short|length)|too short/i.test(message)) return new Error("Password troppo corta: almeno 8 caratteri.");
  return err instanceof Error ? err : new Error(message || "Errore");
}
