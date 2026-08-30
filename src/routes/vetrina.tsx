import { createFileRoute, Link } from "@tanstack/react-router";
import { ProjectCard } from "@/components/project-card";
import { SiteHeader } from "@/components/site-header";
import { useProjectStore } from "@/lib/projects/store";

export const Route = createFileRoute("/vetrina")({ component: VetrinaPage });

function VetrinaPage() {
  const hydrated = useProjectStore((s) => s.hydrated);
  const projects = useProjectStore((s) => s.projects);
  const removeProject = useProjectStore((s) => s.removeProject);
  const list = hydrated ? [...projects].sort((a, b) => b.updatedAt - a.updatedAt) : [];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 pb-28 sm:px-8">
        <section className="pt-8 sm:pt-12">
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            I tuoi progetti
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,6vw,3.8rem)] font-normal tracking-tight italic">
            Vetrina
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Tutto quello che hai creato in questo browser. Aprilo, cambialo, pubblicalo.
          </p>
        </section>

        {!hydrated ? (
          <p className="mt-16 text-sm text-muted-foreground">Apro la vetrina…</p>
        ) : list.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <p className="font-display text-2xl italic">Ancora vuota</p>
            <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
              Descrivi un'idea in home. Ogni creazione entra qui e la puoi modificare.
            </p>
            <Link
              to="/"
              className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground no-underline hover:opacity-90"
            >
              Crea il primo
            </Link>
          </div>
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} onDelete={removeProject} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
