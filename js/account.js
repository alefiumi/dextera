/* Account facoltativo (Supabase): senza account si gioca come sempre e tutto resta sul dispositivo.
   Con l'account i progressi locali si uniscono a quelli del server (si tiene il valore più alto) e le partite finite
   partono dalla coda locale (state.queue) quando c'è rete. La libreria si carica solo se serve.
   L'accesso si fa nella schermata di avvio (gate.js); qui ci sono le funzioni e il riquadro Account del profilo. */
import {S,save,head,onSave,queue,resetLocal} from './state.js';
import {reports,setFlagged,flaggedAge} from './segnala.js';
import {syncFlotta,missing as fleetMissing,SQL_FILE as FLEET_SQL,probePx,PX,PX_SQL} from './flotta.js';
import {NEW_BADGES,isPpVariant} from './badges.js';
import {applyStudio,ppAll} from './percorso.js';
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
  // link "Password dimenticata": schermata a tutto schermo per la nuova password (gate.js), non il profilo
  if(ev==='PASSWORD_RECOVERY'){A.recovery=true;A.view='';A.msg='';}
  const u=session?session.user:null,changed=(u&&u.id)!==(A.user&&A.user.id);A.user=u;if(changed)A.profile=null;
  if(!u){A.profile=null;onChange();return;}
  // "dirty" vale per l'account a cui si riferisce: entrando con un altro account non si porta dietro
  if(changed){const l=lastAccount(),same=l&&l.uid===u.id;A.prevDirty=!!(l&&!same&&l.dirty);setLast({uid:u.id,email:u.email||'',dirty:!!(same&&l.dirty)});setTimeout(()=>sync(true),0);} // fuori dalla callback, come chiede supabase-js
 });
 return A.sb;
}

let started=false;
/* Avvio (chiamato dalla schermata di avvio). Restituisce:
   'ok' sessione valida e progressi sincronizzati · 'offline' sessione salvata ma niente rete (si gioca in locale)
   'expired' c'era un account ma la sessione non vale più · 'none' nessun account su questo dispositivo */
/* Rete. online() a volte dice "senza rete" anche quando c'è (Mac con VPN o schede di rete virtuali, alcuni Chrome):
   quando lo dice si prova davvero a raggiungere Supabase, e se risponde si considera la rete presente. */
let netOk=false;
export const online=()=>navigator.onLine||netOk;
export async function checkNet(){
 if(navigator.onLine){netOk=false;return true;}
 if(!configured)return false;
 try{const c=new AbortController(),t=setTimeout(()=>c.abort(),4000);await fetch(SUPABASE_URL+'/auth/v1/health',{mode:'no-cors',cache:'no-store',signal:c.signal});clearTimeout(t);netOk=true;}
 catch(e){netOk=false;}
 return netOk;
}
addEventListener('offline',()=>checkNet().then(()=>onChange()));
addEventListener('online',()=>{netOk=false;onChange();});
export async function startAccount(){
 if(!configured)return 'none';
 if(!started){started=true;onSave(()=>{if(lastAccount())markDirty(true);syncSoon();});addEventListener('online',()=>syncSoon(0));}
 if(!hasSession()&&!backFromOAuth())return lastAccount()?'expired':'none';
 try{const sb=await client();const {data}=await sb.auth.getSession();A.user=data.session?data.session.user:null;}
 catch(e){return online()?'expired':'offline';}
 if(backFromOAuth())history.replaceState(null,'',location.pathname); // toglie dall'indirizzo il codice del ritorno da Google
 if(!A.user)return lastAccount()?'expired':'none';
 if(!online()){onChange();return 'offline';}
 // la sessione salvata può essere stata revocata (password cambiata, utente tolto): lo dice solo il server
 const {error}=await A.sb.auth.getUser();
 if(error&&(error.status===401||error.status===403||/session|jwt|not found/i.test(error.message||''))){
  try{await A.sb.auth.signOut({scope:'local'});}catch(e){}A.user=null;A.profile=null;return 'expired';
 }
 if(error){onChange();return 'offline';} // server non raggiungibile: si gioca in locale e si riprova dopo
 await sync(true);return 'ok';
}

/* ---------- accesso ---------- */
export const CONTATTO='alessandro.fiumicelli@gmail.com';
const ERR={'Invalid login credentials':'Email o password sbagliate.','User is banned':'Questo account è in cancellazione. Entro 30 giorni dalla richiesta puoi chiederne il ripristino scrivendo a '+CONTATTO+'.','Email not confirmed':'Conferma prima l\'email: ti abbiamo mandato un link.',
 'User already registered':'Questa email è già registrata: accedi.','Password should be at least 6 characters.':'La password deve avere almeno 6 caratteri.'};
