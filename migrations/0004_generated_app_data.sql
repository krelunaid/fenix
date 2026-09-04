create table if not exists fenix_generated_app_data (
  site_id text not null,
  subject_hash text not null,
  collection text not null,
  rev bigint not null check (rev >= 1),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, subject_hash, collection)
);

create index if not exists fenix_generated_app_data_updated_at
  on fenix_generated_app_data (updated_at);
