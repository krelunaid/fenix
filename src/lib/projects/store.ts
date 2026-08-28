import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { DEMOS } from "./demos";
import {
  DEFAULT_PALETTE,
  type BuildStatus,
  type ChatMessage,
  type Palette,
  type Project,
  type ProjectKind,
} from "./types";

const MAX_PROJECTS = 24;

type NewProjectInput = {
  prompt: string;
  demoId?: string;
  kind?: ProjectKind;
};

type ProjectStore = {
  hydrated: boolean;
  projects: Project[];
  setHydrated: () => void;
  createFromBrief: (input: NewProjectInput) => Project;
  openDemo: (demoId: string) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addMessage: (id: string, message: Omit<ChatMessage, "id" | "at"> & { id?: string }) => void;
  removeProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
};

function trimList(projects: Project[]) {
  return [...projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PROJECTS);
}

function blankProject(prompt: string, kind: ProjectKind = "site"): Project {
  const now = Date.now();
  return {
    id: uid(),
    name: "Nuovo studio",
    tagline: "",
    prompt,
    kind,
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
      setHydrated: () => set({ hydrated: true }),
      getProject: (id) => get().projects.find((p) => p.id === id),
      createFromBrief: ({ prompt, kind }) => {
        const project = blankProject(prompt.trim(), kind ?? "site");
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
      partialize: (s) => ({ projects: s.projects }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.projects = state.projects.map((p) => ({
            ...p,
            buildLog: p.buildLog ?? [],
            status: p.status === "building" && !p.html ? "error" : p.status,
            error:
              p.status === "building" && !p.html
                ? "Interrotto. Riprova."
                : p.error,
          }));
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
    palette: Palette;
    html: string;
  },
  status: BuildStatus = "ready",
) {
  useProjectStore.getState().updateProject(id, {
    ...result,
    status,
    error: undefined,
  });
}
