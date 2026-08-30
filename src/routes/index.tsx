import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ProjectCard } from "@/components/project-card";
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
    <AppShell
      rail={
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Panoramica</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Luce bassa. Un oggetto. Il resto aspetta te.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Stato build</p>
            <p className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
              Nessuna build attiva
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Attività recente</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {recents[0] ? recents[0].name : "Nessuna attività recente"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="size-4 text-primary" />
              Assistenza
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Fenix by Kreluna</p>
          </div>
        </>
      }
    >
      <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
        01 / CREATE
      </p>
      <p className="mt-6 text-lg text-muted-foreground">Ciao</p>
      <div className="mt-2 flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="max-w-xl text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] font-semibold tracking-[-0.04em]">
          Cosa vuoi
          <br />
          <span className="fenix-grad">creare oggi?</span>
        </h1>
        <img
          src="/fenix-orb.jpg"
          alt="Fenix"
          className="mx-auto w-[min(280px,70vw)] shrink-0 drop-shadow-[0_0_40px_rgba(139,124,255,0.45)] lg:mx-0"
        />
      </div>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Descrivi la tua idea. Fenix crea un prototipo funzionante, con codice esportabile
        e opzioni di pubblicazione.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleBuild();
        }}
        className="mt-8 rounded-2xl border border-border bg-card/80 p-5"
      >
        <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Inizia da un’idea
        </p>
        <label htmlFor="brief" className="sr-only">
          Brief del progetto
        </label>
        <Textarea
          id="brief"
          rows={6}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleBuild();
            }
          }}
          placeholder="Descrivi il software che vuoi creare..."
          className="mt-3 min-h-[140px] text-[16px] sm:text-[17px]"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {ai === false
              ? "Studio non disponibile. Riprova tra un attimo."
              : emptyCredits
                ? "Crediti esauriti."
                : "Ogni creazione usa 1 credito."}
          </p>
          <Button
            type="submit"
            variant="default"
            size="lg"
            disabled={brief.trim().length < 3 || emptyCredits}
            className="min-h-12 w-full bg-primary text-primary-foreground sm:w-auto"
          >
            Crea
            <ArrowRight />
          </Button>
        </div>
      </form>

      <div id="demo" className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            const project = openDemo("grottaglie");
            void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
          }}
          className="rounded-2xl border border-border bg-card p-4 text-left hover:bg-raised"
        >
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Demo</p>
          <p className="mt-1 text-lg font-semibold">Fornace Grottaglie</p>
        </button>
        <button
          type="button"
          onClick={() => {
            const project = openDemo("catenaria");
            void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
          }}
          className="rounded-2xl border border-border bg-card p-4 text-left hover:bg-raised"
        >
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Demo</p>
          <p className="mt-1 text-lg font-semibold">Officina Catenaria</p>
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
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
              "text-sm text-muted-foreground hover:bg-raised hover:text-foreground",
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {recents.length > 0 ? (
        <section className="mt-14">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-semibold">I miei progetti</h2>
            <Link to="/vetrina" className="text-sm text-muted-foreground no-underline hover:text-foreground">
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
    </AppShell>
  );
}
