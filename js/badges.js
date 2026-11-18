/* Badge e traguardi: calcolati sul dispositivo dopo ogni salvataggio, anche senza account.
   S.badges = {id: data ISO dell'assegnazione}. Con l'account si inviano a badge_assertions (vedi account.js).
   Gli id e i testi devono restare uguali a quelli in supabase/migrations/*_profilo_badge.sql (badge_classes). */
import {S} from './state.js';

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

// assegna i badge nuovi; restituisce quelli appena guadagnati
export function checkBadges(){
 const got=S.badges||(S.badges={}),now=new Date().toISOString(),fresh=[];
 for(const b of BADGES)if(!got[b.id]){let ok=false;try{ok=b.test();}catch(e){}if(ok){got[b.id]=now;fresh.push(b);}}
 return fresh;
}
