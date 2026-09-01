import { useEffect, useMemo, useState } from "react";
import { Download, FolderGit2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBytes, slugify } from "@/lib/utils";
import { zipProject } from "@/lib/projects/zip";
import { projectFiles, utf8Bytes, type ProjectFile } from "@/lib/projects/files";
import { useProjectStore } from "@/lib/projects/store";
import type { ProjectKind } from "@/lib/projects/types";
import {
  disconnectGitHub,
  loadGitHubRepos,
  loadGitHubStatus,
  previewGitHubExport,
  runGitHubExport,
  startGitHubConnect,
  type GitHubRepo,
  type GitHubStatus,
  type PublicExportJob,
} from "@/lib/github/client";

export function ExportPanel({
  open,
  onClose,
  projectId,
  name,
  html,
  kind,
  files,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  name: string;
  html: string;
  kind: ProjectKind;
  files?: ProjectFile[];
}) {
  const recordActivity = useProjectStore((state) => state.recordActivity);
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [preview, setPreview] = useState<PublicExportJob | null>(null);
  const [job, setJob] = useState<PublicExportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => projectFiles({ html, files }), [html, files]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setJob(null);
    setPreview(null);
    void loadGitHubStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: false,
            connected: false,
            hint: "GitHub non configurato. Serve una GitHub App sul server (Contents read/write + Metadata read) e un database durevole (DATABASE_URL con la migrazione nonce). Nessuna connessione finta.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !status?.connected) return;
    let cancelled = false;
    void loadGitHubRepos()
      .then((list) => {
        if (cancelled) return;
        setRepos(list);
        setRepo((current) => current || list[0]?.fullName || "");
        setBranch((b) => b || list[0]?.defaultBranch || "main");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Repository non disponibili.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, status?.connected]);

  if (!open) return null;

  function downloadZip() {
    downloadBytes(`${slugify(name)}.zip`, zipProject(tree, { kind }), "application/zip");
    recordActivity(projectId, {
      kind: "export",
      outcome: "ok",
      label: "ZIP esportato",
      metrics: { files: tree.length },
    });
    toast("Progetto scaricato. File, stile, dati e logica.");
  }

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await startGitHubConnect(`/studio/${projectId}`);
      window.location.assign(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "GitHub non configurato.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const next = await disconnectGitHub();
      setStatus(next);
      setRepos([]);
      setPreview(null);
      setJob(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Non riesco a scollegare.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    if (!repo) return;
    setBusy(true);
    setError(null);
    try {
      const next = await previewGitHubExport({
        repo,
        branch: branch.trim() || "main",
        name,
        kind,
        html,
        files,
      });
      setPreview(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Anteprima rifiutata.");
    } finally {
      setBusy(false);
    }
  }

  async function exportNow() {
    if (!repo || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await runGitHubExport({
        repo,
        branch: branch.trim() || "main",
        name,
        kind,
        html,
        files,
      });
      setJob(next);
      recordActivity(projectId, {
        kind: "export",
        outcome: next.status === "err" ? "err" : "ok",
        label: "Export GitHub",
        detail: next.unchanged
          ? "Albero invariato"
          : next.status === "err"
            ? "Export interrotto"
            : "Commit creato",
        metrics: { files: next.files?.length ?? tree.length },
      });
      if (next.status === "err") setError(next.error || "Export interrotto.");
      else toast(next.unchanged ? "Stesso albero: nessun commit nuovo." : "Export su GitHub.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export rifiutato.");
    } finally {
      setBusy(false);
    }
  }

  const shownFiles = preview?.files?.length
    ? preview.files
    : [
        { path: "fenix.json", bytes: 0 },
        ...tree.map((f) => ({ path: f.path, bytes: utf8Bytes(f.content) })),
        ...(tree.some((f) => f.path.toLowerCase() === "readme.md")
          ? []
          : [{ path: "README.md", bytes: 0 }]),
      ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="max-h-[92dvh] w-full max-w-xl overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Esporta
            </p>
            <h2 id="export-title" className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
              Albero Fenix
            </h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X />
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          ZIP locale sempre. GitHub solo su un repository già esistente, dopo un click tuo. Il
          commit sostituisce l'albero del branch con i file Fenix (fenix.json, README,
          sorgenti). Non è un merge e non parte da solo.
        </p>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <section className="mt-5 space-y-3 border-t border-border pt-5" aria-labelledby="export-zip">
          <h3 id="export-zip" className="font-display text-lg tracking-tight">
            ZIP
          </h3>
          <Button variant="secondary" className="min-h-11 w-full" onClick={downloadZip}>
            <Download />
            Scarica .zip
          </Button>
        </section>

        <section className="mt-5 space-y-3 border-t border-border pt-5" aria-labelledby="export-gh">
          <h3 id="export-gh" className="font-display text-lg tracking-tight">
            GitHub
          </h3>
          <p className="text-sm text-muted-foreground">{status?.hint || "Controllo il collegamento…"}</p>

          {!status?.configured ? (
            <p className="rounded-md border border-border bg-raised px-3 py-2 text-sm" role="status">
              GitHub non configurato
            </p>
          ) : null}

          {status?.configured && !status.connected ? (
            <Button
              variant="ink"
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() => void connect()}
            >
              <FolderGit2 />
              Connetti GitHub
            </Button>
          ) : null}

          {status?.connected ? (
            <div className="space-y-3">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-faint">
                {status.account || "Collegato"}
              </p>
              <label className="block text-xs text-muted-foreground">
                Repository
                <select
                  value={repo}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRepo(next);
                    const found = repos.find((r) => r.fullName === next);
                    if (found) setBranch(found.defaultBranch || "main");
                  }}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-raised px-3 text-sm text-foreground"
                >
                  {repos.length === 0 ? <option value="">Nessun repository</option> : null}
                  {repos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName}
                      {r.private ? " · privato" : ""}
                      {r.empty ? " · vuoto" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Branch
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-raised px-3 font-mono text-sm text-foreground"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="min-h-11 flex-1"
                  disabled={busy || !repo}
                  onClick={() => void loadPreview()}
                >
                  Anteprima file
                </Button>
                <Button
                  variant="ink"
                  className="min-h-11 flex-1"
                  disabled={busy || !repo}
                  onClick={() => void exportNow()}
                >
                  Esporta
                </Button>
              </div>
              <Button
                variant="ghost"
                className="min-h-11 w-full"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                Scollega GitHub
              </Button>
            </div>
          ) : null}
        </section>

        <section className="mt-5 space-y-3 border-t border-border pt-5" aria-labelledby="export-files">
          <h3 id="export-files" className="font-display text-lg tracking-tight">
            File
          </h3>
          <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-faint">
            {shownFiles.map((f) => (
              <li key={f.path} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{f.path}</span>
                <span className="shrink-0">
                  {"change" in f && f.change ? `${f.change} · ` : ""}
                  {f.bytes ? `${f.bytes} B` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {job ? (
          <div className="mt-5 rounded-md border border-border bg-raised p-3">
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-faint">
              {job.status === "ok" ? "Pronto" : job.status === "err" ? "Errore" : "In corso"}
              {job.unchanged ? " · invariato" : ""}
              {job.commitSha ? ` · ${job.commitSha.slice(0, 8)}` : ""}
            </p>
            {job.htmlUrl ? (
              <a
                href={job.htmlUrl}
                className="mt-2 block break-all text-sm text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                {job.htmlUrl}
              </a>
            ) : null}
            <ol className="mt-3 max-h-28 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-faint">
              {job.log.slice(-12).map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
