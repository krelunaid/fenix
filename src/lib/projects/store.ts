import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { ProjectFile } from "./files";
import { projectFiles } from "./files";
import { CREDITS_GRANT, CREDIT_COST } from "./credits";
import { DEMOS } from "./demos";
import { formatPrefix, resolveProjectKind, isPhoneKind } from "./infer";
import { validatePublishable, type HtmlReport } from "./validate-html";
import { blocksPublish } from "../ai/build-contract";
import { recoverPersistedProject, STALE_BUILD_MS, RESUME_ERROR } from "./recover";
import { polishDashboardHtml, scrubTechMessages, shouldRepairDashboard } from "./dashboard-crud";
import {
  replaceAppleTabIcons,
  rewriteIosWidgetHome,
  stripPhoneChromeFromSite,
  ensureMainElementId,
} from "./craft-icons";
import { repairLeakedCss } from "./color-scheme";
import { rewriteFenixCollections } from "./fenix-collection";
import {
  DEFAULT_PALETTE,
  type BuildStatus,
  type ChatMessage,
  type Palette,
  type Project,
  type ProjectKind,
} from "./types";
import {
  rememberPaletteList,
  sanitizePaletteHistory,
  type PaletteRecord,
} from "./palette-engine";
import { familyFromBrief, fallbackPaletteFromBrief } from "./design-tokens";
import {
  branchProjectRevision,
  commitIfChanged,
  mergeProjectBranch,
  restoreProjectRevision,
  type BranchMergeResult,
} from "./revisions";
import { appendProjectActivity, type ActivityInput } from "./activity";
import { importProjectArchive } from "./zip";

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

type ImportArchiveInput = {
  bytes: Uint8Array;
  filename?: string;
};

type ImportTreeInput = {
  files: ProjectFile[];
  name?: string;
  kind?: string;
  source: "GitHub";
};

type ProjectStore = {
  hydrated: boolean;
  projects: Project[];
  creditsRemaining: number;
  appDb: Record<string, Record<string, unknown>>;
  recentPalettes: PaletteRecord[];
  setHydrated: () => void;
  createFromBrief: (input: NewProjectInput) => Project;
  importArchive: (input: ImportArchiveInput) => Project;
  importTree: (input: ImportTreeInput) => Project;
  openDemo: (demoId: string) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  restoreRevision: (id: string, revisionId: string) => boolean;
  branchRevision: (id: string, revisionId: string) => Project | null;
  mergeBranch: (branchId: string) => BranchMergeResult;
  addMessage: (id: string, message: Omit<ChatMessage, "id" | "at"> & { id?: string }) => void;
  removeProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  spendCredit: (n?: number) => boolean;
  refundCredit: (n?: number) => void;
  rememberPalette: (rec: PaletteRecord) => void;
  loadAppData: (projectId: string, collection: string) => unknown;
  saveAppData: (
    projectId: string,
    collection: string,
    data: unknown,
  ) => Promise<{ ok: boolean; v: unknown; durable: number }>;
  recordActivity: (projectId: string, input: ActivityInput) => void;
};

let idbSnap: AppDb = {};

function aliasKeys(projectId: string, requested: string, db: AppDb): string[] {
  const keys = new Set(["items", "state", requested]);
  for (const k of Object.keys(db[projectId] ?? {})) keys.add(k);
  return [...keys];
}

function pickAliased(
  projectId: string,
  collection: string,
  sources: (AppDb | Record<string, Record<string, unknown>> | undefined)[],
): unknown {
  let best: unknown = null;
  for (const src of sources) {
    if (!src) continue;
    const bag = (src[projectId] ?? {}) as Record<string, unknown>;
    const keys = new Set([...Object.keys(bag), collection, "items", "state"]);
    for (const k of keys) best = pickNewer(best, bag[k]);
  }
  return best;
}

function loadCollection(
  projectId: string,
  collection: string,
  appDb: AppDb,
  projects: Project[],
): unknown {
  const durableDb = mergeAppDb(idbSnap, readWebStorage());
  const embedded = projects.find((p) => p.id === projectId)?.appData;
  const best = pickAliased(projectId, collection, [
    durableDb,
    appDb,
    embedded ? { [projectId]: embedded } : undefined,
  ]);
  if (asBox(best)?.rev) return best;
  if (!isEmptyVal(unwrapItems(best))) return best;
  return best ?? null;
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
  return [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_PROJECTS);
}

