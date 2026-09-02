import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { FileTree } from "@/components/file-tree";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wordmark } from "@/components/wordmark";
import {
  beatWorkspacePresence,
  joinWorkspaceFromFragment,
  loadProjectWorkspace,
  writeWorkspaceFile,
  type WorkspaceSnapshot,
} from "@/lib/projects/workspace-client";

export const Route = createFileRoute("/condiviso/$workspaceId")({
  component: SharedWorkspacePage,
});

function SharedWorkspacePage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const joined = await joinWorkspaceFromFragment(workspaceId);
        const next = joined ?? (await loadProjectWorkspace(workspaceId));
        if (!live) return;
        setSnap(next);
        setActive(next.files[0]?.path || "");
        setDraft(next.files[0]?.content || "");
      } catch (err) {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Workspace non disponibile.");
      }
    })();
    return () => {
      live = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!snap?.id) return;
    void beatWorkspacePresence(snap.id).catch(() => undefined);
    const timer = window.setInterval(() => {
      void beatWorkspacePresence(snap.id)
        .then((presence) => setSnap((prev) => (prev ? { ...prev, presence } : prev)))
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [snap?.id]);

  const current = useMemo(
    () => snap?.files.find((file) => file.path === active) ?? snap?.files[0],
    [snap, active],
  );

  function select(path: string) {
    setActive(path);
    const file = snap?.files.find((row) => row.path === path);
    setDraft(file?.content || "");
  }

  async function save() {
    if (!snap || !current || !snap.canWrite) return;
    setBusy(true);
    setError("");
    try {
      const next = await writeWorkspaceFile(snap.id, current.path, draft, snap.casVersion);
      setSnap(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio rifiutato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Torna agli studi"
          onClick={() => navigate({ to: "/" })}
        >
          <ArrowLeft />
        </Button>
        <Wordmark compact className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base tracking-tight">
            {snap?.name || "Studio condiviso"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {snap ? `${snap.role}${snap.canWrite ? " · può scrivere" : " · sola lettura"}` : "Apro…"}
            {snap?.presence?.length ? ` · ${snap.presence.length} presenti` : ""}
          </p>
        </div>
        {snap?.canWrite ? (
          <Button size="sm" disabled={busy || !current} onClick={() => void save()}>
            Salva
          </Button>
        ) : null}
      </header>
      {error ? (
        <p className="border-b border-border px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="min-h-0 min-w-0 flex-1">
          {snap ? (
            <FileTree files={snap.files} activePath={current?.path} onSelect={select} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Apro lo studio condiviso…
            </div>
          )}
        </section>
        {snap?.canWrite && current ? (
          <aside className="flex min-h-[36%] flex-col border-t border-border md:min-h-0 md:w-[42%] md:border-t-0 md:border-l">
            <label className="px-3 pt-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {current.path}
            </label>
            <Textarea
              aria-label={`Modifica ${current.path}`}
              className="min-h-0 flex-1 rounded-none border-0 font-mono text-xs"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
