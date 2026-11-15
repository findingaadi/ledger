-- The budgeting maths for one pay cycle, kept in one place.
-- All three functions run as the caller, so row level security still applies.

-- Every envelope with what it was given and what was spent from it in the cycle.
-- Refunds count as negative spending.
create function cycle_envelopes(p_cycle uuid)
returns table (id uuid, name text, kind text, sort int, allocated bigint, spent bigint)
language sql stable set search_path = public as $$
  select e.id, e.name, e.kind, e.sort,
    coalesce(a.amount, 0)::bigint,
    coalesce((
      select -sum(t.amount) from transactions t
      where t.envelope_id = e.id and t.status = 'envelope' and t.created >= c.starts_at
        and t.created < coalesce(
          (select min(n.starts_at) from pay_cycles n where n.user_id = c.user_id and n.starts_at > c.starts_at), 'infinity')
    ), 0)::bigint
  from pay_cycles c
  join envelopes e on e.user_id = c.user_id
  left join allocations a on a.cycle_id = c.id and a.envelope_id = e.id
  where c.id = p_cycle
$$;

-- What is left to spend freely: the guilt-free envelope, minus overspending in
-- every other envelope. Once a cycle is over, unspent money in flexible
-- envelopes is added back.
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

  -- A shortfall in the last cycle comes off the top of this one. Only cycles that were budgeted can have one.
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
        'id', id, 'name', name, 'kind', kind, 'allocated', allocated, 'spent', spent) order by sort, name), '[]'::jsonb)
      from cycle_envelopes(p_cycle))
  );
end $$;

revoke execute on function cycle_envelopes(uuid), cycle_guilt_free_left(uuid, boolean), cycle_summary(uuid) from public, anon;
grant execute on function cycle_envelopes(uuid), cycle_guilt_free_left(uuid, boolean), cycle_summary(uuid) to authenticated, service_role;
