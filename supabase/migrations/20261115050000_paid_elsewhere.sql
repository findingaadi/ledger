-- Spending Ledger can't see, such as a payment made from another bank.
-- It counts against an envelope in a cycle exactly like a Monzo transaction.
create table manual_spend (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cycle_id uuid not null references pay_cycles on delete cascade,
  envelope_id uuid not null references envelopes on delete cascade,
  label text not null,
  amount bigint not null check (amount > 0)  -- pence
);
alter table manual_spend enable row level security;
create policy "own manual spend" on manual_spend for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from pay_cycles c where c.id = cycle_id and c.user_id = (select auth.uid()))
    and exists (select 1 from envelopes e where e.id = envelope_id and e.user_id = (select auth.uid()))
  );

create or replace function cycle_envelopes(p_cycle uuid)
returns table (id uuid, name text, kind text, sort int, allocated bigint, spent bigint)
language sql stable set search_path = public as $$
  select e.id, e.name, e.kind, e.sort,
    coalesce(a.amount, 0)::bigint,
    (coalesce((
      select -sum(t.amount) from transactions t
      where t.envelope_id = e.id and t.status = 'envelope' and t.created >= c.starts_at
        and t.created < coalesce(
          (select min(n.starts_at) from pay_cycles n where n.user_id = c.user_id and n.starts_at > c.starts_at), 'infinity')
    ), 0)
    + coalesce((select sum(m.amount) from manual_spend m where m.cycle_id = c.id and m.envelope_id = e.id), 0))::bigint
  from pay_cycles c
  join envelopes e on e.user_id = c.user_id
  left join allocations a on a.cycle_id = c.id and a.envelope_id = e.id
  where c.id = p_cycle
$$;
