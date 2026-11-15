-- Envelopes, the rules that sort transactions into them, and the result of
-- that sorting stored on each transaction.

create table envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('bill', 'flexible', 'variable', 'guilt_free')),
  default_amount bigint not null default 0,  -- pence, pre-filled on payday
  sort int not null default 0,
  unique (user_id, name)
);
alter table envelopes enable row level security;
create policy "own envelopes" on envelopes for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A rule matches a payee (lowercased) or a Monzo category.
-- treatment: envelope = file it there; ask = always let the person choose;
-- neutral = never counts as spending.
create table rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('payee', 'category')),
  value text not null,
  treatment text not null default 'envelope' check (treatment in ('envelope', 'ask', 'neutral')),
  envelope_id uuid references envelopes on delete cascade,
  unique (user_id, kind, value),
  check ((treatment = 'envelope') = (envelope_id is not null))
);
alter table rules enable row level security;
create policy "own rules" on rules for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table transactions
  add column payee text generated always as
    (lower(coalesce(merchant_name, raw -> 'counterparty' ->> 'name', description))) stored,
  add column scheme text generated always as (raw ->> 'scheme') stored,
  add column envelope_id uuid references envelopes on delete set null,
  add column status text not null default 'unassigned'
    check (status in ('envelope', 'neutral', 'income', 'unassigned')),
  add column manual boolean not null default false;  -- true once a person has filed it by hand

-- Starter envelopes and category rules for someone with none yet.
create function seed_defaults(p_user uuid default auth.uid()) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and p_user is distinct from auth.uid() then raise exception 'not allowed'; end if;
  if exists (select 1 from envelopes where user_id = p_user) then return; end if;

  insert into envelopes (user_id, name, kind, sort) values
    (p_user, 'Bills', 'bill', 10), (p_user, 'Groceries', 'flexible', 20), (p_user, 'Transport', 'flexible', 30),
    (p_user, 'Eating out', 'flexible', 40), (p_user, 'Shopping', 'flexible', 50), (p_user, 'Holidays', 'flexible', 60),
    (p_user, 'Entertainment', 'flexible', 70), (p_user, 'Guilt-free', 'guilt_free', 999);

  insert into rules (user_id, kind, value, envelope_id)
  select p_user, 'category', m.category, e.id
  from (values ('bills', 'Bills'), ('groceries', 'Groceries'), ('transport', 'Transport'), ('eating_out', 'Eating out'),
               ('shopping', 'Shopping'), ('holidays', 'Holidays'), ('entertainment', 'Entertainment')) m(category, envelope)
  join envelopes e on e.user_id = p_user and e.name = m.envelope;
end $$;

-- Sorts every transaction the person hasn't filed by hand.
create function classify_transactions(p_user uuid default auth.uid()) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and p_user is distinct from auth.uid() then raise exception 'not allowed'; end if;

  with decided as (
    select t.id,
      case
        when t.declined then 'neutral'
        when a.type <> 'uk_retail' then 'neutral'             -- Flex purchases: only repayments count
        when t.scheme = 'uk_retail_pot' then 'neutral'        -- moving money to or from a pot
        when lower(t.raw -> 'counterparty' ->> 'name') = lower(a.name) then 'neutral'  -- own accounts elsewhere
        when pr.treatment = 'neutral' then 'neutral'
        when pr.treatment = 'ask' then 'unassigned'
        when pr.envelope_id is not null then 'envelope'       -- includes refunds from that payee
        when t.amount > 0 and t.scheme is distinct from 'mastercard' then 'income'
        when cr.envelope_id is not null then 'envelope'       -- card refunds go back to their category
        else 'unassigned'
      end as status,
      coalesce(pr.envelope_id, cr.envelope_id) as envelope_id
    from transactions t
    join accounts a on a.id = t.account_id
    left join rules pr on pr.user_id = t.user_id and pr.kind = 'payee' and pr.value = t.payee
    left join rules cr on cr.user_id = t.user_id and cr.kind = 'category' and cr.value = t.category
    where t.user_id = p_user and not t.manual
  )
  update transactions t
  set status = d.status, envelope_id = case when d.status = 'envelope' then d.envelope_id end
  from decided d
  where d.id = t.id
    and (t.status, t.envelope_id) is distinct from (d.status, case when d.status = 'envelope' then d.envelope_id end);
end $$;

revoke execute on function seed_defaults(uuid), classify_transactions(uuid) from public, anon;
grant execute on function seed_defaults(uuid), classify_transactions(uuid) to authenticated, service_role;
