-- Dextera, fase 3 (gestionale), rilascio 1: pagina admin/ con utenti e segnalazioni (Dextera v0.96.0).
-- Da applicare dall'autore dallo SQL Editor DOPO aver pubblicato l'app 0.96.0 e aspettato che si aggiorni: un'app più vecchia
-- non conosce il segno di azzeramento e, sincronizzando, rimanderebbe al server i progressi azzerati.
-- Si può rieseguire (tutto è «if not exists» / «create or replace» / «drop … if exists»).
--
--   staff_role            ruoli del gestionale: 'admin' (amministratore) o 'revisore' (docente, dal rilascio 2), con nome e area.
--                         Parte da dextera_admin (che resta, la usano le funzioni della Flotta): le due tabelle restano allineate
--                         da due trigger, quindi admin.aggiungi_admin('email') continua a funzionare.
--   dextera_admin_note    nota dell'amministratore su una segnalazione di errore ('errore') o dei gruppi ('gruppi').
--   dextera_azzeramenti   segno di un azzeramento dei progressi ('tutto' o l'id di un percorso), con la data: l'app lo legge
--                         alla sincronizzazione e cancella la stessa parte dal telefono prima di unire (account.js).
-- Nessun accesso diretto alle tabelle nuove (salvo leggere i propri azzeramenti): tutto passa da funzioni security definer
-- che controllano private.e_admin() sul server. Chi non è amministratore riceve l'errore con hint 'dextera_admin'.
--
-- Stati delle segnalazioni nella pagina (i valori salvati non cambiano):
--   errori  (error_reports.stato):        aperta = 'aperta', risolta = 'corretta', scartata = 'respinta'
--   gruppi  (dextera_moderazione.stato):  aperta = 'segnalato' o 'nascosto', risolta = 'rimosso', scartata = 'approvato'
--
-- Nota: profiles, mastery, game_results e badge_assertions sono tabelle in comune con BodyMania (stesso account): «azzera tutto»
-- cancella anche lì.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- ---------- 1. tabelle ----------
create table if not exists public.staff_role (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  ruolo        text not null check (ruolo in ('admin', 'revisore')),
  nome         text check (nome is null or char_length(nome) <= 80),
  area         text check (area is null or char_length(area) <= 200),
  aggiunto_il  timestamptz not null default now(),
  aggiunto_da  uuid references auth.users (id) on delete set null
);
create index if not exists staff_role_aggiunto_da on public.staff_role (aggiunto_da);

create table if not exists public.dextera_admin_note (
  tipo        text not null check (tipo in ('errore', 'gruppi')),
  rif         uuid not null,
  nota        text not null check (char_length(nota) between 1 and 1000),
  scritta_da  uuid references auth.users (id) on delete set null,
  scritta_il  timestamptz not null default now(),
  primary key (tipo, rif)
);
create index if not exists dextera_admin_note_da on public.dextera_admin_note (scritta_da);

create table if not exists public.dextera_azzeramenti (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  ambito     text not null check (ambito = 'tutto' or ambito ~ '^[a-z0-9-]{1,40}$'),
  righe      jsonb not null default '{}'::jsonb,
  fatto_da   uuid references auth.users (id) on delete set null,
  creato_il  timestamptz not null default now()
);
create index if not exists dextera_azzeramenti_utente on public.dextera_azzeramenti (user_id, creato_il);
create index if not exists dextera_azzeramenti_da on public.dextera_azzeramenti (fatto_da);

do $$ declare t text; begin
  foreach t in array array['staff_role', 'dextera_admin_note', 'dextera_azzeramenti'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
-- l'app legge solo i propri azzeramenti (id, ambito, data)
grant select (id, user_id, ambito, creato_il) on public.dextera_azzeramenti to authenticated;
drop policy if exists "azzeramenti: si leggono i propri" on public.dextera_azzeramenti;
create policy "azzeramenti: si leggono i propri" on public.dextera_azzeramenti
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- 2. staff_role allineata a dextera_admin ----------
insert into public.staff_role (user_id, ruolo)
  select user_id, 'admin' from public.dextera_admin
  on conflict (user_id) do update set ruolo = 'admin' where public.staff_role.ruolo <> 'admin';

create or replace function private.admin_a_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'INSERT' then
    insert into public.staff_role (user_id, ruolo) values (new.user_id, 'admin')
      on conflict (user_id) do update set ruolo = 'admin' where public.staff_role.user_id = new.user_id;
  else
    delete from public.staff_role where user_id = old.user_id and ruolo = 'admin';
  end if;
  return null;
end $$;
drop trigger if exists admin_a_staff on public.dextera_admin;
create trigger admin_a_staff after insert or delete on public.dextera_admin
  for each row execute function private.admin_a_staff();

create or replace function private.staff_a_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op <> 'INSERT' and old.ruolo = 'admin' and (tg_op = 'DELETE' or new.ruolo <> 'admin') then
    delete from public.dextera_admin where user_id = old.user_id;
  end if;
  if tg_op <> 'DELETE' and new.ruolo = 'admin' then
    insert into public.dextera_admin (user_id) values (new.user_id) on conflict (user_id) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists staff_a_admin on public.staff_role;
create trigger staff_a_admin after insert or update or delete on public.staff_role
  for each row execute function private.staff_a_admin();

-- una segnalazione cancellata (account cancellato) porta via la sua nota
create or replace function private.nota_via() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.dextera_admin_note
    where rif = old.id and tipo = case when tg_table_name = 'error_reports' then 'errore' else 'gruppi' end;
  return null;
end $$;
drop trigger if exists nota_via on public.error_reports;
create trigger nota_via after delete on public.error_reports for each row execute function private.nota_via();
drop trigger if exists nota_via on public.dextera_moderazione;
create trigger nota_via after delete on public.dextera_moderazione for each row execute function private.nota_via();

-- ---------- 3. funzioni ----------
create or replace function private.solo_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := (select auth.uid());
begin
  if u is null or not private.e_admin(u) then
    raise exception 'solo amministratori' using errcode = 'P0001', hint = 'dextera_admin';
  end if;
  return u;
end $$;

-- il mio ruolo (la pagina admin/ lo chiede all'apertura): null se non si è nello staff
create or replace function public.dextera_staff() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ruolo', s.ruolo, 'nome', s.nome, 'area', s.area)
  from public.staff_role s where s.user_id = (select auth.uid())
$$;

-- Utenti: ricerca per nome utente, email o id (almeno 2 caratteri), al massimo 30
create or replace function public.dextera_admin_cerca(p_q text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := btrim(coalesce(p_q, '')); l text; r jsonb;
begin
  perform private.solo_admin();
  if char_length(q) < 2 or char_length(q) > 100 then
    raise exception 'ricerca troppo corta' using errcode = 'P0001', hint = 'dextera_ricerca';
  end if;
  l := '%' || replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select coalesce(jsonb_agg(x order by x->>'nome' nulls last, x->>'email'), '[]'::jsonb) into r from (
    select jsonb_build_object('id', u.id, 'email', u.email, 'nome', p.username, 'xp', coalesce(p.xp, 0),
             'ultimo_giorno', p.last_day, 'cancellato_il', p.deleted_at, 'admin', private.e_admin(u.id)) x
    from auth.users u left join public.profiles p on p.id = u.id
    where lower(coalesce(p.username, '')) like l or lower(coalesce(u.email, '')) like l or u.id::text = lower(q)
    limit 30) y;
  return r;
end $$;

-- Utenti: progressi di una persona, per percorso e in comune
create or replace function public.dextera_admin_utente(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.solo_admin();
  if not exists (select 1 from auth.users where id = p_id) then
    raise exception 'utente inesistente' using errcode = 'P0001', hint = 'dextera_utente';
  end if;
  select jsonb_build_object(
    'profilo', (select jsonb_build_object('id', u.id, 'email', u.email, 'nome', p.username, 'xp', coalesce(p.xp, 0),
                  'giuste', coalesce(p.ok, 0), 'sbagliate', coalesce(p.ko, 0), 'serie', coalesce(p.streak, 0),
                  'ultimo_giorno', p.last_day, 'iscritto_il', p.created_at, 'cancellato_il', p.deleted_at, 'admin', private.e_admin(u.id))
                from auth.users u left join public.profiles p on p.id = u.id where u.id = p_id),
    'percorsi', (select coalesce(jsonb_agg(jsonb_build_object('percorso', k.percorso,
                    'xp', (select x.xp from public.dextera_percorsi_xp x where x.user_id = p_id and x.percorso = k.percorso),
                    'passi_fatti', (select count(*) from public.path_progress g where g.user_id = p_id and g.percorso = k.percorso
                                      and g.node_id like '%.%' and g.stato in ('fatto', 'acceso')),
                    'nodi_accesi', (select count(*) from public.path_progress g where g.user_id = p_id and g.percorso = k.percorso
                                      and g.node_id not like '%.%' and g.stato = 'acceso'),
                    'ultimo', (select max(g.fatto_il) from public.path_progress g where g.user_id = p_id and g.percorso = k.percorso))
                  order by k.percorso <> 'base', k.percorso), '[]'::jsonb)
                 from (select percorso from public.path_progress where user_id = p_id
                       union select percorso from public.dextera_percorsi_xp where user_id = p_id) k),
    'comuni', jsonb_build_object(
       'maestria', (select count(*) from public.mastery where user_id = p_id and level > 0),
       'maestria_piena', (select count(*) from public.mastery where user_id = p_id and level = 3),
       'ripasso', (select count(*) from public.review_items where user_id = p_id),
       'partite', (select count(*) from public.game_results where user_id = p_id),
       'ultima_partita', (select max(played_at) from public.game_results where user_id = p_id),
       'badge', (select count(*) from public.badge_assertions where user_id = p_id),
       'punti_flotta', (select coalesce(sum(punti), 0) from public.fleet_days where user_id = p_id),
       'segnalazioni', (select count(*) from public.error_reports where user_id = p_id)),
    'azzeramenti', (select coalesce(jsonb_agg(jsonb_build_object('ambito', z.ambito, 'il', z.creato_il, 'righe', z.righe,
                       'da', (select p.username from public.profiles p where p.id = z.fatto_da)) order by z.creato_il desc), '[]'::jsonb)
                    from public.dextera_azzeramenti z where z.user_id = p_id)
  ) into r;
  return r;
end $$;

-- Utenti: azzera i progressi di un percorso o tutti. p_conferma deve essere 'AZZERA' (la pagina lo fa scrivere).
-- Un percorso: path_progress e dextera_percorsi_xp di quel percorso; gli XP tolti si tolgono anche dal totale (profiles.xp).
-- Tutto: XP, giuste, sbagliate e serie in profiles; mastery, review_items, path_progress, dextera_percorsi_xp, fleet_days,
-- game_results, badge_assertions (e i badge in vetrina). Restano account, nome, foto, amici, casate, equipaggi, impostazioni.
create or replace function public.dextera_admin_azzera(p_id uuid, p_ambito text, p_conferma text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a uuid := private.solo_admin(); x int := 0; n int; righe jsonb := '{}'::jsonb;
begin
  if p_conferma is distinct from 'AZZERA' then
    raise exception 'conferma mancante' using errcode = 'P0001', hint = 'dextera_conferma';
  end if;
  if p_ambito is null or not (p_ambito = 'tutto' or p_ambito ~ '^[a-z0-9-]{1,40}$') then
    raise exception 'ambito non valido' using errcode = 'P0001', hint = 'dextera_ambito';
  end if;
  if not exists (select 1 from auth.users where id = p_id) then
    raise exception 'utente inesistente' using errcode = 'P0001', hint = 'dextera_utente';
  end if;
  if p_ambito = 'tutto' then
    update public.profiles set xp = 0, ok = 0, ko = 0, streak = 0, last_day = null, updated_at = now() where id = p_id;
    delete from public.mastery where user_id = p_id;              get diagnostics n = row_count; righe := righe || jsonb_build_object('mastery', n);
    delete from public.review_items where user_id = p_id;         get diagnostics n = row_count; righe := righe || jsonb_build_object('review_items', n);
    delete from public.path_progress where user_id = p_id;        get diagnostics n = row_count; righe := righe || jsonb_build_object('path_progress', n);
    delete from public.dextera_percorsi_xp where user_id = p_id;  get diagnostics n = row_count; righe := righe || jsonb_build_object('dextera_percorsi_xp', n);
    delete from public.fleet_days where user_id = p_id;           get diagnostics n = row_count; righe := righe || jsonb_build_object('fleet_days', n);
    delete from public.game_results where user_id = p_id;         get diagnostics n = row_count; righe := righe || jsonb_build_object('game_results', n);
    delete from public.badge_assertions where user_id = p_id;     get diagnostics n = row_count; righe := righe || jsonb_build_object('badge_assertions', n);
    update public.dextera_profili set vetrina = '{}', aggiornato_il = now() where user_id = p_id and cardinality(vetrina) > 0;
  else
    -- XP del percorso; per il percorso base, se non ha una riga, quelli del totale che non sono di altri percorsi (come fa l'app)
    select coalesce((select xp from public.dextera_percorsi_xp where user_id = p_id and percorso = p_ambito),
                    case when p_ambito = 'base' then greatest(0, coalesce((select xp from public.profiles where id = p_id), 0)
                      - coalesce((select sum(xp) from public.dextera_percorsi_xp where user_id = p_id and percorso <> 'base'), 0))::int end, 0)
      into x;
    delete from public.path_progress where user_id = p_id and percorso = p_ambito;  get diagnostics n = row_count; righe := righe || jsonb_build_object('path_progress', n);
    delete from public.dextera_percorsi_xp where user_id = p_id and percorso = p_ambito;
    update public.profiles set xp = greatest(0, xp - x), updated_at = now() where id = p_id and x > 0;
    righe := righe || jsonb_build_object('xp', x);
  end if;
  insert into public.dextera_azzeramenti (user_id, ambito, righe, fatto_da) values (p_id, p_ambito, righe, a);
  return righe;
end $$;

-- Segnalazioni: errori (error_reports) e gruppi (dextera_moderazione) con la nota dell'amministratore.
-- p_stato: 'aperta', 'risolta', 'scartata' o 'tutte'; al massimo 300 per tipo, le più recenti.
create or replace function private.stato_errore(s text) returns text language sql immutable set search_path = '' as $$
  select case s when 'aperta' then 'aperta' when 'corretta' then 'risolta' when 'respinta' then 'scartata' end $$;
create or replace function private.stato_gruppi(s text) returns text language sql immutable set search_path = '' as $$
  select case when s in ('segnalato', 'nascosto') then 'aperta' when s = 'rimosso' then 'risolta' when s = 'approvato' then 'scartata' end $$;

create or replace function public.dextera_admin_segnalazioni(p_stato text default 'aperta') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform private.solo_admin();
  if p_stato is null or p_stato not in ('aperta', 'risolta', 'scartata', 'tutte') then
    raise exception 'stato non valido' using errcode = 'P0001', hint = 'dextera_stato';
  end if;
  select jsonb_build_object(
    'errori', (select coalesce(jsonb_agg(e order by e->>'creato_il' desc), '[]'::jsonb) from (
       select jsonb_build_object('id', s.id, 'dato', s.data_id, 'nota', s.nota, 'valore', s.valore,
                'stato', private.stato_errore(s.stato), 'creato_il', s.creato_il,
                'autore', (select p.username from public.profiles p where p.id = s.user_id),
                'persone', (select count(distinct t.user_id) from public.error_reports t where t.data_id = s.data_id and t.stato = 'aperta'),
                'aperte_stesso_dato', (select count(*) from public.error_reports t where t.data_id = s.data_id and t.stato = 'aperta' and t.id <> s.id),
                'nota_admin', n.nota, 'nota_il', n.scritta_il, 'nota_da', (select p.username from public.profiles p where p.id = n.scritta_da)) e
       from public.error_reports s left join public.dextera_admin_note n on n.tipo = 'errore' and n.rif = s.id
       where p_stato = 'tutte' or private.stato_errore(s.stato) = p_stato
       order by s.creato_il desc limit 300) a),
    'gruppi', (select coalesce(jsonb_agg(g order by g->>'creato_il' desc), '[]'::jsonb) from (
       select jsonb_build_object('id', m.id, 'tipo', m.tipo, 'stato', private.stato_gruppi(m.stato), 'nascosto', m.stato = 'nascosto',
                'creato_il', m.creato_il, 'deciso_il', m.deciso_il, 'autore', private.nome(m.autore),
                'gruppo', coalesce((select k.nome from public.constellations k where k.id = x.casata), (select c.nome from public.crews c where c.id = x.crew_id),
                                   'Copertina di ' || coalesce(private.nome(m.utente), '?')),
                'contenuto', case when m.stato = 'nascosto' then m.contenuto
                                  when m.stato <> 'segnalato' then null
                                  when m.tipo = 'annuncio' and md5(x.annuncio) = m.impronta then x.annuncio
                                  when m.tipo = 'banner' and md5(x.banner_img) = m.impronta then x.banner_img
                                  when m.tipo = 'copertina' then (select p.copertina_img from public.dextera_profili p where p.user_id = m.utente and md5(p.copertina_img) = m.impronta) end,
                'segnalazioni', (select count(*) from public.dextera_segnalazioni s where s.moderazione_id = m.id),
                'motivi', (select coalesce(jsonb_agg(s.motivo) filter (where s.motivo is not null), '[]'::jsonb) from public.dextera_segnalazioni s where s.moderazione_id = m.id),
                'nota_admin', n.nota, 'nota_il', n.scritta_il, 'nota_da', (select p.username from public.profiles p where p.id = n.scritta_da)) g
       from public.dextera_moderazione m left join public.dextera_bacheche x on x.id = m.bacheca_id
         left join public.dextera_admin_note n on n.tipo = 'gruppi' and n.rif = m.id
       where p_stato = 'tutte' or private.stato_gruppi(m.stato) = p_stato
       order by m.creato_il desc limit 300) b),
    'conta', jsonb_build_object(
       'errori', (select count(*) from public.error_reports where stato = 'aperta'),
       'gruppi', (select count(*) from public.dextera_moderazione where stato in ('segnalato', 'nascosto')))
  ) into r;
  return r;
end $$;

-- Segnalazioni: cambia lo stato e/o la nota. p_tipo 'errore' o 'gruppi'; p_stato null = lascia lo stato; p_nota null = lascia la
-- nota, '' = la toglie. Errori: ogni stato si può cambiare (anche riaprire); p_stesso_dato = anche le altre segnalazioni aperte sullo
-- stesso dato. Gruppi: risolta = «rimuovi», scartata = «approva» (private.modera della v0.94: decisione per sempre).
create or replace function public.dextera_admin_segnalazione(p_tipo text, p_id uuid, p_stato text, p_nota text,
  p_stesso_dato boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare a uuid := private.solo_admin(); d text; v text; m text;
begin
  if p_tipo = 'errore' then
    select data_id into d from public.error_reports where id = p_id;
    if d is null then raise exception 'segnalazione inesistente' using errcode = 'P0001', hint = 'dextera_segnalazione'; end if;
    if p_stato is not null then
      v := case p_stato when 'aperta' then 'aperta' when 'risolta' then 'corretta' when 'scartata' then 'respinta' end;
      if v is null then raise exception 'stato non valido' using errcode = 'P0001', hint = 'dextera_stato'; end if;
      update public.error_reports set stato = v
        where id = p_id or (coalesce(p_stesso_dato, false) and data_id = d and stato = 'aperta');
    end if;
  elsif p_tipo = 'gruppi' then
    select stato into m from public.dextera_moderazione where id = p_id;
    if m is null then raise exception 'segnalazione inesistente' using errcode = 'P0001', hint = 'dextera_segnalazione'; end if;
    if p_stato is not null and p_stato is distinct from private.stato_gruppi(m) then
      if p_stato = 'risolta' then perform private.modera(p_id, 'rimuovi', a);
      elsif p_stato = 'scartata' then perform private.modera(p_id, 'approva', a);
      else raise exception 'già deciso' using errcode = 'P0001', hint = 'dextera_deciso'; end if;
    end if;
  else
    raise exception 'tipo non valido' using errcode = 'P0001', hint = 'dextera_tipo';
  end if;
  if p_nota is not null then
    if btrim(p_nota) = '' then
      delete from public.dextera_admin_note where tipo = p_tipo and rif = p_id;
    else
      insert into public.dextera_admin_note (tipo, rif, nota, scritta_da) values (p_tipo, p_id, left(btrim(p_nota), 1000), a)
        on conflict (tipo, rif) do update set nota = excluded.nota, scritta_da = excluded.scritta_da, scritta_il = now();
    end if;
  end if;
  return 'ok';
end $$;

-- ---------- 4. permessi ----------
revoke all on function private.admin_a_staff(), private.staff_a_admin(), private.nota_via(), private.solo_admin(),
  private.stato_errore(text), private.stato_gruppi(text) from public, anon, authenticated;
revoke all on function public.dextera_staff(), public.dextera_admin_cerca(text), public.dextera_admin_utente(uuid),
  public.dextera_admin_azzera(uuid, text, text), public.dextera_admin_segnalazioni(text),
  public.dextera_admin_segnalazione(text, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.dextera_staff(), public.dextera_admin_cerca(text), public.dextera_admin_utente(uuid),
  public.dextera_admin_azzera(uuid, text, text), public.dextera_admin_segnalazioni(text),
  public.dextera_admin_segnalazione(text, uuid, text, text, boolean) to authenticated;

commit;
