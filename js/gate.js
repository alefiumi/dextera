/* Schermata di avvio: controlla se c'è una versione nuova dell'app, sincronizza i progressi e, se serve, chiede di accedere.
   Senza connessione non chiede niente: si entra subito e si salva tutto sul dispositivo.
   Con un account la cui sessione non vale più (per esempio dopo aver giocato offline a lungo) chiede di accedere di nuovo;
   chi preferisce può continuare senza account e sincronizzare dopo dal profilo. */
import {$,toast} from './util.js';
import {S} from './state.js';
import {account as A,configured,startAccount,addAccountListener,lastAccount,signIn,signUp,google,resetPw,setView,saveProfile,NAME_RE,NAME_RULE,esc} from './account.js';

const GUEST='dextera-guest'; // "Continua senza account" scelto: agli avvii successivi non si chiede più
let mode='boot',reason='',fromApp=false;
const box=()=>$('gbody');
const status=t=>{if(mode==='boot')box().innerHTML=`<div class="spin"></div><p class="gst">${t}</p>`;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const timeout=(p,ms,v)=>Promise.race([p,wait(ms).then(()=>v)]);

export function closeGate(){
 mode='closed';A.err='';A.msg='';const g=$('gate');g.classList.add('out');setTimeout(()=>{if(mode==='closed')g.hidden=true;},250);
}
function show(){const g=$('gate');g.hidden=false;g.classList.remove('out');}

/* ---------- aggiornamento dell'app ---------- */
// Se il service worker trova una versione nuova la installa (skipWaiting in sw.js) e la pagina si ricarica una volta.
async function checkUpdate(){
 if(!('serviceWorker' in navigator)||!navigator.serviceWorker.controller)return false; // primo avvio: niente da aggiornare
 const reg=await navigator.serviceWorker.getRegistration();if(!reg)return false;
 try{if(sessionStorage.getItem('dextera-upd')&&Date.now()-sessionStorage.getItem('dextera-upd')<60000)return false;}catch(e){} // mai due volte di fila
 await timeout(reg.update().catch(()=>{}),8000);
 if(!reg.installing&&!reg.waiting)return false;
 status('Aggiornamento dell\'app in corso…');
 const changed=await timeout(new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',()=>r(true),{once:true})),30000,false);
 if(!changed)return false;
 try{sessionStorage.setItem('dextera-upd',Date.now());}catch(e){}
 status('App aggiornata: riavvio…');location.reload();return true;
}

/* ---------- avvio ---------- */
export async function boot(){
 // contenuti nuovi scaricati dal service worker mentre si è ancora qui: si ricarica subito per usarli
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data&&e.data.type==='content-updated'&&mode==='boot'){try{sessionStorage.setItem('dextera-upd',Date.now());}catch(x){}location.reload();}});
 const t0=Date.now(),settle=()=>wait(Math.max(0,500-(Date.now()-t0)));
 if(!navigator.onLine){
  status('Senza connessione: i progressi si salvano su questo dispositivo.');
  await timeout(startAccount(),3000,'offline');await wait(700);closeGate();return;
 }
 status('Controllo aggiornamenti…');
 if(await checkUpdate())return;
 status(lastAccount()?'Sincronizzo i progressi…':'Quasi pronto…');
 const r=await timeout(startAccount(),15000,'offline');
 await settle();
 if(r==='ok'){if(needName()){A.err='';showName();}else closeGate();}
 else if(r==='offline'){closeGate();if(lastAccount())toast('Server non raggiungibile: si gioca in locale, sincronizzo appena possibile.');}
 else if(r==='expired')openLogin(lastAccount()?.dirty?'dirty':'expired');
 else{let g=false;try{g=!!localStorage.getItem(GUEST);}catch(e){}if(g||!configured)closeGate();else openLogin('');}
}

