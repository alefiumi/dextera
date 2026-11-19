/* Badge e traguardi: calcolati sul dispositivo dopo ogni salvataggio, anche senza account.
   S.badges = {id: data ISO dell'assegnazione}. Con l'account si inviano a badge_assertions (vedi account.js).
   Gli id e i testi devono restare uguali a quelli in supabase/migrations/*_profilo_badge.sql (badge_classes); gli 8 della fase 5
   (f5: true) in supabase/migrations/20261124090000_dextera_badge.sql: finché quel file non è applicato restano sul telefono.
   title: il badge dà anche un titolo da scegliere nel profilo (vedi titoli() in progress.js). */
import {S} from './state.js';
import * as P from './percorso.js';

const mastered=()=>Object.values(S.mastery).filter(v=>v>=3).length;
const st=()=>S.stats||{};
const n3d=()=>Object.keys(st().modes||{}).filter(k=>k.startsWith('3d:')).length;
export const BADGES=[
 ['primo','🎬','Primo passo','Finisci la prima partita',()=>st().games>=1],
 ['g10','🎮','Allenamento','Finisci 10 partite',()=>st().games>=10],
 ['g100','🏋️','Instancabile','Finisci 100 partite',()=>st().games>=100],
 ['perfetto','💯','Round perfetto','Rispondi giusto a tutte le domande di un round',()=>st().perfect>=1],
 ['perfetti10','🎯','Cecchino','Fai 10 round perfetti',()=>st().perfect>=10],
 ['s3','🔥','Tre di fila','Gioca 3 giorni di seguito',()=>S.streak>=3],
 ['s7','📅','Una settimana','Gioca 7 giorni di seguito',()=>S.streak>=7],
 ['s30','🗓️','Un mese intero','Gioca 30 giorni di seguito',()=>S.streak>=30],
 ['xp500','⭐','500 XP','Raccogli 500 XP',()=>S.xp>=500],
 ['xp2000','🌟','2000 XP','Raccogli 2000 XP',()=>S.xp>=2000],
 ['xp10000','💫','10000 XP','Raccogli 10000 XP',()=>S.xp>=10000],
 ['ok100','✅','Cento risposte giuste','Dai 100 risposte giuste',()=>S.ok>=100],
 ['ok1000','🧠','Mille risposte giuste','Dai 1000 risposte giuste',()=>S.ok>=1000],
 ['m10','🥉','Dieci in oro','Porta 10 strutture alla maestria piena',()=>mastered()>=10],
 ['m50','🥈','Cinquanta in oro','Porta 50 strutture alla maestria piena',()=>mastered()>=50],
 ['m150','🥇','Centocinquanta in oro','Porta 150 strutture alla maestria piena',()=>mastered()>=150],
 ['d3','🧍','In tre dimensioni','Finisci una partita sul modello 3D',()=>n3d()>=1],
 ['d3tutti','🌐','Esploratore 3D','Gioca quattro sfide diverse sul modello 3D',()=>n3d()>=4],
 ['casi5','🩺','Occhio clinico','Finisci 5 casi clinici',()=>(st().modes||{})['case']>=5],
 ['moduli','🗺️','Giramondo','Gioca in tutti i moduli: corpo, cervello e 3D',()=>{const m=st().mods||{};return m.corpo&&m['3d']&&(m.cervello||(m.lat&&m.sag));}]
].map(([id,icon,name,desc,test])=>({id,icon,name,desc,test}));
// fase 5 (sezione 6 della specifica): badge del percorso e della Flotta. I conti del percorso servono i contenuti (P.ready()).
const sats=()=>P.tuttiSat(); // ospiti compresi (UCBM: l'anatomia dentro Biologia)
const pls=()=>P.corsi().flatMap(c=>P.pianeti(c));
const RIP=()=>P.R()?.badge?.ripassi_del_giorno||10;
export const BADGES5=[
 ['sat1','🛰️','Primo satellite acceso','Accendi il tuo primo satellite',()=>P.ready()&&sats().some(P.lit),null,true],
 ['sapevo','💡','Lo sapevo già','Supera una prova «Lo so già»',()=>st().prove>=1],
 ['pianeta1','🪐','Primo pianeta','Supera l\'esame di un pianeta',()=>P.ready()&&pls().some(P.examPassed),null,true],
 ['corso1','☀️','Primo corso','Completa un corso: tutti i suoi pianeti con l\'esame superato',()=>P.ready()&&P.corsi().some(c=>{const L=P.pianeti(c);return L.length&&L.every(P.examPassed);}),'Esperto di un corso intero',true],
 ['sistema','✨','Sistema completo','Rendi brillanti tutti i satelliti di un pianeta',()=>P.ready()&&pls().some(p=>{const L=P.satelliti(p);return L.length&&L.every(s=>P.look(s)==='brillante');}),'Mente brillante',true],
 ['costante','🔁','Ripasso costante','Finisci 10 Ripassi del giorno',()=>(st().ripgiorni||0)>=RIP(),'Studente costante'],
 ['stagione','🏆','Vincitore di stagione','Porta punti alla casata che vince una stagione',()=>Object.keys(S.fleet?.vinte||{}).length>0,'Campione di stagione'],
 ['equipaggio','🤝','Obiettivo d\'equipaggio','Raggiungi con il tuo equipaggio l\'obiettivo della settimana',()=>Object.keys(S.fleet?.premi||{}).length>0,'Spirito d\'equipaggio']
].map(([id,icon,name,desc,test,title,pp])=>({id,icon,name,desc,test,title:title||undefined,f5:true,pp:!!pp}));
BADGES.push(...BADGES5);
export const NEW_BADGES=new Set(BADGES5.map(b=>b.id));

