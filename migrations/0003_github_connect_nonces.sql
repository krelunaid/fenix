-- Single-use GitHub App connect nonces.
-- UNIQUE/insert-on-conflict is the CAS. Blobs must not claim these.

create table if not exists github_connect_nonces (
  nonce text primary key,
  owner_hash text not null,
  exp bigint not null,
  created_at timestamptz not null default now()
);
