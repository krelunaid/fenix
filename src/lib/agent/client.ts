/**
 * Browser client for /api/agent/* (the Studio proxy). Sends the owner capability
 * header like the rest of Fenix; never sees AGENT_TOKEN.
 */
import { getOwnerCapability } from "../projects/publish-client.ts";
import { OWNER_HEADER } from "../projects/publish-owner.ts";

export type AgentCredits = { remaining: number; spent: number; refunded: number };
export type AgentEvent = { type: string; at: number; text?: string; name?: string; input?: string; ok?: boolean; output?: string; outcome?: string };
export type AgentCheck = { id: string; ok: boolean; detail: string };
export type AgentFile = { path: string; bytes: number; content?: string; binary?: boolean };
export type AgentJob = {
  id: string;
  status: "queued" | "running" | "ok" | "failed" | "cancelled";
  position?: number;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  events: AgentEvent[];
  error: string | null;
  result: null | {
    outcome: string;
    ok: boolean;
    summary: string;
    checks: { ok: boolean; checks: AgentCheck[]; failed: string[] } | null;
    stats: { steps: number; modelCalls: number; ms: number; costUsd: number };
    files: AgentFile[];
  };
  credits?: AgentCredits;
  refunded?: boolean;
};
export type AgentStatus = { configured: boolean; identity?: "session" | "capability" | null; email?: string; credits: AgentCredits | null; hint?: string };
export type PreviewInfo = { live: boolean; url?: string; expiresAt?: number; error?: string };

export const AGENT_JOBS_KEY = "fenix.agent.jobs";

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { [OWNER_HEADER]: getOwnerCapability(), "content-type": "application/json", ...extra };
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error || `Errore ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, body });
  }
  return body as T;
}

export function agentStatus(): Promise<AgentStatus> {
  return fetch("/api/agent/status", { headers: headers(), cache: "no-store" }).then((r) => parse<AgentStatus>(r));
}

export function startAgentBuild(input: { brief?: string; kind?: "app" | "site"; name?: string; files?: { path: string; content: string }[]; instruction?: string }) {
  return fetch("/api/agent/build", { method: "POST", headers: headers(), body: JSON.stringify(input) })
    .then((r) => parse<{ id: string; status: string; position?: number; credits: AgentCredits }>(r));
}

export function readAgentJob(id: string, full = false): Promise<AgentJob> {
  return fetch(`/api/agent/jobs/${encodeURIComponent(id)}${full ? "?full=1" : ""}`, { headers: headers(), cache: "no-store" }).then((r) => parse<AgentJob>(r));
}

export function cancelAgentJob(id: string) {
  return fetch(`/api/agent/jobs/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() }).then((r) => parse<{ id: string; cancelled: boolean; refunded: boolean; credits: AgentCredits }>(r));
}

export function startPreview(id: string): Promise<PreviewInfo> {
  return fetch(`/api/agent/jobs/${encodeURIComponent(id)}/preview`, { method: "POST", headers: headers() }).then((r) => parse<PreviewInfo>(r));
}

export function stopPreview(id: string) {
  return fetch(`/api/agent/jobs/${encodeURIComponent(id)}/preview`, { method: "DELETE", headers: headers() }).then((r) => parse<{ live: boolean }>(r));
}

/** Jobs remembered in this browser (id + label), newest first. */
export type RememberedJob = { id: string; brief: string; kind: "app" | "site"; at: number; parent?: string };

export function readRememberedJobs(): RememberedJob[] {
  try {
    const raw = localStorage.getItem(AGENT_JOBS_KEY);
    const list = raw ? (JSON.parse(raw) as RememberedJob[]) : [];
    return Array.isArray(list) ? list.filter((j) => j && typeof j.id === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function rememberJob(job: RememberedJob) {
  try {
    const next = [job, ...readRememberedJobs().filter((j) => j.id !== job.id)].slice(0, 30);
    localStorage.setItem(AGENT_JOBS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export function stageLabel(events: AgentEvent[]): string {
  const last = [...events].reverse().find((e) => e.type === "tool" || e.type === "assistant" || e.type === "log");
  if (!last) return "In attesa dell'agente…";
  if (last.type === "tool") {
    const names: Record<string, string> = {
      write_file: "Scrivo",
      edit_file: "Modifico",
      read_file: "Leggo",
      list_files: "Guardo i file",
      run: "Eseguo",
      start_server: "Avvio il server",
      http: "Provo l'API",
      server_logs: "Leggo i log",
      run_checks: "Controllo tutto",
      finish: "Chiudo",
    };
    return `${names[last.name || ""] || last.name} ${last.input || ""}`.trim();
  }
  return (last.text || "").split("\n")[0].slice(0, 120);
}

export type PublishedApp = { slug: string; name: string; kind: "app" | "site"; version: number; publishedAt: number; updatedAt: number; files: number; jobId: string | null; hosting?: { live: boolean } };

export function publicAppUrl(slug: string): string {
  return `${typeof location !== "undefined" ? location.origin : ""}/app/${slug}/`;
}

export function listPublishedApps(): Promise<{ sites: PublishedApp[] }> {
  return fetch("/api/agent/sites", { headers: headers(), cache: "no-store" }).then((r) => parse<{ sites: PublishedApp[] }>(r));
}

export function publishApp(input: { jobId: string; slug?: string; name?: string }): Promise<PublishedApp> {
  return fetch("/api/agent/sites", { method: "POST", headers: headers(), body: JSON.stringify(input) }).then((r) => parse<PublishedApp>(r));
}

export function unpublishApp(slug: string) {
  return fetch(`/api/agent/sites/${encodeURIComponent(slug)}`, { method: "DELETE", headers: headers() }).then((r) => parse<{ slug: string; removed: boolean }>(r));
}
