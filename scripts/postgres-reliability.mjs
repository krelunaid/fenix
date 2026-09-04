#!/usr/bin/env node
/**
 * Production-like PostgreSQL 16 reliability harness.
 * Fail-closed: refuses PGlite, missing DATABASE_URL, or the wrong major.
 *
 *   docker run --name fenix-pg16 --health-cmd "pg_isready -U fenix_ci -d fenix_reliability" \
 *     -e POSTGRES_USER=fenix_ci -e POSTGRES_PASSWORD=fenix_ci_not_a_secret \
 *     -e POSTGRES_DB=fenix_reliability -p 5432:5432 -d postgres:16
 *   DATABASE_URL=postgres://fenix_ci:fenix_ci_not_a_secret@127.0.0.1:5432/fenix_reliability \
 *     npm run test:postgres-reliability
 */
import { runPostgresReliabilityCli } from "../src/lib/projects/postgres-reliability.ts";

runPostgresReliabilityCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[postgres-reliability] ${message.replace(/:([^:@/]+)@/g, ":***@")}`);
  process.exit(1);
});
