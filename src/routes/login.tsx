import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { localSignIn, localSignUp } from "@/lib/local-account";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const mail = email.trim();
    const nome = name.trim() || mail.split("@")[0] || "Utente";
    try {
      if (mode === "up") await localSignUp(mail, password, nome);
      else await localSignIn(mail, password);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#07041a] px-6 text-white">
      <div className="w-full max-w-[380px] text-center">
        <img src="/fenix-login.svg" alt="Fenix" className="mx-auto h-36 w-36" />
        <p className="mt-4 text-[11px] font-semibold tracking-[0.28em] text-[#9b93c2]">FENIX · KRELUNA</p>
        <h1 className="mt-3 font-display text-4xl italic tracking-tight">Accedi</h1>
        <p className="mt-2 text-sm text-[#9b93c2]">Iscriviti con email. Poi entri sempre da qui.</p>

        <div className="mt-8 mb-3 flex gap-2">
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
