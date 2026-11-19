-- Dextera, fase 4 – Flotta: casate (costellazioni) con la stagione mensile, punti del giorno, classifica settimanale degli
-- amici, equipaggi con codice d'invito, obiettivo della settimana e sfide (sezione 6 della specifica).
-- Si applica dopo 20261122090000_dextera_ripasso.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app che usa queste tabelle (funziona anche senza: finché il file non è applicato i punti restano sul
-- telefono e partono dopo; la scheda Flotta dice che manca il file).
--
-- Solo tabelle nuove: le tabelle di BodyMania non cambiano (dextera_settings ha già la colonna pianeta, il pianeta scelto).
-- RLS su ogni tabella, (select auth.uid()) come in 20261120100000_prestazioni_rls.sql.
--   constellations          le 4 casate (Osteon, Myon, Neuron, Cor) e quanti membri hanno; si leggono e basta
--   constellation_members   la casata di ognuno: assegnata dal server alla casata con meno membri; si cambia al massimo
--                           una volta per stagione (mese, ora italiana); i punti già fatti restano alla casata di prima
--   fleet_days              per ogni persona e giorno: XP di progresso del giorno e punti per la casata (al massimo 300 al
--                           giorno, già raddoppiati sul telefono per il pianeta scelto). Li leggono la persona e i suoi amici
--                           (classifica della settimana). La casata del giorno la decide il server.
--   season_scores           punti di ogni casata in ogni stagione ('AAAA-MM') e membri attivi: li tiene aggiornati un trigger
--   seasons                 storico: la stagione chiusa con la casata vincitrice (vince chi ha più punti totali);
--                           la chiude pg_cron il primo del mese
--   crews, crew_members     equipaggi da 2 a 10 persone, al massimo 3 equipaggi a testa; si entra con il codice
--   crew_weeks              contributi della settimana di ogni membro sul pianeta dell'equipaggio (ognuno vede solo i suoi;
--                           il totale sta in crews.contributi)
--   crew_challenges         sfide: un membro sceglie 5 strutture; crew_challenge_answers: le risposte degli altri
--   dextera_classifica_settimana   vista: XP di progresso della settimana (da lunedì, ora italiana) per sé e gli amici
--
-- Comandi utili nel SQL Editor (lo schema admin non è esposto dall'API):
--   select * from public.season_scores order by stagione desc, punti desc;   -- punti delle casate
--   select admin.chiudi_stagione('2026-11');                                  -- chiude a mano una stagione (lo fa pg_cron)

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- lunedì della settimana in corso e stagione ('AAAA-MM'), con l'ora italiana
create or replace function private.lunedi() returns date
language sql stable set search_path = '' as $$ select date_trunc('week', now() at time zone 'Europe/Rome')::date $$;
create or replace function private.oggi() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Europe/Rome')::date $$;
revoke all on function private.lunedi(), private.oggi() from public, anon, authenticated;

-- ---------- 1. casate ----------
create table if not exists public.constellations (
  id       text primary key check (id ~ '^[a-z]{2,20}$'),
  nome     text not null check (char_length(nome) <= 30),
  simbolo  text not null check (char_length(simbolo) <= 8),
  colore   text not null check (colore ~ '^#[0-9a-f]{6}$'),
  ordine   smallint not null,
  membri   integer not null default 0
);
insert into public.constellations (id, nome, simbolo, colore, ordine) values
  ('osteon', 'Osteon', '🦴', '#f0c75e', 1),
  ('myon',   'Myon',   '💪', '#f87171', 2),
  ('neuron', 'Neuron', '🧠', '#a78bfa', 3),
  ('cor',    'Cor',    '🫀', '#60a5fa', 4)
on conflict (id) do update set nome = excluded.nome, simbolo = excluded.simbolo, colore = excluded.colore, ordine = excluded.ordine;
alter table public.constellations enable row level security;
revoke all on public.constellations from public, anon, authenticated;
grant select on public.constellations to authenticated;
drop policy if exists "casate: si leggono" on public.constellations;
create policy "casate: si leggono" on public.constellations for select to authenticated using (true);

create table if not exists public.constellation_members (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  constellation_id text not null references public.constellations (id),
  precedente       text references public.constellations (id),
  cambiata_il      timestamptz,
  entrata_il       timestamptz not null default now()
);
create index if not exists constellation_members_casata on public.constellation_members (constellation_id);
alter table public.constellation_members enable row level security;
revoke all on public.constellation_members from public, anon, authenticated;
grant select on public.constellation_members to authenticated;
grant insert (user_id) on public.constellation_members to authenticated;
grant update (constellation_id) on public.constellation_members to authenticated;

drop policy if exists "casata: si legge la propria" on public.constellation_members;
drop policy if exists "casata: si entra" on public.constellation_members;
drop policy if exists "casata: si cambia la propria" on public.constellation_members;
create policy "casata: si legge la propria" on public.constellation_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "casata: si entra" on public.constellation_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "casata: si cambia la propria" on public.constellation_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- all'ingresso la casata la sceglie il server: quella con meno membri (a parità, la prima)
create or replace function private.casata_ingresso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select k.id into new.constellation_id
    from public.constellations k left join public.constellation_members m on m.constellation_id = k.id
    group by k.id, k.ordine order by count(m.user_id), k.ordine limit 1;
  new.precedente := null; new.cambiata_il := null; new.entrata_il := now();
  return new;
end $$;
-- cambio di casata: al massimo una volta per stagione (mese, ora italiana)
create or replace function private.casata_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := old.user_id; new.entrata_il := old.entrata_il;
  if new.constellation_id is distinct from old.constellation_id then
    if old.cambiata_il is not null and to_char(old.cambiata_il at time zone 'Europe/Rome', 'YYYY-MM')
                                     = to_char(now() at time zone 'Europe/Rome', 'YYYY-MM') then
      raise exception 'casata già cambiata in questa stagione' using errcode = 'P0001', hint = 'dextera_cambio';
    end if;
    new.precedente := old.constellation_id; new.cambiata_il := now();
  else
    new.precedente := old.precedente; new.cambiata_il := old.cambiata_il;
  end if;
  return new;
end $$;
-- quanti membri ha ogni casata (si vede nella scheda Flotta)
create or replace function private.casata_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.constellations k set membri = (select count(*) from public.constellation_members m where m.constellation_id = k.id);
  return null;
end $$;
revoke all on function private.casata_ingresso(), private.casata_cambio(), private.casata_conta() from public, anon, authenticated;
drop trigger if exists casata_ingresso on public.constellation_members;
drop trigger if exists casata_cambio on public.constellation_members;
drop trigger if exists casata_conta on public.constellation_members;
create trigger casata_ingresso before insert on public.constellation_members for each row execute function private.casata_ingresso();
create trigger casata_cambio before update on public.constellation_members for each row execute function private.casata_cambio();
create trigger casata_conta after insert or update or delete on public.constellation_members
  for each statement execute function private.casata_conta();

-- ---------- 2. punti del giorno, stagioni ----------
create table if not exists public.fleet_days (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  giorno           date not null,
  constellation_id text not null references public.constellations (id),
  xp               integer not null default 0 check (xp between 0 and 20000),
  punti            integer not null default 0 check (punti between 0 and 300),
  aggiornato_il    timestamptz not null default now(),
  primary key (user_id, giorno)
);
create index if not exists fleet_days_casata on public.fleet_days (constellation_id, giorno);
alter table public.fleet_days enable row level security;
revoke all on public.fleet_days from public, anon, authenticated;
grant select on public.fleet_days to authenticated;
grant insert (user_id, giorno, xp, punti) on public.fleet_days to authenticated;
grant update (user_id, giorno, xp, punti) on public.fleet_days to authenticated;

drop policy if exists "giorni: si leggono i propri e degli amici" on public.fleet_days;
drop policy if exists "giorni: si aggiungono i propri" on public.fleet_days;
drop policy if exists "giorni: si modificano i propri" on public.fleet_days;
create policy "giorni: si leggono i propri e degli amici" on public.fleet_days
  for select to authenticated using (
    user_id = (select auth.uid()) or exists (
      select 1 from public.friendships f where f.status = 'accepted' and (
        (f.user_id = (select auth.uid()) and f.friend_id = fleet_days.user_id) or
        (f.friend_id = (select auth.uid()) and f.user_id = fleet_days.user_id))));
create policy "giorni: si aggiungono i propri" on public.fleet_days
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "giorni: si modificano i propri" on public.fleet_days
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.season_scores (
  stagione         text not null check (stagione ~ '^[0-9]{4}-[0-9]{2}$'),
  constellation_id text not null references public.constellations (id),
  punti            bigint not null default 0,
  membri_attivi    integer not null default 0,
  aggiornato_il    timestamptz not null default now(),
  primary key (stagione, constellation_id)
);
alter table public.season_scores enable row level security;
revoke all on public.season_scores from public, anon, authenticated;
grant select on public.season_scores to authenticated;
drop policy if exists "punti delle casate: si leggono" on public.season_scores;
create policy "punti delle casate: si leggono" on public.season_scores for select to authenticated using (true);

create table if not exists public.seasons (
  stagione    text primary key check (stagione ~ '^[0-9]{4}-[0-9]{2}$'),
  vincitore   text references public.constellations (id),
  classifica  jsonb not null default '[]'::jsonb,
  chiusa_il   timestamptz not null default now()
);
alter table public.seasons enable row level security;
revoke all on public.seasons from public, anon, authenticated;
grant select on public.seasons to authenticated;
drop policy if exists "stagioni: si leggono" on public.seasons;
create policy "stagioni: si leggono" on public.seasons for select to authenticated using (true);

-- Un giorno arriva dal telefono (anche settimane dopo, se si è giocato offline: conta nella stagione in cui si è giocato).
-- Si accettano gli ultimi 35 giorni. La casata del giorno è quella di allora: prima del cambio, la casata di prima.
-- In un aggiornamento vince il valore più alto (un telefono con dati vecchi non toglie punti).
create or replace function private.flotta_giorno() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.constellation_members%rowtype; o date := private.oggi();
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.giorno := old.giorno; new.constellation_id := old.constellation_id;
    new.xp := greatest(new.xp, old.xp); new.punti := greatest(new.punti, old.punti);
  else
    if new.giorno > o + 1 or new.giorno < o - 35 then
      raise exception 'giorno fuori dal periodo accettato' using errcode = 'P0001', hint = 'dextera_giorno';
    end if;
    select * into m from public.constellation_members where user_id = new.user_id;
    if not found then raise exception 'senza casata' using errcode = 'P0001', hint = 'dextera_casata'; end if;
    new.constellation_id := case when m.cambiata_il is not null and m.precedente is not null
                                   and new.giorno < (m.cambiata_il at time zone 'Europe/Rome')::date
                                 then m.precedente else m.constellation_id end;
  end if;
  new.aggiornato_il := now();
  return new;
end $$;
-- punti della casata nella stagione del giorno: si ricontano (somma e membri attivi), così restano giusti anche se si
-- cancella un account
create or replace function private.flotta_stagione(c text, g date) returns void
language plpgsql security definer set search_path = '' as $$
declare a date := date_trunc('month', g)::date; b date := (date_trunc('month', g) + interval '1 month')::date;
begin
  insert into public.season_scores (stagione, constellation_id, punti, membri_attivi, aggiornato_il)
  select to_char(g, 'YYYY-MM'), c, coalesce(sum(d.punti), 0), count(distinct d.user_id) filter (where d.punti > 0), now()
    from public.fleet_days d where d.constellation_id = c and d.giorno >= a and d.giorno < b
  on conflict (stagione, constellation_id) do update
    set punti = excluded.punti, membri_attivi = excluded.membri_attivi, aggiornato_il = now();
end $$;
create or replace function private.flotta_punti() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then perform private.flotta_stagione(old.constellation_id, old.giorno); return null; end if;
  if tg_op = 'INSERT' or new.punti <> old.punti then perform private.flotta_stagione(new.constellation_id, new.giorno); end if;
  return null;
end $$;
revoke all on function private.flotta_giorno(), private.flotta_stagione(text, date), private.flotta_punti() from public, anon, authenticated;
drop trigger if exists flotta_giorno on public.fleet_days;
drop trigger if exists flotta_punti on public.fleet_days;
create trigger flotta_giorno before insert or update on public.fleet_days for each row execute function private.flotta_giorno();
create trigger flotta_punti after insert or update or delete on public.fleet_days for each row execute function private.flotta_punti();

-- chiude una stagione (di solito quella appena finita): vince la casata con più punti totali; a parità si sceglie a caso.
-- Una stagione già chiusa resta com'è (i punti arrivati dopo contano in season_scores, non cambiano il vincitore).
create or replace function admin.chiudi_stagione(p_stagione text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare s text := coalesce(p_stagione, to_char(private.oggi() - 1, 'YYYY-MM')); v text;
begin
  select constellation_id into v from public.season_scores where stagione = s and punti > 0 order by punti desc, random() limit 1;
  insert into public.seasons (stagione, vincitore, classifica)
  select s, v, coalesce(jsonb_agg(jsonb_build_object('casata', constellation_id, 'punti', punti, 'membri', membri_attivi)
                                  order by punti desc), '[]'::jsonb)
    from public.season_scores where stagione = s
  on conflict (stagione) do nothing;
  return v;
end $$;
revoke all on function admin.chiudi_stagione(text) from public, anon, authenticated;

-- ogni primo del mese alle 00:30 UTC (in Italia è già il primo) si chiude la stagione del mese prima.
-- Se pg_cron non c'è il resto del file vale lo stesso: si attiva da Database → Extensions e si riesegue il file.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('dextera-chiudi-stagione', '30 0 1 * *', 'select admin.chiudi_stagione()');
  else
    raise notice 'pg_cron non disponibile: la stagione va chiusa a mano con select admin.chiudi_stagione();';
  end if;
end $$;

-- ---------- 3. classifica della settimana tra amici ----------
-- XP di progresso da lunedì (ora italiana), per sé e gli amici (le righe di leaderboard_friends: profili con un nome)
create or replace view public.dextera_classifica_settimana with (security_invoker = true) as
  select f.id, f.username, f.avatar,
    coalesce((select sum(d.xp) from public.fleet_days d
              where d.user_id = f.id and d.giorno >= date_trunc('week', now() at time zone 'Europe/Rome')::date), 0)::integer as xp
  from public.leaderboard_friends f;
revoke all on public.dextera_classifica_settimana from public, anon;
grant select on public.dextera_classifica_settimana to authenticated;

-- ---------- 4. equipaggi ----------
create table if not exists public.crews (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 3 and 30),
  codice      text not null unique check (codice ~ '^[A-HJ-NP-Z2-9]{6}$'),
  capo        uuid references auth.users (id) on delete set null,
  vice        uuid references auth.users (id) on delete set null,
  pianeta     text check (pianeta is null or pianeta ~ '^[a-z0-9-]{1,40}$'),
  membri_ids  uuid[] not null default '{}',
  settimana   date,
  contributi  integer not null default 0,
  creato_il   timestamptz not null default now()
);
create index if not exists crews_membri on public.crews using gin (membri_ids);
alter table public.crews enable row level security;
revoke all on public.crews from public, anon, authenticated;
grant select, delete on public.crews to authenticated;
grant insert (nome, pianeta) on public.crews to authenticated;
grant update (nome, pianeta, vice) on public.crews to authenticated;

drop policy if exists "equipaggi: li leggono i membri" on public.crews;
drop policy if exists "equipaggi: si creano" on public.crews;
drop policy if exists "equipaggi: li modificano capo e vice" on public.crews;
drop policy if exists "equipaggi: li scioglie il capo" on public.crews;
create policy "equipaggi: li leggono i membri" on public.crews
  for select to authenticated using ((select auth.uid()) = any (membri_ids));
create policy "equipaggi: si creano" on public.crews
  for insert to authenticated with check (capo = (select auth.uid()));
create policy "equipaggi: li modificano capo e vice" on public.crews
  for update to authenticated using ((select auth.uid()) in (capo, vice)) with check ((select auth.uid()) = any (membri_ids));
create policy "equipaggi: li scioglie il capo" on public.crews
  for delete to authenticated using (capo = (select auth.uid()));

create table if not exists public.crew_members (
  crew_id     uuid not null references public.crews (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  codice      text check (codice is null or char_length(codice) <= 10),
  entrato_il  timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_members_utente on public.crew_members (user_id);
alter table public.crew_members enable row level security;
revoke all on public.crew_members from public, anon, authenticated;
grant select, delete on public.crew_members to authenticated;
grant insert (user_id, codice) on public.crew_members to authenticated;

drop policy if exists "membri: li vedono i membri" on public.crew_members;
drop policy if exists "membri: si entra con il codice" on public.crew_members;
drop policy if exists "membri: si esce o il capo toglie" on public.crew_members;
create policy "membri: li vedono i membri" on public.crew_members
  for select to authenticated using (user_id = (select auth.uid()) or exists (
    select 1 from public.crews c where c.id = crew_members.crew_id and (select auth.uid()) = any (c.membri_ids)));
create policy "membri: si entra con il codice" on public.crew_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "membri: si esce o il capo toglie" on public.crew_members
  for delete to authenticated using (user_id = (select auth.uid()) or exists (
    select 1 from public.crews c where c.id = crew_members.crew_id and c.capo = (select auth.uid())));

create table if not exists public.crew_weeks (
  crew_id       uuid not null references public.crews (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  settimana     date not null,
  pianeta       text not null check (pianeta ~ '^[a-z0-9-]{1,40}$'),
  contributi    smallint not null default 0 check (contributi between 0 and 1000),
  aggiornato_il timestamptz not null default now(),
  primary key (crew_id, user_id, settimana, pianeta)
);
alter table public.crew_weeks enable row level security;
revoke all on public.crew_weeks from public, anon, authenticated;
grant select on public.crew_weeks to authenticated;
grant insert (crew_id, user_id, settimana, pianeta, contributi) on public.crew_weeks to authenticated;
grant update (crew_id, user_id, settimana, pianeta, contributi) on public.crew_weeks to authenticated;

drop policy if exists "contributi: si leggono i propri" on public.crew_weeks;
drop policy if exists "contributi: si aggiungono i propri" on public.crew_weeks;
drop policy if exists "contributi: si modificano i propri" on public.crew_weeks;
create policy "contributi: si leggono i propri" on public.crew_weeks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "contributi: si aggiungono i propri" on public.crew_weeks
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.crews c where c.id = crew_weeks.crew_id and (select auth.uid()) = any (c.membri_ids)));
create policy "contributi: si modificano i propri" on public.crew_weeks
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (
    select 1 from public.crews c where c.id = crew_weeks.crew_id and (select auth.uid()) = any (c.membri_ids)));

-- Le modifiche fatte dai trigger (membri, capo, totale dei contributi) passano con il segno dextera.interno;
-- dall'app si cambiano solo nome, pianeta e vice (permessi per colonna), con le regole qui sotto.
create or replace function private.equipaggio_nuovo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare alfa text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  new.capo := auth.uid();
  if new.capo is null then raise exception 'serve un account' using errcode = 'P0001'; end if;
  if (select count(*) from public.crew_members where user_id = new.capo) >= 3 then
    raise exception 'al massimo 3 equipaggi' using errcode = 'P0001', hint = 'dextera_max_equipaggi';
  end if;
  new.nome := btrim(new.nome); new.vice := null; new.membri_ids := array[new.capo];
  new.contributi := 0; new.settimana := private.lunedi(); new.creato_il := now();
  loop
    select string_agg(substr(alfa, 1 + floor(random() * 32)::int, 1), '') into new.codice from generate_series(1, 6);
    exit when not exists (select 1 from public.crews where codice = new.codice);
  end loop;
  return new;
end $$;
-- chi crea l'equipaggio ne è il primo membro (e il capo)
create or replace function private.equipaggio_capo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.crew_members (crew_id, user_id, codice) values (new.id, new.capo, new.codice);
  return null;
end $$;
create or replace function private.equipaggio_modifica() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('dextera.interno', true), '') = 'on' then return new; end if;
  new.nome := btrim(new.nome);
  if new.vice is distinct from old.vice then
    if auth.uid() is distinct from old.capo then
      raise exception 'solo il capo nomina il vice' using errcode = 'P0001', hint = 'dextera_capo';
    end if;
    if new.vice is not null and (new.vice = old.capo or not new.vice = any (old.membri_ids) or cardinality(old.membri_ids) < 3) then
      raise exception 'vice non valido' using errcode = 'P0001', hint = 'dextera_vice';
    end if;
  end if;
  return new;