function withStatusActivity(previous: Project, next: Project): Project {
  if (previous.status === next.status) return next;
  if (next.status === "ready") {
    return appendProjectActivity(next, {
      kind: "ready",
      outcome: "ok",
      label: "Build pronta",
      metrics: {
        files: projectFiles({ html: next.html, files: next.files }).length,
        revisions: next.revisions?.length ?? 0,
      },
    });
  }
  if (next.status === "error") {
    return appendProjectActivity(next, {
      kind: "error",
      outcome: "err",
      label: "Build interrotta",
      detail: next.error || "Controllo non superato",
    });
  }
  return next;
}

function blankProject(prompt: string, kind: ProjectKind = "app"): Project {
  const now = Date.now();
  return appendProjectActivity(
    {
      id: uid(),
      name: "Nuovo studio",
      tagline: "",
      prompt,
      kind,
      requestedKind: kind,
      summary: "",
      palette: fallbackPaletteFromBrief(prompt),
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
    },
    {
      kind: "created",
      outcome: "info",
      label: "Progetto creato",
      at: now,
    },
  );
}

const PROJECT_KINDS = new Set<ProjectKind>(["landing", "app", "dashboard", "tool", "game", "site"]);

function importedName(html: string, manifestName: string | undefined, filename = ""): string {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
  const file = filename.replace(/\.zip$/i, "").replace(/[-_]+/g, " ");
  const raw = manifestName || title || file || "Progetto importato";
  return (
    raw
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;|&gt;/gi, " ")
      .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Progetto importato"
  );
}

function importedPalette(html: string): Palette {
  const color = (key: keyof Palette, fallback: string): string => {
    const hit = html.match(new RegExp(`--${key}\\s*:\\s*(#[0-9a-f]{6})(?:[^0-9a-f]|$)`, "i"));
    return hit?.[1] || fallback;
  };
  return {
    bg: color("bg", DEFAULT_PALETTE.bg),
    surface: color("surface", DEFAULT_PALETTE.surface),
    fg: color("fg", DEFAULT_PALETTE.fg),
    muted: color("muted", DEFAULT_PALETTE.muted),
    accent: color("accent", DEFAULT_PALETTE.accent),
    line: color("line", DEFAULT_PALETTE.line || "#3d3428"),
  };
}

