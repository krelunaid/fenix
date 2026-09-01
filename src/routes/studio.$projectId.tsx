import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Code2,
  FolderGit2,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { BuildOverlay } from "@/components/build-overlay";
import { PreviewFrame, type Device } from "@/components/preview-frame";
import { PublishPanel } from "@/components/publish-panel";
import { ExportPanel } from "@/components/export-panel";
import { RevisionPanel, VersionsButton } from "@/components/revision-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wordmark } from "@/components/wordmark";
import { CreditMeter } from "@/components/credit-meter";
import { FileTree } from "@/components/file-tree";
import { runBuild, resumePolish } from "@/lib/ai/run-build";
import { suggestEdits } from "@/lib/ai/suggest";
import { codePaneFiles } from "@/lib/projects/fenix2";
import { useProjectStore } from "@/lib/projects/store";
import { isPublishable, needsResume } from "@/lib/projects/recover";
import type { ProjectKind } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio/$projectId")({
  component: StudioPage,
});

type Pane = "preview" | "chat" | "code";

function previewDevice(kind?: string): Device {
  return kind === "dashboard" || kind === "site" || kind === "landing" ? "desktop" : "mobile";
}

function StudioPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useProjectStore((s) => s.hydrated);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const addMessage = useProjectStore((s) => s.addMessage);
  const restoreRevision = useProjectStore((s) => s.restoreRevision);
  const branchRevision = useProjectStore((s) => s.branchRevision);
  const updateProject = useProjectStore((s) => s.updateProject);
  const [device, setDevice] = useState<Device>(previewDevice(project?.kind));
  const [pane, setPane] = useState<Pane>("preview");
  const [draft, setDraft] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
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
    } else if (project.status === "building" && project.html) {
      void resumePolish(project.id);
    }
  }, [hydrated, project?.id, project?.status, project?.html]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [project?.messages.length, project?.status, project?.buildLog?.length]);

  const creditsRemaining = useProjectStore((s) => s.creditsRemaining);
  const emptyCredits = creditsRemaining < 1;
  const building = project?.status === "building";
  const canResume = needsResume(project ?? {});
  const publishable = Boolean(project && isPublishable(project));

  useEffect(() => {
    if (project?.kind) setDevice(previewDevice(project.kind));
  }, [project?.kind]);

  const paletteStrip = useMemo(() => (project ? Object.values(project.palette) : []), [project]);

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
        <VersionsButton
          count={project.revisions?.length ?? 0}
          disabled={!project.html}
          onClick={() => setVersionsOpen(true)}
        />
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
          variant="secondary"
          size="sm"
          onClick={() => setExportOpen(true)}
          disabled={!project.html}
          aria-label="Esporta"
        >
          <FolderGit2 />
          <span className="hidden sm:inline">Esporta</span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setPublishOpen(true)}
          disabled={!publishable}
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
            onRetry={() => (canResume ? void resumePolish(project.id) : void runBuild(project.id))}
            retryLabel={canResume ? "Riprendi rifinitura" : "Riprova. Lo ricostruisco."}
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
              kind={project.kind}
            />
          ) : (
            <>
              <PreviewFrame
                html={project.html}
                files={project.files}
                name={project.name}
                device={device}
                background={project.palette.bg}
                palette={project.palette}
                projectId={project.id}
                kind={project.kind}
                className="h-full"
              />
              <BuildOverlay
                active={Boolean(building)}
                compact={Boolean(project.html)}
                steps={project.buildLog ?? []}
                error={!building && project.status === "error" ? project.error : undefined}
                onRetry={() =>
                  canResume ? void resumePolish(project.id) : void runBuild(project.id)
                }
                retryLabel={canResume ? "Riprendi rifinitura" : "Riprova. Lo ricostruisco."}
                hasDraft={Boolean(project.html)}
              />
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
              onRetry={() =>
                canResume ? void resumePolish(project.id) : void runBuild(project.id)
              }
              retryLabel={canResume ? "Riprendi rifinitura" : "Riprova. Lo ricostruisco."}
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
              kind={project.kind}
            />
          ) : (
            <>
              <PreviewFrame
                html={project.html}
                files={project.files}
                name={project.name}
                device={previewDevice(project.kind)}
                background={project.palette.bg}
                palette={project.palette}
                projectId={project.id}
                kind={project.kind}
                className="h-full"
              />
              <BuildOverlay
                active={Boolean(building)}
                compact={Boolean(project.html)}
                steps={project.buildLog ?? []}
                error={!building && project.status === "error" ? project.error : undefined}
                onRetry={() =>
                  canResume ? void resumePolish(project.id) : void runBuild(project.id)
                }
                retryLabel={canResume ? "Riprendi rifinitura" : "Riprova. Lo ricostruisco."}
                hasDraft={Boolean(project.html)}
              />
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
            className={cn("flex-1 text-sm text-muted-foreground", pane === id && "text-foreground")}
          >
            {label}
          </button>
        ))}
      </nav>

      <RevisionPanel
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        project={project}
        onRestore={(revisionId) => {
          if (restoreRevision(project.id, revisionId)) setVersionsOpen(false);
        }}
        onBranch={(revisionId) => {
          const branch = branchRevision(project.id, revisionId);
          if (!branch) return;
          setVersionsOpen(false);
          void navigate({ to: "/studio/$projectId", params: { projectId: branch.id } });
        }}
      />
      <ExportPanel
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        projectId={project.id}
        name={project.name}
        html={project.html}
        kind={project.kind}
        files={project.files}
      />
      <PublishPanel
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        projectId={project.id}
        name={project.name}
        html={project.html}
        kind={project.kind}
        palette={project.palette}
        tagline={project.tagline}
        summary={project.summary}
        files={project.files}
        onPublished={(id) => updateProject(project.id, { publishedId: id })}
        onOpenSite={(siteId) => {
          setPublishOpen(false);
          void navigate({ to: "/sito/$projectId", params: { projectId: siteId } });
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
  retryLabel = "Riprova. Lo ricostruisco.",
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
  retryLabel?: string;
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
            className="rounded-xl bg-primary px-3 py-2 text-left text-sm text-primary-foreground"
          >
            {retryLabel}
          </button>
        ) : null}
        {suggestions.length && !building && !emptyCredits ? (
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Fenix propone
            </p>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggest?.(s)}
                className="w-full rounded-xl border border-border bg-card px-3 py-3 text-left text-sm leading-relaxed text-foreground hover:border-primary/40"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
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
            <Button
              type="submit"
              variant="ink"
              size="sm"
              disabled={building || emptyCredits || draft.trim().length < 2}
            >
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
  kind,
}: {
  html: string;
  files?: { path: string; content: string }[];
  name: string;
  palette: { bg: string; surface: string; fg: string; muted: string; accent: string };
  kind?: string;
}) {
  const list = useMemo(
    () => codePaneFiles(html, files, { name, palette, kind: kind as ProjectKind | undefined }),
    [files, html, name, palette, kind],
  );
  const ordered = useMemo(
    () =>
      [...list].sort((a, b) => {
        const rank = (p: string) => (p.startsWith("src/") ? 0 : p === "package.json" ? 1 : 2);
        return rank(a.path) - rank(b.path) || a.path.localeCompare(b.path);
      }),
    [list],
  );
  const [active, setActive] = useState("");
  const current = ordered.find((f) => f.path === active) ?? ordered[0];

  if (!current) {
    return (
      <div className="grid h-full place-items-center bg-card text-sm text-muted-foreground">
        Nessun codice ancora.
      </div>
    );
  }

  return <FileTree files={ordered} activePath={current.path} onSelect={setActive} />;
}
