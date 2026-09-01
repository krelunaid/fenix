import { mergeAppDb, readAllDurable, writeDurable, type AppDb } from "./durable-db.ts";

type FenixDbMsg = {
  t?: string;
  id?: string;
  op?: string;
  projectId?: string;
  col?: string;
  data?: unknown;
};

type CloudReply =
  | { state: "ok"; data: unknown; rev: number; mode?: "cloud-shared"; role?: "viewer" | "editor" }
  | {
      state: "conflict";
      current: { data: unknown; rev: number };
      mode?: "cloud-shared";
      role?: "viewer" | "editor";
    }
  | { state: "unavailable" }
  | { state: "error"; mode?: "cloud-shared"; role?: "viewer" | "editor" };

export type SiteDbCloudClient = {
  fetch?: typeof fetch;
  timeoutMs?: number;
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

function isCloudValue(value: unknown): value is { data: unknown; rev: number } {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return Number.isSafeInteger(rec.rev) && Number(rec.rev) >= 0 && "data" in rec;
}

function sharedMeta(value: unknown): { mode: "cloud-shared"; role?: "viewer" | "editor" } | {} {
  if (!value || typeof value !== "object") return {};
  const rec = value as Record<string, unknown>;
  if (rec.mode !== "cloud-shared" || rec.shared !== true) return {};
  return {
    mode: "cloud-shared",
    ...(rec.role === "viewer" || rec.role === "editor" ? { role: rec.role } : {}),
  };
}

async function postCloudData(
  fetcher: typeof fetch,
  projectId: string,
  body: unknown,
  timeoutMs: number,
): Promise<{ status: number; body: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher(`/api/app-data/${encodeURIComponent(projectId)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // An invalid server response must not be mistaken for a local-only outage.
    }
    return { status: res.status, body: parsed };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Private or capability-shared cloud transport for a published app. Only a
 *  genuine outage or the explicit 503 "not configured" state can fall back
 *  to the local durable bridge; validation/auth/conflict errors stay fail-closed. */
export async function dispatchPublishedSiteCloudDb(
  msg: FenixDbMsg,
  projectId: string,
  knownRev: number | undefined,
  client: SiteDbCloudClient = {},
): Promise<CloudReply> {
  if (!msg.col || (msg.op !== "load" && msg.op !== "save")) return { state: "error" };
  const fetcher = client.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") return { state: "unavailable" };
  const timeoutMs = Math.max(250, Math.min(2_000, client.timeoutMs ?? 1_800));
  let rev = knownRev;
  if (msg.op === "save" && rev == null) {
    const first = await postCloudData(fetcher, projectId, { op: "load", col: msg.col }, timeoutMs);
    if (!first || first.status === 503) return { state: "unavailable" };
    if (first.status !== 200 || !isCloudValue(first.body)) return { state: "error" };
    rev = first.body.rev;
  }
  const result = await postCloudData(
    fetcher,
    projectId,
    msg.op === "load"
      ? { op: "load", col: msg.col }
      : { op: "save", col: msg.col, rev, data: msg.data },
    timeoutMs,
  );
  if (!result || result.status === 503) return { state: "unavailable" };
  if (result.status === 409) {
    const body = result.body as { current?: unknown } | null;
    return body && isCloudValue(body.current)
      ? { state: "conflict", current: body.current, ...sharedMeta(result.body) }
      : { state: "error" };
  }
  return result.status === 200 && isCloudValue(result.body)
    ? {
        state: "ok",
        data: result.body.data,
        rev: result.body.rev,
        ...sharedMeta(result.body),
      }
    : { state: "error", ...sharedMeta(result.body) };
}

export function expectedSiteFrameWindow(
  iframeRef: { current: HTMLIFrameElement | null } | null,
): Window | null {
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
      replied: {
        payload: { t: "fenix-db", id: msg.id, v: cols[col] ?? null },
        origin,
        source: event.source,
      },
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
  cloudClient: SiteDbCloudClient = {},
): () => void {
  if (typeof window === "undefined" || !projectId || !iframeRef) return () => {};
  const revisions = new Map<string, number>();
  const inflight = new Set<string>();
  const onMessage = (event: MessageEvent) => {
    const expected = expectedSiteFrameWindow(iframeRef);
    if (!expected || !event.source || event.source !== expected) return;
    const msg = parseSiteDbRequest(event.data, projectId);
    if (!msg?.id || !msg.col) return;
    const requestId = msg.id;
    const collection = msg.col;
    if (inflight.has(requestId)) return;
    inflight.add(requestId);
    const target = event.source as Window;
    const origin = siteDbReplyOrigin(String(event.origin || ""));
    void (async () => {
      const cloud = await dispatchPublishedSiteCloudDb(
        msg,
        projectId,
        revisions.get(collection),
        cloudClient,
      );
      if (cloud.state === "ok") {
        revisions.set(collection, cloud.rev);
        target.postMessage(
          {
            t: "fenix-db",
            id: requestId,
            mode: cloud.mode ?? "cloud-private",
            ...(cloud.role ? { role: cloud.role } : {}),
            v:
              msg.op === "load"
                ? cloud.data
                : {
                    ok: true,
                    v: cloud.data,
                    durable: Array.isArray(cloud.data) ? cloud.data.length : 1,
                    cloud: 1,
                    rev: cloud.rev,
                  },
          },
          origin,
        );
        return;
      }
      if (cloud.state === "conflict") {
        revisions.set(collection, cloud.current.rev);
        target.postMessage(
          {
            t: "fenix-db",
            id: requestId,
            mode: cloud.mode ?? "cloud-private",
            ...(cloud.role ? { role: cloud.role } : {}),
            v: { ok: false, conflict: true, current: cloud.current },
          },
          origin,
        );
        return;
      }
      if (cloud.state === "error") {
        target.postMessage(
          {
            t: "fenix-db",
            id: requestId,
            mode: cloud.mode ?? "cloud-private",
            ...(cloud.role ? { role: cloud.role } : {}),
            v: { ok: false, durable: 0 },
          },
          origin,
        );
        return;
      }
      const db = await readAllDurable();
      const result = dispatchPublishedSiteDb(event, projectId, expected, db);
      if (!result.replied) return;
      if (result.db !== db) await writeDurable(result.db);
      target.postMessage(
        { ...(result.replied.payload as object), mode: "local-first" },
        result.replied.origin,
      );
    })()
      .catch(() => {
        target.postMessage(
          { t: "fenix-db", id: requestId, mode: "local-first", v: { ok: false, durable: 0 } },
          origin,
        );
      })
      .finally(() => inflight.delete(requestId));
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
