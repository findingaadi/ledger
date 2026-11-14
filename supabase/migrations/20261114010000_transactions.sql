-- Copies of Monzo data. People can read only their own rows; only server
-- functions (service role) can write.

create table accounts (
  id text primary key,                      -- Monzo account id
  user_id uuid not null references auth.users on delete cascade,
  type text not null,
  name text,
  backfilled boolean not null default false, -- true once the first sync has reached the present
  backfill_cursor text,                      -- last transaction id seen while backfilling
  full_history boolean not null default false, -- false if Monzo only allowed the last 90 days
  synced_at timestamptz
);
alter table accounts enable row level security;
create policy "read own accounts" on accounts for select using (user_id = (select auth.uid()));

create table transactions (
  id text primary key,                      -- Monzo transaction id
  user_id uuid not null references auth.users on delete cascade,
  account_id text not null references accounts on delete cascade,
  amount bigint not null,                   -- pence; negative is spending
  currency text not null,
  created timestamptz not null,
  settled timestamptz,
  description text,
  merchant_name text,
  category text,
  declined boolean not null default false,
  raw jsonb not null                        -- everything Monzo sent, since old data can't be re-fetched
);
alter table transactions enable row level security;
create policy "read own transactions" on transactions for select using (user_id = (select auth.uid()));
create index transactions_user_created on transactions (user_id, created desc);
