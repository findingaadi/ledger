-- Both tables are reachable only by server functions (service role).
-- Row level security is on with no policies, so the apps can read nothing.

create table oauth_states (
  state text primary key,
  nonce text not null,
  return_to text not null,
  created_at timestamptz not null default now()
);
alter table oauth_states enable row level security;

create table monzo_connections (
  user_id uuid primary key references auth.users on delete cascade,
  monzo_user_id text not null unique,
  access_token text not null,   -- AES-GCM encrypted
  refresh_token text,           -- AES-GCM encrypted
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table monzo_connections enable row level security;
