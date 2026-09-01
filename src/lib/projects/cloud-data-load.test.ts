import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import {
  cloudSubjectHash,
  readCloudCollection,
  writeCloudCollection,
} from "./cloud-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(here, "../../../migrations/0004_generated_app_data.sql"),
  "utf8",
);

async function loadSql(): Promise<{ pg: PGlite; sql: Sql }> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(migration);
  const run = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as Sql;
  sql.query = run;
  return { pg, sql };
}

describe("generated app cloud data bounded load", () => {
  it("isolates 24 subjects × 4 collections and resolves a 32-writer CAS burst", async () => {
    const { pg, sql } = await loadSql();
    const siteId = "site-cloud-load";
    const subjects = Array.from({ length: 24 }, (_, index) =>
      cloudSubjectHash(siteId, index.toString(16).padStart(64, "0")),
    );
    const collections = ["clienti", "ordini", "inventario", "impostazioni"];
    try {
      const writes = subjects.flatMap((subject, subjectIndex) =>
        collections.map((collection, collectionIndex) =>
          writeCloudCollection(sql, siteId, subject, collection, 0, {
            subject: subjectIndex,
            collection: collectionIndex,
          }),
        ),
      );
      const inserted = await Promise.all(writes);
      assert.equal(inserted.length, 96);
      assert.equal(inserted.filter((row) => !("error" in row) && !("conflict" in row)).length, 96);

      const reads = await Promise.all(
        subjects.flatMap((subject) =>
          collections.map((collection) => readCloudCollection(sql, siteId, subject, collection)),
        ),
      );
      assert.equal(reads.length, 96);
      assert.ok(reads.every((row) => row.rev === 1));

      const contestedSubject = subjects[0];
      const burst = await Promise.all(
        Array.from({ length: 32 }, (_, contender) =>
          writeCloudCollection(sql, siteId, contestedSubject, "clienti", 1, { contender }),
        ),
      );
      assert.equal(burst.filter((row) => "conflict" in row).length, 31);
      assert.equal(burst.filter((row) => !("error" in row) && !("conflict" in row)).length, 1);
      assert.equal(
        (await readCloudCollection(sql, siteId, contestedSubject, "clienti")).rev,
        2,
      );
      const count = await sql.query<{ count: number }>(
        "select count(*)::int as count from fenix_generated_app_data where site_id=$1",
        [siteId],
      );
      assert.equal(Number(count[0]?.count), 96);
    } finally {
      await pg.close();
    }
  });
});
