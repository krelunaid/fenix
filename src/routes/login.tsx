import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/email-account";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      // "Entra" must never create an account by accident: a typo in the email or a
      // wrong password is an error, not a new sign-up. Server account when the
      // server is configured; otherwise a browser-only account, said out loud.
      const outcome = mode === "in" ? await signInWithEmail(email, password) : await signUpWithEmail(email, password, name);
      if (outcome.mode === "local") {
        setNotice("Il server degli account non è attivo: l'account vale solo su questo dispositivo e in questo browser.");
        window.setTimeout(() => window.location.assign("/"), 1400);
        return;
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <main className="fixed inset-0 grid place-items-center overflow-auto bg-[#07041a] px-6 py-8 text-white">
      <div className="m-auto flex w-full max-w-[360px] flex-col items-center text-center">
        <img src="/fenix-login.png" alt="Fenix" className="h-40 w-40 object-contain" />
        <p className="mt-4 text-[11px] font-semibold tracking-[0.28em] text-[#9b93c2]">FENIX · KRELUNA</p>
        <h1 className="mt-3 font-display text-4xl italic tracking-tight">Accedi</h1>
        <p className="mt-2 text-sm text-[#9b93c2]">Con email e password. Gli studi creati con il motore classico restano su questo dispositivo; i lavori dell'agente e le app pubblicate seguono il tuo account.</p>

        <div className="mt-8 mb-3 flex w-full gap-2">
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`h-10 flex-1 rounded-full text-sm ${mode === "up" ? "bg-white text-[#1d1d1f]" : "text-[#9b93c2]"}`}
          >
            Iscriviti
          </button>
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`h-10 flex-1 rounded-full text-sm ${mode === "in" ? "bg-white text-[#1d1d1f]" : "text-[#9b93c2]"}`}
          >
            Entra
          </button>
        </div>

        <form onSubmit={onEmail} className="w-full space-y-2 text-left">
          {mode === "up" ? (
            <>
              <label htmlFor="login-name" className="sr-only">Nome</label>
              <input
                id="login-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
                autoComplete="name"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-base outline-none"
              />
            </>
          ) : null}
          <label htmlFor="login-email" className="sr-only">Email</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            inputMode="email"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-base outline-none"
          />
          <label htmlFor="login-password" className="sr-only">Password</label>
          <input
            id="login-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8)"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#120e24] px-4 text-base outline-none"
          />
          {error ? <p className="text-xs text-red-400" role="alert">{error}</p> : null}
          {notice ? <p className="text-xs text-amber-300" role="status">{notice}</p> : null}
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
