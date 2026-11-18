/* Percorso guidato (fase 1): regole e stato, senza disegno. Tutto si calcola sul telefono, anche offline.
   - Mappa delle competenze in app.MAPPA (content/mappa.json), percorso pubblicato in app.PERCORSO (content/percorsi/base.json),
     numeri in app.REGOLE (content/regole.json), dati delle lezioni in app.LEZ (content/lezioni.json, generato da testi.py).
   - Maestria per aspetto (sezione 2 della specifica): ossa 'o.femur' e reperi 'r.…' (nome e posizione, la stessa chiave della
     Palestra), muscoli 'm.<id>' (nome), 'oi.<id>' (origine e inserzione), 'fn.<id>' (funzione).
   - S.path: nodes {id: {stato, stelle, fatto_il, u}} (u = da inviare a path_progress), last (ultimo satellite usato),
     prova {passo: giorno dell'ultima prova «Lo so già»}, prio {passo: strutture sbagliate nella prova, da cui partono le lezioni}.
   - S.mmax {chiave: livello più alto raggiunto} per il +5 XP della prima volta; S.seen {chiave: ms} per le più vecchie.
   - Giorno, obiettivo e serie: S.day {d, xp, goal}, S.lastXp, S.shields, S.set {obiettivo, t, u} (va in dextera_settings). */
import {app,S,onBeforeSave,ymd} from './state.js';
import {flaggedIds} from './segnala.js';

export const R=()=>app.REGOLE;
export const ready=()=>!!(app.MAPPA&&app.REGOLE&&app.PERCORSO&&app.LEZ&&app.MODS.corpo);
const corpo=()=>app.MODS.corpo;
export const today=()=>ymd(new Date());

/* ---------- percorso e mappa ---------- */
export const corso=()=>app.MAPPA.corsi.find(c=>c.id===app.PERCORSO.corso)||app.MAPPA.corsi[0];
const pnode=id=>app.PERCORSO.nodi.find(n=>n.id===id);
// pianeti e satelliti del percorso, nell'ordine consigliato (ordine del percorso pubblicato)
export function pianeti(){
 const ord=id=>pnode(id)?.ordine??99;
 return corso().pianeti.filter(p=>pnode(p.id)).slice().sort((a,b)=>ord(a.id)-ord(b.id));
}
export function satelliti(p){
 const ord=id=>pnode(id)?.ordine??99;
 return (p?p.satelliti:pianeti().flatMap(x=>x.satelliti)).filter(s=>pnode(s.id)).slice().sort((a,b)=>ord(a.id)-ord(b.id));
}
export const satById=id=>pianeti().flatMap(p=>p.satelliti).find(s=>s.id===id);
export const planetOf=sat=>pianeti().find(p=>p.satelliti.includes(sat));
// passi del satellite inclusi nel percorso (i passi 'salta' della mappa non ci sono)
export const passi=sat=>{const inc=pnode(sat.id)?.passi;return sat.passi.filter(ps=>!ps.salta&&(!inc||inc.includes(ps.id)));};
export const casoOf=sat=>{const c=pnode(sat.id)?.caso;return c?corpo().CASES.find(x=>x.id===c)||null:null;};

/* ---------- strutture, chiavi e dati ---------- */
export const bone=id=>corpo().byId[id];
export const muscle=id=>corpo().M.find(m=>m.id===id);
export const rep=id=>app.LEZ.reperi[id];
// chiave della maestria di una struttura nell'aspetto di un passo
export function key(sid,asp){
 if(asp==='oi')return 'oi.'+sid;if(asp==='fn')return 'fn.'+sid;
 return sid.startsWith('o.')||sid.startsWith('r.')?sid:'m.'+sid;
}
export const mastery=k=>S.mastery[k]||0;
// campi di testi/ che una domanda usa, per tipo di passo (etichetta di verifica e «Segnala un errore»)
export const CAMPI={ossa:['nome','latino','descrizione'],reperi:['nome','latino','descrizione'],muscoli:['nome','latino','azione'],
 connessioni:['origine','inserzione'],funzione:['azione','nome']};
