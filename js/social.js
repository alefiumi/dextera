/* Scheda Flotta (fase 4, sezione 6 della specifica). Quattro viste:
   - Amici: classifica della settimana per XP di progresso (vista dextera_classifica_settimana, si azzera il lunedì), richieste
     di amicizia e ricerca per nome utente. Se sul server manca il file della Flotta: la classifica tra amici per XP totali.
   - Casate: le 4 casate (Osteon, Myon, Neuron, Cor), la propria (assegnata dal server, si cambia una volta per stagione),
     i punti della stagione (mese), il pianeta scelto (punti doppi) e l'albo delle stagioni chiuse.
   - Equipaggi: da 2 a 10 amici con un codice d'invito, l'obiettivo della settimana su un pianeta e le sfide di 5 strutture.
   - Tutti: la classifica generale per XP (come in BodyMania).
   Serve l'account e, per vedere i dati degli altri, la rete; l'ultima copia resta sul dispositivo (dextera-social).
   I conti (punti, contributi, risposte) si fanno sul telefono in flotta.js e partono con la sincronizzazione (account.js). */
import {$,toast} from './util.js';
import {app,S,save,head} from './state.js';
import {account as A,configured,esc,online} from './account.js';
import * as P from './percorso.js';
import * as FL from './flotta.js';
import {startChallenge,structName} from './lezione.js';

const KEY='dextera-social';
const SO={tab:'friends',all:[],rank:null,friends:[],rel:{fr:[],inc:[],out:[]},at:0,fleet:null,done:{},loading:false,err:'',ferr:'',found:null,q:'',chg:false,pick:null,pk:null,sel:[]};
try{Object.assign(SO,JSON.parse(localStorage.getItem(KEY)||'{}'),{loading:false,err:'',ferr:'',found:null,q:'',chg:false,pick:null,pk:null,sel:[]});}catch(e){}
if(!['friends','houses','crews','all'].includes(SO.tab))SO.tab='friends';
const keep=()=>{try{const {tab,all,rank,friends,rel,at,uid,fleet,done}=SO;localStorage.setItem(KEY,JSON.stringify({tab,all,rank,friends,rel,at,uid,fleet,done}));}catch(e){}};
let isOpen=()=>false,NAV={};
export const setSocialOpen=f=>{isOpen=f;};
export const setSocialNav=o=>{NAV=o;}; // {useMod, setTab} da ui.js: per giocare una sfida nella scheda Palestra
const redraw=()=>{if(isOpen())renderSocial();navDot();};

// pallino sulla scheda quando ci sono richieste di amicizia in attesa
function navDot(){const b=document.querySelector('body>nav button[data-t="soc"]');if(b)b.classList.toggle('dot',!!(A.user&&SO.uid===A.user.id&&SO.rel.inc.length));}

