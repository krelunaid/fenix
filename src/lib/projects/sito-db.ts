import { mergeAppDb, readAllDurable, writeDurable, type AppDb } from "./durable-db.ts";

type FenixDbMsg = {
  t?: string;
  id?: string;
  op?: string;
  projectId?: string;
  col?: string;
  data?: unknown;
};

/** Parent bridge for /sito. Opaque iframe talks fenix-db; persist on this origin. No project store. */
export function bindPublishedSiteDb(projectId: string): () => void {
  if (typeof window === "undefined" || !projectId) return () => {};
  const onMessage = (event: MessageEvent) => {
    const msg = event.data as FenixDbMsg;
    if (!msg || msg.t !== "fenix-db" || !msg.id || !msg.col || !msg.projectId) return;
    if (msg.projectId !== projectId) return;
    const pid = msg.projectId;
    const col = msg.col;
    const reqId = msg.id;
    const source = event.source as Window | null;
    const reply = (value: unknown) => {
      source?.postMessage({ t: "fenix-db", id: reqId, v: value }, "*");
    };
    void (async () => {
      const db = await readAllDurable();
      const cols = db[pid] ?? {};
      if (msg.op === "load") {
        reply(cols[col] ?? null);
        return;
      }
      if (msg.op === "save") {
        const next: AppDb = mergeAppDb(db, {
          [pid]: { ...cols, [col]: msg.data },
        });
        await writeDurable(next);
        reply(msg.data);
      }
    })();
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
