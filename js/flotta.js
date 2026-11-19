/* Flotta (fase 4, sezione 6 della specifica): conti fatti sul telefono, anche offline.
   - Punti della casata: ogni XP di progresso vale un punto, doppio se viene dal pianeta scelto (S.set.pianeta); al massimo
     300 punti al giorno (regole.json → flotta). S.fleet.days {'AAAA-MM-GG': {xp, raw, u}}: xp = XP di progresso del giorno
     (classifica della settimana tra amici), raw = punti prima del tetto; u = da inviare.
   - Contributi agli equipaggi: una struttura del percorso che arriva a maestria 2 (la prima volta: entra nel calendario del ripasso)
     o che viene ripassata in tempo vale un contributo per ogni pianeta in cui sta. S.fleet.wk {w: lunedì, pl: {pianeta: n}, u};
     la settimana prima resta in S.fleet.wkp finché non è inviata. Il contributo di ciascuno lo vede solo lui.
   - Casata (S.fleet.casata, cambiata = data dell'ultimo cambio), risposte alle sfide in coda (S.fleet.ans), premi d'equipaggio
     già dati (S.fleet.premi {'<equipaggio>:<lunedì>': 1}), pianeti degli equipaggi (S.fleet.crewPl {id: pianeta}).
   Si inviano con syncFlotta() (account.js); finché sul server manca il file SQL restano qui.
   - Stagioni vinte (badge «Vincitore di stagione», fase 5): S.fleet.vinte {'AAAA-MM': casata}, quando la casata vincitrice di una
     stagione chiusa (seasons.vincitore) ha ricevuto dei punti da questa persona in quel mese (fleet_days, casata decisa dal server).
   - Più percorsi (v0.92.0): ogni giorno ha anche p {'<percorso>': {xp, raw}}; il tetto di 300 punti vale per ogni percorso e sul server
     c'è una riga per giorno e percorso (fleet_days.percorso, file 20261126090000_dextera_percorsi.sql). Finché il file manca si invia
     solo il percorso base e gli altri restano da inviare. I giorni di prima (senza p) sono del percorso base. */
import {app,S} from './state.js';

export const FR=()=>{const r=app.REGOLE?.flotta||{};return {tetto_giorno:300,pianeta_scelto:2,giorni:40,invio_giorni:34,...r,
 equipaggio:{min:2,max:10,per_membro:6,xp:50,max_per_persona:3,...(r.equipaggio||{})},sfida:{strutture:5,giorni:14,...(r.sfida||{})}};};
export const F=()=>{const f=S.fleet||(S.fleet={});f.days||(f.days={});f.wk||(f.wk={w:'',pl:{}});f.premi||(f.premi={});f.ans||(f.ans=[]);f.crewPl||(f.crewPl={});return f;};

// date locali in formato ISO ('AAAA-MM-GG'), lunedì della settimana, stagione 'AAAA-MM'
const pad=n=>String(n).padStart(2,'0');
export const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
export const isoToday=()=>iso(new Date());
export const monday=(d=new Date())=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()+6)%7);return iso(x);};
export const season=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1);
const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
export const points=x=>Math.min(FR().tetto_giorno,Math.round(x?.raw||0));
export const pid=()=>app.PERCORSO?.id||'base';
// conti di un giorno per percorso: {percorso: {xp, raw}} (giorni di prima: tutto al percorso base)
export const parts=x=>x?.p||{base:{xp:x?.xp||0,raw:x?.raw||0}};
// punti di un giorno: di un percorso, o di tutti (somma con il tetto per percorso)
export const dayPoints=(x,p)=>p?points(parts(x)[p]):Object.values(parts(x)).reduce((a,y)=>a+points(y),0);
// il file SQL dei percorsi c'è? (null = non ancora controllato). Si controlla con la tabella nuova, che arriva insieme alle colonne
export const PX={ok:null,at:0};
export const PX_SQL='supabase/migrations/20261126090000_dextera_percorsi.sql';
export const pxMissing=e=>/dextera_percorsi_xp|percorso|schema cache|does not exist|PGRST205|PGRST204|42P01|42703|42P10/i.test(((e&&e.message)||'')+((e&&e.code)||''));
export async function probePx(sb,force){
 if(PX.ok&&!force)return true;
 if(PX.ok===false&&!force&&Date.now()-PX.at<6e4)return false;
 const {error}=await sb.from('dextera_percorsi_xp').select('percorso').limit(1);
 if(error&&!pxMissing(error))throw error;
 PX.ok=!error;PX.at=Date.now();return PX.ok;
}

