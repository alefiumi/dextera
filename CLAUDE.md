# Dextera – il percorso dell'anatomia

App web per studiare anatomia muscolo-scheletrica (pubblico: fisioterapisti e studenti) con un percorso guidato
stile Duolingo e il metodo bottom-up della 42: corso (sole) → pianeta (regione) → satellite (zona, è un progetto)
→ 6 passi (ossa, reperi, muscoli, connessioni, funzione, caso clinico). Nasce dal codice di BodyMania
(repository `alefiumi/bodymania`, ramo `pwa`, commit e3e4b6f), che resta com'è per i suoi utenti.

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
- Fase 1 – Percorso minimo (SQL: path_progress, dextera_settings, error_reports). Fasi 2–7: vedi la specifica.
- GitHub Pages si attiva (ramo `main`, cartella radice) solo quando chiavi e cache sono separate e verificate.

## Stato attuale
Codice di BodyMania con nome, chiavi e schede di Dextera. Diviso in:
- `index.html` (solo struttura), `css/style.css`.
- `js/`: moduli ES. `main.js` avvia, `content.js` carica i JSON, `shapes.js` trasforma le forme in SVG,
  `state.js` (stato condiviso `app`, salvataggio), `figure.js` (figura, zoom, pan), `explore.js`,
  `game.js`, `puzzle.js`, `progress.js`, `ui.js` (cambio di modulo e tab, clic),
  `gate.js` (schermata di avvio), `account.js`, `badges.js`, `social.js` (scheda Flotta), `path.js` (scheda Percorso, per ora un segnaposto), `install.js` (pannello "Installa e usa offline": istruzioni per browser, stato della copia offline).
