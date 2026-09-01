import { mergeAppDb, readAllDurable, writeDurable, type AppDb } from "./durable-db.ts";

type FenixDbMsg = {
  t?: string;
  id?: string;
  op?: string;
  projectId?: string;
  col?: string;
  data?: unknown;
};

const TOKEN_RE = /^[A-Za-z0-9._-]{1,80}$/;

export type SiteDbDispatch = {
  db: AppDb;
  replied: { payload: unknown; origin: string; source: MessageEventSource } | null;
};

export function isAllowedSiteDbToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/** Opaque srcdoc origin is the string "null"; a real URL targetOrigin would
 *  drop the reply. "*" is allowed only then. Isolation is event.source ===
 *  iframe.contentWindow, not the origin string. */
export function siteDbReplyOrigin(origin: string): string {
  if (/^https?:\/\//i.test(origin)) return origin;
  return "*";
}

export function parseSiteDbRequest(data: unknown, projectId: string): FenixDbMsg | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as FenixDbMsg;
  if (msg.t !== "fenix-db") return null;
  if (msg.op !== "load" && msg.op !== "save") return null;
  if (msg.projectId !== projectId) return null;
  if (!isAllowedSiteDbToken(msg.id) || !isAllowedSiteDbToken(msg.col)) return null;
  return msg;
}

export function expectedSiteFrameWindow(iframeRef: { current: HTMLIFrameElement | null } | null): Window | null {
  return iframeRef?.current?.contentWindow ?? null;
}

/** Parent bridge for /sito. Opaque iframe talks fenix-db; persist on this origin. No project store. */
export function dispatchPublishedSiteDb(
  event: Pick<MessageEvent, "data" | "source" | "origin">,
  projectId: string,
  expectedSource: Window | null,
  db: AppDb,
): SiteDbDispatch {
  if (!expectedSource || !event.source || event.source !== expectedSource) {
    return { db, replied: null };
  }
  const msg = parseSiteDbRequest(event.data, projectId);
  if (!msg || !msg.id || !msg.col || !msg.projectId) return { db, replied: null };
  const origin = siteDbReplyOrigin(String(event.origin || ""));
  const pid = msg.projectId;
  const col = msg.col;
  const cols = db[pid] ?? {};
  if (msg.op === "load") {
    return {
      db,
      replied: { payload: { t: "fenix-db", id: msg.id, v: cols[col] ?? null }, origin, source: event.source },
    };
  }
  const next: AppDb = mergeAppDb(db, {
    [pid]: { ...cols, [col]: msg.data },
  });
  return {
    db: next,
    replied: { payload: { t: "fenix-db", id: msg.id, v: msg.data }, origin, source: event.source },
  };
}

export function bindPublishedSiteDb(
  projectId: string,
  iframeRef: { current: HTMLIFrameElement | null },
): () => void {
  if (typeof window === "undefined" || !projectId || !iframeRef) return () => {};
  const onMessage = (event: MessageEvent) => {
    const expected = expectedSiteFrameWindow(iframeRef);
    void (async () => {
      const db = await readAllDurable();
      const result = dispatchPublishedSiteDb(event, projectId, expected, db);
      if (!result.replied) return;
      if (result.db !== db) await writeDurable(result.db);
      const target = event.source as Window;
      target.postMessage(result.replied.payload, result.replied.origin);
    })();
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
