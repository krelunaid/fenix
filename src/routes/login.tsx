import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { localSignIn, localSignUp } from "@/lib/local-account";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSocial(id: string) {
    setError("");
    setBusy(true);
    try {
      await signIn(id, { callbackURL: "/" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gmail e X sul sito servono i permessi Google. Usa Iscriviti con email.",
      );
      setBusy(false);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const mail = email.trim();
    const nome = name.trim() || mail.split("@")[0] || "Utente";
    try {
      if (mode === "up") {
        try {
          const { error: err } = await authClient.signUp.email({
            email: mail,
            password,
            name: nome,
          });
          if (err) throw new Error(err.message);
        } catch {
          await localSignUp(mail, password, nome);
        }
      } else {
        try {
          const { error: err } = await authClient.signIn.email({ email: mail, password });
          if (err) throw new Error(err.message);
        } catch {
          await localSignIn(mail, password);
        }
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#07041a] px-6 text-white">
      <div className="w-full max-w-[380px] text-center">
        <img src="/fenix-mark.svg" alt="Fenix" className="mx-auto size-16" />
        <p className="mt-4 text-[11px] font-semibold tracking-[0.28em] text-[#9b93c2]">FENIX · KRELUNA</p>
        <h1 className="mt-3 font-display text-4xl italic tracking-tight">Accedi</h1>
        <p className="mt-2 text-sm text-[#9b93c2]">Senza account non si crea. Iscriviti o entra.</p>

        <div className="mt-8 space-y-2 text-left">
          {GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              disabled={busy}
              onClick={() => onSocial(p.providerId)}
              className="flex h-12 w-full items-center justify-center rounded-full border border-white/15 text-sm font-medium hover:bg-white/8 disabled:opacity-50"
            >
              Continua con {p.label === "Google" ? "Gmail" : p.label}
            </button>
          ))}
        </div>

        <div className="my-7 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[#6b6488]">
          <span className="h-px flex-1 bg-white/10" />
          oppure email
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`h-10 flex-1 rounded-full text-sm ${mode === "in" ? "bg-white text-[#1d1d1f]" : "text-[#9b93c2]"}`}
          >
            Entra
          </button>
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`h-10 flex-1 rounded-full text-sm ${mode === "up" ? "bg-white text-[#1d1d1f]" : "text-[#9b93c2]"}`}
          >
            Iscriviti
          </button>
        </div>

        <form onSubmit={onEmail} className="space-y-2 text-left">
          {mode === "up" ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-sm outline-none"
            />
          ) : null}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-sm outline-none"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8)"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-sm outline-none"
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-[#1d1d1f] disabled:opacity-40"
          >
            {busy ? "Attendi…" : mode === "up" ? "Crea account" : "Entra"}
          </button>
        </form>
      </div>
    </main>
  );
}
