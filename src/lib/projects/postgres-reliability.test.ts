import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PG16_MAJOR,
  POOL_MAX,
  THRESHOLDS,
  assertReportRedacted,
  latencyStats,
  parsePostgresMajor,
  parsePostgresUrl,
  percentile,
  redactDatabaseUrl,
  restoreDatabaseName,
  runPostgresReliability,
} from "./postgres-reliability.ts";

describe("postgres 16 reliability fail-closed helpers", () => {
  it("redacts userinfo and rejects non-postgres or missing URLs", () => {
    assert.equal(
      redactDatabaseUrl("postgres://fenix_ci:fenix_ci_not_a_secret@127.0.0.1:5432/fenix_reliability"),
      "postgres://fenix_ci:***@127.0.0.1:5432/fenix_reliability",
    );
    assert.equal(parsePostgresMajor("pg_dump (PostgreSQL) 16.15"), PG16_MAJOR);
    assert.equal(parsePostgresMajor("pg_restore (PostgreSQL) 15.8"), 15);
    assert.equal(parsePostgresMajor("not a version"), null);
    assert.equal(restoreDatabaseName("fenix_reliability"), "fenix_reliability_restore");
    assert.throws(() => parsePostgresUrl(""), /DATABASE_URL assente/);
    assert.throws(() => parsePostgresUrl("postgres://127.0.0.1:5432/"), /nome database/);
    assert.throws(() => parsePostgresUrl("memory://pglite"), /PGlite|PostgreSQL/);
    assert.throws(() => parsePostgresUrl("postgres://x:y@127.0.0.1:5432/app?pglite=1"), /PGlite/);
    assert.throws(() => parsePostgresUrl("file:/tmp/app.sqlite"), /PGlite|PostgreSQL/);
    const target = parsePostgresUrl(
      "postgresql://fenix_ci:fenix_ci_not_a_secret@127.0.0.1:55432/fenix_reliability",
    );
    assert.equal(target.database, "fenix_reliability");
    assert.equal(target.port, "55432");
    assert.equal(target.user, "fenix_ci");
  });

  it("computes generous p95/p99 and refuses credentials in the report", () => {
    const stats = latencyStats([1, 2, 3, 4, 10, 12, 20, 40, 80, 120]);
    assert.equal(percentile([1, 2, 3, 4], 100), 4);
    assert.ok(stats.p95Ms >= stats.p99Ms - 120);
    assert.ok(THRESHOLDS.p95WriteMs >= 250);
    assert.ok(THRESHOLDS.p99WriteMs >= THRESHOLDS.p95WriteMs);
    assert.equal(POOL_MAX, 8);
    const report = {
      ok: true,
      database: "fenix_reliability",
      pool: { max: POOL_MAX, observedMax: 4 },
    };
    assert.doesNotThrow(() => assertReportRedacted(report, ["fenix_ci_not_a_secret"]));
    assert.throws(
      () =>
        assertReportRedacted(
          { url: "postgres://fenix_ci:fenix_ci_not_a_secret@127.0.0.1/db" },
          ["fenix_ci_not_a_secret"],
        ),
      /DATABASE_URL|credenziale/,
    );
  });

  it("does not connect during npm test and fails closed without a real DATABASE_URL", async () => {
    await assert.rejects(
      () => runPostgresReliability({ databaseUrl: "" }),
      /DATABASE_URL assente/,
    );
    await assert.rejects(
      () => runPostgresReliability({ databaseUrl: "postgres://127.0.0.1:5432/pglite" }),
      /PGlite/,
    );
  });
});
