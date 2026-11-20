-- Dextera, pagina dei gruppi (sezione 6 della specifica, decisioni dell'autore del 19/11 e del 20/11/2026):
--   voto di capo e vice in ogni casata (casata grande e casata del percorso), annunci e banner di casate ed equipaggi,
--   copertina del profilo caricata, segnalazioni con controllo di un amministratore.
-- Si applica dopo 20261127090000_dextera_casate.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Prima va pubblicata l'app 0.94.0 (le app di prima non usano niente di questo file; la 0.94.0 senza il file dice che manca).
--
-- Le tabelle di BodyMania non cambiano. Tabelle nuove (RLS attiva e nessun permesso diretto: si usano solo con le funzioni
-- dextera_* qui sotto, che controllano chi chiama):
--   dextera_voto_finestre  quando si vota: di regola dal 1° al 7 del mese (ora italiana); una riga cambia le date di una stagione
--   dextera_voti           il voto di ognuno, per stagione e casata (si vede solo il proprio)
--   dextera_capi           capo e vice eletti di ogni casata per stagione (valgono fino al voto successivo)
--   dextera_bacheche       annuncio e banner di una casata o di un equipaggio
--   dextera_moderazione    contenuti segnalati (annuncio, banner, copertina): impronta, stato, copia finché è nascosto
--   dextera_segnalazioni   chi ha segnalato cosa (si cancellano quando l'amministratore decide)
--   dextera_admin          amministratori (li aggiunge l'autore dallo SQL Editor)
-- Su dextera_profili (tabella di Dextera): colonna copertina_img (immagine caricata) e copertine nuove della galleria.
--
-- Regole:
--   voto     si vota un membro attivo della propria casata (punti negli ultimi 35 giorni), non se stessi; si può cambiare fino
--            alla chiusura. Contano i voti di chi è ancora nella casata per chi è ancora nella casata. Più voti = capo, secondo =
--            vice; a parità decide il server a caso (parita = true: l'app mostra la moneta). Nessun voto = nessun capo.
--            Il primo voto si apre quando si applica il file e dura 7 giorni.
--   bacheca  annuncio (al massimo 280 caratteri) e banner li cambiano capo e vice: della casata gli eletti (se sono ancora nella
--            casata), dell'equipaggio quelli di crews. La leggono solo i membri.
--   segnala  2 segnalazioni di persone diverse nascondono il contenuto finché un amministratore non decide: «rimuovi» lo toglie
--            per sempre (non si può rimettere uguale), «approva» lo rimette (e non si può più nascondere con le segnalazioni).
-- Nessun update senza where (l'estensione safeupdate di Supabase li rifiuta).
--
-- Comandi utili nel SQL Editor:
--   select admin.aggiungi_admin('indirizzo@email');                  -- rende amministratore un account (vede «Controllo» nel profilo)
--   select * from admin.segnalazioni_flotta;                          -- contenuti segnalati
--   select public.dextera_modera_admin('<id>', 'rimuovi' | 'approva'); -- decide dallo SQL Editor
--   insert into public.dextera_voto_finestre (stagione, apre, chiude) values ('2026-12', '2026-12-01', '2026-12-10')
--     on conflict (stagione) do update set apre = excluded.apre, chiude = excluded.chiude;   -- cambia le date di un voto
--   select private.chiudi_voti_scaduti();                             -- chiude i voti finiti (lo fa pg_cron ogni notte)

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- ---------- 1. tabelle ----------
create table if not exists public.dextera_voto_finestre (
  stagione   text primary key check (stagione ~ '^[0-9]{4}-[0-9]{2}$'),
  apre       date not null,
  chiude     date not null,
  chiusa_il  timestamptz,
  check (chiude >= apre)
);
create table if not exists public.dextera_voti (
  stagione         text not null check (stagione ~ '^[0-9]{4}-[0-9]{2}$'),
  constellation_id text not null references public.constellations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  candidato        uuid not null references auth.users (id) on delete cascade,
  votato_il        timestamptz not null default now(),
  primary key (stagione, constellation_id, user_id)
);
create index if not exists dextera_voti_candidato on public.dextera_voti (candidato);
create index if not exists dextera_voti_utente on public.dextera_voti (user_id);
create table if not exists public.dextera_capi (
  stagione         text not null check (stagione ~ '^[0-9]{4}-[0-9]{2}$'),
  constellation_id text not null references public.constellations (id) on delete cascade,
  capo             uuid references auth.users (id) on delete set null,
  vice             uuid references auth.users (id) on delete set null,
  voti_capo        integer not null default 0,
  voti_vice        integer not null default 0,
  parita           boolean not null default false,
  chiusa_il        timestamptz not null default now(),
  primary key (stagione, constellation_id)
);
create index if not exists dextera_capi_capo on public.dextera_capi (capo);
create index if not exists dextera_capi_vice on public.dextera_capi (vice);
create table if not exists public.dextera_bacheche (
  id           uuid primary key default gen_random_uuid(),
  casata       text unique references public.constellations (id) on delete cascade,
  crew_id      uuid unique references public.crews (id) on delete cascade,
  annuncio     text check (annuncio is null or char_length(annuncio) between 1 and 280),
  annuncio_da  uuid references auth.users (id) on delete set null,
  annuncio_il  timestamptz,
  banner       text not null default 'notte' check (banner ~ '^[a-z]{1,20}$'),
  banner_img   text check (banner_img is null or (length(banner_img) <= 120000
                 and banner_img ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
  banner_da    uuid references auth.users (id) on delete set null,
  banner_il    timestamptz,
  check ((casata is null) <> (crew_id is null))
);
create index if not exists dextera_bacheche_annuncio_da on public.dextera_bacheche (annuncio_da);
create index if not exists dextera_bacheche_banner_da on public.dextera_bacheche (banner_da);
create table if not exists public.dextera_moderazione (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('annuncio', 'banner', 'copertina')),
  bacheca_id  uuid references public.dextera_bacheche (id) on delete cascade,
  utente      uuid references auth.users (id) on delete cascade,
  autore      uuid references auth.users (id) on delete set null,
  impronta    text not null,
  contenuto   text,
  stato       text not null default 'segnalato' check (stato in ('segnalato', 'nascosto', 'rimosso', 'approvato')),
  creato_il   timestamptz not null default now(),
  deciso_il   timestamptz,
  deciso_da   uuid references auth.users (id) on delete set null,
  check ((bacheca_id is null) <> (utente is null))
);
create unique index if not exists dextera_moderazione_uno
  on public.dextera_moderazione (tipo, coalesce(bacheca_id::text, utente::text), impronta);
create index if not exists dextera_moderazione_autore on public.dextera_moderazione (autore);
create index if not exists dextera_moderazione_utente on public.dextera_moderazione (utente);
create index if not exists dextera_moderazione_deciso on public.dextera_moderazione (deciso_da);
create table if not exists public.dextera_segnalazioni (
  moderazione_id uuid not null references public.dextera_moderazione (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  motivo         text check (motivo is null or char_length(motivo) <= 200),
  creato_il      timestamptz not null default now(),
  primary key (moderazione_id, user_id)
);
create index if not exists dextera_segnalazioni_utente on public.dextera_segnalazioni (user_id);
create table if not exists public.dextera_admin (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  aggiunto_il timestamptz not null default now()
);

-- nessun accesso diretto: solo le funzioni qui sotto
do $$ declare t text; begin
  foreach t in array array['dextera_voto_finestre', 'dextera_voti', 'dextera_capi', 'dextera_bacheche',
                           'dextera_moderazione', 'dextera_segnalazioni', 'dextera_admin'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- copertina del profilo caricata e copertine nuove della galleria
alter table public.dextera_profili add column if not exists copertina_img text;
alter table public.dextera_profili drop constraint if exists dextera_profili_copertina_check;
alter table public.dextera_profili add constraint dextera_profili_copertina_check check (copertina ~ '^[a-z]{1,20}$');
alter table public.dextera_profili drop constraint if exists dextera_profili_copertina_img_check;
alter table public.dextera_profili add constraint dextera_profili_copertina_img_check check (copertina_img is null or
  (length(copertina_img) <= 120000 and copertina_img ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/=]+$'));
grant insert (copertina_img) on public.dextera_profili to authenticated;
grant update (copertina_img) on public.dextera_profili to authenticated;

-- ---------- 2. aiuti ----------
create or replace function private.stagione() returns text
language sql stable set search_path = '' as $$ select to_char(private.oggi(), 'YYYY-MM') $$;

-- membri di una casata: del percorso completo in constellation_members, le altre in dextera_casate
create or replace function private.membri_casata(k text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.constellation_members m join public.constellations c on c.id = m.constellation_id
    where c.id = k and c.ambito = 'base'
  union
  select d.user_id from public.dextera_casate d join public.constellations c on c.id = d.constellation_id and c.ambito = d.ambito
    where c.id = k and c.ambito <> 'base'
$$;
create or replace function private.membro_casata(u uuid, k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.constellations c where c.id = k and (
    (c.ambito = 'base' and exists (select 1 from public.constellation_members m where m.user_id = u and m.constellation_id = k)) or
    (c.ambito <> 'base' and exists (select 1 from public.dextera_casate d where d.user_id = u and d.ambito = c.ambito
                                                                         and d.constellation_id = k))))
$$;
-- si possono votare: membri con un nome, account attivo e punti negli ultimi 35 giorni
create or replace function private.candidati(k text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select u from private.membri_casata(k) u
    where exists (select 1 from public.profiles p where p.id = u and p.username is not null and p.deleted_at is null)
      and exists (select 1 from public.fleet_days d where d.user_id = u and d.punti > 0 and d.giorno >= private.oggi() - 35)
$$;
-- date del voto di una stagione: la riga di dextera_voto_finestre, altrimenti dal 1° al 7 del mese
create or replace function private.finestra(s text, out apre date, out chiude date, out chiusa boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(f.apre, to_date(s || '-01', 'YYYY-MM-DD')), coalesce(f.chiude, to_date(s || '-07', 'YYYY-MM-DD')),
         f.chiusa_il is not null
    from (select 1) x left join public.dextera_voto_finestre f on f.stagione = s
$$;
create or replace function private.voto_aperto(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not w.chiusa and private.oggi() between w.apre and w.chiude from private.finestra(s) w
$$;
-- capo e vice in carica: gli ultimi eletti (fino al voto successivo)
create or replace function private.capi(k text) returns public.dextera_capi
language sql stable security definer set search_path = '' as $$
  select * from public.dextera_capi where constellation_id = k and stagione <= private.stagione()
    order by stagione desc limit 1
$$;
create or replace function private.e_admin(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.dextera_admin where user_id = u) $$;
-- chi può cambiare annuncio e banner: capo e vice eletti ancora nella casata, capo e vice dell'equipaggio
create or replace function private.puo_gestire(u uuid, k text, c uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare r public.dextera_capi;
begin
  if u is null then return false; end if;
  if c is not null then
    return exists (select 1 from public.crews where id = c and u in (capo, vice) and u = any (membri_ids));
  end if;
  r := private.capi(k);
  return r.constellation_id is not null and u in (r.capo, r.vice) and private.membro_casata(u, k);
end $$;
-- chi può vedere (e segnalare) una bacheca: i membri della casata o dell'equipaggio
create or replace function private.vede_bacheca(u uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.dextera_bacheche x where x.id = b and (
    (x.casata is not null and private.membro_casata(u, x.casata)) or
    (x.crew_id is not null and exists (select 1 from public.crews c where c.id = x.crew_id and u = any (c.membri_ids)))))
$$;
create or replace function private.bacheca_di(k text, c uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  if c is not null then
    insert into public.dextera_bacheche (crew_id) values (c) on conflict (crew_id) do nothing;
    select id into b from public.dextera_bacheche where crew_id = c;
  else
    insert into public.dextera_bacheche (casata) values (k) on conflict (casata) do nothing;
    select id into b from public.dextera_bacheche where casata = k;
  end if;
  return b;
end $$;
-- contenuto tolto o in attesa di controllo: non si può rimettere uguale
create or replace function private.bloccato(t text, b uuid, u uuid, x text) returns boolean
language sql stable security definer set search_path = '' as $$
  select x is not null and exists (select 1 from public.dextera_moderazione m where m.tipo = t and m.impronta = md5(x)
    and m.stato in ('nascosto', 'rimosso') and coalesce(m.bacheca_id::text, m.utente::text) = coalesce(b::text, u::text))
$$;
create or replace function private.nome(u uuid) returns text
language sql stable security definer set search_path = '' as $$ select username from public.profiles where id = u and deleted_at is null $$;

-- ---------- 3. chiusura del voto ----------
-- per ogni stagione con il voto finito e non ancora chiuso: capo e vice di ogni casata votata
create or replace function private.chiudi_voti_scaduti() returns integer
language plpgsql security definer set search_path = '' as $$
declare s text; k text; n integer := 0; r record; i integer; c1 uuid; v1 integer; c2 uuid; v2 integer;
begin
  -- annunci e banner di account cancellati (dopo i 30 giorni): si tolgono
  update public.dextera_bacheche set annuncio = null, annuncio_il = null where annuncio is not null and annuncio_da is null;
  update public.dextera_bacheche set banner_img = null, banner_il = null where banner_img is not null and banner_da is null;
  for s in select distinct v.stagione from public.dextera_voti v
           union select f.stagione from public.dextera_voto_finestre f where f.chiusa_il is null loop
    if (select w.chiusa or private.oggi() <= w.chiude from private.finestra(s) w) then continue; end if;
    for k in select distinct v.constellation_id from public.dextera_voti v where v.stagione = s loop
      c1 := null; v1 := 0; c2 := null; v2 := 0; i := 0;
      for r in select v.candidato, count(*)::integer as voti from public.dextera_voti v
               where v.stagione = s and v.constellation_id = k
                 and private.membro_casata(v.user_id, k) and private.membro_casata(v.candidato, k)
               group by v.candidato order by count(*) desc, random() loop
        i := i + 1;
        if i = 1 then c1 := r.candidato; v1 := r.voti; elsif i = 2 then c2 := r.candidato; v2 := r.voti; else exit; end if;
      end loop;
      if c1 is not null then
        insert into public.dextera_capi (stagione, constellation_id, capo, vice, voti_capo, voti_vice, parita)
        values (s, k, c1, c2, v1, v2, c2 is not null and v2 = v1)
        on conflict (stagione, constellation_id) do nothing;
        n := n + 1;
      end if;
    end loop;
    insert into public.dextera_voto_finestre (stagione, apre, chiude, chiusa_il)
      select s, w.apre, w.chiude, now() from private.finestra(s) w
      on conflict (stagione) do update set chiusa_il = now() where public.dextera_voto_finestre.stagione = s;
  end loop;
  return n;
end $$;

-- il primo voto si apre oggi e dura 7 giorni (se oggi è già dopo il 7 del mese)
insert into public.dextera_voto_finestre (stagione, apre, chiude)
  select private.stagione(), private.oggi(), private.oggi() + 6 where extract(day from private.oggi()) > 7
  on conflict (stagione) do nothing;

-- ---------- 4. funzioni per l'app ----------
-- tutto quello che serve alla Flotta: casate con capi, voto e bacheca; bacheche degli equipaggi; se si è amministratori
create or replace function public.dextera_gruppi() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); s text; w record; ks jsonb := '[]'::jsonb; cs jsonb := '[]'::jsonb;
        k record; c record; r public.dextera_capi; b public.dextera_bacheche; ids uuid[] := '{}'; mio uuid; cand jsonb;
begin
  if u is null then raise exception 'serve l''accesso' using errcode = '42501'; end if;
  perform private.chiudi_voti_scaduti();
  s := private.stagione();
  select * into w from private.finestra(s);
  for k in select x.id, x.ambito from public.constellations x where private.membro_casata(u, x.id) order by x.ambito, x.ordine loop
    r := private.capi(k.id);
    select * into b from public.dextera_bacheche where casata = k.id;
    select v.candidato into mio from public.dextera_voti v where v.stagione = s and v.constellation_id = k.id and v.user_id = u;
    cand := null;
    if private.voto_aperto(s) then
      select coalesce(jsonb_agg(jsonb_build_object('id', x, 'nome', private.nome(x)) order by private.nome(x)), '[]'::jsonb)
        into cand from private.candidati(k.id) x where x <> u;
    end if;
    ids := ids || r.capo || r.vice || b.annuncio_da;
    ks := ks || jsonb_build_object('casata', k.id, 'ambito', k.ambito,
      'capi', case when r.constellation_id is null then null else jsonb_build_object('stagione', r.stagione, 'capo', r.capo,
              'vice', r.vice, 'parita', r.parita, 'voti_capo', r.voti_capo, 'voti_vice', r.voti_vice, 'chiusa_il', r.chiusa_il) end,
      'voto', jsonb_build_object('stagione', s, 'apre', w.apre, 'chiude', w.chiude, 'aperto', private.voto_aperto(s),
              'mio', mio, 'candidati', cand),
      'puo', private.puo_gestire(u, k.id, null),
      'annuncio', case when b.annuncio_da is not null then b.annuncio end, 'annuncio_da', b.annuncio_da, 'annuncio_il', b.annuncio_il,
      'banner', coalesce(b.banner, 'notte'), 'banner_img', case when b.banner_da is not null then b.banner_img end);
  end loop;
  for c in select x.id from public.crews x where u = any (x.membri_ids) loop
    select * into b from public.dextera_bacheche where crew_id = c.id;
    ids := ids || b.annuncio_da;
    cs := cs || jsonb_build_object('crew', c.id, 'puo', private.puo_gestire(u, null, c.id),
      'annuncio', case when b.annuncio_da is not null then b.annuncio end, 'annuncio_da', b.annuncio_da, 'annuncio_il', b.annuncio_il,
      'banner', coalesce(b.banner, 'notte'), 'banner_img', case when b.banner_da is not null then b.banner_img end);
  end loop;
  return jsonb_build_object('stagione', s, 'casate', ks, 'equipaggi', cs, 'admin', private.e_admin(u),
    'nomi', (select coalesce(jsonb_object_agg(x, private.nome(x)), '{}'::jsonb) from (select distinct x from unnest(ids) x where x is not null) y));
end $$;

-- voto (candidato vuoto = ritira il voto)
create or replace function public.dextera_vota(p_casata text, p_candidato uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); s text := private.stagione();
begin
  if u is null then raise exception 'serve l''accesso' using errcode = '42501'; end if;
  if not private.voto_aperto(s) then raise exception 'voto chiuso' using errcode = 'P0001', hint = 'dextera_voto_chiuso'; end if;
  if not private.membro_casata(u, p_casata) then raise exception 'non sei in questa casata' using errcode = 'P0001', hint = 'dextera_non_membro'; end if;
  if p_candidato is null then
    delete from public.dextera_voti where stagione = s and constellation_id = p_casata and user_id = u;
    return 'ritirato';
  end if;
  if p_candidato = u then raise exception 'non si vota se stessi' using errcode = 'P0001', hint = 'dextera_voto_se'; end if;
  if not exists (select 1 from private.candidati(p_casata) x where x = p_candidato) then
    raise exception 'persona non votabile' using errcode = 'P0001', hint = 'dextera_candidato';
  end if;
  insert into public.dextera_voti (stagione, constellation_id, user_id, candidato) values (s, p_casata, u, p_candidato)
    on conflict (stagione, constellation_id, user_id) do update set candidato = excluded.candidato, votato_il = now()
    where public.dextera_voti.user_id = u;
  return 'votato';
end $$;

-- annuncio (testo vuoto = lo toglie)
create or replace function public.dextera_annuncio(p_casata text, p_crew uuid, p_testo text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); t text := nullif(btrim(coalesce(p_testo, '')), ''); b uuid;
begin
  if not private.puo_gestire(u, p_casata, p_crew) then
    raise exception 'solo capo e vice' using errcode = 'P0001', hint = 'dextera_non_capo';
  end if;
  if char_length(t) > 280 then raise exception 'annuncio troppo lungo' using errcode = 'P0001', hint = 'dextera_lungo'; end if;
  b := private.bacheca_di(case when p_crew is null then p_casata end, p_crew);
  if private.bloccato('annuncio', b, null, t) then raise exception 'annuncio tolto' using errcode = 'P0001', hint = 'dextera_rimosso'; end if;
  update public.dextera_bacheche set annuncio = t, annuncio_da = case when t is null then null else u end,
    annuncio_il = case when t is null then null else now() end where id = b;
  return 'ok';
end $$;

-- banner: uno della galleria e, a scelta, un'immagine caricata (vuota = si torna alla galleria)
create or replace function public.dextera_banner(p_casata text, p_crew uuid, p_banner text, p_img text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); i text := nullif(p_img, ''); b uuid;
begin
  if not private.puo_gestire(u, p_casata, p_crew) then
    raise exception 'solo capo e vice' using errcode = 'P0001', hint = 'dextera_non_capo';
  end if;
  b := private.bacheca_di(case when p_crew is null then p_casata end, p_crew);
  if private.bloccato('banner', b, null, i) then raise exception 'immagine tolta' using errcode = 'P0001', hint = 'dextera_rimosso'; end if;
  update public.dextera_bacheche set banner = coalesce(nullif(p_banner, ''), banner), banner_img = i,
    banner_da = case when i is null then null else u end, banner_il = case when i is null then null else now() end where id = b;
  return 'ok';
end $$;

-- copertina del profilo: un'immagine tolta non si rimette (si toglie in silenzio e il server diventa la modifica più recente)
create or replace function private.copertina_controllo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.copertina_img is not null and private.bloccato('copertina', null, new.user_id, new.copertina_img) then
    new.copertina_img := null; new.aggiornato_il := now();
  end if;
  return new;
end $$;
revoke all on function private.copertina_controllo() from public, anon, authenticated;
drop trigger if exists copertina_controllo on public.dextera_profili;
create trigger copertina_controllo before insert or update on public.dextera_profili
  for each row execute function private.copertina_controllo();

-- segnalazione: 2 persone diverse nascondono il contenuto finché un amministratore non decide
create or replace function public.dextera_segnala(p_tipo text, p_casata text, p_crew uuid, p_utente uuid, p_motivo text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); b uuid; x text; a uuid; m public.dextera_moderazione; n integer;
begin
  if u is null then raise exception 'serve l''accesso' using errcode = '42501'; end if;
  if p_tipo in ('annuncio', 'banner') then
    select id into b from public.dextera_bacheche where (p_crew is not null and crew_id = p_crew) or (p_crew is null and casata = p_casata);
    if b is null or not private.vede_bacheca(u, b) then raise exception 'non visibile' using errcode = 'P0001', hint = 'dextera_non_membro'; end if;
    if p_tipo = 'annuncio' then select annuncio, annuncio_da into x, a from public.dextera_bacheche where id = b;
    else select banner_img, banner_da into x, a from public.dextera_bacheche where id = b; end if;
  elsif p_tipo = 'copertina' then
    if p_utente is null or p_utente = u or not exists (select 1 from public.friendships f where f.status = 'accepted' and (
         (f.user_id = u and f.friend_id = p_utente) or (f.friend_id = u and f.user_id = p_utente))) then
      raise exception 'non visibile' using errcode = 'P0001', hint = 'dextera_non_membro';
    end if;
    select copertina_img into x from public.dextera_profili where user_id = p_utente; a := p_utente;
  else
    raise exception 'tipo sconosciuto' using errcode = 'P0001', hint = 'dextera_tipo';
  end if;
  if x is null or a is null then raise exception 'niente da segnalare' using errcode = 'P0001', hint = 'dextera_nulla'; end if;
  if a = u then raise exception 'è un tuo contenuto' using errcode = 'P0001', hint = 'dextera_tuo'; end if;
  insert into public.dextera_moderazione (tipo, bacheca_id, utente, autore, impronta)
    values (p_tipo, b, case when b is null then p_utente end, a, md5(x))
    on conflict (tipo, coalesce(bacheca_id::text, utente::text), impronta) do nothing;
  select * into m from public.dextera_moderazione where tipo = p_tipo and impronta = md5(x)
    and coalesce(bacheca_id::text, utente::text) = coalesce(b::text, p_utente::text);
  if m.stato <> 'segnalato' then return m.stato; end if;
  insert into public.dextera_segnalazioni (moderazione_id, user_id, motivo) values (m.id, u, left(nullif(btrim(p_motivo), ''), 200))
    on conflict (moderazione_id, user_id) do nothing;
  select count(*) into n from public.dextera_segnalazioni where moderazione_id = m.id;
  if n >= 2 then
    update public.dextera_moderazione set stato = 'nascosto', contenuto = x where id = m.id;
    if p_tipo = 'annuncio' then update public.dextera_bacheche set annuncio = null, annuncio_da = null, annuncio_il = null where id = b;
    elsif p_tipo = 'banner' then update public.dextera_bacheche set banner_img = null, banner_da = null, banner_il = null where id = b;
    else update public.dextera_profili set copertina_img = null, aggiornato_il = now() where user_id = p_utente; end if;
    return 'nascosto';
  end if;
  return 'segnalato';
end $$;

-- decisione dell'amministratore: 'rimuovi' = tolto per sempre, 'approva' = rimesso e protetto dalle segnalazioni
create or replace function private.modera(p_id uuid, p_azione text, chi uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare m public.dextera_moderazione; x text;
begin
  select * into m from public.dextera_moderazione where id = p_id;
  if m.id is null or m.stato not in ('segnalato', 'nascosto') then
    raise exception 'già deciso o inesistente' using errcode = 'P0001', hint = 'dextera_deciso';
  end if;
  if p_azione = 'rimuovi' then
    if m.stato = 'segnalato' then -- ancora visibile: si toglie ora se è lo stesso contenuto
      if m.tipo = 'annuncio' then update public.dextera_bacheche set annuncio = null, annuncio_da = null, annuncio_il = null
        where id = m.bacheca_id and md5(annuncio) = m.impronta;
      elsif m.tipo = 'banner' then update public.dextera_bacheche set banner_img = null, banner_da = null, banner_il = null
        where id = m.bacheca_id and md5(banner_img) = m.impronta;
      else update public.dextera_profili set copertina_img = null, aggiornato_il = now()
        where user_id = m.utente and md5(copertina_img) = m.impronta; end if;
    end if;
    update public.dextera_moderazione set stato = 'rimosso', contenuto = null, deciso_il = now(), deciso_da = chi where id = m.id;
  elsif p_azione = 'approva' then
    x := m.contenuto; -- prima lo stato (così il controllo della copertina non lo toglie di nuovo), poi si rimette
    update public.dextera_moderazione set stato = 'approvato', contenuto = null, deciso_il = now(), deciso_da = chi where id = m.id;
    if m.stato = 'nascosto' and x is not null then -- se nel frattempo non è stato messo altro
      if m.tipo = 'annuncio' then update public.dextera_bacheche set annuncio = x, annuncio_da = m.autore, annuncio_il = now()
        where id = m.bacheca_id and annuncio is null and m.autore is not null;
      elsif m.tipo = 'banner' then update public.dextera_bacheche set banner_img = x, banner_da = m.autore, banner_il = now()
        where id = m.bacheca_id and banner_img is null and m.autore is not null;
      else update public.dextera_profili set copertina_img = x, aggiornato_il = now()
        where user_id = m.utente and copertina_img is null; end if;
    end if;
  else
    raise exception 'azione sconosciuta' using errcode = 'P0001', hint = 'dextera_azione';
  end if;
  delete from public.dextera_segnalazioni where moderazione_id = m.id;
  return p_azione;
end $$;
create or replace function public.dextera_modera(p_id uuid, p_azione text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid());
begin
  if not private.e_admin(u) then raise exception 'solo amministratori' using errcode = 'P0001', hint = 'dextera_admin'; end if;
  return private.modera(p_id, p_azione, u);
end $$;
-- dallo SQL Editor (senza account): stessa decisione
create or replace function public.dextera_modera_admin(p_id uuid, p_azione text) returns text
language plpgsql security definer set search_path = '' as $$
begin return private.modera(p_id, p_azione, null); end $$;

-- elenco per l'amministratore: contenuti segnalati o nascosti, con il testo o l'immagine, chi l'ha messo e i motivi
create or replace function private.lista_moderazione() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'stato', m.stato, 'creato_il', m.creato_il,
    'autore', private.nome(m.autore),
    'gruppo', coalesce((select k.nome from public.constellations k where k.id = x.casata), (select c.nome from public.crews c where c.id = x.crew_id),
                       'Copertina di ' || coalesce(private.nome(m.utente), '?')),
    'contenuto', case when m.stato = 'nascosto' then m.contenuto
                      when m.tipo = 'annuncio' and md5(x.annuncio) = m.impronta then x.annuncio
                      when m.tipo = 'banner' and md5(x.banner_img) = m.impronta then x.banner_img
                      when m.tipo = 'copertina' then (select p.copertina_img from public.dextera_profili p where p.user_id = m.utente and md5(p.copertina_img) = m.impronta) end,
    'segnalazioni', (select count(*) from public.dextera_segnalazioni s where s.moderazione_id = m.id),
    'motivi', (select coalesce(jsonb_agg(s.motivo) filter (where s.motivo is not null), '[]'::jsonb) from public.dextera_segnalazioni s where s.moderazione_id = m.id))
    order by (m.stato = 'nascosto') desc, m.creato_il), '[]'::jsonb)
  from public.dextera_moderazione m left join public.dextera_bacheche x on x.id = m.bacheca_id
  where m.stato in ('segnalato', 'nascosto')
$$;
create or replace function public.dextera_moderazione() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.e_admin((select auth.uid())) then raise exception 'solo amministratori' using errcode = 'P0001', hint = 'dextera_admin'; end if;
  return private.lista_moderazione();
end $$;

-- i miei dati (per «Scarica i miei dati»): voti, capi, annunci e banner messi, segnalazioni fatte
create or replace function public.dextera_miei_gruppi() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'voti', (select coalesce(jsonb_agg(jsonb_build_object('stagione', stagione, 'casata', constellation_id, 'candidato', private.nome(candidato), 'votato_il', votato_il)), '[]'::jsonb)
             from public.dextera_voti where user_id = (select auth.uid())),
    'eletto', (select coalesce(jsonb_agg(jsonb_build_object('stagione', stagione, 'casata', constellation_id, 'ruolo', case when capo = (select auth.uid()) then 'capo' else 'vice' end)), '[]'::jsonb)
               from public.dextera_capi where (select auth.uid()) in (capo, vice)),
    'annunci', (select coalesce(jsonb_agg(jsonb_build_object('casata', casata, 'equipaggio', crew_id, 'testo', annuncio, 'il', annuncio_il)), '[]'::jsonb)
                from public.dextera_bacheche where annuncio_da = (select auth.uid())),
    'banner_caricati', (select coalesce(jsonb_agg(jsonb_build_object('casata', casata, 'equipaggio', crew_id, 'il', banner_il)), '[]'::jsonb)
                        from public.dextera_bacheche where banner_da = (select auth.uid())),
    'segnalazioni_fatte', (select coalesce(jsonb_agg(jsonb_build_object('tipo', m.tipo, 'motivo', s.motivo, 'il', s.creato_il)), '[]'::jsonb)
                           from public.dextera_segnalazioni s join public.dextera_moderazione m on m.id = s.moderazione_id
                           where s.user_id = (select auth.uid())))
$$;

-- permessi delle funzioni: le private a nessuno, le pubbliche solo agli iscritti (dextera_modera_admin a nessuno: SQL Editor)
revoke all on function private.stagione(), private.membri_casata(text), private.membro_casata(uuid, text), private.candidati(text),
  private.finestra(text), private.voto_aperto(text), private.capi(text), private.e_admin(uuid), private.puo_gestire(uuid, text, uuid),
  private.vede_bacheca(uuid, uuid), private.bacheca_di(text, uuid), private.bloccato(text, uuid, uuid, text), private.nome(uuid),
  private.chiudi_voti_scaduti(), private.modera(uuid, text, uuid), private.lista_moderazione() from public, anon, authenticated;
revoke all on function public.dextera_gruppi(), public.dextera_vota(text, uuid), public.dextera_annuncio(text, uuid, text),
  public.dextera_banner(text, uuid, text, text), public.dextera_segnala(text, text, uuid, uuid, text),
  public.dextera_modera(uuid, text), public.dextera_modera_admin(uuid, text), public.dextera_moderazione(),
  public.dextera_miei_gruppi() from public, anon, authenticated;
grant execute on function public.dextera_gruppi(), public.dextera_vota(text, uuid), public.dextera_annuncio(text, uuid, text),
  public.dextera_banner(text, uuid, text, text), public.dextera_segnala(text, text, uuid, uuid, text),
  public.dextera_modera(uuid, text), public.dextera_moderazione(), public.dextera_miei_gruppi() to authenticated;

-- ---------- 5. amministrazione (SQL Editor) ----------
create or replace function admin.aggiungi_admin(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  select id into u from auth.users where lower(email) = lower(p_email);
  if u is null then return 'account non trovato'; end if;
  insert into public.dextera_admin (user_id) values (u) on conflict (user_id) do nothing;
  return 'ok';
end $$;
revoke all on function admin.aggiungi_admin(text) from public, anon, authenticated;
create or replace view admin.segnalazioni_flotta as
  select m.id, m.tipo, m.stato, m.creato_il, private.nome(m.autore) as autore,
         coalesce(k.nome, c.nome, 'Copertina di ' || private.nome(m.utente)) as gruppo,
         case when m.tipo = 'annuncio' then coalesce(m.contenuto, x.annuncio) else '(immagine)' end as testo,
         (select count(*) from public.dextera_segnalazioni s where s.moderazione_id = m.id) as segnalazioni
    from public.dextera_moderazione m left join public.dextera_bacheche x on x.id = m.bacheca_id
    left join public.constellations k on k.id = x.casata left join public.crews c on c.id = x.crew_id
    where m.stato in ('segnalato', 'nascosto');
revoke all on admin.segnalazioni_flotta from public, anon, authenticated;

-- ogni notte alle 00:40 UTC si chiudono i voti finiti (si chiudono anche alla prima apertura della Flotta dopo la fine)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('dextera-chiudi-voti', '40 0 * * *', 'select private.chiudi_voti_scaduti()');
  else
    raise notice 'pg_cron non disponibile: i voti si chiudono alla prima apertura della Flotta dopo la fine';
  end if;
end $$;

commit;
