import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAiStatus } from "@/lib/ai/generate";
import { EXAMPLES } from "@/lib/projects/examples";
import { useProjectStore } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const hydrated = useProjectStore((s) => s.hydrated);
  const projects = useProjectStore((s) => s.projects);
  const createFromBrief = useProjectStore((s) => s.createFromBrief);
  const [brief, setBrief] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    getAiStatus()
      .then((s) => {
        if (live) setAi(s.available);
      })
      .catch(() => {
        if (live) setAi(false);
      });
    return () => {
      live = false;
    };
  }, []);

  function goStudio(id: string) {
    void navigate({ to: "/studio/$projectId", params: { projectId: id } });
  }

  function handleBuild() {
    const text = brief.trim();
    if (text.length < 3) return;
    const project = createFromBrief({ prompt: text });
    goStudio(project.id);
  }

  const recents = hydrated ? projects.slice(0, 6) : [];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <Wordmark />
        <nav className="flex items-center gap-1 text-sm">
          <a
            href="https://www.kreluna.it"
            className="inline-flex h-10 min-h-11 items-center rounded-full px-3 text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground"
          >
            Kreluna
          </a>
          <a
            href="https://helix.kreluna.it"
            className="inline-flex h-10 min-h-11 items-center rounded-full px-3 text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground"
          >
            Helix
          </a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-28 sm:px-8">
        <section className="pt-10 text-center sm:pt-20">
          <p className="rise-in text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            Fenix by Kreluna
          </p>
          <h1 className="rise-in-2 mt-5 font-display text-[clamp(2.8rem,9vw,5.2rem)] leading-[1.02] font-normal tracking-[-0.04em] italic">
            Dimmi cosa costruire.
          </h1>
          <p className="rise-in-3 mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Descrivi l'idea. Fenix crea il sito, l'app o il programma — poi lo cambi parlando.
          </p>
        </section>

        <section className="rise-in-4 mt-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBuild();
            }}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6"
          >
            <label htmlFor="brief" className="sr-only">
              Brief del progetto
            </label>
            <Textarea
              id="brief"
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleBuild();
                }
              }}
              placeholder="Un sito per un forno a Lecce. Un'app turni. Un cruscotto vendite."
              className="min-h-[128px] text-[16px] sm:text-[17px]"
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-muted-foreground">
                {ai === false
                  ? "Studio non disponibile. Riprova tra un attimo."
                  : "Scrivi la tua idea. Invio o Crea."}
              </p>
              <Button
                type="submit"
                variant="ink"
                size="lg"
                disabled={brief.trim().length < 3}
                className="min-h-12 w-full sm:w-auto"
              >
                Crea
                <ArrowRight />
              </Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  setBrief(ex.prompt);
                  document.getElementById("brief")?.focus();
                }}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border border-border bg-card px-4",
                  "text-[13px] text-muted-foreground transition-colors duration-200 hover:bg-raised hover:text-foreground",
                )}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-12 sm:grid-cols-3">
          {[
            {
              n: "01",
              t: "Parla",
              d: "Cosa deve fare, per chi, che tono ha.",
            },
            {
              n: "02",
              t: "Fenix costruisce",
              d: "Un'app che gira. Poi la cambi a voce.",
            },
            {
              n: "03",
              t: "Pubblica",
              d: "Un file. Il tuo dominio.",
            },
          ].map((step) => (
            <div key={step.n} className="text-center sm:text-left">
              <p className="text-[12px] font-medium tracking-tight text-faint">{step.n}</p>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight">{step.t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{step.d}</p>
            </div>
          ))}
        </section>

        {recents.length > 0 ? (
          <section className="mt-20">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="text-[22px] font-semibold tracking-tight">Recenti</h2>
              <p className="text-[12px] text-muted-foreground">in questo browser</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {recents.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => goStudio(p.id)}
                    className="group flex w-full flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors duration-200 hover:bg-raised"
                  >
                    <span
                      className="mb-4 flex h-14 w-full overflow-hidden rounded-xl"
                      aria-hidden="true"
                    >
                      {Object.values(p.palette)
                        .slice(0, 5)
                        .map((c, i) => (
                          <span key={i} className="h-full flex-1" style={{ background: c }} />
                        ))}
                    </span>
                    <span className="text-[17px] font-semibold tracking-tight">{p.name}</span>
                    <span className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                      {p.tagline || p.prompt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-border px-6 py-8 text-center sm:px-10">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Kreluna · tecnologia che prende forma
        </p>
      </footer>
    </div>
  );
}
