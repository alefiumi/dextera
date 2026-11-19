/* Scheda Amici: classifica di tutti gli iscritti e degli amici, richieste di amicizia, ricerca per nome utente.
   Serve l'account. I dati arrivano da Supabase (viste leaderboard e leaderboard_friends, tabella friendships) e l'ultima
   copia resta sul dispositivo (dextera-social), così senza rete si vede la classifica dell'ultima volta. */
import {$,toast} from './util.js';
import {S} from './state.js';
import {account as A,configured,esc,online} from './account.js';

const KEY='dextera-social';
const SO={tab:'all',all:[],rank:null,friends:[],rel:{fr:[],inc:[],out:[]},at:0,loading:false,err:'',found:null,q:''};
try{Object.assign(SO,JSON.parse(localStorage.getItem(KEY)||'{}'),{loading:false,err:'',found:null,q:''});}catch(e){}
const keep=()=>{try{const {tab,all,rank,friends,rel,at,uid}=SO;localStorage.setItem(KEY,JSON.stringify({tab,all,rank,friends,rel,at,uid}));}catch(e){}};
let isOpen=()=>false;
export const setSocialOpen=f=>{isOpen=f;};
const redraw=()=>{if(isOpen())renderSocial();navDot();};

// pallino sulla scheda quando ci sono richieste di amicizia in attesa
function navDot(){const b=document.querySelector('body>nav button[data-t="soc"]');if(b)b.classList.toggle('dot',!!(A.user&&SO.uid===A.user.id&&SO.rel.inc.length));}

// la propria riga usa gli XP del dispositivo (il server li riceve qualche secondo dopo)
function mine(rows){
 const uid=A.user.id;rows=rows.map(r=>r.id===uid?{...r,xp:Math.max(r.xp,S.xp),streak:S.streak}:r);
 return rows.sort((a,b)=>b.xp-a.xp);
}
export async function loadSocial(){
 if(!A.user||!A.sb||!online()||SO.loading)return;
 SO.loading=true;SO.err='';redraw();
 try{
  const sb=A.sb,uid=A.user.id,cols='id,username,xp,streak,avatar';
  const [all,fr,rel]=await Promise.all([
   sb.from('leaderboard').select(cols).order('xp',{ascending:false}).limit(100),
   sb.from('leaderboard_friends').select(cols).order('xp',{ascending:false}).limit(200),
   sb.from('friendships').select('user_id,friend_id,status,created_at')]);
  for(const r of [all,fr,rel])if(r.error)throw r.error;
  // posizione propria se non è tra i primi 100
  let rank=null;
  if(A.profile&&A.profile.username&&!all.data.some(r=>r.id===uid)){
   const {count,error}=await sb.from('leaderboard').select('id',{count:'exact',head:true}).gt('xp',S.xp);if(!error)rank=(count||0)+1;
  }
  // nomi e foto di chi compare nelle richieste
  const other=f=>f.user_id===uid?f.friend_id:f.user_id;
  const ids=[...new Set(rel.data.map(other))];
  let ps=[];if(ids.length){const r=await sb.from('public_profiles').select('id,username,avatar').in('id',ids);if(r.error)throw r.error;ps=r.data;}
  const who=Object.fromEntries(ps.map(p=>[p.id,p]));
  const person=f=>({id:other(f),username:who[other(f)]?.username||'(senza nome)',avatar:who[other(f)]?.avatar||''});
  Object.assign(SO,{uid,all:mine(all.data),rank,friends:mine(fr.data),at:Date.now(),
   rel:{fr:rel.data.filter(f=>f.status==='accepted').map(person),inc:rel.data.filter(f=>f.status==='pending'&&f.friend_id===uid).map(person),
    out:rel.data.filter(f=>f.status==='pending'&&f.user_id===uid).map(person)}});
  keep();
 }catch(e){SO.err=/relation|does not exist|schema cache/i.test(e.message||'')?'Sul server mancano le classifiche: va applicato il file supabase/migrations/20261118090000_amici_classifiche.sql.':'Non riesco a leggere la classifica: riprova tra poco.';}
 SO.loading=false;redraw();
}

