import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { flushWorkspaceDoc, type SharedDocSnapshot } from "@/lib/projects/workspace-client";
import { cn } from "@/lib/utils";

export type NotesSync = "sync" | "sending" | "conflict" | "readonly";

const SYNC_LABEL: Record<NotesSync, string> = {
  sync: "Sincronizzati",
  sending: "Invio…",
  conflict: "Conflitto, testo server ripristinato",
  readonly: "Sola lettura",
};

export function SharedNotes({
  workspaceId,
  canWrite,
  doc,
  onDoc,
  onError,
}: {
  workspaceId: string;
  canWrite: boolean;
  doc: SharedDocSnapshot;
  onDoc: (next: SharedDocSnapshot) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(doc.content);
  const [sync, setSync] = useState<NotesSync>(canWrite ? "sync" : "readonly");
  const baseRef = useRef(doc);
  const timer = useRef<number>(0);
  const inflight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    baseRef.current = doc;
    setDraft(doc.content);
    setSync(canWrite ? "sync" : "readonly");
  }, [doc.content, doc.version, canWrite]);

  async function flush(next = draft) {
    if (!canWrite) return;
    if (inflight.current) await inflight.current;
    const base = baseRef.current;
    if (next === base.content) {
      setSync("sync");
      return;
    }
    setSync("sending");
    const run = (async () => {
      try {
        const saved = await flushWorkspaceDoc(workspaceId, base.content, next, base.version);
        if (!saved) {
          setSync("sync");
          return;
        }
        baseRef.current = saved;
        onDoc(saved);
        setDraft(saved.content);
        setSync("sync");
      } catch (err) {
        setSync("conflict");
        onError(err instanceof Error ? err.message : "Appunti non salvati.");
      }
    })();
    inflight.current = run;
    try {
      await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  }

  function type(value: string) {
    setDraft(value);
    if (!canWrite) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void flush(value);
    }, 280);
  }

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Appunti condivisi
          </p>
          <p className="truncate text-sm">Argilla viva · versione {doc.version}</p>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs",
            sync === "conflict"
              ? "border-destructive/40 text-destructive"
              : sync === "sending"
                ? "border-primary/40 text-primary"
                : "border-border text-muted-foreground",
          )}
        >
          {SYNC_LABEL[sync]}
        </p>
      </div>
      <label className="sr-only" htmlFor="fenix-shared-notes">
        Appunti condivisi
      </label>
      <Textarea
        id="fenix-shared-notes"
        aria-label="Appunti condivisi"
        readOnly={!canWrite}
        value={draft}
        onChange={(event) => type(event.target.value)}
        onBlur={() => void flush()}
        placeholder={
          canWrite
            ? "Due persone possono scrivere parti diverse. Il server tiene un solo testo."
            : "Sola lettura."
        }
        className="min-h-[11rem] flex-1 px-3 py-3 font-sans text-sm leading-relaxed sm:px-4"
      />
    </section>
  );
}