const it=e=>ERR[e&&e.message]||(!online()?'Serve la connessione.':/fetch|network|load failed/i.test(e&&e.message||'')?'Server non raggiungibile: riprova tra poco.':(e&&e.message)||'Errore');
async function run(f){A.busy=true;A.err='';A.msg='';onChange();try{await f();}catch(e){A.err=it(e);}A.busy=false;onChange();}
export const signIn=(email,pw)=>run(async()=>{const {error}=await (await client()).auth.signInWithPassword({email,password:pw});if(error)throw error;A.view='';});
// versione dell'informativa sulla privacy accettata alla registrazione (resta nei metadati dell'utente su Supabase)
export const PRIVACY_V='2026-11-19',TERMS_V='2026-11-19'; // versioni di informativa e termini accettati
export const signUp=(email,pw)=>run(async()=>{
 const {data,error}=await (await client()).auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname,
  data:{privacy_v:PRIVACY_V,terms_v:TERMS_V,privacy_at:new Date().toISOString()}}});if(error)throw error;
 if(!data.session)A.msg='Ti abbiamo mandato un\'email: tocca il link per confermare, poi accedi qui.';A.view=data.session?'':'login';
});
// prompt=select_account: Google mostra sempre l'elenco degli account invece di rientrare da solo nell'ultimo usato
export const google=()=>run(async()=>{const {error}=await (await client()).auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,queryParams:{prompt:'select_account'}}});if(error)throw error;});
export const resetPw=email=>run(async()=>{const {error}=await (await client()).auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;A.msg='Se l\'email è registrata, ti arriva un link per scegliere una nuova password.';A.view='login';});
// uscendo i progressi restano sul dispositivo; si dimentica l'account, così all'avvio non si chiede più di accedere
export const signOut=()=>run(async()=>{
 // prima di uscire si inviano i progressi, ma solo se sono di questo account (con la domanda "altri progressi" aperta no)
 const mine=!A.conflict&&!(S.owner&&A.user&&S.owner.uid!==A.user.id);
 if(mine&&lastAccount()?.dirty&&online())await sync(false);
 await (await client()).auth.signOut({scope:'local'});setLast(null);A.user=null;A.profile=null;A.view='';A.conflict=null;A.choice=null;A.msg='Sei uscito: i progressi restano su questo dispositivo.';
});
// Password: nuova dal link di recupero (recover), cambio dal profilo (serve quella attuale, verificata con un client a parte che
// non tocca la sessione) o aggiunta per chi è entrato con Google. Dopo il cambio si chiudono le sessioni sugli altri dispositivi.
const PWERR={'New password should be different from the old password.':'La nuova password deve essere diversa da quella di prima.'};
async function closeOthers(){try{await A.sb.auth.signOut({scope:'others'});}catch(e){}}
export const recoverPassword=pw=>run(async()=>{
 const {data,error}=await A.sb.auth.updateUser({password:pw});if(error)throw new Error(PWERR[error.message]||error.message);
 if(data&&data.user)A.user=data.user;await closeOthers();A.recovery=false;A.msg='Password cambiata. Le sessioni aperte su altri dispositivi sono state chiuse.';
});
export const setNewPassword=(pw,cur)=>run(async()=>{const had=hasPassword();
 if(had){
  if(!cur)throw new Error('Scrivi la password attuale.');
  const tmp=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'dextera-verifica'}});
  const {error:e1}=await tmp.auth.signInWithPassword({email:A.user.email,password:cur});
  if(e1)throw new Error(/invalid/i.test(e1.message||'')?'La password attuale non è giusta.':e1.message);
  try{await tmp.auth.signOut({scope:'local'});}catch(e){}
 }
 const {data,error}=await A.sb.auth.updateUser({password:pw});if(error)throw new Error(PWERR[error.message]||error.message);if(data&&data.user)A.user=data.user;
 if(had)await closeOthers();
 A.msg=had?'Password cambiata. Le sessioni aperte su altri dispositivi sono state chiuse.':'Password aggiunta: ora puoi entrare anche con '+(A.user.email||'la tua email')+' e questa password.';A.view='';});
export const setView=v=>{A.view=v;A.err='';A.msg='';onChange();};
// scelta per i progressi di un altro account sul dispositivo (vedi sync)
export function resolveOwner(choice){A.choice=choice;A.conflict=null;sync(true);}
// l'account in uso ha già l'accesso con email e password?
export const hasPassword=()=>!!(A.user&&(A.user.identities||[]).some(i=>i.provider==='email'));
// Importa nell'account in uso i progressi del telefono (di un altro account). pw: password da aggiungere, così si entra sia con
// Google sia con email e password. oldPw: se c'è, elimina anche il vecchio account (in cancellazione per 30 giorni): si entra
// in quell'account con un client a parte, senza toccare la sessione in uso, e lo si cancella come farebbe lui dal profilo.
export async function importDevice({pw,oldEmail,oldPw}){
 const c=A.conflict;A.busy=true;A.err='';onChange();
 try{
  if(pw&&!hasPassword()){const {data,error}=await A.sb.auth.updateUser({password:pw});if(error)throw error;if(data&&data.user)A.user=data.user;}
  if(oldPw){
   const tmp=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'dextera-vecchio'}});
   const {error:e1}=await tmp.auth.signInWithPassword({email:oldEmail,password:oldPw});
   if(e1)throw new Error(/invalid/i.test(e1.message||'')?'La password del vecchio account non è giusta.':e1.message);
   const {error:e2}=await tmp.rpc('delete_my_account');if(e2)throw e2;
   try{await tmp.auth.signOut({scope:'local'});}catch(e){}
  }
  try{const {data}=await A.sb.auth.getUser();if(data&&data.user)A.user=data.user;}catch(e){}
  A.busy=false;resolveOwner('merge');
 }catch(e){A.busy=false;A.err=it(e);A.conflict=c;onChange();}
}
// collega Google all'account in uso: poi si entra con Google nello stesso account (serve "manual linking" su Supabase)
export const hasGoogle=()=>!!(A.user&&(A.user.identities||[]).some(i=>i.provider==='google'));
export const linkGoogle=()=>run(async()=>{
 const {error}=await A.sb.auth.linkIdentity({provider:'google',options:{redirectTo:location.origin+location.pathname}});
 if(error)throw new Error(/manual linking/i.test(error.message||'')?'Su Supabase va attivato il collegamento manuale degli accessi (Authentication → Sign In / Providers → "Allow manual linking").'
  :/already/i.test(error.message||'')?'Questo account Google è già usato da un altro account Dextera: va prima cancellato quello.':error.message);
});

