export const APP_DB_KEY = "officina-appdb";
export const PROJECTS_KEY = "officina-projects";
const IDB_NAME = "officina-durable";
const IDB_STORE = "kv";

export type AppDb = Record<string, Record<string, unknown>>;

export function isEmptyVal(v: unknown): boolean {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function isBox(v: unknown): v is { _fenix: 1; rev: number; items: unknown[]; writer?: string; at?: number } {
  return Boolean(v && typeof v === "object" && (v as { _fenix?: number })._fenix === 1);
}

export function asBox(v: unknown): { rev: number; items: unknown[]; writer: string; at: number } | null {
  if (isBox(v)) {
    const items = Array.isArray(v.items) ? v.items : [];
    return { rev: Number(v.rev) || 0, items, writer: String(v.writer || ""), at: Number(v.at) || 0 };
  }
  if (Array.isArray(v)) return { rev: 0, items: v, writer: "", at: 0 };
  if (v && typeof v === "object") {
    const o = v as { items?: unknown; rows?: unknown };
    const items = Array.isArray(o.items) ? o.items : Array.isArray(o.rows) ? o.rows : null;
    if (items) {
      const rev = Number((v as { rev?: number }).rev) || 0;
      return { rev, items, writer: String((v as { writer?: string }).writer || ""), at: 0 };
    }
  }
  return null;
}

export function unwrapItems(v: unknown): unknown {
  const box = asBox(v);
  return box ? box.items : v;
}

export function countItems(v: unknown): number {
  const box = asBox(v);
  if (box) return box.items.length;
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") {
    const o = v as { items?: unknown; rows?: unknown };
    if (Array.isArray(o.items)) return o.items.length;
    if (Array.isArray(o.rows)) return o.rows.length;
  }
  return 0;
}

function revOf(v: unknown): number {
  return asBox(v)?.rev ?? 0;
}

export function pickNewer(a: unknown, b: unknown): unknown {
  const ra = revOf(a);
  const rb = revOf(b);
  if (rb !== ra) return rb > ra ? b : a;
  return countItems(b) >= countItems(a) ? b ?? a : a ?? b;
}

export function mergeAppDb(a: AppDb, b: AppDb): AppDb {
  const out: AppDb = { ...a };
  for (const pid of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ac = a[pid] ?? {};
    const bc = b[pid] ?? {};
    const cols = new Set([...Object.keys(ac), ...Object.keys(bc)]);
    out[pid] = {};
    for (const col of cols) {
      const av = ac[col];
      const bv = bc[col];
      out[pid][col] = pickNewer(av, bv);
    }
  }
  return out;
}

function parseAppDb(raw: string | null): AppDb {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AppDb;
  } catch {
    return {};
  }
}

export function countInRaw(raw: string | null, projectId: string, collection: string): number {
  return countItems(parseAppDb(raw)[projectId]?.[collection]);
}

export function readWebStorage(): AppDb {
  const local = typeof localStorage !== "undefined" ? parseAppDb(localStorage.getItem(APP_DB_KEY)) : {};
  const session = typeof sessionStorage !== "undefined" ? parseAppDb(sessionStorage.getItem(APP_DB_KEY)) : {};
  return mergeAppDb(local, session);
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readIndexedDb(): Promise<AppDb> {
  const db = await openIdb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const g = tx.objectStore(IDB_STORE).get(APP_DB_KEY);
      g.onsuccess = () => resolve((g.result as AppDb) || {});
      g.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

export async function writeIndexedDb(data: AppDb): Promise<boolean> {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(data, APP_DB_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export function writeWebStorage(data: AppDb): { local: boolean; session: boolean } {
  const json = JSON.stringify(data);
  let local = false;
  let session = false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(APP_DB_KEY, json);
      local = localStorage.getItem(APP_DB_KEY) === json;
    }
  } catch {
    local = false;
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(APP_DB_KEY, json);
      session = sessionStorage.getItem(APP_DB_KEY) === json;
    }
  } catch {
    session = false;
  }
  return { local, session };
}

export async function writeDurable(data: AppDb): Promise<void> {
  writeWebStorage(data);
  await writeIndexedDb(data);
}

export async function readAllDurable(): Promise<AppDb> {
  const idb = await readIndexedDb();
  return mergeAppDb(idb, readWebStorage());
}

function countProjectsAppData(projectId: string, collection: string): number {
  if (typeof localStorage === "undefined") return 0;
  for (const store of [localStorage, typeof sessionStorage !== "undefined" ? sessionStorage : null]) {
    if (!store) continue;
    try {
      const raw = store.getItem(PROJECTS_KEY);
      if (!raw) continue;
      const blob = JSON.parse(raw) as {
        state?: { projects?: { id: string; appData?: Record<string, unknown> }[] };
      };
      const p = blob.state?.projects?.find((x) => x.id === projectId);
      const n = countItems(p?.appData?.[collection]);
      if (n) return n;
    } catch {
      /* ignore */
    }
  }
  return 0;
}

export function embedAppDataInProjectsBlob(
  projectId: string,
  collection: string,
  data: unknown,
): boolean {
  const stores: Storage[] = [];
  if (typeof localStorage !== "undefined") stores.push(localStorage);
  if (typeof sessionStorage !== "undefined") stores.push(sessionStorage);
  let ok = false;
  for (const store of stores) {
    try {
      const raw = store.getItem(PROJECTS_KEY);
      if (!raw) continue;
      const blob = JSON.parse(raw) as {
        state?: { projects?: { id: string; appData?: Record<string, unknown> }[] };
      };
      const p = blob.state?.projects?.find((x) => x.id === projectId);
      if (!p) continue;
      p.appData = { ...(p.appData ?? {}), [collection]: data };
      const next = JSON.stringify(blob);
      store.setItem(PROJECTS_KEY, next);
      const again = JSON.parse(store.getItem(PROJECTS_KEY) || "{}") as typeof blob;
      const q = again.state?.projects?.find((x) => x.id === projectId);
      if (countItems(q?.appData?.[collection]) >= countItems(data)) ok = true;
    } catch {
      /* quota */
    }
  }
  return ok;
}

export type DurableProof = {
  ok: boolean;
  durable: number;
  local: number;
  session: number;
  idb: number;
  projects: number;
};

export async function verifyDurableBytes(
  projectId: string,
  collection: string,
  expected: number,
): Promise<DurableProof> {
  const local =
    typeof localStorage !== "undefined" ? countInRaw(localStorage.getItem(APP_DB_KEY), projectId, collection) : 0;
  const session =
    typeof sessionStorage !== "undefined"
      ? countInRaw(sessionStorage.getItem(APP_DB_KEY), projectId, collection)
      : 0;
  const idb = countItems((await readIndexedDb())[projectId]?.[collection]);
  const projects = countProjectsAppData(projectId, collection);
  const durable = Math.max(local, session, idb, projects);
  return {
    ok: expected <= 0 ? durable >= 0 : durable >= expected,
    durable,
    local,
    session,
    idb,
    projects,
  };
}
