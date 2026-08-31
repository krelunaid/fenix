import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { ProjectFile } from "./files";
import { CREDITS_GRANT, CREDIT_COST } from "./credits";
import { DEMOS } from "./demos";
import { resolveProjectKind, isPhoneKind } from "./infer";
import { validatePublishable, type HtmlReport } from "./validate-html";
import { recoverPersistedProject, STALE_BUILD_MS, RESUME_ERROR } from "./recover";
import { polishDashboardHtml, scrubTechMessages, shouldRepairDashboard } from "./dashboard-crud";
import { replaceAppleTabIcons, rewriteIosWidgetHome } from "./craft-icons";
import {
  DEFAULT_PALETTE,
  type BuildStatus,
  type ChatMessage,
  type Palette,
  type Project,
  type ProjectKind,
} from "./types";

import {
  APP_DB_KEY,
  asBox,
  countItems,
  embedAppDataInProjectsBlob,
  isEmptyVal,
  mergeAppDb,
  pickNewer,
  readAllDurable,
  readIndexedDb,
  readWebStorage,
  unwrapItems,
  verifyDurableBytes,
  writeDurable,
  type AppDb,
} from "./durable-db";

const MAX_PROJECTS = 48;
export { STALE_BUILD_MS, RESUME_ERROR };
export { APP_DB_KEY };

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
  saveAppData: (
    projectId: string,
    collection: string,
    data: unknown,
  ) => Promise<{ ok: boolean; v: unknown; durable: number }>;
};

let idbSnap: AppDb = {};

function loadCollection(
  projectId: string,
  collection: string,
  appDb: AppDb,
  projects: Project[],
): unknown {
  const durable = mergeAppDb(idbSnap, readWebStorage())[projectId]?.[collection];
  if (!isEmptyVal(unwrapItems(durable))) return durable;
  const mem = appDb[projectId]?.[collection];
  if (!isEmptyVal(unwrapItems(mem))) return mem;
  const embedded = projects.find((p) => p.id === projectId)?.appData?.[collection];
  if (!isEmptyVal(unwrapItems(embedded))) return embedded;
  return durable ?? mem ?? embedded ?? null;
}

