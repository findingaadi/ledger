-- "Guilt-free" is now called "Fun money".
update envelopes set name = 'Fun money' where kind = 'guilt_free' and name = 'Guilt-free';

create or replace function seed_defaults(p_user uuid default auth.uid()) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and p_user is distinct from auth.uid() then raise exception 'not allowed'; end if;
  if exists (select 1 from envelopes where user_id = p_user) then return; end if;

  insert into envelopes (user_id, name, kind, sort) values
    (p_user, 'Bills', 'bill', 10), (p_user, 'Groceries', 'flexible', 20), (p_user, 'Transport', 'flexible', 30),
    (p_user, 'Eating out', 'flexible', 40), (p_user, 'Shopping', 'flexible', 50), (p_user, 'Holidays', 'flexible', 60),
    (p_user, 'Entertainment', 'flexible', 70), (p_user, 'Fun money', 'guilt_free', 999);

  insert into rules (user_id, kind, value, envelope_id)
  select p_user, 'category', m.category, e.id
  from (values ('bills', 'Bills'), ('groceries', 'Groceries'), ('transport', 'Transport'), ('eating_out', 'Eating out'),
               ('shopping', 'Shopping'), ('holidays', 'Holidays'), ('entertainment', 'Entertainment')) m(category, envelope)
  join envelopes e on e.user_id = p_user and e.name = m.envelope;
end $$;
