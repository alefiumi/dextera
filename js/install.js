/* Installazione e uso offline: istruzioni per browser e stato della copia locale. */
import {$} from './util.js';

let deferred=null; // richiesta di installazione di Chrome/Edge/Samsung su Android
window.addEventListener('beforeinstallprompt',e=>{deferred=e;});
window.addEventListener('appinstalled',()=>{deferred=null;});

export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

function platform(){
 const ua=navigator.userAgent;
 if(/Android/.test(ua))return 'android-'+(/Firefox/.test(ua)?'firefox':/SamsungBrowser/.test(ua)?'samsung':/EdgA/.test(ua)?'edge':'chrome');
 // gli iPad recenti si presentano come Mac: si riconoscono dal tocco
 const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios)return 'ios-'+(/CriOS/.test(ua)?'chrome':/FxiOS/.test(ua)?'firefox':/EdgiOS/.test(ua)?'edge':'safari');
 return 'altro';
}
const HOW={
 'ios-safari':['iPhone · Safari','Tocca <b>Condividi</b> (il quadrato con la freccia), poi <b>Aggiungi alla schermata Home</b>.'],
 'ios-chrome':['iPhone · Chrome','Tocca <b>Condividi</b> (il quadrato con la freccia, nella barra dell\'indirizzo), poi <b>Aggiungi alla schermata Home</b>. Serve iOS 16.4 o successivo.'],
 'ios-firefox':['iPhone · Firefox','Tocca il menu <b>☰</b>, poi <b>Condividi</b> e <b>Aggiungi alla schermata Home</b>. Serve iOS 16.4 o successivo e Firefox aggiornato.'],
 'ios-edge':['iPhone · Edge','Tocca <b>Condividi</b>, poi <b>Aggiungi alla schermata Home</b>. Serve iOS 16.4 o successivo.'],
 'android-chrome':['Android · Chrome','Tocca il menu <b>⋮</b>, poi <b>Installa app</b> (o <b>Aggiungi a schermata Home</b> → <b>Installa</b>).'],
 'android-firefox':['Android · Firefox','Tocca il menu <b>⋮</b>, poi <b>Installa</b> (in alcune versioni <b>Aggiungi a schermata Home</b>).'],
 'android-samsung':['Android · Samsung Internet','Tocca il menu <b>☰</b>, poi <b>Aggiungi pagina a</b> → <b>Schermata Home</b>.'],
 'android-edge':['Android · Edge','Tocca il menu <b>…</b>, poi <b>Aggiungi al telefono</b>.']
};

// Pronta offline = il service worker controlla la pagina e le copie di app e contenuti ci sono.
export async function offlineReady(){
 if(!('serviceWorker' in navigator)||!window.caches||!navigator.serviceWorker.controller)return false;
 const k=await caches.keys();
 return k.some(x=>x.startsWith('dextera-app-'))&&k.some(x=>x.startsWith('dextera-content-'));
}

export async function showInstall(){
 const p=platform(),me=HOW[p],inst=isStandalone();
 const ready=await offlineReady();
 const status=ready?'<p class="tip">✅ <b>Pronta anche senza connessione</b> su questo dispositivo.</p>'
  :'serviceWorker' in navigator?'<p class="tip">⏳ <b>Non ancora pronta offline.</b> Tieni l\'app aperta con la connessione per qualche secondo, finché compare il messaggio "Pronta".</p>'
  :'<p class="tip">⚠️ Questo browser non permette l\'uso offline.</p>';
 const others=Object.entries(HOW).filter(([k])=>k!==p).map(([,v])=>`<p><b>${v[0]}</b>: ${v[1]}</p>`).join('');
 $('panel').innerHTML=`<div class="h">${inst?'Uso offline':'Installa l\'app'}</div>`+status+
  (inst?'<p class="mut">L\'app è installata. Si aggiorna da sola quando c\'è rete.</p>':
   (deferred?'<button class="btn act" data-act="prompt">📲 Installa adesso</button>':'')+
   (me?`<div class="sub">${me[0]}</div><p>${me[1]}</p>`:'<p>Apri questa pagina sul telefono e usa la voce del menu del browser per aggiungerla alla schermata Home.</p>')+
   '<p class="mut">Dopo l\'installazione apri l\'app <b>dall\'icona</b> una volta con la connessione e aspetta il messaggio "Pronta": da lì funziona anche in modalità aereo.</p>'+
   `<details><summary class="mut">Altri telefoni e browser</summary>${others}</details>`)+
  '<button class="btn alt act" data-act="back">Indietro</button>';
}

export async function promptInstall(){
 if(!deferred)return;
 try{deferred.prompt();await deferred.userChoice;}catch(e){}
 deferred=null;showInstall();
}

// Spunta verde nell'intestazione quando l'app funziona senza connessione; clessidra mentre si prepara.
export async function refreshOfflineBadge(){
 const b=$('off');if(!b)return;
 if(!('serviceWorker' in navigator)||location.protocol==='file:'){b.hidden=true;return;}
 const ok=await offlineReady();
 b.hidden=false;b.className=ok?'ok':'wait';b.textContent=ok?'✓':'⏳';
 b.title=ok?'Disponibile offline':'Copia offline in preparazione';
 b.setAttribute('aria-label',b.title);
}
