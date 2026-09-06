import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { recoverPersistedProject, STALE_BUILD_MS } from "./recover.ts";
import type { Project } from "./types.ts";
import { PROJECTS_KEY, readDurableValue, writeDurableValue } from "./durable-db.ts";

export const MAX_PROJECTS = 48;
export const LIVE_STUDIOS_KEY = "officina-live-studios";
const PROJECTS_IDB_KEY = PROJECTS_KEY;
const LIVE_STUDIO_CAP = 8;

export type PersistableProject = Project;

type PersistBag = {
  state?: {
    projects?: PersistableProject[];
    creditsRemaining?: number;
    recentPalettes?: unknown;
  };
  version?: number;
};

function hasSeed(p: { html?: string; lastStableHtml?: string } | undefined) {
  return Boolean(String(p?.html || "").trim() || String(p?.lastStableHtml || "").trim());
}

function isLiveBuilding(p: PersistableProject, now: number) {
  if (p.status !== "building") return false;
  return now - (p.updatedAt || 0) <= STALE_BUILD_MS;
}

export function trimProjectList(projects: PersistableProject[], now = Date.now()) {
  const sorted = [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const kept = sorted.slice(0, MAX_PROJECTS);
  const ids = new Set(kept.map((p) => p.id));
  for (const p of sorted.slice(MAX_PROJECTS)) {
    if (ids.has(p.id)) continue;
    if (hasSeed(p) && isLiveBuilding(p, now)) {
      kept.push(p);
      ids.add(p.id);
    }
  }
  return kept;
}

/** Prefer the copy that still has a seed; otherwise the newer updatedAt. Never invent HTML. */
export function pickProjectRevision(
  persisted: PersistableProject | undefined,
  current: PersistableProject,
  now = Date.now(),
): PersistableProject {
  const incoming = recoverPersistedProject(current, now);
  if (!persisted) return incoming;
  const existing = recoverPersistedProject(persisted, now);
  const incomingSeed = hasSeed(incoming);
  const existingSeed = hasSeed(existing);
  if (incomingSeed && !existingSeed) return incoming;
  if (existingSeed && !incomingSeed) return existing;
  if ((incoming.updatedAt || 0) !== (existing.updatedAt || 0)) {
    return (incoming.updatedAt || 0) > (existing.updatedAt || 0) ? incoming : existing;
  }
  const incomingFiles = incoming.files?.length ?? 0;
  const existingFiles = existing.files?.length ?? 0;
  if (incomingFiles !== existingFiles) return incomingFiles > existingFiles ? incoming : existing;
  return incoming;
}

/**
 * Union persist + in-memory lists by id. A just-created seeded studio must
 * survive a stale/empty persist snapshot (quota miss, late rehydrate, auth remount).
 */
export function mergeProjectLists(
  persisted: PersistableProject[] | undefined,
  current: PersistableProject[] | undefined,
  now = Date.now(),
): PersistableProject[] {
  const byId = new Map<string, PersistableProject>();
  for (const p of persisted ?? []) {
    if (!p?.id) continue;
    byId.set(p.id, recoverPersistedProject(p, now));
  }
  for (const p of current ?? []) {
    if (!p?.id) continue;
    byId.set(p.id, pickProjectRevision(byId.get(p.id), p, now));
  }
  return trimProjectList([...byId.values()], now);
}

/** Home + Vetrina share this list. Building seeded studios stay visible. */
export function homeVetrinaList<T extends { updatedAt: number }>(
  projects: T[],
  hydrated: boolean,
): T[] {
  if (!hydrated) return [];
  return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
}

function safeGet(store: Storage | undefined, key: string): string | null {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: string): boolean {
  if (!store) return false;
  try {
    store.setItem(key, value);
    return store.getItem(key) === value;
  } catch {
    return false;
  }
}

function safeRemove(store: Storage | undefined, key: string) {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* quota / denied */
  }
}

