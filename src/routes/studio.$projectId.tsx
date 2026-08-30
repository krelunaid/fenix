import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Code2,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { BuildOverlay } from "@/components/build-overlay";
import { PreviewFrame, type Device } from "@/components/preview-frame";
import { PublishPanel } from "@/components/publish-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wordmark } from "@/components/wordmark";
import { CreditMeter } from "@/components/credit-meter";
import { runBuild } from "@/lib/ai/run-build";
import { suggestEdits } from "@/lib/ai/suggest";
import { fenix2Files } from "@/lib/projects/fenix2";
import { seedFiveScreens } from "@/lib/projects/files";
import { useProjectStore } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio/$projectId")({
  component: StudioPage,
});

type Pane = "preview" | "chat" | "code";

function StudioPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useProjectStore((s) => s.hydrated);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addMessage = useProjectStore((s) => s.addMessage);
  const [device, setDevice] = useState<Device>("mobile");
  const [pane, setPane] = useState<Pane>("preview");
  const [draft, setDraft] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!project) {
      void navigate({ to: "/" });
    }
  }, [hydrated, project, navigate]);

  useEffect(() => {
    if (!hydrated || !project) return;
    if (project.status === "building" && !project.html) {
      void runBuild(project.id);
    }
  }, [hydrated, project?.id, project?.status, project?.html]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [project?.messages.length, project?.status, project?.buildLog?.length]);

  const creditsRemaining = useProjectStore((s) => s.creditsRemaining);
  const emptyCredits = creditsRemaining < 1;
  const building = project?.status === "building";

  useEffect(() => {
    if (building) setDevice("mobile");
  }, [building]);

  const paletteStrip = useMemo(
    () => (project ? Object.values(project.palette) : []),
    [project],
  );

  function handleIterate(text = draft) {
    const next = text.trim();
    if (!project || next.length < 2 || building || emptyCredits) return;
    addMessage(project.id, { role: "user", content: next });
    setDraft("");
    void runBuild(project.id, next);
  }

  if (!project) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
        Apro lo studio…
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={() => navigate({ to: "/" })}
          aria-label="Torna agli studi"
        >
          <ArrowLeft />
        </Button>
        <Wordmark compact className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base tracking-tight">{project.name}</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {project.direction || project.tagline || project.kind}
          </p>
        </div>
        <CreditMeter className="hidden sm:inline-flex" />
        <div className="hidden items-center rounded-md border border-border p-0.5 md:flex">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-label={id}
              className={cn(
                "grid size-9 place-items-center rounded-sm text-muted-foreground transition-colors duration-150",
                device === id && "bg-raised text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPane((p) => (p === "code" ? "preview" : "code"))}
          className="hidden sm:inline-flex"
        >
          <Code2 />
          Codice
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setPublishOpen(true)}
          disabled={!project.html}
        >
          <Globe />
          <span className="hidden sm:inline">Pubblica</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="hidden w-[340px] shrink-0 flex-col border-r border-border md:flex">
          <ChatColumn
            projectName={project.name}
            messages={project.messages}
            draft={draft}
            setDraft={setDraft}
            building={building}
            errored={project.status === "error"}
            onSubmit={handleIterate}
            suggestions={
              project.status === "ready" && !building
                ? suggestEdits(project.prompt, project.name)
                : []
            }
            onSuggest={handleIterate}
            onRetry={() => void runBuild(project.id)}
            threadRef={threadRef}
            palette={paletteStrip}
            buildLog={project.buildLog ?? []}
            emptyCredits={emptyCredits}
          />
        </aside>

        <section className="relative hidden min-h-0 min-w-0 flex-1 md:block">
          {pane === "code" ? (
            <CodePane
              html={project.html}
              files={project.files}
              name={project.name}
              palette={project.palette}
            />
          ) : (
            <>
              <PreviewFrame
                html={project.html}
                name={project.name}
                device={building ? "mobile" : device}
                background={project.palette.bg}
                projectId={project.id}
                className="h-full"
              />
              <BuildOverlay active={building} steps={project.buildLog ?? []} />
            </>
          )}
        </section>

        <section className="relative min-h-0 flex-1 md:hidden">
          {pane === "chat" ? (
            <ChatColumn
              projectName={project.name}
              messages={project.messages}
              draft={draft}
              setDraft={setDraft}
              building={building}
              errored={project.status === "error"}
              onSubmit={handleIterate}
            suggestions={
              project.status === "ready" && !building
                ? suggestEdits(project.prompt, project.name)
                : []
            }
            onSuggest={handleIterate}
              onRetry={() => void runBuild(project.id)}
              threadRef={threadRef}
              palette={paletteStrip}
              buildLog={project.buildLog ?? []}
              emptyCredits={emptyCredits}
            />
          ) : pane === "code" ? (
            <CodePane
              html={project.html}
              files={project.files}
              name={project.name}
              palette={project.palette}
            />
          ) : (
            <>
              <PreviewFrame
                html={project.html}
                name={project.name}
                device="mobile"
                background={project.palette.bg}
                projectId={project.id}
                className="h-full"
              />
              <BuildOverlay active={building} steps={project.buildLog ?? []} />
            </>
          )}
        </section>
      </div>

      <nav className="flex h-14 shrink-0 border-t border-border md:hidden">
        {(
          [
            ["preview", "Anteprima"],
            ["chat", "Chat"],
            ["code", "Codice"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "flex-1 text-sm text-muted-foreground",
              pane === id && "text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <PublishPanel
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        name={project.name}
        html={project.html}
        files={project.files}
        onOpenSite={() => {
          setPublishOpen(false);
          void navigate({ to: "/sito/$projectId", params: { projectId: project.id } });
        }}
      />
    </div>
  );
}

function ChatColumn({
  projectName,
  messages,
  draft,
  setDraft,
  building,
  errored,
  onSubmit,
  onRetry,
  suggestions = [],
  onSuggest,
  threadRef,
  palette,
  buildLog,
  emptyCredits,
}: {
  projectName: string;
  messages: { id: string; role: string; content: string }[];
  draft: string;
  setDraft: (v: string) => void;
  building: boolean;
  errored: boolean;
  onSubmit: () => void;
  onRetry: () => void;
  suggestions?: string[];
  onSuggest?: (text: string) => void;
  threadRef: RefObject<HTMLDivElement | null>;
  palette: string[];
  buildLog: string[];
  emptyCredits: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Fenix · Studio</p>
        <p className="mt-1 truncate font-display text-lg tracking-tight">{projectName}</p>
        {palette.length ? (
          <div className="mt-3 flex h-2 overflow-hidden rounded-full">
            {palette.map((c, i) => (
              <span key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        ) : null}
      </div>
      <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-raised text-foreground",
            )}
          >
            {m.content}
          </div>
        ))}
        {building && buildLog.length ? (
          <ul className="space-y-1.5 rounded-lg border border-border bg-card px-3 py-2">
            {buildLog.map((s, i) => {
              const current = i === buildLog.length - 1;
              return (
                <li
                  key={`${s}-${i}`}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {current ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  ) : (
                    <Check className="size-3.5 shrink-0" />
                  )}
                  <span className={current ? "shimmer-text" : undefined}>{s}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {building && !buildLog.length ? (
          <p className="text-sm text-muted-foreground shimmer-text">Ok. Lo costruisco.</p>
        ) : null}
        {errored && !building ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Riprova. Lo ricostruisco.
          </button>
        ) : null}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {suggestions.length && !building && !emptyCredits ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggest?.(s)}
                className="max-w-full truncate rounded-full border border-white/12 bg-[#16122c] px-3 py-1.5 text-left text-[11px] text-[#cfc8ea] hover:border-white/25 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <div className="rounded-lg bg-paper p-2">
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              emptyCredits
                ? "Crediti esauriti. Puoi ancora aprire e pubblicare."
                : "Una modifica, una schermata, un comportamento…"
            }
            disabled={building || emptyCredits}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <div className="mt-1 flex justify-end">
            <Button type="submit" variant="ink" size="sm" disabled={building || emptyCredits || draft.trim().length < 2}>
              Invia
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CodePane({
  html,
  files,
  name,
  palette,
}: {
  html: string;
  files?: { path: string; content: string }[];
  name: string;
  palette: { bg: string; surface: string; fg: string; muted: string; accent: string };
}) {
  const list = useMemo(() => {
    const base =
      files && files.length > 0 ? files : html ? [{ path: "index.html", content: html }] : [];
    if (base.some((f) => f.path === "src/App.tsx")) return base;
    if (!html) return base;
    return fenix2Files(seedFiveScreens(base, html, name), { name, palette });
  }, [files, html, name, palette]);
  const ordered = useMemo(
    () =>
      [...list].sort((a, b) => {
        const rank = (p: string) => (p.startsWith("src/") ? 0 : p === "package.json" ? 1 : 2);
        return rank(a.path) - rank(b.path) || a.path.localeCompare(b.path);
      }),
    [list],
  );
  const [active, setActive] = useState("src/App.tsx");
  const current = ordered.find((f) => f.path === active) ?? ordered[0];

  if (!current) {
    return (
      <div className="grid h-full place-items-center bg-card text-sm text-muted-foreground">
        Nessun codice ancora.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {ordered.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => setActive(f.path)}
            className={cn(
              "rounded-full px-3 py-1.5 font-mono text-xs",
              f.path === current.path ? "bg-raised text-foreground" : "text-muted-foreground",
            )}
          >
            {f.path}
          </button>
        ))}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {current.content}
      </pre>
    </div>
  );
}
