import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { appAccessCookieName, createAppInvite, revokeAppInvite } from "./app-collaboration.ts";
import {
  cloudSubjectHash,
  handleCloudDataRequest,
  MAX_CLOUD_COLLECTION_BYTES,
  MAX_CLOUD_REQUEST_BYTES,
  parseCloudCollection,
  parseCloudRevision,
  readCloudCollection,
  writeCloudCollection,
} from "./cloud-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migration = ["0004_generated_app_data.sql", "0005_app_collaboration.sql"]
  .map((name) => readFileSync(join(here, `../../../migrations/${name}`), "utf8"))
  .join("\n");
const siteId = "site-cloud-1234";
const sessionA = "a".repeat(64);
const sessionB = "b".repeat(64);
let pg: PGlite;
let sql: Sql;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  await pg.exec(migration);
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

function req(
  body: unknown,
  over: { cookie?: string; origin?: string; method?: string } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", over.origin ?? "https://fenix.test");
  headers.set("sec-fetch-site", "same-origin");
  if (over.cookie) headers.set("cookie", over.cookie);
  return new Request(`https://fenix.test/api/app-data/${siteId}`, {
    method: over.method ?? "POST",
    headers,
    body: over.method === "GET" ? undefined : JSON.stringify(body),
  });
}

function cookiePair(response: Response): string {
  const raw = response.headers.get("set-cookie") || "";
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /SameSite=Strict/);
  assert.match(raw, new RegExp(`Path=/api/app-data/${siteId}`));
  return raw.split(";", 1)[0] || "";
}

describe("generated app cloud data primitives", () => {
  it("validates collection/revision tokens and hashes the raw session", () => {
    assert.equal(parseCloudCollection("clienti_2026"), "clienti_2026");
    assert.equal(parseCloudCollection("../clienti"), null);
    assert.equal(parseCloudCollection("__proto__"), null);
    assert.equal(parseCloudRevision(0), 0);
    assert.equal(parseCloudRevision(-1), null);
    assert.equal(parseCloudRevision(1.2), null);
    const hash = cloudSubjectHash(siteId, sessionA);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(hash, new RegExp(sessionA));
  });

  it("persists JSON with optimistic concurrency and isolates subjects", async () => {
    const subjectA = cloudSubjectHash(siteId, sessionA);
    const subjectB = cloudSubjectHash(siteId, sessionB);
    assert.deepEqual(await readCloudCollection(sql, siteId, subjectA, "clienti"), {
      rev: 0,
      data: null,
    });
    assert.deepEqual(
      await writeCloudCollection(sql, siteId, subjectA, "clienti", 0, [{ id: "a" }]),
      {
        rev: 1,
        data: [{ id: "a" }],
      },
    );
    const [winner, loser] = await Promise.all([
      writeCloudCollection(sql, siteId, subjectA, "clienti", 1, [{ id: "a" }, { id: "b" }]),
      writeCloudCollection(sql, siteId, subjectA, "clienti", 1, [{ id: "a" }, { id: "c" }]),
    ]);
    const results = [winner, loser];
    assert.equal(results.filter((row) => "conflict" in row).length, 1);
    assert.equal(results.filter((row) => !("conflict" in row)).length, 1);
    assert.equal((await readCloudCollection(sql, siteId, subjectA, "clienti")).rev, 2);
    assert.deepEqual(await readCloudCollection(sql, siteId, subjectB, "clienti"), {
      rev: 0,
      data: null,
    });
  });

  it("rejects unsafe or oversized JSON before SQL", async () => {
    const subject = cloudSubjectHash(siteId, sessionB);
    const unsafe: unknown = JSON.parse('{"constructor":"blocked"}');
    assert.deepEqual(await writeCloudCollection(sql, siteId, subject, "bad", 0, unsafe), {
      error: "Sono ammessi solo dati JSON sicuri.",
    });
    const huge = "x".repeat(MAX_CLOUD_COLLECTION_BYTES + 1);
    assert.deepEqual(await writeCloudCollection(sql, siteId, subject, "huge", 0, huge), {
      error: "Collezione troppo grande.",
    });
  });
});

