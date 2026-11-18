/* Account facoltativo (Supabase): senza account si gioca come sempre e tutto resta sul dispositivo.
   Con l'account i progressi locali si uniscono a quelli del server (si tiene il valore più alto) e le partite finite
   partono dalla coda locale (state.queue) quando c'è rete. La libreria si carica solo se serve.
   L'accesso si fa nella schermata di avvio (gate.js); qui ci sono le funzioni e il riquadro Account del profilo. */
import {S,save,head,onSave,queue} from './state.js';
import {SUPABASE_URL,SUPABASE_KEY} from './config.js';

export const configured=!!(SUPABASE_URL&&SUPABASE_KEY);
const A={sb:null,user:null,profile:null,busy:false,msg:'',err:'',warn:'',view:'',lastSync:null,syncing:false};
const listeners=[];
const onChange=()=>listeners.forEach(f=>f());
export const account=A;
export const addAccountListener=f=>{listeners.push(f);};

// la sessione salvata da supabase-js: se c'è (o si torna dal login con Google) si carica subito la libreria.
// Chiave propria (AUTH_KEY): BodyMania sta sulla stessa origine e usa la chiave predefinita sb-<progetto>-auth-token;
// con una chiave diversa le due app non si leggono né si cancellano la sessione a vicenda (uscire da una non esce dall'altra).
const AUTH_KEY='dextera-auth';
const hasSession=()=>{try{return !!localStorage.getItem(AUTH_KEY);}catch(e){return false;}};
export const backFromOAuth=()=>/[?&#](code|access_token|error_description)=/.test(location.search+location.hash);

/* Ultimo account usato su questo dispositivo: {uid, email, dirty}. dirty = progressi salvati qui e non ancora inviati
   (per esempio giocando offline). Resta anche se la sessione scade: all'avvio con rete si chiede di accedere di nuovo. */
const AKEY='dextera-acct';
export const lastAccount=()=>{try{return JSON.parse(localStorage.getItem(AKEY)||'null');}catch(e){return null;}};
const setLast=v=>{try{v?localStorage.setItem(AKEY,JSON.stringify(v)):localStorage.removeItem(AKEY);}catch(e){}};
const markDirty=d=>{const a=lastAccount();if(a&&a.dirty!==d){a.dirty=d;setLast(a);}};

function loadLib(){
 if(window.supabase)return Promise.resolve();
 return new Promise((ok,ko)=>{const s=document.createElement('script');s.src='vendor/supabase.js';s.onload=ok;s.onerror=()=>ko(new Error('libreria non caricata'));document.head.appendChild(s);});
}
async function client(){
 if(A.sb)return A.sb;
 await loadLib();
 A.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
 A.sb.auth.onAuthStateChange((ev,session)=>{
  if(ev==='PASSWORD_RECOVERY'){A.view='pw';A.msg='Scegli la nuova password.';}
  const u=session?session.user:null,changed=(u&&u.id)!==(A.user&&A.user.id);A.user=u;
  if(!u){A.profile=null;onChange();return;}
  if(changed){const l=lastAccount();setLast({uid:u.id,email:u.email||'',dirty:!!(l&&l.dirty)});setTimeout(()=>sync(true),0);} // fuori dalla callback, come chiede supabase-js
 });
 return A.sb;
}

let started=false;
/* Avvio (chiamato dalla schermata di avvio). Restituisce:
   'ok' sessione valida e progressi sincronizzati · 'offline' sessione salvata ma niente rete (si gioca in locale)
   'expired' c'era un account ma la sessione non vale più · 'none' nessun account su questo dispositivo */
export async function startAccount(){
 if(!configured)return 'none';
 if(!started){started=true;onSave(()=>{if(lastAccount())markDirty(true);syncSoon();});addEventListener('online',()=>syncSoon(0));}
 if(!hasSession()&&!backFromOAuth())return lastAccount()?'expired':'none';
 try{const sb=await client();const {data}=await sb.auth.getSession();A.user=data.session?data.session.user:null;}
 catch(e){return navigator.onLine?'expired':'offline';}
 if(backFromOAuth())history.replaceState(null,'',location.pathname); // toglie dall'indirizzo il codice del ritorno da Google
 if(!A.user)return lastAccount()?'expired':'none';
 if(!navigator.onLine){onChange();return 'offline';}
 // la sessione salvata può essere stata revocata (password cambiata, utente tolto): lo dice solo il server
 const {error}=await A.sb.auth.getUser();
 if(error&&(error.status===401||error.status===403||/session|jwt|not found/i.test(error.message||''))){
  try{await A.sb.auth.signOut({scope:'local'});}catch(e){}A.user=null;A.profile=null;return 'expired';
 }
 if(error){onChange();return 'offline';} // server non raggiungibile: si gioca in locale e si riprova dopo
 await sync(true);return 'ok';
}

/* ---------- accesso ---------- */
const ERR={'Invalid login credentials':'Email o password sbagliate.','Email not confirmed':'Conferma prima l\'email: ti abbiamo mandato un link.',
 'User already registered':'Questa email è già registrata: accedi.','Password should be at least 6 characters.':'La password deve avere almeno 6 caratteri.'};
const it=e=>ERR[e&&e.message]||(!navigator.onLine?'Serve la connessione.':/fetch|network|load failed/i.test(e&&e.message||'')?'Server non raggiungibile: riprova tra poco.':(e&&e.message)||'Errore');
async function run(f){A.busy=true;A.err='';A.msg='';onChange();try{await f();}catch(e){A.err=it(e);}A.busy=false;onChange();}
export const signIn=(email,pw)=>run(async()=>{const {error}=await (await client()).auth.signInWithPassword({email,password:pw});if(error)throw error;A.view='';});
export const signUp=(email,pw)=>run(async()=>{
 const {data,error}=await (await client()).auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;
 if(!data.session)A.msg='Ti abbiamo mandato un\'email: tocca il link per confermare, poi accedi qui.';A.view=data.session?'':'login';
});
export const google=()=>run(async()=>{const {error}=await (await client()).auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error;});
export const resetPw=email=>run(async()=>{const {error}=await (await client()).auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;A.msg='Se l\'email è registrata, ti arriva un link per scegliere una nuova password.';A.view='login';});
// uscendo i progressi restano sul dispositivo; si dimentica l'account, così all'avvio non si chiede più di accedere
export const signOut=()=>run(async()=>{
 if(lastAccount()?.dirty&&navigator.onLine)await sync(false);
 await (await client()).auth.signOut({scope:'local'});setLast(null);A.user=null;A.profile=null;A.view='';A.msg='Sei uscito: i progressi restano su questo dispositivo.';
});
export const setNewPassword=pw=>run(async()=>{const {error}=await A.sb.auth.updateUser({password:pw});if(error)throw error;A.msg='Password cambiata.';A.view='';});
export const setView=v=>{A.view=v;A.err='';A.msg='';onChange();};

/* ---------- profilo (nome, ruolo, presentazione, foto) ---------- */
export const NAME_RE=/^[A-Za-z0-9_.]{3,20}$/;
export const NAME_RULE='Da 3 a 20 caratteri: lettere, numeri, punto e trattino basso (niente spazi).';
// salva sul dispositivo e, con l'account, sul server; il nome deve essere libero (unico tra gli iscritti)
export const saveProfile=f=>run(async()=>{
 if(A.user&&!NAME_RE.test(f.name||''))throw new Error(NAME_RULE);
 if(A.user&&f.name!==(A.profile&&A.profile.username)){
  if(!navigator.onLine)throw new Error('Per cambiare il nome serve la connessione (deve essere libero).');
  const {error}=await A.sb.from('profiles').update({username:f.name}).eq('id',A.user.id);
  if(error)throw new Error(error.code==='23505'?'Questo nome è già preso.':error.message);
  A.profile.username=f.name;
 }
 Object.assign(S.prof,f,{t:Date.now()});save();
 if(A.user)await pushProfile();
 A.msg='Profilo salvato.';
});
async function pushProfile(){
 if(!A.user||!navigator.onLine)return;
 const p=S.prof,row={role:p.role||null,bio:p.bio||null,avatar:p.avatar||null,profile_at:new Date(p.t||Date.now()).toISOString()};
 const {error}=await A.sb.from('profiles').update(row).eq('id',A.user.id);
 if(error){A.warn='Foto, ruolo e presentazione restano solo su questo dispositivo: sul server manca l\'aggiornamento del database (file supabase/migrations/20261117120000_profilo_badge.sql).';return;}
 Object.assign(A.profile,row);
}

/* ---------- sincronizzazione ---------- */
let timer=null;
export function syncSoon(ms=3000){if(!A.user)return;clearTimeout(timer);timer=setTimeout(()=>sync(false),ms);}
const ymdIso=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;};
const ymdApp=s=>{if(!s)return '';const [y,m,d]=s.split('-').map(Number);return `${y}-${m}-${d}`;}; // formato di state.js
const sentBadges=new Set();
// full: all'accesso legge anche il server e unisce; poi basta inviare
export async function sync(full){
 if(!A.user||A.syncing||!navigator.onLine)return;
 A.syncing=true;onChange();
 try{
  const sb=A.sb,uid=A.user.id;
  if(full||!A.profile){
   const [{data:p,error:e1},{data:ms,error:e2},{data:bs}]=await Promise.all([sb.from('profiles').select('*').eq('id',uid).single(),
    sb.from('mastery').select('item_id,level'),sb.from('badge_assertions').select('badge_id,issued_at').eq('user_id',uid)]);
   if(e1)throw e1;if(e2)throw e2;
   A.profile=p;
   // unione: si tiene il valore più alto (o il giorno più recente per la serie)
   S.xp=Math.max(S.xp,p.xp);S.ok=Math.max(S.ok,p.ok);S.ko=Math.max(S.ko,p.ko);
   const srv=ymdIso(p.last_day),loc=ymdIso(S.last);
   if(srv&&(!loc||srv>loc)){S.last=ymdApp(p.last_day);S.streak=p.streak;}else if(srv===loc)S.streak=Math.max(S.streak,p.streak);
   for(const m of ms||[])S.mastery[m.item_id]=Math.max(S.mastery[m.item_id]||0,m.level);
   for(const b of bs||[]){sentBadges.add(b.badge_id);if(!S.badges[b.badge_id]||S.badges[b.badge_id]>b.issued_at)S.badges[b.badge_id]=b.issued_at;}
   // profilo: vince la modifica più recente; il nome del server ha la precedenza (è quello unico)
   const pt=p.profile_at?Date.parse(p.profile_at):0;
   if(pt>(S.prof.t||0))Object.assign(S.prof,{role:p.role||'',bio:p.bio||'',avatar:p.avatar||'',t:pt});
   if(p.username)S.prof.name=p.username;
   else if(NAME_RE.test(S.prof.name||'')){
    const {error}=await sb.from('profiles').update({username:S.prof.name}).eq('id',uid);
    if(!error)p.username=S.prof.name;
   }
   try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){} // senza save(): non deve ripartire un invio
   head();
   if((S.prof.t||0)>pt)await pushProfile();
  }
  const prof={xp:S.xp,streak:S.streak,last_day:ymdIso(S.last),ok:S.ok,ko:S.ko,updated_at:new Date().toISOString()};
  const {error:e3}=await sb.from('profiles').update(prof).eq('id',uid);if(e3)throw e3;Object.assign(A.profile,prof);
  const rows=Object.entries(S.mastery).map(([item_id,level])=>({user_id:uid,item_id,level,updated_at:new Date().toISOString()}));
  if(rows.length){const {error:e4}=await sb.from('mastery').upsert(rows,{onConflict:'user_id,item_id'});if(e4)throw e4;}
  const q=queue.all();
  if(q.length){
   const {error:e5}=await sb.from('game_results').upsert(q.map(r=>({id:r.id,user_id:uid,module:r.module,mode:r.mode,score:r.score,total:r.total,xp:r.xp,played_at:r.played_at})),{onConflict:'id',ignoreDuplicates:true});
   if(e5)throw e5;
   const sent=new Set(q.map(r=>r.id));queue.set(queue.all().filter(r=>!sent.has(r.id)));
  }
  // badge: se sul server manca l'elenco (secondo file SQL non ancora applicato) restano solo qui, senza bloccare il resto
  const nb=Object.entries(S.badges).filter(([id])=>!sentBadges.has(id));
  if(nb.length){
   const {error:e6}=await sb.from('badge_assertions').upsert(nb.map(([badge_id,issued_at])=>({user_id:uid,badge_id,issued_at})),{onConflict:'user_id,badge_id',ignoreDuplicates:true});
   if(e6)A.warn='I badge restano solo su questo dispositivo: sul server manca l\'elenco (file supabase/migrations/20261117120000_profilo_badge.sql).';
   else nb.forEach(([id])=>sentBadges.add(id));
  }
  A.lastSync=new Date();A.err='';markDirty(false);
 }catch(e){A.err='Sincronizzazione non riuscita: riprovo più tardi. ('+(e.message||e)+')';}
 A.syncing=false;onChange();
}