/* ---------- privacy: copia dei propri dati e cancellazione (GDPR, articoli 15, 17 e 20) ---------- */
// Tutti i dati che l'app ha su questa persona: quelli del dispositivo e, con l'account, quelli del server
// (le regole del database fanno leggere solo i propri).
export async function myData(){
 const out={app:'Dextera',creato_il:new Date().toISOString(),dispositivo:{progressi:S,partite_da_inviare:queue.all(),segnalazioni_da_inviare:reports.all()}};
 if(A.user&&A.sb&&online()){
  const sb=A.sb,uid=A.user.id;
  const [p,g,m,b,f,pp,ds,er,rv,cm,fd,cw,ca,dp]=await Promise.all([ownProfile(sb,uid),sb.from('game_results').select('*').eq('user_id',uid).order('played_at'),
   sb.from('mastery').select('item_id,level,updated_at'),sb.from('badge_assertions').select('badge_id,issued_at').eq('user_id',uid),
   sb.from('friendships').select('user_id,friend_id,status,created_at'),
   sb.from('path_progress').select('*').eq('user_id',uid),
   sb.from('dextera_settings').select('*').eq('user_id',uid),sb.from('error_reports').select('id,data_id,nota,valore,stato,creato_il').eq('user_id',uid),
   sb.from('review_items').select('item_id,intervallo,scadenza,ripassato_il,aggiornato_il').eq('user_id',uid).limit(10000),
   sb.from('constellation_members').select('constellation_id,precedente,cambiata_il,entrata_il').eq('user_id',uid),
   sb.from('fleet_days').select('*').eq('user_id',uid).order('giorno'),
   sb.from('crew_weeks').select('crew_id,settimana,pianeta,contributi').eq('user_id',uid),
   sb.from('crew_challenge_answers').select('challenge_id,giuste,risposto_il').eq('user_id',uid),
   sb.from('dextera_profili').select('copertina,vetrina,titolo,aggiornato_il').eq('user_id',uid)]);
  const st=await sb.from('dextera_studio').select('percorso,corsi,aggiornato_il').eq('user_id',uid); // fase 6 (senza il file SQL: errore, campo vuoto)
  const xp=await sb.from('dextera_percorsi_xp').select('percorso,xp,aggiornato_il').eq('user_id',uid); // più percorsi (stessa regola)
  out.account={email:A.user.email,registrato_il:A.user.created_at,ultimo_accesso:A.user.last_sign_in_at,consenso_privacy:A.user.user_metadata||{},
   profilo:p.data,partite:g.data,maestria:m.data,badge:b.data,amicizie:f.data,percorso:pp.data,impostazioni:ds.data,segnalazioni:er.data,ripasso:rv.data,
   flotta:{casata:cm.data,giorni:fd.data,contributi_equipaggi:cw.data,risposte_sfide:ca.data},copertina_e_titolo:dp.data,cosa_studi:st.data,xp_per_percorso:xp.data};
 }else if(A.user)out.account={email:A.user.email,nota:'Senza connessione: qui ci sono solo i dati del dispositivo.'};
 return out;
}
// cancella l'account sul server: subito bloccato e tolto da classifiche e amicizie, cancellato per sempre dopo 30 giorni
// (entro allora l'amministratore può ripristinarlo su richiesta), poi esce
export const deleteAccount=()=>run(async()=>{
 if(!online())throw new Error('Per cancellare l\'account serve la connessione.');
 const {error}=await A.sb.rpc('delete_my_account');
 if(error)throw new Error(/function|schema cache|does not exist/i.test(error.message||'')?'Sul server manca la funzione di cancellazione: va applicato il file supabase/migrations/20261119100000_privacy_sicurezza.sql.':error.message);
 try{await A.sb.auth.signOut({scope:'local'});}catch(e){}
 setLast(null);A.user=null;A.profile=null;A.deleted=true;
});

/* ---------- profilo (nome, ruolo, presentazione, foto) ---------- */
export const NAME_RE=/^[A-Za-z0-9_.]{3,20}$/;
export const NAME_RULE='Da 3 a 20 caratteri: lettere, numeri, punto e trattino basso (niente spazi).';
// salva sul dispositivo e, con l'account, sul server; il nome deve essere libero (unico tra gli iscritti)
export const saveProfile=f=>run(async()=>{
 if(A.user&&!NAME_RE.test(f.name||''))throw new Error(NAME_RULE);
 if(A.user&&f.name!==(A.profile&&A.profile.username)){
  if(!online())throw new Error('Per cambiare il nome serve la connessione (deve essere libero).');
  const {error}=await A.sb.from('profiles').update({username:f.name}).eq('id',A.user.id);
  if(error)throw new Error(error.code==='23505'?'Questo nome è già preso.':error.message);
  A.profile.username=f.name;
 }
 Object.assign(S.prof,f,{t:Date.now()});save();
 if(A.user)await pushProfile();
 A.msg='Profilo salvato.';
});
async function pushProfile(){
 if(!A.user||!online())return;
 const p=S.prof,row={role:p.role||null,bio:p.bio||null,avatar:p.avatar||null,profile_at:new Date(p.t||Date.now()).toISOString()};
 const {error}=await A.sb.from('profiles').update(row).eq('id',A.user.id);
 if(error){A.warn='Foto, ruolo e presentazione restano solo su questo dispositivo: sul server manca l\'aggiornamento del database (file supabase/migrations/20261117120000_profilo_badge.sql).';return;}
 Object.assign(A.profile,row);
}

