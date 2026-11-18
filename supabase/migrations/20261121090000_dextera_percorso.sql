-- Dextera, fase 1 – Percorso minimo: progressi del percorso, impostazioni e segnalazioni di errore.
-- Si applica dopo gli altri file: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app che usa queste tabelle (funziona anche senza: finché il file non è applicato i dati
-- del percorso e le segnalazioni restano in coda sul telefono).
--
-- Solo tabelle nuove: le tabelle di BodyMania non cambiano. Regole di accesso per riga (RLS) su ogni tabella;
-- ognuno legge e scrive solo i propri dati; (select auth.uid()) come in 20261120100000_prestazioni_rls.sql.
--   path_progress       stato e stelle di ogni nodo del percorso (passo, satellite, pianeta)
--   dextera_settings    obiettivo del giorno, scudi della serie, date dell'esame, percorso e pianeta scelti
--   error_reports       «Segnala un errore»: id del dato di testi/, nota, valore mostrato
--   error_report_flags  per ogni dato, quante persone diverse lo hanno segnalato (si legge solo da 2 in su):
--                       l'app toglie quei dati dalle lezioni finché un docente non li ricontrolla.
--                       La tiene aggiornata un trigger; nessuno la scrive dall'app.
-- Una segnalazione si chiude dal SQL Editor (lo schema admin non è esposto dall'API):
--   select * from admin.segnalazioni;                                                  -- elenco delle aperte
--   update public.error_reports set stato = 'corretta' where data_id = '<id del dato>'; -- oppure 'respinta'

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- ---------- 1. path_progress ----------
create table if not exists public.path_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  node_id       text not null check (node_id ~ '^[a-z0-9-]{1,40}(\.[0-9]{1,2})?$'),
  stato         text not null default 'iniziato' check (stato in ('iniziato', 'fatto', 'acceso')),
  stelle        smallint not null default 0 check (stelle between 0 and 3),
  fatto_il      timestamptz,
  aggiornato_il timestamptz not null default now(),
  primary key (user_id, node_id)
);
alter table public.path_progress enable row level security;
revoke all on public.path_progress from public, anon, authenticated;
grant select, insert, delete on public.path_progress to authenticated;
grant update (user_id, node_id, stato, stelle, fatto_il) on public.path_progress to authenticated;

drop policy if exists "percorso: si legge il proprio" on public.path_progress;
drop policy if exists "percorso: si aggiunge il proprio" on public.path_progress;
drop policy if exists "percorso: si modifica il proprio" on public.path_progress;
drop policy if exists "percorso: si cancella il proprio" on public.path_progress;
create policy "percorso: si legge il proprio" on public.path_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "percorso: si aggiunge il proprio" on public.path_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "percorso: si modifica il proprio" on public.path_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "percorso: si cancella il proprio" on public.path_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- Unione tra telefoni: vale il valore più avanzato (stato e stelle più alti, prima data di completamento),
-- così un telefono rimasto offline con dati vecchi non riporta indietro i progressi.
create or replace function private.percorso_unione() returns trigger
language plpgsql set search_path = '' as $$
declare
  r_old int := case old.stato when 'acceso' then 3 when 'fatto' then 2 else 1 end;
  r_new int := case new.stato when 'acceso' then 3 when 'fatto' then 2 else 1 end;
begin
  if r_old > r_new then new.stato := old.stato; end if;
  new.stelle := greatest(new.stelle, old.stelle);
  new.fatto_il := case when old.fatto_il is null then new.fatto_il when new.fatto_il is null then old.fatto_il
                       else least(old.fatto_il, new.fatto_il) end;
  new.aggiornato_il := now();
  return new;
end $$;
revoke all on function private.percorso_unione() from public, anon, authenticated;
drop trigger if exists percorso_unione on public.path_progress;
create trigger percorso_unione before update on public.path_progress
  for each row execute function private.percorso_unione();

-- ---------- 2. dextera_settings ----------
create table if not exists public.dextera_settings (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  obiettivo     smallint not null default 60 check (obiettivo in (30, 60, 120)),
  scudi         smallint not null default 0 check (scudi between 0 and 2),
  date_esame    jsonb not null default '{}'::jsonb
                check (jsonb_typeof(date_esame) = 'object' and pg_column_size(date_esame) <= 2000),
  percorso      text not null default 'base' check (percorso ~ '^[a-z0-9-]{1,30}$'),
  pianeta       text check (pianeta is null or pianeta ~ '^[a-z0-9-]{1,40}$'),
  aggiornato_il timestamptz not null default now()
);
alter table public.dextera_settings enable row level security;
revoke all on public.dextera_settings from public, anon, authenticated;
grant select, insert on public.dextera_settings to authenticated;
grant update (user_id, obiettivo, scudi, date_esame, percorso, pianeta, aggiornato_il) on public.dextera_settings to authenticated;

