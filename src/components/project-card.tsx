import { Link } from "@tanstack/react-router";
import { prepareSrcDoc } from "@/lib/projects/color-scheme";
import type { Project } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const PHONE_W = 390;
const SCALE = 0.42;

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete?: (id: string) => void;
}) {
  const src = project.html
    ? prepareSrcDoc(project.html, project.palette?.bg ?? "#ffffff", project.id, project.kind)
    : "";
  const frameH = Math.round(844 * SCALE);

  return (
    <article className="flex flex-col items-center rounded-3xl border border-white/8 bg-[#120e24] p-5">
      <div
        className="rounded-[2rem] border border-white/12 bg-[#0a0a0c] p-2 shadow-[0_20px_50px_rgba(0,0,0,.45)]"
        style={{ width: Math.round(PHONE_W * SCALE) + 16 }}
      >
        <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-white/20" />
        <div className="relative overflow-hidden rounded-[1.35rem] bg-[#f5f5f7]" style={{ height: frameH }}>
          {src ? (
            <iframe
              title={project.name}
              srcDoc={src}
              sandbox="allow-scripts allow-same-origin"
              tabIndex={-1}
              className="pointer-events-none origin-top-left border-0"
              style={{
                width: PHONE_W,
                height: 844,
                transform: `scale(${SCALE})`,
              }}
            />
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-[11px] text-[#86868b]">
              Ancora nessuna anteprima
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-4 w-full truncate text-center text-base font-semibold tracking-tight">{project.name}</h3>
      <p className="mt-1 line-clamp-2 w-full text-center text-xs text-[#9b93c2]">
        {project.tagline || project.prompt}
      </p>

      <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
        {project.html ? (
          <Link
            to="/sito/$projectId"
            params={{ projectId: project.id }}
            className={cn(
              "inline-flex h-9 items-center rounded-full bg-white px-3.5",
              "text-xs font-semibold text-[#1d1d1f] no-underline hover:opacity-90",
            )}
          >
            Apri
          </Link>
        ) : null}
        <Link
          to="/studio/$projectId"
          params={{ projectId: project.id }}
          className="inline-flex h-9 items-center rounded-full border border-white/15 px-3.5 text-xs text-white no-underline hover:bg-white/8"
        >
          Modifica
        </Link>
        {onDelete ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Eliminare ${project.name}?`)) onDelete(project.id);
            }}
            className="inline-flex h-9 items-center rounded-full px-3 text-xs text-[#9b93c2] hover:text-white"
          >
            Elimina
          </button>
        ) : null}
      </div>
    </article>
  );
}
