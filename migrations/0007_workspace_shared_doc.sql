create table if not exists fenix_workspace_docs (
  workspace_id text primary key references fenix_workspaces(id) on delete cascade,
  content text not null default '',
  version integer not null default 0,
  ops_json text not null default '[]',
  updated_at timestamptz not null default now()
);

create index if not exists fenix_workspace_docs_updated
  on fenix_workspace_docs (updated_at desc);