drop policy if exists "impostazioni: si leggono le proprie" on public.dextera_settings;
drop policy if exists "impostazioni: si aggiungono le proprie" on public.dextera_settings;
drop policy if exists "impostazioni: si modificano le proprie" on public.dextera_settings;
create policy "impostazioni: si leggono le proprie" on public.dextera_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "impostazioni: si aggiungono le proprie" on public.dextera_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "impostazioni: si modificano le proprie" on public.dextera_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- 3. error_reports ----------
-- id generato sul telefono (la stessa segnalazione inviata due volte resta una); stato e data li mette il server.
create table if not exists public.error_reports (
  id        uuid primary key,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data_id   text not null check (char_length(data_id) <= 120 and data_id ~ '^[a-z]+(\.[a-z0-9_-]+){2,4}$'),
  nota      text not null default '' check (char_length(nota) <= 500),
  valore    text not null default '' check (char_length(valore) <= 1000),
  stato     text not null default 'aperta' check (stato in ('aperta', 'corretta', 'respinta')),
  creato_il timestamptz not null default now()
);
create index if not exists error_reports_dato on public.error_reports (data_id) where stato = 'aperta';
create index if not exists error_reports_utente on public.error_reports (user_id, creato_il);
alter table public.error_reports enable row level security;
revoke all on public.error_reports from public, anon, authenticated;
grant select on public.error_reports to authenticated;
grant insert (id, user_id, data_id, nota, valore) on public.error_reports to authenticated;

drop policy if exists "segnalazioni: si leggono le proprie" on public.error_reports;
drop policy if exists "segnalazioni: si aggiungono le proprie" on public.error_reports;
create policy "segnalazioni: si leggono le proprie" on public.error_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "segnalazioni: si aggiungono le proprie" on public.error_reports
  for insert to authenticated with check (user_id = (select auth.uid()) and stato = 'aperta');

-- al massimo 100 segnalazioni al giorno per persona (contro gli abusi; l'app tiene le altre in coda)
create or replace function private.segnalazioni_limite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.error_reports
      where user_id = new.user_id and creato_il > now() - interval '1 day') >= 100 then
    raise exception 'troppe segnalazioni oggi' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function private.segnalazioni_limite() from public, anon, authenticated;
drop trigger if exists segnalazioni_limite on public.error_reports;
create trigger segnalazioni_limite before insert on public.error_reports
  for each row execute function private.segnalazioni_limite();

-- ---------- 4. error_report_flags (dati segnalati da più persone) ----------
create table if not exists public.error_report_flags (
  data_id text primary key,
  persone integer not null,
  ultima  timestamptz not null
);
alter table public.error_report_flags enable row level security;
revoke all on public.error_report_flags from public, anon, authenticated;
grant select on public.error_report_flags to authenticated;
drop policy if exists "segnalati: li leggono gli iscritti" on public.error_report_flags;
create policy "segnalati: li leggono gli iscritti" on public.error_report_flags
  for select to authenticated using (persone >= 2);

-- ricalcola il conteggio di un dato dopo ogni segnalazione aggiunta, chiusa o cancellata (anche con l'account)
create or replace function private.segnalati_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d text; n int; u timestamptz;
begin
  foreach d in array array_remove(array[
      case when tg_op <> 'INSERT' then old.data_id end,
      case when tg_op <> 'DELETE' then new.data_id end], null) loop
    select count(distinct user_id), max(creato_il) into n, u
      from public.error_reports where data_id = d and stato = 'aperta';
    if n = 0 then delete from public.error_report_flags where data_id = d;
    else insert into public.error_report_flags (data_id, persone, ultima) values (d, n, u)
         on conflict (data_id) do update set persone = excluded.persone, ultima = excluded.ultima;
    end if;
  end loop;
  return null;
end $$;
revoke all on function private.segnalati_conta() from public, anon, authenticated;
drop trigger if exists segnalati_conta on public.error_reports;
create trigger segnalati_conta after insert or update or delete on public.error_reports
  for each row execute function private.segnalati_conta();

-- ---------- 5. per l'autore (SQL Editor) ----------
create or replace view admin.segnalazioni as
  select data_id, count(distinct user_id) as persone, max(creato_il) as ultima,
         array_agg(nota order by creato_il) filter (where nota <> '') as note, max(valore) as valore
  from public.error_reports where stato = 'aperta'
  group by data_id order by persone desc, ultima desc;
revoke all on admin.segnalazioni from public, anon, authenticated;
