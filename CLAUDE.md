# Dextera – il percorso dell'anatomia

App web per studiare anatomia muscolo-scheletrica (pubblico: fisioterapisti e studenti) con un percorso guidato
stile Duolingo e il metodo bottom-up della 42: corso (sole) → pianeta (regione) → satellite (zona, è un progetto)
→ 6 passi (ossa, reperi, muscoli, connessioni, funzione, caso clinico). Nasce dal codice di BodyMania
(repository `alefiumi/bodymania`, ramo `pwa`: prima il commit e3e4b6f, poi unito fino all'app 63, commit ebf728d), che resta com'è
per i suoi utenti.

Specifica (regole e numeri): documento «Dextera – Specifica per il codice»
(https://claude.ai/artifact/1Zvq6SfQgEcVYbm3P7N5wC); motivazioni: https://claude.ai/artifact/8Jq6iojKUaU2JxDw6Hp57x.
Dove questo file e la specifica differiscono, vale la specifica.

## Decisioni prese
- **Frontend**: web app statica su GitHub Pages, repo `alefiumi/dextera` (indirizzo `alefiumi.github.io/dextera`).
  Niente framework finché non serve.
- **Stessa origine di BodyMania** (`alefiumi.github.io`): localStorage, sessionStorage e Cache Storage sono in comune
  tra le due app. Regola fissa: Dextera non legge, non scrive e non cancella mai dati di BodyMania.
  - Chiavi di memoria solo con prefisso `dextera-` (mai `bodymania-…` né `bm-…`).
  - Cache del service worker solo con prefisso `dextera-`; il service worker cancella solo cache `dextera-…`.
  - Sessione di Supabase in `dextera-auth` (`storageKey` in `js/account.js`): la chiave predefinita
    `sb-<progetto>-auth-token` è quella di BodyMania, quindi uscire da un'app non fa uscire dall'altra.
- **Backend**: lo stesso progetto Supabase di BodyMania e gli stessi account (`js/config.js` identico).
  Le funzioni nuove vanno in tabelle nuove; le tabelle esistenti non si modificano. RLS su ogni tabella.
  Gli indirizzi autorizzati (Redirect URLs, per Google e i link delle email) li aggiunge l'autore dal pannello.
- **Offline-first (PWA)**: punto fisso. Tutto si calcola sul telefono; partite e progressi vanno in coda e si inviano
  quando torna la rete. Solo classifiche e funzioni sociali richiedono la rete.
- **Dati anatomici verificabili** (sezione 12 della specifica): ogni dato sta in un file di dati in `testi/`, mai nel
  codice, con id stabile, fonte e stato di verifica. `content/` e `atlante/dati.json` sono generati dagli script e
  non si correggono mai a mano. I docenti dell'autore verificano dalla pagina `revisione/`.
- **Badge e trofei**: struttura compatibile con Open Badges (emittente, classe del badge, assegnazione).
- **Setup minimale**: `requisiti.txt` + `setup.sh`. Non aggiungere altri file di configurazione
  o documentazione senza motivo.
- Lingua dell'interfaccia e dei contenuti: italiano. Telefono prima di tutto (iPhone, Safari), accessibilità WCAG 2.1 AA.

## Fasi (sezione 9 della specifica)
- **Fase 0 – Fondazione e contenuti verificabili** (in corso, niente SQL): nome, icone e manifest; chiavi e cache
  `dextera-`; barra a 4 schede; testi in `testi/`; `content/mappa.json`; pagina `revisione/`.
- Fase 1 – Percorso minimo (SQL: path_progress, dextera_settings, error_reports): online e SQL applicato il 18/11/2026.
- Fase 2 – Ripasso ed esame (SQL: review_items), in tre rilasci scelti dall'autore il 19/11/2026: 1) ripasso, luce dei satelliti,
  data d'esame (v0.76.0, vedi «Ripasso»); 2) esame del pianeta (v0.77.0, vedi «Esame del pianeta»); 3) Palestra con la figura per zone (v0.78.0, vedi «Palestra per zone»). Fasi 3–7: vedi la specifica.
- Fase 4 – Flotta (SQL: costellazioni, stagioni, equipaggi): v0.85.0, vedi «Flotta». File SQL da applicare dall'autore.
- Fase 5 – Profilo e competenze (SQL: righe in badge_classes, dextera_profili): v0.86.0, vedi «Profilo e competenze». Online e SQL applicato il 19/11/2026. Casata ed equipaggi nel Profilo: v0.87.0; obiettivo del giorno e date d'esame: v0.88.0.
- Fase 6 – Altri corsi e percorsi (SQL: dextera_studio): v0.89.0 (correzione v0.89.1), vedi «Altri corsi e percorsi». Online e SQL applicato il 19/11/2026.
- Test UCBM, Biologia giocabile (nessun SQL): v0.90.0, vedi «Test UCBM». Chimica giocabile (solo contenuti); Fisica giocabile e simulazione completa: v0.90.1. Percorso UCBM con il solo Test e l'anatomia dentro Biologia (satelliti ospiti): v0.91.0, vedi «Satelliti ospiti».
- Corso di neurologia: contenuti (primo rilascio) e corso giocabile (v0.81.0, vedi «Corso di neurologia giocabile»), Palestra sul cervello (v0.82.0), gioco 3D (v0.83.0).
- GitHub Pages attivo (ramo `main`, cartella radice): online su `alefiumi.github.io/dextera`.

## Situazione al 20/11/2026
- **Online** su `alefiumi.github.io/bodymania`: GitHub Pages pubblica dal branch `pwa`. App `APP_VERSION` 63, contenuti
  `version` 10 (`corpo` 11, `cervello` 2, `cuore` 1, `polmoni` 1). Usata dall'autore e da circa 40 amici.
- **Come si lavora**: le modifiche si fanno e si salvano sul branch di sviluppo della sessione (ultimo: `pwa-259gcu`); si
  pubblica solo quando l'autore dice "pubblica", portando `pwa` avanti allo stesso commit (solo avanzamento, mai riscrivere).
  Chiedere sempre prima di commit e push. A ogni file dell'app cambiato aumenta `APP_VERSION`; a ogni contenuto cambiato le `version`.
- **Supabase** (progetto `zxtamxgmvtgvpgngecyz`, piano gratuito, regione UE Parigi): applicati dall'autore tutti i file di
  `supabase/migrations/` fino a `20261120110000_trigger_privato.sql` (i due sui testi dei badge sono facoltativi: non verificato
  se applicati). Quando un file cambia regole lette dall'app, si pubblica prima l'app (compatibile con prima e dopo) e poi si
  applica il file. Security Advisor: restano solo gli avvisi voluti su `delete_my_account()` e `my_profile()` e la protezione
  dalle password trapelate (solo piani a pagamento). Query Performance azzerato il 20/11: le query dell'app stavano a 2–4 ms.
- **Accesso**: email e password (conferma dell'email attiva, minimo 8 caratteri anche sul server) e Google (client OAuth su
  Google Cloud, progetto "BodyMania", app pubblicata; Site URL e redirect `https://alefiumi.github.io/bodymania/`;
  per Dextera `https://alefiumi.github.io/dextera/` è nei Redirect URLs di Supabase; accesso con Google provato dall'autore).
  L'account dell'autore è `alessandro.fiumicelli@gmail.com` (Google più password); il vecchio `alefiumi42` è stato cancellato.
- **Ambiente cloud**: l'ambiente "bodymania" raggiunge solo l'host del progetto Supabase (prove dell'API con la chiave pubblica,
  nessuna chiave salvata). Nel container c'è PostgreSQL 16 per provare le migrazioni con un finto schema `auth`.

## Stato attuale
Codice di BodyMania con nome, chiavi e schede di Dextera. Diviso in:
- `index.html` (solo struttura), `css/style.css`.
- `js/`: moduli ES. `main.js` avvia, `content.js` carica i JSON, `shapes.js` trasforma le forme in SVG,
  `state.js` (stato condiviso `app`, salvataggio), `figure.js` (figura, zoom, pan), `explore.js`,
  `game.js` (Palestra, anche per zone), `puzzle.js`, `progress.js`, `ui.js` (cambio di modulo e tab, clic),
  `gate.js` (schermata di avvio), `account.js`, `badges.js`, `social.js` (scheda Flotta), `path.js` (scheda Percorso, per ora un segnaposto con pianeti e satelliti di `content/mappa.json`), `install.js` (pannello "Installa e usa offline": istruzioni per browser, stato della copia offline).
- Barra in basso a 4 schede (`setTab` in `js/ui.js`): **Percorso** (`path`, segnaposto fino alla fase 1),
  **Palestra** (`play`, l'ex Gioca: tutti i giochi 2D e 3D), **Atlante** (`atlas`: l'ex Esplora in 2D e l'atlante 3D,
  scelti con i pulsanti `#asw` in alto; scelta in `dextera-atlante`), **Flotta** (`soc`, l'ex Amici). Il **Profilo**
  (`prog`) non ha una scheda: si apre toccando la foto in alto a sinistra (`#me`, disegnata da `head()` in `state.js`).
  Percorso, Profilo e Flotta usano tutto lo schermo senza figura (classe `pg` su `body`).
- Computer e tablet in orizzontale (almeno 900 px e più larghi che alti, `@media` in fondo a `css/style.css` e in
  `atlante/index.html`): figura a sinistra e scheda a destra (griglia), senza la freccia `#fold`; in colonna la figura restava
  alta 180 px e le risposte uscivano dallo schermo. Se la finestra cambia forma e la figura era intera, si riadatta (`atHome()`).
  Segni di origine e inserzione (`ovDraw`/`drawOv()` in `figure.js`) in pixel dello schermo, ridisegnati a ogni zoom: prima
  erano in unità del disegno e su un computer (o ingrandendo) i cerchi O e I coprivano mezza figura.
- Figura: barra `.tbar` sopra il disegno (moduli a sinistra, zoom a destra), mai sovrapposta; l'svg occupa
  tutta la larghezza e mantiene le proporzioni (con lo zoom si vede anche ciò che sta ai lati).
  Zoom: pulsanti, rotella, pizzico a due dita con eventi touch (su iPhone gli eventi pointer a due dita
  vengono annullati dal sistema); un dito sposta la figura quando è ingrandita.
  Doppio tocco (`doubleTapZoom()` in `figure.js`): ingrandisce 2,5 volte sul punto, molto ingrandita torna alla vista intera;
  per distinguerlo il tocco singolo sulla figura vale dopo 260 ms (`DBL` in `ui.js`, `tapAt()`).
- Puzzle: `slotAt(x,y,id)` in `figure.js` sceglie il posto vuoto più vicino entro `SLOT_PX` (28 px), anche se
  coperto da altre ossa, con precedenza al pezzo in mano; altrimenti l'osso sotto il dito (errore).
  Il pezzo trascinato è disegnato alla scala della figura, con il centro 42 px sopra il dito. I pezzi sono la sagoma intera
  del lato principale della vista (`sf`, riquadro `sb`), anche delle parti coperte da altre ossa: una costa si vede intera.
  Il pezzo in mano vince se il suo posto è entro 8 px dal posto più vicino.
- Menu della figura: un pulsante per modulo ("🦴 Corpo · Anteriore ▾", "🧠 Cervello ▾") apre l'elenco delle viste del modulo
  (`viewMenu()` in `figure.js`, `#vmenu`); la vista scelta per ogni modulo è in `app.bases`, salvata in `dextera-2d` con `grp`.
  Con tre moduli, su schermi stretti i pulsanti dei moduli non aperti mostrano solo l'icona (`.mn`); un modulo può dare nel suo
  JSON i nomi di "singole/gruppi" (`grpn`) e il testo di Esplora (`expl`).
  Viste (`views` e nomi `vnames` nei contenuti): corpo `a` `p` `ld` `ls` `s` `i` (anteriore, posteriore, laterale destra e
  sinistra, superiore, inferiore); cervello `ls` `ld` (facce laterali), `m` (mediale: faccia mediale del destro), `f` anteriore, `p`
  posteriore, `s` superiore, `i` inferiore o basale. I nomi usano i termini dell'anatomia (`BODY_VIEWS`, `BRAIN_VIEWS`, `ZVIEWS` in
  `contenuti_2d.py`: "Superiore (craniale)", "Inferiore (basale)", "Piede · plantare"…). In Esplora, se una struttura nella vista
  si vede poco, la scheda dice in quali viste si vede bene (`seenIn()` in `explore.js`).
  Tutte le viste di un modulo stanno nello stesso spazio 300×H (stessa scala, ognuna centrata); cambiando vista e con ⟲ la
  figura si adatta al disegno della vista (`resetZoom`), il riquadro può essere più largo della figura (`maxW`, `clampT`).
- Viste di zona (`zviews` in `corpo.json`): `mp`/`md` mano palmare e dorsale, `pd`/`pp` piede dorsale e plantare, solo il
  lato destro. I gruppi `cranio` (vista `ld`), mano e piede hanno `zv` (vista preferita): Ricomponi li gioca lì e Trova chiede lì
  le loro ossa, con `setView(v,true)` (temporanea, non cambia `app.bases`); nel menu compare anche la coppia della zona.
  `baseView()` torna alla vista del menu a ogni domanda, al menu dei giochi e al cambio di scheda.
- `vis[v]`: quota della sagoma visibile in quella vista. Giochi e puzzle usano solo strutture con almeno il 25% visibile
  (`visibleIn`, `MIN_VIS`): niente pisiforme da dietro. Lo zoom sulla zona usa le proporzioni del riquadro sullo schermo.
- Safari a volte non ridisegna l'svg quando cambia altezza (scheda abbassata) e mostra la figura due volte: un ResizeObserver
  in `figure.js` lo costringe a ridisegnare. Non provato su Safari vero dall'AI.
- Altezza su iPhone: `body` usa `--app-h` = `innerHeight`, aggiornata in `main.js` a ogni resize, focusout, pageshow e ritorno
  in primo piano (con la pagina riportata in cima): nell'app installata, dopo la tastiera o il ritorno da Google, Safari lasciava
  la barra in basso a metà schermo con una fascia nera sotto. Non provato su iPhone vero dall'AI.
- Scheda sotto la figura dentro `#pw`: la freccia `#fold` sul bordo in alto a destra la abbassa (striscia di due righe
  scorrevole, in gioco resta la domanda) e la rialza; scelta in `dextera-fold`. Stessa freccia nell'atlante 3D (`dextera-fold3d`).
- Spunta verde in alto a destra (`#off`) quando la copia offline è pronta; il pulsante "Installa l'app"
  nell'Atlante 2D compare solo fuori dall'app installata.
  Installazione (`installNow()` in `install.js`): su Android con la richiesta del browser (`beforeinstallprompt`) un tocco apre
  la finestra di installazione; su iPhone (Apple non lascia installare i siti da soli) una guida a schermo intero (`#iguide`)
  con i tre passi, le icone di Condividi e "Aggiungi alla schermata Home" e una freccia verso Condividi; nei browser dentro
  altre app (Instagram, Facebook, Gmail…) dice di aprire in Safari o Chrome. Nel browser, dopo l'avvio, una striscia
  "📲 Installa l'app sul telefono" sopra la barra in basso (`#ibar`, chiusa con ✕ non torna: `dextera-installhint`).
- `content/`: `index.json` (versione globale, ordine dei moduli), `corpo.json`, `cervello.json`, `cuore.json`, `polmoni.json`,
  `neuro-strutture.json` (testi dei gruppi del cervello), `nervi-cranici.json`, `mappa.json` (percorso, vedi sotto). Ogni file ha `version`.
  Le forme sono descrizioni come `{"poly":"M…"}`, `{"ln":[x1,y1,x2,y2,spessore]}`, `{"stack":[x,y,w,h,n]}`
  (tipi in `js/shapes.js`). Quando cambi un contenuto, aumenta la `version` del file e quella di `index.json`.
- Serve un server locale (`python3 -m http.server`): con il doppio clic su `index.html` (`file://`) moduli e JSON non si caricano.
  Non usare `npx serve`: reindirizza `/atlante/index.html` → `/atlante` e il service worker rifiuta le risposte reindirizzate
  (atlante vuoto, app che non si apre offline). GitHub Pages non reindirizza.
- PWA: `manifest.webmanifest`, icone in `icons/` (pianeta con un satellite su fondo indaco; PNG generate da uno script
  Python senza pacchetti, lo script non è nel repo), `sw.js`. Cache: `dextera-app-<APP_VERSION>`, `dextera-content-<versione>`,
  `dextera-3d-<MODEL_VERSION>`.
  Il service worker copia in cache l'elenco `APP_FILES` all'installazione e serve l'app dalla cache; all'installazione
  scarica anche i contenuti se la versione è cambiata (una versione nuova dell'app può richiedere il formato nuovo).
  **Versione dell'app** (dal 19/11/2026, numerazione classica MAGGIORE.MINORE.CORREZIONE, fase «alpha»): `APP_VERSION` in `sw.js` è
  per esempio `'0.69.0'` e nell'app si legge «Dextera alpha v0.69.0» (profilo, Privacy e dati; pannello Installa; `appVersion()` in
  `install.js` la ricava dal nome della cache). 0 → 1 quando l'app esce dalla prova (rilascio pubblico); il numero di mezzo +1 per ogni
  funzione nuova (la correzione riparte da 0); l'ultimo +1 per ogni commit che cambia un file dell'app (correzioni e ritocchi).
  Prima del 19/11 era un numero solo (fino a 68). I contenuti (`version` dei JSON) restano numeri interi a parte.
  **Quando modifichi o aggiungi un file dell'app, aumenta `APP_VERSION` in `sw.js`** (e aggiorna `APP_FILES`
  se aggiungi o togli file), altrimenti chi ha l'app installata continua a usare la versione vecchia.
  I contenuti stanno in una cache separata per versione: a ogni avvio con rete il service worker legge
  `content/index.json` e, se `version` è cambiata, scarica tutto il set (moduli, `nc` e `files`) e lo usa
  dall'apertura successiva, mostrando un avviso. `content.js` chiede i file con `?v=<versione>` così una pagina
  aperta non mescola versioni diverse. Un file di contenuto nuovo che non è un modulo va elencato in `files`.
- Durante lo sviluppo il service worker serve i file vecchi finché `APP_VERSION` non cambia: per vedere subito
  le modifiche usa una finestra in incognito, oppure "Update on reload" negli strumenti per sviluppatori.
- Su iPhone l'app installata può avere una memoria separata da Safari: va aperta dall'icona una volta con la
  rete. L'app avvisa con "Pronta: da ora funziona anche senza connessione" e lo stato è nel pannello di installazione.
- Browser: iPhone con Safari, Chrome, Edge e Firefox (iOS 16.4+, voce "Aggiungi alla schermata Home");
  Android con Chrome, Firefox, Samsung Internet, Edge. Provati dall'AI solo Chrome desktop ed emulazione mobile.

Contenuto del gioco:
- Moduli 2D: `corpo` (121 ossa singole in 26 gruppi, sei viste; 208 muscoli), `cuore` ("🫀 Cuore e vasi", apparato
  cardiovascolare: 358 strutture in 16 gruppi, otto viste: cuore e grandi vasi da quattro lati, solo il cuore faccia anteriore e base,
  arterie e vene di tutto il corpo (`thin`: bordo del colore del vaso); vasi del corpo raggruppati per regione, calcolata in
  `proietta_2d.mjs` dalla posizione rispetto a sterno, omero e femore; 5 casi), `polmoni` ("🫁 Polmoni": 81 strutture in 5 gruppi,
  sei viste: quattro lati, bronchi con vasi polmonari, albero bronchiale; 4 casi) e `cervello` (106 strutture in sette viste; fino al
  18/11/2026 erano due moduli, `lat` e `sag`: gli id `b.*` e la maestria sono gli stessi), 12 nervi cranici.
- Disegni 2D ricavati dal modello 3D (non più a mano): `node atlante/build/proietta_2d.mjs <tmp.json>` (gira anche nel cloud:
  legge solo i `.glb` del repository, pochi secondi) proietta ossa, viste di zona di mano e piede (assi principali delle loro ossa),
  sagome intere delle singole ossa, encefalo e aree di origine e inserzione (z-buffer in software, contorni dei pixel visibili → tracciati SVG; senza pacchetti
  npm), poi `python3 atlante/build/contenuti_2d.py <tmp.json>` scrive `content/corpo.json`, `cervello.json`, `cuore.json` e `polmoni.json`
  con nomi, descrizioni (`desc` di `dati.json`), gruppi, muscoli e casi (tutti i testi da `testi/`, vedi sotto). Di solito li lancia
  `python3 atlante/build/testi.py`, che rifà tutto. Ogni struttura ha `s.<vista>` (forme per vista: ogni lato è
  un tracciato a sé, il primo è il lato principale della vista: destro, sinistro guardando da sinistra; nel cervello il sinistro
  nelle viste con i due emisferi), `c`, `sf`/`sb`/`vis` e `g` (gruppo); i gruppi hanno `m` (membri). Nel cervello i
  gruppi sono i lobi (partizione) più aree che si sovrappongono (`area: true`: Broca, Wernicke, giro precentrale, talamo…).
  Esclusi dal 2D: ossicini, cellule etmoidali, seni, cartilagini di naso e laringe, sesamoidi; denti e cartilagini costali
  sono una voce ciascuno; nel cervello i nuclei profondi (si vedrebbero attraverso gli spazi tra le superfici).
- Muscoli 2D: ossa di origine e inserzione dall'osso più vicino alle aree della fonte; dove la fonte non ha l'area, dal testo
  della scheda (`src: 'testo'`, segnalato nel pannello). 154 muscoli hanno origine e inserzione (usati nei giochi).
  Aree segnate dalla parte sbagliata nella fonte: correzioni `sposta_aree` in `testi/correzioni.json` (es. capo breve del bicipite femorale).
- Figura: menu Corpo/Cervello con le viste (vedi sopra) e "Ossa singole/Gruppi" ("Giri e solchi/Lobi e aree" nel cervello),
  scelte salvate in `dextera-2d`. Le viste sono nell'svg insieme (una sola visibile), le marcature valgono in tutte.
  Con i gruppi tutti i giochi usano i gruppi (`items()`, `itemOf()` in `state.js`); la risposta è giusta se si tocca un membro.
  Trova: con le singole si sceglie prima il gruppo, e per le ossa piccole la figura si ingrandisce sulla zona. Ricomponi: con le
  singole i pezzi sono le ossa di un gruppo (zona ingrandita), con i gruppi sono gruppi interi. Maestria: chiavi diverse per
  singole (`o.femur`, `b.precentral-gyrus`) e gruppi (gli id dei vecchi 22 gruppi: `femore`, `carpo`… e dei lobi).
- Modalità: Ricomponi (puzzle con trascinamento), Componi (`build`: puzzle vero su schermo vuoto, `.view.bare`: si vedono solo i pezzi
  già messi; il primo si sistema da solo al suo posto, gli altri sono giusti se il centro cade entro max(22 px, 18% della diagonale)
  dal loro posto, cioè nella posizione giusta rispetto ai pezzi già messi; `freeDrop()` in `puzzle.js`, posti misurati prima di
  nasconderli in `G.box`; vicino ma fuori: "ci sei quasi" con la direzione; 5 cuori; nel corpo zone intere di più gruppi,
  `BUILD_ZONES`: mano, piede, cranio e mandibola, colonna, gabbia toracica, arto superiore e inferiore), Tendine-ponte, Caso clinico (indizi progressivi),
  Trova la struttura, Origine e inserzione, Funzione → struttura, Nervi cranici, Misto.
- Zoom e pan sulla figura (pulsanti, pizzico, rotella), XP, livelli, serie di giorni, maestria per struttura.
- Salvataggio locale: `localStorage`, chiave `dextera-v1`. **L'account è facoltativo**: senza account si gioca e si
  esplora tutto come prima e i progressi restano solo sul dispositivo.
- Schermata di avvio (`js/gate.js`, `#gate` in `index.html`): l'app si prepara sotto. Con rete controlla se c'è una
  versione nuova del service worker (`reg.update()`; se si installa, attende `controllerchange` e ricarica una volta,
  guardia in `sessionStorage` `dextera-upd`), ricarica anche se arrivano contenuti nuovi mentre è aperta, poi sincronizza.
  Senza rete entra subito (tutto in locale). Se non c'è un account chiede di accedere (vista Accedi, sotto "Registrati"
  e "Continua senza account"; la scelta ospite si ricorda in `dextera-guest`). Dopo la prima registrazione chiede il nome.
- Account (`js/account.js`): email e password o Google (Supabase Auth, flusso PKCE). La libreria `vendor/supabase.js`
  (supabase-js 2.118.0, UMD) si carica solo se c'è una sessione o si apre l'accesso. Configurazione in `js/config.js`
  (indirizzo del progetto e chiave pubblica; vuoti = solo locale). `startAccount()` restituisce ok / offline / expired / none.
  `dextera-acct` ricorda l'ultimo account usato e `dirty` (progressi salvati qui e non ancora inviati, es. giocando
  offline): se la sessione non vale più, all'avvio con rete si chiede di accedere di nuovo con un avviso; chi continua
  senza accedere trova nel profilo "Accedi e sincronizza". Uscendo con "Esci" l'account si dimentica.
  I progressi del dispositivo ricordano l'account a cui appartengono (`S.owner` {uid, email}, dopo la prima sincronizzazione):
  entrando con un account diverso non si uniscono da soli: la schermata "Su questo telefono ci sono altri progressi"
  (`showOwner()` in `gate.js`, `A.conflict`) propone "Importa i dati del telefono in questo account" (`importDevice()`: se
  l'account non ha una password ne chiede una, così si entra con Google e con email e password; facoltativo, elimina il vecchio
  account con la sua password, usando un client Supabase a parte che non tocca la sessione) oppure "Inizia da zero"
  (`resetLocal()` in `state.js`). I progressi da ospite (senza `owner`) si uniscono come prima. Nel riquadro Account
  "Aggiungi password" per chi è entrato solo con Google. La cancellazione libera subito il nome utente
  (`20261119130000_nome_libero.sql`: resta in `deleted_username`, il ripristino lo restituisce se è ancora libero). Nel riquadro Account "Collega Google" (`linkIdentity`, serve "manual
  linking" attivo su Supabase) per entrare con Google nello stesso account invece di crearne un secondo.
  Password: il link "Password dimenticata" (evento `PASSWORD_RECOVERY`, `A.recovery`) apre a tutto schermo "Scegli una nuova
  password" (`showRecovery()` in `gate.js`, due campi; si esce solo salvando o con "Annulla ed esci"); "Cambia password" nel
  profilo chiede quella attuale (verificata con un client a parte, `setNewPassword()`); dopo ogni cambio si chiudono le sessioni
  sugli altri dispositivi (`signOut({scope:'others'})`).
  Rete: `online()` in `account.js` (usato da account, avvio, profilo e amici) non si fida di `navigator.onLine` falso (su Mac con
  VPN o schede di rete virtuali Chrome dice "senza rete" anche quando c'è e l'app non sincronizzava più): `checkNet()` prova a
  raggiungere Supabase (`/auth/v1/health`, `no-cors`) e se risponde la rete c'è.
  All'accesso i progressi locali si uniscono al server tenendo il valore più alto (XP, risposte, maestria per voce;
  per la serie vale il giorno più recente; profilo: vince la modifica più recente, `profile_at`), poi dopo ogni `save()`
  parte un invio (3 s). Le partite finite vanno in `dextera-queue` e si inviano con upsert che ignora i doppioni.
