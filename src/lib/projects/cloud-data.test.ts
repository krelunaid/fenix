import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import {
  cloudSubjectHash,
  handleCloudDataRequest,
  MAX_CLOUD_COLLECTION_BYTES,
  parseCloudCollection,
  parseCloudRevision,
  readCloudCollection,
  writeCloudCollection,
} from "./cloud-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(here, "../../../migrations/0004_generated_app_data.sql"),
  "utf8",
);
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
});