/* ---------- disegno ---------- */
const av=(src,name)=>src?`<img class="sav" src="${esc(src)}" alt="">`:`<span class="sav">${esc((name||'?').charAt(0).toUpperCase())}</span>`;
const MED=['🥇','🥈','🥉'];
// Una riga della classifica: toccando il nome di un altro giocatore si apre sotto la riga la richiesta di amicizia.
let TOP=1; // XP del primo della classifica mostrata: la barra di ogni riga è in proporzione
function row(r,i){
 const me=A.user&&r.id===A.user.id,open=!me&&SO.pick===r.id;
 return `<div class="lb${me?' me':''}${open?' open':''}"${me?'':` data-so="pick" data-id="${esc(r.id)}" role="button"`}><span class="pos">${i<3?MED[i]:i+1}</span>${av(r.avatar,r.username)}<span class="nm">${esc(r.username)}${me?' <small>(tu)</small>':''}</span>`+
  `<span class="sk">${r.streak?'🔥 '+r.streak:''}</span><b>⭐ ${r.xp}</b><i class="lbbar" style="width:calc((100% - 44px) * ${Math.max(.02,(r.xp||0)/TOP).toFixed(3)})" aria-hidden="true"></i></div>`+(open?`<div class="lbx">${relBtn(r.id)}</div>`:'');
}
// stato dell'amicizia con un giocatore e il pulsante per l'azione possibile
function relBtn(id){
 const R=SO.rel,has=l=>l.some(p=>p.id===id);
 return has(R.fr)?'<span class="mut">✅ Siete già amici</span>':has(R.out)?'<span class="mut">Richiesta inviata, in attesa</span>'
  :has(R.inc)?`<span class="mut">Ti ha chiesto l'amicizia</span><button class="chip on" data-so="acc" data-id="${esc(id)}">Accetta</button>`
  :`<button class="chip on" data-so="ask" data-id="${esc(id)}">👋 Chiedi l'amicizia</button>`;
}
function person(p,btns){return `<div class="lb">${av(p.avatar,p.username)}<span class="nm">${esc(p.username)}</span><span class="pb">${btns}</span></div>`;}
const hm=t=>new Date(t).toLocaleString('it',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

// testata della scheda e anteprima delle casate (fase 4: Osteon, Myon, Neuron, Cor)
const HEAD=`<div class="card ghead"><div class="kick">Flotta</div><h2>Amici e classifiche</h2><p class="mut">Sfida gli amici: in classifica contano gli XP di tutti i giochi.</p></div>`;
const CASATE=[['Osteon','#f0c75e','🦴'],['Myon','#f87171','💪'],['Neuron','#a78bfa','🧠'],['Cor','#60a5fa','🫀']];
const SOON=`<div class="card soon"><div class="kick">In arrivo</div><h3>Casate ed equipaggi</h3><p class="mut">Quattro casate in gara a ogni campionato, con capo e vice votati dai membri, e piccoli equipaggi di amici con il loro obiettivo.</p>
 <ul class="casate">${CASATE.map(([n,c,i])=>`<li style="--c:${c}"><span aria-hidden="true">${i}</span>${n}</li>`).join('')}</ul></div>`;
export function renderSocial(){
 const P=$('panel');
 if(!configured){P.innerHTML=`<div class="fleet">${HEAD}<div class="card"><p class="mut">Il server non è configurato: questa copia dell'app funziona solo in locale.</p></div></div>`;return;}
 if(!A.user){
  P.innerHTML=`<div class="fleet">${HEAD}<div class="card cta"><div class="sky" aria-hidden="true">🚀</div><h3>Entra nella Flotta</h3><p class="mut">Per entrare in classifica e sfidare gli amici serve un account (gratuito). Senza account continui a giocare come sempre e i progressi restano su questo dispositivo.</p>
   <button class="btn wide" data-acc="login">Accedi o registrati</button></div>${SOON}</div>`;return;
 }
 const fresh=SO.uid===A.user.id,name=A.profile&&A.profile.username;
 const tabs=`<div class="seg3" role="group" aria-label="Classifica"><button data-so="tab" data-v="all" aria-pressed="${SO.tab==='all'}">🌍 Tutti</button><button data-so="tab" data-v="friends" aria-pressed="${SO.tab==='friends'}">👥 Amici${fresh&&SO.rel.inc.length?' <span class="cnt">'+SO.rel.inc.length+'</span>':''}</button></div>`;
 const state=SO.loading?'<p class="mut">⏳ Aggiorno…</p>':SO.err?`<p class="err">${esc(SO.err)}</p>`:!online()?`<p class="mut">📴 Senza connessione${fresh&&SO.at?': classifica del '+hm(SO.at):''}.</p>`:'';
 const noName=name?'':'<p class="note">⚠️ Non hai ancora un nome utente: sceglilo nel Profilo (tocca la tua foto in alto) per comparire in classifica e farti trovare dagli amici.</p>';
 const card=(k,t,inner)=>`<div class="card"><div class="kick">${k}</div>${t?`<h3>${t}</h3>`:''}${inner}</div>`;
 let body='';
 if(!fresh){body=SO.loading?'':card('Classifica','','<p class="mut">Classifica non ancora scaricata: serve la connessione.</p>');}
 else if(SO.tab==='all'){
  TOP=Math.max(1,...SO.all.map(r=>r.xp||0),S.xp);
  let list=SO.all.length?SO.all.map(row).join(''):'<p class="mut">Nessuno in classifica per ora.</p>';
  if(SO.rank&&name&&SO.rank>SO.all.length)list+=`<div class="gap">…</div>`+row({id:A.user.id,username:name,xp:S.xp,streak:S.streak,avatar:S.prof.avatar},SO.rank-1);
  body=card('Classifica generale · XP','',`<p class="mut">Tocca un nome per chiedere l'amicizia.</p>${list}`);
 }else{
  const R=SO.rel;TOP=Math.max(1,...SO.friends.map(r=>r.xp||0));
  body=(R.inc.length?card('Richieste ricevute','',R.inc.map(p=>person(p,`<button class="chip on" data-so="acc" data-id="${esc(p.id)}">Accetta</button><button class="chip" data-so="del" data-id="${esc(p.id)}">Rifiuta</button>`)).join('')):'')+
   card('Classifica tra amici · XP','',SO.friends.length>1?SO.friends.map(row).join(''):'<p class="mut">Ancora nessun amico: cercalo qui sotto per nome utente e mandagli una richiesta.</p>')+
   card('Aggiungi un amico','',`<input id="soq" class="soq" placeholder="Nome utente…" autocomplete="off" autocapitalize="none" aria-label="Cerca per nome utente" value="${esc(SO.q)}"${online()?'':' disabled'}><div id="sres">${resHtml()}</div>`)+
   (R.out.length?card('Richieste inviate','',R.out.map(p=>person(p,`<span class="mut">in attesa</span><button class="chip" data-so="del" data-id="${esc(p.id)}">Annulla</button>`)).join('')):'')+
   (R.fr.length?card(`I tuoi amici (${R.fr.length})`,'',R.fr.map(p=>person(p,`<button class="chip" data-so="rm" data-id="${esc(p.id)}" data-n="${esc(p.username)}">Togli</button>`)).join('')):'');
 }
 P.innerHTML=`<div class="fleet">${HEAD}${tabs}${state}${noName}${body}${SOON}`+
  `<p class="note">Punteggi calcolati sui dispositivi di chi gioca: valgono come sfida tra amici. La serie 🔥 conta solo se si è giocato ieri o oggi.</p></div>`;
}
function resHtml(){
 if(!SO.found)return '';
 if(!SO.found.length)return '<p class="mut">Nessun utente con questo nome.</p>';
 return SO.found.map(p=>person(p,relBtn(p.id))).join('');
}

/* ---------- azioni ---------- */
let qTimer=null;
async function search(q){
 SO.q=q;q=q.trim();
 if(q.length<2){SO.found=null;$('sres')&&($('sres').innerHTML='');return;}
 const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
 const {data,error}=await A.sb.from('public_profiles').select('id,username,avatar').ilike('username',like).neq('id',A.user.id).order('username').limit(10);
 if(SO.q.trim()!==q)return; // nel frattempo si è scritto altro
 SO.found=error?[]:data.filter(p=>p.username);
 if($('sres'))$('sres').innerHTML=resHtml();
}
async function act(f,okMsg){
 if(!online()){toast('Serve la connessione.');return;}
 try{const {error}=await f();if(error)throw error;if(okMsg)toast(okMsg);}
 catch(e){toast(e.code==='23505'?'Siete già amici o c\'è già una richiesta tra voi.':'Non riuscito: riprova tra poco.');}
 await loadSocial();if(SO.found&&$('sres'))$('sres').innerHTML=resHtml();
}
// gli id finiscono in un filtro di PostgREST: si accettano solo UUID, così un valore manomesso non cambia il filtro
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pair=(a,b)=>`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`;
export function wireSocial(panel){
 panel.addEventListener('click',e=>{
  const b=e.target.closest('[data-so]');if(!b||!A.user)return;const k=b.dataset.so,id=b.dataset.id,uid=A.user.id,sb=A.sb;
  if(id!==undefined&&!UUID.test(id))return;
  if(k==='tab'){SO.tab=b.dataset.v;SO.pick=null;keep();renderSocial();if(SO.tab==='friends')loadSocial();}
  else if(k==='pick'){SO.pick=SO.pick===id?null:id;renderSocial();}
  else if(k==='ask')act(()=>sb.from('friendships').insert({user_id:uid,friend_id:id}),'Richiesta inviata.');
  else if(k==='acc')act(()=>sb.from('friendships').update({status:'accepted'}).eq('user_id',id).eq('friend_id',uid),'Ora siete amici.');
  else if(k==='del')act(()=>sb.from('friendships').delete().or(pair(uid,id)));
  else if(k==='rm'&&confirm(`Togliere ${b.dataset.n} dagli amici?`))act(()=>sb.from('friendships').delete().or(pair(uid,id)),'Amicizia tolta.');
 });
 panel.addEventListener('input',e=>{if(e.target.id!=='soq')return;const v=e.target.value;clearTimeout(qTimer);qTimer=setTimeout(()=>search(v),300);});
}
// dopo l'accesso: si scaricano subito le richieste (per il pallino sulla scheda); uscendo si toglie tutto
let lastUid=null;
export function socialAccountChanged(){
 const u=A.user&&A.user.id;
 if(u!==lastUid){lastUid=u;if(u&&A.sb)loadSocial();else navDot();}
 if(!u&&SO.uid){SO.all=[];SO.friends=[];SO.rel={fr:[],inc:[],out:[]};SO.uid=null;keep();}
 if(isOpen())renderSocial();
}
