/* Avvio: prepara l'uso offline, carica i contenuti, poi mostra il primo modulo. */
import {$,toast} from './util.js';
import {app,S,head,save,onSave} from './state.js';
import {loadContent} from './content.js';
import {useMod} from './ui.js';
import {isStandalone,offlineReady,offlineState,refreshOfflineBadge} from './install.js';
import {addAccountListener,wireAccount} from './account.js';
import {refreshProg,wireProfile} from './progress.js';
import {boot,wireGate,openLogin} from './gate.js';
import {checkBadges} from './badges.js';
import {applyStudio} from './percorso.js';
import {wireSocial,socialAccountChanged} from './social.js';

/* ---------- sfondo chiaro o scuro ---------- */
// Senza scelta segue il sistema; il pulsante salva la scelta (anche l'atlante 3D la legge, vedi atlante.js).
const THEME_KEY='dextera-theme',root=document.documentElement,sysDark=matchMedia('(prefers-color-scheme: dark)');
const isDark=()=>root.dataset.theme?root.dataset.theme==='dark':sysDark.matches;
function themeBtn(){const d=isDark();$('theme').textContent=d?'☀️':'🌙';$('theme').title=d?'Sfondo chiaro':'Sfondo scuro';}
$('theme').addEventListener('click',()=>{
 root.dataset.theme=isDark()?'light':'dark';
 try{localStorage.setItem(THEME_KEY,root.dataset.theme);}catch(e){}
 // l'atlante nell'iframe riceve l'evento storage; il messaggio serve se localStorage non è disponibile
 document.querySelector('#atlas iframe')?.contentWindow?.postMessage({bm:1,type:'theme',theme:root.dataset.theme},location.origin);
 themeBtn();
});
sysDark.addEventListener('change',themeBtn);themeBtn();

/* ---------- altezza della pagina su iPhone ---------- */
// Nell'app installata sulla schermata Home, dopo la tastiera (accesso con email e password) o il ritorno da Google, Safari
// può lasciare la pagina più bassa dello schermo o spostata in su (barra in basso a metà, fascia nera sotto). Si misura
// l'altezza vera a ogni cambio e si riporta la pagina in cima.
const fitH=()=>{root.style.setProperty('--app-h',innerHeight+'px');if(scrollX||scrollY)scrollTo(0,0);};
const fitSoon=()=>{setTimeout(fitH,60);setTimeout(fitH,400);};
for(const ev of ['resize','orientationchange','pageshow','focusout'])addEventListener(ev,fitSoon);
window.visualViewport?.addEventListener('resize',fitSoon);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)fitSoon();});
fitH();

/* ---------- uso offline (PWA) ---------- */
// Il service worker si registra subito, così la copia locale si prepara il prima possibile.
if('serviceWorker' in navigator&&location.protocol!=='file:'){
 const hadController=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('message',e=>{
  if(e.data&&e.data.type==='content-updated'&&$('gate').hidden)toast('Contenuti aggiornati: li vedrai alla prossima apertura dell\'app.');
  if(e.data&&e.data.type==='models-ready'){toast('✅ Atlante 3D salvato: encefalo, muscoli e tutti gli strati funzionano anche senza connessione.');refreshOfflineBadge();}
 });
 // Prima presa di controllo = app e contenuti sono stati copiati sul dispositivo.
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hadController)toast('✅ Pronta: da ora l\'app funziona anche senza connessione. Sto salvando anche l\'atlante 3D.');
  refreshOfflineBadge();
 });
 refreshOfflineBadge();
 // toccando la spunta si vede lo stato, senza lasciare la schermata in cui si è
 $('off').addEventListener('click',async()=>{const o=await offlineState();toast(o.app&&o.models
  ?'✅ Disponibile offline: puoi giocare anche senza connessione. I progressi restano salvati sul dispositivo.'
  :o.app?'⏳ L\'app funziona già offline; sto salvando l\'atlante 3D (circa 7 MB): tieni l\'app aperta con la connessione.'
  :'⏳ Copia offline in preparazione: tieni l\'app aperta con la connessione qualche secondo.');});
 navigator.serviceWorker.register('sw.js').catch(e=>console.warn('Service worker non registrato',e));
 // Nell'app installata chiede al sistema di non cancellare la copia locale per liberare spazio.
 if(isStandalone())navigator.storage?.persist?.().catch(()=>{});
}

/* ---------- badge ---------- */
// dopo ogni salvataggio si controllano i traguardi; quelli guadagnati prima di questa versione si assegnano in silenzio
checkBadges();try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}
onSave(()=>{head();const f=checkBadges();if(f.length){save();toast('🏅 Nuovo badge: '+f.map(b=>b.icon+' '+b.name).join(', '));if(app.tab==='prog')refreshProg();}});

/* ---------- schermata di avvio, account e profilo ---------- */
// l'app si prepara sotto la schermata di avvio, che intanto controlla aggiornamenti, sincronizzazione e accesso
wireGate();wireAccount($('panel'),()=>openLogin('',true));wireProfile($('panel'));addAccountListener(refreshProg);addAccountListener(head);
wireSocial($('panel'));addAccountListener(socialAccountChanged);
boot();
try{
 const c=await loadContent();
 app.MODS=c.MODS;app.NC=c.NC;app.MAPPA=c.MAPPA;app.LEZ=c.LEZ;app.REGOLE=c.REGOLE;app.PERCORSO=c.PERCORSO;
 app.PBASE=c.PERCORSO;app.PERCORSI=c.PERCORSI;app.PCAT=c.PCAT;applyStudio(); // percorso scelto in «Cosa studi?» (fase 6)
 useMod('corpo');head();
}catch(e){
 console.error(e);
 $('panel').innerHTML='<div class="h">Contenuti non disponibili</div><p class="mut">Non riesco a caricare i file in content/. Se hai aperto index.html con doppio clic, avvia un server locale (per esempio <code>python3 -m http.server</code>) e apri l\'indirizzo che ti indica. Al primo avvio serve la connessione.</p>';
}
