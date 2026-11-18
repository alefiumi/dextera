-- BodyMania: privacy (GDPR) e sicurezza. Si applica dopo gli altri file: SQL Editor → incolla tutto il file → Run.
-- Si può rieseguire: ogni passo è scritto per non fallire se è già stato applicato.
--
-- Cosa cambia:
-- 1. Ognuno legge solo il proprio profilo completo. Degli altri si vedono soltanto nome utente, foto, XP e serie,
--    attraverso le viste leaderboard, leaderboard_friends e public_profiles. Presentazione, ruolo, risposte giuste e
--    sbagliate, date restano private. L'email non è mai in queste tabelle: sta in auth.users, che l'app non può leggere;
--    la vedono solo gli amministratori del progetto dal pannello di Supabase.
-- 2. Ognuno può modificare solo alcune colonne del proprio profilo (non l'id né le date di creazione).
-- 3. Amicizie: chi riceve una richiesta può solo cambiarne lo stato in "accettata". Prima poteva cambiare anche
--    user_id e creare un'amicizia accettata con un terzo senza il suo consenso.
-- 4. I badge di ognuno sono visibili solo a lui.
-- 5. Limiti sui valori che arrivano dall'app (lunghezze, formato della foto), contro dati malformati o enormi.
-- 6. Diritto alla cancellazione: la funzione delete_my_account() cancella l'account e, a cascata, profilo,
--    partite, maestria, amicizie e badge. Non c'è nessun ruolo di amministratore nelle tabelle: nessun utente
--    dell'app ha privilegi sugli altri.
--
-- Contro la SQL injection: l'app non scrive mai SQL. Parla con Supabase attraverso PostgREST, che passa ogni valore
-- come parametro; le regole qui sotto valgono comunque anche per chi usasse la chiave pubblica fuori dall'app.

-- ---------- 1. profili: lettura solo del proprio ----------
drop policy if exists "profili visibili agli iscritti" on public.profiles;
drop policy if exists "ognuno legge il proprio profilo" on public.profiles;
create policy "ognuno legge il proprio profilo" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Le viste pubbliche girano con i permessi del proprietario (security_invoker = false), quindi attraversano la regola
-- qui sopra, ma espongono solo le colonne elencate. Sono leggibili solo dagli iscritti con una sessione.
create or replace view public.leaderboard with (security_invoker = false) as
  select id, username, xp,
    case when last_day >= current_date - 1 then streak else 0 end as streak,
    avatar
  from public.profiles where username is not null;

create or replace view public.leaderboard_friends with (security_invoker = false) as
  select p.id, p.username, p.xp,
    case when p.last_day >= current_date - 1 then p.streak else 0 end as streak,
    p.avatar
  from public.profiles p
  where p.username is not null and auth.uid() is not null and (
    p.id = auth.uid() or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = p.id) or (f.friend_id = auth.uid() and f.user_id = p.id))));

-- nome e foto per la ricerca degli amici e per le richieste
create or replace view public.public_profiles with (security_invoker = false) as
  select id, username, avatar from public.profiles where username is not null;

revoke all on public.leaderboard, public.leaderboard_friends, public.public_profiles from anon, public;
grant select on public.leaderboard, public.leaderboard_friends, public.public_profiles to authenticated;

-- ---------- 2. profili: colonne modificabili ----------
revoke insert, update, delete on public.profiles from authenticated, anon;
grant update (username, xp, streak, last_day, ok, ko, avatar, role, bio, profile_at, updated_at)
  on public.profiles to authenticated;

-- ---------- 3. amicizie: si cambia solo lo stato ----------
revoke update on public.friendships from authenticated, anon;
grant update (status) on public.friendships to authenticated;
drop policy if exists "accetta solo chi riceve" on public.friendships;
create policy "accetta solo chi riceve" on public.friendships
  for update to authenticated using (friend_id = auth.uid() and status = 'pending')
  with check (friend_id = auth.uid() and status = 'accepted');

-- ---------- 4. badge: visibili solo a chi li ha ----------
drop policy if exists "badge assegnati visibili agli iscritti" on public.badge_assertions;
drop policy if exists "ognuno vede i propri badge" on public.badge_assertions;
create policy "ognuno vede i propri badge" on public.badge_assertions
  for select to authenticated using (user_id = auth.uid());

-- ---------- 5. limiti sui valori ----------
-- foto: solo JPEG, PNG o WebP in base64 (l'app salva JPEG 128×128, circa 10 KB)
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles drop constraint if exists profiles_avatar_formato;
alter table public.profiles add constraint profiles_avatar_formato check (avatar is null or (
  avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and length(avatar) <= 60000));
alter table public.profiles drop constraint if exists profiles_limiti;
alter table public.profiles add constraint profiles_limiti check (
  xp <= 100000000 and streak <= 100000 and ok between 0 and 100000000 and ko between 0 and 100000000);

alter table public.game_results drop constraint if exists game_results_limiti;
alter table public.game_results add constraint game_results_limiti check (
  char_length(module) <= 20 and char_length(mode) <= 30 and score <= 1000 and total <= 1000 and xp <= 10000);

alter table public.mastery drop constraint if exists mastery_limiti;
alter table public.mastery add constraint mastery_limiti check (char_length(item_id) <= 120);

-- ---------- 6. cancellazione dell'account (diritto all'oblio) ----------
-- Cancella l'utente da auth.users; le chiavi esterne "on delete cascade" tolgono profilo, partite, maestria,
-- amicizie e badge. Ognuno può cancellare solo sé stesso.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'serve una sessione'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
