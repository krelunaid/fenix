create table if not exists fenix_workspaces (
  id text primary key,
  owner_hash text not null,
  project_id text not null,
  name text not null,
  tree_json text not null,
  cas_version integer not null default 1,
  cas_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_hash, project_id)
);

create table if not exists fenix_workspace_invites (
  id text primary key,
  workspace_id text not null references fenix_workspaces(id) on delete cascade,
  token_hash text not null,
  role text not null check (role in ('viewer', 'editor')),
  label text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by text,
  revoked_at timestamptz,
  unique (workspace_id, token_hash)
);

create table if not exists fenix_workspace_members (
  id text primary key,
  workspace_id text not null references fenix_workspaces(id) on delete cascade,
  user_hash text not null,
  role text not null check (role in ('viewer', 'editor')),
  label text not null,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (workspace_id, user_hash)
);

create table if not exists fenix_workspace_presence (
  workspace_id text not null references fenix_workspaces(id) on delete cascade,
  session_id text not null,
  user_hash text not null,
  seen_at timestamptz not null default now(),
  primary key (workspace_id, session_id)
);

create table if not exists fenix_workspace_audit (
  id text primary key,
  workspace_id text not null references fenix_workspaces(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  kind text not null,
  detail text not null
);

create index if not exists fenix_workspace_members_active
  on fenix_workspace_members (workspace_id)
  where revoked_at is null;

create index if not exists fenix_workspace_invites_active
  on fenix_workspace_invites (workspace_id, expires_at)
  where revoked_at is null and consumed_at is null;

create index if not exists fenix_workspace_presence_seen
  on fenix_workspace_presence (workspace_id, seen_at);

create index if not exists fenix_workspace_audit_ws
  on fenix_workspace_audit (workspace_id, at desc);
