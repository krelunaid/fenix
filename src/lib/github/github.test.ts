import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OWNER_HEADER } from "../projects/publish-owner.ts";
import { looksLikeSecret, redactSecrets } from "../release/redact.ts";
import { setGitHubFetchForTest } from "./api.ts";
import { githubAppJwt } from "./jwt.ts";
import {
  handleGitHubCallback,
  handleGitHubCollection,
  handleGitHubExport,
  handleGitHubRepos,
} from "./http.ts";
import { githubAppConfig, setGitHubAppForTest } from "./secrets.server.ts";
import {
  CONNECT_COOKIE_NAME,
  mintConnectCookie,
  parseConnectCookie,
  parseConnectState,
} from "./state.ts";
import {
  consumeNonce,
  createGitHubSqlForTest,
  githubOwnerHash,
  readInstallation,
  saveInstallation,
  setGitHubBlobsForTest,
  setGitHubSqlForTest,
  setGitHubStoreMemoryForTest,
} from "./store.ts";
import { parseBranch, parseRepo, exportFiles, contentHashOf } from "./tree.ts";
import { GITHUB_API_VERSION } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ARGILLA = readFileSync(join(here, "../projects/fixtures/argilla-viva.html"), "utf8");
const OWNER_A = "a".repeat(32);
const OWNER_B = "b".repeat(32);
const HTML = ARGILLA.slice(0, 4000);
const pem = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const pkcs1 = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
  .export({ type: "pkcs1", format: "pem" })
  .toString();

