/* Installazione e uso offline: istruzioni per browser e stato della copia locale. */
import {$} from './util.js';

const HINT='dextera-installhint'; // striscia "Installa l'app" chiusa: non si ripropone

let deferred=null; // richiesta di installazione di Chrome/Edge/Samsung su Android
window.addEventListener('beforeinstallprompt',e=>{deferred=e;});
window.addEventListener('appinstalled',()=>{deferred=null;hideBar();});

export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

function platform(){
 const ua=navigator.userAgent;
 if(/Android/.test(ua))return 'android-'+(/Firefox/.test(ua)?'firefox':/SamsungBrowser/.test(ua)?'samsung':/EdgA/.test(ua)?'edge':'chrome');
 // gli iPad recenti si presentano come Mac: si riconoscono dal tocco
 const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 // browser dentro altre app (Instagram, Facebook, Gmail…): da lì non si può installare
 if(/FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|LinkedInApp|Snapchat|TikTok|; wv\)/.test(ua))return 'inapp';
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

// Pronta offline = il service worker controlla la pagina e le copie di app e contenuti ci sono; models = ci sono anche
// tutti gli strati dell'atlante 3D (segno scritto da fillModels() in sw.js quando li ha salvati tutti).
export async function offlineState(){
 if(!('serviceWorker' in navigator)||!window.caches||!navigator.serviceWorker.controller)return {app:false,models:false};
 const k=await caches.keys(),app=k.some(x=>x.startsWith('dextera-app-'))&&k.some(x=>x.startsWith('dextera-content-'));
 const mc=k.find(x=>x.startsWith('dextera-3d-'));
 const models=!!mc&&!!(await (await caches.open(mc)).match(new URL('atlante/.offline-completo',location.href).href));
 return {app,models};
}
export async function offlineReady(){const o=await offlineState();return o.app&&o.models;}

// versione dell'app («alpha v0.68.1»), letta dal nome della cache dell'app (la scrive sw.js): c'è anche offline
export async function appVersion(){
 try{const k=(await caches.keys()).filter(x=>x.startsWith('dextera-app-')).map(x=>x.slice(12));
  const v=k.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).pop();return v?(/^\d+$/.test(v)?'v0.'+v:'v'+v):'';}catch(e){return '';}
}
export async function fillVersion(root=document){const v=await appVersion();root.querySelectorAll('[data-appv]').forEach(e=>{e.textContent=v?`Dextera alpha ${v}`:'Dextera alpha';});}
export async function showInstall(){
 const p=platform(),me=HOW[p],inst=isStandalone();
 const o=await offlineState(),ready=o.app&&o.models;
 const status=ready?'<p class="tip">✅ <b>Pronta anche senza connessione</b> su questo dispositivo, compreso tutto l\'atlante 3D.</p>'
  :o.app?'<p class="tip">⏳ <b>App pronta offline; sto salvando l\'atlante 3D</b> (encefalo, muscoli, vasi…, circa 7 MB). Tieni l\'app aperta con la connessione per un minuto.</p>'
  :'serviceWorker' in navigator?'<p class="tip">⏳ <b>Non ancora pronta offline.</b> Tieni l\'app aperta con la connessione per qualche secondo, finché compare il messaggio "Pronta".</p>'
  :'<p class="tip">⚠️ Questo browser non permette l\'uso offline.</p>';
 const others=Object.entries(HOW).filter(([k])=>k!==p).map(([,v])=>`<p><b>${v[0]}</b>: ${v[1]}</p>`).join('');
 $('panel').innerHTML=`<div class="h">${inst?'Uso offline':'Installa l\'app'}</div>`+status+
  (inst?'<p class="mut">L\'app è installata. Si aggiorna da sola quando c\'è rete.</p>':
   (deferred?'<button class="btn act" data-act="prompt">📲 Installa adesso</button>':'')+
   (me?`<div class="sub">${me[0]}</div><p>${me[1]}</p>`:'<p>Apri questa pagina sul telefono e usa la voce del menu del browser per aggiungerla alla schermata Home.</p>')+
   '<p class="mut">Dopo l\'installazione apri l\'app <b>dall\'icona</b> una volta con la connessione e aspetta il messaggio "Pronta": da lì funziona anche in modalità aereo.</p>'+
   `<details><summary class="mut">Altri telefoni e browser</summary>${others}</details>`)+
  '<p class="note" data-appv>Dextera alpha</p><button class="btn alt act" data-act="back">Indietro</button>';
 fillVersion($('panel'));
}

