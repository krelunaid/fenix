create table if not exists fenix_app_access (
  id text primary key,
  site_id text not null,
  token_hash text not null,
  role text not null check (role in ('viewer', 'editor')),
  label text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique (site_id, token_hash)
);

create index if not exists fenix_app_access_site_active
  on fenix_app_access (site_id, expires_at)
  where revoked_at is null;
