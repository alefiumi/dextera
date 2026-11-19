-- Dextera, fase 5 – Profilo e competenze: gli 8 badge nuovi (sezione 6 della specifica) e la scheda del profilo che vedono gli
-- amici (copertina, badge in vetrina, titolo scelto).
-- Si applica dopo 20261123090000_dextera_flotta.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app (funziona anche senza: finché il file non è applicato i badge nuovi, la copertina e il titolo restano
-- sul telefono e partono dopo; il profilo dice che manca il file).
--
-- Le tabelle di BodyMania non cambiano: a badge_classes si aggiungono solo righe (stessi id e testi di js/badges.js, BADGES5).
-- Tabella nuova:
--   dextera_profili   per ogni persona: copertina (una delle 6 della galleria), fino a 3 badge in vetrina (solo badge che la persona
--                     ha davvero in badge_assertions: gli altri si tolgono da soli), titolo scelto (testo e id: 'liv:3', 'esp:<pianeta>',
--                     'badge:<id>'). La leggono la persona e i suoi amici (amicizia accettata); la scrive solo la persona.
-- RLS con (select auth.uid()) come in 20261120100000_prestazioni_rls.sql.

-- ---------- 1. badge nuovi ----------
insert into public.badge_classes (id, name, description, criteria, image) values
  ('sat1', 'Primo satellite acceso', 'Accendi il tuo primo satellite', 'Accendi il tuo primo satellite', '🛰️'),
  ('sapevo', 'Lo sapevo già', 'Supera una prova «Lo so già»', 'Supera una prova «Lo so già»', '💡'),
  ('pianeta1', 'Primo pianeta', 'Supera l''esame di un pianeta', 'Supera l''esame di un pianeta', '🪐'),
  ('corso1', 'Primo corso', 'Completa un corso: tutti i suoi pianeti con l''esame superato', 'Completa un corso: tutti i suoi pianeti con l''esame superato', '☀️'),
  ('sistema', 'Sistema completo', 'Rendi brillanti tutti i satelliti di un pianeta', 'Rendi brillanti tutti i satelliti di un pianeta', '✨'),
  ('costante', 'Ripasso costante', 'Finisci 10 Ripassi del giorno', 'Finisci 10 Ripassi del giorno', '🔁'),
  ('stagione', 'Vincitore di stagione', 'Porta punti alla casata che vince una stagione', 'Porta punti alla casata che vince una stagione', '🏆'),
  ('equipaggio', 'Obiettivo d''equipaggio', 'Raggiungi con il tuo equipaggio l''obiettivo della settimana', 'Raggiungi con il tuo equipaggio l''obiettivo della settimana', '🤝')
on conflict (id) do update set name = excluded.name, description = excluded.description,
  criteria = excluded.criteria, image = excluded.image;

-- ---------- 2. scheda del profilo per gli amici ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.dextera_profili (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  copertina      text not null default 'notte' check (copertina in ('notte', 'aurora', 'tramonto', 'oceano', 'foresta', 'sole')),
  vetrina        text[] not null default '{}' check (cardinality(vetrina) <= 3),
  titolo         text check (titolo is null or char_length(titolo) between 1 and 80),
  titolo_id      text check (titolo_id is null or titolo_id ~ '^(liv|esp|badge):[A-Za-z0-9._-]{1,60}$'),
  aggiornato_il  timestamptz not null default now()
);
alter table public.dextera_profili enable row level security;
revoke all on public.dextera_profili from public, anon, authenticated;
grant select on public.dextera_profili to authenticated;
grant insert (user_id, copertina, vetrina, titolo, titolo_id, aggiornato_il) on public.dextera_profili to authenticated;
grant update (user_id, copertina, vetrina, titolo, titolo_id, aggiornato_il) on public.dextera_profili to authenticated;
grant delete on public.dextera_profili to authenticated;

drop policy if exists "profilo dextera: si legge il proprio e degli amici" on public.dextera_profili;
drop policy if exists "profilo dextera: si aggiunge il proprio" on public.dextera_profili;
drop policy if exists "profilo dextera: si modifica il proprio" on public.dextera_profili;
drop policy if exists "profilo dextera: si cancella il proprio" on public.dextera_profili;
create policy "profilo dextera: si legge il proprio e degli amici" on public.dextera_profili
  for select to authenticated using (
    user_id = (select auth.uid()) or exists (
      select 1 from public.friendships f where f.status = 'accepted' and (
        (f.user_id = (select auth.uid()) and f.friend_id = dextera_profili.user_id) or
        (f.friend_id = (select auth.uid()) and f.user_id = dextera_profili.user_id))));
create policy "profilo dextera: si aggiunge il proprio" on public.dextera_profili
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profilo dextera: si modifica il proprio" on public.dextera_profili
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profilo dextera: si cancella il proprio" on public.dextera_profili
  for delete to authenticated using (user_id = (select auth.uid()));

-- in vetrina restano solo i badge che la persona ha (senza doppioni, nell'ordine scelto); la data non va nel futuro
create or replace function private.dextera_profilo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.vetrina := coalesce(array(
    select v from unnest(new.vetrina) with ordinality as x(v, n)
    where exists (select 1 from public.badge_assertions a where a.user_id = new.user_id and a.badge_id = x.v)
    group by v order by min(n)), '{}');
  if new.aggiornato_il > now() then new.aggiornato_il := now(); end if;
  return new;
end $$;
revoke all on function private.dextera_profilo() from public, anon, authenticated;
drop trigger if exists dextera_profilo on public.dextera_profili;
create trigger dextera_profilo before insert or update on public.dextera_profili
  for each row execute function private.dextera_profilo();