/* ---------- installazione guidata ---------- */
// Android (Chrome, Edge, Samsung): la finestra di installazione del telefono, un tocco. iPhone: Apple non permette ai siti di
// installarsi da soli, quindi una guida a schermo intero con i tre passi e una freccia verso il pulsante Condividi.
const SHARE='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const PLUS='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export function installNow(){
 if(isStandalone())return showInstall();
 if(deferred)return promptInstall();
 const p=platform();
 if(p.startsWith('ios-')||p==='inapp')return guide(p);
 showInstall();
}
function guide(p){
 document.getElementById('iguide')?.remove();
 const g=document.createElement('div');g.id='iguide';g.setAttribute('role','dialog');g.setAttribute('aria-label','Installa Dextera');
 const top=p==='ios-chrome'||p==='ios-edge'; // Condividi è in alto, nella barra dell'indirizzo
 const steps=p==='inapp'
  ?`<p>Questa pagina è aperta dentro un'altra app (per esempio Instagram, Facebook o Gmail): da qui non si può installare.</p>
    <ol><li>Tocca il menu <b>⋯</b> o <b>⋮</b> dell'app.</li><li>Scegli <b>Apri in Safari</b> (su Android: <b>Apri in Chrome</b>).</li><li>Lì tocca di nuovo <b>📲 Installa l'app</b>.</li></ol>`
  :`<ol><li>Tocca <b>Condividi</b> <span class="ig-i">${SHARE}</span> ${top?'in alto, nella barra dell\'indirizzo':'nella barra in basso di Safari'}.<br><small>Non lo vedi? Tocca prima <b>⋯</b>, poi <b>Condividi</b>.</small></li>
    <li>Scorri l'elenco e tocca <b>Aggiungi alla schermata Home</b> <span class="ig-i">${PLUS}</span>.</li>
    <li>Tocca <b>Aggiungi</b> in alto a destra: l'icona di Dextera compare tra le tue app.</li></ol>
    <p class="mut">Poi apri Dextera <b>dall'icona</b> una volta con la connessione: da lì funziona anche offline.</p>`;
 g.innerHTML=`<div class="ig-card"><div class="h">📲 Installa Dextera</div>${steps}<button class="btn wide" data-ig="ok">Ho capito</button></div>`+
  (p==='inapp'?'':`<div class="ig-arrow ${top?'top':'bottom'}" aria-hidden="true">${top?'⬆':'⬇'}</div>`);
 g.addEventListener('click',e=>{if(e.target===g||e.target.closest('[data-ig]'))g.remove();});
 document.body.appendChild(g);
}
// striscia in basso al primo avvio nel browser (non nell'app installata), finché non la si chiude o si installa
function hideBar(){document.getElementById('ibar')?.remove();}
export function installHint(){
 let off=false;try{off=!!localStorage.getItem(HINT);}catch(e){}
 if(off||isStandalone()||platform()==='altro'||document.getElementById('ibar'))return;
 const b=document.createElement('div');b.id='ibar';
 b.innerHTML='<button class="ib-go">📲 Installa l\'app sul telefono</button><button class="ib-x" aria-label="Chiudi">✕</button>';
 b.querySelector('.ib-go').onclick=()=>installNow();
 b.querySelector('.ib-x').onclick=()=>{try{localStorage.setItem(HINT,'1');}catch(e){}hideBar();};
 document.body.insertBefore(b,document.querySelector('body>nav')); // sopra la barra in basso, senza coprire niente
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
 const o=await offlineState(),ok=o.app&&o.models;
 b.hidden=false;b.className=ok?'ok':'wait';b.textContent=ok?'✓':'⏳';
 b.title=ok?'Disponibile offline':o.app?'Salvo l\'atlante 3D per l\'uso offline':'Copia offline in preparazione';
 b.setAttribute('aria-label',b.title);
}
