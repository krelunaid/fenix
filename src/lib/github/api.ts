/**
 * GitHub REST + Git Data API. Installation tokens live only in the call stack.
 * Official:
 * - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
 * - https://docs.github.com/en/rest/git/blobs
 * - https://docs.github.com/en/rest/git/trees
 * - https://docs.github.com/en/rest/git/commits
 * - https://docs.github.com/en/rest/git/refs  (PATCH force default false)
 */
import { GITHUB_API, GITHUB_API_VERSION } from "./types.ts";
import { githubAppJwt } from "./jwt.ts";
import { redactSecrets } from "../release/redact.ts";

type GitHubFetch = typeof fetch;
let customFetch: GitHubFetch | null = null;

export function setGitHubFetchForTest(fn: GitHubFetch | null) {
  customFetch = fn;
}

function ghFetch(input: string, init?: RequestInit): Promise<Response> {
  const extra: RequestInit = { ...init };
  if (!extra.signal) extra.signal = AbortSignal.timeout(20_000);
  const headers = new Headers(extra.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/vnd.github+json");
  if (!headers.has("X-GitHub-Api-Version")) headers.set("X-GitHub-Api-Version", GITHUB_API_VERSION);
  if (!headers.has("User-Agent")) headers.set("User-Agent", "fenix-export");
  extra.headers = headers;
  return (customFetch || fetch)(input, extra);
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export type GhError = { error: string; status: number };

export function isGhError(value: unknown): value is GhError {
  if (!value || typeof value !== "object") return false;
  const rec = value as { error?: unknown; status?: unknown; id?: unknown };
  return typeof rec.error === "string" && typeof rec.status === "number" && rec.id == null;
}

function fail(status: number, fallback: string, body?: string): GhError {
  const redacted = redactSecrets(String(body || "").slice(0, 180));
  const msg = /empty|git repository is empty/i.test(redacted)
    ? "Repository vuoto: GitHub non crea il primo branch con l'API Git. Aggiungi un README sul sito, poi esporta."
    : fallback;
  return { error: msg, status: status >= 400 ? status : 502 };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function mintInstallationToken(installationId: string): Promise<string | GhError> {
  let jwt: string;
  try {
    jwt = await githubAppJwt();
  } catch {
    return { error: "GitHub non configurato.", status: 503 };
  }
  const res = await ghFetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { ...authHeaders(jwt), "Content-Type": "application/json" },
    body: "{}",
  });
  const body = (await readJson(res)) as { token?: string } | null;
  if (!res.ok || !body?.token || typeof body.token !== "string") {
    return fail(res.status, "Installazione GitHub non raggiungibile.", JSON.stringify(body));
  }
  return body.token;
}

export async function getInstallation(
  installationId: string,
): Promise<{ id: string; appId?: string; account?: string } | GhError> {
  let jwt: string;
  try {
    jwt = await githubAppJwt();
  } catch {
    return { error: "GitHub non configurato.", status: 503 };
  }
  const res = await ghFetch(`${GITHUB_API}/app/installations/${installationId}`, {
    headers: authHeaders(jwt),
  });
  const body = (await readJson(res)) as {
    id?: number;
    app_id?: number;
    account?: { login?: string };
  } | null;
  if (!res.ok || body?.id == null) {
    return fail(res.status, "Installazione GitHub non valida.", JSON.stringify(body));
  }
  return {
    id: String(body.id),
    appId: body.app_id != null ? String(body.app_id) : undefined,
    account: body.account?.login,
  };
}

export async function listInstallationRepos(
  token: string,
): Promise<{ fullName: string; defaultBranch: string; private: boolean; empty: boolean }[] | GhError> {
  const out: { fullName: string; defaultBranch: string; private: boolean; empty: boolean }[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const res = await ghFetch(`${GITHUB_API}/installation/repositories?per_page=100&page=${page}`, {
      headers: authHeaders(token),
    });
    const body = (await readJson(res)) as {
      repositories?: {
        full_name?: string;
        default_branch?: string;
        private?: boolean;
        size?: number;
      }[];
    } | null;
    if (!res.ok) return fail(res.status, "Non riesco a elencare i repository.", JSON.stringify(body));
    const repos = body?.repositories || [];
    for (const r of repos) {
      if (!r.full_name) continue;
      out.push({
        fullName: r.full_name,
        defaultBranch: r.default_branch || "main",
        private: Boolean(r.private),
        empty: Number(r.size || 0) === 0,
      });
    }
    if (repos.length < 100) break;
  }
  return out;
}

export async function createBlob(token: string, repo: string, content: string): Promise<string | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/blobs`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  const body = (await readJson(res)) as { sha?: string } | null;
  if (!res.ok || !body?.sha) return fail(res.status, "Blob GitHub rifiutato.", JSON.stringify(body));
  return body.sha;
}

export async function createTree(
  token: string,
  repo: string,
  tree: { path: string; mode: "100644"; type: "blob"; sha: string }[],
): Promise<string | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/trees`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ tree }),
  });
  const body = (await readJson(res)) as { sha?: string } | null;
  if (!res.ok || !body?.sha) return fail(res.status, "Tree GitHub rifiutato.", JSON.stringify(body));
  return body.sha;
}

