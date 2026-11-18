-- BodyMania: regole di accesso più veloci (avvisi "Auth RLS Initialization Plan" del Performance Advisor di Supabase).
-- Si applica dopo gli altri file: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
--
-- Le regole restano le stesse: cambia solo come sono scritte. auth.uid() dentro una regola viene ricalcolato per ogni riga;
-- (select auth.uid()) una volta sola per richiesta. Più due indici sulle chiavi esterne che non ne avevano uno.

-- ---------- profili ----------
alter policy "profili attivi visibili agli iscritti" on public.profiles
  using (deleted_at is null or id = (select auth.uid()));
alter policy "ognuno modifica il proprio profilo" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- partite ----------
alter policy "ognuno vede le proprie partite" on public.game_results
  using (user_id = (select auth.uid()));
alter policy "ognuno registra le proprie partite" on public.game_results
  with check (user_id = (select auth.uid()));

-- ---------- maestria ----------
alter policy "ognuno legge la propria maestria" on public.mastery
  using (user_id = (select auth.uid()));
alter policy "ognuno scrive la propria maestria" on public.mastery
  with check (user_id = (select auth.uid()));
alter policy "ognuno aggiorna la propria maestria" on public.mastery
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- amicizie ----------
alter policy "amicizie visibili ai due" on public.friendships
  using ((select auth.uid()) in (user_id, friend_id));
alter policy "richiesta solo a proprio nome" on public.friendships
  with check (user_id = (select auth.uid()) and status = 'pending'
    and exists (select 1 from public.public_profiles p where p.id = friend_id));
alter policy "accetta solo chi riceve" on public.friendships
  using (friend_id = (select auth.uid()) and status = 'pending')
  with check (friend_id = (select auth.uid()) and status = 'accepted');
alter policy "uno dei due la toglie" on public.friendships
  using ((select auth.uid()) in (user_id, friend_id));

-- ---------- badge ----------
alter policy "ognuno vede i propri badge" on public.badge_assertions
  using (user_id = (select auth.uid()));
alter policy "ognuno registra i propri badge" on public.badge_assertions
  with check (user_id = (select auth.uid()));

-- ---------- indici sulle chiavi esterne ----------
create index if not exists friendships_friend_id on public.friendships (friend_id);
create index if not exists badge_assertions_badge_id on public.badge_assertions (badge_id);