- Barra in basso a 4 schede (`setTab` in `js/ui.js`): **Percorso** (`path`, segnaposto fino alla fase 1),
  **Palestra** (`play`, l'ex Gioca: tutti i giochi 2D e 3D), **Atlante** (`atlas`: l'ex Esplora in 2D e l'atlante 3D,
  scelti con i pulsanti `#asw` in alto; scelta in `dextera-atlante`), **Flotta** (`soc`, l'ex Amici). Il **Profilo**
  (`prog`) non ha una scheda: si apre toccando la foto in alto a sinistra (`#me`, disegnata da `head()` in `state.js`).
  Percorso, Profilo e Flotta usano tutto lo schermo senza figura (classe `pg` su `body`).
- Figura: barra `.tbar` sopra il disegno (moduli a sinistra, zoom a destra), mai sovrapposta; l'svg occupa
  tutta la larghezza e mantiene le proporzioni (con lo zoom si vede anche ciò che sta ai lati).
  Zoom: pulsanti, rotella, pizzico a due dita con eventi touch (su iPhone gli eventi pointer a due dita
  vengono annullati dal sistema); un dito sposta la figura quando è ingrandita.
- Puzzle: `slotAt(x,y,id)` in `figure.js` sceglie il posto vuoto più vicino entro `SLOT_PX` (28 px), anche se
  coperto da altre ossa, con precedenza al pezzo in mano; altrimenti l'osso sotto il dito (errore).
  Il pezzo trascinato è disegnato alla scala della figura, con il centro 42 px sopra il dito.
- Scheda sotto la figura dentro `#pw`: la freccia `#fold` sul bordo in alto a destra la abbassa (striscia di due righe
  scorrevole, in gioco resta la domanda) e la rialza; scelta in `dextera-fold`. Stessa freccia nell'atlante 3D (`dextera-fold3d`).
- Spunta verde in alto a destra (`#off`) quando la copia offline è pronta; il pulsante "Installa l'app"
  nell'Atlante 2D compare solo fuori dall'app installata.
- `content/`: `index.json` (versione globale, ordine dei moduli), `corpo.json`, `lat.json`, `sag.json`,
  `neuro-strutture.json` (testi in comune tra `lat` e `sag`), `nervi-cranici.json`. Ogni file ha `version`.
  Le forme sono descrizioni come `{"poly":"M…"}`, `{"ln":[x1,y1,x2,y2,spessore]}`, `{"stack":[x,y,w,h,n]}`
  (tipi in `js/shapes.js`). Quando cambi un contenuto, aumenta la `version` del file e quella di `index.json`.
- Serve un server locale (`npx serve .`): con il doppio clic su `index.html` (`file://`) moduli e JSON non si caricano.
- PWA: `manifest.webmanifest`, icone in `icons/` (pianeta con un satellite su fondo indaco; PNG generate da uno script
  Python senza pacchetti, lo script non è nel repo), `sw.js`. Cache: `dextera-app-<APP_VERSION>`, `dextera-content-<versione>`,
  `dextera-3d-<MODEL_VERSION>`.
  Il service worker copia in cache l'elenco `APP_FILES` all'installazione e serve l'app dalla cache; all'installazione
  scarica anche i contenuti se la versione è cambiata (una versione nuova dell'app può richiedere il formato nuovo).
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
- Moduli 2D: `corpo` (121 ossa singole in 26 gruppi, vista anteriore e posteriore; 208 muscoli), `lat` (emisfero
  sinistro visto di lato, 57 strutture) e `sag` (faccia mediale dell'emisfero destro, 81 strutture), 12 nervi cranici.
- Disegni 2D ricavati dal modello 3D (non più a mano): `node atlante/build/proietta_2d.mjs <tmp.json>` proietta ossa,
  encefalo e aree di origine e inserzione (z-buffer in software, contorni dei pixel visibili → tracciati SVG; senza pacchetti
  npm), poi `python3 atlante/build/contenuti_2d.py <tmp.json>` scrive `content/corpo.json`, `lat.json`, `sag.json` con nomi,
  descrizioni (`desc` di `dati.json`), gruppi, muscoli e casi (tutti i testi da `testi/`, vedi sotto). Di solito li lancia
  `python3 atlante/build/testi.py`, che rifà tutto. Ogni struttura ha `s.a`/`s.p` (forme per vista; per le ossa pari il
  primo tracciato è il lato destro, usato per i pezzi del puzzle) e `g` (gruppo); i gruppi hanno `m` (membri). Nel cervello i
  gruppi sono i lobi (partizione) più aree che si sovrappongono (`area: true`: Broca, Wernicke, giro precentrale, talamo…).
  Esclusi dal 2D: ossicini, cellule etmoidali, seni, cartilagini di naso e laringe, sesamoidi; denti e cartilagini costali
  sono una voce ciascuno; nel cervello i nuclei profondi (si vedrebbero attraverso gli spazi tra le superfici).
- Muscoli 2D: ossa di origine e inserzione dall'osso più vicino alle aree della fonte; dove la fonte non ha l'area, dal testo
  della scheda (`src: 'testo'`, segnalato nel pannello). 154 muscoli hanno origine e inserzione (usati nei giochi).
  Aree segnate dalla parte sbagliata nella fonte: correzioni `sposta_aree` in `testi/correzioni.json` (es. capo breve del bicipite femorale).
- Figura: barra con "Anteriore/Posteriore ⇄" (solo corpo) e "Ossa singole/Gruppi" ("Giri e solchi/Lobi e aree" nel cervello),
  scelta salvata in `dextera-2d`. Le due viste sono nell'svg insieme (una nascosta), le marcature valgono in tutte e due.
  Con i gruppi tutti i giochi usano i gruppi (`items()`, `itemOf()` in `state.js`); la risposta è giusta se si tocca un membro.
  Trova: con le singole si sceglie prima il gruppo, e per le ossa piccole la figura si ingrandisce sulla zona. Ricomponi: con le
  singole i pezzi sono le ossa di un gruppo (zona ingrandita), con i gruppi sono gruppi interi. Maestria: chiavi diverse per
  singole (`o.femur`, `b.precentral-gyrus`) e gruppi (gli id dei vecchi 22 gruppi: `femore`, `carpo`… e dei lobi).
- Modalità: Ricomponi (puzzle con trascinamento), Tendine-ponte, Caso clinico (indizi progressivi),
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
  All'accesso i progressi locali si uniscono al server tenendo il valore più alto (XP, risposte, maestria per voce;
  per la serie vale il giorno più recente; profilo: vince la modifica più recente, `profile_at`), poi dopo ogni `save()`
  parte un invio (3 s). Le partite finite vanno in `dextera-queue` e si inviano con upsert che ignora i doppioni.
- Profilo (dalla foto in alto, `js/progress.js`, a tutto schermo senza figura): foto (ritagliata a 128×128 JPEG e salvata
  come testo `data:` in `profiles.avatar`, così si vede offline), nome (con account: unico, regola `NAME_RE`), ruolo,
  presentazione; statistiche, badge, riquadro Account (sincronizza, cambia password, esci) e maestria del modulo.
  Profilo locale in `S.prof`; funziona anche senza account.
- Badge (`js/badges.js`): 20, calcolati sul dispositivo dopo ogni `save()` (avviso "Nuovo badge"); `S.badges` {id: data},
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
si salva la base (motore e `ossa.glb`, circa 3 MB in più), ogni altro strato la prima volta che si apre con la rete.
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
- Muscolo: tre viste, "Forma e aree", "Punti e linee" (pallino blu al centro di ogni area di origine, arancione
  per l'inserzione, linea viola che li unisce, sempre in primo piano) ed "Entrambe"; reperi della fonte entro 2,5 cm dai punti.
- Gruppi (`COMBO`, da `DATA.combo`): zampa d'oca, ischiocrurali, cuffia dei rotatori, tricipite della sura, quadricipite.
- Ricerca senza accenti, con abbreviazioni e nomi comuni (`SYN`: SIAS, SIPS, zampa d'oca, Broca…).
- Encefalo (pulsante 🧠): sezioni assiale, coronale e sagittale con cursore (piano di taglio su tutta la scena;
  durante il taglio il contorno è spento e le superfici sono a due facce) e scomposizione in 9 strati (`ST`, da `DATA.strati`), dalla
  dura madre ai ventricoli. Dura madre e aracnoide craniche non sono nella fonte: `makeShells()` le genera
  avvolgendo la corteccia, forma schematica dichiarata nel pannello.

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
sovraspinato) e 470 reperi. Le domande si scelgono prima per famiglia (`famOf`: coste, falangi, vertebre…).
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
I casi clinici del corpo sono 21 (12 nuovi, scritti dall'AI: da verificare; in `testi/casi.json`), validi anche nel 2D.
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
(gruppi di ossa `gruppo.ossa.*`, lobi e aree del cervello `gruppo.encefalo.*`, gruppi di muscoli e strati dell'encefalo
dell'atlante, descrizioni dei gruppi della fonte `gruppo.fonte.*` usate quando una struttura non ha la sua), `casi.json` (36 casi).
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
- I nomi di vasi, nervi, legamenti e visceri non sono in `testi/`: vengono da TA2 (con i refusi corretti).
- I testi sono stati portati in `testi/` dai file generati del 18/11/2026: l'uscita rigenerata è uguale, salvo i nomi italiani di
  10 strutture del cervello ora anche nel 3D, le descrizioni di ipofisi ed epifisi nel 3D e i gruppi e strati passati da `atlante.js` a `dati.json`.

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

## Vincoli
- Nel frontend va solo la chiave pubblica di Supabase. La chiave `service_role` non entra mai
  nel repository né nel codice del browser.
- I punteggi sono calcolati sul dispositivo, quindi falsificabili: accettato per l'uso tra amici.
- Testi anatomici, casi clinici e disegni sono stati scritti dall'AI a memoria: sono da verificare
  su un atlante o con un professionista. Non presentarli come fonte validata.
- Lingua dell'interfaccia e dei contenuti: italiano.
