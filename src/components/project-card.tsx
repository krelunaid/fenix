import { Link } from "@tanstack/react-router";
import type { Project } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete?: (id: string) => void;
}) {
  const status =
    project.status === "ready"
      ? "Pronto"
      : project.status === "building"
        ? "In corso"
        : project.status === "error"
          ? "Da ritoccare"
          : "Bozza";

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <span className="mb-4 flex h-14 w-full overflow-hidden rounded-xl" aria-hidden="true">
        {Object.values(project.palette)
          .slice(0, 5)
          .map((c, i) => (
            <span key={i} className="h-full flex-1" style={{ background: c }} />
          ))}
      </span>
      <h3 className="font-display text-xl font-normal tracking-tight">{project.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {project.tagline || project.prompt}
      </p>
      <p className="mt-3 text-xs tracking-wide text-faint uppercase">{status}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/studio/$projectId"
          params={{ projectId: project.id }}
          className={cn(
            "inline-flex h-10 min-h-11 items-center rounded-full bg-primary px-4",
            "text-sm font-medium text-primary-foreground no-underline hover:opacity-90",
          )}
        >
          Modifica
        </Link>
        {project.html ? (
          <Link
            to="/sito/$projectId"
            params={{ projectId: project.id }}
            className="inline-flex h-10 min-h-11 items-center rounded-full border border-border px-4 text-sm text-foreground no-underline hover:bg-raised"
          >
            Apri
          </Link>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(project.id)}
            className="inline-flex h-10 min-h-11 items-center rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Togli
          </button>
        ) : null}
      </div>
    </article>
  );
}