/* ---------- sincronizzazione ---------- */
// Il proprio profilo completo: con la funzione my_profile() (degli altri profili si leggono solo alcune colonne, file
// 20261120090000_viste_senza_definer.sql); se sul server non c'è ancora, come prima dalla tabella.
async function ownProfile(sb,uid){
 const r=await sb.rpc('my_profile').maybeSingle();
 if(r.error&&/my_profile|function|schema cache/i.test(r.error.message||''))return sb.from('profiles').select('*').eq('id',uid).single();
 return r;
}
let timer=null;
export function syncSoon(ms=3000){if(!A.user)return;clearTimeout(timer);timer=setTimeout(()=>sync(false),ms);}
const ymdIso=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;};
const ymdApp=s=>{if(!s)return '';const [y,m,d]=s.split('-').map(Number);return `${y}-${m}-${d}`;}; // formato di state.js
const sentBadges=new Set();
// full: all'accesso legge anche il server e unisce; poi basta inviare
export async function sync(full){
 if(!A.user||A.syncing)return;
 if(!navigator.onLine&&!await checkNet()){onChange();return;}
 A.syncing=true;onChange();
 try{
  const sb=A.sb,uid=A.user.id;
  if(full||!A.profile){
   // Progressi di un altro account su questo dispositivo: non si uniscono da soli, si chiede (schermata in gate.js).
   // fresh = questo account parte dai suoi dati sul server; merge = si uniscono i progressi del dispositivo.
   const own=S.owner;
   if(own&&own.uid&&own.uid!==uid){
    if(A.choice!=='merge'&&A.choice!=='fresh'){const l=lastAccount();A.conflict={email:own.email||'un altro account',me:A.user.email||'',dirty:!!(A.prevDirty||(l&&l.uid===own.uid&&l.dirty)||queue.all().length)};A.syncing=false;onChange();return;}
    if(A.choice==='fresh')resetLocal();
   }
   A.choice=null;A.conflict=null;A.prevDirty=false;
   const px=await probePx(sb,true).catch(()=>false);
   const [{data:p,error:e1},{data:ms,error:e2},{data:bs},xr]=await Promise.all([ownProfile(sb,uid),
    sb.from('mastery').select('item_id,level'),sb.from('badge_assertions').select('badge_id,issued_at').eq('user_id',uid),
    px?sb.from('dextera_percorsi_xp').select('percorso,xp').eq('user_id',uid):{data:[]}]);
   if(e1)throw e1;if(e2)throw e2;
   A.profile=p;
   // unione: si tiene il valore più alto (o il giorno più recente per la serie)
   S.xp=Math.max(S.xp,p.xp);S.ok=Math.max(S.ok,p.ok);S.ko=Math.max(S.ko,p.ko);
   // XP per percorso: per ognuno il più alto tra qui e il server; il totale è almeno la loro somma, e gli XP del totale che non
   // hanno un percorso (di prima, o di un altro telefono senza il file SQL) vanno al percorso base
   const by=S.xpBy||(S.xpBy={base:S.lastXp??S.xp});
   for(const r of xr.data||[])if(/^[a-z0-9-]{1,40}$/.test(r.percorso)){if((by[r.percorso]||0)<r.xp)by[r.percorso]=r.xp;else if((by[r.percorso]||0)>r.xp)S.xpU=1;}
   if(px&&!(xr.data||[]).length&&Object.keys(by).length)S.xpU=1;
   const sum=Object.values(by).reduce((a,x)=>a+x,0);
   if(sum>S.xp)S.xp=sum;else if(S.xp>sum){by.base=(by.base||0)+S.xp-sum;S.xpU=1;}
   S.lastXp=S.xp; // gli XP del server non contano per l'obiettivo di oggi
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
   S.owner={uid,email:A.user.email||''};
   try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){} // senza save(): non deve ripartire un invio
   head();
   if((S.prof.t||0)>pt)await pushProfile();
  }
  const prof={xp:S.xp,streak:S.streak,last_day:ymdIso(S.last),ok:S.ok,ko:S.ko,updated_at:new Date().toISOString()};
  const {error:e3}=await sb.from('profiles').update(prof).eq('id',uid);if(e3)throw e3;Object.assign(A.profile,prof);
  // XP per percorso (profilo): senza il file SQL dei percorsi restano qui (avviso nel riquadro Account)
  try{if(await probePx(sb)){A.pxMissing='';if(S.xpU&&S.xpBy){const snap=JSON.stringify(S.xpBy);
    const rows=Object.entries(S.xpBy).filter(([k,v])=>/^[a-z0-9-]{1,40}$/.test(k)&&v>0).map(([percorso,xp])=>({user_id:uid,percorso,xp:Math.min(1e8,Math.round(xp))}));
    if(rows.length){const {error}=await sb.from('dextera_percorsi_xp').upsert(rows,{onConflict:'user_id,percorso'});if(error)throw error;}
    if(JSON.stringify(S.xpBy)===snap)delete S.xpU;}}
   else A.pxMissing=PX_WARN;}catch(e){A.warn='Punti dei percorsi non sincronizzati: riprovo più tardi.';}
  const rows=Object.entries(S.mastery).map(([item_id,level])=>({user_id:uid,item_id,level,updated_at:new Date().toISOString()}));
  if(rows.length){const {error:e4}=await sb.from('mastery').upsert(rows,{onConflict:'user_id,item_id'});if(e4)throw e4;}
  const q=queue.all();
  if(q.length){
   const {error:e5}=await sb.from('game_results').upsert(q.map(r=>({id:r.id,user_id:uid,module:r.module,mode:r.mode,score:r.score,total:r.total,xp:r.xp,played_at:r.played_at})),{onConflict:'id',ignoreDuplicates:true});
   if(e5)throw e5;
   const sent=new Set(q.map(r=>r.id));queue.set(queue.all().filter(r=>!sent.has(r.id)));
  }
  // badge: se sul server manca l'elenco (secondo file SQL non ancora applicato) restano solo qui, senza bloccare il resto.
  // Quelli della fase 5 partono a parte: finché manca il loro file SQL (righe di badge_classes) non bloccano gli altri.
  const nb=Object.entries(S.badges).filter(([id])=>!sentBadges.has(id));
  // le varianti per percorso dei badge di contenuto (sat1-ucbm…) partono a parte: le loro righe arrivano con il file dei percorsi
  const pv=nb.filter(([id])=>isPpVariant(id)),nb2=nb.filter(([id])=>!isPpVariant(id));
  if(pv.length&&PX.ok){const {error}=await sb.from('badge_assertions').upsert(pv.map(([badge_id,issued_at])=>({user_id:uid,badge_id,issued_at})),{onConflict:'user_id,badge_id',ignoreDuplicates:true});if(!error)pv.forEach(([id])=>sentBadges.add(id));}
  for(const part of [nb2.filter(([id])=>!NEW_BADGES.has(id)),nb2.filter(([id])=>NEW_BADGES.has(id))]){
   if(!part.length)continue;const f5=NEW_BADGES.has(part[0][0]);
   const {error:e6}=await sb.from('badge_assertions').upsert(part.map(([badge_id,issued_at])=>({user_id:uid,badge_id,issued_at})),{onConflict:'user_id,badge_id',ignoreDuplicates:true});
   if(e6){A.warn=f5?BADGE_WARN:'I badge restano solo su questo dispositivo: sul server manca l\'elenco (file supabase/migrations/20261117120000_profilo_badge.sql).';if(f5)A.badgeMissing=BADGE_WARN;}
   else{part.forEach(([id])=>sentBadges.add(id));if(f5){A.badgeMissing='';if(A.warn===BADGE_WARN)A.warn='';}}
  }
  // copertina, vetrina e titolo (fase 5): tabella dextera_profili, li vedono gli amici; stessa regola, con il file dei badge
  try{await syncCard(sb,uid,full);A.cardMissing=false;if(/^Copertina/.test(A.warn||''))A.warn='';}catch(e){A.cardMissing=/dextera_profili|schema cache|does not exist|PGRST205|42P01/i.test((e.message||'')+(e.code||''));
   A.warn=A.cardMissing?'Copertina, badge in vetrina e titolo restano su questo telefono (gli amici non li vedono) finché sul server non c\'è il file '+BADGE_SQL+'.':'Copertina e titolo non sincronizzati: riprovo più tardi.';}
  // «Cosa studi?» (fase 6): tabella dextera_studio; senza il file SQL la scelta resta su questo telefono
  try{await syncStudio(sb,uid,full);A.studioMissing='';}catch(e){const m=/dextera_studio|schema cache|does not exist|PGRST205|42P01/i.test((e.message||'')+(e.code||''));
   A.studioMissing=m?'La scelta di «Cosa studi?» resta su questo telefono finché sul server non c\'è il file '+STUDIO_SQL+'.':'';if(!m)A.warn='Scelta dei corsi non sincronizzata: riprovo più tardi.';}
  // percorso, impostazioni e segnalazioni (fase 1): se sul server mancano le tabelle restano in coda qui, senza bloccare il resto
  try{await syncPercorso(sb,uid,full);}catch(e){A.warn=/path_progress|dextera_settings|error_report|schema cache|does not exist|PGRST205|42P01/i.test((e.message||'')+(e.code||''))
   ?'Percorso e segnalazioni restano su questo telefono finché sul server non c\'è il file supabase/migrations/20261121090000_dextera_percorso.sql.':'Percorso non sincronizzato: riprovo più tardi.';}
  // calendario del ripasso (fase 2): stessa regola, con il suo file SQL
  try{await syncRipasso(sb,uid,full);}catch(e){A.warn=/review_items|schema cache|does not exist|PGRST205|42P01/i.test((e.message||'')+(e.code||''))
   ?'Il calendario del ripasso resta su questo telefono finché sul server non c\'è il file supabase/migrations/20261122090000_dextera_ripasso.sql.':'Ripasso non sincronizzato: riprovo più tardi.';}
  // Flotta (fase 4): casata, punti del giorno, contributi agli equipaggi e risposte alle sfide; stessa regola, con il suo file SQL
  try{await syncFlotta(sb,uid,full);A.fleetMissing=false;}catch(e){A.fleetMissing=fleetMissing(e);A.warn=A.fleetMissing
   ?'I punti della Flotta (casata ed equipaggi) restano su questo telefono finché sul server non c\'è il file '+FLEET_SQL+'.':'Flotta non sincronizzata: riprovo più tardi.';}
  A.lastSync=new Date();A.err='';markDirty(false);
 }catch(e){A.err='Sincronizzazione non riuscita: riprovo più tardi. ('+(e.message||e)+')';}
 A.syncing=false;onChange();
}