describe("generated app cloud data HTTP", () => {
  const deps = {
    get sql() {
      return sql;
    },
    siteExists: async (id: string) => id === siteId,
    randomSession: () => "c".repeat(64),
    durable: true,
  };

  it("creates an HttpOnly anonymous app session, loads and saves by revision", async () => {
    const first = await handleCloudDataRequest(req({ op: "load", col: "ordini" }), siteId, deps);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("x-content-type-options"), "nosniff");
    const cookie = cookiePair(first);
    assert.deepEqual(await first.json(), {
      ok: true,
      mode: "cloud-private",
      shared: false,
      rev: 0,
      data: null,
    });
    const saved = await handleCloudDataRequest(
      req({ op: "save", col: "ordini", rev: 0, data: [{ id: "o1", totale: 42 }] }, { cookie }),
      siteId,
      deps,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get("set-cookie"), null);
    assert.deepEqual(await saved.json(), {
      ok: true,
      mode: "cloud-private",
      shared: false,
      rev: 1,
      data: [{ id: "o1", totale: 42 }],
    });
    const stale = await handleCloudDataRequest(
      req({ op: "save", col: "ordini", rev: 0, data: [] }, { cookie }),
      siteId,
      deps,
    );
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).conflict, true);
  });

  it("shares one CAS dataset across devices while enforcing viewer/editor roles", async () => {
    const createdAt = Date.now();
    const editorToken = "d".repeat(64);
    const viewerToken = "e".repeat(64);
    await createAppInvite(sql, siteId, "editor", "Redazione", {
      now: createdAt,
      token: editorToken,
      id: "shared-editor-01",
    });
    await createAppInvite(sql, siteId, "viewer", "Lettura", {
      now: createdAt,
      token: viewerToken,
      id: "shared-viewer-01",
    });
    const cookieName = appAccessCookieName(siteId);
    const editorCookie = `${cookieName}=${editorToken}`;
    const viewerCookie = `${cookieName}=${viewerToken}`;

    const loaded = await handleCloudDataRequest(
      req({ op: "load", col: "agenda-condivisa" }, { cookie: editorCookie }),
      siteId,
      deps,
    );
    assert.deepEqual(await loaded.json(), {
      ok: true,
      mode: "cloud-shared",
      shared: true,
      role: "editor",
      rev: 0,
      data: null,
    });
    const saved = await handleCloudDataRequest(
      req(
        {
          op: "save",
          col: "agenda-condivisa",
          rev: 0,
          data: [{ id: "r1", titolo: "Forno" }],
        },
        { cookie: editorCookie },
      ),
      siteId,
      deps,
    );
    assert.equal(saved.status, 200);
    const otherDevice = await handleCloudDataRequest(
      req({ op: "load", col: "agenda-condivisa" }, { cookie: viewerCookie }),
      siteId,
      deps,
    );
    assert.deepEqual(await otherDevice.json(), {
      ok: true,
      mode: "cloud-shared",
      shared: true,
      role: "viewer",
      rev: 1,
      data: [{ id: "r1", titolo: "Forno" }],
    });
    const forbidden = await handleCloudDataRequest(
      req({ op: "save", col: "agenda-condivisa", rev: 1, data: [] }, { cookie: viewerCookie }),
      siteId,
      deps,
    );
    assert.equal(forbidden.status, 403);
    assert.match(JSON.stringify(await forbidden.json()), /sola lettura/i);

    const privateLoad = await handleCloudDataRequest(
      req({ op: "load", col: "agenda-condivisa" }),
      siteId,
      deps,
    );
    assert.deepEqual((await privateLoad.json()).data, null, "anonymous data stays isolated");

    assert.equal(await revokeAppInvite(sql, siteId, "shared-editor-01"), true);
    const revoked = await handleCloudDataRequest(
      req({ op: "load", col: "agenda-condivisa" }, { cookie: editorCookie }),
      siteId,
      deps,
    );
    assert.equal(revoked.status, 401);
    assert.match(revoked.headers.get("set-cookie") || "", /Max-Age=0/);
  });

  it("fails closed on origin, missing site and missing durable SQL", async () => {
    const cross = await handleCloudDataRequest(
      req({ op: "load", col: "x" }, { origin: "https://attacker.test" }),
      siteId,
      deps,
    );
    assert.equal(cross.status, 403);
    const missing = await handleCloudDataRequest(
      req({ op: "load", col: "x" }),
      "site-cloud-missing",
      deps,
    );
    assert.equal(missing.status, 404);
    const unavailable = await handleCloudDataRequest(req({ op: "load", col: "x" }), siteId, {
      ...deps,
      durable: false,
    });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), {
      error: "Dati cloud non configurati.",
      shared: false,
    });
  });

  it("does not accept arbitrary methods, collections or revisions", async () => {
    assert.equal(
      (await handleCloudDataRequest(req({}, { method: "GET" }), siteId, deps)).status,
      405,
    );
    assert.equal(
      (await handleCloudDataRequest(req({ op: "load", col: "../x" }), siteId, deps)).status,
      400,
    );
    assert.equal(
      (await handleCloudDataRequest(req({ op: "save", col: "x", rev: -1, data: [] }), siteId, deps))
        .status,
      400,
    );
  });

  it("stops oversized request bodies before JSON parsing or SQL", async () => {
    const declared = new Request(`https://fenix.test/api/app-data/${siteId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_CLOUD_REQUEST_BYTES + 1),
        origin: "https://fenix.test",
        "sec-fetch-site": "same-origin",
      },
      body: "{}",
    });
    const declaredResponse = await handleCloudDataRequest(declared, siteId, deps);
    assert.equal(declaredResponse.status, 413);
    assert.deepEqual(await declaredResponse.json(), { error: "Richiesta troppo grande." });

    const streamedResponse = await handleCloudDataRequest(
      req({
        op: "save",
        col: "oversized-http",
        rev: 0,
        data: "x".repeat(MAX_CLOUD_REQUEST_BYTES),
      }),
      siteId,
      deps,
    );
    assert.equal(streamedResponse.status, 413);
    assert.deepEqual(await streamedResponse.json(), { error: "Richiesta troppo grande." });
  });
});
