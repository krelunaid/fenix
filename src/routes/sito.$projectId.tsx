import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepareSrcDoc } from "@/lib/projects/color-scheme";
import { useProjectStore } from "@/lib/projects/store";
import { downloadTextFile } from "@/lib/utils";

export const Route = createFileRoute("/sito/$projectId")({
  component: LiveSitePage,
});

function LiveSitePage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useProjectStore((s) => s.hydrated);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
        Apro il sito…
      </div>
    );
  }

  if (!project?.html) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <div>
          <p className="font-display text-2xl tracking-tight">Sito non trovato</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Costruiscilo prima in studio, poi aprilo qui.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
            Torna a Fenix
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            navigate({ to: "/studio/$projectId", params: { projectId } })
          }
          aria-label="Torna allo studio"
        >
          <ArrowLeft />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm">{project.name}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            downloadTextFile("index.html", project.html, "text/html;charset=utf-8");
            toast("index.html scaricato");
          }}
        >
          <Download />
          Scarica
        </Button>
      </header>
      <iframe
        title={project.name}
        srcDoc={prepareSrcDoc(
          project.html,
          project.palette ?? { bg: "#ffffff" },
          project.id,
          project.kind,
        )}
        sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