export async function createCommit(
  token: string,
  repo: string,
  input: { message: string; tree: string; parents: string[] },
): Promise<string | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/commits`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      tree: input.tree,
      parents: input.parents,
    }),
  });
  const body = (await readJson(res)) as { sha?: string } | null;
  if (!res.ok || !body?.sha) return fail(res.status, "Commit GitHub rifiutato.", JSON.stringify(body));
  return body.sha;
}

export async function getRef(
  token: string,
  repo: string,
  branch: string,
): Promise<{ sha: string } | null | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  });
  if (res.status === 404 || res.status === 409) return null;
  const body = (await readJson(res)) as { object?: { sha?: string } } | null;
  if (!res.ok) return fail(res.status, "Branch GitHub non leggibile.", JSON.stringify(body));
  const sha = body?.object?.sha;
  return sha ? { sha } : null;
}

export async function getCommitTreeSha(
  token: string,
  repo: string,
  commitSha: string,
): Promise<string | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/commits/${commitSha}`, {
    headers: authHeaders(token),
  });
  const body = (await readJson(res)) as { tree?: { sha?: string } } | null;
  if (!res.ok || !body?.tree?.sha) return fail(res.status, "Commit GitHub non leggibile.", JSON.stringify(body));
  return body.tree.sha;
}

export async function getRecursiveTree(
  token: string,
  repo: string,
  sha: string,
): Promise<string[] | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/trees/${sha}?recursive=1`, {
    headers: authHeaders(token),
  });
  const body = (await readJson(res)) as { tree?: { path?: string; type?: string }[] } | null;
  if (!res.ok) return fail(res.status, "Albero remoto non leggibile.", JSON.stringify(body));
  return (body?.tree || []).filter((t) => t.type === "blob" && t.path).map((t) => t.path!);
}

export async function updateRef(
  token: string,
  repo: string,
  branch: string,
  sha: string,
): Promise<true | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ sha, force: false }),
  });
  if (res.status === 409) {
    return { error: "Il branch è cambiato. Non sovrascrivo. Riprova.", status: 409 };
  }
  if (!res.ok) {
    const body = await readJson(res);
    return fail(res.status, "Aggiornamento del branch rifiutato.", JSON.stringify(body));
  }
  return true;
}

export async function createRef(
  token: string,
  repo: string,
  branch: string,
  sha: string,
): Promise<true | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/git/refs`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (!res.ok) {
    const body = await readJson(res);
    return fail(res.status, "Non riesco a creare il branch.", JSON.stringify(body));
  }
  return true;
}

/** Contents API seed — only path that initializes an empty GitHub repo. */
export async function seedEmptyReadme(
  token: string,
  repo: string,
  branch: string,
  content: string,
): Promise<true | GhError> {
  const res = await ghFetch(`${GITHUB_API}/repos/${repo}/contents/README.md`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Fenix: primo commit su repository vuoto",
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
    }),
  });
  if (!res.ok) {
    const body = await readJson(res);
    return fail(
      res.status,
      "Repository vuoto: GitHub non crea il primo branch con l'API Git. Aggiungi un README sul sito, poi esporta.",
      JSON.stringify(body),
    );
  }
  return true;
}

export function dropToken(_token: string): void {
  /* tokens are never stored; parameter exists so callers pass the value out of scope */
}
