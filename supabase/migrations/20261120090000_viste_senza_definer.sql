-- BodyMania: classifiche e ricerca senza viste "security definer" (avviso critico del Security Advisor di Supabase).
-- Si applica dopo gli altri file: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
--
-- Prima: le viste leggevano i profili con i permessi del proprietario e mostravano solo alcune colonne.
-- Ora: le viste usano i permessi di chi legge (security_invoker) e la protezione sta nella tabella:
--   - righe: ognuno vede i profili attivi e il proprio (anche se in cancellazione);
--   - colonne: degli altri si possono leggere solo id, nome utente, foto, XP, serie e date che servono alle classifiche.
--     Presentazione, ruolo, risposte giuste e sbagliate, date del profilo e nome conservato restano illeggibili;
--   - il proprio profilo completo si legge con la funzione my_profile(), che restituisce solo quello di chi la chiama.

-- ---------- righe ----------
drop policy if exists "ognuno legge il proprio profilo" on public.profiles;
drop policy if exists "profili attivi visibili agli iscritti" on public.profiles;
create policy "profili attivi visibili agli iscritti" on public.profiles
  for select to authenticated using (deleted_at is null or id = auth.uid());

-- ---------- colonne ----------
revoke select on public.profiles from authenticated, anon;
grant select (id, username, xp, streak, last_day, avatar, deleted_at) on public.profiles to authenticated;

-- ---------- viste con i permessi di chi legge ----------
alter view public.leaderboard set (security_invoker = true);
alter view public.leaderboard_friends set (security_invoker = true);
alter view public.public_profiles set (security_invoker = true);
alter view admin.account_in_cancellazione set (security_invoker = true); -- la usa solo l'amministratore dal SQL Editor

-- ---------- il proprio profilo completo ----------
create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
