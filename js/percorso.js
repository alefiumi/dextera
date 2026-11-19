/* Percorso guidato (fase 1): regole e stato, senza disegno. Tutto si calcola sul telefono, anche offline.
   - Mappa delle competenze in app.MAPPA (content/mappa.json), percorso pubblicato in app.PERCORSO (content/percorsi/base.json),
     numeri in app.REGOLE (content/regole.json), dati delle lezioni in app.LEZ (content/lezioni.json, generato da testi.py).
   - Maestria per aspetto (sezione 2 della specifica): ossa 'o.femur' e reperi 'r.…' (nome e posizione, la stessa chiave della
     Palestra), muscoli 'm.<id>' (nome), 'oi.<id>' (origine e inserzione), 'fn.<id>' (funzione).
   - S.path: nodes {id: {stato, stelle, fatto_il, u}} (u = da inviare a path_progress), last (ultimo satellite usato),
     prova {passo: giorno dell'ultima prova «Lo so già»}, prio {passo: strutture sbagliate nella prova, da cui partono le lezioni}.
   - S.mmax {chiave: livello più alto raggiunto} per il +5 XP della prima volta; S.seen {chiave: ms} per le più vecchie.
   - Giorno, obiettivo e serie: S.day {d, xp, goal, rip}, S.lastXp, S.shields, S.set {obiettivo, date_esame, t, u} (va in dextera_settings).
   - Ripasso (fase 2, sezione 5): S.rev {chiave: {i, due, t, u}} (i = indice dell'intervallo, due = giorno 'AAAA-MM-GG' in cui torna,
     t = ms dell'ultimo ripasso, u = da inviare a review_items); S.revDay {d, keys} = ripassi scelti per oggi (al massimo 10, i più in ritardo). */
import {app,S,onBeforeSave,onBump,ymd} from './state.js';
import {flaggedIds} from './segnala.js';

export const R=()=>app.REGOLE;
export const ready=()=>!!(app.MAPPA&&app.REGOLE&&app.PERCORSO&&app.LEZ&&app.MODS.corpo);
const corpo=()=>app.MODS.corpo;
export const today=()=>ymd(new Date());

/* ---------- percorso e mappa ---------- */
/* Più corsi (rilascio 2 della neurologia): il percorso pubblicato contiene i nodi di tutti i corsi; corso() è quello aperto nella
   scheda Percorso (setCorso), il corso del percorso pubblicato (muscolo-scheletrico) se non se ne è scelto un altro.
   Calendario dei ripassi, passi fatti e stati valgono per tutti i corsi; Palestra per zone solo per il corso del corpo (corpoCorso). */
