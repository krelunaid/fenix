import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "Utente",
        });
        if (err) throw new Error(err.message || "Iscrizione non riuscita");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message || "Accesso non riuscito");
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#07041a] px-6 text-white">
      <div className="w-full max-w-sm">
        <Wordmark />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Accedi</h1>
        <p className="mt-2 text-sm text-[#9b93c2]">
          Gmail, X o iscrizione. Puoi anche continuare senza account.
        </p>

        {authEnabled ? (
          <div className="mt-6 space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="flex h-11 w-full items-center justify-center rounded-full border border-white/15 text-sm font-medium hover:bg-white/8"
              >
                Continua con {p.label === "Google" ? "Gmail" : p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-[#9b93c2]">Accesso social in attivazione sul server.</p>
        )}

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[#6b6488]">
          <span className="h-px flex-1 bg-white/10" />
          oppure
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`h-9 flex-1 rounded-full text-xs ${mode === "in" ? "bg-white text-[#1d1d1f]" : "text-[#9b93c2]"}`}
          >
            Entra
          </button>
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`h-9 flex-1 rounded-full text-xs ${mode === "up" ? "bg-white text-[#1d1d1f]" : "text-[#9b93c2]"}`}
          >
            Iscriviti
          </button>
        </div>

        <form onSubmit={onEmail} className="space-y-2">
          {mode === "up" ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              className="h-11 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-sm outline-none"
            />
          ) : null}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-11 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-sm outline-none"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8)"
            className="h-11 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-sm outline-none"
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !authEnabled}
            className="flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-[#1d1d1f] disabled:opacity-40"
          >
            {busy ? "Attendi…" : mode === "up" ? "Crea account" : "Entra"}
          </button>
        </form>

        <Link
          to="/"
          className="mt-6 flex h-11 w-full items-center justify-center rounded-full text-sm text-[#9b93c2] no-underline hover:text-white"
        >
          Continua senza account
        </Link>
      </div>
    </main>
  );
}
