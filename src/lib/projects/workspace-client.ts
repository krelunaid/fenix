import { OWNER_HEADER } from "./publish-owner";
import { getOwnerCapability } from "./publish-client";
import type { ProjectFile } from "./files";

export type WorkspaceRole = "owner" | "viewer" | "editor";
export type MemberRole = "viewer" | "editor";

export type PublicMember = {
  id: string;
  role: WorkspaceRole;
  label: string;
  you?: boolean;
};

export type PublicInvite = {
  id: string;
  role: MemberRole;
  label: string;
  createdAt: number;
  expiresAt: number;
};

export type PublicPresence = {
  memberId: string;
  role: WorkspaceRole;
  sessions: number;
  lastSeen: number;
};

export type PublicAudit = {
  id: string;
  at: number;
  actor: string;
  kind: string;
  detail: string;
};

export type WorkspaceSnapshot = {
  id: string;
  name: string;
  role: WorkspaceRole;
  canWrite: boolean;
  casVersion: number;
  casHash: string;
  files: ProjectFile[];
  members?: PublicMember[];
  invites?: PublicInvite[];
  presence?: PublicPresence[];
  audit?: PublicAudit[];
  joined?: boolean;
};

function ownerHeaders(extra: HeadersInit = {}): HeadersInit {
  return { [OWNER_HEADER]: getOwnerCapability(), ...extra };
}

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || fallback);
  return body;
}

export function workspaceJoinSessionId(): string {
  const key = "fenix.workspace-session";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^s[a-f0-9]{16,32}$/.test(existing)) return existing;
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const id = `s${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `s${Date.now().toString(16).padStart(16, "0")}`;
  }
}

export async function createProjectWorkspace(input: {
  projectId: string;
  name: string;
  files: ProjectFile[];
}): Promise<WorkspaceSnapshot> {
  const res = await fetch("/api/workspace", {
    method: "POST",
    cache: "no-store",
    headers: ownerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parse<WorkspaceSnapshot>(res, "Workspace non creato.");
}

export async function loadProjectWorkspace(id: string): Promise<WorkspaceSnapshot> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: ownerHeaders(),
  });
  return parse<WorkspaceSnapshot>(res, "Workspace non disponibile.");
}

export async function inviteWorkspaceMember(
  id: string,
  role: MemberRole,
): Promise<{ invite: PublicInvite; url: string }> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    method: "POST",
    cache: "no-store",
    headers: ownerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      op: "invite",
      role,
      label: role === "editor" ? "Può modificare" : "Sola lettura",
    }),
  });
  const created = await parse<{ invite: PublicInvite; token: string }>(res, "Invito non creato.");
  return {
    invite: created.invite,
    url: `${window.location.origin}/condiviso/${encodeURIComponent(id)}#fenix-join=${created.token}`,
  };
}

export async function revokeWorkspaceMember(id: string, memberId: string): Promise<void> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    method: "POST",
    cache: "no-store",
    headers: ownerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ op: "revoke", memberId }),
  });
  await parse<{ ok: true }>(res, "Revoca non riuscita.");
}

export async function setWorkspaceMemberRole(
  id: string,
  memberId: string,
  role: MemberRole,
): Promise<void> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    method: "POST",
    cache: "no-store",
    headers: ownerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ op: "role", memberId, role }),
  });
  await parse<{ ok: true }>(res, "Ruolo non aggiornato.");
}

export async function joinProjectWorkspace(id: string, token: string): Promise<WorkspaceSnapshot> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    method: "POST",
    cache: "no-store",
    headers: ownerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ op: "join", token }),
  });
  return parse<WorkspaceSnapshot>(res, "Invito non valido.");
}

export async function beatWorkspacePresence(id: string): Promise<PublicPresence[]> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    method: "POST",
    cache: "no-store",
    headers: ownerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ op: "presence", sessionId: workspaceJoinSessionId() }),
  });
  return (await parse<{ presence: PublicPresence[] }>(res, "Presenza non aggiornata.")).presence;
}

export async function writeWorkspaceFile(
  id: string,
  path: string,
  content: string,
  casVersion: number,
): Promise<WorkspaceSnapshot> {
  const res = await fetch(`/api/workspace/${encodeURIComponent(id)}`, {
    method: "PUT",
    cache: "no-store",
    headers: ownerHeaders({
      "Content-Type": "application/json",
      "If-Match": `"${casVersion}"`,
    }),
    body: JSON.stringify({ path, content }),
  });
  return parse<WorkspaceSnapshot>(res, "File non salvato.");
}

/** Consume a join fragment once and scrub it before any later fetch. */
export async function joinWorkspaceFromFragment(id: string): Promise<WorkspaceSnapshot | null> {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("fenix-join") || "";
  if (!token) return null;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return joinProjectWorkspace(id, token);
}
