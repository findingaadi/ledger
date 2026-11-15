-- Money received by bank transfer always asks. It might be income, or it might
-- be a friend paying back their share, which should go back into the envelope
-- the original payment came from. Salary and other BACS credits stay income,
-- and card refunds still return to their envelope automatically.

create or replace function classify_transactions(p_user uuid default auth.uid()) returns void
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
        when t.amount > 0 and t.scheme in ('payport_faster_payments', 'p2p_payment', 'monzo_to_monzo') then 'unassigned'
        when pr.envelope_id is not null then 'envelope'       -- includes direct debit refunds from that payee
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

create or replace function file_transaction(
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

  -- Never remembered: money coming in, income, and payees marked "always ask".
  if p_remember and t.amount < 0 and p_treatment <> 'income' and t.payee is not null and not exists (
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
