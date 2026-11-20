-- Dextera, casate su due livelli (decisioni dell'autore del 20/11/2026):
--   casate grandi dell'app, uguali per tutti: Nova, Pulsar, Quasar, Nebula (ambito 'app');
--   casate di ogni percorso: nel percorso completo Osteon, Myon, Neuron, Cor (quelle di prima); in UCBM Bios (biologia),
--   Alchemia (chimica), Physis (fisica). Ogni punto vale per la casata del percorso in cui si gioca e per la casata grande.
-- Si applica dopo 20261126090000_dextera_percorsi.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app 0.93.0 (funziona anche senza questo file: mostra le casate di prima).
-- Nomi, simboli e colori stanno nella tabella constellations: si cambiano con un update, senza toccare l'app.
--
-- Le tabelle di BodyMania non cambiano. Modifiche:
--   constellations          colonna ambito ('app' = casata grande, altrimenti l'id del percorso; quelle di prima: 'base') e
--                           colonna macro (per le casate del percorso completo: la casata grande in cui finisce chi c'era già)
--   constellation_members   resta la casata del percorso completo: il server la sceglie e la cambia solo tra quelle 'base'
--   dextera_casate (nuova)  la casata grande (ambito 'app') e la casata degli altri percorsi di ognuno; stesse regole: la sceglie
--                           il server (la meno numerosa; la casata grande di chi c'era già segue la sua casata di prima), si cambia
--                           al massimo una volta per stagione, i punti già fatti restano alla casata di prima
--   fleet_days              constellation_id = casata del percorso del giorno (vuota se il percorso non ha casate); macro_id = casata
--                           grande del giorno. Le decide il server
--   season_scores           righe per casata del percorso (percorso = id del percorso) e per casata grande (percorso = 'app')
--   seasons                 vincitore = casata grande vincitrice; colonna percorsi {percorso: {vincitore, classifica}}
-- 'app' è riservato: nessun percorso può chiamarsi così.
-- RLS con (select auth.uid()); nessun update senza where.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- 1. casate ----------
alter table public.constellations add column if not exists ambito text not null default 'base';
alter table public.constellations add column if not exists macro text references public.constellations (id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'constellations_ambito_check') then
    alter table public.constellations add constraint constellations_ambito_check check (ambito ~ '^[a-z0-9-]{1,40}$');
  end if;
end $$;
insert into public.constellations (id, nome, simbolo, colore, ordine, ambito) values
  ('nova',     'Nova',     '🌟', '#f59e0b', 1, 'app'),
  ('pulsar',   'Pulsar',   '💫', '#22d3ee', 2, 'app'),
  ('quasar',   'Quasar',   '🌀', '#8b5cf6', 3, 'app'),
  ('nebula',   'Nebula',   '🌌', '#ec4899', 4, 'app'),
  ('bios',     'Bios',     '🧬', '#22c55e', 1, 'ucbm'),
  ('alchemia', 'Alchemia', '⚗️', '#f97316', 2, 'ucbm'),
  ('physis',   'Physis',   '⚛️', '#3b82f6', 3, 'ucbm')
on conflict (id) do update set nome = excluded.nome, simbolo = excluded.simbolo, colore = excluded.colore,
  ordine = excluded.ordine, ambito = excluded.ambito;
update public.constellations set ambito = 'base', macro = case id when 'osteon' then 'nova' when 'cor' then 'pulsar'
  when 'neuron' then 'quasar' when 'myon' then 'nebula' end
  where id in ('osteon', 'myon', 'neuron', 'cor');

-- casata del percorso completo: il server la sceglie e la cambia solo tra quelle 'base'
create or replace function private.casata_ingresso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select k.id into new.constellation_id
    from public.constellations k left join public.constellation_members m on m.constellation_id = k.id
    where k.ambito = 'base'
    group by k.id, k.ordine order by count(m.user_id), k.ordine limit 1;
  new.precedente := null; new.cambiata_il := null; new.entrata_il := now();
  return new;
end $$;
create or replace function private.casata_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := old.user_id; new.entrata_il := old.entrata_il;
  if new.constellation_id is distinct from old.constellation_id then
    if not exists (select 1 from public.constellations k where k.id = new.constellation_id and k.ambito = 'base') then
      raise exception 'casata di un altro percorso' using errcode = 'P0001', hint = 'dextera_ambito';
    end if;
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

-- ---------- 2. casata grande e casate degli altri percorsi ----------
create table if not exists public.dextera_casate (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ambito           text not null check (ambito ~ '^[a-z0-9-]{1,40}$' and ambito <> 'base'),
  constellation_id text not null references public.constellations (id),
  precedente       text references public.constellations (id),
  cambiata_il      timestamptz,
  entrata_il       timestamptz not null default now(),
  primary key (user_id, ambito)
);
create index if not exists dextera_casate_casata on public.dextera_casate (constellation_id);
alter table public.dextera_casate enable row level security;
revoke all on public.dextera_casate from public, anon, authenticated;
grant select on public.dextera_casate to authenticated;
grant insert (user_id, ambito) on public.dextera_casate to authenticated;
grant update (constellation_id) on public.dextera_casate to authenticated;

drop policy if exists "casate: si leggono le proprie" on public.dextera_casate;
drop policy if exists "casate: si entra" on public.dextera_casate;
drop policy if exists "casate: si cambiano le proprie" on public.dextera_casate;
create policy "casate: si leggono le proprie" on public.dextera_casate
  for select to authenticated using (user_id = (select auth.uid()));
create policy "casate: si entra" on public.dextera_casate
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "casate: si cambiano le proprie" on public.dextera_casate
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ingresso: casata grande di chi c'era già = quella della sua casata di prima (macro); altrimenti la meno numerosa dell'ambito
create or replace function private.casate_ingresso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.constellation_id := null;
  if new.ambito = 'app' then
    select k.macro into new.constellation_id from public.constellation_members m join public.constellations k on k.id = m.constellation_id
      where m.user_id = new.user_id and k.macro is not null;
  end if;
  if new.constellation_id is null then
    select k.id into new.constellation_id from public.constellations k where k.ambito = new.ambito
      order by k.membri, k.ordine limit 1;
  end if;
  if new.constellation_id is null then
    raise exception 'questo percorso non ha casate' using errcode = 'P0001', hint = 'dextera_senza_casate';
  end if;
  new.precedente := null; new.cambiata_il := null; new.entrata_il := now();
  return new;
end $$;
create or replace function private.casate_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := old.user_id; new.ambito := old.ambito; new.entrata_il := old.entrata_il;
  if new.constellation_id is distinct from old.constellation_id then
    if not exists (select 1 from public.constellations k where k.id = new.constellation_id and k.ambito = old.ambito) then
      raise exception 'casata di un altro percorso' using errcode = 'P0001', hint = 'dextera_ambito';
    end if;
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
-- membri di ogni casata: quelle del percorso completo da constellation_members, le altre da dextera_casate
create or replace function private.casata_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.constellations k set membri =
      (select count(*) from public.constellation_members m where m.constellation_id = k.id)
    + (select count(*) from public.dextera_casate d where d.constellation_id = k.id)
    where k.id is not null;
  return null;
end $$;
revoke all on function private.casata_ingresso(), private.casata_cambio(), private.casata_conta(),
  private.casate_ingresso(), private.casate_cambio() from public, anon, authenticated;
drop trigger if exists casate_ingresso on public.dextera_casate;
drop trigger if exists casate_cambio on public.dextera_casate;
drop trigger if exists casate_conta on public.dextera_casate;
create trigger casate_ingresso before insert on public.dextera_casate for each row execute function private.casate_ingresso();
create trigger casate_cambio before update on public.dextera_casate for each row execute function private.casate_cambio();
create trigger casate_conta after insert or update or delete on public.dextera_casate
  for each statement execute function private.casata_conta();

-- chi ha già una casata entra nella casata grande corrispondente
insert into public.dextera_casate (user_id, ambito, constellation_id)
  select m.user_id, 'app', 'nova' from public.constellation_members m
  on conflict (user_id, ambito) do nothing;

-- ---------- 3. punti del giorno: casata del percorso e casata grande ----------
alter table public.fleet_days alter column constellation_id drop not null;
alter table public.fleet_days add column if not exists macro_id text references public.constellations (id);
create index if not exists fleet_days_macro on public.fleet_days (macro_id, giorno);

-- casata di un ambito per un giorno (prima del cambio: quella di prima); se manca la si assegna; null se l'ambito non ha casate
create or replace function private.casata_del_giorno(u uuid, amb text, g date) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.dextera_casate%rowtype;
begin
  select * into d from public.dextera_casate where user_id = u and ambito = amb;
  if not found then
    if not exists (select 1 from public.constellations where ambito = amb) then return null; end if;
    insert into public.dextera_casate (user_id, ambito) values (u, amb) returning * into d;
  end if;
  return case when d.cambiata_il is not null and d.precedente is not null
                and g < (d.cambiata_il at time zone 'Europe/Rome')::date then d.precedente else d.constellation_id end;
end $$;
create or replace function private.flotta_giorno() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.constellation_members%rowtype; o date := private.oggi();
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.giorno := old.giorno; new.percorso := old.percorso;
    new.constellation_id := old.constellation_id; new.macro_id := old.macro_id;
    new.xp := greatest(new.xp, old.xp); new.punti := greatest(new.punti, old.punti);
  else
    if new.giorno > o + 1 or new.giorno < o - 35 then
      raise exception 'giorno fuori dal periodo accettato' using errcode = 'P0001', hint = 'dextera_giorno';
    end if;
    select * into m from public.constellation_members where user_id = new.user_id;
    if not found then raise exception 'senza casata' using errcode = 'P0001', hint = 'dextera_casata'; end if;
    if new.percorso = 'base' then
      new.constellation_id := case when m.cambiata_il is not null and m.precedente is not null
                                     and new.giorno < (m.cambiata_il at time zone 'Europe/Rome')::date
                                   then m.precedente else m.constellation_id end;
    else
      new.constellation_id := private.casata_del_giorno(new.user_id, new.percorso, new.giorno);
    end if;
    new.macro_id := private.casata_del_giorno(new.user_id, 'app', new.giorno);
  end if;
  new.aggiornato_il := now();
  return new;
end $$;
-- punti della stagione: casata del percorso (percorso = id) e casata grande (percorso = 'app')
create or replace function private.flotta_stagione(c text, g date, p text) returns void
language plpgsql security definer set search_path = '' as $$
declare a date := date_trunc('month', g)::date; b date := (date_trunc('month', g) + interval '1 month')::date;
begin
  if c is null then return; end if;
  if p = 'app' then
    insert into public.season_scores (stagione, constellation_id, percorso, punti, membri_attivi, aggiornato_il)
    select to_char(g, 'YYYY-MM'), c, 'app', coalesce(sum(d.punti), 0), count(distinct d.user_id) filter (where d.punti > 0), now()
      from public.fleet_days d where d.macro_id = c and d.giorno >= a and d.giorno < b
    on conflict (stagione, constellation_id, percorso) do update
      set punti = excluded.punti, membri_attivi = excluded.membri_attivi, aggiornato_il = now();
  else
    insert into public.season_scores (stagione, constellation_id, percorso, punti, membri_attivi, aggiornato_il)
    select to_char(g, 'YYYY-MM'), c, p, coalesce(sum(d.punti), 0), count(distinct d.user_id) filter (where d.punti > 0), now()
      from public.fleet_days d where d.constellation_id = c and d.percorso = p and d.giorno >= a and d.giorno < b
    on conflict (stagione, constellation_id, percorso) do update
      set punti = excluded.punti, membri_attivi = excluded.membri_attivi, aggiornato_il = now();
  end if;
end $$;
create or replace function private.flotta_punti() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.flotta_stagione(old.constellation_id, old.giorno, old.percorso);
    perform private.flotta_stagione(old.macro_id, old.giorno, 'app');
    return null;
  end if;
  if tg_op = 'INSERT' or new.punti <> old.punti then
    perform private.flotta_stagione(new.constellation_id, new.giorno, new.percorso);
    perform private.flotta_stagione(new.macro_id, new.giorno, 'app');
  end if;
  return null;
end $$;
revoke all on function private.casata_del_giorno(uuid, text, date), private.flotta_giorno(),
  private.flotta_stagione(text, date, text), private.flotta_punti() from public, anon, authenticated;

-- giorni di prima: casata grande dalla casata del percorso completo. I giorni degli altri percorsi (con la 0.92 andavano
-- alla casata del percorso completo) passano alla casata del loro percorso. Il trigger che tiene fisse le casate si spegne
-- solo per questi due update. Poi si ricontano le stagioni degli ultimi due mesi.
alter table public.fleet_days disable trigger flotta_giorno;
update public.fleet_days d set macro_id = k.macro from public.constellations k
  where k.id = d.constellation_id and k.macro is not null and d.macro_id is null;
update public.fleet_days d set constellation_id = private.casata_del_giorno(d.user_id, d.percorso, d.giorno)
  where d.percorso <> 'base' and d.constellation_id in (select id from public.constellations where ambito = 'base');
alter table public.fleet_days enable trigger flotta_giorno;
delete from public.season_scores s using public.constellations k
  where k.id = s.constellation_id and s.percorso not in ('base', 'app') and k.ambito <> s.percorso;
do $$ declare r record; begin
  for r in select distinct macro_id as c, date_trunc('month', giorno)::date as g from public.fleet_days
           where macro_id is not null and giorno >= (date_trunc('month', private.oggi()) - interval '1 month')::date loop
    perform private.flotta_stagione(r.c, r.g, 'app');
  end loop;
  for r in select distinct constellation_id as c, percorso as p, date_trunc('month', giorno)::date as g from public.fleet_days
           where percorso <> 'base' and constellation_id is not null
             and giorno >= (date_trunc('month', private.oggi()) - interval '1 month')::date loop
    perform private.flotta_stagione(r.c, r.g, r.p);
  end loop;
end $$;

-- ---------- 4. chiusura della stagione ----------
alter table public.seasons add column if not exists percorsi jsonb not null default '{}'::jsonb;
-- vince la casata grande con più punti; per ogni percorso anche la sua casata vincitrice (in percorsi)
create or replace function admin.chiudi_stagione(p_stagione text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare s text := coalesce(p_stagione, to_char(private.oggi() - 1, 'YYYY-MM')); v text; per jsonb := '{}'::jsonb; r record;
begin
  select constellation_id into v from public.season_scores where stagione = s and percorso = 'app' and punti > 0
    order by punti desc, random() limit 1;
  for r in select distinct percorso from public.season_scores where stagione = s and percorso <> 'app' loop
    per := per || jsonb_build_object(r.percorso, jsonb_build_object(
      'vincitore', (select constellation_id from public.season_scores where stagione = s and percorso = r.percorso and punti > 0
                    order by punti desc, random() limit 1),
      'classifica', (select coalesce(jsonb_agg(jsonb_build_object('casata', constellation_id, 'punti', punti, 'membri', membri_attivi)
                    order by punti desc), '[]'::jsonb) from public.season_scores where stagione = s and percorso = r.percorso)));
  end loop;
  insert into public.seasons (stagione, vincitore, classifica, percorsi)
  select s, v, coalesce(jsonb_agg(jsonb_build_object('casata', constellation_id, 'punti', punti, 'membri', membri_attivi)
                                  order by punti desc), '[]'::jsonb), per
    from public.season_scores where stagione = s and percorso = 'app'
  on conflict (stagione) do nothing;
  return v;
end $$;
revoke all on function admin.chiudi_stagione(text) from public, anon, authenticated;

commit;