const pnode=id=>app.PERCORSO.nodi.find(n=>n.id===id);
export const corsi=()=>app.MAPPA.corsi.filter(c=>pnode(c.id)).sort((a,b)=>(pnode(a.id).ordine??99)-(pnode(b.id).ordine??99));
export const corpoCorso=()=>app.MAPPA.corsi.find(c=>c.id===app.PERCORSO.corso)||app.MAPPA.corsi[0];
let CUR='';
export const setCorso=id=>{CUR=id||'';};
export const corso=()=>app.MAPPA.corsi.find(c=>c.id===CUR&&pnode(c.id))||corpoCorso();
// pianeti e satelliti del percorso, nell'ordine consigliato (ordine del percorso pubblicato)
export function pianeti(c=corso()){
 const ord=id=>pnode(id)?.ordine??99;
 return c.pianeti.filter(p=>pnode(p.id)).slice().sort((a,b)=>ord(a.id)-ord(b.id));
}
export function satelliti(p,c){
 const ord=id=>pnode(id)?.ordine??99;
 return (p?p.satelliti:pianeti(c).flatMap(x=>x.satelliti)).filter(s=>pnode(s.id)).slice().sort((a,b)=>ord(a.id)-ord(b.id));
}
const allPl=()=>corsi().flatMap(c=>pianeti(c));
export const satById=id=>allPl().flatMap(p=>p.satelliti).find(s=>s.id===id);
export const planetOf=sat=>allPl().find(p=>p.satelliti.includes(sat));
export const corsoOf=x=>app.MAPPA.corsi.find(c=>c.pianeti.includes(x)||c.pianeti.some(p=>p.satelliti.includes(x)))||corpoCorso();
// corso di neurologia: strutture 'n.<voce>' con i testi in app.LEZ.neuro e i casi in app.LEZ.casi_neuro
export const isNeuro=sid=>String(sid).startsWith('n.');
export const neuro=sid=>app.LEZ.neuro?.[sid]||null;
const casesOf=c=>c.modulo==='corpo'?corpo().CASES:c.modulo==='cervello'?(app.LEZ.casi_neuro||[]):[];
const caseIn=(c,id)=>casesOf(c).find(x=>x.id===id)||null;
export const caseAns=c=>c?.mid||c?.bid||null;
// strutture del cervello 2D di una voce di neurologia (id b.* o gruppi g:<gruppo>, che valgono per tutti i loro membri)
export function nfig(sid){
 const M=app.MODS.cervello;if(!M)return [];
 return [...new Set((neuro(sid)?.fig||[]).flatMap(x=>x.startsWith('g:')?(M.byId[x.slice(2)]?.m||[]):[x]))].filter(id=>M.byId[id]);
}
// passi del satellite inclusi nel percorso (i passi 'salta' della mappa non ci sono)
export const passi=sat=>{const inc=pnode(sat.id)?.passi;return sat.passi.filter(ps=>!ps.salta&&(!inc||inc.includes(ps.id)));};
export const casoOf=sat=>{const c=pnode(sat.id)?.caso;return c?caseIn(corsoOf(sat),c):null;};
// caso clinico dell'esame del pianeta (fase 2): quello scelto nel percorso pubblicato (esame.caso, dal gestionale), altrimenti
// in automatico i casi la cui risposta è un muscolo (o una struttura del corso di neurologia) del pianeta
export function esameCasi(pl){
 const co=corsoOf(pl),c=pnode(pl.id)?.esame?.caso;if(c){const x=caseIn(co,c);if(x)return [x];}
 const ms=new Set(pl.satelliti.flatMap(s=>s.passi.flatMap(ps=>Array.isArray(ps.strutture)?ps.strutture:[])));
 return casesOf(co).filter(k=>caseAns(k)&&ms.has(caseAns(k)));
}

/* ---------- strutture, chiavi e dati ---------- */
export const bone=id=>corpo().byId[id];
export const muscle=id=>corpo().M.find(m=>m.id===id);
export const rep=id=>app.LEZ.reperi[id];
// chiave della maestria di una struttura nell'aspetto di un passo
// neurologia: 'n.<voce>' (nome e posizione), 'nd.' (dove si trova), 'nf.' (funzione), 'nl.' (lesione), 'nc.' (connessioni e vie)
const NK={dove:'nd.',fn:'nf.',lesione:'nl.',vie:'nc.'};
export function key(sid,asp){
 if(isNeuro(sid))return NK[asp]?NK[asp]+sid.slice(2):sid;
 if(asp==='oi')return 'oi.'+sid;if(asp==='fn')return 'fn.'+sid;
 return sid.startsWith('o.')||sid.startsWith('r.')?sid:'m.'+sid;
}
export const mastery=k=>S.mastery[k]||0;
// campi di testi/ che una domanda usa, per tipo di passo (etichetta di verifica e «Segnala un errore»)
export const CAMPI={ossa:['nome','latino','descrizione'],reperi:['nome','latino','descrizione'],muscoli:['nome','latino','azione'],
 connessioni:['origine','inserzione'],funzione:['azione','nome']};
