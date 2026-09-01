import { ownerFromRequest } from "../projects/publish-owner.ts";
import { redactSecrets } from "../release/redact.ts";
import { getInstallation, isGhError, listInstallationRepos, mintInstallationToken, dropToken } from "./api.ts";
import { exportToGitHub, previewExport } from "./export.ts";
import { githubAppConfig, githubConfigured } from "./secrets.server.ts";
import { mintConnectState, parseConnectState, safeReturnTo } from "./state.ts";
import {
  consumeNonce,
  deleteInstallation,
  githubOwnerHash,
  readInstallation,
  saveInstallation,
} from "./store.ts";
import { parseInstallationId } from "./tree.ts";
import { GITHUB_NOT_CONFIGURED } from "./types.ts";
import type { ProjectFile } from "../projects/files.ts";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const HINT_MISSING =
  "GitHub non configurato. Serve una GitHub App sul server (Contents read/write + Metadata read). Nessuna connessione finta.";
const HINT_CONNECT = "Collega un'installazione. Il token vive solo sul server, pochi minuti.";
const HINT_OK = "Installazione collegata. L'export parte solo se lo chiedi tu.";

export async function handleGitHubStatus(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Metodo non consentito." }, 405);
  if (!githubConfigured()) {
    return json({ configured: false, connected: false, hint: HINT_MISSING });
  }
  const owner = ownerFromRequest(request);
  if (!owner) {
    return json({ configured: true, connected: false, hint: HINT_CONNECT });
  }
  const row = await readInstallation(githubOwnerHash(owner));
  if (!row) return json({ configured: true, connected: false, hint: HINT_CONNECT });
  const inst = await getInstallation(row.installationId);
  if (isGhError(inst)) {
    await deleteInstallation(githubOwnerHash(owner));
    return json({ configured: true, connected: false, hint: HINT_CONNECT });
  }
  return json({
    configured: true,
    connected: true,
    account: inst.account || row.account,
    hint: HINT_OK,
  });
}

export async function handleGitHubConnect(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  const cfg = githubAppConfig();
  if (!cfg) return json({ error: GITHUB_NOT_CONFIGURED, hint: HINT_MISSING }, 503);
  const owner = ownerFromRequest(request);
  if (!owner) return json({ error: "Identità assente." }, 401);
  let returnTo = "/";
  try {
    const body = (await request.json()) as { returnTo?: string };
    returnTo = safeReturnTo(body?.returnTo);
  } catch {
    returnTo = "/";
  }
  const minted = mintConnectState(githubOwnerHash(owner), returnTo);
  if (!minted) return json({ error: GITHUB_NOT_CONFIGURED }, 503);
  const url = `https://github.com/apps/${encodeURIComponent(cfg.slug)}/installations/new?state=${encodeURIComponent(minted.state)}`;
  return json({ url });
}

export async function handleGitHubDisconnect(request: Request): Promise<Response> {
  if (request.method !== "DELETE") return json({ error: "Metodo non consentito." }, 405);
  const owner = ownerFromRequest(request);
  if (!owner) return json({ error: "Identità assente." }, 401);
  await deleteInstallation(githubOwnerHash(owner));
  return json({ configured: githubConfigured(), connected: false, hint: HINT_CONNECT });
}

export async function handleGitHubCallback(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Metodo non consentito." }, 405);
  const url = new URL(request.url);
  const state = parseConnectState(url.searchParams.get("state"));
  const installationId = parseInstallationId(url.searchParams.get("installation_id"));
  const setup = String(url.searchParams.get("setup_action") || "install");
  if (!state || !installationId || (setup !== "install" && setup !== "update")) {
    return htmlErr("Collegamento GitHub rifiutato. Stato o installazione non validi.");
  }
  const first = await consumeNonce(state.nonce, state.exp);
  if (!first) return htmlErr("Collegamento GitHub già usato. Stato non valido.");
  const inst = await getInstallation(installationId);
  if (isGhError(inst)) return htmlErr("Installazione GitHub non valida.");
  const cfg = githubAppConfig();
  if (cfg && /^\d+$/.test(cfg.appId) && inst.appId && inst.appId !== cfg.appId) {
    return htmlErr("Installazione di un'altra app. Rifiutata.");
  }
  try {
    await saveInstallation({
      ownerHash: state.ownerHash,
      installationId: inst.id,
      account: inst.account,
      connectedAt: Date.now(),
    });
  } catch {
    return htmlErr("Archivio GitHub non disponibile.");
  }
  const dest = new URL(state.returnTo, url.origin);
  dest.searchParams.set("github", "ok");
  return Response.redirect(dest.toString(), 302);
}

function htmlErr(message: string): Response {
  const safe = redactSecrets(message).replace(/[<>&]/g, "");
  return new Response(
    `<!doctype html><html lang="it"><meta charset="utf-8"><title>Fenix</title><body style="font-family:sans-serif;background:#07041a;color:#f4f1ff;padding:2rem"><p>${safe}</p><p><a href="/" style="color:#8b7cff">Torna a Fenix</a></p></body></html>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export async function handleGitHubRepos(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Metodo non consentito." }, 405);
  if (!githubConfigured()) return json({ error: GITHUB_NOT_CONFIGURED }, 503);
  const owner = ownerFromRequest(request);
  if (!owner) return json({ error: "Identità assente." }, 401);
  const row = await readInstallation(githubOwnerHash(owner));
  if (!row) return json({ error: "GitHub non collegato." }, 401);
  const token = await mintInstallationToken(row.installationId);
  if (isGhError(token)) return json({ error: token.error }, token.status);
  try {
    const repos = await listInstallationRepos(token);
    if (isGhError(repos)) return json({ error: repos.error }, repos.status);
    return json({ repos });
  } finally {
    dropToken(token);
  }
}

export async function handleGitHubExport(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);
  if (!githubConfigured()) return json({ error: GITHUB_NOT_CONFIGURED }, 503);
  const owner = ownerFromRequest(request);
  if (!owner) return json({ error: "Identità assente." }, 401);
  const row = await readInstallation(githubOwnerHash(owner));
  if (!row) return json({ error: "GitHub non collegato." }, 401);
  let body: {
    repo?: string;
    branch?: string;
    name?: string;
    kind?: string;
    html?: string;
    files?: ProjectFile[];
    preview?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "JSON non valido." }, 400);
  }
  const input = {
    ownerHash: githubOwnerHash(owner),
    installationId: row.installationId,
    repo: String(body.repo || ""),
    branch: String(body.branch || "main"),
    name: String(body.name || "Progetto"),
    kind: body.kind,
    html: body.html,
    files: body.files,
  };
  const result = body.preview ? await previewExport(input) : await exportToGitHub(input);
  if (isGhError(result)) {
    return json({ error: result.error }, result.status);
  }
  return json(result, body.preview ? 200 : result.status === "ok" ? 201 : 200);
}

export async function handleGitHubCollection(request: Request): Promise<Response> {
  if (request.method === "GET") return handleGitHubStatus(request);
  if (request.method === "POST") return handleGitHubConnect(request);
  if (request.method === "DELETE") return handleGitHubDisconnect(request);
  return json({ error: "Metodo non consentito." }, 405);
}