function createImportedProject(input: {
  files: ProjectFile[];
  name?: string;
  kind?: string;
  filename?: string;
  source: "ZIP" | "GitHub";
}): Project {
  const rawKind = input.kind;
  if (!rawKind || !PROJECT_KINDS.has(rawKind as ProjectKind)) {
    throw new Error("Tipo di progetto assente o non valido in fenix.json.");
  }
  const kind = rawKind as ProjectKind;
  const tree = projectFiles({ files: input.files });
  if (tree.length !== input.files.length) {
    throw new Error("Albero importato non valido o non canonico.");
  }
  const html = tree.find((file) => file.path === "index.html")?.content || "";
  const id = uid();
  const sourceLabel = input.source === "ZIP" ? "archivio" : "GitHub";
  const prompt = `${formatPrefix(kind)}Importato da ${sourceLabel} Fenix verificato.`;
  const palette = importedPalette(html);
  const report = validatePublishable(html, { kind, projectId: id, palette });
  const contractBlock = blocksPublish(html, kind, tree, prompt);
  if (!report.ok || contractBlock) {
    const reason = contractBlock || report.errors.slice(0, 3).join(" · ") || "gate non superato";
    throw new Error(`Importazione fermata: ${reason}`);
  }
  const now = Date.now();
  const name = importedName(html, input.name, input.filename);
  const project: Project = {
    id,
    name,
    tagline: input.source === "ZIP" ? "Archivio Fenix verificato" : "GitHub Fenix verificato",
    prompt,
    kind,
    requestedKind: kind,
    summary: "Albero importato senza dati, chat, job, deploy o credenziali.",
    direction: `Import ${input.source}`,
    palette,
    html,
    files: tree,
    messages: [
      {
        id: uid(),
        role: "assistant",
        content: `${input.source === "ZIP" ? "Archivio" : "GitHub"} verificato. Il progetto è pronto in un nuovo studio indipendente.`,
        at: now,
      },
    ],
    buildLog: [`${input.source} Fenix verificato`, "Gate anteprima superato"],
    status: "ready",
    createdAt: now,
    updatedAt: now,
  };
  return appendProjectActivity(
    commitIfChanged(project, { source: "create", label: `Import ${input.source}`, at: now }),
    {
      kind: "import",
      outcome: "ok",
      label: `${input.source} importato`,
      detail: "Nuovo studio indipendente",
      metrics: { files: tree.length, revisions: 1 },
      at: now,
    },
  );
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      hydrated: false,
      projects: [],
      creditsRemaining: CREDITS_GRANT,
      appDb: {},
      recentPalettes: [],
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
      rememberPalette: (rec) => {
        set((s) => ({ recentPalettes: rememberPaletteList(s.recentPalettes, rec) }));
      },
      loadAppData: (projectId, collection) => {
        return loadCollection(projectId, collection, get().appDb, get().projects);
      },
      recordActivity: (projectId, input) => {
        set((s) => ({
          projects: s.projects.map((project) =>
            project.id === projectId ? appendProjectActivity(project, input) : project,
          ),
        }));
      },
      saveAppData: async (projectId, collection, data) => {
        const current = await readAllDurable();
        const keys = aliasKeys(projectId, collection, current);
        const existingRaw = keys.reduce(
          (acc, k) => pickNewer(acc, current[projectId]?.[k]),
          pickNewer(null, get().appDb[projectId]?.[collection]),
        );
        const existing = asBox(existingRaw);
        const boxed = asBox(data);
        if (!boxed && !Array.isArray(data)) {
          const proof = await verifyDurableBytes(projectId, collection, countItems(existingRaw));
          publishDiag(projectId, collection, { save: 1, keep: 1, durable: proof.durable });
          return {
            ok: proof.ok || countItems(existingRaw) > 0,
            v: existingRaw,
            durable: proof.durable,
          };
        }
        const incoming = boxed ?? {
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
          : {
              _fenix: 1 as const,
              rev: incoming.rev,
              items: incoming.items,
              writer: incoming.writer,
              at: incoming.at,
            };
        current[projectId] = { ...(current[projectId] ?? {}) };
        for (const k of keys) current[projectId][k] = chosen;
        await writeDurable(current);
        idbSnap = mergeAppDb(idbSnap, current);
        for (const k of keys) embedAppDataInProjectsBlob(projectId, k, chosen);
        set((s) => ({
          appDb: {
            ...s.appDb,
            [projectId]: {
              ...(s.appDb[projectId] ?? {}),
              ...Object.fromEntries(keys.map((k) => [k, chosen])),
            },
          },
        }));
        const expected = countItems(chosen);
        const proof = await verifyDurableBytes(projectId, collection, expected);
        publishDiag(projectId, collection, { save: 1, durable: proof.durable, rev: incoming.rev });
        get().recordActivity(projectId, {
          kind: "data",
          outcome: proof.ok ? "ok" : "err",
          label: `Dati · ${collection}`,
          detail: proof.ok ? "Scrittura durevole verificata" : "Scrittura non verificata",
          metrics: { rows: expected, durable: proof.durable },
          dedupe: `data:${collection}`,
        });
        return { ok: proof.ok, v: proof.ok ? chosen : null, durable: proof.durable };
      },
      createFromBrief: ({ prompt, kind }) => {
        const project = blankProject(prompt.trim(), kind ?? "app");
        set((s) => ({ projects: trimList([project, ...s.projects]) }));
        return project;
      },
      importArchive: ({ bytes, filename }) => {
        const archive = importProjectArchive(bytes);
        if (!archive.ok) throw new Error(archive.error);
        const stored = createImportedProject({
          files: archive.files,
          name: archive.manifest.name,
          kind: archive.manifest.kind,
          filename,
          source: "ZIP",
        });
        set((s) => ({ projects: trimList([stored, ...s.projects]) }));
        return stored;
      },
      importTree: (input) => {
        const stored = createImportedProject(input);
        set((s) => ({ projects: trimList([stored, ...s.projects]) }));
        return stored;
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
              files: projectFiles({ html: demo.html }),
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
        const stored = demo
          ? appendProjectActivity(
              commitIfChanged(project, { source: "create", label: "Esempio" }),
              {
                kind: "ready",
                outcome: "ok",
                label: "Esempio pronto",
                metrics: {
                  files: projectFiles({ html: project.html, files: project.files }).length,
                },
                at: now,
              },
            )
          : project;
        set((s) => ({ projects: trimList([stored, ...s.projects]) }));
        return stored;
      },
      updateProject: (id, patch) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p;
            const next: Project = { ...p, ...patch, updatedAt: Date.now() };
            if (next.status !== "ready" || !String(next.html || "").trim()) {
              return withStatusActivity(p, next);
            }
            const source = (p.revisions?.length ?? 0) > 0 ? "polish" : "build";
            const label = source === "polish" ? "Rifinitura" : p.demoId ? "Esempio" : "Pronto";
            return withStatusActivity(p, commitIfChanged(next, { source, label }));
          }),
        }));
      },
      restoreRevision: (id, revisionId) => {
        const current = get().getProject(id);
        if (!current) return false;
        const next = restoreProjectRevision(current, revisionId);
        if (!next) return false;
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? appendProjectActivity(
                  { ...next, updatedAt: Date.now() },
                  {
                    kind: "restore",
                    outcome: "ok",
                    label: "Versione ripristinata",
                    detail: next.revisions?.find((revision) => revision.id === revisionId)?.label,
                    metrics: { revisions: next.revisions?.length ?? 0 },
                  },
                )
              : p,
          ),
        }));
        return true;
      },
      branchRevision: (id, revisionId) => {
        const current = get().getProject(id);
        if (!current) return null;
        const branch = branchProjectRevision(current, revisionId);
        if (!branch) return null;
        const branchWithActivity = appendProjectActivity(branch, {
          kind: "branch",
          outcome: "ok",
          label: "Ramo indipendente creato",
          detail: `Da ${current.name} · ${revisionId.slice(0, 8)}`,
          metrics: { files: projectFiles({ html: branch.html, files: branch.files }).length },
        });
        set((s) => ({
          projects: trimList([
            branchWithActivity,
            ...s.projects.map((project) =>
              project.id === id
                ? appendProjectActivity(project, {
                    kind: "branch",
                    outcome: "ok",
                    label: "Ramo creato",
                    detail: branchWithActivity.name,
                  })
                : project,
            ),
          ]),
        }));
        return branchWithActivity;
      },
      mergeBranch: (branchId) => {
        const branch = get().getProject(branchId);
        if (!branch?.branchFrom) {
          return { ok: false, reason: "not-a-branch", conflicts: [] };
        }
        const source = get().getProject(branch.branchFrom.projectId);
        if (!source) {
          return { ok: false, reason: "wrong-source", conflicts: [] };
        }
        const result = mergeProjectBranch(source, branch);
        if (!result.ok) {
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === branchId
                ? appendProjectActivity(project, {
                    kind: "merge",
                    outcome: "err",
                    label: "Unione fermata",
                    detail: result.conflicts.map((item) => item.path).join(", ") || result.reason,
                    metrics: { conflicts: result.conflicts.length },
                  })
                : project,
            ),
          }));
          return result;
        }
        const mergedSource = appendProjectActivity(result.project, {
          kind: "merge",
          outcome: "ok",
          label: result.changed.length ? "Ramo unito" : "Ramo già allineato",
          detail: branch.name,
          metrics: {
            files: projectFiles({ html: result.project.html, files: result.project.files }).length,
            revisions: result.project.revisions?.length ?? 0,
          },
        });
        const mergedBranch = appendProjectActivity(branch, {
          kind: "merge",
          outcome: "ok",
          label: result.changed.length ? "Unito nel progetto origine" : "Già allineato",
          detail: source.name,
          metrics: { files: result.changed.length },
        });
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id === source.id) return mergedSource;
            if (project.id === branch.id) return mergedBranch;
            return project;
          }),
        }));
        return { ...result, project: mergedSource };
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
            p.id === id ? { ...p, messages: [...p.messages, full], updatedAt: Date.now() } : p,
          ),
        }));
      },
      removeProject: (id) => {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      },
    }),
    {
      name: "officina-projects",
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Pick<
          ProjectStore,
          "projects" | "creditsRemaining" | "appDb" | "recentPalettes"
        >;
        const recentPalettes = sanitizePaletteHistory(state.recentPalettes);

        // One-time upgrade to the 100-credit testing grant.
        // The persist version prevents the refill from repeating after the credits are used.
        if (version < 3) {
          return { ...state, creditsRemaining: CREDITS_GRANT, recentPalettes };
        }

        return { ...state, recentPalettes };
      },
      partialize: (s) => ({
        projects: s.projects,
        creditsRemaining: s.creditsRemaining,
        recentPalettes: sanitizePaletteHistory(s.recentPalettes),
      }),
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<ProjectStore>;
        const projects = (incoming.projects ?? current.projects).map((p) =>
          recoverPersistedProject(p),
        );
        return {
          ...current,
          ...incoming,
          projects,
          creditsRemaining:
            typeof incoming.creditsRemaining === "number"
              ? incoming.creditsRemaining
              : current.creditsRemaining,
          recentPalettes: sanitizePaletteHistory(incoming.recentPalettes ?? current.recentPalettes),
        };
      },
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
                  recovered.kind === "dashboard" &&
                  /argilla|ceram|viva/i.test(`${p.name} ${p.prompt}`)
                    ? {
                        bg: "#f3eadc",
                        surface: "#fbf6ee",
                        fg: "#2b211c",
                        muted: "#6e5648",
                        accent: "#b85c38",
                        line: "#d7c4b0",
                      }
                    : (recovered.palette ?? p.palette),
              };
            });
            if (typeof state.creditsRemaining !== "number") {
              state.creditsRemaining = CREDITS_GRANT;
            }
            const disk = readWebStorage();
            const merged: AppDb = mergeAppDb(idb, disk);
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

