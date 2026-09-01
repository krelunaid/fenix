-- Durable release jobs. Unique idempotency_key is the distributed claim.
-- Lease is taken with a conditional UPDATE. version is optimistic locking.

create table if not exists release_jobs (
  id text primary key,
  idempotency_key text not null unique,
  owner_hash text not null,
  job jsonb not null,
  version integer not null default 1,
  lease_owner text,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists release_jobs_lease_idx on release_jobs (lease_until);
create index if not exists release_jobs_owner_idx on release_jobs (owner_hash);
