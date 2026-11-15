-- A pay cycle now starts at the beginning of the day the salary arrived
-- (UK time), not the minute it arrived, so a book covers whole days.

create or replace function salary_day_start(p_at timestamptz) returns timestamptz
language sql immutable as $$
  select (date_trunc('day', p_at at time zone 'Europe/London')) at time zone 'Europe/London'
$$;

update pay_cycles c set starts_at = salary_day_start(t.created)
from transactions t where t.id = c.start_tx;

create or replace function ensure_cycles(p_user uuid default auth.uid()) returns void
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
      insert into pay_cycles (user_id, start_tx, starts_at) values (p_user, r.id, salary_day_start(r.created));
    end if;
  end loop;
end $$;