end $$;
-- totale dei contributi della settimana sul pianeta dell'equipaggio
create or replace function private.equipaggio_conta(c uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l date := private.lunedi();
begin
  perform set_config('dextera.interno', 'on', true);
  update public.crews k set settimana = l, contributi = coalesce((select sum(w.contributi) from public.crew_weeks w
    where w.crew_id = k.id and w.settimana = l and w.pianeta = k.pianeta), 0) where k.id = c;
  perform set_config('dextera.interno', '', true);
end $$;
create or replace function private.equipaggio_pianeta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.equipaggio_conta(new.id); return null; end $$;

-- si entra con il codice: il server trova l'equipaggio (l'id mandato dall'app non conta); al massimo 10 membri
create or replace function private.equipaggio_entra() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.crews%rowtype;
begin
  select * into c from public.crews where codice = upper(btrim(coalesce(new.codice, ''))) for update;
  if not found then raise exception 'codice non valido' using errcode = 'P0001', hint = 'dextera_codice'; end if;
  if exists (select 1 from public.crew_members where crew_id = c.id and user_id = new.user_id) then
    raise exception 'già nell''equipaggio' using errcode = 'P0001', hint = 'dextera_gia';
  end if;
  if (select count(*) from public.crew_members where crew_id = c.id) >= 10 then
    raise exception 'equipaggio al completo' using errcode = 'P0001', hint = 'dextera_pieno';
  end if;
  if (select count(*) from public.crew_members where user_id = new.user_id) >= 3 then
    raise exception 'al massimo 3 equipaggi' using errcode = 'P0001', hint = 'dextera_max_equipaggi';
  end if;
  new.crew_id := c.id; new.codice := null; new.entrato_il := now();
  perform set_config('dextera.interno', 'on', true);
  update public.crews set membri_ids = case when new.user_id = any (membri_ids) then membri_ids
                                            else array_append(membri_ids, new.user_id) end where id = c.id;
  perform set_config('dextera.interno', '', true);
  return new;
end $$;
-- si esce (o il capo toglie): se esce il capo lo diventa il vice o chi è entrato per primo; senza membri l'equipaggio
-- si scioglie; con meno di 3 membri non c'è il vice
create or replace function private.equipaggio_esce() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.crews%rowtype; resta boolean;
begin
  perform set_config('dextera.interno', 'on', true);
  update public.crews set membri_ids = array_remove(membri_ids, old.user_id),
    vice = case when vice = old.user_id then null else vice end
    where id = old.crew_id returning * into c;
  resta := found and cardinality(c.membri_ids) > 0;
  if found then
    if cardinality(c.membri_ids) = 0 then
      delete from public.crews where id = c.id;
    else
      if c.capo is null or c.capo = old.user_id then
        update public.crews set capo = coalesce(c.vice, (select m.user_id from public.crew_members m
          where m.crew_id = c.id order by m.entrato_il limit 1)), vice = null where id = c.id;
      end if;
      update public.crews set vice = null where id = c.id and cardinality(membri_ids) < 3;
      delete from public.crew_weeks where crew_id = c.id and user_id = old.user_id;
    end if;
  end if;
  perform set_config('dextera.interno', '', true);
  if resta then perform private.equipaggio_conta(old.crew_id); end if;
  return null;
end $$;
-- contributi: solo la settimana in corso o quella prima; vince il valore più alto
create or replace function private.equipaggio_settimana() returns trigger
language plpgsql security definer set search_path = '' as $$
declare l date := private.lunedi();
begin
  if tg_op = 'UPDATE' then
    new.crew_id := old.crew_id; new.user_id := old.user_id; new.settimana := old.settimana; new.pianeta := old.pianeta;
    new.contributi := greatest(new.contributi, old.contributi);
  elsif new.settimana not in (l, l - 7) then
    raise exception 'settimana non valida' using errcode = 'P0001', hint = 'dextera_settimana';
  end if;
  new.aggiornato_il := now();
  return new;
end $$;
create or replace function private.equipaggio_contributi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform private.equipaggio_conta(new.crew_id); return null; end $$;

revoke all on function private.equipaggio_nuovo(), private.equipaggio_capo(), private.equipaggio_modifica(),
  private.equipaggio_conta(uuid), private.equipaggio_pianeta(), private.equipaggio_entra(), private.equipaggio_esce(),
  private.equipaggio_settimana(), private.equipaggio_contributi() from public, anon, authenticated;
drop trigger if exists equipaggio_nuovo on public.crews;
drop trigger if exists equipaggio_capo on public.crews;
drop trigger if exists equipaggio_modifica on public.crews;
drop trigger if exists equipaggio_pianeta on public.crews;
drop trigger if exists equipaggio_entra on public.crew_members;
drop trigger if exists equipaggio_esce on public.crew_members;
drop trigger if exists equipaggio_settimana on public.crew_weeks;
drop trigger if exists equipaggio_contributi on public.crew_weeks;
create trigger equipaggio_nuovo before insert on public.crews for each row execute function private.equipaggio_nuovo();
create trigger equipaggio_capo after insert on public.crews for each row execute function private.equipaggio_capo();
create trigger equipaggio_modifica before update on public.crews for each row execute function private.equipaggio_modifica();
create trigger equipaggio_pianeta after update on public.crews for each row
  when (old.pianeta is distinct from new.pianeta) execute function private.equipaggio_pianeta();
create trigger equipaggio_entra before insert on public.crew_members for each row execute function private.equipaggio_entra();
create trigger equipaggio_esce after delete on public.crew_members for each row execute function private.equipaggio_esce();
create trigger equipaggio_settimana before insert or update on public.crew_weeks for each row execute function private.equipaggio_settimana();
create trigger equipaggio_contributi after insert or update on public.crew_weeks for each row execute function private.equipaggio_contributi();

-- ---------- 5. sfide ----------
-- 5 chiavi della maestria del percorso ('o.femur', 'm.<muscolo>', 'r.<repere>', 'n.<voce>'…), come in review_items
create table if not exists public.crew_challenges (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  autore     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pianeta    text check (pianeta is null or pianeta ~ '^[a-z0-9-]{1,40}$'),
  strutture  text[] not null check (cardinality(strutture) = 5 and
    array_to_string(strutture, ' ') ~ '^([a-z]{1,2}\.[a-z0-9._-]{1,100} ){4}[a-z]{1,2}\.[a-z0-9._-]{1,100}$'),
  creata_il  timestamptz not null default now()
);
create index if not exists crew_challenges_equipaggio on public.crew_challenges (crew_id, creata_il);
alter table public.crew_challenges enable row level security;
revoke all on public.crew_challenges from public, anon, authenticated;
grant select, delete on public.crew_challenges to authenticated;
grant insert (id, crew_id, autore, pianeta, strutture) on public.crew_challenges to authenticated;

drop policy if exists "sfide: le vedono i membri" on public.crew_challenges;
drop policy if exists "sfide: le lancia un membro" on public.crew_challenges;
drop policy if exists "sfide: le toglie chi le ha lanciate o il capo" on public.crew_challenges;
create policy "sfide: le vedono i membri" on public.crew_challenges
  for select to authenticated using (exists (
    select 1 from public.crews c where c.id = crew_challenges.crew_id and (select auth.uid()) = any (c.membri_ids)));
create policy "sfide: le lancia un membro" on public.crew_challenges
  for insert to authenticated with check (autore = (select auth.uid()) and exists (
    select 1 from public.crews c where c.id = crew_challenges.crew_id and (select auth.uid()) = any (c.membri_ids)));
create policy "sfide: le toglie chi le ha lanciate o il capo" on public.crew_challenges
  for delete to authenticated using (autore = (select auth.uid()) or exists (
    select 1 from public.crews c where c.id = crew_challenges.crew_id and c.capo = (select auth.uid())));

create table if not exists public.crew_challenge_answers (
  challenge_id uuid not null references public.crew_challenges (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  giuste       smallint not null check (giuste between 0 and 5),
  risposto_il  timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.crew_challenge_answers enable row level security;
revoke all on public.crew_challenge_answers from public, anon, authenticated;
grant select on public.crew_challenge_answers to authenticated;
grant insert (challenge_id, user_id, giuste) on public.crew_challenge_answers to authenticated;

drop policy if exists "risposte: le vedono i membri" on public.crew_challenge_answers;
drop policy if exists "risposte: si risponde una volta" on public.crew_challenge_answers;
create policy "risposte: le vedono i membri" on public.crew_challenge_answers
  for select to authenticated using (exists (
    select 1 from public.crew_challenges s join public.crews c on c.id = s.crew_id
    where s.id = crew_challenge_answers.challenge_id and (select auth.uid()) = any (c.membri_ids)));
create policy "risposte: si risponde una volta" on public.crew_challenge_answers
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.crew_challenges s join public.crews c on c.id = s.crew_id
    where s.id = crew_challenge_answers.challenge_id and s.autore <> (select auth.uid())
      and (select auth.uid()) = any (c.membri_ids)));

-- al massimo 10 sfide al giorno per equipaggio (contro gli abusi); autore e data li mette il server
create or replace function private.sfida_nuova() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.crew_challenges where crew_id = new.crew_id and creata_il > now() - interval '1 day') >= 10 then
    raise exception 'troppe sfide oggi' using errcode = 'P0001', hint = 'dextera_sfide';
  end if;
  new.autore := auth.uid(); new.creata_il := now();
  return new;
end $$;
revoke all on function private.sfida_nuova() from public, anon, authenticated;
drop trigger if exists sfida_nuova on public.crew_challenges;
create trigger sfida_nuova before insert on public.crew_challenges for each row execute function private.sfida_nuova();
