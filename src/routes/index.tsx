import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity, ArrowRight, BookOpen, ChevronDown, CreditCard, FolderKanban,
  HelpCircle, HomeIcon, LayoutGrid, Plus, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAiStatus } from "@/lib/ai/generate";
import { EXAMPLES } from "@/lib/projects/examples";
import { useProjectStore } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const navigation = [
  { label: "Home", icon: HomeIcon, active: true },
  { label: "Nuovo progetto", icon: Plus },
  { label: "I miei progetti", icon: FolderKanban },
  { label: "Progetti demo", icon: LayoutGrid },
  { label: "Prezzi", icon: CreditCard },
  { label: "Assistenza", icon: BookOpen },
];

function Home() {
  const navigate = useNavigate();
  const hydrated = useProjectStore((s) => s.hydrated);
  const projects = useProjectStore((s) => s.projects);
  const createFromBrief = useProjectStore((s) => s.createFromBrief);
  const [brief, setBrief] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    getAiStatus().then((status) => live && setAi(status.available)).catch(() => live && setAi(false));
    return () => { live = false; };
  }, []);

  function goStudio(id: string) {
    void navigate({ to: "/studio/$projectId", params: { projectId: id } });
  }

  function handleBuild() {
    const text = brief.trim();
    if (text.length < 3 || ai === false) return;
    goStudio(createFromBrief({ prompt: text }).id);
  }

  const recents = hydrated ? projects.slice(0, 3) : [];

  return (
    <div className="fenix-shell min-h-dvh bg-[#050814] text-[#f8f8ff]">
      <aside className="fenix-sidebar hidden lg:flex">
        <a href="/" className="flex items-center gap-3.5 px-3 text-white no-underline">
          <img src="/assets/fenix-orb.png" alt="" className="h-14 w-14 object-contain" />
          <span className="flex flex-col">
            <strong className="text-xl tracking-[0.08em]">FENIX</strong>
            <span className="mt-1 text-[10px] tracking-[0.26em] text-[#858aa0]">BY KRELUNA</span>
          </span>
        </a>

        <nav className="mt-12 space-y-2" aria-label="Navigazione principale">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              type="button"
              key={label}
              onClick={() => label === "Nuovo progetto" && document.getElementById("brief")?.focus()}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-[15px] transition",
                active
                  ? "border border-[#7540ca] bg-[#29114b] text-white shadow-[inset_0_0_28px_rgba(139,68,255,.1)]"
                  : "border border-transparent text-[#9ba0b6] hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Icon className="size-[18px]" />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 px-3 text-[11px] text-[#74798f]">
            <a href="https://www.kreluna.it" className="hover:text-white">Contatti</a>
            <span>Privacy</span><span>Termini</span>
          </div>
          <div className="rounded-2xl border border-[#222941] bg-[#0a0e1c] p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#8c4cff] to-[#5728dd] font-semibold">F</span>
              <span><strong className="block text-sm">Ospite</strong><span className="text-xs text-[#858aa0]">Sala 01</span></span>
            </div>
          </div>
        </div>
      </aside>

      <main className="fenix-main min-w-0">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-2.5 lg:hidden">
            <img src="/assets/fenix-orb.png" alt="" className="size-10 object-contain" />
            <strong className="tracking-[0.1em]">FENIX</strong>
          </a>
          <span className="hidden text-xs tracking-[0.2em] text-[#8f95ac] uppercase lg:block">Area Fenix / Crea il tuo progetto</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="grid size-10 place-items-center rounded-full border border-[#252b43] text-[#9399b0] hover:text-white" aria-label="Aiuto"><HelpCircle className="size-4" /></button>
            <button className="flex h-10 items-center gap-3 rounded-xl border border-[#252b43] bg-[#0b1020] px-3 text-sm text-[#c8cad6]">Italiano <ChevronDown className="size-4" /></button>
          </div>
        </header>

        <div className="fenix-grid-bg min-h-[calc(100dvh-73px)] px-5 py-8 sm:px-8 xl:px-10">
          <section className="mx-auto max-w-[1120px]">
            <p className="rise-in font-mono text-[11px] tracking-[0.28em] text-[#7f849b]">01 / CREATE</p>
            <div className="mt-7 grid items-center gap-8 xl:grid-cols-[1.15fr_.85fr]">
              <div className="relative z-10">
                <p className="rise-in text-lg text-[#c9cbd8]">Ciao 👋</p>
                <h1 className="rise-in-2 mt-3 max-w-3xl font-sans text-[clamp(3.25rem,7.2vw,6.9rem)] leading-[0.92] font-bold tracking-[-0.07em]">
                  Cosa vuoi<br /><span className="fenix-gradient-text">creare</span> oggi?
                </h1>
                <p className="rise-in-3 mt-6 max-w-2xl text-base leading-relaxed text-[#9da2b7] sm:text-lg">
                  Descrivi la tua idea. Fenix crea un prototipo funzionante, con codice esportabile e opzioni di pubblicazione.
                </p>
              </div>
              <div className="rise-in-3 pointer-events-none relative mx-auto hidden w-full max-w-[480px] xl:block">
                <div className="absolute inset-[18%] rounded-full bg-[#6f35ff]/25 blur-3xl" />
                <img src="/assets/fenix-orb.png" alt="Emblema Fenix" className="relative w-full drop-shadow-[0_0_36px_rgba(118,64,255,.42)]" />
              </div>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); handleBuild(); }} className="rise-in-4 fenix-prompt-card mt-10 p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <label htmlFor="brief" className="text-xs font-semibold tracking-[0.2em] text-[#a778ff] uppercase">Inizia da un’idea</label>
                <span className="hidden text-xs text-[#6f758d] sm:block">Invio per creare · Maiusc+Invio per andare a capo</span>
              </div>
              <Textarea
                id="brief" rows={6} value={brief} onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleBuild(); } }}
                placeholder="Descrivi il software che vuoi creare..."
                className="min-h-[176px] resize-none rounded-2xl border-[#2c254b] bg-[#070b18]/90 px-5 py-5 text-base text-white placeholder:text-[#777d93] focus-visible:border-[#8152dc] focus-visible:ring-[#7540ca]/30 sm:text-lg"
              />
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className={cn("text-xs", ai === false ? "text-[#ff8b9c]" : "text-[#7f849a]")}>{ai === false ? "Fenix non è disponibile. Riprova tra un attimo." : "Fenix trasformerà il brief in un'app funzionante."}</p>
                <Button type="submit" disabled={brief.trim().length < 3 || ai === false} className="h-12 rounded-xl border border-[#8b60ff] bg-gradient-to-r from-[#7540e8] to-[#4d75df] px-6 text-white shadow-[0_12px_30px_rgba(91,54,218,.28)] hover:brightness-110">
                  Crea progetto <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button key={example.id} type="button" onClick={() => { setBrief(example.prompt); document.getElementById("brief")?.focus(); }} className="rounded-full border border-[#252b43] bg-[#0a0e1c]/85 px-4 py-2 text-xs text-[#9298ad] transition hover:border-[#6941b5] hover:text-white">{example.label}</button>
              ))}
            </div>

            {recents.length > 0 && (
              <section className="mt-14 border-t border-white/[0.08] pt-8">
                <div className="mb-5 flex items-center justify-between">
                  <p className="font-mono text-[11px] tracking-[0.24em] text-[#a778ff] uppercase">Fenix selected / {String(recents.length).padStart(2, "0")}</p>
                  <span className="text-xs text-[#72788f]">I tuoi progetti recenti</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {recents.map((project) => (
                    <button key={project.id} type="button" onClick={() => goStudio(project.id)} className="group rounded-2xl border border-[#20263c] bg-[#090d1a] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#6841ad]">
                      <span className="mb-4 flex h-2 overflow-hidden rounded-full">{Object.values(project.palette).slice(0, 5).map((color, index) => <span key={index} className="flex-1" style={{ background: color }} />)}</span>
                      <strong className="block text-sm">{project.name}</strong>
                      <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#7f8499]">{project.tagline || project.prompt}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>
      </main>

      <aside className="fenix-rail hidden 2xl:flex">
        <InfoCard title="Panoramica"><p>Luce bassa. Un oggetto.<br />Il resto aspetta te.</p></InfoCard>
        <InfoCard title="Stato build" icon={<Activity className="size-5 text-[#9c5cff]" />}><div className="rounded-full border border-[#262d45] px-4 py-3 text-sm text-[#858ba2]">Nessuna build attiva</div></InfoCard>
        <InfoCard title="Attività recente"><p>{recents.length ? `${recents.length} progetti in questo browser` : "Nessuna attività recente"}</p></InfoCard>
        <div className="mt-auto rounded-2xl border border-[#222941] bg-[#0a0e1c] p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-[#593696] bg-[#271747]"><Sparkles className="size-5 text-[#b27aff]" /></span>
            <div><strong className="block text-sm">Assistenza</strong><span className="text-xs text-[#858aa0]">Fenix by Kreluna</span></div>
            <HelpCircle className="ml-auto size-5 text-[#858aa0]" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#222941] bg-[#090d1a] p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-sans text-base font-semibold tracking-[-0.01em]">{title}</h2>{icon}</div>
      <div className="text-sm leading-relaxed text-[#8e94aa]">{children}</div>
    </section>
  );
}
