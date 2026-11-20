/* Service worker di Dextera.
   - Stessa origine di BodyMania (alefiumi.github.io): tutte le cache hanno il prefisso 'dextera-' e qui si cancellano
     solo cache con quel prefisso. Le cache di BodyMania ('bodymania-…') non si leggono né si toccano mai.
   - App (HTML, CSS, JS, icone): copiate in cache all'installazione e servite dalla cache.
     Quando cambi uno di questi file, aumenta APP_VERSION: il browser scarica di nuovo tutto l'elenco.
   - Contenuti (content/): serviti dalla cache. A ogni avvio, se c'è rete, si controlla content/index.json:
     se la versione è cambiata si scarica l'intero set in una cache nuova e lo si usa dall'avvio successivo.
   - Atlante 3D (atlante/): pagina, codice e dati vanno con l'app (APP_FILES). Motore three.js e modelli .glb
     stanno in una cache a parte (MODEL_CACHE), che non si riscarica a ogni nuova versione dell'app: all'installazione
     si salva la base (motore e scheletro); poi, appena c'è rete, tutti gli altri strati uno alla volta in sottofondo
     (fillModels), così l'atlante 3D funziona tutto anche offline. Quando sono tutti salvati si scrive il segno MODEL_DONE.
     Quando cambi un file in atlante/vendor/ o un .glb, aumenta MODEL_VERSION. */
// Versione dell'app (numerazione classica, MAGGIORE.MINORE.CORREZIONE, fase «alpha»):
//   0   → 1 quando l'app esce dalla prova (rilascio pubblico, fase 7);
//   68  → +1 per ogni funzione nuova pubblicata (la CORREZIONE riparte da 0);
//   .X  → +1 per ogni commit che cambia un file dell'app (correzioni e ritocchi).
// È anche il nome della cache: cambiandola il browser riscarica l'app. L'app la legge dal nome della cache (install.js).
const APP_STAGE = 'alpha';
const APP_VERSION = '0.93.0';
const APP_CACHE = 'dextera-app-' + APP_VERSION;
const CONTENT_PREFIX = 'dextera-content-';
const MODEL_VERSION = '1';
const MODEL_CACHE = 'dextera-3d-' + MODEL_VERSION;
const APP_FILES = [
  './', 'index.html', 'privacy.html', 'termini.html', 'manifest.webmanifest', 'css/style.css', 'js/tema.js',
  'js/main.js', 'js/util.js', 'js/state.js', 'js/content.js', 'js/shapes.js', 'js/figure.js',
  'js/explore.js', 'js/game.js', 'js/puzzle.js', 'js/progress.js', 'js/ui.js', 'js/install.js',
  'js/config.js', 'js/account.js', 'js/gate.js', 'js/logo.js', 'js/badges.js', 'js/competenze.js', 'js/social.js', 'js/flotta.js', 'js/path.js', 'js/percorso.js', 'js/lezione.js', 'js/simulazione.js', 'js/segnala.js', 'vendor/supabase.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'atlante/index.html', 'atlante/pagina.js', 'atlante/atlante.js', 'atlante/dati.json'
];
const MODEL_BASE = [
  'atlante/vendor/three.module.js', 'atlante/vendor/three.core.js',
  'atlante/vendor/addons/controls/OrbitControls.js', 'atlante/vendor/addons/effects/OutlineEffect.js',
  'atlante/vendor/addons/libs/meshopt_decoder.module.js', 'atlante/vendor/addons/loaders/GLTFLoader.js',
  'atlante/vendor/addons/utils/BufferGeometryUtils.js', 'atlante/vendor/addons/utils/SkeletonUtils.js',
  'atlante/ossa.glb'
];
// tutti gli strati dell'atlante (circa 7 MB oltre alla base): si scaricano in sottofondo, vedi fillModels()
const MODEL_LAYERS = ['muscoli', 'legamenti', 'inserzioni', 'encefalo', 'meningi', 'midollo', 'nervi', 'sensi', 'vasi', 'visceri']
  .map(f => 'atlante/' + f + '.glb');
const MODEL_DONE = 'atlante/.offline-completo'; // segno nella cache dei modelli: c'è tutto (lo legge install.js)
const isModel = rel => rel.startsWith('atlante/vendor/') || (rel.startsWith('atlante/') && rel.endsWith('.glb'));
const abs = p => new URL(p, self.registration.scope).href;

/* ---------- contenuti ---------- */
// Versioni dei contenuti in cache, dalla più recente. Si tiene anche la precedente, perché una pagina
// aperta prima dell'aggiornamento continua a chiedere i file della sua versione (parametro ?v=).
const contentVersions = async () => (await caches.keys()).filter(k => k.startsWith(CONTENT_PREFIX))
  .map(k => k.slice(CONTENT_PREFIX.length)).sort((a, b) => Number(b) - Number(a));
const contentCacheName = async v => {
  const vs = await contentVersions();
  const pick = v != null && vs.includes(v) ? v : vs[0];
  return pick == null ? null : CONTENT_PREFIX + pick;
};
const cachedVersion = async () => (await contentVersions())[0] ?? null;

