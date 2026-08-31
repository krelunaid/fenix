import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepareSrcDoc } from "@/lib/projects/color-scheme";
import { loadPublished } from "@/lib/projects/publish-client";
import type { PublishedSnapshot } from "@/lib/projects/published";
import { downloadTextFile } from "@/lib/utils";

export const Route = createFileRoute("/sito/$projectId")({
  component: LiveSitePage,
});

function LiveSitePage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<PublishedSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadPublished(projectId)
      .then((next) => {
        if (!cancelled) setSnap(next);
      })
      .catch(() => {
        if (!cancelled) setSnap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (snap === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
        Apro il sito…
      </div>
    );
  }

  if (!snap?.html) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <div>
          <p className="font-display text-2xl tracking-tight">Sito non trovato</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Non è ancora stato pubblicato, o il link non esiste.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
            Torna a Fenix
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full max-w-none flex-col bg-background">
      <header className="flex h-12 w-full shrink-0 items-center gap-3 border-b border-border px-3">
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
        <p className="min-w-0 flex-1 truncate text-sm">{snap.name}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            downloadTextFile("index.html", snap.html, "text/html;charset=utf-8");
            toast("index.html scaricato");
          }}
        >
          <Download />
          Scarica
        </Button>
      </header>
      <div className="relative min-h-0 w-full flex-1">
        <iframe
          title={snap.name}
          srcDoc={prepareSrcDoc(
            snap.html,
            snap.palette ?? { bg: "#ffffff" },
            snap.id,
            snap.kind,
          )}
          sandbox="allow-scripts allow-forms allow-modals"
          className="absolute inset-0 block h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