function webLocal(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function webSession(): Storage | undefined {
  return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
}

function parseBag(raw: string | null | undefined): PersistBag | null {
  if (!raw) return null;
  try {
    const bag = JSON.parse(raw) as PersistBag;
    return bag && typeof bag === "object" ? bag : null;
  } catch {
    return null;
  }
}

export function projectsFromPersistJson(raw: string | null | undefined): PersistableProject[] {
  return parseBag(raw)?.state?.projects ?? [];
}

export function mergePersistJson(...raws: Array<string | null | undefined>): string | null {
  const bags = raws.map(parseBag).filter((b): b is PersistBag => Boolean(b));
  if (!bags.length) return null;
  let projects: PersistableProject[] = [];
  let creditsRemaining: number | undefined;
  let recentPalettes: unknown;
  let version = 3;
  for (const bag of bags) {
    // First source wins on equal updatedAt (local before session/live).
    projects = mergeProjectLists(bag.state?.projects, projects);
    if (typeof bag.state?.creditsRemaining === "number" && creditsRemaining == null) {
      creditsRemaining = bag.state.creditsRemaining;
    }
    if (bag.state?.recentPalettes && recentPalettes == null) {
      recentPalettes = bag.state.recentPalettes;
    }
    if (typeof bag.version === "number") version = bag.version;
  }
  return JSON.stringify({
    state: { projects, creditsRemaining, recentPalettes },
    version,
  });
}

function compactProject(p: PersistableProject, keepSeed: boolean): PersistableProject {
  if (keepSeed) return p;
  const { revisions: _revisions, activity: _activity, lastStableFiles: _filesSnap, ...rest } = p;
  return {
    ...rest,
    files: rest.html ? [{ path: "index.html", content: rest.html }] : rest.files,
  };
}

export function compactPersistJson(raw: string): string {
  const bag = parseBag(raw);
  if (!bag?.state?.projects) return raw;
  const now = Date.now();
  const ranked = [...bag.state.projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const compact = ranked.map((p, i) => {
    const live = hasSeed(p) && isLiveBuilding(p, now);
    return compactProject(p, live || i < 8);
  });
  return JSON.stringify({
    ...bag,
    state: { ...bag.state, projects: compact },
  });
}

function liveFields(p: PersistableProject): PersistableProject {
  return {
    ...p,
    revisions: undefined,
    activity: undefined,
    messages: (p.messages ?? []).slice(-4),
    buildLog: (p.buildLog ?? []).slice(-12),
  };
}

export function rememberLiveStudio(project: PersistableProject | undefined) {
  if (!project?.id) return;
  const session = webSession();
  if (!session) return;
  try {
    const bag = parseBag(safeGet(session, LIVE_STUDIOS_KEY)) ?? { state: { projects: [] } };
    const prev = bag.state?.projects ?? [];
    const next = [liveFields(project), ...prev.filter((p) => p.id !== project.id)].slice(
      0,
      LIVE_STUDIO_CAP,
    );
    safeSet(session, LIVE_STUDIOS_KEY, JSON.stringify({ state: { projects: next }, version: 3 }));
  } catch {
    /* session full */
  }
}

export function rememberLiveStudiosFromPersistJson(raw: string) {
  const bag = parseBag(raw);
  const building = (bag?.state?.projects ?? []).filter(
    (p) => p.status === "building" || hasSeed(p),
  );
  for (const p of building.slice(0, LIVE_STUDIO_CAP)) rememberLiveStudio(p);
}

export function readLiveStudios(): PersistableProject[] {
  const bag = parseBag(safeGet(webSession(), LIVE_STUDIOS_KEY));
  return bag?.state?.projects ?? [];
}

export function rescueLiveStudio(id: string, now = Date.now()): PersistableProject | undefined {
  const found = readLiveStudios().find((p) => p.id === id);
  if (!found) return undefined;
  return recoverPersistedProject(found, now);
}

export async function readProjectsIdb(): Promise<string | null> {
  const value = await readDurableValue<string>(PROJECTS_IDB_KEY);
  return typeof value === "string" && value ? value : null;
}

export async function writeProjectsIdb(raw: string): Promise<boolean> {
  if (!raw) return writeDurableValue(PROJECTS_IDB_KEY, "");
  return writeDurableValue(PROJECTS_IDB_KEY, raw);
}

function projectStateStorage(): StateStorage {
  return {
    getItem: (name) => {
      const local = safeGet(webLocal(), name);
      const session = safeGet(webSession(), name);
      const live = safeGet(webSession(), LIVE_STUDIOS_KEY);
      return mergePersistJson(local, session, live);
    },
    setItem: (name, value) => {
      rememberLiveStudiosFromPersistJson(value);
      const localOk = safeSet(webLocal(), name, value);
      safeSet(webSession(), name, value);
      void writeProjectsIdb(value);
      if (!localOk) {
        const compact = compactPersistJson(value);
        safeSet(webLocal(), name, compact);
        safeSet(webSession(), name, compact);
        void writeProjectsIdb(compact);
      }
    },
    removeItem: (name) => {
      safeRemove(webLocal(), name);
      safeRemove(webSession(), name);
      safeRemove(webSession(), LIVE_STUDIOS_KEY);
      void writeProjectsIdb("");
    },
  };
}

export const projectPersistStorage = createJSONStorage(() => projectStateStorage());