export const voce=sid=>app.LEZ.voci[sid]||null;
export const dataIds=(sid,tipo)=>{const v=voce(sid);return v?(CAMPI[tipo]||[]).map(c=>v+'.'+c):[];};
const stato=d=>app.LEZ.stati[d]||['da verificare'];
// «Verificato il …» solo se tutti i dati della domanda sono verificati o corretti da un docente; altrimenti «da verificare»
export function verifica(ids){
 if(!ids.length)return {ok:false,txt:'da verificare'};
 const st=ids.map(stato);
 if(st.every(s=>s[0]==='verificato'||s[0]==='corretto')){const q=st.map(s=>s[1]||'').sort().pop();return {ok:true,txt:q?'Verificato il '+itDate(q):'Verificato'};}
 return {ok:false,txt:'da verificare'};
}
export const itDate=s=>{const [y,m,d]=String(s).slice(0,10).split('-');return d&&m&&y?`${+d}/${+m}/${y}`:s;};
// Struttura fuori dalle lezioni: un suo dato è «segnalato» in testi/ oppure è stato segnalato da due persone dopo l'ultima verifica
export function excluded(sid,tipo){
 const fl=flaggedIds();
 return dataIds(sid,tipo).some(d=>{const s=stato(d);if(s[0]==='segnalato')return true;const f=fl[d];return !!f&&!(s[1]&&s[1]>=String(f).slice(0,10));});
}
// strutture usabili di un passo: esistono nei contenuti 2D (o tra i reperi) e hanno i dati che servono alle domande
export function usable(ps){
 if(!Array.isArray(ps.strutture))return [];
 return ps.strutture.filter(sid=>{
  if(ps.tipo==='ossa')return !!bone(sid);
  if(ps.tipo==='reperi')return !!rep(sid);
  const m=muscle(sid);if(!m)return false;
  if(ps.tipo==='connessioni')return !!(m.o&&m.i);
  if(ps.tipo==='funzione')return !!m.a;
  return true;
 }).filter(sid=>!excluded(sid,ps.tipo));
}

/* ---------- stato dei nodi ---------- */
const P=()=>S.path||(S.path={nodes:{},last:'',prova:{},prio:{}});
export const node=id=>P().nodes[id]||null;
// salva lo stato di un nodo tenendo il valore più avanzato (stato e stelle più alti, prima data di completamento)
export function setNode(id,o){
 const n=P().nodes[id]||{stato:'',stelle:0,fatto_il:null};
 const rank=s=>({'':0,iniziato:1,fatto:2,acceso:3}[s||'']||0);
 const out={stato:rank(o.stato)>rank(n.stato)?o.stato:n.stato,stelle:Math.max(n.stelle||0,o.stelle||0),fatto_il:n.fatto_il||o.fatto_il||null};
 if(out.stato!==n.stato||out.stelle!==n.stelle||out.fatto_il!==n.fatto_il){out.u=1;P().nodes[id]=out;}
 return out;
}
const dones=new Set(['fatto','acceso']);
// Passo fatto: tutte le sue strutture almeno a maestria 2 nell'aspetto del passo (guadagnata ovunque); un passo fatto resta fatto.
export function stepDone(ps){
 if(dones.has(node(ps.id)?.stato))return true;
 if(ps.tipo==='progetto')return false;
 const L=usable(ps);
 return L.every(sid=>mastery(key(sid,ps.aspetto))>=R().maestria.passo_fatto);
}
export const stepOpen=(sat,ps)=>{const L=passi(sat),i=L.indexOf(ps);return i<=0||L.slice(0,i).every(stepDone);};
// quota delle strutture del passo già a maestria 2 (per la barra del passo)
export function stepPct(ps){const L=usable(ps);if(!L.length)return 1;return L.filter(sid=>mastery(key(sid,ps.aspetto))>=R().maestria.passo_fatto).length/L.length;}
// stati di un satellite (sezione 4): da iniziare, in orbita, acceso. Brillante e da ripassare arrivano con il ripasso (fase 2).
export function satState(sat){
 if(node(sat.id)?.stato==='acceso'||passi(sat).every(stepDone))return 'acceso';
 return passi(sat).some(stepDone)?'orbita':'nuovo';
}
export const STATI={nuovo:'Da iniziare',orbita:'In orbita',acceso:'Acceso'};
// Controlla i passi che sono diventati fatti (anche con la Palestra) e dà gli XP di progresso una volta sola. Ritorna i premi.
export function checkProgress(){
 if(!ready())return [];
 const out=[],X=R().xp,now=new Date().toISOString();
 for(const sat of satelliti()){
  for(const ps of passi(sat)){
   if(ps.tipo==='progetto')continue;
   if(!dones.has(node(ps.id)?.stato)&&stepDone(ps)){setNode(ps.id,{stato:'fatto',fatto_il:now});gain(X.passo_fatto,true);out.push({t:'passo',sat,ps,xp:X.passo_fatto});}
  }
  if(node(sat.id)?.stato!=='acceso'&&passi(sat).every(stepDone)){setNode(sat.id,{stato:'acceso',fatto_il:now});gain(X.satellite_acceso,true);out.push({t:'satellite',sat,xp:X.satellite_acceso});}
  else if(!node(sat.id)&&passi(sat).some(stepDone))setNode(sat.id,{stato:'iniziato'});
 }
 return out;
}
// XP: quelli di progresso (passo fatto, satellite acceso, livello nuovo) si contano a parte per le classifiche della fase 4
export function gain(n,progress){S.xp+=n;if(progress)S.pxp=(S.pxp||0)+n;}