// Copertina, badge in vetrina e titolo scelto (fase 5) in dextera_profili: si leggono da sé e dagli amici accettati.
// All'accesso vince la modifica più recente (S.prof.ct contro aggiornato_il); poi si invia quando cambia (S.prof.cu).
export const BADGE_SQL='supabase/migrations/20261124090000_dextera_badge.sql';
const BADGE_WARN='I badge nuovi del percorso e della Flotta restano su questo telefono finché sul server non c\'è il file '+BADGE_SQL+'.';
async function syncCard(sb,uid,full){
 const p=S.prof;
 if(full){
  const {data,error}=await sb.from('dextera_profili').select('copertina,vetrina,titolo,titolo_id,aggiornato_il').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  if(data&&Date.parse(data.aggiornato_il)>(p.ct||0)){
   Object.assign(p,{banner:data.copertina||'notte',show:data.vetrina||[],titolo:data.titolo?{id:data.titolo_id||'',t:data.titolo}:null,ct:Date.parse(data.aggiornato_il)});delete p.cu;
   try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}head();return;
  }
  if(!data&&(p.banner||(p.show||[]).length||p.titolo))p.cu=1; // fatti prima della fase 5: si mandano la prima volta
 }
 if(!p.cu)return;
 const ct=p.ct||Date.now(),row={user_id:uid,copertina:p.banner||'notte',vetrina:(p.show||[]).slice(0,3),titolo:p.titolo?.t||null,titolo_id:p.titolo?.id||null,aggiornato_il:new Date(ct).toISOString()};
 const {error}=await sb.from('dextera_profili').upsert(row,{onConflict:'user_id'});
 if(error)throw error;
 if((p.ct||0)===ct||!p.ct){delete p.cu;p.ct=ct;try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}}
}