// la propria riga usa i dati del dispositivo (il server li riceve qualche secondo dopo)
function mine(rows,xp=S.xp){
 const uid=A.user.id;rows=rows.map(r=>r.id===uid?{...r,xp:Math.max(r.xp||0,xp),streak:S.streak}:r);
 return rows.sort((a,b)=>b.xp-a.xp);
}
export async function loadSocial(){
 if(!A.user||!A.sb||!online()||SO.loading)return;
 SO.loading=true;SO.err='';redraw();
 const sb=A.sb,uid=A.user.id;
 try{
  const cols='id,username,xp,streak,avatar';
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
 // Flotta: se sul server manca il suo file SQL il resto della scheda funziona lo stesso
 try{await loadFleet(sb,uid);SO.ferr='';}catch(e){SO.ferr=FL.missing(e)?'missing':'err';}
 SO.loading=false;redraw();
}

/* ---------- dati della Flotta ---------- */
async function loadFleet(sb,uid){
 await FL.ensureCasata(sb,uid);
 const [k,sc,ss,wk,cr]=await Promise.all([
  sb.from('constellations').select('id,nome,simbolo,colore,ordine,membri').order('ordine'),
  sb.from('season_scores').select('constellation_id,punti,membri_attivi').eq('stagione',FL.season()),
  sb.from('seasons').select('stagione,vincitore,classifica').order('stagione',{ascending:false}).limit(6),
  sb.from('dextera_classifica_settimana').select('id,username,avatar,xp').order('xp',{ascending:false}).limit(200),
  sb.from('crews').select('id,nome,codice,capo,vice,pianeta,membri_ids,settimana,contributi,creato_il').order('creato_il')]);
 for(const r of [k,sc,ss,wk,cr])if(r.error)throw r.error;
 const crews=cr.data||[],ids=[...new Set(crews.flatMap(c=>c.membri_ids||[]))];
 const since=new Date(Date.now()-FL.FR().sfida.giorni*864e5).toISOString();
 const [pp,ch]=await Promise.all([
  ids.length?sb.from('public_profiles').select('id,username,avatar').in('id',ids):{data:[]},
  crews.length?sb.from('crew_challenges').select('id,crew_id,autore,pianeta,strutture,creata_il').in('crew_id',crews.map(c=>c.id)).gte('creata_il',since).order('creata_il',{ascending:false}).limit(60):{data:[]}]);
 for(const r of [pp,ch])if(r.error)throw r.error;
 const chs=ch.data||[];
 const an=chs.length?await sb.from('crew_challenge_answers').select('challenge_id,user_id,giuste').in('challenge_id',chs.map(c=>c.id)):{data:[]};
 if(an.error)throw an.error;
 SO.fleet={uid,k:k.data||[],sc:sc.data||[],ss:ss.data||[],week:wk.data||[],crews,prof:Object.fromEntries((pp.data||[]).map(p=>[p.id,p])),ch:chs,ans:an.data||[],at:Date.now()};
 for(const a of SO.fleet.ans)if(a.user_id===uid)delete SO.done[a.challenge_id]; // già sul server
 // pianeti degli equipaggi: i contributi della settimana si mandano per ogni equipaggio; se ne cambia uno si rimandano
 const f=FL.F(),pl=Object.fromEntries(crews.map(c=>[c.id,c.pianeta||null]));
 if(JSON.stringify(pl)!==JSON.stringify(f.crewPl)){f.crewPl=pl;if(Object.keys(f.wk.pl||{}).length)f.wk.u=1;save();}
 rewards(crews);
 keep();
}
// obiettivo dell'equipaggio raggiunto nella settimana: +50 XP a testa (una volta per equipaggio e settimana)
function rewards(crews){
 const w=FL.monday(),f=FL.F(),E=FL.FR().equipaggio;let got=0;
 for(const c of crews){
  const n=(c.membri_ids||[]).length,goal=n*E.per_membro,k=c.id+':'+w;
  if(n>=E.min&&c.pianeta&&c.settimana===w&&c.contributi>=goal&&!f.premi[k]){f.premi[k]=1;S.xp+=E.xp;got++;toast(`🏅 ${c.nome}: obiettivo della settimana raggiunto! +${E.xp} XP`);}
 }
 const ks=Object.keys(f.premi);if(ks.length>40)for(const k of ks.slice(0,ks.length-40))delete f.premi[k];
 if(got){save();head();}
}

/* ---------- disegno ---------- */
const av=(src,name)=>src?`<img class="sav" src="${esc(src)}" alt="">`:`<span class="sav" aria-hidden="true">${esc((name||'?').charAt(0).toUpperCase())}</span>`;
const MED=['🥇','🥈','🥉'];
const fmt=n=>Number(n||0).toLocaleString('it');
// Una riga della classifica: toccando il nome di un altro giocatore si apre sotto la riga la richiesta di amicizia.
let TOP=1; // XP del primo della classifica mostrata: la barra di ogni riga è in proporzione
function row(r,i){
 const me=A.user&&r.id===A.user.id,open=!me&&SO.pick===r.id;
 return `<div class="lb${me?' me':''}${open?' open':''}"${me?'':` data-so="pick" data-id="${esc(r.id)}" role="button" tabindex="0" aria-expanded="${open}"`}><span class="pos">${i<3?MED[i]:i+1}</span>${av(r.avatar,r.username)}<span class="nm">${esc(r.username)}${me?' <small>(tu)</small>':''}</span>`+
  `<span class="sk">${r.streak?'🔥 '+r.streak:''}</span><b>⭐ ${fmt(r.xp)}</b><i class="lbbar" style="width:calc((100% - 44px) * ${Math.max(.02,(r.xp||0)/TOP).toFixed(3)})" aria-hidden="true"></i></div>`+(open?`<div class="lbx">${relBtn(r.id)}</div>`:'');
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
const card=(k,t,inner,cls='')=>`<div class="card${cls?' '+cls:''}"><div class="kick">${k}</div>${t?`<h3>${t}</h3>`:''}${inner}</div>`;
const monthName=(s=FL.season())=>{const [y,m]=s.split('-').map(Number);const t=new Date(y,m-1,1).toLocaleDateString('it',{month:'long',year:'numeric'});return t.charAt(0).toUpperCase()+t.slice(1);};

// testata della scheda e anteprima delle casate (senza account o finché sul server manca il file della Flotta)
const HEAD=`<div class="card ghead"><div class="kick">Flotta</div><h2>Amici, casate ed equipaggi</h2><p class="mut">Sfida gli amici ogni settimana, porta punti alla tua casata e raggiungi l'obiettivo con il tuo equipaggio.</p></div>`;
const CASATE=[['Osteon','#f0c75e','🦴'],['Myon','#f87171','💪'],['Neuron','#a78bfa','🧠'],['Cor','#60a5fa','🫀']];
const preview=t=>`<div class="card soon"><div class="kick">${t}</div><h3>Casate ed equipaggi</h3><p class="mut">Quattro casate in gara ogni mese: ogni XP di progresso vale un punto per la tua. E piccoli equipaggi di amici con il loro obiettivo della settimana e le sfide.</p>
 <ul class="casate">${CASATE.map(([n,c,i])=>`<li style="--c:${c}"><span aria-hidden="true">${i}</span>${n}</li>`).join('')}</ul></div>`;
const MISSING=`<p class="note">⚠️ Sul server manca il file ${FL.SQL_FILE}: casate, equipaggi e la classifica della settimana arrivano quando viene applicato. Intanto i tuoi punti si contano su questo telefono.</p>`;

export function renderSocial(){
 const P0=$('panel');
 if(!configured){P0.innerHTML=`<div class="fleet">${HEAD}<div class="card"><p class="mut">Il server non è configurato: questa copia dell'app funziona solo in locale.</p></div></div>`;return;}
 if(!A.user){
  P0.innerHTML=`<div class="fleet">${HEAD}<div class="card cta"><div class="sky" aria-hidden="true">🚀</div><h3>Entra nella Flotta</h3><p class="mut">Per entrare in classifica, in una casata e in un equipaggio serve un account (gratuito). Senza account continui a giocare come sempre e i progressi restano su questo dispositivo.</p>
   <button class="btn wide" data-acc="login">Accedi o registrati</button></div>${preview('Con l\'account')}</div>`;return;
 }
 const fresh=SO.uid===A.user.id,name=A.profile&&A.profile.username,fl=SO.fleet&&SO.fleet.uid===A.user.id?SO.fleet:null;
 const T=[['friends','👥','Amici',fresh&&SO.rel.inc.length],['houses','✨','Casate'],['crews','🚀','Equipaggi'],['all','🌍','Tutti']];
 const tabs=`<div class="seg3 s4" role="group" aria-label="Sezioni della Flotta">${T.map(([v,i,t,n])=>`<button data-so="tab" data-v="${v}" aria-pressed="${SO.tab===v}"><span aria-hidden="true">${i}</span>${t}${n?' <span class="cnt">'+n+'</span>':''}</button>`).join('')}</div>`;
 const state=SO.loading?'<p class="mut" role="status">⏳ Aggiorno…</p>':SO.err?`<p class="err">${esc(SO.err)}</p>`:!online()?`<p class="mut">📴 Senza connessione${fresh&&SO.at?': dati del '+hm(SO.at):''}. Le modifiche si fanno con la rete.</p>`:'';
 const noName=name?'':'<p class="note">⚠️ Non hai ancora un nome utente: sceglilo nel Profilo (tocca la tua foto in alto) per comparire in classifica e farti trovare dagli amici.</p>';
 const miss=SO.ferr==='missing'||A.fleetMissing?MISSING:SO.ferr==='err'?'<p class="err">Non riesco a leggere casate ed equipaggi: riprova tra poco.</p>':'';
 let body='';
 if(SO.tab==='friends')body=friendsHtml(fresh,fl);
 else if(SO.tab==='houses')body=fl?housesHtml(fl):(SO.loading?'':miss?preview('In arrivo'):card('Casate','','<p class="mut">Casate non ancora scaricate: serve la connessione.</p>'));
 else if(SO.tab==='crews')body=fl?crewsHtml(fl):(SO.loading?'':miss?preview('In arrivo'):card('Equipaggi','','<p class="mut">Equipaggi non ancora scaricati: serve la connessione.</p>'));
 else if(!fresh)body=SO.loading?'':card('Classifica','','<p class="mut">Classifica non ancora scaricata: serve la connessione.</p>');
 else{
  TOP=Math.max(1,...SO.all.map(r=>r.xp||0),S.xp);
  let list=SO.all.length?SO.all.map(row).join(''):'<p class="mut">Nessuno in classifica per ora.</p>';
  if(SO.rank&&name&&SO.rank>SO.all.length)list+=`<div class="gap">…</div>`+row({id:A.user.id,username:name,xp:S.xp,streak:S.streak,avatar:S.prof.avatar},SO.rank-1);
  body=card('Classifica generale · XP totali','',`<p class="mut">Tutti gli XP, da sempre. Tocca un nome per chiedere l'amicizia.</p>${list}`);
 }
 P0.innerHTML=`<div class="fleet">${HEAD}${tabs}${state}${noName}${SO.tab==='all'?'':miss}${body}`+
  `<p class="note">Punteggi calcolati sui dispositivi di chi gioca: valgono come sfida tra amici. I tuoi amici vedono i tuoi XP di progresso di ogni giorno.</p></div>`;
}

/* ---------- Amici: classifica della settimana ---------- */
function friendsHtml(fresh,fl){
 if(!fresh)return SO.loading?'':card('Classifica tra amici','','<p class="mut">Classifica non ancora scaricata: serve la connessione.</p>');
 const R=SO.rel;let rank;
 if(fl){
  const rows=mine(fl.week,FL.weekXp()).map(r=>({...r,streak:0}));TOP=Math.max(1,...rows.map(r=>r.xp||0));
  rank=card('Classifica della settimana · XP di progresso','',`<p class="mut">Contano solo gli XP di progresso: passi fatti, satelliti accesi, strutture che salgono di livello, ripassi in tempo, esami. Rifare in Palestra ciò che sai già non fa salire. Si azzera lunedì alle 00:00.</p>`+
   (rows.length>1?rows.map(row).join(''):(rows.map(row).join('')+'<p class="mut">Ancora nessun amico: cercalo qui sotto per nome utente e mandagli una richiesta.</p>')));
 }else{
  TOP=Math.max(1,...SO.friends.map(r=>r.xp||0));
  rank=card('Classifica tra amici · XP totali','',SO.friends.length>1?SO.friends.map(row).join(''):'<p class="mut">Ancora nessun amico: cercalo qui sotto per nome utente e mandagli una richiesta.</p>');
 }
 return (R.inc.length?card('Richieste ricevute','',R.inc.map(p=>person(p,`<button class="chip on" data-so="acc" data-id="${esc(p.id)}">Accetta</button><button class="chip" data-so="del" data-id="${esc(p.id)}">Rifiuta</button>`)).join('')):'')+rank+
  card('Aggiungi un amico','',`<input id="soq" class="soq" placeholder="Nome utente…" autocomplete="off" autocapitalize="none" aria-label="Cerca per nome utente" value="${esc(SO.q)}"${online()?'':' disabled'}><div id="sres" aria-live="polite">${resHtml()}</div>`)+
  (R.out.length?card('Richieste inviate','',R.out.map(p=>person(p,`<span class="mut">in attesa</span><button class="chip" data-so="del" data-id="${esc(p.id)}">Annulla</button>`)).join('')):'')+
  (R.fr.length?card(`I tuoi amici (${R.fr.length})`,'',R.fr.map(p=>person(p,`<button class="chip" data-so="rm" data-id="${esc(p.id)}" data-n="${esc(p.username)}">Togli</button>`)).join('')):'');
}
function resHtml(){
 if(!SO.found)return '';
 if(!SO.found.length)return '<p class="mut">Nessun utente con questo nome.</p>';
 return SO.found.map(p=>person(p,relBtn(p.id))).join('');
}

/* ---------- Casate ---------- */
const allPlanets=()=>P.ready()?P.corsi().flatMap(c=>P.pianeti(c).map(p=>({p,c}))):[];
const planetById=id=>allPlanets().find(x=>x.p.id===id)?.p||null;
function planetOptions(sel,none){
 const L=allPlanets();if(!L.length)return '';
 const by=new Map();for(const {p,c} of L){if(!by.has(c))by.set(c,[]);by.get(c).push(p);}
 return `<option value="">${esc(none)}</option>`+[...by].map(([c,ps])=>`<optgroup label="${esc(c.nome)}">${ps.map(p=>`<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.nome)}</option>`).join('')}</optgroup>`).join('');
}
function housesHtml(fl){
 const f=FL.F(),K=fl.k,my=K.find(k=>k.id===f.casata),Rf=FL.FR();
 if(!my)return card('La tua casata','','<p class="mut">Casata non ancora assegnata: serve la connessione.</p>');
 const now=new Date(),next=new Date(now.getFullYear(),now.getMonth()+1,1),last=new Date(next-864e5);
 const nextTxt=next.toLocaleDateString('it',{day:'numeric',month:'long'}),lastTxt=last.toLocaleDateString('it',{day:'numeric',month:'long'});
 const pl=S.set&&S.set.pianeta,opts=planetOptions(pl,'Nessuno');
 const change=FL.canChange()?(SO.chg?`<div class="sub">Passa a un'altra casata</div><p class="mut">Si può cambiare una volta per stagione; i punti già fatti restano a ${esc(my.nome)}.</p><div class="chips">${K.filter(k=>k.id!==my.id).map(k=>`<button class="chip hchip" style="--c:${esc(k.colore)}" data-so="house" data-h="${esc(k.id)}"><span aria-hidden="true">${esc(k.simbolo)}</span> ${esc(k.nome)}</button>`).join('')}<button class="chip" data-so="chg">Annulla</button></div>`
  :`<button class="chip" data-so="chg">Cambia casata</button>`):`<p class="mut">Hai già cambiato casata in questa stagione: potrai cambiarla di nuovo dal ${esc(nextTxt)}.</p>`;
 const mine=`<div class="card house" style="--c:${esc(my.colore)}"><div class="hhead"><span class="hsym" aria-hidden="true">${esc(my.simbolo)}</span><div><div class="kick">La tua casata</div><h3>${esc(my.nome)}</h3><p class="mut">${fmt(my.membri)} ${my.membri===1?'membro':'membri'}</p></div></div>
  <div class="hnums"><div><b>${FL.todayPoints()}</b><small>punti oggi (al massimo ${Rf.tetto_giorno})</small></div><div><b>${fmt(FL.seasonPoints())}</b><small>tuoi punti a ${esc(monthName().split(' ')[0].toLowerCase())}</small></div></div>
  ${opts?`<label class="fl" for="sopl">Pianeta che stai studiando</label><select id="sopl" class="soq" data-so="pl">${opts}</select><p class="mut">Lì i tuoi punti valgono doppio; il tetto di ${Rf.tetto_giorno} al giorno resta.</p>`:''}
  ${change}</div>`;
 const sc=Object.fromEntries(fl.sc.map(r=>[r.constellation_id,r])),rows=K.map(k=>({k,p:+(sc[k.id]?.punti||0),a:sc[k.id]?.membri_attivi||0})).sort((a,b)=>b.p-a.p||a.k.ordine-b.k.ordine);
 const top=Math.max(1,...rows.map(r=>r.p));
 const season=card('Stagione di '+esc(monthName()),'',`<p class="mut">Finisce il ${esc(lastTxt)}: vince la casata con più punti. Ogni XP di progresso di un membro vale un punto, al massimo ${Rf.tetto_giorno} al giorno a testa.</p>`+
  rows.map((r,i)=>`<div class="lb hrow${r.k.id===my.id?' me':''}" style="--c:${esc(r.k.colore)}"><span class="pos">${r.p?(i<3?MED[i]:i+1):'–'}</span><span class="hsym s" aria-hidden="true">${esc(r.k.simbolo)}</span><span class="nm">${esc(r.k.nome)}${r.k.id===my.id?' <small>(la tua)</small>':''}<small class="hm">${r.a} ${r.a===1?'membro attivo':'membri attivi'}</small></span><b>${fmt(r.p)} punti</b><i class="lbbar" style="width:calc((100% - 44px) * ${Math.max(.02,r.p/top).toFixed(3)})" aria-hidden="true"></i></div>`).join(''));
 const kn=id=>K.find(k=>k.id===id);
 const albo=fl.ss.length?card('Albo delle stagioni','',`<ul class="albo">${fl.ss.map(s=>{const w=kn(s.vincitore),pts=(s.classifica||[]).find(x=>x.casata===s.vincitore)?.punti;
  return `<li><span>${esc(monthName(s.stagione))}</span><b>${w?`🏆 <span aria-hidden="true">${esc(w.simbolo)}</span> ${esc(w.nome)}${pts!=null?` · ${fmt(pts)} punti`:''}`:'nessun punto'}</b></li>`;}).join('')}</ul>`):'';
 return mine+season+albo;
}