/* ---------- stella guida e «Continua» ---------- */
// prossimo passo consigliato: l'ultimo satellite usato se non è acceso, altrimenti il primo non acceso nell'ordine del percorso
export function guide(){
 const L=satelliti();const last=satById(P().last);
 const sat=(last&&satState(last)!=='acceso')?last:L.find(s=>satState(s)!=='acceso')||L[0];
 const ps=passi(sat).find(p=>!stepDone(p))||passi(sat).at(-1);
 return {sat,ps};
}
export const setLast=id=>{P().last=id;};
export const provaOggi=id=>P().prova[id]===today();
export const setProva=id=>{P().prova[id]=today();};
export const prio=id=>P().prio[id]||[];
export const setPrio=(id,l)=>{if(l&&l.length)P().prio[id]=l;else delete P().prio[id];};

/* ---------- giorno: XP del giorno, obiettivo e serie con gli scudi (sezione 6) ---------- */
export const goal=()=>{const s=S.set||{},sc=R()?.obiettivo;return (s.obiettivo&&sc&&sc.scelte.includes(s.obiettivo))?s.obiettivo:(sc?.predefinito||60);};
export function setGoal(v){S.set={...(S.set||{}),obiettivo:v,t:Date.now(),u:1};}
const dayNum=s=>{const [y,m,d]=s.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/864e5);};
// Prima di ogni salvataggio: gli XP guadagnati da allora vanno al giorno di oggi; con l'obiettivo raggiunto +10 XP una volta;
// con almeno 30 XP nel giorno il giorno vale per la serie (un giorno saltato consuma uno scudo; uno scudo ogni 7 giorni).
function dayTick(){
 const t=today(),Rg=R();
 if(!S.day||S.day.d!==t)S.day={d:t,xp:0,goal:false};
 if(S.lastXp==null)S.lastXp=S.xp;
 const dx=S.xp-S.lastXp;if(dx>0)S.day.xp+=dx;S.lastXp=S.xp;
 if(!Rg)return;
 if(!S.day.goal&&S.day.xp>=goal()){S.day.goal=true;S.xp+=Rg.xp.obiettivo;S.lastXp=S.xp;S.day.xp+=Rg.xp.obiettivo;}
 if(S.day.xp>=Rg.serie.xp_giorno&&S.last!==t){
  const gap=S.last?dayNum(t)-dayNum(S.last)-1:0,sh=S.shields||0;
  if(S.last&&gap===0)S.streak=(S.streak||0)+1;
  else if(S.last&&gap>0&&gap<=sh){S.shields=sh-gap;S.streak=(S.streak||0)+1;S.set={...(S.set||{}),t:Date.now(),u:1};}
  else S.streak=1;
  S.last=t;
  if(S.streak%Rg.serie.scudo_ogni===0&&(S.shields||0)<Rg.serie.scudi_max){S.shields=(S.shields||0)+1;S.set={...(S.set||{}),t:Date.now(),u:1};}
 }
}
onBeforeSave(dayTick);
