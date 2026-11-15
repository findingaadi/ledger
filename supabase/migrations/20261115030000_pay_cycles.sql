-- A pay cycle runs from one payday to the next. Each cycle has allocations
-- (how much every envelope gets) and optional hand-entered side income.

create table pay_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  start_tx text not null unique references transactions on delete cascade,  -- the salary payment
  starts_at timestamptz not null
);
alter table pay_cycles enable row level security;
create policy "read own cycles" on pay_cycles for select using (user_id = (select auth.uid()));
create index pay_cycles_user_start on pay_cycles (user_id, starts_at desc);

create table allocations (
  cycle_id uuid not null references pay_cycles on delete cascade,
  envelope_id uuid not null references envelopes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount bigint not null check (amount >= 0),  -- pence
  primary key (cycle_id, envelope_id)
);
alter table allocations enable row level security;
create policy "own allocations" on allocations for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from pay_cycles c where c.id = cycle_id and c.user_id = (select auth.uid()))
    and exists (select 1 from envelopes e where e.id = envelope_id and e.user_id = (select auth.uid()))
  );

-- Income Ledger can't see: cash, another bank, or a correction. May be negative.
create table manual_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cycle_id uuid not null references pay_cycles on delete cascade,
  label text not null,
  amount bigint not null  -- pence
);
alter table manual_income enable row level security;
create policy "own manual income" on manual_income for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from pay_cycles c where c.id = cycle_id and c.user_id = (select auth.uid()))
  );

-- Creates a cycle for every salary payment that doesn't have one yet.
-- shortcut: relies on Monzo's own payday flag; add a "this is my salary" choice
-- for people whose employer Monzo doesn't recognise.
create function ensure_cycles(p_user uuid default auth.uid()) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is not null and p_user is distinct from auth.uid() then raise exception 'not allowed'; end if;
  for r in
    select t.id, t.created
    from transactions t join accounts a on a.id = t.account_id
    where t.user_id = p_user and a.type = 'uk_retail' and t.amount > 0 and not t.declined
      and t.raw -> 'metadata' ->> 'payday' = 'true'
      and not exists (select 1 from pay_cycles c where c.start_tx = t.id)
    order by t.created
  loop
    -- A second payment within ten days of a payday (a bonus, a correction) is income in that cycle, not a new one.
    if not exists (
      select 1 from pay_cycles c
      where c.user_id = p_user and c.starts_at > r.created - interval '10 days' and c.starts_at < r.created + interval '10 days'
    ) then
      insert into pay_cycles (user_id, start_tx, starts_at) values (p_user, r.id, r.created);
    end if;
  end loop;
end $$;

revoke execute on function ensure_cycles(uuid) from public, anon;
grant execute on function ensure_cycles(uuid) to authenticated, service_role;