// Scarica tutti i file dei contenuti; li mette in cache solo se arrivano tutti (mai un set a metà).
async function downloadContent(idx) {
  const files = new Set(['index.json', ...idx.modules.map(id => id + '.json'), idx.nc, ...(idx.files || [])]);
  const res = await Promise.all([...files].map(async f => {
    const r = await fetch(abs('content/' + f), {cache: 'no-store'});
    if (!r.ok) throw new Error('content/' + f + ': HTTP ' + r.status);
    // il corpo si legge subito: una risposta lasciata in sospeso tiene occupata la connessione e, con HTTP/1.1
    // (al massimo 6 connessioni per server), può bloccare gli altri download e l'installazione
    return [f, new Response(await r.blob(), {headers: r.headers})];
  }));
  const name = CONTENT_PREFIX + idx.version, cache = await caches.open(name);
  await Promise.all(res.map(([f, r]) => cache.put(abs('content/' + f), r)));
  for (const v of (await contentVersions()).slice(2)) await caches.delete(CONTENT_PREFIX + v);
}
const fetchIndex = async () => {
  const r = await fetch(abs('content/index.json'), {cache: 'no-store'});
  if (!r.ok) throw new Error('content/index.json: HTTP ' + r.status);
  return r.json();
};
// Scarica gli strati 3D che mancano, uno alla volta (non occupa tutte le connessioni). Senza rete si ferma e
// riprova al prossimo avvio. Gli strati già in cache non si riscaricano.
let filling = null;
function fillModels() {
  return filling ||= (async () => {
    try {
      const cache = await caches.open(MODEL_CACHE);
      if (await cache.match(abs(MODEL_DONE))) return;
      for (const f of [...MODEL_BASE, ...MODEL_LAYERS]) {
        if (await cache.match(abs(f))) continue;
        const r = await fetch(abs(f), {cache: 'reload'});
        if (!r.ok) throw new Error(f + ': HTTP ' + r.status);
        await cache.put(abs(f), new Response(await r.blob(), {headers: r.headers}));
      }
      await cache.put(abs(MODEL_DONE), new Response('1'));
      for (const c of await self.clients.matchAll()) c.postMessage({type: 'models-ready'});
    } catch (e) { /* offline: si riprova al prossimo avvio con la rete */ }
    finally { filling = null; }
  })();
}
// Contenuti che chiedono un'app più nuova (app_min in content/index.json): non si scaricano con questa versione, li scarica
// all'installazione la versione nuova del service worker. Così un'app vecchia non apre mai contenuti di un formato che non conosce.
const ver = v => String(v || '0').split('.').map(Number);
const tooNew = idx => { const a = ver(APP_VERSION), b = ver(idx.app_min); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0); } return false; };
let checking = null;
// Controllo delle versioni (solo con rete). Se scarica un set nuovo, avvisa le pagine aperte.
function checkContent() {
  return checking ||= (async () => {
    try {
      const idx = await fetchIndex(), old = await cachedVersion();
      if (String(idx.version) === old || tooNew(idx)) return;
      await downloadContent(idx);
      if (old !== null) for (const c of await self.clients.matchAll()) c.postMessage({type: 'content-updated', version: idx.version});
    } catch (e) { /* offline o server irraggiungibile: si continua con la cache */ }
    finally { checking = null; }
  })();
}

/* ---------- ciclo di vita ---------- */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_FILES.map(f => new Request(abs(f), {cache: 'reload'})));
    // contenuti: una versione nuova dell'app può aver bisogno dei contenuti nuovi (formato cambiato), quindi si
    // scaricano qui, prima di attivarla. Senza rete si tengono quelli in cache (se non ce ne sono, l'installazione fallisce).
    try { const idx = await fetchIndex(); if (String(idx.version) !== await cachedVersion() && !tooNew(idx)) await downloadContent(idx); }
    catch (err) { if (!(await contentCacheName())) throw err; }
    // base dell'atlante 3D: solo i file che mancano (gli strati già salvati restano)
    const models = await caches.open(MODEL_CACHE);
    const missing = [];
    for (const f of MODEL_BASE) if (!(await models.match(abs(f)))) missing.push(f);
    await models.addAll(missing.map(f => new Request(abs(f), {cache: 'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if ((k.startsWith('dextera-app-') && k !== APP_CACHE) || (k.startsWith('dextera-3d-') && k !== MODEL_CACHE)) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* ---------- richieste ---------- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  const rel = new URL(req.url).pathname.slice(new URL(self.registration.scope).pathname.length);
  if (rel.startsWith('content/')) {
    if (rel === 'content/index.json') { e.waitUntil(checkContent()); e.waitUntil(fillModels()); }
    e.respondWith((async () => {
      const n = await contentCacheName(new URL(req.url).searchParams.get('v'));
      const hit = n && await (await caches.open(n)).match(req, {ignoreSearch: true});
      return hit || fetch(req);
    })());
    return;
  }
  if (isModel(rel)) {
    // motore e modelli 3D: dalla cache; se mancano si scaricano e si salvano (strati a richiesta)
    e.respondWith((async () => {
      const cache = await caches.open(MODEL_CACHE);
      const hit = await cache.match(req, {ignoreSearch: true});
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) await cache.put(new URL(req.url).origin + new URL(req.url).pathname, r.clone());
      return r;
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    // solo l'apertura dell'app va su index.html; le altre pagine (es. atlante/index.html) si cercano per nome
    const home = req.mode === 'navigate' && (rel === '' || rel === 'index.html');
    const hit = await cache.match(home ? abs('index.html') : req, {ignoreSearch: true});
    return hit || fetch(req);
  })());
});
