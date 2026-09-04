import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ProjectCard } from "@/components/project-card";
import { Textarea } from "@/components/ui/textarea";
import { getAiStatus } from "@/lib/ai/generate";
import { formatPrefix, inferKind, type ProductChoice } from "@/lib/projects/infer";
import { useProjectStore } from "@/lib/projects/store";
import { MAX_PROJECT_ARCHIVE_BYTES } from "@/lib/projects/zip";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const hydrated = useProjectStore((s) => s.hydrated);
  const projects = useProjectStore((s) => s.projects);
  const creditsRemaining = useProjectStore((s) => s.creditsRemaining);
  const createFromBrief = useProjectStore((s) => s.createFromBrief);
  const importArchive = useProjectStore((s) => s.importArchive);
  const removeProject = useProjectStore((s) => s.removeProject);
  const [brief, setBrief] = useState("");
  const [choice, setChoice] = useState<ProductChoice>("auto");
  const [ai, setAi] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [importing, setImporting] = useState(false);
  const archiveRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let live = true;
    getAiStatus()
      .then((s) => {
        if (live) setAi(s.available);
      })
      .catch(() => {
        if (live) setAi(false);
      });
    return () => {
      live = false;
    };
  }, []);

  function handleBuild() {
    const text = brief.trim();
    if (text.length < 3) return;
    if (creditsRemaining < 4) {
      toast("Crediti esauriti. Ogni creazione usa 4 crediti.");
      return;
    }
    const kind = choice === "auto" ? inferKind(text) : choice;
    const project = createFromBrief({ prompt: `${formatPrefix(kind)}${text}`, kind });
    void navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
  }

  async function handleArchive(file: File | undefined) {
    if (!file || importing || !hydrated) return;
    setImporting(true);
    try {
      if (file.size > MAX_PROJECT_ARCHIVE_BYTES) throw new Error("Archivio ZIP troppo grande.");
      const project = importArchive({
        bytes: new Uint8Array(await file.arrayBuffer()),
        filename: file.name,
      });
      toast(`${project.name} importato. Nessun credito usato.`);
      await navigate({ to: "/studio/$projectId", params: { projectId: project.id } });
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "Importazione ZIP rifiutata.");
    } finally {
      setImporting(false);
      if (archiveRef.current) archiveRef.current.value = "";
    }
  }

  const recents = mounted && hydrated ? projects.slice(0, 6) : [];
  const emptyCredits = mounted && hydrated && creditsRemaining < 1;

  return (
    <AppShell
      rail={
        <>
          <div className="rounded-2xl border border-white/8 bg-[#16122c]/90 p-4">
            <p className="text-sm font-semibold">Panoramica</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9b93c2]">
              Luce bassa. Un oggetto.
              <br />
              Il resto aspetta te.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#16122c]/90 p-4">
            <p className="flex items-center justify-between text-sm font-semibold">
              Stato build
              <Activity className="size-3.5 text-[#7c6bff]" />
            </p>
            <p className="mt-3 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#9b93c2]">
              Nessuna build attiva
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#16122c]/90 p-4">
            <p className="text-sm font-semibold">Attività recente</p>
            <p className="mt-2 text-[13px] text-[#9b93c2]">
              {recents[0] ? recents[0].name : "Nessuna attività recente"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#16122c]/90 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-[#7c6bff]" />
              Assistenza
            </p>
            <p className="mt-2 text-[13px] text-[#9b93c2]">Fenix by Kreluna</p>
          </div>
        </>
      }
    >
      <p className="text-[11px] tracking-[0.22em] text-[#6e6794] uppercase">01 / CREATE</p>
      <p className="mt-5 text-[17px] text-[#cfc8ea]">Ciao 👋</p>

      <div className="relative mt-2 min-h-[220px] pr-[200px]">
        <h1 className="max-w-[16ch] text-[52px] leading-[1.02] font-semibold tracking-[-0.045em]">
          Cosa vuoi
          <br />
          <span className="fenix-grad">creare oggi?</span>
        </h1>
        <img
          src="/fenix-orb.png"
          alt="Fenix"
          className="pointer-events-none absolute top-[-48px] right-[-12px] w-[260px] bg-transparent"
        />
      </div>

      <p className="mt-2 max-w-[520px] text-[15px] leading-relaxed text-[#9b93c2]">
        Descrivi la tua idea. Fenix crea un prototipo funzionante, con codice esportabile e opzioni
        di pubblicazione.
      </p>

      <form
        id="nuovo"
        onSubmit={(e) => {
          e.preventDefault();
          handleBuild();
        }}
        className="mt-8 rounded-[22px] border border-white/10 bg-[#100c22]/80 p-5"
      >
        <p className="text-[11px] tracking-[0.18em] text-[#6e6794] uppercase">Inizia da un’idea</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["auto", "Automatico"],
              ["app", "App"],
              ["site", "Sito"],
              ["dashboard", "Gestionale"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setChoice(id)}
              className={
                choice === id
                  ? "h-8 rounded-full bg-white px-3 text-xs font-semibold text-[#1d1d1f]"
                  : "h-8 rounded-full border border-white/12 px-3 text-xs text-[#9b93c2]"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#6e6794]">
          {choice === "auto"
            ? "Se non scegli: App telefono. Sito o gestionale se lo scrivi nel brief."
            : choice === "app"
              ? "App da telefono, tab in basso."
              : choice === "site"
                ? "Sito o vetrina."
                : "Gestionale da ufficio: tabelle, form, numeri."}
        </p>
        <label htmlFor="brief" className="sr-only">
          Brief del progetto
        </label>
        <Textarea
          id="brief"
          rows={6}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleBuild();
            }
          }}
          placeholder="Descrivi il software che vuoi creare..."
          className="mt-3 min-h-[132px] text-[16px] text-white placeholder:text-[#6e6794]"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[#6e6794]">
            {ai === false
              ? "Studio non disponibile."
              : emptyCredits
                ? "Crediti esauriti."
                : "Invio per creare · 4 crediti"}
          </p>
          <button
            type="submit"
            disabled={brief.trim().length < 3 || emptyCredits}
            className="h-9 rounded-full bg-[#7c6bff] px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            Crea
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-[#6e6794]">
            Hai già un export Fenix? Riapri i file in un nuovo studio con una prima versione, senza
            crediti.
          </p>
          <input
            ref={archiveRef}
            type="file"
            accept=".zip,application/zip"
            aria-label="Importa archivio Fenix ZIP"
            className="sr-only"
            onChange={(event) => void handleArchive(event.currentTarget.files?.[0])}
          />
          <button
            type="button"
            disabled={importing || !hydrated}
            onClick={() => archiveRef.current?.click()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white hover:bg-white/8 disabled:opacity-40"
          >
            <Upload className="size-4" />
            {importing ? "Verifico…" : "Importa .zip Fenix"}
          </button>
        </div>
      </form>

      {recents.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex justify-between">
            <h2 className="text-sm font-semibold">I miei progetti</h2>
            <Link to="/vetrina" className="text-xs text-[#9b93c2] no-underline hover:text-white">
              Vedi tutti
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recents.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} onDelete={removeProject} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