- Profilo (dalla foto in alto, `js/progress.js`, a tutto schermo senza figura): foto (ritagliata a 128×128 JPEG e salvata
  come testo `data:` in `profiles.avatar`, così si vede offline), nome (con account: unico, regola `NAME_RE`), ruolo,
  presentazione; statistiche, badge, riquadro Account (sincronizza, cambia password, esci) e maestria, con la scelta tra corpo
  e cervello (toccando una voce si apre nell'Atlante 2D nel suo modulo).
  Profilo locale in `S.prof`; funziona anche senza account.
- Badge (`js/badges.js`): 28 (20 di BodyMania e 8 della fase 5, vedi «Profilo e competenze»), calcolati sul dispositivo dopo ogni `save()` (avviso "Nuovo badge"); `S.badges` {id: data},
  statistiche delle partite in `S.stats` (aggiornate da `queue.add`). Con l'account vanno in `badge_assertions`.
  Gli id e i testi devono coincidere con `badge_classes` nel secondo file SQL (`20261117120000_profilo_badge.sql`,
  che aggiunge anche le colonne avatar, role, bio, profile_at e la foto nella classifica).
- Sfondo chiaro o scuro: senza scelta segue il sistema; il pulsante 🌙/☀️ nell'intestazione (e nella barra dell'atlante
  aperto da solo) mette `data-theme` su `<html>` e lo salva in `localStorage` (`dextera-theme`). Uno script in testa a
  `index.html` e `atlante/index.html` lo applica prima di disegnare; l'atlante nell'iframe segue l'app con l'evento `storage`.