// «Cosa studi?» (fase 6): percorso e corsi scelti in dextera_studio, così valgono su tutti i dispositivi. All'accesso vince la scelta
// più recente (S.studio.t contro aggiornato_il); poi si invia quando cambia (S.studio.u).
export const PX_WARN='Punti, satelliti accesi ed esami dei percorsi diversi dal completo, ed equipaggi per percorso, restano su questo telefono finché sul server non c\'è il file '+PX_SQL+'.';
export const STUDIO_SQL='supabase/migrations/20261125090000_dextera_studio.sql';
const PID=/^[a-z0-9-]{1,40}$/;
async function syncStudio(sb,uid,full){
 const st=S.studio;
 if(full){
  const {data,error}=await sb.from('dextera_studio').select('percorso,corsi,aggiornato_il').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  if(data&&PID.test(data.percorso||'')&&Date.parse(data.aggiornato_il)>(st?.t||0)){
   S.studio={percorso:data.percorso,corsi:(data.corsi||[]).filter(x=>PID.test(x)),t:Date.parse(data.aggiornato_il)};applyStudio();
   try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}return;
  }
 }
 if(!st||!st.u)return;
 const t=st.t||Date.now(),row={user_id:uid,percorso:PID.test(st.percorso||'')?st.percorso:'base',corsi:(st.corsi||[]).filter(x=>PID.test(x)).slice(0,20),aggiornato_il:new Date(t).toISOString()};
 const {error}=await sb.from('dextera_studio').upsert(row,{onConflict:'user_id'});
 if(error)throw error;
 if(S.studio===st){delete st.u;try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}}
}

