import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { OWNER_HEADER } from "./publish-owner.ts";
import {
  handleWorkspaceCollection,
  handleWorkspaceRequest,
  WORKSPACE_NOT_CONFIGURED,
  workspaceUserHash,
} from "./workspace.ts";
import { decideDocOp, emptySharedDoc, MAX_DOC_OPS } from "./workspace-doc.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ownerA = "a".repeat(32);
const ownerB = "b".repeat(32);
const ownerC = "c".repeat(32);
const token = "d".repeat(64);
const now = 1_800_000_000_000;
const INDEX = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Argilla</title></head><body><h1>Argilla Viva</h1><button type="button">Salva</button></body></html>`;
const ORDINI = `${JSON.stringify({ ordini: [{ id: "o1", pezzi: 2 }] }, null, 2)}\n`;

let pg: PGlite;
let sql: Sql;
let seq = 0;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync(join(here, "../../../migrations/0006_project_workspaces.sql"), "utf8"));
  await pg.exec(readFileSync(join(here, "../../../migrations/0007_workspace_shared_doc.sql"), "utf8"));
  const query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const tagged = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return query<T>(text, values);
  }) as Sql;
  tagged.query = query;
  sql = tagged;
});

after(async () => {
  await pg.close();
});

function nextId(prefix: string) {
  seq += 1;
  return `${prefix}${String(seq).padStart(12, "0")}`;
}

function request(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  options: { owner?: string; origin?: string; ifMatch?: string } = {},
): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (options.owner) headers.set(OWNER_HEADER, options.owner);
  if (options.ifMatch) headers.set("if-match", options.ifMatch);
  headers.set("origin", options.origin ?? "https://fenix.test");
  headers.set("sec-fetch-site", "same-origin");
  return new Request(`https://fenix.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const files = [
  { path: "index.html", content: INDEX },
  { path: "data/ordini.json", content: ORDINI },
];

