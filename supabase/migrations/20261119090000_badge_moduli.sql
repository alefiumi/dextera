-- BodyMania: testo del badge "Giramondo" (laterale e sagittale ora sono viste dell'unico modulo Cervello).
-- Si applica dopo gli altri file: SQL Editor → incolla → Run. Facoltativo: cambia solo la descrizione.
update public.badge_classes
  set description = 'Gioca in tutti i moduli: corpo, cervello e 3D', criteria = 'Gioca in tutti i moduli: corpo, cervello e 3D'
  where id = 'moduli';
