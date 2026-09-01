import { useEffect, useState } from "react";
import { Activity, GitFork, History, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatActivityAge, listProjectActivity } from "@/lib/projects/activity";
import { formatRevisionAge, listRevisions } from "@/lib/projects/revisions";
import type { Project } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

export function RevisionPanel({
  open,
  onClose,
  project,
  onRestore,
  onBranch,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  onRestore: (revisionId: string) => void;
  onBranch: (revisionId: string) => void;
}) {
  const [tab, setTab] = useState<"versions" | "activity">("versions");
  useEffect(() => {
    if (open) setTab("versions");
  }, [open]);
  if (!open) return null;
  const revisions = listRevisions(project);
  const activity = listProjectActivity(project);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="versions-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Versioni
            </p>
            <h2
              id="versions-title"
              className="mt-2 font-display text-2xl tracking-tight sm:text-3xl"
            >
              Cotture precedenti e attività
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Ripristina qui oppure crea un ramo indipendente. Il ramo copia codice e file, non
              dati, messaggi o deploy.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Chiudi versioni">
            <X />
          </Button>
        </div>

        <div
          className="mt-5 grid grid-cols-2 rounded-lg border border-border bg-background p-1"
          role="tablist"
          aria-label="Cronologia progetto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "versions"}
            onClick={() => setTab("versions")}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm text-muted-foreground",
              tab === "versions" && "bg-raised text-foreground",
            )}
          >
            Versioni · {revisions.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "activity"}
            onClick={() => setTab("activity")}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm text-muted-foreground",
              tab === "activity" && "bg-raised text-foreground",
            )}
          >
            <Activity className="size-4" aria-hidden="true" />
            Attività · {activity.length}
          </button>
        </div>

        {tab === "versions" && revisions.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Nessuna cottura ancora. Appare dopo il primo Pronto.
          </p>
        ) : tab === "versions" ? (
          <ol className="mt-6 flex flex-col gap-2">
            {revisions.map((rev) => {
              const current = rev.id === project.revisionId;
              return (
                <li
                  key={rev.id}
                  className={cn(
                    "rounded-lg border border-border p-3 sm:p-4",
                    current && "bg-raised",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{rev.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {formatRevisionAge(rev.at)}
                        {current ? " · in uso" : ""}
                        {` · ${rev.files.length} file`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11"
                        onClick={() => onBranch(rev.id)}
                        aria-label={`Crea ramo da ${rev.label}`}
                      >
                        <GitFork />
                        Ramo
                      </Button>
                      <Button
                        variant={current ? "ghost" : "secondary"}
                        size="sm"
                        className="min-h-11"
                        disabled={current}
                        onClick={() => onRestore(rev.id)}
                        aria-label={current ? "Versione in uso" : `Ripristina ${rev.label}`}
                      >
                        <RotateCcw />
                        Ripristina
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : activity.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Nessuna attività registrata. Il registro parte dalla prossima operazione.
          </p>
        ) : (
          <ol className="mt-6 flex flex-col gap-2" aria-label="Registro attività">
            {activity.map((item) => (
              <li key={item.id} className="rounded-lg border border-border p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1 size-2.5 shrink-0 rounded-full bg-muted-foreground",
                      item.outcome === "ok" && "bg-emerald-500",
                      item.outcome === "run" && "bg-primary",
                      item.outcome === "err" && "bg-destructive",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatActivityAge(item.at)}
                      </p>
                    </div>
                    {item.detail ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                    {item.metrics && Object.keys(item.metrics).length ? (
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        {Object.entries(item.metrics)
                          .map(([key, value]) => `${key} ${value}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function VersionsButton({
  count,
  onClick,
  disabled,
}: {
  count: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label="Versioni"
      className="shrink-0"
    >
      <History />
      <span className="hidden sm:inline">Versioni</span>
      {count > 0 ? <span className="font-mono text-xs tabular-nums">{count}</span> : null}
    </Button>
  );
}
