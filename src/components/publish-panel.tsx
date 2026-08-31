import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, Globe, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBytes, downloadTextFile, slugify } from "@/lib/utils";
import { zipFiles } from "@/lib/projects/zip";
import type { ProjectFile } from "@/lib/projects/files";
import type { Palette, ProjectKind } from "@/lib/projects/types";
import { publishSnapshot } from "@/lib/projects/publish-client";
import type { PublishedSnapshot } from "@/lib/projects/published";

export function PublishPanel({
  open,
  onClose,
  projectId,
  name,
  html,
  kind,
  palette,
  tagline,
  summary,
  files,
  onOpenSite,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  name: string;
  html: string;
  kind: ProjectKind;
  palette: Palette;
  tagline?: string;
  summary?: string;
  files?: ProjectFile[];
  onOpenSite: () => void;
}) {
  const [published, setPublished] = useState<PublishedSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !html) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void publishSnapshot({
      id: projectId,
      name,
      html,
      kind,
      palette,
      tagline,
      summary,
    })
      .then((snap) => {
        if (cancelled) return;
        setPublished(snap);
        setBusy(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBusy(false);
        setError(err instanceof Error ? err.message : "Pubblicazione rifiutata.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, name, html, kind, palette, tagline, summary]);

  if (!open) return null;

  function downloadSite() {
    downloadTextFile("index.html", html, "text/html;charset=utf-8");
    toast(`index.html scaricato · ${slugify(name)}`);
  }

  function downloadProject() {
    const bundle =
      files && files.length > 0
        ? files
        : [{ path: "index.html", content: html }];
    if (!bundle.some((f) => /index\.html$/i.test(f.path))) {
      bundle.unshift({ path: "index.html", content: html });
    }
    downloadBytes(`${slugify(name)}.zip`, zipFiles(bundle), "application/zip");
    toast("Progetto scaricato. File, stile, dati e logica.");
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      toast("HTML copiato. Incollalo sul tuo hosting.");
    } catch {
      toast("Non sono riuscito a copiare. Usa Scarica.");
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/sito/${published?.id || projectId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link pubblico copiato.");
    } catch {
      toast(url);
    }
  }

  const publicPath = `/sito/${published?.id || projectId}`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Pubblica
            </p>
            <h2
              id="publish-title"
              className="mt-2 font-display text-2xl tracking-tight sm:text-3xl"
            >
              {published ? "È online." : "Sì. È già un sito."}
            </h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X />
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {busy
            ? "Salvo lo snapshot sul server. Il link funziona anche da un altro browser."
            : published
              ? `${name} è pubblicato. Chiunque apra il link vede questa versione, non la bozza locale.`
              : `${name} è un progetto: interfaccia, logica e dati. Scarichi lo ZIP, o un unico HTML già pronto per il dominio.`}
        </p>

        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}

        {published ? (
          <p className="mt-4 break-all rounded-md border border-border bg-raised px-3 py-2 font-mono text-xs">
            {publicPath}
            {published.version > 1 ? ` · v${published.version}` : ""}
          </p>
        ) : null}

        <ol className="mt-5 space-y-3 border-t border-border pt-5">
          {[
            {
              n: "01",
              t: "Snapshot sul server",
              d: "Dopo il controllo, Fenix salva html, palette e versione. Non usa il localStorage di chi guarda.",
            },
            {
              n: "02",
              t: "Apri il link pubblico",
              d: "Funziona in incognito e su un altro computer. Pubblica di nuovo per aggiornare.",
            },
            {
              n: "03",
              t: "Oppure scarica",
              d: "ZIP o HTML per il tuo hosting, se vuoi il dominio tuo.",
            },
          ].map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="font-mono text-xs text-faint">{step.n}</span>
              <span>
                <span className="block text-sm text-foreground">{step.t}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{step.d}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="ink"
            size="lg"
            onClick={() => {
              if (published?.id) {
                window.location.assign(`/sito/${encodeURIComponent(published.id)}`);
                return;
              }
              onOpenSite();
            }}
            className="w-full"
            disabled={busy || !published}
          >
            <Globe />
            Apri il sito pubblicato
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button variant="secondary" onClick={downloadProject}>
              <Download />
              Scarica .zip
            </Button>
            <Button variant="secondary" onClick={() => void copyLink()}>
              <Copy />
              Copia link
            </Button>
            <Button variant="secondary" onClick={() => void copyHtml()}>
              <ExternalLink />
              Solo HTML
            </Button>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
          <Check className="mt-0.5 size-3.5 shrink-0" />
          Bozza nello studio, snapshot pubblico a parte. Pubblica modifiche sostituisce in modo atomico.
        </p>
      </div>
    </div>
  );
}