// Percorso (fase 1): stato dei nodi in path_progress, obiettivo e scudi in dextera_settings, segnalazioni in error_reports,
// dati segnalati da almeno due persone da error_report_flags (al massimo una volta all'ora). All'accesso vale il valore più avanzato.
const RANK={'':0,iniziato:1,fatto:2,acceso:3};
async function syncPercorso(sb,uid,full){
 const P=S.path||(S.path={nodes:{},last:'',prova:{},prio:{}});
 // passi tolti dalla riparazione di v0.89.1 (repairTor in percorso.js): si cancellano prima di leggere il server, che terrebbe lo stato più alto
 if(P.del?.length){const ids=P.del.filter(x=>/^[a-z0-9.-]{1,80}$/.test(x));
  if(ids.length){const {error}=await sb.from('path_progress').delete().eq('user_id',uid).in('node_id',ids);if(error)throw error;}
  delete P.del;try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}}
 if(full){
  const px=await probePx(sb);
  const [{data:pp,error:a},{data:ds,error:b}]=await Promise.all([sb.from('path_progress').select(px?'node_id,stato,stelle,fatto_il,percorso':'node_id,stato,stelle,fatto_il').eq('user_id',uid),
   sb.from('dextera_settings').select('obiettivo,scudi,date_esame,pianeta,aggiornato_il').eq('user_id',uid).maybeSingle()]);
  if(a)throw a;if(b)throw b;
  const PPa=ppAll();
  for(const r of pp||[]){
   // satellite acceso ed esame di un percorso parziale (colonna percorso): in S.path.pp
   if(r.percorso&&r.percorso!=='base'){if(!/^[a-z0-9-]{1,40}$/.test(r.percorso))continue;const m=PPa[r.percorso]||(PPa[r.percorso]={}),l=m[r.node_id];
    if(!l)m[r.node_id]={stato:r.stato,fatto_il:r.fatto_il};else if(r.fatto_il&&l.fatto_il&&r.fatto_il<l.fatto_il)l.fatto_il=r.fatto_il;continue;}
   const n=P.nodes[r.node_id]||{stato:'',stelle:0,fatto_il:null};
   const out={stato:RANK[r.stato]>RANK[n.stato||'']?r.stato:n.stato,stelle:Math.max(n.stelle||0,r.stelle||0),fatto_il:[n.fatto_il,r.fatto_il].filter(Boolean).sort()[0]||null};
   // da reinviare solo se qui c'è qualcosa di più avanzato del server
   if(RANK[out.stato]>RANK[r.stato]||out.stelle>r.stelle||(out.fatto_il&&out.fatto_il!==r.fatto_il))out.u=1;
   P.nodes[r.node_id]=out;
  }
  const st=ds?Date.parse(ds.aggiornato_il):0;
  if(ds&&st>((S.set&&S.set.t)||0)){S.set={obiettivo:ds.obiettivo,date_esame:okDates(ds.date_esame),pianeta:okPl(ds.pianeta),t:st};S.shields=ds.scudi;}
  else if(S.set&&S.set.t)S.set.u=1;
  try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}
 }
 const sent=Object.entries(P.nodes).filter(([,n])=>n.u),px=await probePx(sb);
 if(sent.length){
  const {error}=await sb.from('path_progress').upsert(sent.map(([node_id,n])=>({user_id:uid,node_id,stato:n.stato||'iniziato',stelle:n.stelle||0,fatto_il:n.fatto_il||null,...(px?{percorso:'base'}:{})})),{onConflict:px?'user_id,percorso,node_id':'user_id,node_id'});
  if(error)throw error;
  for(const [id,n] of sent)if(P.nodes[id]===n)delete n.u; // cambiato nel frattempo: resta da inviare
 }
 // percorsi parziali (S.path.pp): solo con il file SQL dei percorsi; prima restano qui
 const ppu=Object.entries(ppAll()).flatMap(([pid,m])=>/^[a-z0-9-]{1,40}$/.test(pid)?Object.entries(m).filter(([id,n])=>n.u&&/^[a-z0-9-]{1,40}(\.[0-9]{1,2})?$/.test(id)).map(([id,n])=>[pid,id,n]):[]);
 if(ppu.length&&px){
  const {error}=await sb.from('path_progress').upsert(ppu.map(([percorso,node_id,n])=>({user_id:uid,percorso,node_id,stato:n.stato||'acceso',stelle:0,fatto_il:n.fatto_il||null})),{onConflict:'user_id,percorso,node_id'});
  if(error)throw error;
  for(const [,,n] of ppu)delete n.u;
  try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}
 }
 const set=S.set;
 if(set&&set.u){
  const {error}=await sb.from('dextera_settings').upsert({user_id:uid,obiettivo:set.obiettivo||60,scudi:S.shields||0,date_esame:okDates(set.date_esame),pianeta:okPl(set.pianeta),aggiornato_il:new Date(set.t||Date.now()).toISOString()},{onConflict:'user_id'});
  if(error)throw error;
  if(S.set===set)delete set.u;
 }
 if(sent.length||(set&&!set.u))try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}
 // id del dato nel formato di testi/ (lo stesso controllo del database): una voce sbagliata non blocca le altre
 const rq=reports.all().filter(r=>/^[a-z]+(\.[a-z0-9_-]+){2,4}$/.test(r.data_id||'')&&r.data_id.length<=120);
 if(rq.length){
  const {error}=await sb.from('error_reports').upsert(rq.map(r=>({id:r.id,user_id:uid,data_id:r.data_id,nota:r.nota||'',valore:r.valore||''})),{onConflict:'id',ignoreDuplicates:true});
  if(error)throw error;
  const ids=new Set(rq.map(r=>r.id));reports.set(reports.all().filter(r=>!ids.has(r.id)&&/^[a-z]+(\.[a-z0-9_-]+){2,4}$/.test(r.data_id||'')));
 }
 if(full||flaggedAge()>36e5){
  const {data,error}=await sb.from('error_report_flags').select('data_id,ultima').gte('persone',2).limit(5000);
  if(error)throw error;
  setFlagged(Object.fromEntries((data||[]).map(r=>[r.data_id,r.ultima])));
 }
}

// pianeta scelto (Flotta: lì i punti valgono doppio), stessa regola della colonna dextera_settings.pianeta
const okPl=p=>typeof p==='string'&&/^[a-z0-9-]{1,40}$/.test(p)?p:null;
// date d'esame {pianeta: 'AAAA-MM-GG'}: solo voci ben formate (arrivano anche dal server)
const okDates=o=>Object.fromEntries(Object.entries(o&&typeof o==='object'?o:{}).filter(([k,v])=>/^[a-z0-9-]{1,40}$/.test(k)&&/^\d{4}-\d{2}-\d{2}$/.test(v)).slice(0,30));