// XP di progresso guadagnati ora: pls = pianeti da cui vengono (per il raddoppio del pianeta scelto)
export function fleetGain(n,pls){
 if(!(n>0))return;
 const f=F(),d=isoToday(),x=f.days[d]||(f.days[d]={xp:0,raw:0}),pl=S.set&&S.set.pianeta;
 const mult=pl&&pls&&[...pls].includes(pl)?FR().pianeta_scelto:1;
 if(!x.p)x.p=parts(x);const y=x.p[pid()]||(x.p[pid()]={xp:0,raw:0});
 x.xp+=n;x.raw+=n*mult;y.xp+=n;y.raw+=n*mult;x.u=1;
 const old=back(FR().giorni);for(const k of Object.keys(f.days))if(k<old)delete f.days[k];
}
// settimana dei contributi: il lunedì riparte da zero (la settimana prima resta da inviare se non è partita)
function week(){
 const f=F(),w=monday();
 if(f.wk.w!==w){const prev=monday(new Date(Date.now()-7*864e5));f.wkp=f.wk.w===prev&&f.wk.u?f.wk:null;f.wk={w,pl:{}};}
 return f.wk;
}
export function fleetContrib(pls){
 if(!pls)return;const wk=week();let any=false;
 for(const p of pls){wk.pl[p]=(wk.pl[p]||0)+1;any=true;}
 if(any)wk.u=1;
}
export const myContrib=pl=>week().pl[pl]||0;
// riepiloghi locali: punti di oggi e della stagione, XP di progresso della settimana
// p = percorso (senza: tutti i percorsi, come le casate di oggi)
export const todayPoints=p=>dayPoints(F().days[isoToday()],p);
export const seasonPoints=p=>{const s=season();return Object.entries(F().days).filter(([d])=>d.startsWith(s)).reduce((a,[,x])=>a+dayPoints(x,p),0);};
export const weekXp=()=>{const m=monday();return Object.entries(F().days).filter(([d])=>d>=m).reduce((a,[,x])=>a+(x.xp||0),0);};
// la casata si cambia al massimo una volta per stagione (mese)
export const canChange=()=>{const c=F().cambiata;return !c||season(new Date(c))!==season();};
export const pending=()=>{const f=F();return Object.values(f.days).some(x=>x.u)||!!f.wk.u||!!(f.wkp&&f.wkp.u)||f.ans.length>0;};

// errori del server che vogliono dire «manca il file SQL della Flotta»
export const missing=e=>/constellation|fleet_days|season|crew|dextera_classifica|schema cache|does not exist|PGRST205|42P01/i.test(((e&&e.message)||'')+((e&&e.code)||''));
export const SQL_FILE='supabase/migrations/20261123090000_dextera_flotta.sql';

