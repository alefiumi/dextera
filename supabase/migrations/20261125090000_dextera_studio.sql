-- Dextera, fase 6 – Altri corsi e percorsi: la scelta di «Cosa studi?» (percorso e corsi) per ogni persona, così vale su tutti i
-- suoi dispositivi.
-- Si applica dopo 20261124090000_dextera_badge.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app (funziona anche senza: finché il file non è applicato la scelta resta sul telefono e parte dopo;
-- il riquadro Account del profilo dice che manca il file).
--
-- Le tabelle di BodyMania non cambiano. Tabella nuova:
--   dextera_studio   per ogni persona: percorso scelto (id di un file di content/percorsi/, es. 'base', 'ucbm') e corsi scelti
--                    (id dei corsi di content/mappa.json; vuoto = tutti). La legge e la scrive solo la persona.
-- RLS con (select auth.uid()) come in 20261120100000_prestazioni_rls.sql; nessun update senza where.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.dextera_studio (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  percorso       text not null default 'base' check (percorso ~ '^[a-z0-9-]{1,40}$'),
  corsi          text[] not null default '{}' check (cardinality(corsi) <= 20 and
                   (cardinality(corsi) = 0 or array_to_string(corsi, ',', '?') ~ '^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40})*$')),
  aggiornato_il  timestamptz not null default now()
);
alter table public.dextera_studio enable row level security;
revoke all on public.dextera_studio from public, anon, authenticated;
grant select on public.dextera_studio to authenticated;
grant insert (user_id, percorso, corsi, aggiornato_il) on public.dextera_studio to authenticated;
grant update (user_id, percorso, corsi, aggiornato_il) on public.dextera_studio to authenticated;
grant delete on public.dextera_studio to authenticated;

drop policy if exists "studio dextera: si legge il proprio" on public.dextera_studio;
drop policy if exists "studio dextera: si aggiunge il proprio" on public.dextera_studio;
drop policy if exists "studio dextera: si modifica il proprio" on public.dextera_studio;
drop policy if exists "studio dextera: si cancella il proprio" on public.dextera_studio;
create policy "studio dextera: si legge il proprio" on public.dextera_studio
  for select to authenticated using (user_id = (select auth.uid()));
create policy "studio dextera: si aggiunge il proprio" on public.dextera_studio
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "studio dextera: si modifica il proprio" on public.dextera_studio
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "studio dextera: si cancella il proprio" on public.dextera_studio
  for delete to authenticated using (user_id = (select auth.uid()));

-- corsi senza doppioni (nell'ordine scelto); la data non va nel futuro (vince la scelta più recente tra i dispositivi)
create or replace function private.dextera_studio() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.corsi := coalesce(array(
    select v from unnest(new.corsi) with ordinality as x(v, n) group by v order by min(n)), '{}');
  if new.aggiornato_il > now() then new.aggiornato_il := now(); end if;
  return new;
end $$;
revoke all on function private.dextera_studio() from public, anon, authenticated;
drop trigger if exists dextera_studio on public.dextera_studio;
create trigger dextera_studio before insert or update on public.dextera_studio
  for each row execute function private.dextera_studio();