export const NCAMPI={strutture:['nome','dove'],dove:['dove','nome'],funzione:['funzione','nome'],lesione:['lesione','nome'],connessioni:['connessioni','nome']};
// campo del testo di neurologia per tipo di passo (n, d, f, le, c in content/lezioni.json)
export const NCAMPO={strutture:'n',dove:'d',funzione:'f',lesione:'le',connessioni:'c'};
export const voce=sid=>app.LEZ.voci[sid]||null;
export const dataIds=(sid,tipo)=>{const v=voce(sid);return v?((isNeuro(sid)?NCAMPI:CAMPI)[tipo]||[]).map(c=>v+'.'+c):[];};
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
  if(isNeuro(sid)){const n=neuro(sid),f=NCAMPO[ps.tipo];return !!(n&&f&&n[f]);}
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
export const STATI={nuovo:'Da iniziare',orbita:'In orbita',acceso:'Acceso',ripassare:'Da ripassare',brillante:'Brillante'};
export const lit=sat=>satState(sat)==='acceso';
// aspetto sulla mappa: un satellite acceso può essere «da ripassare» (luce sotto il 70%) o «brillante» (tutto a 30 giorni o più)
export function look(sat){
 const st=satState(sat);if(st!=='acceso')return st;
 const ks=satKeys(sat);if(!ks.length)return st;
 const od=overdue(),n=ks.filter(k=>od.has(k)).length,Rr=R().ripasso;
 if(1-n/ks.length<Rr.luce_min)return 'ripassare';
 if(!n&&ks.every(k=>RV()[k]&&INT()[RV()[k].i]>=Rr.brillante_giorni))return 'brillante';
 return st;
}
export const light=sat=>{const ks=satKeys(sat);if(!ks.length)return 1;const od=overdue();return 1-ks.filter(k=>od.has(k)).length/ks.length;};
// Controlla i passi che sono diventati fatti (anche con la Palestra) e dà gli XP di progresso una volta sola. Ritorna i premi.
export function checkProgress(){
 if(!ready())return [];
 const out=[],X=R().xp,now=new Date().toISOString();
 for(const sat of corsi().flatMap(c=>satelliti(null,c))){
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
// (con dei ripassi da fare oggi la stella guida va prima sul «Ripasso del giorno»: lo decide path.js con dailyLeft())
export function guide(){
 const L=satelliti();const last=L.find(s=>s.id===P().last);
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
 if((S.day.xp>=Rg.serie.xp_giorno||S.day.rip)&&S.last!==t){
  const gap=S.last?dayNum(t)-dayNum(S.last)-1:0,sh=S.shields||0;
  if(S.last&&gap===0)S.streak=(S.streak||0)+1;
  else if(S.last&&gap>0&&gap<=sh){S.shields=sh-gap;S.streak=(S.streak||0)+1;S.set={...(S.set||{}),t:Date.now(),u:1};}
  else S.streak=1;
  S.last=t;
  if(S.streak%Rg.serie.scudo_ogni===0&&(S.shields||0)<Rg.serie.scudi_max){S.shields=(S.shields||0)+1;S.set={...(S.set||{}),t:Date.now(),u:1};}
 }
}
onBeforeSave(()=>{ensureRev();dayTick();});

/* ---------- ripasso a intervalli (sezione 5) ----------
   Una struttura entra nel calendario quando arriva a maestria 2 (nell'aspetto del passo: 'o.femur', 'm.…', 'oi.…', 'fn.…').
   Intervalli 1, 3, 7, 14, 30, 60 giorni (poi resta a 60). Una risposta di richiamo giusta (lezione, Palestra, prova, ripasso)
   vale come ripasso se la struttura scade entro 1 giorno: passa all'intervallo successivo. Una risposta sbagliata la riporta a
   1 giorno (la maestria scende di 1 dove si gioca). Con una data d'esame sul pianeta gli intervalli si accorciano: ogni struttura
   ha almeno 2 ripassi prima della data. Numeri in regole.json, «ripasso». */
const RV=()=>S.rev||(S.rev={});
const INT=()=>R()?.ripasso?.intervalli||[1,3,7,14,30,60];
const tdn=()=>dayNum(today());
const isoDay=n=>new Date(n*864e5).toISOString().slice(0,10);
export const dueDay=r=>dayNum(r.due);
let KI=null,KIm=null,KIp=null;
// indice delle chiavi del percorso: chiave → {sid, ps, sat, pls (id dei pianeti)}; satellite → chiavi
function kidx(){
 if(KI&&KIm===app.MAPPA&&KIp===app.PERCORSO)return KI;
 KI={k:new Map(),s:new Map()};KIm=app.MAPPA;KIp=app.PERCORSO;
 for(const p of allPl())for(const sat of satelliti(p)){
  const ks=[];
  for(const ps of passi(sat)){if(ps.tipo==='progetto'||!Array.isArray(ps.strutture))continue;
   for(const sid of ps.strutture){const k=key(sid,ps.aspetto);ks.push([k,sid,ps]);
    const e=KI.k.get(k);if(e)e.pls.add(p.id);else KI.k.set(k,{sid,ps,sat,pls:new Set([p.id])});}}
  KI.s.set(sat.id,ks);
 }
 return KI;
}
// chiavi di un satellite con dati usabili (le strutture con un dato segnalato non contano)
export function satKeys(sat){const L=kidx().s.get(sat.id)||[],seen=new Set();
 return L.filter(([k,sid,ps])=>!seen.has(k)&&seen.add(k)&&usable({...ps,strutture:[sid]}).length).map(x=>x[0]);}
export const revEntry=k=>kidx().k.get(k)||null;
export const rev=k=>RV()[k]||null;
// date d'esame per pianeta {id: 'AAAA-MM-GG'}, giorni che mancano all'esame più vicino dei pianeti della chiave (null = nessuno)
export const exams=()=>(S.set&&S.set.date_esame)||{};
function examLeft(k){
 const e=revEntry(k);if(!e)return null;const t=tdn();let best=null;
 for(const p of e.pls){const d=exams()[p];if(!d)continue;const left=dayNum(d)-t;if(left>0&&(best===null||left<best))best=left;}
 return best;
}
// giorni fino al prossimo ripasso con l'intervallo i, accorciati se c'è un esame: almeno 2 ripassi prima della data
function nextGap(k,i){const n=INT()[Math.min(i,INT().length-1)],left=examLeft(k);return left===null?n:Math.max(1,Math.min(n,Math.floor(left/2)));}
const stamp=r=>{r.t=Date.now();r.u=1;};
// nuove strutture a maestria 2 → nel calendario, tornano domani
function ensureRev(){
 if(!ready())return;const t=tdn(),min=R().ripasso?.da_maestria??2;
 for(const [k] of kidx().k)if(!RV()[k]&&mastery(k)>=min){const r={i:0,due:isoDay(t+nextGap(k,0))};stamp(r);RV()[k]=r;}
}
// risposta su una struttura: true se vale come ripasso fatto (per i +2 XP del ripasso)
export function reviewAnswer(k,ok,recall=true){
 if(!ready())return false;const r=RV()[k];if(!r)return false;const t=tdn();
 if(!ok){r.i=0;r.due=isoDay(t+1);stamp(r);return false;}
 if(!recall||dueDay(r)>t+(R().ripasso?.entro_giorni??1))return false;
 r.i=Math.min(r.i+1,INT().length-1);r.due=isoDay(t+nextGap(k,r.i));stamp(r);
 return true;
}
// giochi della Palestra (Trova, Ricomponi…): ogni risposta conta come richiamo sulla chiave della struttura
onBump((id,d)=>{if(d)reviewAnswer(id,d>0,true);});
// chiavi scadute (oggi o prima) e usabili, le più in ritardo prima, a parità quelle con maestria più bassa
function dueKeys(excl){
 const t=tdn(),out=[];
 for(const [k,r] of Object.entries(RV())){if(excl.has(k)||dueDay(r)>t)continue;const e=revEntry(k);if(!e||!usable({...e.ps,strutture:[e.sid]}).length)continue;out.push(k);}
 return out.sort((a,b)=>dueDay(RV()[a])-dueDay(RV()[b])||mastery(a)-mastery(b));
}
// ripassi di oggi: scelti una volta al giorno (al massimo 10); quelli rimandati non contano come scaduti per la luce
export function daily(){
 const t=today();
 if(!S.revDay||S.revDay.d!==t)S.revDay={d:t,keys:dueKeys(new Set()).slice(0,R().ripasso.al_giorno)};
 return S.revDay;
}
const overdue=()=>{const t=tdn();return new Set(daily().keys.filter(k=>RV()[k]&&dueDay(RV()[k])<=t));};
export const dailyLeft=()=>[...overdue()];
// «Altre 10»: aggiunge ai ripassi di oggi le prossime scadute
export function moreDaily(){const d=daily(),add=dueKeys(new Set(d.keys)).slice(0,R().ripasso.altre);d.keys.push(...add);return add;}
export const moreAvail=()=>dueKeys(new Set(daily().keys)).length;
// posti {sid, ps} per una lezione di ripasso
export const slotsOf=ks=>ks.map(k=>revEntry(k)).filter(Boolean).map(e=>({sid:e.sid,ps:e.ps}));
// «Ripassa questo satellite»: le sue strutture già nel calendario, prima le scadute, poi le più deboli, poi quelle che scadono prima
export function satReview(sat){
 const t=tdn(),ks=satKeys(sat).filter(k=>RV()[k]);
 const od=k=>dueDay(RV()[k])<=t?0:1;
 return ks.sort((a,b)=>od(a)-od(b)||mastery(a)-mastery(b)||dueDay(RV()[a])-dueDay(RV()[b])).slice(0,R().ripasso.satellite);
}
// data d'esame di un pianeta ('' = nessuna): le strutture del pianeta che scadono troppo tardi si avvicinano subito
export function setExam(pid,d){
 const de={...exams()};if(d)de[pid]=d;else delete de[pid];
 S.set={...(S.set||{}),date_esame:de,t:Date.now(),u:1};
 if(!d)return;const t=tdn();
 for(const [k,r] of Object.entries(RV())){const left=examLeft(k);if(left===null)continue;const lim=t+Math.max(1,Math.floor(left/2));if(dueDay(r)>lim){r.due=isoDay(lim);stamp(r);}}
}
export const daysTo=d=>dayNum(d)-tdn();

/* ---------- esame del pianeta (fase 2, sezione 4) ----------
   Si apre con tutti i satelliti del pianeta accesi. 20 domande (almeno 3 per satellite, almeno una per tipo di passo), 60 secondi
   ciascuna, senza aiuti né cuori; poi un caso clinico senza tempo. Superato con almeno 16 giuste e il caso risolto: il nodo del
   pianeta va a 'acceso' in path_progress (titolo «Esperto di…») e +250 XP una volta sola. Numeri in regole.json, «esame».
   S.path.esami {pianeta: {keys, caso, n, best, t}}: domande e caso dell'ultimo tentativo (non si ripetono), tentativi, miglior punteggio. */
const EX=()=>P().esami||(P().esami={});
export const examMissing=pl=>satelliti(pl).filter(s=>!lit(s)).length;
export const examOpen=pl=>satelliti(pl).length>0&&examMissing(pl)===0;
export const examPassed=pl=>node(pl.id)?.stato==='acceso';
export const examLast=pl=>EX()[pl.id]||null;
// «Esperto dell'arto inferiore», «Esperto della testa e collo», «Esperto del …»; un titolo scritto nella mappa (pl.titolo) vince
export function expertTitle(pl){
 if(pl.titolo)return pl.titolo;
 const n=String(pl.nome||''),l=n.charAt(0).toLowerCase()+n.slice(1),w=l.split(' ')[0];
 return 'Esperto '+(/^[aeiouh]/.test(l)?"dell'":/a$/.test(w)?'della ':/i$/.test(w)?'delle ':'del ')+l;
}
const mix=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// domande dell'esame {sid, ps, sat}: prima quelle che non erano nell'ultimo tentativo (le altre solo se mancano strutture)
export function examSlots(pl){
 const E=R().esame,sats=satelliti(pl),TIPI=[...new Set(sats.flatMap(s=>passi(s).map(p=>p.tipo)))].filter(t=>t!=='progetto'),last=new Set(examLast(pl)?.keys||[]),seen=new Set(),all=[];
 for(const sat of sats)for(const ps of passi(sat)){if(ps.tipo==='progetto')continue;
  for(const sid of usable(ps)){const k=key(sid,ps.aspetto);if(seen.has(k))continue;seen.add(k);all.push({sid,ps,sat,k,rep:last.has(k)?1:0});}}
 const cand=mix(all).sort((a,b)=>a.rep-b.rep),out=[],cnt=new Map(),per=Math.min(E.per_satellite,Math.floor(E.domande/Math.max(1,sats.length)));
 const take=x=>{out.push(x);cand.splice(cand.indexOf(x),1);cnt.set(x.sat.id,(cnt.get(x.sat.id)||0)+1);};
 // almeno una per tipo di passo, nel satellite che ne ha meno
 for(const t of TIPI){const c=cand.filter(x=>x.ps.tipo===t).sort((a,b)=>a.rep-b.rep||(cnt.get(a.sat.id)||0)-(cnt.get(b.sat.id)||0))[0];if(c)take(c);}
 // almeno 3 per satellite
 for(const sat of sats)while((cnt.get(sat.id)||0)<per){const c=cand.find(x=>x.sat===sat);if(!c)break;take(c);}
 while(out.length<E.domande&&cand.length)take(cand[0]);
 return mix(out).map(({sid,ps,sat})=>({sid,ps,sat}));
}
// satellite del pianeta a cui appartiene la risposta del caso (per l'ipotesi «Quale distretto è coinvolto?»)
export function caseSat(pl,c){
 const L=satelliti(pl);
 return L.find(s=>s.passi.some(ps=>Array.isArray(ps.strutture)&&ps.strutture.includes(caseAns(c))))||L[0];
}
// all'inizio del tentativo: domande e caso di questo tentativo diventano «l'ultimo tentativo»
export function examStart(pl,slots,caso){
 const o=examLast(pl)||{};EX()[pl.id]={...o,keys:slots.map(s=>key(s.sid,s.ps.aspetto)),caso:caso?.id||null,n:(o.n||0)+1,t:Date.now()};
}
export function examDone(pl,ok){const o=EX()[pl.id];if(o)o.best=Math.max(o.best||0,ok);}
// superato: titolo e XP solo la prima volta (ritorna true se è la prima)
export function examPass(pl,stelle){
 const first=!examPassed(pl);
 setNode(pl.id,{stato:'acceso',stelle,fatto_il:new Date().toISOString()});
 if(first)gain(R().esame.xp,true);
 return first;
}
// i 2 satelliti più deboli: più errori in questo esame, poi luce più bassa, poi maestria media più bassa
export function weakSats(pl,res){
 const avg=s=>{const ks=satKeys(s);return ks.length?ks.reduce((a,k)=>a+mastery(k),0)/ks.length:0;};
 const err=s=>res.filter(r=>r.sat===s&&!r.ok).length;
 return satelliti(pl).slice().sort((a,b)=>err(b)-err(a)||light(a)-light(b)||avg(a)-avg(b)).slice(0,2);
}

/* ---------- Palestra per zone (fase 2, terzo rilascio): una zona della figura è un satellite ----------
   Corso delle zone: quello della figura aperta (corpo → muscolo-scheletrico, cervello → neurologia); negli altri moduli niente zone. */
export const zoneCorso=()=>{const m=app.MOD?.id;return m==='corpo'?corpoCorso():corsi().find(c=>c.modulo===m)||null;};
// nel corpo le strutture della figura sono gli id del passo; in neurologia le voci del passo «strutture» con le loro parti del cervello 2D
const zoneIds=(ps)=>ps.strutture.flatMap(x=>isNeuro(x)?nfig(x):[x]);
const zstep=c=>c&&c.modulo==='cervello'?'strutture':'ossa';
// satelliti che contengono una struttura toccata sulla figura (un osso condiviso sta in più zone): prima quelli in cui l'osso ha meno
// compagni nel passo delle ossa (il femore porta alla coscia, poi ginocchio e anca), a parità nell'ordine del percorso
export function satsOf(sid,c=corpoCorso()){
 const has=ps=>Array.isArray(ps.strutture)&&zoneIds(ps).includes(sid);
 const nb=sat=>{const ps=passi(sat).find(p=>p.tipo===zstep(c)&&has(p));return ps?zoneIds(ps).length:999;};
 return satelliti(null,c).filter(sat=>passi(sat).some(has)).map((s,i)=>({s,i,n:nb(s)})).sort((a,b)=>a.n-b.n||a.i-b.i).map(x=>x.s);
}
// strutture della figura della zona (per evidenziarla): ossa nel corpo, parti del cervello in neurologia
export const zoneBones=sat=>passi(sat).filter(ps=>ps.tipo==='ossa'||ps.tipo==='strutture').flatMap(ps=>usable(ps).flatMap(x=>isNeuro(x)?nfig(x):[x]));
// maestria media della zona (tutte le chiavi del satellite, 0–3) e quota delle chiavi viste almeno una volta
export function zoneAvg(sat){const ks=satKeys(sat);return ks.length?ks.reduce((a,k)=>a+mastery(k),0)/ks.length:0;}
const zoneSeen=sat=>satKeys(sat).some(k=>mastery(k)>0||(S.seen||{})[k]);
// zone deboli: tra quelle già cominciate le N con la maestria media più bassa; se sono meno di N, le prossime nell'ordine del percorso
export function weakZones(c=corpoCorso()){
 const n=R().palestra.zone_deboli,L=satelliti(null,c).filter(s=>satKeys(s).length),on=L.filter(zoneSeen);
 const out=on.slice().sort((a,b)=>zoneAvg(a)-zoneAvg(b)).filter(s=>zoneAvg(s)<R().maestria.max).slice(0,n);
 for(const s of L)if(out.length<n&&!out.includes(s)&&!zoneSeen(s))out.push(s);
 return out;
}

/* ---------- luce del pianeta (v0.79.0) ----------
   Da iniziare: grigio, senza alone, con un velo scuro. Durante il percorso si accende man mano (avanzamento medio dei passi).
   Dopo l'esame superato: luce piena, che si abbassa piano piano quando si avvicina il ripasso delle sue strutture (ogni struttura
   resta piena nella prima metà del suo intervallo, poi cala fino alla scadenza); non torna mai scuro come all'inizio.
   «Da ripassare» (con l'orologio) quando uno dei suoi satelliti lo è o, dopo l'esame, quando la freschezza scende sotto 1 − luce_min. Numeri in regole.json, «luce_pianeta». */
export const PSTATI={nuovo:'Da iniziare',corso:'In corso',pronto:"Pronto per l'esame",esperto:'Completato',ripassare:'Da ripassare'};
const LG=()=>({min_corso:.25,max_corso:.85,min_esperto:.45,meta_intervallo:.5,...(R()?.luce_pianeta||{})});
// freschezza delle strutture del pianeta nel calendario: 1 appena ripassate, 0 alla scadenza
export function planetFresh(pl){
 const t=tdn(),m=LG().meta_intervallo,ks=new Set(satelliti(pl).flatMap(satKeys));let n=0,sum=0;
 for(const k of ks){const r=RV()[k];if(!r)continue;const I=INT()[Math.min(r.i,INT().length-1)],left=dueDay(r)-t;
  sum+=Math.max(0,Math.min(1,left/(I*(1-m)||1)));n++;}
 return n?sum/n:1;
}
export function planetGlow(pl){
 const G=LG(),ss=satelliti(pl),ps=ss.flatMap(passi);
 const p=ps.length?ps.reduce((a,x)=>a+(stepDone(x)?1:x.tipo==='progetto'?0:stepPct(x)),0)/ps.length:0;
 const rp=ss.some(s=>look(s)==='ripassare'),lit_=ss.filter(lit).length;
 if(examPassed(pl)){const f=planetFresh(pl);return {st:rp||f<1-(R()?.ripasso?.luce_min??.7)?'ripassare':'esperto',v:G.min_esperto+(1-G.min_esperto)*f,p:1,f,lit:lit_,n:ss.length};}
 if(p<=0&&ss.every(s=>satState(s)==='nuovo'))return {st:'nuovo',v:0,p:0,lit:0,n:ss.length};
 return {st:rp?'ripassare':lit_===ss.length?'pronto':'corso',v:G.min_corso+(G.max_corso-G.min_corso)*p,p,lit:lit_,n:ss.length};
}

/* ---------- corsi nel logo di caricamento (v0.80.0) ----------
   S.logo [{id, st}] in ordine di corso: st '' (mai iniziato), 'iniziato', 'completato' (tutti i pianeti con l'esame superato).
   Calcolato prima di ogni salvataggio, così la schermata di avvio lo disegna subito, prima di caricare i contenuti (gate.js). */
function logoTick(){
 if(!ready())return;
 const on=new Set(corsi()),out=app.MAPPA.corsi.map(c=>{
  let st='';
  if(on.has(c)){const pl=pianeti(c),g=pl.map(planetGlow);if(g.length&&pl.every(examPassed))st='completato';else if(g.some(x=>x.st!=='nuovo'))st='iniziato';}
  else{const ids=new Set();for(const p of c.pianeti||[]){ids.add(p.id);for(const s of p.satelliti||[]){ids.add(s.id);for(const x of s.passi||[])ids.add(x.id);}}
   const ns=P().nodes;if((c.pianeti||[]).length&&c.pianeti.every(p=>ns[p.id]?.stato==='acceso'))st='completato';else if(Object.keys(ns).some(id=>ids.has(id)))st='iniziato';}
  return {id:c.id,st};});
 if(JSON.stringify(out)!==JSON.stringify(S.logo||null))S.logo=out;
}
onBeforeSave(logoTick);