// Ripasso (fase 2): S.rev {chiave: {i, due, t, u}} ↔ review_items. Vale il ripasso più recente (t ↔ ripassato_il), anche sul server.
const RV_ID=/^[a-z]{1,2}\.[a-z0-9._-]{1,100}$/;
async function syncRipasso(sb,uid,full){
 const R=S.rev||(S.rev={});
 if(full){
  const {data,error}=await sb.from('review_items').select('item_id,intervallo,scadenza,ripassato_il').eq('user_id',uid).limit(10000);
  if(error)throw error;
  for(const r of data||[]){
   const t=Date.parse(r.ripassato_il)||0,l=R[r.item_id];
   if(!l||t>(l.t||0))R[r.item_id]={i:r.intervallo,due:r.scadenza,t};
   else if((l.t||0)>t)l.u=1;
  }
  try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}
 }
 const sent=Object.entries(R).filter(([k,r])=>r.u&&RV_ID.test(k)&&/^\d{4}-\d{2}-\d{2}$/.test(r.due||''));
 for(let i=0;i<sent.length;i+=500){
  const part=sent.slice(i,i+500).map(([k,r])=>[k,r,r.t]);
  const {error}=await sb.from('review_items').upsert(part.map(([item_id,r,t])=>({user_id:uid,item_id,intervallo:r.i||0,scadenza:r.due,ripassato_il:new Date(t||Date.now()).toISOString()})),{onConflict:'user_id,item_id'});
  if(error)throw error;
  for(const [k,r,t] of part)if(R[k]===r&&r.t===t)delete r.u; // ripassato di nuovo nel frattempo: resta da inviare
 }
 if(sent.length)try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}
}

/* ---------- riquadro Account nel profilo ---------- */
export const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hm=d=>d.toLocaleTimeString('it',{hour:'2-digit',minute:'2-digit'});
export function accountHtml(){
 if(!configured)return '';
 const note=(A.err?`<p class="err">${esc(A.err)}</p>`:'')+(A.msg?`<p class="okm">${esc(A.msg)}</p>`:'')+(A.warn?`<p class="note">${esc(A.warn)}</p>`:'')+(A.studioMissing&&A.studioMissing!==A.warn?`<p class="note">${esc(A.studioMissing)}</p>`:'')+(A.pxMissing&&A.pxMissing!==A.warn?`<p class="note">${esc(A.pxMissing)}</p>`:'');
 const last=lastAccount();
 if(A.user){
  const pend=queue.all().length,dirty=last&&last.dirty;
  const state=A.syncing?'⏳ Sincronizzo…':!online()?'📴 Senza connessione: i progressi si salvano qui e partono appena torna la rete.'
   :dirty||pend?'⚠️ Ci sono progressi non ancora salvati online.':A.lastSync?'✅ Tutto salvato online alle '+hm(A.lastSync)+'.':'';
  return `<div class="acc"><div class="sub">Account</div><p class="mut">${esc(A.user.email||'')}</p><p class="mut">${state}${pend?' Partite in attesa: '+pend+'.':''}</p>${note}
   ${A.view==='pw'?`<form data-acc="newpw">${hasPassword()?'<input name="cur" type="password" placeholder="Password attuale" autocomplete="current-password" required>':`<p class="mut">Con una password entri anche con ${esc(A.user.email||'la tua email')}, oltre che con Google.</p>`}
    <input name="p" type="password" placeholder="Nuova password (almeno 8 caratteri)" autocomplete="new-password" minlength="8" required>
    <input name="p2" type="password" placeholder="Ripeti la nuova password" autocomplete="new-password" minlength="8" required>
    <button class="btn"${A.busy?' disabled':''}>${hasPassword()?'Cambia password':'Aggiungi password'}</button></form>`:''}
   <div class="chips"><button class="chip on" data-acc="sync"${A.syncing?' disabled':''}>🔄 Sincronizza ora</button><button class="chip" data-acc="pw">${hasPassword()?'Cambia password':'Aggiungi password'}</button>${hasGoogle()?'<span class="chip">✅ Google collegato</span>':'<button class="chip" data-acc="google">Collega Google</button>'}<button class="chip" data-acc="out">Esci</button></div></div>`;
 }
 if(last)return `<div class="acc"><div class="sub">Account</div><p><b>${esc(last.email)}</b></p>
  <p class="mut">${last.dirty?'⚠️ Hai progressi salvati solo su questo dispositivo. ':''}${online()?'Accedi di nuovo per sincronizzarli.':'Senza connessione: si salva tutto qui, sincronizzi quando torna la rete.'}</p>${note}
  <div class="chips"><button class="chip on" data-acc="login"${online()?'':' disabled'}>🔄 Accedi e sincronizza</button></div></div>`;
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
  else if(k==='google')linkGoogle();
  else if(k==='sync')sync(true);
  else{A.view=A.view==='pw'&&k==='pw'?'':k;onChange();}
 });
 panel.addEventListener('submit',e=>{
  const f=e.target.closest('form[data-acc]');if(!f)return;e.preventDefault();
  if(f.dataset.acc==='newpw'){if(f.elements.p.value!==f.elements.p2.value){A.err='Le due password nuove non coincidono.';onChange();return;}setNewPassword(f.elements.p.value,f.elements.cur?f.elements.cur.value:'');}
 });
}
