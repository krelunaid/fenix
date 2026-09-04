# PostgreSQL 16 reliability harness

Job blocking di CI su `postgres:16` reale (non PGlite). Collega gli store Fenix (`cloud-data`, collaborazione, workspace, `release_jobs`) alle migrazioni `0001`–`0007`.

## Cosa prova

1. Carico concorrente multi-sito / multi-soggetto / multi-collezione, CAS con un solo vincitore, isolamento tenant/ruoli, replay idempotente, pool `max=8`, p95/p99 con soglie esplicite.
2. Recovery drill: `pg_dump`/`pg_restore` major 16, mutazioni successive escluse, checksum e row count, processo Node che riparte sul database ripristinato senza duplicati.

Fail-closed se manca `DATABASE_URL`, se il server non è PostgreSQL 16, o se `pg_dump`/`pg_restore` non sono major 16. Nessuna credenziale nel report JSON.

## Locale (Docker)

```bash
docker run --name fenix-pg16 --rm \
  -e POSTGRES_USER=fenix_ci \
  -e POSTGRES_PASSWORD=fenix_ci_not_a_secret \
  -e POSTGRES_DB=fenix_reliability \
  -p 5432:5432 \
  --health-cmd "pg_isready -U fenix_ci -d fenix_reliability" \
  --health-interval 4s --health-timeout 5s --health-retries 12 \
  -d postgres:16

export DATABASE_URL=postgres://fenix_ci:fenix_ci_not_a_secret@127.0.0.1:5432/fenix_reliability
export PGPASSWORD=fenix_ci_not_a_secret
npm run test:postgres-reliability
```

La password è una fixture di CI, non un secret di produzione. Non registrarla nei log: il harness la redige.

`FENIX_PG_BIN` punta alla directory `bin` di PostgreSQL 16 se `pg_dump` non è nel `PATH`.

## CI

`.github/workflows/ci.yml` job `postgres-reliability`: service `postgres:16`, healthcheck, `postgresql-client-16`, artifact `artifacts/postgres-reliability.json`.