Mai provato su un dispositivo reale dall'AI (vale per BodyMania e per Dextera): il tocco e il trascinamento li ha provati solo l'autore.

## Atlante 3D (scheda "🦴 Atlante" dell'app, vista 3D)
`atlante/` è un atlante 3D ruotabile in stile cartoon, a strati sovrapponibili (three.js in `atlante/vendor/`,
logica in `atlante/atlante.js`). È una pagina a sé (`atlante/index.html`, si apre anche da sola) che l'app mostra in un
iframe nella scheda Atlante, vista 3D: `showAtlas()` in `js/ui.js` la carica la prima volta che si apre e la tiene in
memoria (nascosta non disegna). Dentro l'iframe la pagina toglie la propria intestazione (classe `emb`).

Offline (in `sw.js`): pagina, `atlante.js` e `dati.json` stanno in `APP_FILES`; motore three.js e modelli `.glb` in una
cache a parte (`MODEL_CACHE`, versione `MODEL_VERSION`, da aumentare quando cambi `vendor/` o un `.glb`). All'installazione
si salva la base (motore e `ossa.glb`, circa 3 MB in più); poi, a ogni avvio con la rete finché manca qualcosa, il service worker
scarica in sottofondo tutti gli altri strati, uno alla volta (`fillModels()` in `sw.js`, circa 7 MB; dal 19/11/2026, v0.74.0: prima si salvavano
solo aprendoli con la rete e offline l'encefalo non si apriva). Finiti tutti scrive il segno `atlante/.offline-completo` nella cache dei modelli:
la spunta verde (`offlineState()` in `install.js`) compare solo con app, contenuti e tutto il 3D; avviso «Atlante 3D salvato» (`models-ready`).
Se offline manca uno strato, l'atlante avvisa (`loadFail()`, `#lfail`) invece di restare su «Carico…» e riprova con la rete.
Nel pannello Strati si vede quanti strati sono salvati e c'è "Scarica tutto per offline".

Fonte: **Z-Anatomy** (CC BY-SA 4.0, derivato da BodyParts3D), scelto al posto di BodyParts3D perché ha nello
stesso modello coerente ossa, muscoli completi, legamenti, sistema nervoso centrale e periferico, vasi, visceri,
le aree di origine e inserzione dei muscoli e le etichette dei reperi già posizionate. Nomi italiani e latini
dalla Terminologia Anatomica 2 (`build/TA2.csv`). Crediti e licenze in `atlante/CREDITI.md`: i file derivati
vanno distribuiti con la stessa licenza CC BY-SA 4.0. Rene e orecchio interno (licenza non commerciale nella
fonte) sono esclusi.

File (ogni strato si scarica solo quando viene acceso; `ossa.glb` all'avvio):
- `ossa.glb` (277 parti), `muscoli.glb` (464 muscoli più 205 fasce, tendini e borse), `legamenti.glb`,
  `inserzioni.glb` (705 aree di origine e inserzione), `encefalo.glb`, `midollo.glb`, `nervi.glb`,
  `meningi.glb`, `sensi.glb` (occhio e orecchio), `vasi.glb`, `visceri.glb`. In tutto circa 8 MB.
- `dati.json`: `names` (nome inglese senza lato → [italiano, latino]), `objs` (nome della parte → [strato,
  materiale della fonte, gruppo]), `lm` (606 reperi: nome, parte a cui appartiene, punto, direzione verso fuori),
  `mus` (208 muscoli per radice del nome: parti, aree di origine `o` e inserzione `e`, gruppo funzionale,
  e `card` con origine, inserzione, azione e innervazione per tutti i 208 muscoli).
- Nei nomi delle parti il suffisso indica il lato (`.r` destro, `.l` sinistro) e, per le aree, `.o…`/`.e…`
  origine/inserzione. three.js toglie punti e spazi da `mesh.name`: il nome vero è in `mesh.userData.name`.
- Assi: Y in alto, +Z davanti, −X lato destro del corpo. Il modello è simmetrico: i reperi di destra
  valgono a sinistra cambiando segno alla X.

Come si rigenera (serve Blender; i passaggi stanno in `atlante/build/`):
1. `Blender -b Startup.blend --python build/za_export.py -- <cartella>` esporta gli strati grezzi e `za_meta.json`
   (`Startup.blend` è dentro `Z-Anatomy.zip` del repository Z-Anatomy/Models-of-human-anatomy).
2. `node build/za_optimize.mjs <cartella> <uscita>` semplifica e comprime (pacchetti npm `@gltf-transform/*`, `meshoptimizer`).
3. `python3 build/za_dati.py <cartella>/za_meta.json atlante/dati.json` unisce metadati e TA2, poi applica `testi/`
   (non provato dopo il passaggio a `testi/`: serve l'esportazione da Blender). Per aggiornare solo i testi senza Blender:
   `python3 atlante/build/testi.py` (vedi «Testi verificabili»).

Funzioni dell'atlante (in `atlante.js`):
- Pulsante ⟲ all'inizio della barra (`homeView()`): torna alla vista iniziale, tutto il corpo da davanti.
- Muscolo: tre viste, "Forma e aree", "Punti e linee" (pallino blu al centro di ogni area di origine, arancione
  per l'inserzione, linea viola che li unisce, sempre in primo piano) ed "Entrambe"; reperi della fonte entro 2,5 cm dai punti.
- Gruppi (`COMBO`, da `DATA.combo`): zampa d'oca, ischiocrurali, cuffia dei rotatori, tricipite della sura, quadricipite.
- Ricerca senza accenti, con abbreviazioni e nomi comuni (`SYN`: SIAS, SIPS, zampa d'oca, Broca…).
- Encefalo (pulsante 🧠): sezioni assiale, coronale e sagittale con cursore (piano di taglio su tutta la scena;
  durante il taglio il contorno è spento e le superfici sono a due facce) e scomposizione in 9 strati (`ST`, da `DATA.strati`), dalla
  dura madre ai ventricoli. Dura madre e aracnoide craniche non sono nella fonte: `makeShells()` le genera
  avvolgendo la corteccia, forma schematica dichiarata nel pannello.

Cuore e vasi (🫀) e Polmoni (🫁), separati come voluto dall'autore (`SYS` e `openSys()` in `atlante.js`, pulsanti nella barra e
nel pannello Strati): ogni apparato mostra solo le sue parti, con strati da accendere (cuore e vasi: arterie, vene, grandi vasi della
base, cuore, coronarie e vene del cuore, valvole e muscoli papillari; polmoni: pleura trasparente, lobi, trachea e bronchi, vasi
polmonari), viste pronte (fra cui "Solo il cuore", come l'encefalo) e le sezioni sul riquadro dell'organo (`S.cutOn`).
I due apparati si accendono anche insieme (`S.on`, pulsante "Aggiungi …" nel pannello) e dal pannello Strati come strati
(`toggleSys()`, senza aprire il loro pannello). Nei pannelli di encefalo e apparati
"👁 Solo …" (`S.solo`) toglie tutto il resto (scheletro, muscoli, altri strati) e si rimette con lo stesso pulsante.
Nel pannello iniziale dell'atlante: "Sezione del corpo intero" assiale, coronale e sagittale con cursore (`cutHtml('body')`).
Con una sezione attiva il tocco scarta le intersezioni nella parte tagliata via (`kept()`): si seleziona ciò che si vede sul taglio.
Disegno solo quando serve (`loop()`/`wake()` in fondo ad `atlante.js`): si ridisegna durante tocchi, movimenti della vista e per 1,5 s
dopo ogni cambiamento (`refresh()`, caricamenti, messaggi dall'app); da fermo 0 fotogrammi, in secondo piano il ciclo si ferma
(`visibilitychange`). Prima disegnava 60 volte al secondo anche fermo e il telefono si scaldava e rallentava anche le altre app.
Memoria grafica: le parti nascoste (strati spenti) liberano subito la loro copia nella GPU (`m.userData.gpu`, `geometry.dispose()`:
three.js la ricarica da sola dai dati in memoria quando tornano visibili); in secondo piano o con l'atlante non in uso da 20 s
si libera tutta (`freeGPU()`).
`organOf()` in `atlante.js`, `organo()` in `build/torace.py` e in `proietta_2d.mjs` usano le stesse regole: tenerle uguali.
Colori: cuore destro blu e sinistro rosso; arterie polmonari blu e vene polmonari rosse (sangue venoso/ossigenato, come nei libri).
Testi di cuore, vasi principali e polmoni in `testi/torace.json` (scritti dall'AI, da verificare) con i nomi italiani corretti
(TA2 diceva "valvola canina" per la tricuspide…); gli altri vasi hanno un testo ricavato dalla gerarchia della fonte
("Arteria, ramo di…", fonte Z-Anatomy). Nomi e testi degli strati dei due apparati (`SYS`) in `DATA.sistemi`, da `testi/gruppi.json`. Giochi 3D **Cuore e grandi vasi** e **Polmoni** (serie `cuore`, `polmoni`): solo parti visibili
da fuori (dei bronchi solo trachea e bronchi principali). Nella fonte mancano il pericardio e il lembo anteriore della mitrale.
Sistema linfatico: **non esportato**. È nella collezione 6 di `Startup.blend`, che `za_export.py` salta (`LAYERS`); per averlo
serve rieseguire l'esportazione con Blender (non disponibile nel cloud) aggiungendo la collezione 6 come strato `linfatico`.

Correzione all'esportazione: `Ciliary body-curve.l` in `sensi.glb` esce con una trasformazione sbagliata (anello di 2 m
dietro lo scheletro); `atlante.js` lo sostituisce al caricamento con la copia speculare del destro (`MIRROR_FIX`, da `DATA.specchia`, cioè dalle correzioni `specchia` di `testi/correzioni.json`).

Correzioni alla fonte: in 12 muscoli Z-Anatomy ha origine e inserzione scambiate (piccolo pettorale, dentato anteriore,
trapezio, scaleni anteriore e medio, tiroioideo, retto dell'addome, retti e obliquo inferiore della testa; capo
sternocostale del grande pettorale). Sono correzioni `inverti_aree` e `aree_origine` in `testi/correzioni.json`, applicate da
`correggi_aree()` in `build/testi.py` (riparte sempre dal tipo scritto nel nome dell'area, quindi è idempotente); il pannello lo segnala.
I "muscoli qui vicino" di un repere contano solo le aree il cui osso più vicino è quello del repere.

Cosa viene dalla fonte e cosa no: forme, posizioni dei reperi, aree di origine e inserzione e nomi vengono
dalla fonte. Scritti dall'AI a memoria, da verificare su un atlante: le schede dei 208 muscoli, le descrizioni (tutte le ossa,
i reperi, quasi tutte le strutture dell'encefalo), i testi di gruppi, strati, nervi cranici e casi clinici. Tutti in `testi/`.
Giochi sul modello 3D (si rifanno uno alla volta; quelli 2D restano come sono). Fatto: **Trova la struttura** in tre
serie (ossa, muscoli, reperi), nella Palestra sotto "Sul modello 3D". Il menu chiama `play3d()` in `js/ui.js`, che apre l'Atlante
in 3D e manda all'iframe `{bm:1,type:'game',set}` (anche in attesa del messaggio `ready` se l'atlante non è ancora carico);
l'atlante gioca (`startGame`, `gameTap`, `gamePanel` in `atlante.js`) e rimanda `res` (ogni risposta: XP, serie, maestria
con chiave `3d:<serie>:<nome>`), `end` (bonus) e `menu`. XP e salvataggio restano solo nell'app.
Si chiede solo ciò che si vede da fuori ruotando il modello: `seenFrom()` disegna la scena da 26 direzioni con un colore
per candidato e conta i pixel (ossa e muscoli ≥ 4 su 200×400, reperi come pallini di 5 mm ≥ 4 su 300×600). Restano 131 ossa
(esclusi denti, ossicini, cellule etmoidali, seni, cartilagini di naso e laringe), 131 muscoli (esclusi i profondi, es.
sovraspinato) e 470 reperi (numeri di BodyMania; ricontati il 18/11/2026 con `node atlante/build/visibili.mjs`, che salva gli elenchi
in `atlante/build/visibili.json`: 131 ossa, 150 muscoli, 496 reperi, 204 domande di origine e inserzione). Le domande si scelgono prima per famiglia (`famOf`: coste, falangi, vertebre…).
Fatto anche: **Origine e inserzione** (serie `oi`): si chiede l'origine o l'inserzione di un muscolo e si tocca l'osso; la
risposta è giusta se il punto toccato dista al massimo 1,2 cm (`OI_TOL`) da un'area di quel tipo della fonte (distanza dai
triangoli, `distToArea`). Se sbagliata, il pannello dice se lì c'è l'area di un altro muscolo. Dopo la risposta si vedono
le aree e la linea del muscolo sul lato toccato (vista `mv:'areas'`, senza la forma) e il testo della scheda (dell'AI).
Domande: 120 origini e 83 inserzioni con almeno un'area visibile da fuori (conteggio a 400×800, le aree di mano e piede
sono piccole). Refusi della traduzione italiana di TA2: correzioni `refuso` in `testi/correzioni.json`.
Fatti anche (18/11/2026): **Ricomponi** (`ricomponi`: le ossa di una zona di `ZONES` diventano trasparenti, si sceglie un pezzo
e si tocca il suo posto; il raggio cerca solo tra i posti vuoti, anche dietro altre ossa), **Tendine-ponte** (`ponte`: osso di
origine e poi di inserzione, ossa = osso più vicino alle aree della fonte, come nel 2D; 76 muscoli), **Caso clinico** (`caso`:
indizi progressivi, si tocca il muscolo; casi di `content/corpo.json` mandati dall'app nel messaggio del gioco, solo quelli con
un muscolo visibile da fuori) e **Nervi cranici** (`nervi`: encefalo e solo i 12 nervi cranici accesi, ossa trasparenti; si
chiede il nome o la funzione da `nervi-cranici.json`, anche questi mandati dall'app; `crNum()` riconosce anche i rami di V,
VII, VIII). Funzione → struttura resta solo 2D: in 3D più muscoli hanno la stessa azione e il tocco sarebbe ambiguo.
I casi clinici del corpo sono 28 (12 scritti il 18/11 e 7 il 19/11/2026 dall'AI: da verificare; in `testi/casi.json`), validi anche nel 2D.
Badge "Esploratore 3D": quattro sfide 3D diverse (testo aggiornato in `20261118150000_badge_3d.sql`, facoltativo).

Requisiti dell'autore per il 3D (16/11/2026):
- Fluidità: 60 fps fissi su iPhone 15 con il solo scheletro della prima versione. Con più strati accesi
  non è ancora stata misurata sul telefono.
- Strati sovrapponibili, come nei software di visualizzazione anatomica: scheletro, muscoli con la forma vera,
  cervello con le sue aree, sistema nervoso, ciascuno da accendere o spegnere sopra gli altri.
- Precisione scientifica in ogni modalità di gioco: l'app serve per studiare e passare gli esami.

## Testi verificabili (`testi/`, sezione 12 della specifica)
Tutti i dati anatomici scritti a parole stanno in `testi/`, un file per tipo: `muscoli.json` (208: nome, latino, origine,
inserzione, azione, innervazione), `ossa.json` (159 del modello più denti e cartilagini costali del 2D, `solo2d`), `reperi.json`
(606; le 19 voci con `vedi` hanno nome e descrizione nella voce di un osso o dell'encefalo che ha lo stesso nome nella fonte),
`encefalo.json` (strutture di encefalo, midollo e meningi, 3D e 2D, area di Wernicke), `nervi-cranici.json`, `gruppi.json`
(gruppi di ossa `gruppo.ossa.*`, lobi e aree del cervello `gruppo.encefalo.*`, gruppi dei moduli `gruppo.cuore.*` e `gruppo.polmoni.*`,
gruppi di muscoli e strati dell'encefalo, del cuore e dei polmoni dell'atlante, descrizioni dei gruppi della fonte `gruppo.fonte.*` usate
quando una struttura non ha la sua), `casi.json` (66 casi: 28 del corpo, 14 di neurologia, gli altri di cervello, cuore e polmoni), `torace.json` (cuore, vasi, vie aeree e polmoni: nomi dove TA2 sbaglia e
descrizioni; quelle con fonte Z-Anatomy dicono da quale vaso nasce o dove sbocca un vaso secondo la gerarchia della fonte; `solo2d` = solo nel 2D).
- Casi del corpo: `muscolo` (nome inglese della fonte) oppure `struttura` (osso `o.<slug>` o gruppo di ossa del 2D, es. `rotula`, `carpo`):
  la pagina di revisione mette nel satellite giusto anche quelli con un osso (prima finivano in «Altri dati»).
- Formato: `{"version","tipo","nota","campi":{campo: etichetta},"voci":[{"id","ref",…,"dati":{campo:{"valore","fonte","stato","verifica"}}}]}`.
  L'id di un dato è `<id della voce>.<campo>` (es. `muscolo.semitendinosus.origine`). Gli id delle voci usano il nome inglese
  della fonte come gli id di `content/` (`o.femur` → `osso.femur`, muscolo `semitendinosus`, `b.precentral-gyrus` → `encefalo.precentral-gyrus`):
  non cambiano se si corregge il nome. `ref` è il nome nel modello (chiave di `dati.json`).
- Fonte: `Z-Anatomy`, `TA2`, `AI`, `docente`. Stato: `da verificare`, `verificato`, `corretto`, `segnalato`. `verifica`: null oppure
  `{"chi","quando","nota"}` (il nome del docente solo con il suo consenso; nell'app si vedrà solo «Verificato il …»).
- `testi/correzioni.json`: correzioni alla fonte con il motivo: `inverti_aree` (12 muscoli), `aree_origine` (capo sternocostale del
  grande pettorale), `sposta_aree` (6 muscoli), `refuso` (TA2), `specchia` (`Ciliary body-curve.l`).
- `python3 atlante/build/testi.py` applica tutto ad `atlante/dati.json` (senza Blender, idempotente), scrive
  `content/nervi-cranici.json` e `content/neuro-strutture.json`, rifà i moduli 2D e aumenta da sola le versioni dei file
  cambiati e di `content/index.json`. Poi va aumentato `APP_VERSION` in `sw.js` se è cambiato `atlante/dati.json`.
  `content/` e `atlante/dati.json` sono generati: mai correggerli a mano.
- I nomi di vasi, nervi, legamenti e visceri non sono in `testi/` (salvo quelli corretti in `torace.json`): vengono da TA2 (con i refusi corretti).
- `atlante/build/torace.py` tiene solo le regole per classificare cuore, vasi e polmoni (`organo()`, gruppi del 2D come regex).
- I testi sono stati portati in `testi/` dai file generati del 18/11/2026: l'uscita rigenerata è uguale, salvo i nomi italiani di
  19 strutture del cervello ora anche nel 3D, le descrizioni di ipofisi ed epifisi nel 3D e i gruppi e strati passati da `atlante.js` a `dati.json`.
- Dopo la fase 0 Dextera ha preso i 47 commit di BodyMania fino all'app 63 (cuore, polmoni, viste, Componi, privacy…): i testi di cuore,
  vasi e polmoni che BodyMania tiene in `torace.py` e `atlante.js` (SYS) sono passati in `testi/`; l'uscita rigenerata è uguale a quella di
  BodyMania 63, salvo i titoli «Atlante 2D · …» e i nomi e le descrizioni del cervello già detti sopra (più culmine e declive del verme).

## Percorso (fase 1: online dal 18/11/2026, app 65)
- File: `js/percorso.js` (regole e stato: chiavi di maestria per aspetto `o.`/`r.`/`m.`/`oi.`/`fn.`, passi fatti, stati dei satelliti,
  stella guida, giorno/obiettivo/serie con scudi in `dayTick` prima di ogni `save()`), `js/lezione.js` (lezione da 8 domande, gradi per
  maestria, prova «Lo so già», quiz finale, caso clinico con ipotesi), `js/path.js` (mappa SVG universo → sistema → pianeta → satellite,
  Elenco, Continua, glossario), `js/segnala.js` (coda `dextera-segnalazioni`, dati segnalati `dextera-segnalati`).
- Dati: `content/regole.json` (numeri), `content/percorsi/base.json` (formato dei nodi del gestionale; `caso: null` = quiz finale finché
  il satellite non ha un caso; dal 19/11/2026 (v5) tutti i 17 satelliti del corpo hanno il loro: gamba c3, ginocchio c8, coscia c6, anca c1,
  spalla c2, braccio c14, avambraccio c10, mano c9, collo c13, faccia c20, e i casi scritti apposta (dall'AI, da verificare) piede c22 (frattura
  da marcia del secondo metatarsale), schiena c23 (quadrato lombare), colonna c24 (multifido lombare), torace c25 (diaframma, paralisi del
  frenico), addome c26 (diastasi dei retti), cranio c27 (frattura della mandibola), visceri della testa c28 (retto laterale, paralisi del VI)), `content/lezioni.json` (generato da `testi.py`: reperi, id delle voci, stati non «da verificare»).
- Nelle lezioni muscoli e reperi non si toccano nel 2D (muscoli: scelta e nome; reperi: tocco sull'osso). Tocco sul 3D: vedi «Corso del corpo sul modello 3D».
- Casi con un osso per risposta (`bid`, gruppo del 2D: `rotula`, `carpo`): `caseIds()` in `percorso.js` li porta alle ossa del gruppo, così
  valgono per l'esame del pianeta (`esameCasi`) e per il distretto giusto (`caseSat`); prima finivano nel primo satellite del pianeta.
- SQL: `supabase/migrations/20261121090000_dextera_percorso.sql` (path_progress, dextera_settings, error_reports, error_report_flags,
  vista admin.segnalazioni), provato con PGlite (36 prove RLS). Applicato dall'autore il 18/11/2026 (tabelle, RLS e trigger controllati; Security Advisor senza avvisi nuovi).
- Aspetto (18/11/2026, sul modello del prototipo): due zone, `.pmain` (briciole, Mappa/Elenco e mappa su cielo stellato con pianeti sfumati)
  e `.pside` (Continua con obiettivo e serie, riquadro del livello con avanzamento e legenda, oppure i passi del satellite). Telefono: una
  sotto l'altra e la mappa alta al massimo lo schermo meno intestazione e barre, così si vede intera; nel satellite la mappa è nascosta.
  Computer in orizzontale: mappa a sinistra ferma e riquadri a destra (media query in fondo alla parte del Percorso di `style.css`).
  Palestra e Flotta con lo stesso stile (19/11/2026, v0.69.0): testata in un riquadro, giochi della Palestra in riquadri a due colonne
  divisi in sezioni 2D e 3D (`renderMenu` in `game.js`), Flotta a riquadri con classifica a barre, interruttore Tutti/Amici e l'anteprima
  «In arrivo» delle casate Osteon, Myon, Neuron, Cor (`renderSocial` in `social.js`).
  Atlante nello stesso stile (19/11/2026, v0.70.0): scelta 2D/3D come interruttore `.seg3` (`#asw`, `aria-pressed`); scheda 2D con
  etichetta piccola e titolo (`.atl` in `explore.js`), legenda della maestria con i pallini del Percorso, riquadro «Usala come un'app»;
  nell'atlante 3D stessi colori dell'app (`--on-acc`), barra a pulsanti più alti, etichetta sopra ogni titolo, home con sei riquadri (`.hub`).
  Profilo nello stesso stile (19/11/2026, v0.71.0, `renderProg` in `progress.js`): riquadro con foto, nome, livello e barra verso il livello
  successivo, quattro numeri in riquadri, badge, account e privacy, maestria con barra; sul computer due colonne indipendenti (`.pcol`),
  sul telefono una colonna nell'ordine profilo, numeri, badge, account, privacy, maestria (`order` in `style.css`).
  Schermata di avvio nello stesso stile (19/11/2026, v0.72.0, `gate.js`): cielo stellato come la mappa, modulo in un riquadro con
  etichetta e titolo; interruttore Accedi/Registrati in alto (`.gtabs`, `data-g` login/signup) al posto del link in fondo.
  Caricamento (v0.75.1): il logo è un SVG (`.glogo`) in `index.html` e in `atlante/index.html`. Il satellite giallo gira con un'animazione CSS
  (`@keyframes lgorb`, 36 punti sull'orbita, in `style.css` e nello stile dell'atlante; due copie, dietro e davanti al pianeta con un clipPath).
  In v0.75.0 era animateMotion (SMIL) mostrato con `:has()` e su iPhone non girava. Avvio: `#gate.busy` (messo da `wireGate()` con un
  MutationObserver quando in `#gbody` c'è `.spin`) fa girare il satellite e mette il logo al centro dello schermo. Atlante 3D: logo al centro
  mentre si carica il modello (`#msg`) e in un riquadro sopra il modello mentre si carica uno strato (`#busy`, segue `S.loading` in `panel()`).
  Un giro al secondo, anche con «riduci movimento» (scelta dell'autore): è un indicatore di caricamento; in v0.75.2 stava fermo e sull'iPhone dell'autore non girava.
  Sotto la scritta di caricamento la versione («alpha v0.75.2», `#gver`, da `appVersion()`; solo durante il caricamento e se la copia c'è già).
  Copertina del profilo (19/11/2026, v0.73.0): sfondo da una galleria di sei (`BANNERS` in `progress.js`: notte, aurora, tramonto,
  oceano, foresta, sole) con sopra fino a 3 badge guadagnati in vetrina, scelti in «Modifica profilo»; foto sovrapposta al bordo.
  Dalla fase 5 (v0.86.0) sul server con il titolo scelto (`dextera_profili`) e visibili agli amici nella Flotta.
  Spazi nei riquadri: regola unica in fondo a `style.css` (`.card>.kick+…`), così righe e campi non toccano l'etichetta.
  Nel sistema ogni pianeta ha intorno le lune dei suoi satelliti (colore dello stato, `moons()`); nell'universo ogni corso è un piccolo
  sistema (dalla fase 6 cinque corsi e la scelta di «Cosa studi?»: vedi «Altri corsi e percorsi»). Intestazione: livello e titolo su due righe.
  Pulsante Indietro (‹, `.pback`) prima delle briciole: sale di un livello. Nel satellite sul telefono restano Indietro e briciole (ferme in
  alto mentre si scorrono i passi); nell'app installata su iPhone non c'è un tasto Indietro del browser.
- Sincronizzazione in `syncPercorso()` di `account.js`; senza tabelle i dati restano in coda (avviso nel profilo).

## Ripasso (fase 2, primo rilascio, v0.76.0)
- Regole in `js/percorso.js` (sezione «ripasso a intervalli»), numeri in `regole.json` → `ripasso` (e `esame` per il secondo rilascio).
  Una chiave della maestria del percorso (`o.`/`r.`/`m.`/`oi.`/`fn.`) entra nel calendario a maestria 2 (`ensureRev()` prima di ogni
  `save()`), torna dopo 1, 3, 7, 14, 30, 60 giorni (`S.rev {chiave: {i, due 'AAAA-MM-GG', t, u}}`). Risposta di richiamo giusta su una
  struttura che scade entro 1 giorno → intervallo successivo (`reviewAnswer()`: dalla lezione in `answer()` di `lezione.js`, risposte a
  scelta escluse, e dai giochi della Palestra con `onBump` in `state.js`); sbagliata → 1 giorno (la maestria scende dove si gioca).
- Ripasso del giorno (`daily()`, `S.revDay`): scelti una volta al giorno al massimo 10, i più in ritardo; i rimandati non contano come
  scaduti per la luce. Scheda in cima al Percorso con la stella guida quando c'è da ripassare (`ripHtml()` in `path.js`, prima di
  Continua); lezione `kind:'ripasso'` (`startReview()` in `lezione.js`: tocco o nome, senza cuori, +2 XP per ripasso fatto); finirlo vale un
  giorno di serie (`S.day.rip` in `dayTick`); «Altre 10» (`moreDaily()`). «Ripassa questo satellite» (`satReview()`, 5 domande).
- Luce del satellite (`light()`, `look()`): quota delle sue strutture non scadute; sotto il 70% «Da ripassare» (pieno arancio con
  l'orologio), acceso con tutto a 30 giorni o più «Brillante» (pieno dorato con i raggi). `satState()` resta nuovo/orbita/acceso;
  `look()` è solo per il disegno, i conteggi usano `lit()`.
- Data d'esame per pianeta (riquadro sotto il pianeta, `setExam()`): in `S.set.date_esame` → `dextera_settings.date_esame`; gli intervalli
  delle sue strutture si accorciano a metà dei giorni che mancano (almeno 2 ripassi prima), quelle che scadono più tardi si avvicinano subito.
- Caso dell'esame: `esame.caso` nei nodi pianeta di `content/percorsi/base.json` (formato del gestionale); null = in automatico i casi la cui
  risposta è un muscolo del pianeta (`esameCasi()`).
- SQL: `supabase/migrations/20261122090000_dextera_ripasso.sql` (review_items con RLS; vince il ripasso più recente, `ripassato_il`, con un
  trigger), provato con PGlite (20 prove). Applicato dall'autore (confermato il 19/11/2026); senza la tabella il calendario restava sul
  telefono (avviso nel profilo). Sincronizzazione in `syncRipasso()` di `account.js`; «Scarica i miei dati» include `ripasso`.

## Esame del pianeta (fase 2, secondo rilascio, v0.77.0)
- Regole in `js/percorso.js` (sezione «esame del pianeta»), numeri in `regole.json` → `esame` (domande 20, secondi 60, soglia 16,
  per_satellite 3, xp 250, caso_indizio_max 3, caso_errori_max 1); gioco in `js/lezione.js` (`startExam()`, `kind:'esame'`, `examNext()`).
- Si apre con tutti i satelliti del pianeta accesi (`examOpen()`); prima il riquadro «Esame del pianeta» (`examCard()` in `path.js`, nel
  riquadro del pianeta) dice «Esame: mancano N satelliti». Domande (`examSlots()`): almeno una per tipo di passo, almeno 3 per satellite,
  poi le altre fino a 20, senza doppioni; prima quelle che non erano nell'ultimo tentativo. Tipo: tocco o nome; a scelta solo sotto maestria 2.
- Cronometro: scadenza per domanda `q.end`, `#ltim` con `role="timer"` (numero e barra, rosso negli ultimi 10 s con un avviso a voce);
  allo scadere la risposta conta come sbagliata (`timeout()`: maestria −1, ripasso a 1 giorno). Se si cambia scheda la scadenza resta:
  al ritorno la domanda scaduta conta sbagliata. Niente cuori né aiuti; le risposte giuste di richiamo valgono come ripasso.
- Poi il caso clinico (`casoScreen`, senza tempo, ipotesi come nel progetto, al massimo 3 indizi): risolto con la risposta giusta e al
  massimo un errore; al secondo errore finisce. Caso: `P.esameCasi(pl)` (scelto in `esame.caso` o in automatico, diverso dall'ultimo se ce
  ne sono altri); senza casi l'esame è di sole 20 domande.
- Superato (almeno 16/20, in proporzione se le domande sono meno, e caso risolto): nodo del pianeta `acceso` in `path_progress` (`examPass()`),
  titolo «Esperto dell'arto inferiore» (`expertTitle()`: dell'/della/del dal nome del pianeta), +250 XP solo la prima volta. Il titolo si vede
  nel riquadro del pianeta e nell'Elenco. Non superato: i 2 satelliti più deboli (`weakSats()`: più errori, poi luce e maestria più basse) con
  «Ripassa …». `S.path.esami {pianeta: {keys, caso, n, best, t}}` resta sul telefono (non va sul server); si scrive quando si preme Inizia.
- Prova: `esame.mjs` (copia nelle note delle sessioni, Chrome headless, tutto offline): esame chiuso e aperto, non superato, tempo scaduto
  (anche in un'altra scheda), superato, XP una volta, caso con due errori, pianeta senza casi; dati e cache di BodyMania intatti.

## Palestra per zone (fase 2, terzo rilascio, v0.78.0)
- Solo nel modulo corpo (negli altri moduli la Palestra è quella di prima). In cima alla Palestra il riquadro «Tocca una zona per allenarti»
  (`zoneHead()` in `game.js`): la figura è già colorata per maestria (`refreshMastery`, le chiavi delle ossa `o.…` sono le stesse del
  Percorso), «💪 Allenati sulle zone deboli» con i nomi delle zone e «Tutte le zone» (elenco a pulsanti, l'alternativa al tocco per chi
  usa la tastiera o il lettore di schermo). Sotto, «Giochi liberi»: i giochi di prima, invariati.
- Zona = satellite. Il tocco su un osso fuori dai giochi (`zoneTap()`, da `tapAt` in `ui.js`) apre il foglio della zona (`app.Z {id, alt}`,
  `zoneSheet()`): maestria media, stato, le altre zone dell'osso («L'osso toccato sta anche in»), i giochi solo su quella zona (misto e uno
  per tipo di passo con almeno una struttura: ossa, reperi, muscoli, origine e inserzione, funzione) e «Vai al satellite» (`openSat()` in
  `path.js`). Le ossa della zona sono evidenziate e la figura si ingrandisce su di loro. Un osso condiviso apre prima la zona in cui ha meno
  compagni nel passo delle ossa (`satsOf()` in `percorso.js`: femore → coscia, poi ginocchio e anca).
- I giochi della zona sono allenamenti con il motore della lezione (`startZone()` in `lezione.js`, `kind:'palestra'`, `L.tab='play'`):
  presentazione, scelta, tocco e nome come nella lezione, 3 cuori, chiavi di maestria per aspetto e ripasso (`reviewAnswer`) come nel
  Percorso; domande dalle strutture più deboli (`zoneSlots()`, a turno tra le zone). Fine: «Ancora su …», «Vai al satellite», «Torna alla
  Palestra»; +20 XP (non di progresso) se finito con i cuori; in coda come `{module:'corpo', mode:'zona'}`. Niente stato dei passi.
- Zone deboli (`weakZones()`): tra le zone già cominciate (una chiave con maestria o vista) le `palestra.zone_deboli` (2) con la maestria
  media più bassa, escluse quelle tutte a 3; se mancano, le prossime nell'ordine del percorso. Numeri in `regole.json` → `palestra`.
- Una lezione del percorso aperta resta da parte durante l'allenamento (`app.Lp`) e torna all'uscita; cambiando scheda a metà
  l'allenamento si chiude (`leaveZone()` in `setTab`). Nella scheda Palestra i clic e le risposte scritte dell'allenamento vanno a
  `lessonClick`/`lessonSubmit`, il tocco a `lessonTap` (in `ui.js`, secondo `app.L.tab`).
- Prova: `zone.mjs` (copia nelle note delle sessioni, Chrome headless, tutto offline): tocco vero sulla figura, foglio, allenamento misto
  e per tipo, ripasso, cuori, lezione messa da parte, «Vai al satellite», zone deboli, elenco, cervello senza zone; dati e cache di
  BodyMania intatti.

## Luce dei pianeti e corsi nel logo (v0.80.0, chiesti dall'autore il 19/11/2026)
- Luce del pianeta (`planetGlow()` in `percorso.js`, disegno `planetBody()` in `path.js`, numeri in `regole.json` → `luce_pianeta`): «Da iniziare»
  colorato con un velo scuro e senza alone; «In corso» la luce va da `min_corso` a `max_corso` con l'avanzamento medio dei passi
  (`stepPct`); «Pronto per l'esame» con tutti i satelliti accesi; dopo l'esame superato «Completato» a luce piena, che cala piano piano
  quando si avvicina il ripasso (`planetFresh()`: ogni struttura piena nella prima metà del suo intervallo, poi giù fino alla scadenza),
  mai sotto `min_esperto`; «Da ripassare» con l'orologio se un suo satellite lo è o la freschezza scende sotto 1 − `luce_min`. Lo stato è
  scritto anche a parole (etichette, `aria-label`, riga `.glow` nel riquadro del pianeta, Elenco). Pianeti dell'universo, del sistema e del pianeta aperto.
  Sole: ogni corso ha il sole del colore del suo satellite nel logo di avvio (`SUNS` in `path.js`, stessa posizione in `mappa.json` di
  `COLORI` in `logo.js`: corpo giallo, neurologia lilla-viola, v0.84.2).
  Colore dei pianeti (v0.84.3, chiesto dall'autore): sempre colorati, anche «Da iniziare» (solo un velo scuro più forte e niente alone, non più
  grigi), nei toni del sole del loro corso e diversi tra loro (`PCS` in `path.js`, una famiglia di 5 toni per sole; `pcol()`: famiglia del
  corso, tono dalla posizione nel corso). Corpo: arancio, corallo, terracotta, ocra (niente oro: è il colore dei satelliti accesi);
  neurologia: viola, orchidea, indaco, malva. Uguale in universo, sistema e pianeta aperto.
- Logo della schermata di avvio (`js/logo.js`, chiamato da `wireGate()`): ogni corso iniziato è un satellite sull'orbita del logo nel suo
  colore (`COLORI`: il primo è il giallo di sempre e c'è anche prima di cominciare); un corso completato (tutti i pianeti con l'esame
  superato) ha un anello. Stato in `S.logo` [{id, st}], calcolato da `logoTick()` in `percorso.js` prima di ogni salvataggio per tutti
  i corsi di `mappa.json` (così il logo si disegna all'avvio senza contenuti). In caricamento i satelliti girano sfasati (`animation-delay`).
  Solo la schermata di avvio: i logo di caricamento dell'atlante 3D e l'icona dell'app restano quelli di sempre.
- Prova: `luce.mjs` (copia nelle note delle sessioni, Chrome headless, tutto offline).

## Corso di neurologia (contenuti, primo rilascio, 19/11/2026)
- Materiale dell'autore: guida «Guida Didattica Integrata di Neuroanatomia e Neurologia Clinica» (riassunto fatto da un'AI sulle
  registrazioni Neurologia_0001–0005 del Dott. Andrea Benevento) e `SNC.pptx` (28 slide). Non sono nel repository; arriverà altro materiale.
- Scelte dell'autore (19/11/2026): 4 pianeti (Basi del sistema nervoso, Encefalo, Corteccia e funzioni, Midollo e sistema periferico),
  20 satelliti; passi `strutture`, `dove`, `funzione`, `lesione`, `connessioni`, `progetto` (caso clinico; senza casi = quiz finale);
  gli errori della guida si correggono con la versione dei libri e si segnalano; prima i contenuti, poi il corso giocabile.
- `testi/neuro.json` (117 voci, campi nome, dove, funzione, lesione, connessioni): id `neuro.<slug del nome>`, `satellite`, `lezione`
  (dove se ne parla nel corso), `figura` (id del cervello 2D `b.*` o gruppi `g:<gruppo>`, per il tocco), `ref` (parte del modello 3D).
  Fonte nuova `lezione` (materiale del corso, in `FONTI` di `testi.py` e `revisione.js`); dove l'AI ha corretto o aggiunto, fonte `AI` e
  nel dato `nota` con quello che diceva la guida (la pagina di revisione la mostra). Tutto «da verificare».
- 14 casi in `testi/casi.json` (modulo `neuro`, `struttura` = `n.<voce>`).
- `content/mappa.json`: secondo corso `neurologia` (modulo `cervello`), strutture `n.<voce>`, passi con `casi` e `senza_figura`
  (strutture senza figura: domande a scelta). Scritto una volta da uno script (copia `neuro_genera.py` nelle note delle sessioni), poi
  si corregge a mano; `testi.py` controlla id, figure e casi e che ogni voce stia in un satellite.
- 14 casi: nell'app arrivano da `content/lezioni.json` → `casi_neuro` (con `src: 'neuro'`, id dei dati `caso.neuro.<id>`), non da un modulo 2D.

## Corso di neurologia giocabile (secondo rilascio, v0.81.0)
- Più corsi: `content/percorsi/base.json` (v3) contiene anche i nodi di `neurologia` (pianeti con `esame.caso` null, satelliti con `passi` e
  `caso` = il primo caso del passo progetto della mappa). In `percorso.js`: `corsi()` (corsi del percorso pubblicato, in ordine), `corso()`
  = corso aperto (`setCorso()`, scelto nella scheda Percorso e salvato in `dextera-percorso-ui` → `c`; senza scelta il corso del corpo),
  `corpoCorso()`, `corsoOf(satellite o pianeta)`. `pianeti(c)` e `satelliti(p, c)` prendono il corso; passi fatti (`checkProgress`), calendario
  del ripasso (`kidx`), `satById`, `planetOf` e il logo valgono per tutti i corsi; Palestra per zone solo sul corpo (`satsOf`, `weakZones`,
  `zoneHead` in `game.js`). Aprendo un satellite di un altro corso (ripasso, Palestra) il corso aperto lo segue (`renderPath`).
- Universo (`universeSvg` in `path.js`): un sistema per corso vero (tocco → `data-p="corso"`), Cuore e vasi e Respiratorio «in arrivo»;
  nel riquadro «Cosa studi?» l'elenco dei corsi; nel sistema «Cambia corso». Passi con i nomi di neurologia (`PROBN`).
- Dati (`lezioni()` in `testi.py`): `content/lezioni.json` → `neuro` {`n.<voce>`: {n, d, f, le, c, fig}} e `voci['n.x'] = 'neuro.x'`.
- Chiavi della maestria e del ripasso (`key()`): `n.<voce>` (strutture: nome e posizione), `nd.` (dove), `nf.` (funzione), `nl.` (lesione),
  `nc.` (connessioni). Rispettano la regola di `review_items` e `path_progress` (niente SQL nuovo). `usable()` vuole il campo del passo
  (`NCAMPO`); dati per la verifica e «Segnala un errore» in `NCAMPI`.
- Lezioni (`lezione.js`, sezione «corso di neurologia»): la figura giusta si sceglie a ogni domanda (`needMod()`: `n.` → cervello, altrimenti
  corpo; `renderLesson` chiama `useMod` tramite `setLessonExit`), così il Ripasso del giorno mescola i corsi. Strutture: presentazione con
  dove e funzione, struttura evidenziata sul cervello 2D (`showNeuro()`: vista in cui se ne vede di più, gruppi `g:` = tutti i membri),
  scelta e nome; tocco solo per le voci con `figura` (`canTap`). Altri passi: indizio con il testo del passo senza il nome (`nmask()`),
  scelta o nome della struttura. Caso: ipotesi «Quale distretto» tra i satelliti dello stesso corso e «Quale funzione» tra le funzioni delle
  voci. Esame: tipi di passo presi dal pianeta; titolo «Esperto delle basi del sistema nervoso» (`expertTitle`, anche `pl.titolo` nella mappa).
- Prova: `neuro.mjs` (copia nelle note delle sessioni, Chrome headless, tutto offline): universo, cambio di corso, lezione con presentazioni,
  scelta, tocco e nome sul cervello, tocco sbagliato, passo «Dove si trova», caso, ripasso misto corpo e cervello, esame superato, logo,
  lezione del corpo dopo, Palestra solo corpo; dati di BodyMania intatti.
- Tocco sul modello 3D: gioco 3D «Neurologia» (v0.83.0, vedi sotto).

## Palestra di neurologia (zone sul cervello, v0.82.0)
- Con la figura del cervello la Palestra ha le zone del corso di neurologia, come il corpo ha le sue (cuore e polmoni: nessuna zona).
  `zoneCorso()` in `percorso.js` sceglie il corso dalla figura aperta (corpo → muscolo-scheletrico, cervello → il corso con `modulo: 'cervello'`);
  `satsOf(sid, corso)`, `weakZones(corso)` e `zoneBones()` lo prendono. In neurologia le strutture della figura di una zona sono le parti del
  cervello 2D delle voci del passo «strutture» (`nfig()`, ora in `percorso.js`); il tocco su una parte apre prima la zona in cui ha meno compagni.
- `game.js`: tipi di allenamento di neurologia (`TIPIN`: strutture, dove, funzione, lesione, connessioni); la zona aperta (`app.Z`) vale solo se
  è del corso della figura; un allenamento continua solo se la figura è quella che serve (`lessonMod()` in `lezione.js`), cambiando figura
  si chiude. In coda come `{module:'cervello', mode:'zona'}`.
- Le strutture profonde (talamo…) non si vedono abbastanza in nessuna vista del 2D (`visibleIn`): si allenano dall'elenco «Tutte le zone».
- Prova: `zneuro.mjs` (copia nelle note delle sessioni): tocco vero sul giro precentrale, foglio della zona, allenamento misto e per tipo,
  cambio di figura a metà, zone deboli, «Vai al satellite», cuore senza zone; `zone.mjs` aggiornata (il cervello ora ha le zone).

## Neurologia sul modello 3D (v0.83.0)
- Gioco 3D `neuro` («🧠 Neurologia» nella sezione 3D della Palestra, e «🧊 Sul modello 3D» nel foglio di una zona del cervello con le sole
  strutture di quel satellite). L'app manda all'atlante le voci da toccare (`neuro3d(sats)` in `percorso.js`: voci usabili del passo
  «strutture» con `ref`, la parte del modello; `content/lezioni.json` → `neuro` ora ha anche `ref`) nel messaggio del gioco (`neuro`).
- Atlante (`atlante.js`, «Neurologia»): una domanda per parte (due voci con la stessa parte valgono una). A ogni domanda resta acceso solo lo
  strato della struttura (`NLAY`: encefalo, midollo, nervi, meningi): le parti del corso di quello strato sono intere e si toccano, il resto è
  trasparente (`neuroScene()`), così anche talamo, amigdala e i fasci del midollo si toccano; gli involucri (`SHELL`: sostanza bianca del
  telencefalo e del midollo, dura madre spinale) sono interi solo quando la domanda è su di loro. Si chiedono solo le parti che, tra le parti
  del corso del loro strato, si vedono almeno `NMIN` (12) pixel da una delle 26 direzioni: 33 parti su 46 voci con il modello. La telecamera
  guarda la struttura dal suo lato (spostamento in orizzontale rispetto al centro dello strato). Dopo la risposta si vedono solo la giusta
  (verde) e quella toccata (rossa).
- La risposta torna all'app sulla chiave del corso `n.<voce>` (non `3d:…`): sale la stessa maestria del tocco nel 2D e vale come ripasso.
  In coda `{module:'3d', mode:'neuro'}`.
- Prova: `neuro3d.mjs` (copia nelle note delle sessioni): gioco dalla Palestra, tocchi veri sul modello (punto trovato con il raggio),
  una risposta sbagliata, maestria `n.`, gioco dal foglio della zona con le sole strutture del satellite.

## Corso del corpo sul modello 3D (v0.84.0)
- Nei passi Ossa, Reperi e Muscoli aperti di un satellite del corpo c'è «🧊 Tocca sul modello 3D» (`data-p="3d"` in `path.js`); nel foglio di una
  zona della Palestra (corpo) i riquadri «Ossa/Reperi/Muscoli sul 3D» (`T3DN` in `game.js`). Aprono i giochi 3D di sempre (`ossa`, `reperi`,
  `muscoli`) con le sole strutture del satellite: `P.corpo3d([sat], tipo)` → [{id, key}] (strutture usabili del passo, chiave del corso),
  mandate da `play3d(set, sat)` in `ui.js` nel messaggio del gioco (`sel`, `lab` = nome del satellite).
- Atlante (`SEL_ID` in `atlante.js`): riconosce le parti dal nome inglese della fonte (`o.<slug>`, `r.<slug>`, `<slug>` del muscolo: tutti gli
  id della mappa coincidono), tiene solo quelle del satellite tra le visibili da fuori, titolo «Ossa · Gamba», vista sulla zona dal lato della
  struttura chiesta (`zoneView()`: il repere dalla sua direzione verso fuori, ossa e muscoli dallo spostamento rispetto al centro della zona).
  La risposta torna sulla chiave del corso (`o.`, `r.`, `m.`, campo `ck`): sale la stessa maestria della lezione e vale come ripasso.
  «Rigioca» resta sul satellite (`GAME.again`). Senza satellite i giochi 3D della Palestra restano quelli di prima (chiavi `3d:<serie>:<nome>`).
- Prova: `corpo3d.mjs` (copia nelle note delle sessioni): casi abbinati e distretti, pulsante nel satellite, tocchi veri su ossa, muscoli e
  reperi della gamba, maestria `o.`/`m.`/`r.`, Rigioca, foglio della zona, gioco 3D generale invariato; dati di BodyMania intatti.

## Flotta (fase 4, v0.85.0)
- Decisioni dell'autore (19/11/2026): casate Osteon 🦴 (oro), Myon 💪 (rosso), Neuron 🧠 (viola), Cor 🫀 (blu); si cambia casata al
  massimo una volta per stagione (mese, ora italiana) e i punti già fatti restano alla casata di prima; vince la stagione la casata con
  più **punti totali**; in questo rilascio solo il nucleo. Rimandati: voto di capo e vice delle casate, annunci, banner caricati
  (Storage), tabellone delle azioni, segnalazioni dei contenuti, membro migliore della settimana, badge «Vincitore di stagione» e
  «Obiettivo d'equipaggio» (fase 5).
- Conti sul telefono (`js/flotta.js`, numeri in `regole.json` → `flotta`): `gain(n, true, pls)` in `percorso.js` (XP di progresso:
  passo fatto, satellite acceso, livello nuovo, ripasso in tempo, che ora conta come progresso come dice la specifica, esame) chiama
  `fleetGain()`: `S.fleet.days {'AAAA-MM-GG': {xp, raw, u}}`, punti = min(300, raw), doppi se vengono dal pianeta scelto (`S.set.pianeta`,
  colonna `pianeta` di `dextera_settings`, che c'era già). `pls` = pianeti della chiave (`plsOf(k)`, dall'indice `kidx`).
  Contributi agli equipaggi (`fleetContrib()`): una chiave del percorso che entra nel calendario del ripasso (maestria 2, una volta) o
  ripassata in tempo vale 1 per ogni suo pianeta; `S.fleet.wk {w: lunedì, pl: {pianeta: n}}` (la settimana prima in `wkp` finché non
  parte). Casata in `S.fleet.casata`/`cambiata`, risposte alle sfide in coda `S.fleet.ans`, premi dati `S.fleet.premi`.
- Sincronizzazione: `syncFlotta()` (da `sync()` in `account.js`): casata (`ensureCasata`: se manca la assegna il server), giorni in
  `fleet_days` (ultimi 34), contributi in `crew_weeks` per ogni equipaggio (`S.fleet.crewPl`, aggiornato dalla scheda), risposte una alla
  volta. Senza il file SQL tutto resta sul telefono, avviso nel profilo e nella Flotta (`A.fleetMissing`). «Scarica i miei dati» ha `flotta`.
- Scheda Flotta (`js/social.js`), quattro viste (`.seg3.s4`): **Amici** (classifica della settimana per XP di progresso, vista
  `dextera_classifica_settimana`; senza il file SQL la vecchia per XP totali), **Casate** (la propria con punti di oggi e del mese, pianeta
  scelto, cambio una volta per stagione; stagione in corso da `season_scores`; albo da `seasons`), **Equipaggi** (codice con Copia e
  Condividi, obiettivo della settimana = 6 contributi per membro sul pianeta scelto da capo o vice, il proprio contributo visto solo da sé,
  +50 XP a testa una volta per settimana quando `crews.contributi` arriva all'obiettivo; il capo nomina il vice (da 3 membri) e toglie membri;
  sfide), **Tutti** (classifica generale di prima).
- Sfide: un membro sceglie 5 strutture del pianeta dell'equipaggio (passi ossa, reperi, muscoli, strutture: chiavi del percorso) e le
  lancia (`crew_challenges`); gli altri rispondono una volta: `startChallenge()` in `lezione.js` (`kind:'sfida'`, scheda Palestra, tocco o
  nome, a scelta sotto maestria 2, niente cuori), `useMod` e `setTab` arrivano da `ui.js` (`setSocialNav`). I nomi delle strutture si vedono
  solo dopo aver risposto. Fine: «Torna alla Flotta», risultato in coda e poi in `crew_challenge_answers`; in coda partite `mode:'sfida'`.
- SQL: `supabase/migrations/20261123090000_dextera_flotta.sql` (da applicare dall'autore; prima si pubblica l'app). Tabelle
  `constellations` (4 righe, `membri`), `constellation_members` (casata scelta dal server, la meno numerosa; cambio una volta per stagione,
  hint `dextera_cambio`), `fleet_days` (casata del giorno decisa dal server, ultimi 35 giorni, vince il valore più alto; leggono sé e gli
  amici), `season_scores` (ricontate da trigger), `seasons` (storico, `admin.chiudi_stagione()` con pg_cron il primo del mese alle 00:30 UTC;
  i punti arrivati dopo la chiusura non cambiano il vincitore), `crews` (codice di 6 caratteri senza 0, 1, I, O generato dal server,
  `membri_ids` tenuto dai trigger e usato dalle regole di accesso, al massimo 10 membri e 3 equipaggi a testa; se esce il capo lo diventa il
  vice o il primo entrato; senza membri si scioglie), `crew_members` (si entra solo con il codice), `crew_weeks`, `crew_challenges` (10 al
  giorno per equipaggio), `crew_challenge_answers`. Le modifiche interne dei trigger passano con `set_config('dextera.interno')`.
  Su Supabase l'estensione safeupdate rifiuta gli `update` senza `where`, anche nei trigger (PGlite no): ogni update ha un `where`
  (in v0.85.0 `private.casata_conta()` non l'aveva e la Flotta non si apriva; corretto dall'autore il 19/11/2026).
  Errori con `hint` `dextera_*`, tradotti in `HINTS` di `social.js`. Provato con PGlite: 82 prove (`flotta_rls.mjs` nelle note delle
  sessioni). Cancellazione dell'account: durante i 30 giorni la persona resta negli equipaggi (la funzione di BodyMania non cambia);
  dopo, la cascata la toglie e il capo passa a un altro.
- `privacy.html`: due righe nuove nella tabella dei dati (Flotta ed equipaggi).
- Prova: `flotta.mjs` (copia nelle note delle sessioni, Chrome headless con un finto Supabase in memoria): ospite, account senza il file
  SQL (avvisi, punti in coda), con il file (casata, invio dei giorni, classifica della settimana, pianeta doppio, tetto di 300, cambio di
  casata una volta), equipaggi (crea, codice sbagliato, entra, premio una volta, contributo inviato, sfida con 5 strutture, risposta giocata
  nella Palestra e inviata, esci), offline, dati e cache di BodyMania intatti.

## Profilo e competenze (fase 5, v0.86.0)
- Decisioni dell'autore (19/11/2026): radar con due viste (per passo e per regione); sagoma = figura 2D a satelliti; titoli da livelli,
  esami e badge; copertina, vetrina e titolo visibili agli amici.
- `js/competenze.js` (numeri in `regole.json` → `profilo` e `badge`):
  - **Radar** (`radar(c, modo)`, `radarSvg()`): «Per passo» un asse per tipo di passo del corso (corpo: Ossa, Reperi, Muscoli, Connessioni,
    Funzione, Casi clinici; neurologia: Strutture, Posizione, Funzione, Lesioni, Connessioni, Casi clinici), «Per regione» un asse per pianeta.
    Valore = maestria media (0–3 → 0–100%) di tutte le strutture usabili del corso per quell'aspetto, anche non iniziate; i casi clinici = quota
    dei satelliti con il passo progetto fatto. Percentuali scritte sulle etichette e nell'`aria-label`.
  - **Sagoma** (`sagoma(c)`): la figura 2D del corso (corpo: viste `a` e `p`; neurologia: cervello `ls` e `m`, `profilo.viste`), ogni parte del
    colore della maestria (corpo: chiave dell'osso, la stessa del percorso; cervello: la più alta tra le voci `n.` del corso che usano quella
    parte). Sopra ogni zona il simbolo dello stato del satellite (`sym()` esportato da `path.js`), al centro delle sue ossa nella vista in cui si
    vedono di più (`min_vis`), spostato di lato se tocca un altro simbolo. Simboli = pulsanti (Invio e Spazio); tocco su un osso → la zona di
    `satsOf()`; elenco «Stato dei satelliti» sotto. Corso scelto e vista del radar in `dextera-profilo` (solo comodità).
  - **Titoli** (`titoli()`, `titolo()`): titoli dei livelli raggiunti (`TITLES`, ora esportato da `state.js`), «Esperto di …» degli esami superati,
    `title` di alcuni badge (Primo corso, Sistema completo, Ripasso costante, Vincitore di stagione, Obiettivo d'equipaggio). Scelto in «Modifica
    profilo» (`select name="titolo"`), in `S.prof.titolo {id, t}`; si vede sotto il nome e nell'intestazione (`head()`; i titoli non si perdono).
- Profilo (`progress.js`): riquadri Sagoma (`.pfs`) e Competenze (`.pfc`); sul telefono dopo i numeri, sul computer nelle due colonne.
- **8 badge nuovi** (`BADGES5` in `badges.js`, `f5: true`, `NEW_BADGES`): `sat1` primo satellite acceso, `sapevo` prova «Lo so già» superata
  (`S.stats.prove`, contata in `finish()` di `lezione.js`), `pianeta1`, `corso1` (tutti i pianeti di un corso con l'esame), `sistema` (tutti i
  satelliti di un pianeta brillanti), `costante` (10 Ripassi del giorno, `S.stats.ripgiorni`: uno al giorno), `stagione` (`S.fleet.vinte`:
  `checkWins()` in `flotta.js`, chiamata da `loadFleet`, guarda una volta ogni stagione chiusa di `seasons` se in quel mese si sono portati punti
  alla casata vincitrice in `fleet_days`; `S.fleet.viste`), `equipaggio` (un premio in `S.fleet.premi`). Non retroattivi per prove e ripassi
  fatti prima della v0.86.0.
- Sincronizzazione (`account.js`): i badge della fase 5 partono in un invio a parte, così finché manca il loro file SQL non bloccano gli altri
  (avviso nel profilo, `A.badgeMissing`). Copertina, vetrina e titolo in `dextera_profili` (`syncCard()`: all'accesso vince la modifica più
  recente, `S.prof.ct` contro `aggiornato_il`; poi si invia quando `S.prof.cu`; senza tabella restano sul telefono, `A.cardMissing`).
  «Scarica i miei dati» ha `copertina_e_titolo`.
- Flotta: negli amici il pulsante «Profilo» apre la scheda dell'amico (copertina, foto, titolo, badge in vetrina; `friendCard()` in `social.js`,
  `SO.cards` da `dextera_profili`, copia offline in `dextera-social`).
- SQL: `supabase/migrations/20261124090000_dextera_badge.sql` (applicato dall'autore il 19/11/2026: 28 righe in `badge_classes`, RLS, 4 regole e trigger controllati; Security Advisor senza avvisi nuovi): 8 righe in `badge_classes`
  (stessi id e testi di `BADGES5`) e la tabella `dextera_profili` (copertina tra le 6 della galleria, vetrina di al massimo 3, titolo e id del
  titolo; la leggono sé e gli amici accettati, la scrive solo sé; il trigger `private.dextera_profilo()` toglie dalla vetrina i badge che la
  persona non ha in `badge_assertions` e riporta a oggi una data nel futuro; nessun `update` senza `where`). Provato con PGlite: 28 prove
  (`badge_rls.mjs` nelle note delle sessioni). `privacy.html`: una riga nuova (copertina, vetrina e titolo, visibili agli amici).
- Prova: `profilo.mjs` (note delle sessioni, Chrome headless con un finto Supabase): sagoma, radar nelle due viste, tocco e Invio sui satelliti,
  i badge (anche giocando prova e Ripasso del giorno), titoli, invio con e senza il file SQL, scheda dell'amica, stagione vinta, neurologia,
  niente scorrimento di lato, offline, dati di BodyMania intatti. `flotta.mjs` passa (salvo il controllo sulla versione 0.85.0).
- Casata ed equipaggi nel Profilo (v0.87.0, riquadro «Flotta», `.pfl`, dopo i numeri): `fleetCard()` in `social.js` dall'ultima copia della
  Flotta (`SO.fleet` in `dextera-social`, quindi anche offline) e dai conti del telefono: casata con simbolo e colore, posto nella stagione e punti
  della casata, tuoi punti di oggi e del mese; ogni equipaggio con membri, ruolo (capo o vice), barra dell'obiettivo della settimana e il tuo
  contributo. «Casate» ed «Equipaggi» aprono la Flotta sulla vista giusta (`openFleet()`). Aprendo il Profilo con la rete la Flotta si rilegge
  (`refreshFleet()`, al massimo ogni 10 minuti). Senza account: invito ad accedere; senza il file SQL della Flotta: avviso.
- Obiettivo del giorno e date d'esame nel Profilo (v0.88.0, riquadro «Studio», `.pfst`, subito dopo i numeri): `studyHtml()` in `progress.js`.
  Anello dell'obiettivo come nel Percorso, serie e scudi, scelta Leggero/Normale/Intenso (30/60/120 XP, `P.setGoal`); date degli esami di tutti i
  pianeti dei corsi, divise per corso, in «Date degli esami» (chiusa se non ci sono date, aperta con il numero di date se ci sono), con «Togli»:
  sono le stesse del riquadro sotto il pianeta (`P.setExam`, `S.set.date_esame` → `dextera_settings`). Con questo il Profilo ha tutto quello
  che chiede la sezione 7 della specifica.

## Altri corsi e percorsi (fase 6, v0.89.0)
- Scelte dell'autore (19/11/2026): due corsi nuovi semplici, **Cuore e vasi** e **Apparato respiratorio**; «Cosa studi?» alla prima apertura
  del Percorso, salvato sul server; il meccanismo dei percorsi più una bozza del **Test d'ingresso UCBM** (struttura di Biologia, Chimica e
  Fisica «in arrivo» più una parte di anatomia già giocabile); nessuna migrazione dei dati di BodyMania per ora.
- Corsi nuovi in `content/mappa.json` (v4; scritti una volta da `fase6_genera.py` nelle note delle sessioni, poi si correggono a mano):
  `cuore-vasi` (modulo `cuore`: pianeti Cuore, Grandi vasi, Vasi del corpo; 9 satelliti) e `respiratorio` (modulo `polmoni`: Polmoni, Vie aeree,
  Vasi polmonari; 6 satelliti). Tre passi per satellite: `strutture` (presentazione, scelta, tocco sulla figura del modulo, nome), `descrizione`
  (riconoscere la struttura dal testo, nome nascosto con `nmask`) e `progetto` (caso di `testi/casi.json` del modulo, oppure quiz finale).
  Si usano solo strutture con una descrizione scritta in `testi/torace.json`. Id delle strutture `c.<slug>` / `p.<slug>` (gli id dei moduli 2D);
  chiavi di maestria e ripasso: `c.`/`p.` (nome e posizione) e `cd.`/`pd.` (descrizione). Dati per la verifica dalle voci `torace.<slug>`
  (`content/lezioni.json` → `voci`). `testi.py` controlla che le strutture esistano nel modulo e in `torace.json` e che i casi siano del modulo.
- `lezione.js` (sezione «cuore e polmoni»): `showTor()` evidenzia la struttura nella vista in cui si vede di più, tocco solo se visibile
  (`torTap`); caso clinico con la sola ipotesi sul distretto (non ci sono funzioni come per i muscoli). Esame del pianeta, Ripasso del giorno,
  radar del Profilo (asse «Descrizione») e sfide della Flotta funzionano anche sui corsi nuovi. Niente pulsante 3D né Palestra per zone.
- Corsi «in arrivo» (`in_arrivo: true` in `mappa.json`, senza passi): non entrano in `corsi()`, sono in `corsiArrivo()`; nell'universo un
  sistema spento che apre il programma (`arrivoHtml()` in `path.js`). Il Test UCBM ha 3 pianeti (Biologia 9, Chimica 10, Fisica 7 satelliti,
  20 domande ciascuno nel test) con il testo del programma (`programma`); i contenuti si scriveranno più avanti.
- **Percorsi**: elenco in `content/index.json` → `percorsi` (id, nome, `file`; senza file = «in arrivo»: Fisioterapia, Medicina, MCB; `bozza`).
  Ogni file di `content/percorsi/` ha i nodi del gestionale e `corso` (il primo corso da aprire). `content.js` li carica tutti (`app.PERCORSI`,
  `app.PCAT`, `app.PBASE` = base); `applyStudio()` in `percorso.js` mette in `app.PERCORSO` quello scelto. `content/percorsi/ucbm.json` (bozza):
  da v0.91.0 il solo corso Test UCBM; l'anatomia (cuore, respiratorio, neurologia, ossa) sta dentro Biologia come satelliti ospiti (vedi «Satelliti ospiti»).
  Nei percorsi parziali satellite acceso ed esame superato non vanno in `path_progress` (sono gli stessi nodi del percorso completo, dove
  servono tutti i passi): restano sul telefono in `S.path.loc {'<percorso>:<nodo>': data}` (`fullSat`/`fullPl`, `LOC` in `percorso.js`).
  Maestria, ripasso e passi fatti sono in comune tra i percorsi.
- **«Cosa studi?»** (`studioScreen()` in `path.js`): alla prima apertura del Percorso (`!S.studio`) a tutto schermo, percorso (radio) e corsi
  (caselle; almeno uno), «Inizia» o «Decidi dopo»; poi lo stesso riquadro nell'universo, dove ogni cambio vale subito. `S.studio {percorso, corsi,
  t, u}` (`setStudio()`; corsi vuoti = tutti). I corsi scelti vengono prima sulla mappa e da loro partono Continua e il Ripasso del giorno
  (`isMine()`, `dueKeys`); gli altri restano aperti. Colori dei soli: cuore rosso, respiratorio blu, UCBM verde.
- Sincronizzazione: `syncStudio()` in `account.js` (prima di `syncPercorso`): all'accesso vince la scelta più recente (`S.studio.t` contro
  `aggiornato_il`), poi si invia quando `S.studio.u`. Senza la tabella la scelta resta sul telefono e il riquadro Account lo dice
  (`A.studioMissing`, con il nome del file). «Scarica i miei dati» ha `cosa_studi`. `privacy.html`: una riga nuova.
- SQL: `supabase/migrations/20261125090000_dextera_studio.sql` (applicato dall'autore il 19/11/2026, dopo la pubblicazione dell'app): tabella `dextera_studio`
  (user_id, percorso, corsi fino a 20 con id controllati, aggiornato_il), RLS con `(select auth.uid())`, la legge e la scrive solo la persona;
  il trigger `private.dextera_studio()` toglie i corsi doppi e riporta a oggi una data nel futuro; nessun `update` senza `where`. Provato con
  PGlite: 27 prove (`studio_rls.mjs` nelle note delle sessioni).
- Prova: `fase6.mjs` (note delle sessioni, Chrome headless con un finto Supabase, 67 controlli): «Cosa studi?» alla prima apertura, scelta UCBM,
  universo con 5 corsi, programma del Test UCBM, lezioni del cuore (presentazione, scelta, tocco, nome, tocco sbagliato), descrizione, caso,
  satellite acceso, prova sui polmoni, esame del pianeta Cuore, neurologia in UCBM, percorso parziale (piede solo sul telefono), Ripasso del
  giorno solo dei corsi scelti, cambio di percorso e di corsi dall'universo, radar con «Descrizione», invio con e senza il file SQL, offline,
  niente scorrimento di lato, dati e cache di BodyMania intatti.
- Testi di cuore, vasi e polmoni, casi e programma UCBM sono scritti dall'AI (da verificare). Da v0.90.0 Biologia del Test UCBM è giocabile, poi Chimica e Fisica (v0.90.1, vedi «Test UCBM»).
- Correzione v0.89.1 (19/11/2026, visto dall'autore sul telefono): l'app 0.88 aveva scaricato i contenuti 27 della 0.89 prima di aggiornarsi
  (i contenuti vanno in una cache a parte), non riconosceva le strutture `c.`/`p.` e segnava fatti tutti i passi di Cuore e vasi e
  Respiratorio (+30 XP ciascuno, con un avviso lunghissimo) e con un menu dei percorsi senza il Test UCBM (era ancora l'app vecchia).
  Ora: un passo senza strutture usabili non si fa mai da solo (`stepDone`); `repairTor()` in `percorso.js` (una volta per telefono, `S.fix89`)
  toglie i passi di quei due corsi segnati fatti senza la maestria e i loro satelliti rimasti «iniziato», e li cancella dal server
  (`S.path.del`, cancellati in `syncPercorso` prima di leggere, perché il server tiene lo stato più alto); gli XP restano (sul server vince
  il valore più alto). Con più di due premi insieme l'avviso è un riassunto («🎉 5 passi fatti! +150 XP», `rwText()` in `path.js`).
  `content/index.json` ha `app_min`: un service worker più vecchio non scarica quei contenuti (`tooNew()` in `sw.js`), li scarica la
  versione nuova all'installazione. Quando i contenuti richiedono codice nuovo, alza `app_min` alla versione che li capisce.
  Prova: `fix891.mjs` nelle note delle sessioni.
- Materie del Test UCBM visibili (v0.89.2, chiesto dall'autore): con il percorso UCBM il riquadro «Cosa studi?» (prima apertura e universo)
  ha «Le materie del test»: Biologia, Chimica e Fisica (20 + 20 + 20 domande), ognuna apribile con gli argomenti (`materieHtml()` in `path.js`,
  `arrivoDi(pid)` in `percorso.js`) e la fonte (`fonte` del corso in `mappa.json`: Allegato B del bando UCBM 2026/27, copia del testo in
  `ucbm-allegato-b-programmi.txt` nelle note delle sessioni); sopra i corsi una riga dice che l'anatomia è dentro Biologia, nell'argomento «Anatomia e fisiologia» (v0.91.0).

## Test UCBM: Biologia, Chimica e Fisica giocabili (v0.90.0–0.90.1)
Scelte dell'autore: domande miste (nelle lezioni scelta tra 5 e risposta scritta, termine o numero; prove e simulazione solo formato del
test), 3 passi per satellite, una materia alla volta (prima Biologia), simulazione sempre aperta.
- Testi: `testi/ucbm-biologia.json`, 270 voci scritte dall'AI (fonte AI, stato «da verificare»): 9 argomenti × 30 (10 per passo). Ogni voce
  `q.bio.<arg>.<nn>` ha `sat`, `passo` (1–3), `domanda`, 5 `opzioni` diverse (la prima è la giusta, l'app le mescola), `spiegazione`;
  `concetto` (obbligatorio nel passo 1, mostrato come presentazione prima della prima domanda), `scritta` facoltativa (stringa con `alts` o
  numero; vietata nel passo 3). `ucbm()` in `testi.py` controlla tutto e scrive `content/ucbm.json` `{quesiti, passi}`: passi
  `<sat>.1/.2/.3` (Concetti, Applicazione, Quesiti del test; tipi `concetti`/`applicazione`/`test`, aspetto `q`).
- Chimica: `testi/ucbm-chimica.json`, 300 voci (10 argomenti × 30, stesso formato, id `ucbm.chi.<arg>.<nn>`), scritte dall'AI e da verificare;
  esercizi di calcolo nel passo 2 con risposta numerica. Le domande la cui risposta è una frase restano solo a scelta (niente `scritta`);
  una risposta in percentuale ha anche il valore diviso per 100 (`qNum('80%')` = 0,8). Nessun codice nuovo: `testi.py` legge ogni
  `testi/ucbm-*.json`, la revisione ha il tipo in `TIPI`.
- Fisica (v0.90.1): `testi/ucbm-fisica.json`, 210 voci (7 argomenti × 30, id `ucbm.fis.<arg>.<nn>`), stesso formato e stesse regole.
  Con tutte e tre le materie nessun pianeta è «in arrivo» e la simulazione è completa (60 domande, 100 minuti, soglia 12/60).
  `elenco()` in `path.js` scrive «Biologia, Chimica e Fisica»; l'introduzione della simulazione completa elenca «(Biologia 20, Chimica 20, Fisica 20)».
- `content/percorsi/ucbm.json` e `mappa.json` hanno i satelliti UCBM senza passi: `mergeUcbm()` in `content.js` li prende da `ucbm.json`;
  un pianeta senza passi ha `in_arrivo: true` (Chimica, Fisica), il corso perde `in_arrivo` appena una materia è pronta. Dati in `app.UCBM`.
- Chiavi: l'id della voce (`q.bio.…`) è anche la chiave di maestria e ripasso (compatibile con le regole SQL di `review_items`,
  `path_progress`, `segnalazioni`); nelle segnalazioni l'id è `ucbm.bio.<arg>.<nn>`. `isQ`, `qz`, `isUcbm`, `QCAMPI` in `percorso.js`.
- Lezioni (`lezione.js`): senza figura, a tutto schermo (`body.pg`). `qType()`: passo 3 ed esame solo scelta; prova e ripasso usano la
  scritta se c'è. Una voce senza scritta conta come «ricordo» con la scelta, fino a maestria `scelta_max` (2). `qNum()` legge virgola,
  frazioni, %, notazione scientifica e ×10^; `qOk()` confronta i numeri con `tolleranza` (2%). Passo 3 ed esame hanno il timer di 100 s
  a domanda. Il feedback mostra la risposta giusta e la spiegazione.
- Simulazione (`js/simulazione.js`, dalla scheda del sistema): con tutte e tre le materie 60 domande in 100 minuti; finché manca una materia,
  20 domande per materia pronta con tempo in proporzione (con Biologia e Chimica: 40 domande in 66 min 40 s). Domande a giro tra gli argomenti, prima quelle del passo 3, evitando quelle dell'ultima volta
  (`S.ucbm.last`). Timer unico, navigazione avanti/indietro, «Lascia in bianco», griglia dei numeri, «Consegna» con conferma. Punteggio
  +1 / −0,2 / 0, soglia 12/60 in proporzione; risultati per materia, 3 argomenti più deboli («Studia» apre il satellite), elenco con
  spiegazioni. Ogni risposta passa da `reviewAnswer`; 3 XP per giusta; storico in `S.ucbm.sim` (ultime 20); `queue.add` modalità `simulazione`.
- Regole in `content/regole.json` → `ucbm` (`scelta_max`, `secondi`, `tolleranza`, `simulazione`). `app_min` 0.90.0.
- Revisione: tipo `ucbm-biologia` in `revisione.js`, quesiti sotto il loro satellite con «Come lo vede lo studente» (`quizHtml()`).
  `importa_revisione.py` riporta a numero le correzioni numeriche di `scritta`.
- Prova: `ucbm/prova.mjs` (26 controlli, solo Biologia), `ucbm-chi/prova.mjs` (28, con Chimica: 40 domande in 66 min 40 s), `ucbm-fis/prova.mjs` (29, simulazione completa) e la copia
  aggiornata della prova di fase 6 nelle note delle sessioni. Generatori dei testi (`ucbm/*.py`, `ucbm-chi/*.py`, `ucbm-fis/*.py`, `build.py`) nelle stesse note.

## Satelliti ospiti (v0.91.0, `app_min` 0.91.0, contenuti 33, `ucbm.json` v5)
Chiesto dall'autore: percorsi separati (Test UCBM, corso MCB, Medicina), ognuno con il suo universo. Un percorso può mostrare dentro un
proprio satellite i satelliti di altri corsi, senza aprire quei corsi sulla mappa.
- Nodo satellite con `"ospite_di": "<satellite dello stesso percorso>"`: contenuti, passi, chiavi di maestria e progressi restano quelli del
  satellite originale (in comune con gli altri percorsi); la figura della lezione è quella del suo modulo. `controlla_percorsi` in `testi.py`
  vuole che `ospite_di` punti a un satellite non ospite dello stesso percorso.
- `percorso.js`: `ospiti(sat)` (gli ospiti di un satellite, per `ordine`), `hostOf(sat)`, `satById` li trova, `planetOf` dà il pianeta
  dell'ospitante, `corsoNav(x)` il corso della navigazione (invece `corsoOf` resta il corso dei contenuti). `checkProgress`, l'indice delle
  chiavi e il Ripasso del giorno contano anche gli ospiti; non entrano nella mappa del pianeta, nell'esame né nella simulazione.
- `path.js`: nella scheda del satellite ospitante il riquadro «Anatomia da studiare» (`ospitiHtml`, raggruppati per corso con i passi);
  le briciole e «su» di un ospite tornano all'ospitante. Caso clinico di un ospite: i distretti tra cui scegliere sono gli altri ospiti
  dello stesso corso (`lezione.js`).
- `ucbm.json`: 38 ospiti in `ucbm-bio-anatomia` (cuore e vasi, respiratorio, neurologia; muscolo-scheletrico con il solo passo Ossa).
- Non ancora per percorso: Palestra per zone (cerca il corso del corpo tra i corsi del percorso), badge e competenze che contano i satelliti
  dei corsi, XP, casate e campionato (vedi la proposta sulla gamification per percorso, da decidere con l'autore).
- Prova: `osp/prova.mjs` (13 controlli) e `fase6c.mjs` (71, la prova di fase 6 adattata) nelle note delle sessioni.

## Mappa del percorso (`content/mappa.json`)
Corso → 4 pianeti → 17 satelliti (con `ordine` della specifica) → 6 passi (`ossa`, `reperi`, `muscoli`, `connessioni`, `funzione`,
`progetto`). Ogni passo ha `strutture` (id di `content/corpo.json`: `o.<osso>` e muscoli; reperi `r.<slug del nome inglese>`), `aspetto`,
`domande`, `giochi`; `non_3d`/`solo_2d`/`solo_3d` dicono cosa manca in un'atlante; `salta: true` per i passi vuoti (Cranio: passi 3–5).
È un file di dati scritto una volta e poi corretto a mano (non lo genera `testi.py`, che però controlla che ogni id esista e che ogni
osso e muscolo del 2D stia in almeno un satellite). Reperi: solo quelli visibili da fuori (`visibili.json`); sulle ossa condivise tra più
satelliti la divisione per posizione sta in `divisione_reperi` (confermata dall'autore, con il motivo di ogni repere).
L'app la carica in `app.MAPPA` (elencata in `files` di `content/index.json`); la scheda Percorso per ora elenca pianeti e satelliti.

## Pagina di revisione (`revisione/`)
`revisione/index.html` e `revisione.js`: pagina a sé, senza account, per i docenti. Legge `testi/*.json` e `content/mappa.json` dalla
rete (non è nella cache offline) e mostra ogni dato con fonte e stato, diviso per satellite (più encefalo e nervi, altri dati e
correzioni alla fonte). Filtri per satellite, stato, fonte, testo e «solo da segnare»; avanzamento per satellite; Stampa; «Vedi
nell'atlante» apre `atlante/index.html?vedi=<ref>` (muscolo, repere o osso; per il resto la ricerca). Il docente segna Giusto/Sbagliato
e scrive correzione e nota: tutto resta nel browser (`dextera-revisione`) finché non esporta il CSV (punto e virgola, con BOM per Excel;
colonne id, tipo, voce, campo, valore, fonte, stato, esito, correzione, nota, revisore, data; gli elenchi con ` | `).
Casi clinici di neurologia: voce «Casi clinici di neurologia» (`#casin`, `CASIN` in `revisione.js`) nel filtro e nell'avanzamento, con i 14
casi divisi per satellite (campo `satellite` del caso); non compare in «Tutti», dove i casi stanno già sotto i loro satelliti. Ogni caso
ha sopra i suoi dati il riquadro «Come lo vede lo studente» (`casoHtml()`: struttura del corso, indizi in ordine, opzioni con la giusta
segnata, spiegazione; con una correzione scritta mostra il caso corretto), gli avvisi se la risposta non è tra le opzioni o ci sono
opzioni ripetute, e «Segna giusti i dati ancora da segnare». Gli id esportati restano `caso.neuro.<n>.<campo>`.
`python3 atlante/build/importa_revisione.py risposte.csv` mostra le differenze; con `--applica` scrive `testi/` (giusto → verificato,
correzione → fonte docente e stato corretto, valore di prima in `verifica.prima`; sbagliato senza correzione → segnalato), aumenta la
`version` dei file toccati e rilancia `testi.py`. Salta le righe il cui valore è cambiato dopo l'esportazione. `--senza-nomi` non salva
il nome del docente. I file di `testi/` si riscrivono sempre con `testi.scrivi_file()` (una riga per dato).

## Storia (da BodyMania)
Ereditato da BodyMania e già fatto: contenuti JSON versionati e moduli JS, PWA con controllo delle versioni, schema
Supabase (`supabase/migrations/`, quello che usa BodyMania), login con email e password (Google da attivare),
profilo, sincronizzazione con coda locale, amici e classifiche (scheda Flotta: una sola amicizia per coppia, ultima
classifica in `dextera-social` per vederla offline), 20 badge. I file SQL di `supabase/migrations/` sono quelli di
BodyMania: Dextera non li cambia; le tabelle nuove avranno file nuovi, che l'autore applica a mano.
Idee rimandate da BodyMania: livello tendini e legamenti, puzzle a strati, sfida a tempo, duello 1 contro 1.

## Modello dati (tabelle di BodyMania, in comune)
- `profiles` (id = utente, username, xp, serie di giorni)
- `friendships` (user_id, friend_id, stato: in attesa / accettata)
- `game_results` (id generato dal client, user_id, modulo, modalità, punteggio, totale, xp, giocata_il)
- `mastery` (user_id, item_id, livello 0–3, aggiornato_il)
- `badge_classes` (id, nome, descrizione, criterio, immagine)
- `badge_assertions` (id, user_id, badge_id, assegnato_il)
- Viste: classifica globale e classifica amici.

## Privacy (GDPR) e sicurezza (19/11/2026)
- Database: righe dei profili visibili agli iscritti solo se attivi (o il proprio), colonne leggibili solo id, nome utente, foto,
  XP, serie, `last_day`, `deleted_at` (grant per colonna, `20261120090000_viste_senza_definer.sql`); le viste `leaderboard`,
  `leaderboard_friends`, `public_profiles` sono `security_invoker` (niente avviso critico del Security Advisor); il proprio
  profilo completo si legge con `my_profile()` (`ownProfile()` in `account.js`, con ripiego sulla tabella). Email solo in `auth.users` (mai leggibile dall'app: la vedono gli amministratori
  del progetto nel pannello di Supabase). Colonne modificabili del profilo elencate nel `grant update`; nelle amicizie si cambia
  solo `status` (prima chi riceveva una richiesta poteva cambiare `user_id`); badge visibili solo a chi li ha; limiti su lunghezze,
  XP e formato della foto (JPEG/PNG/WebP base64). Nessun ruolo di amministratore nelle tabelle.
  Cancellazione in due tempi (`20261119120000_cancellazione_ripristino.sql`): `delete_my_account()` mette `profiles.deleted_at`,
  blocca l'accesso (`auth.users.banned_until`), chiude le sessioni, toglie l'account da viste e amicizie; dopo 30 giorni
  `admin.pulisci_cancellati()` (pg_cron ogni notte) cancella `auth.users` e a cascata tutto il resto. Schema `admin` (non esposto,
  solo SQL Editor): vista `account_in_cancellazione`, `ripristina_account(email)`, `cancella_definitivamente(email)`.
  Richieste di amicizia solo verso profili di `public_profiles` (attivi e con nome).
  Nelle regole `(select auth.uid())` invece di `auth.uid()` (calcolato una volta per richiesta: avvisi del Performance Advisor,
  `20261120100000_prestazioni_rls.sql`, con indici su `friendships.friend_id` e `badge_assertions.badge_id`).
  Il trigger che crea il profilo alla registrazione usa `private.nuovo_profilo()` (schema non esposto,
  `20261120110000_trigger_privato.sql`). Restano due avvisi voluti del Security Advisor: `delete_my_account()` e `my_profile()`
  sono security definer chiamabili dagli iscritti (servono all'app e agiscono solo su chi le chiama).
  Le regole sono state provate su PostgreSQL 16 con un finto schema `auth` (utenti A, B, C che provano a leggere e scrivere i dati
  altrui): da rifare se si cambiano le policy.
- App: l'app non scrive SQL (PostgREST passa i valori come parametri); gli id che finiscono in un filtro `.or()` passano da
  `UUID` in `social.js`; tutto il testo degli utenti passa da `esc()`. Content-Security-Policy in `<meta>` di `index.html`,
  `atlante/index.html`, `privacy.html` e `termini.html`: niente script in linea (tema in `js/tema.js`, pagina dell'atlante in `atlante/pagina.js`),
  solo la mappa degli import dell'atlante con l'impronta sha256 (se la cambi, ricalcola l'impronta), rete solo verso Supabase.
- Informativa: `privacy.html` (titolare Alessandro Fiumicelli, dati su Supabase in UE, Parigi). Termini di servizio: `termini.html`
  (uso solo per studio, contenuti dell'AI da verificare, regole di comportamento, licenze, responsabilità); accettati con la
  stessa spunta della registrazione (`terms_v` nei metadati) e con l'avviso sotto "Accedi con Google".
  Registrazione con spunta obbligatoria (informativa letta, almeno 14 anni) e versione `PRIVACY_V` salvata nei metadati
  dell'utente; per Google un avviso sotto il pulsante. Profilo → "Privacy e dati": scarica i miei dati (JSON con dispositivo e
  server, `myData()`), cancella i dati da questo dispositivo, elimina l'account. Password di almeno 8 caratteri nell'app.

## Vincoli
- Nel frontend va solo la chiave pubblica di Supabase. La chiave `service_role` non entra mai
  nel repository né nel codice del browser.
- I punteggi sono calcolati sul dispositivo, quindi falsificabili: accettato per l'uso tra amici.
- Testi anatomici, casi clinici e disegni sono stati scritti dall'AI a memoria: sono da verificare
  su un atlante o con un professionista. Non presentarli come fonte validata.
- Lingua dell'interfaccia e dei contenuti: italiano.
