-- People choose which envelopes are in each pay cycle, and the amount they
-- save for an envelope becomes its default for the next cycle.

alter table allocations add column included boolean not null default true;

-- Same as before, plus whether the envelope is in this cycle. A cycle with
-- nothing saved yet has every envelope in.
drop function cycle_summary(uuid);
drop function cycle_guilt_free_left(uuid, boolean);
drop function cycle_envelopes(uuid);

create function cycle_envelopes(p_cycle uuid)
returns table (id uuid, name text, kind text, sort int, allocated bigint, spent bigint, included boolean)
language sql stable set search_path = public as $$
  select e.id, e.name, e.kind, e.sort,
    coalesce(a.amount, 0)::bigint,
    (coalesce((
      select -sum(t.amount) from transactions t
      where t.envelope_id = e.id and t.status = 'envelope' and t.created >= c.starts_at
        and t.created < coalesce(
          (select min(n.starts_at) from pay_cycles n where n.user_id = c.user_id and n.starts_at > c.starts_at), 'infinity')
    ), 0)
    + coalesce((select sum(m.amount) from manual_spend m where m.cycle_id = c.id and m.envelope_id = e.id), 0))::bigint,
    coalesce(a.included, true)
  from pay_cycles c
  join envelopes e on e.user_id = c.user_id
  left join allocations a on a.cycle_id = c.id and a.envelope_id = e.id
  where c.id = p_cycle
$$;

create function cycle_guilt_free_left(p_cycle uuid, p_closed boolean) returns bigint
language sql stable set search_path = public as $$
  select (
      coalesce(sum(allocated - spent) filter (where kind = 'guilt_free'), 0)
    - coalesce(sum(greatest(0, spent - allocated)) filter (where kind <> 'guilt_free'), 0)
    + case when p_closed then coalesce(sum(greatest(0, allocated - spent)) filter (where kind = 'flexible'), 0) else 0 end
  )::bigint
  from cycle_envelopes(p_cycle)
$$;

create function cycle_summary(p_cycle uuid) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  c pay_cycles;
  v_next timestamptz;
  v_prev uuid;
  v_income bigint;
  v_carried bigint := 0;
  v_assigned boolean;
begin
  select * into c from pay_cycles where id = p_cycle;
  if not found then return null; end if;
  select min(starts_at) into v_next from pay_cycles where user_id = c.user_id and starts_at > c.starts_at;
  select id into v_prev from pay_cycles where user_id = c.user_id and starts_at < c.starts_at order by starts_at desc limit 1;
  v_assigned := exists (select 1 from allocations where cycle_id = p_cycle);

  if v_prev is not null and exists (select 1 from allocations where cycle_id = v_prev) then
    v_carried := greatest(0, -cycle_guilt_free_left(v_prev, true));
  end if;

  select coalesce(sum(amount), 0) into v_income from (
    select amount from transactions
      where user_id = c.user_id and status = 'income' and created >= c.starts_at and created < coalesce(v_next, 'infinity')
    union all
    select amount from manual_income where cycle_id = p_cycle
  ) i;

  return jsonb_build_object(
    'closed', v_next is not null,
    'assigned', v_assigned,
    'income', v_income,
    'carried_in', v_carried,
    'left_to_assign', v_income - v_carried - (select coalesce(sum(amount), 0) from allocations where cycle_id = p_cycle),
    'guilt_free_left', case when v_assigned then cycle_guilt_free_left(p_cycle, v_next is not null) end,
    'unfiled', (select count(*) from transactions
      where user_id = c.user_id and status = 'unassigned' and created >= c.starts_at and created < coalesce(v_next, 'infinity')),
    'envelopes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'kind', kind, 'allocated', allocated, 'spent', spent, 'included', included) order by sort, name), '[]'::jsonb)
      from cycle_envelopes(p_cycle))
  );
end $$;

-- Saves a cycle's budget in one go: which envelopes are in, and how much each
-- gets. Each included envelope's amount becomes its default for next time.
-- p_rows: [{"envelope_id": "...", "amount": 12345, "included": true}, ...]
create function save_allocations(p_cycle uuid, p_rows jsonb) returns void
language plpgsql set search_path = public as $$
begin
  insert into allocations (cycle_id, envelope_id, user_id, amount, included)
  select p_cycle, (r ->> 'envelope_id')::uuid, auth.uid(),
    case when (r ->> 'included')::boolean then (r ->> 'amount')::bigint else 0 end,
    (r ->> 'included')::boolean
  from jsonb_array_elements(p_rows) r
  on conflict (cycle_id, envelope_id) do update set amount = excluded.amount, included = excluded.included;

  update envelopes e set default_amount = (r ->> 'amount')::bigint
  from jsonb_array_elements(p_rows) r
  where e.id = (r ->> 'envelope_id')::uuid and (r ->> 'included')::boolean
    and e.default_amount is distinct from (r ->> 'amount')::bigint;
end $$;

revoke execute on function cycle_envelopes(uuid), cycle_guilt_free_left(uuid, boolean), cycle_summary(uuid), save_allocations(uuid, jsonb) from public, anon;
grant execute on function cycle_envelopes(uuid), cycle_guilt_free_left(uuid, boolean), cycle_summary(uuid), save_allocations(uuid, jsonb) to authenticated, service_role;
