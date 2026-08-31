import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { ProjectFile } from "./files";
import { CREDITS_GRANT, CREDIT_COST } from "./credits";
import { DEMOS } from "./demos";
import { resolveProjectKind, isPhoneKind } from "./infer";
import { validatePublishable, type HtmlReport } from "./validate-html";
import { recoverPersistedProject, STALE_BUILD_MS, RESUME_ERROR } from "./recover";
import { replaceAppleTabIcons } from "./craft-icons";
import {
  DEFAULT_PALETTE,
  type BuildStatus,
  type ChatMessage,
  type Palette,
  type Project,
  type ProjectKind,
} from "./types";

const MAX_PROJECTS = 48;
export { STALE_BUILD_MS, RESUME_ERROR };

type NewProjectInput = {
  prompt: string;
  demoId?: string;
  kind?: ProjectKind;
};

type ProjectStore = {
  hydrated: boolean;
  projects: Project[];
  creditsRemaining: number;
  appDb: Record<string, Record<string, unknown>>;
  setHydrated: () => void;
  createFromBrief: (input: NewProjectInput) => Project;
  openDemo: (demoId: string) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addMessage: (id: string, message: Omit<ChatMessage, "id" | "at"> & { id?: string }) => void;
  removeProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  spendCredit: (n?: number) => boolean;
  refundCredit: (n?: number) => void;
  loadAppData: (projectId: string, collection: string) => unknown;
  saveAppData: (projectId: string, collection: string, data: unknown) => void;
};

function trimList(projects: Project[]) {
  return [...projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PROJECTS);
}

function blankProject(prompt: string, kind: ProjectKind = "app"): Project {
  const now = Date.now();
  return {
    id: uid(),
    name: "Nuovo studio",
    tagline: "",
    prompt,
    kind,
    requestedKind: kind,
    summary: "",
    palette: DEFAULT_PALETTE,
    html: "",
    messages: [
      {
        id: uid(),
        role: "user",
        content: prompt,
        at: now,
      },
    ],
    buildLog: [],
    status: "building",
    createdAt: now,
    updatedAt: now,
  };
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      hydrated: false,
      projects: [],
      creditsRemaining: CREDITS_GRANT,
      appDb: {},
      setHydrated: () => set({ hydrated: true }),
      getProject: (id) => get().projects.find((p) => p.id === id),
      spendCredit: (n = CREDIT_COST) => {
        const remaining = get().creditsRemaining;
        const cost = Math.max(1, n);
        if (remaining < cost) return false;
        set({ creditsRemaining: remaining - cost });
        return true;
      },
      refundCredit: (n = CREDIT_COST) => {
        const cost = Math.max(1, n);
        set((s) => ({
          creditsRemaining: Math.min(CREDITS_GRANT, s.creditsRemaining + cost),
        }));
      },
      loadAppData: (projectId, collection) => {
        return get().appDb[projectId]?.[collection] ?? null;
      },
      saveAppData: (projectId, collection, data) => {
        set((s) => ({
          appDb: {
            ...s.appDb,
            [projectId]: {
              ...(s.appDb[projectId] ?? {}),
              [collection]: data,
            },
          },
        }));
      },
      createFromBrief: ({ prompt, kind }) => {
        const project = blankProject(prompt.trim(), kind ?? "app");
        set((s) => ({ projects: trimList([project, ...s.projects]) }));
        return project;
      },
      openDemo: (demoId) => {
        const demo = DEMOS[demoId];
        const now = Date.now();
        const project: Project = demo
          ? {
              id: uid(),
              name: demo.name,
              tagline: demo.tagline,
              prompt: `Apri l'esempio ${demo.name}`,
              kind: demo.kind,
              requestedKind: demo.kind,
              summary: demo.summary,
              palette: demo.palette,
              html: demo.html,
              messages: [
                {
                  id: uid(),
                  role: "assistant",
                  content: `${demo.name} è in anteprima e si usa. Dimmi cosa cambiare: lo ricostruisco.`,
                  at: now,
                },
              ],
              buildLog: [],
              status: "ready",
              createdAt: now,
              updatedAt: now,
              demoId,
            }
          : blankProject("Esempio");
        set((s) => ({ projects: trimList([project, ...s.projects]) }));
        return project;
      },
      updateProject: (id, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
          ),
        }));
      },
      addMessage: (id, message) => {
        const full: ChatMessage = {
          id: message.id ?? uid(),
          role: message.role,
          content: message.content,
          at: Date.now(),
        };
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, messages: [...p.messages, full], updatedAt: Date.now() }
              : p,
          ),
        }));
      },
      removeProject: (id) => {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      },
    }),
    {
      name: "officina-projects",
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Pick<
          ProjectStore,
          "projects" | "creditsRemaining" | "appDb"
        >;

        // One-time upgrade to the 50-credit testing grant.
        // The persist version prevents the refill from repeating after another 50 uses.
        if (version < 2) {
          return { ...state, creditsRemaining: CREDITS_GRANT };
        }

        return state;
      },
      partialize: (s) => ({
        projects: s.projects,
        creditsRemaining: s.creditsRemaining,
        appDb: s.appDb,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.projects = state.projects.map((p) => recoverPersistedProject(p));
          if (typeof state.creditsRemaining !== "number") {
            state.creditsRemaining = CREDITS_GRANT;
          }
          if (!state.appDb) state.appDb = {};
        }
        state?.setHydrated();
      },
    },
  ),
);

export function applyBuildResult(
  id: string,
  result: {
    name: string;
    tagline: string;
    kind: ProjectKind;
    summary: string;
    direction?: string;
    palette: Palette;
    html: string;
    files?: ProjectFile[];
  },
  status: BuildStatus = "building",
): HtmlReport {
  const existing = useProjectStore.getState().getProject(id);
  const kind = resolveProjectKind({
    stored: existing?.kind,
    requested: existing?.requestedKind,
    prompt: existing?.prompt,
    worker: result.kind,
  });
  const requestedKind = existing?.requestedKind ?? kind;
  const html = isPhoneKind(kind) ? replaceAppleTabIcons(result.html) : result.html;
  const report = validatePublishable(html, {
    kind,
    projectId: id,
    bg: result.palette?.bg ?? existing?.palette.bg,
  });
  if (!report.syntaxOk) return report;
  const nextStatus: BuildStatus =
    status === "ready" ? (report.complete ? "ready" : "building") : status;
  useProjectStore.getState().updateProject(id, {
    ...result,
    html,
    kind,
    requestedKind,
    status: nextStatus,
    error: undefined,
  });
  return { ...report, ok: nextStatus === "ready" && report.ok };
}

export function promoteReady(id: string): HtmlReport {
  const project = useProjectStore.getState().getProject(id);
  if (!project?.html) {
    return {
      syntaxOk: false,
      complete: false,
      ok: false,
      errors: ["HTML assente."],
      scriptErrors: [],
    };
  }
  const kind = resolveProjectKind({
    stored: project.kind,
    requested: project.requestedKind,
    prompt: project.prompt,
  });
  const report = validatePublishable(project.html, {
    kind,
    projectId: project.id,
    bg: project.palette.bg,
  });
  if (!report.ok) return report;
  useProjectStore.getState().updateProject(id, { kind, status: "ready", error: undefined });
  return report;
}
