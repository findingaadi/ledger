-- Lets a person file one of their own transactions by hand.
-- With p_remember, it becomes a payee rule and everything from that payee is
-- re-sorted; otherwise only this transaction changes and later sorting leaves it alone.
create function file_transaction(
  p_tx text,
  p_envelope uuid default null,
  p_treatment text default 'envelope',   -- envelope | neutral | income
  p_remember boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare t transactions;
begin
  select * into t from transactions where id = p_tx and user_id = auth.uid();
  if not found then raise exception 'not found'; end if;
  if p_treatment not in ('envelope', 'neutral', 'income') or (p_treatment = 'envelope') <> (p_envelope is not null) then
    raise exception 'bad request';
  end if;
  if p_envelope is not null and not exists (select 1 from envelopes where id = p_envelope and user_id = auth.uid()) then
    raise exception 'not found';
  end if;

  -- A payee marked "always ask" keeps asking; income is never remembered.
  if p_remember and p_treatment <> 'income' and t.payee is not null and not exists (
    select 1 from rules where user_id = t.user_id and kind = 'payee' and value = t.payee and treatment = 'ask'
  ) then
    insert into rules (user_id, kind, value, treatment, envelope_id)
    values (t.user_id, 'payee', t.payee, p_treatment, p_envelope)
    on conflict (user_id, kind, value) do update set treatment = excluded.treatment, envelope_id = excluded.envelope_id;
    update transactions set manual = false where id = p_tx;
    perform classify_transactions(t.user_id);
  else
    update transactions set manual = true, status = p_treatment, envelope_id = p_envelope where id = p_tx;
  end if;
end $$;

revoke execute on function file_transaction(text, uuid, text, boolean) from public, anon;
grant execute on function file_transaction(text, uuid, text, boolean) to authenticated;