/* Più percorsi (v0.92.0): i badge di contenuto (pp: primo satellite, primo pianeta, primo corso, sistema completo) si guadagnano una
   volta in ogni percorso. Nel percorso completo l'id resta quello di sempre; negli altri è '<id>-<percorso>' (es. 'sat1-ucbm'), con la
   sua riga in badge_classes (file 20261126090000_dextera_percorsi.sql: un percorso nuovo vuole le sue righe). I badge di abitudine
   (serie, partite, ripassi, XP…) restano unici per persona. */
const PSEP='-';
export const ppBadgeId=(id,pid)=>pid&&pid!=='base'?id+PSEP+pid:id;
export const isPpVariant=id=>BADGES5.some(b=>b.pp&&id.startsWith(b.id+PSEP));
const pName=pid=>(P.percorsiCat().find(x=>x.id===pid)?.nome)||pid;
function variant(b,pid){return {...b,id:ppBadgeId(b.id,pid),name:b.name+' · '+pName(pid),desc:b.desc+' nel percorso '+pName(pid),pid};}
// un badge dal suo id (anche le varianti per percorso), per profilo, vetrina e titoli
export function badgeById(id){
 const b=BADGES.find(x=>x.id===id);if(b)return b;
 const base=BADGES5.find(x=>x.pp&&id.startsWith(x.id+PSEP));return base?variant(base,id.slice(base.id.length+1)):null;
}
// badge da mostrare: tutti quelli unici e del percorso completo, più le varianti dei percorsi aperti o già giocati
export function badgeList(){
 const pids=new Set();const cur=P.percorsoId();if(cur!=='base')pids.add(cur);
 for(const [k,v] of Object.entries(S.xpBy||{}))if(k!=='base'&&v>0)pids.add(k);
 for(const id of Object.keys(S.badges||{})){const b=badgeById(id);if(b?.pid)pids.add(b.pid);}
 const out=BADGES.slice();
 for(const pid of pids)if(/^[a-z0-9-]{1,40}$/.test(pid))for(const b of BADGES5)if(b.pp)out.push(variant(b,pid));
 return out;
}

// assegna i badge nuovi; restituisce quelli appena guadagnati
export function checkBadges(){
 const got=S.badges||(S.badges={}),now=new Date().toISOString(),fresh=[];
 // i badge di contenuto valgono per il percorso aperto (si controllano lì)
 const pid=P.percorsoId();
 for(const b0 of BADGES){const b=b0.pp?(pid==='base'?b0:variant(b0,pid)):b0;if(!got[b.id]){let ok=false;try{ok=b.test();}catch(e){}if(ok){got[b.id]=now;fresh.push(b);}}}
 return fresh;
}
