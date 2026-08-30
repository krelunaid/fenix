import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ProjectCard } from "@/components/project-card";
import { SiteHeader } from "@/components/site-header";
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
  const creditsRemaining = useProjectStore((s) => s.creditsRemaining);
  const createFromBrief = useProjectStore((s) => s.createFromBrief);
  const openDemo = useProjectStore((s) => s.openDemo);
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

  function handleBuild() {
    const text = brief.trim();
    if (text.length < 3) return;
    if (creditsRemaining < 1) {
      toast("Crediti esauriti. Ogni creazione usa 1 credito.");
      return;
    }
    const project = createFromBrief({ prompt: text });
    void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
  }

  const recents = hydrated ? projects.slice(0, 4) : [];
  const emptyCredits = hydrated && creditsRemaining < 1;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />

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
              <p className="text-sm text-muted-foreground">
                {ai === false
                  ? "Studio non disponibile. Riprova tra un attimo."
                  : emptyCredits
                    ? "Crediti esauriti. Puoi ancora aprire e pubblicare ciò che hai in vetrina."
                    : "Ogni creazione usa 1 credito. Invio o Crea."}
              </p>
              <Button
                type="submit"
                variant="ink"
                size="lg"
                disabled={brief.trim().length < 3 || emptyCredits}
                className="min-h-12 w-full sm:w-auto"
              >
                Crea
                <ArrowRight />
              </Button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => {
              const project = openDemo("grottaglie");
              void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
            }}
            className="mt-4 flex w-full flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors duration-200 hover:bg-raised"
          >
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Agente visivo · ora</p>
            <p className="mt-2 font-display text-2xl italic tracking-tight">Fornace Grottaglie</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Terracotta, calce, forni. Colori e icone nati dal brief — non da un template.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              const project = openDemo("catenaria");
              void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
            }}
            className="mt-2 flex w-full flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors duration-200 hover:bg-raised"
          >
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Prova pronta</p>
            <p className="mt-2 font-display text-2xl italic tracking-tight">Officina Catenaria</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acciaio e olio. Stesso studio, visivo opposto.
            </p>
          </button>

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
                  "text-sm text-muted-foreground transition-colors duration-200 hover:bg-raised hover:text-foreground",
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
              d: "Art director (colori, icone, materia), poi Grok Build scrive il prodotto.",
            },
            {
              n: "03",
              t: "Vetrina",
              d: "I tuoi progetti restano qui. Li modifichi quando vuoi.",
            },
          ].map((step) => (
            <div key={step.n} className="text-center sm:text-left">
              <p className="text-xs font-medium tracking-tight text-faint">{step.n}</p>
              <h2 className="mt-3 font-display text-2xl font-normal tracking-tight italic">{step.t}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{step.d}</p>
            </div>
          ))}
        </section>

        {recents.length > 0 ? (
          <section className="mt-20">
            <div className="mb-5 flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-normal tracking-tight italic">Vetrina</h2>
              <Link
                to="/vetrina"
                className="text-sm text-muted-foreground no-underline hover:text-foreground"
              >
                Vedi tutti
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {recents.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
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
