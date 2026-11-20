-- Dextera, percorso MCB (sezione 2 «Percorso MCB» della specifica, decisa il 20/11/2026; app 0.94.1).
-- Si applica dopo 20261126090000_dextera_percorsi.sql: SQL Editor → incolla tutto il file → Run. Si può rieseguire.
-- L'app funziona anche prima di questo file: i badge del percorso MCB restano sul telefono finché le righe non ci sono.
--
-- Le tabelle di BodyMania non cambiano. Righe nuove in badge_classes: i quattro badge di contenuto del percorso mcb
-- ('<id>-mcb', stessi testi di js/badges.js, badgeById, con il nome del percorso in content/index.json: «MCB»).
-- Il percorso MCB per ora non ha casate sue: i punti vanno solo alla casata grande (fleet_days.constellation_id vuoto).

begin;

insert into public.badge_classes (id, name, description, criteria, image) values
  ('sat1-mcb', 'Primo satellite acceso · MCB', 'Accendi il tuo primo satellite nel percorso MCB', 'Accendi il tuo primo satellite nel percorso MCB', '🛰️'),
  ('pianeta1-mcb', 'Primo pianeta · MCB', 'Supera l''esame di un pianeta nel percorso MCB', 'Supera l''esame di un pianeta nel percorso MCB', '🪐'),
  ('corso1-mcb', 'Primo corso · MCB', 'Completa un corso: tutti i suoi pianeti con l''esame superato nel percorso MCB', 'Completa un corso: tutti i suoi pianeti con l''esame superato nel percorso MCB', '☀️'),
  ('sistema-mcb', 'Sistema completo · MCB', 'Rendi brillanti tutti i satelliti di un pianeta nel percorso MCB', 'Rendi brillanti tutti i satelliti di un pianeta nel percorso MCB', '✨')
on conflict (id) do update set name = excluded.name, description = excluded.description,
  criteria = excluded.criteria, image = excluded.image;

commit;