function ownerReq(method: string, url: string, owner?: string, body?: unknown) {
  const headers = new Headers();
  if (owner) headers.set(OWNER_HEADER, owner);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function cookieHeader(res: Response): string {
  return res.headers.get("set-cookie") || "";
}

function cookieValue(res: Response): string {
  const raw = cookieHeader(res);
  const prefix = `${CONNECT_COOKIE_NAME}=`;
  if (!raw.toLowerCase().startsWith(prefix.toLowerCase())) return "";
  return raw.slice(prefix.length).split(";")[0] || "";
}

function callbackReq(state: string, installationId: string, cookie?: string) {
  const url = `https://fenix.test/api/github/callback?installation_id=${installationId}&setup_action=install&state=${encodeURIComponent(state)}`;
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${CONNECT_COOKIE_NAME}=${cookie}`);
  return new Request(url, { headers });
}

async function connectOwner(owner: string, returnTo = "/") {
  const res = await handleGitHubCollection(
    ownerReq("POST", "https://fenix.test/api/github", owner, { returnTo }),
  );
  const body = (await res.json()) as { url?: string; error?: string };
  const url = body.url || "";
  const state = url ? new URL(url).searchParams.get("state") || "" : "";
  return { res, body, url, state, cookie: cookieValue(res), setCookie: cookieHeader(res) };
}

function installMock(opts?: { empty?: boolean; conflict?: boolean; extraRepo?: boolean }) {
  const blobs = new Map<string, string>();
  const trees = new Map<string, string[]>();
  const commits = new Map<string, { tree: string; parents: string[] }>();
  const refs = new Map<string, string>();
  const tokens = new Set<string>();
  const calls: { method: string; path: string; body: unknown; auth: string; version: string }[] = [];
  let n = 1;
  const sha = () => `abc${(n++).toString(16).padStart(37, "0")}`;
  if (!opts?.empty) {
    const t = sha();
    const c = sha();
    trees.set(t, ["README.md"]);
    commits.set(c, { tree: t, parents: [] });
    refs.set("heads/main", c);
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = String(init?.method || "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const auth = headers.get("Authorization") || "";
    const version = headers.get("X-GitHub-Api-Version") || "";
    const path = url.replace("https://api.github.com", "").split("?")[0] || "";
    let body: unknown = null;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = String(init.body);
      }
    }
    calls.push({ method, path, body, auth, version });
    if (method === "POST" && /\/app\/installations\/\d+\/access_tokens$/.test(path)) {
      if (!auth.startsWith("Bearer eyJ")) return new Response("jwt", { status: 401 });
      const token = `ghs_${"y".repeat(48)}`;
      tokens.add(token);
      return Response.json({ token, expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    if (method === "GET" && /\/app\/installations\/\d+$/.test(path)) {
      const id = path.split("/").pop();
      if (id === "99") {
        return Response.json({ id: 99, app_id: 12345, account: { login: "krelunaid" } });
      }
      if (id === "77") {
        return Response.json({ id: 77, app_id: 999, account: { login: "other" } });
      }
      return new Response("missing", { status: 404 });
    }
    const token = auth.replace(/^Bearer\s+/, "");
    const needInst = path.startsWith("/installation/") || path.startsWith("/repos/");
    if (needInst && !tokens.has(token)) return new Response("no token", { status: 401 });
    if (method === "GET" && path === "/installation/repositories") {
      const repos = [
        { full_name: "krelunaid/argilla", default_branch: "main", private: false, size: opts?.empty ? 0 : 12 },
      ];
      if (opts?.extraRepo) {
        repos.push({ full_name: "krelunaid/secret-lab", default_branch: "main", private: true, size: 1 });
      }
      return Response.json({ repositories: repos });
    }
    if (method === "POST" && path.endsWith("/git/blobs")) {
      const content = String((body as { content?: string }).content || "");
      const id = sha();
      blobs.set(id, content);
      return Response.json({ sha: id });
    }
    if (method === "POST" && path.endsWith("/git/trees")) {
      const id = sha();
      const tree = ((body as { tree?: { path: string }[] }).tree || []).map((t) => t.path);
      trees.set(id, tree);
      return Response.json({ sha: id });
    }
    if (method === "POST" && path.endsWith("/git/commits")) {
      const id = sha();
      const b = body as { tree?: string; parents?: string[] };
      commits.set(id, { tree: b.tree || "", parents: b.parents || [] });
      return Response.json({ sha: id });
    }
    if (method === "GET" && path.includes("/git/ref/heads/")) {
      const branch = decodeURIComponent(path.split("/git/ref/heads/")[1] || "");
      const current = refs.get(`heads/${branch}`);
      if (!current) return new Response("empty", { status: opts?.empty ? 409 : 404 });
      return Response.json({ object: { sha: current } });
    }
    if (method === "GET" && path.includes("/git/commits/")) {
      const id = path.split("/git/commits/")[1] || "";
      const c = commits.get(id);
      if (!c) return new Response("no", { status: 404 });
      return Response.json({ tree: { sha: c.tree } });
    }
    if (method === "GET" && path.includes("/git/trees/")) {
      const id = (path.split("/git/trees/")[1] || "").split("?")[0];
      const tree = trees.get(id) || [];
      return Response.json({ tree: tree.map((path) => ({ path, type: "blob" })) });
    }
    if (method === "PATCH" && path.includes("/git/refs/heads/")) {
      const b = body as { sha?: string; force?: boolean };
      if (b.force) return new Response("no force", { status: 400 });
      if (opts?.conflict) return new Response("conflict", { status: 409 });
      const branch = decodeURIComponent(path.split("/git/refs/heads/")[1] || "");
      refs.set(`heads/${branch}`, String(b.sha));
      return Response.json({ object: { sha: b.sha } });
    }
    if (method === "POST" && path.endsWith("/git/refs")) {
      const b = body as { ref?: string; sha?: string };
      if (opts?.empty && refs.size === 0) {
        return Response.json({ message: "Git Repository is empty." }, { status: 409 });
      }
      const name = String(b.ref || "").replace(/^refs\//, "");
      refs.set(name, String(b.sha));
      return Response.json({ object: { sha: b.sha } });
    }
    if (method === "PUT" && path.includes("/contents/README.md")) {
      const id = sha();
      const t = sha();
      trees.set(t, ["README.md"]);
      commits.set(id, { tree: t, parents: [] });
      refs.set("heads/main", id);
      return Response.json({ commit: { sha: id } });
    }
    return new Response(`unhandled ${method} ${path}`, { status: 500 });
  };
  setGitHubFetchForTest(fetchImpl);
  return { calls, blobs, commits, refs, tokens };
}

describe("github export helpers", () => {
  it("rejects unsafe repo and branch names", () => {
    assert.equal(parseRepo("../etc/passwd"), null);
    assert.equal(parseRepo("krelunaid/argilla.git"), null);
    assert.equal(parseRepo("krelunaid/argilla")?.fullName, "krelunaid/argilla");
    assert.equal(parseBranch("HEAD"), null);
    assert.equal(parseBranch("refs/heads/main"), null);
    assert.equal(parseBranch("../main"), null);
    assert.equal(parseBranch("feat/ok"), "feat/ok");
  });

  it("drops secrets from the export tree and keeps fenix.json", () => {
    const files = exportFiles({
      name: "Argilla Viva",
      kind: "dashboard",
      html: HTML,
      files: [
        { path: "index.html", content: HTML },
        { path: "notes.md", content: "ok" },
        { path: "leak.pem", content: "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----" },
        { path: "token.txt", content: `ghs_${"y".repeat(48)}` },
      ],
    });
    assert.ok(files.some((f) => f.path === "fenix.json"));
    assert.ok(files.some((f) => f.path === "index.html"));
    assert.ok(files.some((f) => f.path === "README.md" || f.path === "notes.md"));
    assert.ok(!files.some((f) => /PRIVATE KEY/.test(f.content) || f.path.endsWith(".pem")));
    assert.ok(!files.some((f) => /ghs_/.test(f.content)));
    assert.equal(contentHashOf(files).length, 64);
  });
});

describe("github app http", () => {
  beforeEach(() => {
    setGitHubStoreMemoryForTest(true);
    setGitHubSqlForTest(null);
    setGitHubAppForTest(null);
    setGitHubFetchForTest(null);
    setGitHubBlobsForTest(null);
  });
  afterEach(() => {
    setGitHubAppForTest(null);
    setGitHubFetchForTest(null);
    setGitHubBlobsForTest(null);
    setGitHubSqlForTest(null);
    setGitHubStoreMemoryForTest(false);
  });

  it("unconfigured status is honest and connect is 503", async () => {
    const status = await handleGitHubCollection(ownerReq("GET", "https://fenix.test/api/github", OWNER_A));
    assert.equal(status.status, 200);
    const body = (await status.json()) as { configured: boolean; connected: boolean; hint: string };
    assert.equal(body.configured, false);
    assert.equal(body.connected, false);
    assert.match(body.hint, /GitHub non configurato/);
    const connect = await handleGitHubCollection(
      ownerReq("POST", "https://fenix.test/api/github", OWNER_A, { returnTo: `/studio/${OWNER_A}` }),
    );
    assert.equal(connect.status, 503);
    const err = (await connect.json()) as { error: string };
    assert.match(err.error, /GitHub non configurato/);
  });

  it("missing slug is not a fake connection", () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "" });
    assert.equal(githubAppConfig(), null);
  });

  it("connect sets HttpOnly cookie; callback rejects bad state, other app, replay", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    installMock();
    const noOwner = await handleGitHubCollection(
      ownerReq("POST", "https://fenix.test/api/github", undefined, { returnTo: "/studio/x" }),
    );
    assert.equal(noOwner.status, 401);

    const connect = await connectOwner(OWNER_A, "/studio/argilla");
    assert.equal(connect.res.status, 200);
    assert.match(connect.url, /^https:\/\/github\.com\/apps\/fenix-export\/installations\/new\?state=/);
    assert.match(connect.setCookie, new RegExp(`^${CONNECT_COOKIE_NAME}=`));
    assert.match(connect.setCookie, /HttpOnly/i);
    assert.match(connect.setCookie, /Secure/i);
    assert.match(connect.setCookie, /SameSite=Lax/i);
    assert.match(connect.setCookie, /Path=\/api\/github\/callback/);
    assert.match(connect.setCookie, /Max-Age=600/);
    assert.equal("cookie" in connect.body, false);
    assert.equal("state" in connect.body, false);
    assert.doesNotMatch(JSON.stringify(connect.body), /fenix_gh/);
    assert.ok(parseConnectState(connect.state));
    assert.ok(parseConnectCookie(connect.cookie));
    assert.equal(parseConnectState(connect.cookie), null);

    const bad = await handleGitHubCallback(callbackReq("nope", "99", connect.cookie));
    assert.equal(bad.status, 400);
    assert.match(cookieHeader(bad), /Max-Age=0/);

    const other = await handleGitHubCallback(callbackReq(connect.state, "77", connect.cookie));
    assert.equal(other.status, 400);
    assert.equal(await readInstallation(githubOwnerHash(OWNER_A)), null);

    const connect2 = await connectOwner(OWNER_A, "/studio/argilla");
    const ok = await handleGitHubCallback(callbackReq(connect2.state, "99", connect2.cookie));
    assert.equal(ok.status, 302);
    assert.match(ok.headers.get("location") || "", /github=ok/);
    assert.match(cookieHeader(ok), /Max-Age=0/);

    const replay = await handleGitHubCallback(callbackReq(connect2.state, "99", connect2.cookie));
    assert.equal(replay.status, 400);
  });

  it("attacker state on a victim browser is rejected before save", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    installMock();
    const attacker = await connectOwner(OWNER_A, "/stolen");
    const victim = await connectOwner(OWNER_B, "/own");

    const noCookie = await handleGitHubCallback(callbackReq(attacker.state, "99"));
    assert.equal(noCookie.status, 400);
    assert.match(await noCookie.text(), /Sessione assente o non valida/);
    assert.equal(await readInstallation(githubOwnerHash(OWNER_A)), null);
    assert.equal(await readInstallation(githubOwnerHash(OWNER_B)), null);

    const mismatch = await handleGitHubCallback(callbackReq(attacker.state, "99", victim.cookie));
    assert.equal(mismatch.status, 400);
    assert.match(await mismatch.text(), /Sessione assente o non valida/);
    assert.equal(await readInstallation(githubOwnerHash(OWNER_A)), null);

    const expired = mintConnectCookie(
      githubOwnerHash(OWNER_A),
      parseConnectState(attacker.state)?.nonce || "",
      Date.now() - 1000,
    );
    const stale = await handleGitHubCallback(callbackReq(attacker.state, "99", expired || undefined));
    assert.equal(stale.status, 400);

    const legit = await handleGitHubCallback(callbackReq(attacker.state, "99", attacker.cookie));
    assert.equal(legit.status, 302);
    const row = await readInstallation(githubOwnerHash(OWNER_A));
    assert.equal(row?.installationId, "99");
    assert.equal(await readInstallation(githubOwnerHash(OWNER_B)), null);
  });

  it("callback without cookie does not consume the nonce", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    installMock();
    const connect = await connectOwner(OWNER_A);
    const missing = await handleGitHubCallback(callbackReq(connect.state, "99"));
    assert.equal(missing.status, 400);
    const ok = await handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie));
    assert.equal(ok.status, 302);
  });

  it("parallel callbacks: one 302, one 400, one installation", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    installMock();
    const connect = await connectOwner(OWNER_A);
    const [a, b] = await Promise.all([
      handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie)),
      handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie)),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [302, 400]);
    const row = await readInstallation(githubOwnerHash(OWNER_A));
    assert.equal(row?.installationId, "99");
  });

  it("SQL UNIQUE: two parallel consumeNonce, one winner", async () => {
    setGitHubStoreMemoryForTest(false);
    const pg = await createGitHubSqlForTest();
    setGitHubSqlForTest(pg.sql);
    try {
      const nonce = randomBytes(16).toString("hex");
      const ownerHash = githubOwnerHash(OWNER_A);
      const exp = Date.now() + 60_000;
      const [x, y] = await Promise.all([
        consumeNonce(nonce, ownerHash, exp),
        consumeNonce(nonce, ownerHash, exp),
      ]);
      assert.equal([x, y].filter(Boolean).length, 1);
      assert.equal(await consumeNonce(nonce, ownerHash, exp), false);
    } finally {
      setGitHubSqlForTest(null);
      await pg.close();
    }
  });

  it("blobs never claim a nonce; Netlify without SQL fails closed", async () => {
    setGitHubStoreMemoryForTest(false);
    const bag = new Map<string, unknown>();
    setGitHubBlobsForTest({
      async get(key) {
        return bag.has(key) ? bag.get(key) : null;
      },
      async setJSON(key, value) {
        bag.set(key, value);
      },
      async delete(key) {
        bag.delete(key);
      },
    });
    const prev = process.env.NETLIFY;
    process.env.NETLIFY = "1";
    try {
      const nonce = randomBytes(16).toString("hex");
      assert.equal(await consumeNonce(nonce, githubOwnerHash(OWNER_A), Date.now() + 60_000), false);
      assert.equal([...bag.keys()].some((k) => k.includes("nonce")), false);
    } finally {
      if (prev === undefined) delete process.env.NETLIFY;
      else process.env.NETLIFY = prev;
    }
  });

  it("lists only installation repos; other owner is disconnected", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    installMock({ extraRepo: true });
    const connect = await connectOwner(OWNER_A);
    await handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie));
    const list = await handleGitHubRepos(ownerReq("GET", "https://fenix.test/api/github/repos", OWNER_A));
    assert.equal(list.status, 200);
    const payload = (await list.json()) as { repos: { fullName: string }[] };
    assert.ok(payload.repos.some((r) => r.fullName === "krelunaid/argilla"));
    const other = await handleGitHubRepos(ownerReq("GET", "https://fenix.test/api/github/repos", OWNER_B));
    assert.equal(other.status, 401);
  });

  it("export is blob→tree→commit→ref force=false, idempotent, redacted", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    const mock = installMock();
    const connect = await connectOwner(OWNER_A);
    await handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie));

    const body = {
      repo: "krelunaid/argilla",
      branch: "main",
      name: "Argilla Viva",
      kind: "dashboard",
      html: HTML,
      files: [{ path: "index.html", content: HTML }],
    };
    const first = await handleGitHubExport(ownerReq("POST", "https://fenix.test/api/github/export", OWNER_A, body));
    assert.equal(first.status, 201);
    const job = (await first.json()) as { commitSha: string; log: string[]; contentHash: string };
    assert.ok(job.commitSha);
    const commits1 = mock.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits")).length;
    assert.equal(commits1, 1);
    assert.ok(
      mock.calls.some(
        (c) => c.method === "PATCH" && c.path.includes("/git/refs/heads/") && (c.body as { force?: boolean }).force === false,
      ),
    );
    assert.ok(!mock.calls.some((c) => (c.body as { force?: boolean } | null)?.force === true));
    assert.ok(mock.calls.every((c) => c.version === GITHUB_API_VERSION));
    for (const line of job.log) {
      assert.equal(looksLikeSecret(line), false);
      assert.doesNotMatch(line, /ghs_/);
    }
    const stored = JSON.stringify(mock.calls.map((c) => ({ path: c.path, body: c.body })));
    assert.doesNotMatch(stored, /ghs_y{10,}/);

    const second = await handleGitHubExport(ownerReq("POST", "https://fenix.test/api/github/export", OWNER_A, body));
    const job2 = (await second.json()) as { unchanged?: boolean };
    assert.equal(job2.unchanged, true);
    const commits2 = mock.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits")).length;
    assert.equal(commits2, 1);
  });

  it("invalid branch and foreign repo are rejected; conflict does not force", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    const mock = installMock({ conflict: true });
    const connect = await connectOwner(OWNER_A);
    await handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie));
    const badBranch = await handleGitHubExport(
      ownerReq("POST", "https://fenix.test/api/github/export", OWNER_A, {
        repo: "krelunaid/argilla",
        branch: "../main",
        name: "Argilla Viva",
        html: HTML,
      }),
    );
    assert.equal(badBranch.status, 400);
    const foreign = await handleGitHubExport(
      ownerReq("POST", "https://fenix.test/api/github/export", OWNER_A, {
        repo: "octocat/hello",
        branch: "main",
        name: "Argilla Viva",
        html: HTML,
      }),
    );
    assert.equal(foreign.status, 403);
    const conflicted = await handleGitHubExport(
      ownerReq("POST", "https://fenix.test/api/github/export", OWNER_A, {
        repo: "krelunaid/argilla",
        branch: "main",
        name: "Argilla Viva",
        html: HTML,
      }),
    );
    assert.equal(conflicted.status, 409);
    const err = (await conflicted.json()) as { error: string };
    assert.match(err.error, /non sovrascrivo/i);
    assert.ok(!mock.calls.some((c) => (c.body as { force?: boolean } | null)?.force === true));
  });

  it("empty repo seeds README then exports without inventing force", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    const mock = installMock({ empty: true });
    const connect = await connectOwner(OWNER_A);
    await handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie));
    const res = await handleGitHubExport(
      ownerReq("POST", "https://fenix.test/api/github/export", OWNER_A, {
        repo: "krelunaid/argilla",
        branch: "main",
        name: "Argilla Viva",
        html: HTML,
      }),
    );
    assert.equal(res.status, 201);
    assert.ok(mock.calls.some((c) => c.method === "PUT" && c.path.includes("/contents/README.md")));
    assert.ok(mock.calls.some((c) => c.method === "PATCH" && (c.body as { force?: boolean }).force === false));
  });

  it("JWT is RS256 under 10 minutes, PKCS1 works, tokens are not in status JSON", async () => {
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    const jwt = await githubAppJwt();
    const header = JSON.parse(Buffer.from(jwt.split(".")[0]!, "base64url").toString("utf8")) as { alg: string };
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString("utf8")) as {
      iss: string;
      iat: number;
      exp: number;
    };
    assert.equal(header.alg, "RS256");
    assert.equal(payload.iss, "12345");
    assert.ok(payload.exp - payload.iat <= 10 * 60);
    assert.ok(payload.exp - payload.iat >= 8 * 60);
    setGitHubAppForTest({ appId: "12345", privateKey: pkcs1, slug: "fenix-export" });
    const jwtPkcs1 = await githubAppJwt();
    assert.equal(jwtPkcs1.split(".").length, 3);
    setGitHubAppForTest({ appId: "12345", privateKey: pem, slug: "fenix-export" });
    installMock();
    const connect = await connectOwner(OWNER_A);
    await handleGitHubCallback(callbackReq(connect.state, "99", connect.cookie));
    const status = await handleGitHubCollection(ownerReq("GET", "https://fenix.test/api/github", OWNER_A));
    const text = await status.text();
    assert.doesNotMatch(text, /ghs_/);
    assert.doesNotMatch(text, /BEGIN PRIVATE/);
    assert.doesNotMatch(text, /eyJ/);
    assert.match(redactSecrets(`token ghs_${"y".repeat(48)}`), /\[redacted\]/);
  });

  it("blob store keeps installation without tokens", async () => {
    setGitHubStoreMemoryForTest(false);
    const bag = new Map<string, unknown>();
    setGitHubBlobsForTest({
      async get(key) {
        return bag.has(key) ? bag.get(key) : null;
      },
      async setJSON(key, value) {
        bag.set(key, value);
      },
      async delete(key) {
        bag.delete(key);
      },
    });
    const ownerHash = "c".repeat(64);
    await saveInstallation({
      ownerHash,
      installationId: "99",
      account: "krelunaid",
      connectedAt: 1,
    });
    const row = await readInstallation(ownerHash);
    assert.equal(row?.installationId, "99");
    const dumped = JSON.stringify([...bag.values()]);
    assert.doesNotMatch(dumped, /ghs_/);
    assert.doesNotMatch(dumped, /BEGIN PRIVATE/);
    assert.doesNotMatch(dumped, /eyJ/);
  });
});
