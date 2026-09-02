import { useEffect, useState } from "react";
import { Copy, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { projectFiles, type ProjectFile } from "@/lib/projects/files";
import {
  beatWorkspacePresence,
  createProjectWorkspace,
  inviteWorkspaceMember,
  loadProjectWorkspace,
  revokeWorkspaceMember,
  setWorkspaceMemberRole,
  type MemberRole,
  type WorkspaceSnapshot,
} from "@/lib/projects/workspace-client";
import { cn } from "@/lib/utils";

const MAP_KEY = "fenix.workspace-ids";

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, string> = {};
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function rememberWorkspace(projectId: string, workspaceId: string) {
  try {
    const map = readMap();
    map[projectId] = workspaceId;
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function rememberedWorkspaceId(projectId: string): string | null {
  return readMap()[projectId] || null;
}

export function ShareButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label="Condividi"
    >
      <Users />
      <span className="hidden sm:inline">Condividi</span>
    </Button>
  );
}

export function SharePanel({
  open,
  onClose,
  projectId,
  name,
  files,
  html,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  name: string;
  files?: ProjectFile[];
  html?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snap, setSnap] = useState<WorkspaceSnapshot | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setShareUrl("");
    const known = rememberedWorkspaceId(projectId);
    if (!known) return;
    void loadProjectWorkspace(known)
      .then((next) => setSnap(next))
      .catch(() => setSnap(null));
  }, [open, projectId]);

  useEffect(() => {
    if (!open || !snap?.id) return;
    void beatWorkspacePresence(snap.id)
      .then((presence) => setSnap((prev) => (prev ? { ...prev, presence } : prev)))
      .catch(() => undefined);
    const timer = window.setInterval(() => {
      void beatWorkspacePresence(snap.id)
        .then((presence) => setSnap((prev) => (prev ? { ...prev, presence } : prev)))
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [open, snap?.id]);

  if (!open) return null;

  async function ensureWorkspace() {
    setBusy(true);
    setError("");
    try {
      const created = await createProjectWorkspace({
        projectId,
        name,
        files: projectFiles({ html, files }),
      });
      rememberWorkspace(projectId, created.id);
      const full = await loadProjectWorkspace(created.id);
      setSnap(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace non creato.");
    } finally {
      setBusy(false);
    }
  }

  async function invite(role: MemberRole) {
    if (!snap) return;
    setBusy(true);
    setError("");
    try {
      const created = await inviteWorkspaceMember(snap.id, role);
      setShareUrl(created.url);
      const full = await loadProjectWorkspace(snap.id);
      setSnap(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invito non creato.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(memberId: string) {
    if (!snap) return;
    setBusy(true);
    setError("");
    try {
      await revokeWorkspaceMember(snap.id, memberId);
      setSnap(await loadProjectWorkspace(snap.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoca non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(memberId: string, role: MemberRole) {
    if (!snap) return;
    setBusy(true);
    setError("");
    try {
      await setWorkspaceMemberRole(snap.id, memberId, role);
      setSnap(await loadProjectWorkspace(snap.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ruolo non aggiornato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Studio
            </p>
            <h2 id="share-title" className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
              Condividi il progetto
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Invita lettori o editori. I ruoli vivono sul server. Il token dell’invito si vede una
              sola volta.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Chiudi" onClick={onClose}>
            <X />
          </Button>
        </div>

        {!snap ? (
          <Button className="mt-5 min-h-11" disabled={busy} onClick={() => void ensureWorkspace()}>
            Crea workspace
          </Button>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              {snap.members?.length ?? 1} nell’area · presenza {snap.presence?.length ?? 0}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={busy}
                onClick={() => void invite("viewer")}
              >
                Invita lettore
              </Button>
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={busy}
                onClick={() => void invite("editor")}
              >
                Invita editore
              </Button>
            </div>
            {shareUrl ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3" role="status">
                <p className="text-xs text-muted-foreground">
                  Copialo ora: il token non resta nel progetto.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    aria-label="Link di invito appena creato"
                    value={shareUrl}
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Copia link di invito"
                    onClick={() => void navigator.clipboard.writeText(shareUrl)}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            ) : null}
            <ul className="space-y-2" aria-label="Membri del workspace">
              {(snap.members ?? []).map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {member.label}
                      {member.you ? " · tu" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{member.role}</span>
                  </span>
                  {member.role !== "owner" ? (
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void changeRole(member.id, member.role === "editor" ? "viewer" : "editor")
                        }
                      >
                        {member.role === "editor" ? "Lettore" : "Editore"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void revoke(member.id)}
                      >
                        Revoca
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {snap.audit?.length ? (
              <ol className="space-y-1" aria-label="Registro workspace">
                {snap.audit.slice(0, 8).map((event) => (
                  <li key={event.id} className="text-xs text-muted-foreground">
                    {event.kind} · {event.detail}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}

        {error ? (
          <p className={cn("mt-4 text-sm text-destructive")} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