if (
  typeof window !== "undefined" &&
  !(window as Window & { __fenixDbBound?: boolean }).__fenixDbBound
) {
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
      const known =
        Boolean(store.getProject(msg.projectId!)) ||
        Object.prototype.hasOwnProperty.call(store.appDb, msg.projectId!);
      if (!known) return;
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

export function refundBuildCredit(projectId: string, n?: number) {
  const store = useProjectStore.getState();
  const project = store.getProject(projectId);
  if (!project || project.creditRefunded) return false;
  store.refundCredit(n);
  store.updateProject(projectId, { creditRefunded: true });
  store.recordActivity(projectId, {
    kind: "refund",
    outcome: "ok",
    label: "Credito rimborsato",
    metrics: { credits: Math.max(1, n ?? CREDIT_COST) },
  });
  return true;
}

/** Iframe boot TypeError/unhandledrejection. Demotes ready; never kills a live visual job. */
export function notePreviewBootError(projectId: string, message: string) {
  const msg = String(message || "").slice(0, 240);
  if (typeof document !== "undefined") {
    let prev: Record<string, unknown> = {};
    try {
      prev = JSON.parse(document.documentElement.getAttribute("data-fenix-diag") || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      prev = {};
    }
    document.documentElement.setAttribute(
      "data-fenix-diag",
      JSON.stringify({
        ...prev,
        pid: String(projectId).slice(0, 8),
        bootError: msg,
        epoch: Date.now(),
      }),
    );
  }
  const store = useProjectStore.getState();
  const project = store.getProject(projectId);
  if (!project) return;
  if (project.status === "ready") {
    store.updateProject(projectId, {
      status: "error",
      error: `Errore in avvio: ${msg}`,
    });
  }
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
  const html = repairLeakedCss(
    ensureMainElementId(
      rewriteFenixCollections(
        isPhoneKind(kind)
          ? rewriteIosWidgetHome(replaceAppleTabIcons(result.html))
          : shouldRepairDashboard(result.html, kind)
            ? polishDashboardHtml(result.html, kind)
            : kind === "site" || kind === "landing"
              ? stripPhoneChromeFromSite(result.html)
              : result.html,
      ),
    ),
  );
  const report = validatePublishable(html, {
    kind,
    projectId: id,
    bg: result.palette?.bg ?? existing?.palette.bg,
  });
  if (!report.syntaxOk) return report;
  const contractBlock = blocksPublish(html, kind, result.files, existing?.prompt);
  if (contractBlock) {
    report.ok = false;
    report.complete = false;
    report.errors = [...report.errors, contractBlock];
  }
  const nextStatus: BuildStatus =
    status === "ready" ? (report.complete ? "ready" : "building") : status;
  useProjectStore.getState().updateProject(id, {
    ...result,
    html,
    files: projectFiles({ html, files: result.files }),
    kind,
    requestedKind,
    status: nextStatus,
    error: undefined,
  });
  if (result.palette?.bg && result.palette?.accent) {
    useProjectStore.getState().rememberPalette({
      bg: result.palette.bg,
      surface: result.palette.surface || result.palette.bg,
      accent: result.palette.accent,
      family: familyFromBrief(existing?.prompt || ""),
      at: Date.now(),
    });
  }
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
  const contractBlock = blocksPublish(project.html, kind, project.files, project.prompt);
  if (contractBlock) {
    report.ok = false;
    report.complete = false;
    report.errors = [...report.errors, contractBlock];
  }
  if (!report.ok) return report;
  useProjectStore.getState().updateProject(id, { kind, status: "ready", error: undefined });
  return report;
}
