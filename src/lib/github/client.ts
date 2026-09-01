import { OWNER_HEADER } from "../projects/publish-owner.ts";
import { getOwnerCapability } from "../projects/publish-client.ts";
import type { ProjectFile } from "../projects/files.ts";
import type { GitHubRepo, GitHubStatus, PublicExportJob } from "./types.ts";

export type { GitHubRepo, GitHubStatus, PublicExportJob } from "./types.ts";

async function asJson<T>(res: Response, fallback: string): Promise<T> {
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error || fallback);
  return payload;
}

function ownerHeaders(): HeadersInit {
  return { [OWNER_HEADER]: getOwnerCapability() };
}

export async function loadGitHubStatus(): Promise<GitHubStatus> {
  const res = await fetch("/api/github", { cache: "no-store", headers: ownerHeaders() });
  return asJson<GitHubStatus>(res, "Stato GitHub non disponibile.");
}

export async function startGitHubConnect(returnTo: string): Promise<{ url: string }> {
  const res = await fetch("/api/github", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify({ returnTo }),
  });
  return asJson<{ url: string }>(res, "GitHub non configurato.");
}

export async function disconnectGitHub(): Promise<GitHubStatus> {
  const res = await fetch("/api/github", {
    method: "DELETE",
    cache: "no-store",
    headers: ownerHeaders(),
  });
  return asJson<GitHubStatus>(res, "Non riesco a scollegare GitHub.");
}

export async function loadGitHubRepos(): Promise<GitHubRepo[]> {
  const res = await fetch("/api/github/repos", { cache: "no-store", headers: ownerHeaders() });
  const payload = await asJson<{ repos: GitHubRepo[] }>(res, "Repository non disponibili.");
  return payload.repos || [];
}

export async function previewGitHubExport(input: {
  repo: string;
  branch: string;
  name: string;
  kind?: string;
  html?: string;
  files?: ProjectFile[];
}): Promise<PublicExportJob> {
  const res = await fetch("/api/github/export", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify({ ...input, preview: true }),
  });
  return asJson<PublicExportJob>(res, "Anteprima rifiutata.");
}

export async function runGitHubExport(input: {
  repo: string;
  branch: string;
  name: string;
  kind?: string;
  html?: string;
  files?: ProjectFile[];
}): Promise<PublicExportJob> {
  const res = await fetch("/api/github/export", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify(input),
  });
  return asJson<PublicExportJob>(res, "Export rifiutato.");
}
