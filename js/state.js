/* Stato condiviso dell'app e salvataggio locale. */
import {$} from './util.js';

// Modulo e partita correnti. MODS e NC arrivano da content/ all'avvio.
// B: strutture singole; GR: gruppi; view: vista mostrata ('a' anteriore, 'ld' laterale destra… oppure una vista di zona come
// 'mp' mano palmare, che i giochi usano per poco); bases: per ogni modulo la vista scelta nel menu; grp: si gioca per gruppi
export const app={MODS:{},NC:[],MOD:null,B:[],GR:[],M:[],CASES:[],VB:{x:0,y:0,w:300,h:640},tab:'path',av:'2d',sel:null,G:null,view:'a',bases:{},grp:false};
try{const o=JSON.parse(localStorage.getItem('dextera-2d')||'{}');app.grp=!!o.grp;app.bases=o.bases||{};}catch(e){}
export const saveGrp=()=>{try{localStorage.setItem('dextera-2d',JSON.stringify({grp:app.grp,bases:app.bases}));}catch(e){}};
export const bone=id=>app.MOD&&app.MOD.byId[id];
// voci dei giochi e dell'elenco: le singole o i gruppi, secondo la modalità scelta
export const items=()=>app.grp?app.GR:app.B;
// membri singoli di una voce (una singola è membro di sé stessa)
export const members=id=>{const b=bone(id);return b?(b.group?b.m:[id]):[];};
// voce corrispondente a una struttura singola toccata: lei stessa, o il suo gruppo principale (lobo, gruppo di ossa)
export const itemOf=sid=>app.grp?(bone(sid)?.g||sid):sid;
// insieme delle voci che vanno bene per un elenco di ossa (origini o inserzioni di un muscolo)
export const itemSet=ids=>new Set(ids.filter(Boolean).map(itemOf));
// nome di un elenco di ossa: se c'è un gruppo intero (es. tutte le coste) si usa il nome del gruppo
export function bonesName(ids){
 ids=ids.filter(Boolean);const out=[],used=new Set();
 for(const g of app.GR)if(!g.area&&g.m.length>1&&g.m.every(x=>ids.includes(x))){out.push(g.n);g.m.forEach(x=>used.add(x));}
 for(const id of ids)if(!used.has(id)&&bone(id))out.push(bone(id).n);
 return out.join(', ');
}

const KEY='dextera-v1';
// stats: partite finite (per i badge); badges: {id: data}; prof: profilo locale (nome, ruolo, bio, foto, t = ultima modifica)
// owner: {uid, email} dell'account a cui appartengono questi progressi (dopo la prima sincronizzazione); senza, sono da ospite
const blank=()=>({xp:0,streak:0,last:'',mastery:{},ok:0,ko:0,stats:{games:0,perfect:0,modes:{},mods:{}},badges:{},prof:{}});
export const S=blank();
try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){}
// riparte da zero sul dispositivo (si entra con un altro account e si sceglie di usare i suoi progressi); niente invio
export function resetLocal(){
 for(const k of Object.keys(S))delete S[k];Object.assign(S,blank());
 try{localStorage.setItem(KEY,JSON.stringify(S));localStorage.removeItem(QKEY);localStorage.removeItem('dextera-segnalazioni');}catch(e){}
}
// dopo ogni salvataggio l'account (se c'è) invia i progressi: account.js registra la funzione, qui niente import circolari
// prima di ogni salvataggio: conti del giorno (XP, obiettivo, serie) in percorso.js
const afterSave=[],beforeSave=[];export const onSave=f=>{afterSave.push(f);};export const onBeforeSave=f=>{beforeSave.push(f);};
export const save=()=>{beforeSave.forEach(f=>f());try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}afterSave.forEach(f=>f());};
// partite finite in attesa di invio al server (solo con un account; senza account restano qui e non vanno da nessuna parte)
const QKEY='dextera-queue';
export const queue={
 all(){try{return JSON.parse(localStorage.getItem(QKEY)||'[]');}catch(e){return [];}},
 set(a){try{localStorage.setItem(QKEY,JSON.stringify(a.slice(-500)));}catch(e){}},
 add(r){recordGame(r);const a=queue.all();a.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),played_at:new Date().toISOString(),...r});queue.set(a);}
};
// statistiche delle partite finite, per i badge (js/badges.js)
function recordGame(r){
 const s=S.stats;s.games=(s.games||0)+1;if(r.total>0&&r.score===r.total)s.perfect=(s.perfect||0)+1;
 const k=r.module==='3d'?'3d:'+r.mode:r.mode;(s.modes||(s.modes={}))[k]=(s.modes[k]||0)+1;(s.mods||(s.mods={}))[r.module]=1;
}
export const ymd=d=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
// La serie si calcola prima di ogni salvataggio (dayTick in percorso.js): un giorno vale con almeno 30 XP (sezione 6).
// Resta per i giochi che la chiamavano a ogni risposta.
export function touchStreak(){}
const TITLES=['Matricola','Tirocinante','Studente di fisio','Terapista junior','Terapista esperto','Maestro di anatomia'];
export const level=()=>{const L=Math.floor(Math.sqrt(S.xp/30))+1;return {L,title:TITLES[Math.min(TITLES.length-1,L-1)]};};
// foto (o iniziale) in alto a sinistra: apre il Profilo
function meBtn(){const b=$('me'),p=S.prof||{},src=p.avatar||'';if(b.dataset.src===src+'|'+(p.name||''))return;b.dataset.src=src+'|'+(p.name||'');
 b.replaceChildren();if(src){const i=document.createElement('img');i.src=src;i.alt='';b.append(i);}else b.textContent=((p.name||'').trim().charAt(0)||'👤').toUpperCase();}
export function head(){meBtn();const {L,title}=level(),a=30*(L-1)**2,b=30*L**2;
 {const e=$('lv'),b=document.createElement('b'),t=document.createElement('small');b.textContent='Liv. '+L;t.textContent=title;e.replaceChildren(b,t);e.title='Livello '+L+' · '+title;}
 $('xpb').style.width=((S.xp-a)/(b-a)*100)+'%';$('st').textContent='🔥 '+S.streak+'  ⭐ '+S.xp;}
// dopo ogni risposta dei giochi: il ripasso (percorso.js) la conta come richiamo
const bumpHooks=[];export const onBump=f=>{bumpHooks.push(f);};
export const bump=(id,d)=>{if(!id)return;S.mastery[id]=Math.max(0,Math.min(3,(S.mastery[id]||0)+d));bumpHooks.forEach(f=>f(id,d));};
