-- Dextera, più percorsi: la parte di gioco si separa per percorso (decisioni dell'autore del 19/11/2026).
-- Maestria, ripasso e passi fatti restano in comune tra i percorsi.
-- Si applica dopo 20261125090000_dextera_studio.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app e aspettato che si aggiorni sui telefoni: un'app più vecchia della 0.92.0, dopo questo file,
-- non riesce più a inviare percorso e punti della Flotta (i dati le restano in coda finché non si aggiorna).
-- L'app 0.92.0 funziona anche prima di questo file: invia solo i dati del percorso base e tiene in coda gli altri.
--
-- Le tabelle di BodyMania non cambiano. Modifiche (tutti i dati che ci sono già vanno al percorso 'base'):
--   path_progress      colonna percorso; chiave (user_id, percorso, node_id). I passi si scrivono sempre con 'base' (in comune);
--                      satellite acceso ed esame di un percorso parziale con il suo percorso (prima restavano sul telefono).
--   fleet_days         colonna percorso; chiave (user_id, giorno, percorso): il tetto di 300 punti vale per ogni percorso.
--   season_scores      colonna percorso; chiave (stagione, constellation_id, percorso): il campionato di ogni percorso.
--                      Le casate di oggi sommano tutti i percorsi (anche admin.chiudi_stagione).
--   crews              colonna percorso (scelta alla creazione, non si cambia): un equipaggio gioca in un percorso.
--   crew_weeks         colonna percorso, copiata dal server da quella dell'equipaggio.
-- Tabella nuova:
--   dextera_percorsi_xp  XP guadagnati in ogni percorso (per il profilo); vince il valore più alto. La legge e la scrive solo la persona.
-- Righe nuove in badge_classes: i badge di contenuto per percorso ('<id>-<percorso>', stessi testi di js/badges.js, badgeById):
--   per ora del percorso ucbm; un percorso nuovo vuole le sue quattro righe.
-- RLS con (select auth.uid()); nessun update senza where.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- toglie la chiave primaria se non contiene già la colonna percorso (così il file si può rieseguire)
create or replace function private.pk_senza_percorso(t text) returns boolean
language sql stable set search_path = '' as $$
  select not exists (select 1 from pg_catalog.pg_constraint c join pg_catalog.pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = ('public.' || t)::regclass and c.contype = 'p' and a.attname = 'percorso')
$$;
revoke all on function private.pk_senza_percorso(text) from public, anon, authenticated;

-- ---------- 1. path_progress ----------
alter table public.path_progress add column if not exists percorso text not null default 'base';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'path_progress_percorso_check') then
    alter table public.path_progress add constraint path_progress_percorso_check check (percorso ~ '^[a-z0-9-]{1,40}$');
  end if;
  if private.pk_senza_percorso('path_progress') then
    alter table public.path_progress drop constraint if exists path_progress_pkey;
    alter table public.path_progress add constraint path_progress_pkey primary key (user_id, percorso, node_id);
  end if;
end $$;
grant update (user_id, percorso, node_id, stato, stelle, fatto_il) on public.path_progress to authenticated;

create or replace function private.percorso_unione() returns trigger
language plpgsql set search_path = '' as $$
declare
  r_old int := case old.stato when 'acceso' then 3 when 'fatto' then 2 else 1 end;
  r_new int := case new.stato when 'acceso' then 3 when 'fatto' then 2 else 1 end;
begin
  new.percorso := old.percorso;
  if r_old > r_new then new.stato := old.stato; end if;
  new.stelle := greatest(new.stelle, old.stelle);
  new.fatto_il := case when old.fatto_il is null then new.fatto_il when new.fatto_il is null then old.fatto_il
                       else least(old.fatto_il, new.fatto_il) end;
  new.aggiornato_il := now();
  return new;
end $$;
revoke all on function private.percorso_unione() from public, anon, authenticated;

