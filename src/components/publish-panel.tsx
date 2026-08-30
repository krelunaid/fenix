import { useEffect } from "react";
import { Check, Copy, Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBytes, downloadTextFile, slugify } from "@/lib/utils";
import { zipFiles } from "@/lib/projects/zip";
import type { ProjectFile } from "@/lib/projects/files";

export function PublishPanel({
  open,
  onClose,
  name,
  html,
  files,
  onOpenSite,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  html: string;
  files?: ProjectFile[];
  onOpenSite: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
              Sì. È già un sito.
            </h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X />
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {name} è un progetto: interfaccia, logica e dati. Scarichi lo ZIP, o un
          unico HTML già pronto per il dominio.
        </p>

        <ol className="mt-5 space-y-3 border-t border-border pt-5">
          {[
            {
              n: "01",
              t: "Scarica il progetto",
              d: "ZIP con index.html, stili, logica e dati. Oppure solo la pagina.",
            },
            {
              n: "02",
              t: "Caricalo sul tuo spazio",
              d: "Netlify, Vercel, GitHub Pages, Aruba, SiteGround, o la cartella del dominio.",
            },
            {
              n: "03",
              t: "Apri il dominio",
              d: "Il sito è online. Se qualcosa non parte, il file deve chiamarsi index.html.",
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
          <Button variant="ink" size="lg" onClick={downloadProject} className="w-full">
            <Download />
            Scarica progetto .zip
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button variant="secondary" onClick={downloadSite}>
              <Download />
              Solo HTML
            </Button>
            <Button variant="secondary" onClick={onOpenSite}>
              <ExternalLink />
              Apri come pagina
            </Button>
            <Button variant="secondary" onClick={() => void copyHtml()}>
              <Copy />
              Copia HTML
            </Button>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
          <Check className="mt-0.5 size-3.5 shrink-0" />
          Dati salvati in Fenix mentre usi l'anteprima; nello ZIP restano nel browser dell'utente.
        </p>
      </div>
    </div>
  );
}