function publishDiag(
  projectId: string,
  collection: string,
  extra: Record<string, number | string> = {},
) {
  if (typeof document === "undefined") return;
  void verifyDurableBytes(projectId, collection, 0).then((proof) => {
    const payload = {
      pid: projectId.slice(0, 8),
      col: collection,
      local: proof.local,
      session: proof.session,
      idb: proof.idb,
      projects: proof.projects,
      epoch: Date.now(),
      hydrated: useProjectStore.getState().hydrated ? 1 : 0,
      ...extra,
    };
    document.documentElement.setAttribute("data-fenix-diag", JSON.stringify(payload));
  });
}

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
        return loadCollection(projectId, collection, get().appDb, get().projects);
      },
      saveAppData: async (projectId, collection, data) => {
        const existingRaw = mergeAppDb(idbSnap, await readAllDurable())[projectId]?.[collection];
        const existing = asBox(existingRaw);
        const incoming = asBox(data) ?? {
          rev: (existing?.rev ?? 0) + 1,
          items: Array.isArray(data) ? data : [],
          writer: "",
          at: Date.now(),
        };
        const stale = Boolean(
          existing &&
            (incoming.rev < existing.rev ||
              (incoming.rev === existing.rev &&
                incoming.writer &&
                existing.writer &&
                incoming.writer !== existing.writer &&
                incoming.items.length < existing.items.length)),
        );
        const chosen = stale
          ? existingRaw
          : { _fenix: 1 as const, rev: incoming.rev, items: incoming.items, writer: incoming.writer, at: incoming.at };
        const current = await readAllDurable();
        current[projectId] = { ...(current[projectId] ?? {}), [collection]: chosen };
        await writeDurable(current);
        idbSnap = mergeAppDb(idbSnap, current);
        embedAppDataInProjectsBlob(projectId, collection, chosen);
        set((s) => ({
          appDb: {
            ...s.appDb,
            [projectId]: {
              ...(s.appDb[projectId] ?? {}),
              [collection]: chosen,
            },
          },
        }));
        const expected = countItems(chosen);
        const proof = await verifyDurableBytes(projectId, collection, expected);
        publishDiag(projectId, collection, { save: 1, durable: proof.durable, rev: incoming.rev });
        return { ok: proof.ok, v: proof.ok ? chosen : null, durable: proof.durable };
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
      }),
      onRehydrateStorage: () => (state) => {
        void (async () => {
          const idb = await readIndexedDb();
          idbSnap = idb;
          if (state) {
            state.projects = state.projects.map((p) => {
              const recovered = recoverPersistedProject(p);
              return {
                ...recovered,
                messages: scrubTechMessages(p.messages),
                palette:
                  recovered.kind === "dashboard" && /argilla|ceram|viva/i.test(`${p.name} ${p.prompt}`)
                    ? {
                        bg: "#f3eadc",
                        surface: "#fbf6ee",
                        fg: "#2b211c",
                        muted: "#6e5648",
                        accent: "#b85c38",
                        line: "#d7c4b0",
                      }
                    : recovered.palette ?? p.palette,
              };
            });
            if (typeof state.creditsRemaining !== "number") {
              state.creditsRemaining = CREDITS_GRANT;
            }
            const disk = readWebStorage();
            let merged: AppDb = mergeAppDb(idb, disk);
            for (const p of state.projects) {
              if (!p.appData) continue;
              merged[p.id] = { ...(merged[p.id] ?? {}) };
              for (const [col, val] of Object.entries(p.appData)) {
                merged[p.id][col] = pickNewer(merged[p.id][col], val);
              }
            }
            state.appDb = merged;
            useProjectStore.setState({
              projects: state.projects,
              appDb: merged,
              creditsRemaining: state.creditsRemaining,
              hydrated: true,
            });
            const first = state.projects[0];
            if (first) publishDiag(first.id, "items", { boot: 1 });
          } else {
            useProjectStore.getState().setHydrated();
          }
        })();
      },
    },
  ),
);

if (typeof window !== "undefined" && !(window as Window & { __fenixDbBound?: boolean }).__fenixDbBound) {
  (window as Window & { __fenixDbBound?: boolean }).__fenixDbBound = true;
  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data as {
      t?: string;
      id?: string;
      op?: string;
      projectId?: string;
      col?: string;
      data?: unknown;
    };
    if (!msg || msg.t !== "fenix-db" || !msg.id || !msg.col || !msg.projectId) return;
    const reply = (value: unknown) => {
      const source = event.source as Window | null;
      source?.postMessage({ t: "fenix-db", id: msg.id, v: value }, "*");
    };
    const apply = async () => {
      const store = useProjectStore.getState();
      let value: unknown = null;
      if (msg.op === "load") {
        idbSnap = mergeAppDb(idbSnap, await readIndexedDb());
        value = store.loadAppData(msg.projectId!, msg.col!);
        publishDiag(msg.projectId!, msg.col!, { load: 1, n: countItems(value) });
      }
      if (msg.op === "save") {
        value = await store.saveAppData(msg.projectId!, msg.col!, msg.data);
      }
      reply(value);
    };
    if (useProjectStore.getState().hydrated) {
      void apply();
      return;
    }
    const unsub = useProjectStore.subscribe((s) => {
      if (!s.hydrated) return;
      unsub();
      void apply();
    });
  });
}

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
  const html = isPhoneKind(kind)
    ? rewriteIosWidgetHome(replaceAppleTabIcons(result.html))
    : shouldRepairDashboard(result.html, kind)
      ? polishDashboardHtml(result.html, kind)
      : result.html;
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