-- ---------- 2. fleet_days e season_scores ----------
alter table public.fleet_days add column if not exists percorso text not null default 'base';
alter table public.season_scores add column if not exists percorso text not null default 'base';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fleet_days_percorso_check') then
    alter table public.fleet_days add constraint fleet_days_percorso_check check (percorso ~ '^[a-z0-9-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'season_scores_percorso_check') then
    alter table public.season_scores add constraint season_scores_percorso_check check (percorso ~ '^[a-z0-9-]{1,40}$');
  end if;
  if private.pk_senza_percorso('fleet_days') then
    alter table public.fleet_days drop constraint if exists fleet_days_pkey;
    alter table public.fleet_days add constraint fleet_days_pkey primary key (user_id, giorno, percorso);
  end if;
  if private.pk_senza_percorso('season_scores') then
    alter table public.season_scores drop constraint if exists season_scores_pkey;
    alter table public.season_scores add constraint season_scores_pkey primary key (stagione, constellation_id, percorso);
  end if;
end $$;
grant insert (user_id, giorno, percorso, xp, punti) on public.fleet_days to authenticated;
grant update (user_id, giorno, percorso, xp, punti) on public.fleet_days to authenticated;

-- come prima, e il percorso non cambia in un aggiornamento
create or replace function private.flotta_giorno() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.constellation_members%rowtype; o date := private.oggi();
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.giorno := old.giorno; new.percorso := old.percorso; new.constellation_id := old.constellation_id;
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
-- punti della casata nella stagione del giorno, per percorso
create or replace function private.flotta_stagione(c text, g date, p text) returns void
language plpgsql security definer set search_path = '' as $$
declare a date := date_trunc('month', g)::date; b date := (date_trunc('month', g) + interval '1 month')::date;
begin
  insert into public.season_scores (stagione, constellation_id, percorso, punti, membri_attivi, aggiornato_il)
  select to_char(g, 'YYYY-MM'), c, p, coalesce(sum(d.punti), 0), count(distinct d.user_id) filter (where d.punti > 0), now()
    from public.fleet_days d where d.constellation_id = c and d.percorso = p and d.giorno >= a and d.giorno < b
  on conflict (stagione, constellation_id, percorso) do update
    set punti = excluded.punti, membri_attivi = excluded.membri_attivi, aggiornato_il = now();
end $$;
create or replace function private.flotta_punti() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then perform private.flotta_stagione(old.constellation_id, old.giorno, old.percorso); return null; end if;
  if tg_op = 'INSERT' or new.punti <> old.punti then perform private.flotta_stagione(new.constellation_id, new.giorno, new.percorso); end if;
  return null;
end $$;
drop function if exists private.flotta_stagione(text, date);
revoke all on function private.flotta_giorno(), private.flotta_stagione(text, date, text), private.flotta_punti() from public, anon, authenticated;

-- chiusura della stagione: le casate di oggi sommano i punti di tutti i percorsi; membri attivi = persone diverse con punti
create or replace function admin.chiudi_stagione(p_stagione text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare s text := coalesce(p_stagione, to_char(private.oggi() - 1, 'YYYY-MM')); v text;
  a date := to_date(s || '-01', 'YYYY-MM-DD'); b date := (to_date(s || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
begin
  select constellation_id into v from public.season_scores where stagione = s
    group by constellation_id having sum(punti) > 0 order by sum(punti) desc, random() limit 1;
  insert into public.seasons (stagione, vincitore, classifica)
  select s, v, coalesce(jsonb_agg(jsonb_build_object('casata', t.constellation_id, 'punti', t.punti, 'membri', t.membri)
                                  order by t.punti desc), '[]'::jsonb)
    from (select ss.constellation_id, sum(ss.punti) as punti,
                 (select count(distinct d.user_id) from public.fleet_days d
                   where d.constellation_id = ss.constellation_id and d.giorno >= a and d.giorno < b and d.punti > 0) as membri
            from public.season_scores ss where ss.stagione = s group by ss.constellation_id) t
  on conflict (stagione) do nothing;
  return v;
end $$;
revoke all on function admin.chiudi_stagione(text) from public, anon, authenticated;

-- ---------- 3. equipaggi ----------
alter table public.crews add column if not exists percorso text not null default 'base';
alter table public.crew_weeks add column if not exists percorso text not null default 'base';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crews_percorso_check') then
    alter table public.crews add constraint crews_percorso_check check (percorso ~ '^[a-z0-9-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crew_weeks_percorso_check') then
    alter table public.crew_weeks add constraint crew_weeks_percorso_check check (percorso ~ '^[a-z0-9-]{1,40}$');
  end if;
end $$;
grant insert (nome, pianeta, percorso) on public.crews to authenticated;

-- contributi: come prima; il percorso è quello dell'equipaggio (deciso dal server)
create or replace function private.equipaggio_settimana() returns trigger
language plpgsql security definer set search_path = '' as $$
declare l date := private.lunedi();
begin
  if tg_op = 'UPDATE' then
    new.crew_id := old.crew_id; new.user_id := old.user_id; new.settimana := old.settimana; new.pianeta := old.pianeta;
    new.percorso := old.percorso;
    new.contributi := greatest(new.contributi, old.contributi);
  else
    if new.settimana not in (l, l - 7) then
      raise exception 'settimana non valida' using errcode = 'P0001', hint = 'dextera_settimana';
    end if;
    new.percorso := coalesce((select c.percorso from public.crews c where c.id = new.crew_id), 'base');
  end if;
  new.aggiornato_il := now();
  return new;
end $$;
revoke all on function private.equipaggio_settimana() from public, anon, authenticated;

-- ---------- 4. XP per percorso ----------
create table if not exists public.dextera_percorsi_xp (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  percorso       text not null check (percorso ~ '^[a-z0-9-]{1,40}$'),
  xp             integer not null default 0 check (xp between 0 and 100000000),
  aggiornato_il  timestamptz not null default now(),
  primary key (user_id, percorso)
);
alter table public.dextera_percorsi_xp enable row level security;
revoke all on public.dextera_percorsi_xp from public, anon, authenticated;
grant select, delete on public.dextera_percorsi_xp to authenticated;
grant insert (user_id, percorso, xp) on public.dextera_percorsi_xp to authenticated;
grant update (user_id, percorso, xp) on public.dextera_percorsi_xp to authenticated;

drop policy if exists "xp per percorso: si leggono i propri" on public.dextera_percorsi_xp;
drop policy if exists "xp per percorso: si aggiungono i propri" on public.dextera_percorsi_xp;
drop policy if exists "xp per percorso: si modificano i propri" on public.dextera_percorsi_xp;
drop policy if exists "xp per percorso: si cancellano i propri" on public.dextera_percorsi_xp;
create policy "xp per percorso: si leggono i propri" on public.dextera_percorsi_xp
  for select to authenticated using (user_id = (select auth.uid()));
create policy "xp per percorso: si aggiungono i propri" on public.dextera_percorsi_xp
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "xp per percorso: si modificano i propri" on public.dextera_percorsi_xp
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "xp per percorso: si cancellano i propri" on public.dextera_percorsi_xp
  for delete to authenticated using (user_id = (select auth.uid()));

-- vince il valore più alto (un telefono con dati vecchi non toglie XP); utente e percorso non cambiano
create or replace function private.dextera_percorsi_xp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.percorso := old.percorso; new.xp := greatest(new.xp, old.xp);
  end if;
  new.aggiornato_il := now();
  return new;
end $$;
revoke all on function private.dextera_percorsi_xp() from public, anon, authenticated;
drop trigger if exists dextera_percorsi_xp on public.dextera_percorsi_xp;
create trigger dextera_percorsi_xp before insert or update on public.dextera_percorsi_xp
  for each row execute function private.dextera_percorsi_xp();

-- ---------- 5. badge di contenuto per percorso ----------
insert into public.badge_classes (id, name, description, criteria, image) values
  ('sat1-ucbm', 'Primo satellite acceso · Test d''ingresso UCBM', 'Accendi il tuo primo satellite nel percorso Test d''ingresso UCBM', 'Accendi il tuo primo satellite nel percorso Test d''ingresso UCBM', '🛰️'),
  ('pianeta1-ucbm', 'Primo pianeta · Test d''ingresso UCBM', 'Supera l''esame di un pianeta nel percorso Test d''ingresso UCBM', 'Supera l''esame di un pianeta nel percorso Test d''ingresso UCBM', '🪐'),
  ('corso1-ucbm', 'Primo corso · Test d''ingresso UCBM', 'Completa un corso: tutti i suoi pianeti con l''esame superato nel percorso Test d''ingresso UCBM', 'Completa un corso: tutti i suoi pianeti con l''esame superato nel percorso Test d''ingresso UCBM', '☀️'),
  ('sistema-ucbm', 'Sistema completo · Test d''ingresso UCBM', 'Rendi brillanti tutti i satelliti di un pianeta nel percorso Test d''ingresso UCBM', 'Rendi brillanti tutti i satelliti di un pianeta nel percorso Test d''ingresso UCBM', '✨')
on conflict (id) do update set name = excluded.name, description = excluded.description,
  criteria = excluded.criteria, image = excluded.image;

commit;