const keep=()=>{try{localStorage.setItem('dextera-v1',JSON.stringify(S));}catch(e){}}; // senza save(): non deve ripartire un invio
// la propria casata: se non c'è la assegna il server (alla casata con meno membri)
export async function ensureCasata(sb,uid){
 let {data,error}=await sb.from('constellation_members').select('constellation_id,cambiata_il').eq('user_id',uid).maybeSingle();
 if(error)throw error;
 if(!data){const r=await sb.from('constellation_members').insert({user_id:uid}).select('constellation_id,cambiata_il').single();if(r.error)throw r.error;data=r.data;}
 const f=F();f.casata=data.constellation_id;f.cambiata=data.cambiata_il||null;keep();
 return data;
}
// invio: casata (all'accesso), giorni, contributi della settimana sugli equipaggi, risposte alle sfide
export async function syncFlotta(sb,uid,full){
 const f=F();
 if(full||!f.casata)await ensureCasata(sb,uid);
 const from=back(FR().invio_giorni),days=Object.entries(f.days).filter(([d,x])=>x.u&&d>=from),px=await probePx(sb);
 if(days.length){
  const sent=days.map(([d,x])=>[d,x,JSON.stringify(x)]),row=(giorno,p,y)=>({user_id:uid,giorno,xp:Math.min(20000,Math.round(y.xp||0)),punti:points(y),...(px?{percorso:p}:{})});
  // con il file dei percorsi una riga per giorno e percorso; senza, solo il percorso base (gli altri restano da inviare)
  const rows=sent.flatMap(([giorno,x])=>Object.entries(parts(x)).filter(([p,y])=>(px||p==='base')&&/^[a-z0-9-]{1,40}$/.test(p)&&(y.xp>0||y.raw>0)).map(([p,y])=>row(giorno,p,y)));
  if(rows.length){const {error}=await sb.from('fleet_days').upsert(rows,{onConflict:px?'user_id,giorno,percorso':'user_id,giorno'});if(error)throw error;}
  for(const [,x,snap] of sent)if(JSON.stringify(x)===snap&&(px||Object.keys(parts(x)).every(p=>p==='base'||!(parts(x)[p].xp>0))))delete x.u; // cambiato nel frattempo: resta da inviare
 }
 for(const [d,x] of Object.entries(f.days))if(x.u&&d<from)delete x.u; // troppo vecchi per il server
 week();
 const wks=[f.wk,f.wkp].filter(w=>w&&w.u&&w.w),crews=Object.entries(f.crewPl).filter(([,p])=>p);
 if(wks.length&&crews.length){
  const rows=[];for(const w of wks)for(const [crew_id,pianeta] of crews)if(w.pl[pianeta])rows.push({crew_id,user_id:uid,settimana:w.w,pianeta,contributi:Math.min(1000,w.pl[pianeta])});
  const snap=wks.map(w=>[w,JSON.stringify(w.pl)]);
  if(rows.length){const {error}=await sb.from('crew_weeks').upsert(rows,{onConflict:'crew_id,user_id,settimana,pianeta'});if(error&&!/dextera_settimana|row-level/i.test(error.message||''))throw error;}
  for(const [w,s] of snap)if(JSON.stringify(w.pl)===s)delete w.u;
  if(f.wkp&&!f.wkp.u)f.wkp=null;
 }else if(wks.length&&!crews.length){for(const w of wks)delete w.u;f.wkp=null;}
 if(f.ans.length){
  // una alla volta: una sfida cancellata nel frattempo (o un equipaggio lasciato) non blocca le altre e si lascia perdere
  for(const a of f.ans.slice()){
   const {error}=await sb.from('crew_challenge_answers').upsert({challenge_id:a.challenge_id,user_id:uid,giuste:a.giuste},{onConflict:'challenge_id,user_id',ignoreDuplicates:true});
   if(error&&!/foreign|row-level|23503|42501/i.test((error.message||'')+(error.code||'')))throw error;
   f.ans=f.ans.filter(x=>x!==a);
  }
 }
 keep();
}

// ritorna null (niente di nuovo), false (guardate, nessuna vinta) o true (vinta almeno una)
// stagioni chiuse vinte: si guarda una volta per stagione (anche persa: S.fleet.viste) nei propri giorni di quel mese
export async function checkWins(sb,uid,seasons){
 const f=F(),seen=f.viste||(f.viste={}),todo=(seasons||[]).filter(x=>x.vincitore&&!seen[x.stagione]);
 if(!todo.length)return null; // niente di nuovo da guardare
 const from=todo.map(x=>x.stagione).sort()[0]+'-01';
 const {data,error}=await sb.from('fleet_days').select('giorno,constellation_id,punti').eq('user_id',uid).gte('giorno',from);
 if(error)throw error;
 let won=false;
 for(const x of todo){seen[x.stagione]=1;if((data||[]).some(d=>String(d.giorno).startsWith(x.stagione)&&d.constellation_id===x.vincitore&&d.punti>0)){(f.vinte||(f.vinte={}))[x.stagione]=x.vincitore;won=true;}}
 return won;
}
