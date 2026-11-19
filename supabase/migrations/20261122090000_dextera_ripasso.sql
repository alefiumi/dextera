-- Dextera, fase 2 – Ripasso: calendario del ripasso a intervalli di ogni struttura (sezione 5 della specifica).
-- Si applica dopo 20261121090000_dextera_percorso.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app che usa questa tabella (funziona anche senza: finché il file non è applicato il calendario
-- resta sul telefono e si invia dopo).
--
-- Solo una tabella nuova: le altre non cambiano. RLS: ognuno legge e scrive solo le proprie righe.
--   review_items  per ogni struttura (chiave della maestria: 'o.femur', 'm.<id>', 'oi.<id>', 'fn.<id>', 'r.<repere>')
--                 l'indice dell'intervallo (0 = 1 giorno … 5 = 60 giorni), il giorno in cui torna e quando è stata ripassata.
-- Unione tra telefoni: vale il ripasso più recente (ripassato_il, l'ora del telefono): un telefono rimasto offline con un
-- calendario vecchio non lo riporta indietro, e un errore fatto dopo (che riporta a 1 giorno) vince su un ripasso di prima.

create table if not exists public.review_items (
  user_id       uuid not null references auth.users (id) on delete cascade,
  item_id       text not null check (char_length(item_id) <= 110 and item_id ~ '^[a-z]{1,2}\.[a-z0-9._-]{1,100}$'),
  intervallo    smallint not null default 0 check (intervallo between 0 and 10),
  scadenza      date not null check (scadenza between date '2026-01-01' and date '2100-01-01'),
  ripassato_il  timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.review_items enable row level security;
revoke all on public.review_items from public, anon, authenticated;
grant select, insert, delete on public.review_items to authenticated;
grant update (user_id, item_id, intervallo, scadenza, ripassato_il) on public.review_items to authenticated;

drop policy if exists "ripasso: si legge il proprio" on public.review_items;
drop policy if exists "ripasso: si aggiunge il proprio" on public.review_items;
drop policy if exists "ripasso: si modifica il proprio" on public.review_items;
drop policy if exists "ripasso: si cancella il proprio" on public.review_items;
create policy "ripasso: si legge il proprio" on public.review_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ripasso: si aggiunge il proprio" on public.review_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ripasso: si modifica il proprio" on public.review_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "ripasso: si cancella il proprio" on public.review_items
  for delete to authenticated using (user_id = (select auth.uid()));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- l'ora del ripasso non può stare nel futuro (al massimo un giorno, per gli orologi sbagliati); in un aggiornamento vince
-- il ripasso più recente: se quello che arriva è più vecchio di quello salvato, la riga resta com'è
create or replace function private.ripasso_unione() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ripassato_il := least(new.ripassato_il, now() + interval '1 day');
  if tg_op = 'UPDATE' then
    if new.ripassato_il < old.ripassato_il then return old; end if;
  end if;
  new.aggiornato_il := now();
  return new;
end $$;
revoke all on function private.ripasso_unione() from public, anon, authenticated;
drop trigger if exists ripasso_unione on public.review_items;
create trigger ripasso_unione before insert or update on public.review_items
  for each row execute function private.ripasso_unione();
