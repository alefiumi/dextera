-- BodyMania: chi chiede la cancellazione dell'account libera subito il nome utente.
-- Si applica dopo 20261119120000_cancellazione_ripristino.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Serve, per esempio, quando si importano i dati di un vecchio account in uno nuovo e si elimina il vecchio: il nuovo deve
-- poter prendere lo stesso nome. Il nome resta in deleted_username: il ripristino lo restituisce se nel frattempo è libero.

alter table public.profiles add column if not exists deleted_username text;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'serve una sessione'; end if;
  update public.profiles set deleted_at = now(), deleted_username = coalesce(username, deleted_username), username = null
    where id = u and deleted_at is null;
  delete from public.friendships where u in (user_id, friend_id);
  update auth.users set banned_until = 'infinity' where id = u;
  delete from auth.sessions where user_id = u;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace view admin.account_in_cancellazione as
  select u.email, p.deleted_username as username, p.deleted_at as richiesta_il, p.deleted_at + interval '30 days' as cancellazione_definitiva_il
  from public.profiles p join auth.users u on u.id = p.id
  where p.deleted_at is not null order by p.deleted_at;

create or replace function admin.ripristina_account(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid; nome text; libero boolean;
begin
  select id into u from auth.users where lower(email) = lower(p_email);
  if u is null then return 'nessun account con questa email (forse già cancellato definitivamente)'; end if;
  select deleted_username into nome from public.profiles where id = u;
  libero := nome is not null and not exists (select 1 from public.profiles where username = nome);
  update public.profiles set deleted_at = null, username = case when libero then nome else username end, deleted_username = null where id = u;
  update auth.users set banned_until = null where id = u;
  return 'account ripristinato: la persona può accedere di nuovo'
    || case when nome is not null and not libero then ' (il nome ' || nome || ' è stato preso da un altro: ne sceglierà uno nuovo)' else '' end;
end $$;

revoke all on all functions in schema admin from public, anon, authenticated;
revoke all on all tables in schema admin from public, anon, authenticated;