/* ---------- Equipaggi ---------- */
const who=(fl,id)=>fl.prof[id]?.username||'(senza nome)';
const KINDS=['ossa','reperi','muscoli','strutture'];
// strutture che si possono mettere in una sfida: quelle dei passi ossa, reperi, muscoli (corpo) e strutture (neurologia) del pianeta
function chKeys(pl){
 const out=[],seen=new Set();if(!P.ready())return out;
 for(const sat of P.satelliti(pl,P.corsoOf(pl)))for(const k of P.satKeys(sat)){
  const e=P.revEntry(k);if(!e||seen.has(k)||!KINDS.includes(e.ps.tipo))continue;seen.add(k);
  let n;try{n=structName(e.sid);}catch(x){continue;}out.push({k,n,sat});
 }
 return out;
}
function crewsHtml(fl){
 const E=FL.FR().equipaggio,full=fl.crews.length>=E.max_per_persona,off=online()?'':' disabled';
 const list=fl.crews.map(c=>crewHtml(fl,c)).join('');
 const mk=full?'':card('Nuovo equipaggio','Crea un equipaggio',`<form data-so="mk" class="sofm"><label class="fl" for="sonm">Nome</label><input id="sonm" name="nome" class="soq" minlength="3" maxlength="30" required autocomplete="off" placeholder="Per esempio: Ossa rotte">
  <label class="fl" for="sompl">Pianeta dell'obiettivo</label><select id="sompl" name="pianeta" class="soq">${planetOptions('','Lo scegliete dopo')}</select>
  <button class="btn"${off}>Crea</button></form><p class="mut">Da ${E.min} a ${E.max} persone: dopo averlo creato condividi il codice d'invito.</p>`);
 const join=full?`<p class="note">Sei già in ${E.max_per_persona} equipaggi: è il massimo. Per entrare in un altro esci da uno.</p>`:card('Hai un codice?','Entra in un equipaggio',`<form data-so="join" class="sofm"><label class="fl" for="socd">Codice d'invito (6 caratteri)</label><input id="socd" name="codice" class="soq code" maxlength="6" minlength="6" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234"><button class="btn"${off}>Entra</button></form>`);
 return (list||card('Equipaggi','','<p class="mut">Non sei ancora in un equipaggio. Un equipaggio è un piccolo gruppo di amici con un obiettivo della settimana su un pianeta: ognuno contribuisce con le strutture che porta a maestria 2 o che ripassa in tempo.</p>'))+mk+join;
}
function crewHtml(fl,c){
 const me=A.user.id,capo=c.capo===me,vice=c.vice===me,ids=c.membri_ids||[],n=ids.length,E=FL.FR().equipaggio,goal=n*E.per_membro,w=FL.monday();
 const tot=c.settimana===w?c.contributi:0,pl=planetById(c.pianeta),mineN=c.pianeta?FL.myContrib(c.pianeta):0;
 const ord=[c.capo,c.vice,...ids.filter(x=>x!==c.capo&&x!==c.vice)].filter(x=>x&&ids.includes(x));
 const members=ord.map(id=>{const p=fl.prof[id]||{},tag=id===c.capo?'<span class="tag">👑 Capo</span>':id===c.vice?'<span class="tag">⭐ Vice</span>':'';
  const acts=capo&&id!==me?(n>=3?`<button class="chip" data-so="vice" data-id="${esc(c.id)}" data-u="${esc(id===c.vice?'':id)}">${id===c.vice?'Togli vice':'Fai vice'}</button>`:'')+`<button class="chip" data-so="kick" data-id="${esc(c.id)}" data-u="${esc(id)}" data-n="${esc(p.username||'')}">Togli</button>`:'';
  return `<div class="lb">${av(p.avatar,p.username)}<span class="nm">${esc(p.username||'(senza nome)')}${id===me?' <small>(tu)</small>':''}</span>${tag}<span class="pb">${acts}</span></div>`;}).join('');
 const canPl=capo||vice,plSel=canPl?`<label class="fl" for="cpl-${esc(c.id)}">Pianeta dell'obiettivo</label><select id="cpl-${esc(c.id)}" class="soq" data-so="cpl" data-id="${esc(c.id)}">${planetOptions(c.pianeta||'',c.pianeta?'Nessuno':'Scegli un pianeta')}</select>`:'';
 let goalH;
 if(!pl)goalH=`<p class="mut">${canPl?'Scegli il pianeta dell\'obiettivo della settimana.':'Il capo o il vice scelgono il pianeta dell\'obiettivo.'}</p>`;
 else if(n<E.min)goalH=`<p class="mut">Serve almeno un altro membro: condividi il codice d'invito. Obiettivo su <b>${esc(pl.nome)}</b>.</p>`;
 else{const pct=Math.min(1,tot/goal),done=tot>=goal;
  goalH=`<div class="goal"><p><b>${tot}/${goal}</b> contributi su <b>${esc(pl.nome)}</b> questa settimana</p><div class="gbar" role="progressbar" aria-label="Obiettivo dell'equipaggio" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(tot,goal)}"><i style="width:${(pct*100).toFixed(1)}%"></i></div>
   ${done?`<p class="party">🏅 Obiettivo raggiunto: +${E.xp} XP a testa.</p>`:''}<p class="mut">${E.per_membro} contributi per membro. Il tuo contributo: <b>${mineN}</b> (lo vedi solo tu). Un contributo è una struttura di ${esc(pl.nome)} che porti a maestria 2 o che ripassi in tempo. Si azzera lunedì.</p></div>`;}
 const share=typeof navigator!=='undefined'&&navigator.share?`<button class="chip" data-so="share" data-c="${esc(c.codice)}" data-n="${esc(c.nome)}">Condividi</button>`:'';
 const code=`<div class="ccode"><span class="mut">Codice d'invito</span><b class="code" aria-label="Codice d'invito: ${esc(c.codice.split('').join(' '))}">${esc(c.codice)}</b><button class="chip" data-so="copy" data-c="${esc(c.codice)}">Copia</button>${share}</div>`;
 return `<div class="card crew"><div class="kick">Equipaggio · ${n} ${n===1?'membro':'membri'}</div><h3>${esc(c.nome)}</h3>${code}
  <div class="sub">Obiettivo della settimana</div>${goalH}${plSel}
  <div class="sub">Sfide</div>${SO.pk===c.id?pickerHtml(c,pl):challengesHtml(fl,c,pl,n)}
  <div class="sub">Membri</div>${members}
  <div class="chips cfoot"><button class="chip" data-so="leave" data-id="${esc(c.id)}" data-n="${esc(c.nome)}">Esci dall'equipaggio</button></div></div>`;
}
function challengesHtml(fl,c,pl,n){
 const me=A.user.id,chs=fl.ch.filter(x=>x.crew_id===c.id);
 const list=chs.map(ch=>{
  const ans=fl.ans.filter(a=>a.challenge_id===ch.id),my=ans.find(a=>a.user_id===me)?.giuste??SO.done[ch.id],mine=ch.autore===me,seen=mine||my!=null;
  const res=ans.filter(a=>a.user_id!==me).map(a=>`${esc(who(fl,a.user_id))} ${a.giuste}/5`).join(' · ');
  const names=seen?ch.strutture.map(k=>{const e=P.revEntry(k);try{return e?structName(e.sid):k;}catch(x){return k;}}).map(esc).join(', '):'';
  const when=new Date(ch.creata_il).toLocaleDateString('it',{day:'numeric',month:'short'}),chpl=planetById(ch.pianeta);
  return `<div class="chl"><p><b>${mine?'La tua sfida':'Sfida di '+esc(who(fl,ch.autore))}</b> <small class="mut">${esc(when)}${chpl?' · '+esc(chpl.nome):''}</small></p>`+
   (seen?`<p class="mut">${names}</p>`:'')+
   (mine?`<p class="mut">${res?'Risultati: '+res:'Nessuna risposta per ora.'}</p>`:my!=null?`<p>Hai fatto <b>${my}/5</b>${res?` · <span class="mut">${res}</span>`:''}</p>`:`<button class="chip on" data-so="play" data-id="${esc(ch.id)}">🎯 Rispondi alla sfida</button>`)+'</div>';}).join('');
 const can=pl&&n>=2;
 return (list||'<p class="mut">Nessuna sfida nelle ultime due settimane.</p>')+(can?`<button class="chip" data-so="pk" data-id="${esc(c.id)}"${online()?'':' disabled'}>🎯 Lancia una sfida</button><p class="mut">Scegli 5 strutture di ${esc(pl.nome)}: gli altri membri rispondono una volta sola.</p>`:'');
}
function pickerHtml(c,pl){
 const L=chKeys(pl),by=new Map(),N=FL.FR().sfida.strutture;
 for(const x of L){if(!by.has(x.sat))by.set(x.sat,[]);by.get(x.sat).push(x);}
 const full=SO.sel.length>=N;
 return `<fieldset class="pick5"><legend>Scegli ${N} strutture di ${esc(pl.nome)} · <span id="pkn" aria-live="polite">${SO.sel.length}/${N}</span></legend>`+
  [...by].map(([sat,xs],i)=>`<details${i===0?' open':''}><summary>${esc(sat.nome)}</summary>${xs.map(x=>{const on=SO.sel.includes(x.k);
   return `<label class="pk"><input type="checkbox" data-so="ck" value="${esc(x.k)}"${on?' checked':''}${full&&!on?' disabled':''}> ${esc(x.n)}</label>`;}).join('')}</details>`).join('')+
  `</fieldset><div class="chips"><button class="btn" data-so="launch" data-id="${esc(c.id)}"${SO.sel.length===N?'':' disabled'}>Lancia la sfida</button><button class="btn alt" data-so="pkx">Annulla</button></div>`;
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
// messaggi per gli errori del server (hint dei trigger in 20261123090000_dextera_flotta.sql)
const HINTS={dextera_codice:'Codice non valido: controllalo e riprova.',dextera_gia:'Sei già in questo equipaggio.',dextera_pieno:'Questo equipaggio è al completo (10 membri).',
 dextera_max_equipaggi:'Sei già in 3 equipaggi: è il massimo.',dextera_cambio:'Hai già cambiato casata in questa stagione.',dextera_vice:'Il vice deve essere un membro (e servono almeno 3 membri).',
 dextera_capo:'Solo il capo nomina il vice.',dextera_sfide:'Troppe sfide oggi in questo equipaggio: riprova domani.'};
async function act(f,okMsg){
 if(!online()){toast('Serve la connessione.');return false;}
 let ok=true;
 try{const {error}=await f();if(error)throw error;if(okMsg)toast(okMsg);}
 catch(e){ok=false;const h=Object.keys(HINTS).find(k=>((e.hint||'')+(e.message||'')).includes(k));
  toast(h?HINTS[h]:e.code==='23505'?'Siete già amici o c\'è già una richiesta tra voi.':FL.missing(e)?'Sul server manca il file della Flotta.':'Non riuscito: riprova tra poco.');}
 await loadSocial();if(SO.found&&$('sres'))$('sres').innerHTML=resHtml();
 return ok;
}
// una sfida si gioca nella scheda Palestra, con la figura del suo corso; alla fine il risultato va in coda (flotta.js) e si torna qui
function play(id){
 const fl=SO.fleet,ch=fl&&fl.ch.find(x=>x.id===id);if(!ch||!P.ready())return;
 const slots=P.slotsOf(ch.strutture);
 if(!slots.length){toast('Le strutture di questa sfida non ci sono in questa versione dell\'app: aggiornala e riprova.');return;}
 const mod=P.isNeuro(slots[0].sid)?'cervello':'corpo';
 if(app.MOD.id!==mod&&NAV.useMod)NAV.useMod(mod);
 const ok=startChallenge(slots,{label:'di '+who(fl,ch.autore),back:()=>NAV.setTab&&NAV.setTab('soc'),
  done:(g)=>{g=Math.max(0,Math.min(5,g|0));FL.F().ans.push({challenge_id:id,giuste:g});SO.done[id]=g;keep();save();}});
 if(ok&&NAV.setTab)NAV.setTab('play');
}
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Codice copiato: '+t);}catch(e){toast('Codice: '+t);}}
// gli id finiscono in un filtro di PostgREST: si accettano solo UUID, così un valore manomesso non cambia il filtro
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pair=(a,b)=>`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`;
const PLID=/^[a-z0-9-]{1,40}$/;
export function wireSocial(panel){
 panel.addEventListener('click',e=>{
  if(app.tab!=='soc')return;
  const b=e.target.closest('[data-so]');if(!b||!A.user||b.tagName==='SELECT'||b.tagName==='INPUT'||b.tagName==='FORM')return;
  const k=b.dataset.so,id=b.dataset.id,u=b.dataset.u,uid=A.user.id,sb=A.sb;
  if(id!==undefined&&!UUID.test(id))return;
  if(u!==undefined&&u!==''&&!UUID.test(u))return;
  if(k==='tab'){SO.tab=b.dataset.v;SO.pick=null;SO.chg=false;SO.pk=null;keep();renderSocial();loadSocial();}
  else if(k==='pick'){SO.pick=SO.pick===id?null:id;renderSocial();}
  else if(k==='ask')act(()=>sb.from('friendships').insert({user_id:uid,friend_id:id}),'Richiesta inviata.');
  else if(k==='acc')act(()=>sb.from('friendships').update({status:'accepted'}).eq('user_id',id).eq('friend_id',uid),'Ora siete amici.');
  else if(k==='del')act(()=>sb.from('friendships').delete().or(pair(uid,id)));
  else if(k==='rm'&&confirm(`Togliere ${b.dataset.n} dagli amici?`))act(()=>sb.from('friendships').delete().or(pair(uid,id)),'Amicizia tolta.');
  // casate
  else if(k==='chg'){SO.chg=!SO.chg;renderSocial();}
  else if(k==='house'){const h=SO.fleet?.k.find(x=>x.id===b.dataset.h);if(!h)return;
   if(confirm(`Passare a ${h.nome}? Si può cambiare una volta per stagione; i punti già fatti restano alla casata di prima.`)){SO.chg=false;
    act(()=>sb.from('constellation_members').update({constellation_id:h.id}).eq('user_id',uid),'Ora sei in '+h.nome+'!').then(()=>A.sb&&FL.ensureCasata(A.sb,uid).then(redraw,()=>{}));}}
  // equipaggi
  else if(k==='copy')copy(b.dataset.c);
  else if(k==='share')navigator.share({title:'Dextera',text:`Entra nel mio equipaggio «${b.dataset.n}» su Dextera: apri la scheda Flotta → Equipaggi e scrivi il codice ${b.dataset.c}`}).catch(()=>{});
  else if(k==='leave'&&confirm(`Uscire dall'equipaggio «${b.dataset.n}»?`))act(()=>sb.from('crew_members').delete().eq('crew_id',id).eq('user_id',uid),'Hai lasciato l\'equipaggio.');
  else if(k==='kick'&&u&&confirm(`Togliere ${b.dataset.n||'questo membro'} dall'equipaggio?`))act(()=>sb.from('crew_members').delete().eq('crew_id',id).eq('user_id',u),'Membro tolto.');
  else if(k==='vice')act(()=>sb.from('crews').update({vice:u||null}).eq('id',id),u?'Nuovo vice nominato.':'Vice tolto.');
  else if(k==='pk'){SO.pk=id;SO.sel=[];renderSocial();}
  else if(k==='pkx'){SO.pk=null;SO.sel=[];renderSocial();}
  else if(k==='launch'){const c=SO.fleet?.crews.find(x=>x.id===id),N=FL.FR().sfida.strutture;if(!c||SO.sel.length!==N)return;const st=SO.sel.slice();
   act(()=>sb.from('crew_challenges').insert({crew_id:id,pianeta:c.pianeta,strutture:st}),'Sfida lanciata: ora tocca agli altri.').then(ok=>{if(ok){SO.pk=null;SO.sel=[];redraw();}});}
  else if(k==='play')play(id);
 });
 panel.addEventListener('keydown',e=>{if(app.tab!=='soc'||(e.key!=='Enter'&&e.key!==' '))return;const r=e.target.closest('.lb[data-so="pick"]');if(r&&e.target===r){e.preventDefault();r.click();}});
 panel.addEventListener('change',e=>{
  if(app.tab!=='soc'||!A.user)return;const t=e.target,k=t.dataset&&t.dataset.so;
  if(k==='pl'){const v=PLID.test(t.value)?t.value:null;S.set={...(S.set||{}),pianeta:v,t:Date.now(),u:1};save();toast(v?`Da ora i punti di ${planetById(v)?.nome||v} valgono doppio.`:'Nessun pianeta scelto.');}
  else if(k==='cpl'){const v=PLID.test(t.value)?t.value:null;if(!UUID.test(t.dataset.id||''))return;act(()=>A.sb.from('crews').update({pianeta:v}).eq('id',t.dataset.id),'Pianeta dell\'obiettivo cambiato.');}
  else if(k==='ck'){
   const N=FL.FR().sfida.strutture;SO.sel=SO.sel.filter(x=>x!==t.value);if(t.checked&&SO.sel.length<N)SO.sel.push(t.value);else t.checked=SO.sel.includes(t.value);
   const full=SO.sel.length>=N;panel.querySelectorAll('input[data-so="ck"]').forEach(c=>{c.disabled=full&&!c.checked;});
   const n=$('pkn');if(n)n.textContent=SO.sel.length+'/'+N;const l=panel.querySelector('[data-so="launch"]');if(l)l.disabled=SO.sel.length!==N;
  }
 });
 panel.addEventListener('submit',e=>{
  if(app.tab!=='soc'||!A.user)return;const f=e.target.closest('form[data-so]');if(!f)return;e.preventDefault();
  if(f.dataset.so==='mk'){const nome=f.elements.nome.value.trim(),pl=PLID.test(f.elements.pianeta.value)?f.elements.pianeta.value:null;
   if(nome.length<3||nome.length>30){toast('Il nome va da 3 a 30 caratteri.');return;}
   act(()=>A.sb.from('crews').insert({nome,pianeta:pl}),'Equipaggio creato: condividi il codice d\'invito.').then(ok=>{if(ok){SO.tab='crews';keep();}});}
  else if(f.dataset.so==='join'){const c=f.elements.codice.value.trim().toUpperCase();
   if(!/^[A-HJ-NP-Z2-9]{6}$/.test(c)){toast('Il codice ha 6 caratteri: lettere e numeri (senza 0, 1, I, O).');return;}
   act(()=>A.sb.from('crew_members').insert({user_id:A.user.id,codice:c}),'Ora fai parte dell\'equipaggio!');}
 });
 panel.addEventListener('input',e=>{if(app.tab!=='soc'||e.target.id!=='soq')return;const v=e.target.value;clearTimeout(qTimer);qTimer=setTimeout(()=>search(v),300);});
}
// dopo l'accesso: si scaricano subito le richieste (per il pallino sulla scheda); uscendo si toglie tutto
let lastUid=null;
export function socialAccountChanged(){
 const u=A.user&&A.user.id;
 if(u!==lastUid){lastUid=u;if(u&&A.sb)loadSocial();else navDot();}
 if(!u&&SO.uid){SO.all=[];SO.friends=[];SO.rel={fr:[],inc:[],out:[]};SO.uid=null;SO.fleet=null;SO.done={};keep();}
 if(isOpen())renderSocial();
}