/* ---------- accesso ---------- */
const needName=()=>A.user&&A.profile&&!A.profile.username;
// fromApp: aperta dal profilo (pulsante "Accedi"), allora il pulsante in basso torna all'app
export function openLogin(why='',app=false){
 reason=why;fromApp=app;mode='login';show();
 if(!['login','signup','reset'].includes(A.view))A.view='login';
 A.err='';A.msg='';renderLogin();
}
const keep=f=>{const v={};box().querySelectorAll('input[name]').forEach(i=>v[i.name]=i.value);f();box().querySelectorAll('input[name]').forEach(i=>{if(v[i.name])i.value=v[i.name];});};
function renderLogin(){
 const v=A.view,last=lastAccount(),dis=A.busy?' disabled':'';
 const why=reason==='dirty'?'<p class="tip">⚠️ Hai giocato senza connessione: i progressi sono salvati su questo dispositivo. Accedi per sincronizzarli con il tuo account.</p>'
  :reason==='expired'?'<p class="tip">La sessione è scaduta: accedi di nuovo per sincronizzare i progressi.</p>':'';
 const note=(A.err?`<p class="err">${esc(A.err)}</p>`:'')+(A.msg?`<p class="okm">${esc(A.msg)}</p>`:'');
 const title=v==='signup'?'Crea un account':v==='reset'?'Password dimenticata':'Accedi';
 box().innerHTML=`<div class="gform"><div class="h">${title}</div>${why}${note}
  <form data-g="${v}"><input name="e" type="email" placeholder="Email" autocomplete="email" value="${esc(last&&v!=='signup'?last.email:'')}" required>
  ${v!=='reset'?`<input name="p" type="password" placeholder="Password${v==='signup'?' (almeno 6 caratteri)':''}" autocomplete="${v==='signup'?'new-password':'current-password'}" minlength="6" required>`:''}
  <button class="btn"${dis}>${A.busy?'Attendi…':v==='signup'?'Crea account':v==='login'?'Accedi':'Mandami il link'}</button></form>
  ${v==='login'?'<button class="lnk" data-g="reset">Password dimenticata?</button>':''}
  ${v!=='reset'?`<div class="or"><span>oppure</span></div><button class="btn alt wide" data-g="google"${dis}>Accedi con Google</button>`:''}
  <p class="gsw">${v==='signup'?'Hai già un account? <button class="lnk" data-g="login">Accedi</button>':v==='login'?'Non hai un account? <button class="lnk" data-g="signup">Registrati</button>':'<button class="lnk" data-g="login">Torna all\'accesso</button>'}</p>
  <button class="btn alt wide" data-g="guest">${fromApp?'Torna all\'app':'Continua senza account'}</button>
  <p class="note">${reason?'Continuando senza accedere i progressi restano su questo dispositivo: potrai sincronizzarli dal Profilo (la tua foto in alto).':'Senza account si gioca lo stesso e i progressi restano su questo dispositivo. Con l\'account li ritrovi ovunque e quelli già fatti qui si uniscono.'}</p></div>`;
}

/* ---------- nome utente dopo la prima registrazione ---------- */
function showName(){
 mode='name';show();
 box().innerHTML=`<div class="gform"><div class="h">Scegli il tuo nome</div><p class="mut">Lo vedranno gli amici nelle classifiche. ${NAME_RULE}</p>
  ${A.err?`<p class="err">${esc(A.err)}</p>`:''}<form data-g="name"><input name="u" placeholder="Nome utente" autocomplete="username" maxlength="20" value="${esc(NAME_RE.test(S.prof.name||'')?S.prof.name:'')}" required><button class="btn"${A.busy?' disabled':''}>Salva</button></form>
  <button class="btn alt wide" data-g="later">Più tardi</button></div>`;
}

addAccountListener(()=>{
 if(mode==='login'){
  if(A.user&&A.profile&&!A.syncing){try{localStorage.removeItem(GUEST);}catch(e){}if(needName()){A.err='';showName();}else{closeGate();toast('✅ Accesso fatto: progressi sincronizzati.');}}
  else keep(renderLogin);
 }else if(mode==='name'){
  if(A.profile&&A.profile.username)closeGate();else keep(showName);
 }
});
export function wireGate(){
 $('gate').addEventListener('click',e=>{
  const b=e.target.closest('button[data-g]');if(!b||b.closest('form'))return;const k=b.dataset.g;
  if(k==='google')google();
  else if(k==='guest'){if(!reason){try{localStorage.setItem(GUEST,'1');}catch(x){}}closeGate();}
  else if(k==='later')closeGate();
  else setView(k);
 });
 $('gate').addEventListener('submit',e=>{
  const f=e.target.closest('form[data-g]');if(!f)return;e.preventDefault();const v=n=>(f.elements[n]?f.elements[n].value:'').trim(),k=f.dataset.g;
  if(k==='login')signIn(v('e'),f.elements.p.value);
  else if(k==='signup')signUp(v('e'),f.elements.p.value);
  else if(k==='reset')resetPw(v('e'));
  else if(k==='name')saveProfile({...S.prof,name:v('u')});
 });
}
