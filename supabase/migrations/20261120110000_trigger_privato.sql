-- BodyMania: la funzione che crea il profilo alla registrazione esce dalla parte del database esposta dall'API
-- (avviso "Public Can Execute SECURITY DEFINER Function" su public.nuovo_profilo del Security Advisor di Supabase).
-- Si applica dopo gli altri file: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- Lo schema "private" non è esposto dall'API e anon e authenticated non possono usarlo; il trigger su auth.users
-- continua a creare il profilo vuoto a ogni registrazione.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.nuovo_profilo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
revoke all on function private.nuovo_profilo() from public, anon, authenticated;

drop trigger if exists nuovo_profilo on auth.users;
create trigger nuovo_profilo after insert on auth.users
  for each row execute function private.nuovo_profilo();

drop function if exists public.nuovo_profilo();
