/* Schermata di avvio: controlla se c'è una versione nuova dell'app, sincronizza i progressi e, se serve, chiede di accedere.
   Senza connessione non chiede niente: si entra subito e si salva tutto sul dispositivo.
   Con un account la cui sessione non vale più (per esempio dopo aver giocato offline a lungo) chiede di accedere di nuovo;
   chi preferisce può continuare senza account e sincronizzare dopo dal profilo. */
import {$,toast} from './util.js';
import {installHint,appVersion} from './install.js';
import {S} from './state.js';
import {account as A,configured,startAccount,addAccountListener,lastAccount,signIn,signUp,google,resetPw,setView,saveProfile,NAME_RE,NAME_RULE,esc,resolveOwner,signOut,hasPassword,importDevice,recoverPassword,online,checkNet} from './account.js';

const GUEST='dextera-guest'; // "Continua senza account" scelto: agli avvii successivi non si chiede più
let mode='boot',reason='',fromApp=false,ownImp=false,delOld=false;
const box=()=>$('gbody');
const status=t=>{if(mode==='boot')box().innerHTML=`<div class="spin"></div><p class="gst">${t}</p>`;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const timeout=(p,ms,v)=>Promise.race([p,wait(ms).then(()=>v)]);

export function closeGate(){
 mode='closed';A.err='';A.msg='';const g=$('gate');g.classList.add('out');setTimeout(()=>{if(mode==='closed')g.hidden=true;},250);
 setTimeout(installHint,1500); // nel browser: striscia "Installa l'app sul telefono"
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
 await checkNet();
 if(!online()){
  status('Senza connessione: i progressi si salvano su questo dispositivo.');
  await timeout(startAccount(),3000,'offline');await wait(700);closeGate();return;
 }
 status('Controllo aggiornamenti…');
 if(await checkUpdate())return;
 status(lastAccount()?'Sincronizzo i progressi…':'Quasi pronto…');
 const r=await timeout(startAccount(),15000,'offline');
 await settle();
 if(A.recovery)showRecovery();
 else if(A.conflict)showOwner();
 else if(r==='ok'){if(needName()){A.err='';showName();}else closeGate();}
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
 const title=v==='signup'?'Crea un account':v==='reset'?'Password dimenticata':'Entra nel tuo account';
 const tabs=v==='reset'?'':`<div class="seg3 gtabs" role="group" aria-label="Accedi o registrati"><button type="button" data-g="login" aria-pressed="${v==='login'}">Accedi</button><button type="button" data-g="signup" aria-pressed="${v==='signup'}">Registrati</button></div>`;
 box().innerHTML=`<div class="gform">${tabs}<div class="kick">${v==='signup'?'Nuovo account':v==='reset'?'Account':'Bentornato'}</div><h2>${title}</h2>${why}${note}
  <form data-g="${v}"><input name="e" type="email" placeholder="Email" autocomplete="email" value="${esc(last&&v!=='signup'?last.email:'')}" required>
  ${v!=='reset'?`<input name="p" type="password" placeholder="Password${v==='signup'?' (almeno 8 caratteri)':''}" autocomplete="${v==='signup'?'new-password':'current-password'}" minlength="${v==='signup'?8:6}" required>`:''}
  ${v==='signup'?'<label class="cons"><input type="checkbox" name="ok" required><span>Accetto i <a href="termini.html" target="_blank" rel="noopener">termini di servizio</a>, ho letto l\'<a href="privacy.html" target="_blank" rel="noopener">informativa sulla privacy</a> e ho almeno 14 anni.</span></label>':''}
  <button class="btn"${dis}>${A.busy?'Attendi…':v==='signup'?'Crea account':v==='login'?'Accedi':'Mandami il link'}</button></form>
  ${v==='login'?'<button class="lnk" data-g="reset">Password dimenticata?</button>':''}
  ${v!=='reset'?`<div class="or"><span>oppure</span></div><button class="btn alt wide" data-g="google"${dis}>Accedi con Google</button><p class="note">Continuando con Google accetti i <a href="termini.html" target="_blank" rel="noopener">termini di servizio</a>, dichiari di aver letto l'<a href="privacy.html" target="_blank" rel="noopener">informativa sulla privacy</a> e di avere almeno 14 anni.</p>`:''}
  ${v==='reset'?'<p class="gsw"><button class="lnk" data-g="login">‹ Torna all\'accesso</button></p>':''}
  <button class="btn alt wide" data-g="guest">${fromApp?'Torna all\'app':'Continua senza account'}</button>
  <p class="note">${reason?'Continuando senza accedere i progressi restano su questo dispositivo: potrai sincronizzarli dal Profilo (la tua foto in alto).':'Senza account si gioca lo stesso e i progressi restano su questo dispositivo. Con l\'account li ritrovi ovunque e quelli già fatti qui si uniscono.'}</p></div>`;
}

/* ---------- nuova password dal link "Password dimenticata" ---------- */
// Il link fa entrare nell'account: finché non si sceglie la password nuova (o si esce) l'app resta qui, a tutto schermo.
function showRecovery(){
 mode='recovery';show();const err=A.err?`<p class="err">${esc(A.err)}</p>`:'';
 box().innerHTML=`<div class="gform"><div class="kick">Password</div><h2>Scegli una nuova password</h2>${err}
  <p class="mut">Per <b>${esc(A.user&&A.user.email||'')}</b>. Dopo il cambio si chiudono le sessioni aperte su altri dispositivi.</p>
  <form data-g="recover"><input name="p" type="password" placeholder="Nuova password (almeno 8 caratteri)" autocomplete="new-password" minlength="8" required>
  <input name="p2" type="password" placeholder="Ripeti la nuova password" autocomplete="new-password" minlength="8" required>
  <button class="btn"${A.busy?' disabled':''}>${A.busy?'Salvo…':'Salva la nuova password'}</button></form>
  <button class="lnk" data-g="rec-out">Annulla ed esci</button></div>`;
}

/* ---------- progressi di un altro account su questo dispositivo ---------- */
function showOwner(imp){
 mode='owner';ownImp=!!imp;show();const c=A.conflict,dis=A.busy?' disabled':'';
 const err=A.err?`<p class="err">${esc(A.err)}</p>`:'';
 if(imp){ // importazione: password da aggiungere (se manca) e, facoltativo, cancellazione del vecchio account
  box().innerHTML=`<div class="gform"><div class="kick">Progressi</div><h2>Importa i dati del telefono</h2>${err}
   <p class="mut">XP, maestria, badge e profilo di <b>${esc(c.email)}</b> passano a <b>${esc(c.me)}</b>.</p>
   <form data-g="own-import">
   ${hasPassword()?'':`<p class="mut">Scegli una password: potrai entrare sia con Google sia con <b>${esc(c.me)}</b> e questa password.</p>
    <input name="np" type="password" placeholder="Nuova password (almeno 8 caratteri)" autocomplete="new-password" minlength="8" required>`}
   <label class="cons"><input type="checkbox" name="del"${delOld?' checked':''}><span>Elimina il vecchio account <b>${esc(c.email)}</b>: i suoi dati sono già qui. Serve la sua password.</span></label>
   <input name="op" type="password" placeholder="Password di ${esc(c.email)}" autocomplete="current-password"${delOld?' required':' hidden'}>
   <button class="btn"${dis}>${A.busy?'Attendi…':'Importa'}</button></form>
   <button class="lnk" data-g="own-back">Indietro</button></div>`;
  return;
 }
 box().innerHTML=`<div class="gform"><div class="kick">Progressi</div><h2>Su questo telefono ci sono altri progressi</h2>${err}
  <p>Ci sono i progressi di <b>${esc(c.email)}</b>. Stai entrando come <b>${esc(c.me)}</b>.</p>
  <button class="btn wide" data-g="own-imp">Importa i dati del telefono in questo account</button>
  <p class="note">Se sono tuoi. ${hasPassword()?'':'Potrai entrare con Google e anche con email e password. '}Puoi anche eliminare il vecchio account.</p>
  <button class="btn alt wide" data-g="own-fresh">Inizia da zero con ${esc(c.me)}</button>
  <p class="note">Se sono di un'altra persona o vuoi tenere separati i due account. I progressi di ${esc(c.email)} restano salvati nel suo account${c.dirty?'; <b>attenzione</b>: alcuni non sono ancora stati inviati e da questo telefono andranno persi':''}.</p>
  <button class="btn alt wide" data-g="own-google">Entra con un altro account Google</button>
  <button class="lnk" data-g="own-out">Esci (per entrare con email e password)</button></div>`;
}

/* ---------- nome utente dopo la prima registrazione ---------- */
function showName(){
 mode='name';show();
 box().innerHTML=`<div class="gform"><div class="kick">Ultimo passo</div><h2>Scegli il tuo nome</h2><p class="mut">Lo vedranno gli amici nelle classifiche. ${NAME_RULE}</p>
  ${A.err?`<p class="err">${esc(A.err)}</p>`:''}<form data-g="name"><input name="u" placeholder="Nome utente" autocomplete="username" maxlength="20" value="${esc(NAME_RE.test(S.prof.name||'')?S.prof.name:'')}" required><button class="btn"${A.busy?' disabled':''}>Salva</button></form>
  <button class="btn alt wide" data-g="later">Più tardi</button></div>`;
}

addAccountListener(()=>{
 if(A.recovery){if(mode==='recovery')keep(showRecovery);else if(mode!=='boot')showRecovery();return;}
 if(mode==='recovery'){const m=A.msg;closeGate();if(m)toast('✅ '+m);return;}
 if(A.conflict&&mode!=='owner'&&mode!=='boot'){showOwner();return;}
 if(mode==='owner'){if(A.conflict){keep(()=>showOwner(ownImp));return;}if(!A.user){openLogin('');return;}if(A.profile&&!A.syncing){if(needName()){A.err='';showName();}else{closeGate();toast('✅ Accesso fatto.');}}return;}
 if(mode==='login'){
  if(A.user&&A.profile&&!A.syncing){try{localStorage.removeItem(GUEST);}catch(e){}if(needName()){A.err='';showName();}else{closeGate();toast('✅ Accesso fatto: progressi sincronizzati.');}}
  else keep(renderLogin);
 }else if(mode==='name'){
  if(A.profile&&A.profile.username)closeGate();else keep(showName);
 }
});
export function wireGate(){
 // logo animato: #gate.busy quando in #gbody c'è la rotellina (stato di caricamento); il CSS fa girare il satellite e centra il logo
 const busy=()=>$('gate').classList.toggle('busy',!!box().querySelector('.spin'));
 new MutationObserver(busy).observe(box(),{childList:true});busy();
 // versione sotto la scritta di caricamento (dal nome della copia sul dispositivo: c'è anche offline; alla prima apertura non c'è ancora)
 appVersion().then(v=>{const e=$('gver');if(v){e.textContent='alpha '+v;e.hidden=false;}});
 // spunta "elimina il vecchio account": mostra il campo della sua password
 $('gate').addEventListener('change',e=>{if(e.target.name!=='del')return;delOld=e.target.checked;const op=e.target.form.elements.op;op.hidden=!delOld;op.required=delOld;if(delOld)op.focus();});
 $('gate').addEventListener('click',e=>{
  const b=e.target.closest('button[data-g]');if(!b||b.closest('form'))return;const k=b.dataset.g;
  if(k==='google')google();
  else if(k==='own-fresh'){box().innerHTML='<div class="spin"></div><p class="gst">Sincronizzo…</p>';resolveOwner('fresh');}
  else if(k==='own-imp'){A.err='';showOwner(true);}
  else if(k==='rec-out'){A.recovery=false;mode='login';signOut().then(()=>{A.msg='';openLogin('');});}
  else if(k==='own-back'){A.err='';showOwner();}
  else if(k==='own-out'){A.conflict=null;mode='login';signOut().then(()=>{A.msg='';openLogin('');});}
  // esce e apre subito la scelta dell'account Google (la pagina va su Google e torna qui già dentro)
  else if(k==='own-google'){A.conflict=null;mode='login';box().innerHTML='<div class="spin"></div><p class="gst">Apro Google…</p>';signOut().then(()=>{A.msg='';google();});}
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
  else if(k==='recover'){if(f.elements.p.value!==f.elements.p2.value){A.err='Le due password non coincidono.';showRecovery();return;}A.err='';recoverPassword(f.elements.p.value);}
  else if(k==='own-import'){const del=f.elements.del&&f.elements.del.checked,op=f.elements.op.value;
   if(del&&!op){A.err='Scrivi la password del vecchio account, o togli la spunta.';showOwner(true);return;}
   const c=A.conflict;importDevice({pw:f.elements.np?f.elements.np.value:'',oldEmail:c.email,oldPw:del?op:''});}
 });
}