/* ---------- riquadro Account nel profilo ---------- */
export const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hm=d=>d.toLocaleTimeString('it',{hour:'2-digit',minute:'2-digit'});
export function accountHtml(){
 if(!configured)return '';
 const note=(A.err?`<p class="err">${esc(A.err)}</p>`:'')+(A.msg?`<p class="okm">${esc(A.msg)}</p>`:'')+(A.warn?`<p class="note">${esc(A.warn)}</p>`:'');
 const last=lastAccount();
 if(A.user){
  const pend=queue.all().length,dirty=last&&last.dirty;
  const state=A.syncing?'⏳ Sincronizzo…':!navigator.onLine?'📴 Senza connessione: i progressi si salvano qui e partono appena torna la rete.'
   :dirty||pend?'⚠️ Ci sono progressi non ancora salvati online.':A.lastSync?'✅ Tutto salvato online alle '+hm(A.lastSync)+'.':'';
  return `<div class="acc"><div class="sub">Account</div><p class="mut">${esc(A.user.email||'')}</p><p class="mut">${state}${pend?' Partite in attesa: '+pend+'.':''}</p>${note}
   ${A.view==='pw'?`<form data-acc="newpw"><input name="p" type="password" placeholder="Nuova password" autocomplete="new-password" minlength="6" required><button class="btn"${A.busy?' disabled':''}>Cambia</button></form>`:''}
   <div class="chips"><button class="chip on" data-acc="sync"${A.syncing?' disabled':''}>🔄 Sincronizza ora</button><button class="chip" data-acc="pw">Cambia password</button><button class="chip" data-acc="out">Esci</button></div></div>`;
 }
 if(last)return `<div class="acc"><div class="sub">Account</div><p><b>${esc(last.email)}</b></p>
  <p class="mut">${last.dirty?'⚠️ Hai progressi salvati solo su questo dispositivo. ':''}${navigator.onLine?'Accedi di nuovo per sincronizzarli.':'Senza connessione: si salva tutto qui, sincronizzi quando torna la rete.'}</p>${note}
  <div class="chips"><button class="chip on" data-acc="login"${navigator.onLine?'':' disabled'}>🔄 Accedi e sincronizza</button></div></div>`;
 return `<div class="acc"><div class="sub">Account</div>
  <p class="mut">Stai giocando senza account: i progressi restano su questo dispositivo. Con un account li ritrovi su altri dispositivi e potrai entrare nelle classifiche con gli amici.</p>${note}
  <div class="chips"><button class="chip on" data-acc="login">Accedi o registrati</button></div></div>`;
}
// clic e invio dei moduli nel pannello (delegati: il pannello si ridisegna spesso). login apre la schermata di accesso.
export function wireAccount(panel,openLogin){
 panel.addEventListener('click',e=>{
  const b=e.target.closest('button[data-acc]');if(!b||b.closest('form'))return;const k=b.dataset.acc;
  A.err='';A.msg='';
  if(k==='login')openLogin();
  else if(k==='out')signOut();
  else if(k==='sync')sync(true);
  else{A.view=A.view==='pw'&&k==='pw'?'':k;onChange();}
 });
 panel.addEventListener('submit',e=>{
  const f=e.target.closest('form[data-acc]');if(!f)return;e.preventDefault();
  if(f.dataset.acc==='newpw')setNewPassword(f.elements.p.value);
 });
}