describe("project workspace collaboration", () => {
  const deps = {
    get sql() {
      return sql;
    },
    durable: true,
    now: () => now,
    token: () => token,
    id: () => nextId("id"),
  };

  it("stays 503 without a durable store and never trusts a client-sent role", async () => {
    const denied = await handleWorkspaceCollection(
      request("POST", "/api/workspace", { name: "X", projectId: "proj-argilla", role: "owner" }),
      { durable: false },
    );
    assert.equal(denied.status, 503);
    assert.match((await denied.json()).error, /DATABASE_URL|0006/);
    assert.equal(denied.headers.get("set-cookie"), null);

    const noId = await handleWorkspaceCollection(
      request("POST", "/api/workspace", {
        name: "Argilla",
        projectId: "proj-argilla",
        files,
        role: "owner",
      }),
      deps,
    );
    assert.equal(noId.status, 401);
  });

  it("lets an owner create a workspace, invite once, and keeps the raw token off disk", async () => {
    seq = 0;
    const created = await handleWorkspaceCollection(
      request(
        "POST",
        "/api/workspace",
        { name: "Argilla Viva", projectId: "proj-argilla-01", files, role: "viewer" },
        { owner: ownerA },
      ),
      { ...deps, id: () => "w" + "a".repeat(16) },
    );
    const createdText = await created.text();
    assert.equal(created.status, 201, createdText);
    const createdPayload = JSON.parse(createdText) as {
      id: string;
      role: string;
      files: { path: string }[];
      casVersion: number;
    };
    assert.equal(createdPayload.role, "owner");
    assert.deepEqual(
      createdPayload.files.map((f) => f.path),
      ["index.html", "data/ordini.json"],
    );
    const ws = createdPayload.id;

    const invited = await handleWorkspaceRequest(
      request("POST", `/api/workspace/${ws}`, { op: "invite", role: "editor" }, { owner: ownerA }),
      ws,
      deps,
    );
    assert.equal(invited.status, 201);
    const payload = (await invited.json()) as { token: string; invite: { id: string; role: string } };
    assert.equal(payload.token, token);
    assert.equal(payload.invite.role, "editor");

    const listed = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerA }),
      ws,
      deps,
    );
    const listedRaw = await listed.text();
    assert.doesNotMatch(listedRaw, new RegExp(token));
    assert.doesNotMatch(listedRaw, new RegExp(workspaceUserHash(ownerA)));
    const hashes = await sql.query<{ token_hash: string }>(
      "select token_hash from fenix_workspace_invites where workspace_id=$1",
      [ws],
    );
    assert.equal(hashes.length, 1);
    assert.notEqual(hashes[0]!.token_hash, token);
    assert.match(hashes[0]!.token_hash, /^[a-f0-9]{64}$/);
  });

  it("binds isolated users: viewer 403 on write, editor CAS write, concurrent conflict, revoke immediate", async () => {
    seq = 10;
    const ws = "w" + "b".repeat(16);
    const created = await handleWorkspaceCollection(
      request(
        "POST",
        "/api/workspace",
        { name: "Kiln", projectId: "proj-kiln-01", files },
        { owner: ownerA },
      ),
      { ...deps, id: () => ws },
    );
    assert.equal(created.status, 201);

    const editorInvite = await handleWorkspaceRequest(
      request("POST", `/api/workspace/${ws}`, { op: "invite", role: "editor" }, { owner: ownerA }),
      ws,
      { ...deps, token: () => "e".repeat(64) },
    );
    const editorToken = ((await editorInvite.json()) as { token: string }).token;
    const viewerInvite = await handleWorkspaceRequest(
      request("POST", `/api/workspace/${ws}`, { op: "invite", role: "viewer" }, { owner: ownerA }),
      ws,
      { ...deps, token: () => "f".repeat(64) },
    );
    const viewerToken = ((await viewerInvite.json()) as { token: string }).token;

    const cross = await handleWorkspaceRequest(
      request(
        "POST",
        `/api/workspace/${ws}`,
        { op: "join", token: editorToken, role: "owner" },
        { owner: ownerB, origin: "https://evil.test" },
      ),
      ws,
      deps,
    );
    assert.equal(cross.status, 403);

    const joinedEditor = await handleWorkspaceRequest(
      request(
        "POST",
        `/api/workspace/${ws}`,
        { op: "join", token: editorToken, role: "owner" },
        { owner: ownerB },
      ),
      ws,
      deps,
    );
    assert.equal(joinedEditor.status, 200);
    assert.equal(((await joinedEditor.json()) as { role: string }).role, "editor");

    const reuse = await handleWorkspaceRequest(
      request(
        "POST",
        `/api/workspace/${ws}`,
        { op: "join", token: editorToken },
        { owner: ownerC },
      ),
      ws,
      deps,
    );
    assert.equal(reuse.status, 401);

    const joinedViewer = await handleWorkspaceRequest(
      request(
        "POST",
        `/api/workspace/${ws}`,
        { op: "join", token: viewerToken },
        { owner: ownerC },
      ),
      ws,
      deps,
    );
    assert.equal(joinedViewer.status, 200);
    assert.equal(((await joinedViewer.json()) as { role: string }).role, "viewer");

    const tree = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerC }),
      ws,
      deps,
    );
    assert.equal(tree.status, 200);
    const snap = (await tree.json()) as { files: { path: string }[]; casVersion: number; casHash: string };
    assert.ok(snap.files.some((f) => f.path === "data/ordini.json"));

    const viewerWrite = await handleWorkspaceRequest(
      request(
        "PUT",
        `/api/workspace/${ws}`,
        { path: "data/ordini.json", content: '{"ordini":[]}\n', role: "editor" },
        { owner: ownerC, ifMatch: `"${snap.casVersion}"` },
      ),
      ws,
      deps,
    );
    assert.equal(viewerWrite.status, 403);

    const noMatch = await handleWorkspaceRequest(
      request(
        "PUT",
        `/api/workspace/${ws}`,
        { path: "data/ordini.json", content: '{"ordini":[{"id":"o2"}]}\n' },
        { owner: ownerB },
      ),
      ws,
      deps,
    );
    assert.equal(noMatch.status, 428);

    const first = await handleWorkspaceRequest(
      request(
        "PUT",
        `/api/workspace/${ws}`,
        { path: "data/ordini.json", content: '{"ordini":[{"id":"o2","pezzi":4}]}\n' },
        { owner: ownerB, ifMatch: `"${snap.casVersion}"` },
      ),
      ws,
      deps,
    );
    assert.equal(first.status, 200);
    const after = (await first.json()) as { casVersion: number };
    assert.equal(after.casVersion, snap.casVersion + 1);

    const conflict = await handleWorkspaceRequest(
      request(
        "PUT",
        `/api/workspace/${ws}`,
        { path: "index.html", content: INDEX.replace("Argilla Viva", "Forno") },
        { owner: ownerA, ifMatch: `"${snap.casVersion}"` },
      ),
      ws,
      deps,
    );
    assert.equal(conflict.status, 409);

    const secret = await handleWorkspaceRequest(
      request(
        "PUT",
        `/api/workspace/${ws}`,
        { path: "notes.txt", content: "Bearer xai-aaaaaaaaaaaaaaaaaaaa" },
        { owner: ownerB, ifMatch: `"${after.casVersion}"` },
      ),
      ws,
      deps,
    );
    assert.equal(secret.status, 400);

    const members = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerA }),
      ws,
      deps,
    );
    const body = (await members.json()) as {
      members: { id: string; role: string }[];
      audit: { kind: string; detail: string }[];
    };
    const viewer = body.members.find((m) => m.role === "viewer");
    assert.ok(viewer);
    assert.ok(body.audit.every((event) => !event.detail.includes(editorToken)));
    assert.ok(body.audit.length <= 64);

    const revoked = await handleWorkspaceRequest(
      request(
        "POST",
        `/api/workspace/${ws}`,
        { op: "revoke", memberId: viewer!.id },
        { owner: ownerA },
      ),
      ws,
      deps,
    );
    assert.equal(revoked.status, 200);
    const afterRevoke = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerC }),
      ws,
      deps,
    );
    assert.equal(afterRevoke.status, 403);
    const writeRevoked = await handleWorkspaceRequest(
      request(
        "PUT",
        `/api/workspace/${ws}`,
        { path: "index.html", content: INDEX },
        { owner: ownerC, ifMatch: "*" },
      ),
      ws,
      deps,
    );
    assert.equal(writeRevoked.status, 403);

    const editorRole = await handleWorkspaceRequest(
      request(
        "POST",
        `/api/workspace/${ws}`,
        { op: "invite", role: "viewer" },
        { owner: ownerB },
      ),
      ws,
      deps,
    );
    assert.equal(editorRole.status, 403);
  });

  it("tracks bounded TTL presence across two sessions of the same editor", async () => {
    seq = 40;
    const ws = "w" + "c".repeat(16);
    await handleWorkspaceCollection(
      request(
        "POST",
        "/api/workspace",
        { name: "Presenza", projectId: "proj-presence-01", files },
        { owner: ownerA },
      ),
      { ...deps, id: () => ws },
    );
    const beat = (sessionId: string, at: number, owner: string) =>
      handleWorkspaceRequest(
        request("POST", `/api/workspace/${ws}`, { op: "presence", sessionId }, { owner }),
        ws,
        { ...deps, now: () => at },
      );
    const s1 = await beat("s" + "1".repeat(16), now, ownerA);
    const s2 = await beat("s" + "2".repeat(16), now + 1_000, ownerA);
    assert.equal(s1.status, 200);
    const live = (await s2.json()) as { presence: { sessions: number }[] };
    assert.equal(live.presence[0]?.sessions, 2);

    const expired = await beat("s" + "2".repeat(16), now + 46_000, ownerA);
    const after = (await expired.json()) as { presence: { sessions: number }[] };
    assert.equal(after.presence[0]?.sessions, 1);
  });

  it("does not claim parity and keeps the configuration hint honest", () => {
    assert.match(WORKSPACE_NOT_CONFIGURED, /DATABASE_URL/);
    assert.match(WORKSPACE_NOT_CONFIGURED, /0006/);
    assert.doesNotMatch(WORKSPACE_NOT_CONFIGURED, /parit[aà]|Emergent|CRDT/);
  });

  it("converges independent inserts in either arrival order without claiming CRDT", () => {
    const seed = decideDocOp(emptySharedDoc(), {
      id: "o" + "1".repeat(16),
      kind: "insert",
      pos: 0,
      text: "Argilla viva. ",
      base: 0,
    });
    assert.equal(seed.status, "apply");
    if (seed.status !== "apply") return;
    const left = {
      id: "o" + "a".repeat(16),
      kind: "insert" as const,
      pos: 0,
      text: "Lotti. ",
      base: 1,
    };
    const right = {
      id: "o" + "b".repeat(16),
      kind: "insert" as const,
      pos: "Argilla viva. ".length,
      text: "Forno.",
      base: 1,
    };
    const leftFirst = decideDocOp(seed.next, left);
    assert.equal(leftFirst.status, "apply");
    if (leftFirst.status !== "apply") return;
    const ab = decideDocOp(leftFirst.next, right);
    const rightFirst = decideDocOp(seed.next, right);
    assert.equal(rightFirst.status, "apply");
    if (rightFirst.status !== "apply") return;
    const ba = decideDocOp(rightFirst.next, left);
    assert.equal(ab.status, "apply");
    assert.equal(ba.status, "apply");
    if (ab.status !== "apply" || ba.status !== "apply") return;
    assert.equal(ab.next.content, "Lotti. Argilla viva. Forno.");
    assert.equal(ba.next.content, ab.next.content);
    assert.equal(ab.next.version, 3);
  });

  it("lets two editors edit independent parts, rejects overlap/stale, and keeps audit redacted", async () => {
    seq = 80;
    const ws = "w" + "d".repeat(16);
    const created = await handleWorkspaceCollection(
      request(
        "POST",
        "/api/workspace",
        { name: "Argilla Viva", projectId: "proj-notes-01", files, role: "viewer" },
        { owner: ownerA },
      ),
      { ...deps, id: () => ws },
    );
    assert.equal(created.status, 201);
    const createdBody = (await created.json()) as { doc: { content: string; version: number } };
    assert.deepEqual(createdBody.doc, { content: "", version: 0 });

    const editorInvite = await handleWorkspaceRequest(
      request("POST", `/api/workspace/${ws}`, { op: "invite", role: "editor" }, { owner: ownerA }),
      ws,
      { ...deps, token: () => "e".repeat(64) },
    );
    const editorToken = ((await editorInvite.json()) as { token: string }).token;
    const viewerInvite = await handleWorkspaceRequest(
      request("POST", `/api/workspace/${ws}`, { op: "invite", role: "viewer" }, { owner: ownerA }),
      ws,
      { ...deps, token: () => "f".repeat(64) },
    );
    const viewerToken = ((await viewerInvite.json()) as { token: string }).token;
    assert.equal(
      (
        await handleWorkspaceRequest(
          request("POST", `/api/workspace/${ws}`, { op: "join", token: editorToken }, { owner: ownerB }),
          ws,
          deps,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await handleWorkspaceRequest(
          request("POST", `/api/workspace/${ws}`, { op: "join", token: viewerToken }, { owner: ownerC }),
          ws,
          deps,
        )
      ).status,
      200,
    );

    const opId = (n: number) => `o${n.toString(16).padStart(16, "0")}`;
    const postDoc = (
      owner: string,
      body: Record<string, unknown>,
    ) =>
      handleWorkspaceRequest(
        request("POST", `/api/workspace/${ws}`, { op: "doc", role: "owner", ...body }, { owner }),
        ws,
        deps,
      );

    const seed = await postDoc(ownerA, {
      opId: opId(1),
      kind: "insert",
      pos: 0,
      text: "Argilla viva. ",
      base: 0,
    });
    assert.equal(seed.status, 200, await seed.clone().text());
    assert.equal(((await seed.json()) as { version: number }).version, 1);

    const replay = await postDoc(ownerA, {
      opId: opId(1),
      kind: "insert",
      pos: 0,
      text: "Argilla viva. ",
      base: 0,
    });
    const replayBody = (await replay.json()) as { version: number; duplicate: boolean; content: string };
    assert.equal(replay.status, 200);
    assert.equal(replayBody.duplicate, true);
    assert.equal(replayBody.version, 1);
    assert.equal(replayBody.content, "Argilla viva. ");

    const [left, right] = await Promise.all([
      postDoc(ownerB, {
        opId: opId(2),
        kind: "insert",
        pos: 0,
        text: "Lotti. ",
        base: 1,
      }),
      postDoc(ownerA, {
        opId: opId(3),
        kind: "insert",
        pos: "Argilla viva. ".length,
        text: "Forno.",
        base: 1,
      }),
    ]);
    assert.equal(left.status, 200, await left.clone().text());
    assert.equal(right.status, 200, await right.clone().text());
    await left.json();
    await right.json();

    const reopen = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerB }),
      ws,
      deps,
    );
    const reopenBody = (await reopen.json()) as {
      doc: { content: string; version: number };
      role: string;
    };
    assert.equal(reopen.status, 200);
    assert.equal(reopenBody.doc.content, "Lotti. Argilla viva. Forno.");
    assert.equal(reopenBody.doc.version, 3);

    const viewerWrite = await postDoc(ownerC, {
      opId: opId(4),
      kind: "insert",
      pos: 0,
      text: "no",
      base: 3,
    });
    assert.equal(viewerWrite.status, 403);

    const overlapSeed = await postDoc(ownerA, {
      opId: opId(5),
      kind: "insert",
      pos: "Lotti. Argilla viva. Forno.".length,
      text: " abcdef",
      base: 3,
    });
    assert.equal(overlapSeed.status, 200);
    const overlapBase = ((await overlapSeed.json()) as { version: number; content: string }).version;
    const abcStart = "Lotti. Argilla viva. Forno. ".length;
    const [delOne, delTwo] = await Promise.all([
      postDoc(ownerA, {
        opId: opId(6),
        kind: "delete",
        pos: abcStart,
        text: "abc",
        base: overlapBase,
      }),
      postDoc(ownerB, {
        opId: opId(7),
        kind: "delete",
        pos: abcStart + 1,
        text: "bcd",
        base: overlapBase,
      }),
    ]);
    const overlapStatuses = [delOne.status, delTwo.status].sort();
    assert.deepEqual(overlapStatuses, [200, 409]);
    const afterOverlap = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerA }),
      ws,
      deps,
    );
    const afterOverlapBody = (await afterOverlap.json()) as {
      doc: { content: string; version: number };
    };
    const afterOverlapDoc = afterOverlapBody.doc.content;
    assert.ok(
      afterOverlapDoc === "Lotti. Argilla viva. Forno. def" ||
        afterOverlapDoc === "Lotti. Argilla viva. Forno. aef",
    );

    const secret = await postDoc(ownerB, {
      opId: opId(8),
      kind: "insert",
      pos: 0,
      text: "Bearer xai-aaaaaaaaaaaaaaaaaaaa",
      base: afterOverlapBody.doc.version,
    });
    assert.equal(secret.status, 400);

    const dash = "--------------------------------";
    const pad = await postDoc(ownerA, {
      opId: opId(9),
      kind: "insert",
      pos: afterOverlapDoc.length,
      text: dash,
      base: afterOverlapBody.doc.version,
    });
    assert.equal(pad.status, 200, await pad.clone().text());
    const padded = (await pad.json()) as { content: string; version: number };
    const start = padded.content.length - dash.length;
    const burst = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        postDoc(i % 2 === 0 ? ownerA : ownerB, {
          opId: opId(20 + i),
          kind: "insert",
          pos: start + i * 4,
          text: String(i),
          base: padded.version,
        }),
      ),
    );
    assert.ok(
      burst.every((res) => res.status === 200),
      await Promise.all(burst.map((res) => res.clone().text())).then((rows) => rows.join(" | ")),
    );
    await Promise.all(burst.map((res) => res.json()));
    const afterBurst = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerB }),
      ws,
      deps,
    );
    const burstDoc = ((await afterBurst.json()) as { doc: { content: string; version: number } }).doc;
    assert.equal(burstDoc.content.replace(/[^0-7]/g, ""), "01234567");

    let version = burstDoc.version;
    for (let i = 0; i < MAX_DOC_OPS + 1; i += 1) {
      const step = await postDoc(ownerA, {
        opId: opId(50 + i),
        kind: "insert",
        pos: 0,
        text: ".",
        base: version,
      });
      assert.equal(step.status, 200);
      version = ((await step.json()) as { version: number }).version;
    }
    const tooOld = await postDoc(ownerB, {
      opId: opId(200),
      kind: "insert",
      pos: 0,
      text: "NO",
      base: 1,
    });
    assert.equal(tooOld.status, 409);
    const tooOldBody = (await tooOld.json()) as { content: string; error: string };
    assert.match(tooOldBody.error, /vecchia|conflitto/i);
    const afterStale = await handleWorkspaceRequest(
      request("GET", `/api/workspace/${ws}`, undefined, { owner: ownerA }),
      ws,
      deps,
    );
    const afterStaleDoc = (await afterStale.json()) as {
      doc: { content: string };
      audit: { kind: string; detail: string }[];
      members: { id: string; role: string }[];
    };
    assert.doesNotMatch(afterStaleDoc.doc.content, /NO$/);
    assert.doesNotMatch(JSON.stringify(afterStaleDoc.audit), new RegExp(editorToken));
    assert.doesNotMatch(JSON.stringify(afterStaleDoc.audit), /Argilla viva|Lotti|Forno|Bearer|xai-/);
    assert.ok(afterStaleDoc.audit.every((event) => !event.detail.includes(opId(1))));
    assert.ok(afterStaleDoc.audit.length <= 64);
    assert.doesNotMatch(JSON.stringify(afterStaleDoc), new RegExp(workspaceUserHash(ownerA)));

    const viewer = afterStaleDoc.members.find((row) => row.role === "viewer");
    assert.ok(viewer);
    assert.equal(
      (
        await handleWorkspaceRequest(
          request("POST", `/api/workspace/${ws}`, { op: "revoke", memberId: viewer!.id }, { owner: ownerA }),
          ws,
          deps,
        )
      ).status,
      200,
    );
    const revoked = await postDoc(ownerC, {
      opId: opId(201),
      kind: "insert",
      pos: 0,
      text: "X",
      base: version,
    });
    assert.equal(revoked.status, 403);
  });
});
