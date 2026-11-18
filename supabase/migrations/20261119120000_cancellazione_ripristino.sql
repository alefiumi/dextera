-- BodyMania: cancellazione dell'account in due tempi, con ripristino su richiesta.
-- Si applica dopo 20261119100000_privacy_sicurezza.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
--
-- "Elimina l'account" nell'app ora:
--   1. blocca subito l'account (non si può più accedere: auth.users.banned_until) e chiude le sessioni;
--   2. lo toglie da classifiche e ricerca e cancella le sue amicizie;
--   3. conserva per 30 giorni profilo, partite, maestria e badge;
--   4. dopo 30 giorni cancella tutto per sempre (lavoro pianificato con pg_cron, ogni notte alle 3:17 UTC).
-- Entro i 30 giorni l'amministratore può ripristinare l'account su richiesta della persona (vedi sotto).
-- È dichiarato nell'informativa (privacy.html, punti 7 e 8).
--
-- Strumenti per l'amministratore: stanno nello schema "admin", che l'API dell'app non espone e che anon e authenticated
-- non possono usare. Si usano solo dal SQL Editor di Supabase:
--   select * from admin.account_in_cancellazione;              -- chi ha chiesto la cancellazione e quando sparirà
--   select admin.ripristina_account('persona@esempio.it');     -- riattiva l'account (le amicizie non tornano)
--   select admin.cancella_definitivamente('persona@esempio.it'); -- cancella subito, senza aspettare i 30 giorni
--   select admin.pulisci_cancellati();                         -- cancella tutti quelli oltre i 30 giorni (lo fa già pg_cron)

-- ---------- stato "in cancellazione" ----------
alter table public.profiles add column if not exists deleted_at timestamptz;

-- classifiche e ricerca: senza gli account in cancellazione
create or replace view public.leaderboard with (security_invoker = false) as
  select id, username, xp,
    case when last_day >= current_date - 1 then streak else 0 end as streak,
    avatar
  from public.profiles where username is not null and deleted_at is null;

create or replace view public.leaderboard_friends with (security_invoker = false) as
  select p.id, p.username, p.xp,
    case when p.last_day >= current_date - 1 then p.streak else 0 end as streak,
    p.avatar
  from public.profiles p
  where p.username is not null and p.deleted_at is null and auth.uid() is not null and (
    p.id = auth.uid() or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = p.id) or (f.friend_id = auth.uid() and f.user_id = p.id))));

create or replace view public.public_profiles with (security_invoker = false) as
  select id, username, avatar from public.profiles where username is not null and deleted_at is null;

revoke all on public.leaderboard, public.leaderboard_friends, public.public_profiles from anon, public;
grant select on public.leaderboard, public.leaderboard_friends, public.public_profiles to authenticated;

-- richieste di amicizia solo verso account attivi con un nome (la vista vede tutti i profili, la tabella no:
-- chi chiede legge solo il proprio profilo)
drop policy if exists "richiesta solo a proprio nome" on public.friendships;
create policy "richiesta solo a proprio nome" on public.friendships
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending'
    and exists (select 1 from public.public_profiles p where p.id = friend_id));

-- ---------- richiesta di cancellazione (dall'app) ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'serve una sessione'; end if;
  update public.profiles set deleted_at = now() where id = u and deleted_at is null;
  delete from public.friendships where u in (user_id, friend_id);
  update auth.users set banned_until = 'infinity' where id = u;
  delete from auth.sessions where user_id = u;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- strumenti dell'amministratore ----------
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace view admin.account_in_cancellazione as
  select u.email, p.username, p.deleted_at as richiesta_il, p.deleted_at + interval '30 days' as cancellazione_definitiva_il
  from public.profiles p join auth.users u on u.id = p.id
  where p.deleted_at is not null order by p.deleted_at;

create or replace function admin.ripristina_account(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  select id into u from auth.users where lower(email) = lower(p_email);
  if u is null then return 'nessun account con questa email (forse già cancellato definitivamente)'; end if;
  update public.profiles set deleted_at = null where id = u;
  update auth.users set banned_until = null where id = u;
  return 'account ripristinato: la persona può accedere di nuovo';
end $$;

create or replace function admin.cancella_definitivamente(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from auth.users where lower(email) = lower(p_email);
  get diagnostics n = row_count;
  return case when n > 0 then 'account cancellato per sempre' else 'nessun account con questa email' end;
end $$;

create or replace function admin.pulisci_cancellati() returns integer
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from auth.users where id in (select id from public.profiles where deleted_at < now() - interval '30 days');
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on all functions in schema admin from public, anon, authenticated;
revoke all on all tables in schema admin from public, anon, authenticated;

-- ---------- pulizia automatica ogni notte (pg_cron) ----------
-- Se pg_cron non è disponibile il resto del file vale lo stesso: si può attivare da Database → Extensions e rieseguire.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('bodymania-pulisci-cancellati', '17 3 * * *', 'select admin.pulisci_cancellati()');
  else
    raise notice 'pg_cron non disponibile: la pulizia va fatta a mano con select admin.pulisci_cancellati();';
  end if;
end $$;
