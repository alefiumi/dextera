/* Profilo e competenze (fase 5, sezioni 6, 7 e 9 della specifica): sagoma, radar delle competenze, titoli da scegliere.
   Tutto calcolato sul telefono, anche offline, dalla maestria del percorso (chiavi per aspetto, vedi percorso.js).
   Scelte dell'autore (19/11/2026):
   - Radar con due viste: «Per passo» (un asse per tipo di passo del corso: nel corpo Ossa, Reperi, Muscoli, Connessioni, Funzione,
     Casi clinici) e «Per regione» (un asse per pianeta). Valore di un asse = maestria media (0–3 → 0–100%) di tutte le strutture
     usabili del corso per quell'aspetto, anche quelle non iniziate; per i casi clinici la quota dei satelliti con il passo progetto fatto.
   - Sagoma: la figura 2D del corso (corpo: anteriore e posteriore; neurologia: cervello laterale e mediale), ogni parte del colore
     della maestria (stessi colori della Palestra) e sopra ogni zona il simbolo dello stato del suo satellite; il tocco apre il satellite.
   - Titoli: quelli dei livelli raggiunti, i titoli d'esperto degli esami superati e quelli di alcuni badge (title in badges.js).
   Numeri in regole.json → profilo. */
import {app,S,level,TITLES} from './state.js';
import * as P from './percorso.js';
import {BADGES} from './badges.js';
import {sym} from './path.js';

const RP=()=>({vetrina:3,min_vis:.25,viste:{corpo:['a','p'],cervello:['ls','m']},...(P.R()?.profilo||{})});
export const vetrinaMax=()=>RP().vetrina;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MX=()=>P.R()?.maestria?.max||3;
const avg=ks=>ks.length?ks.reduce((a,k)=>a+P.mastery(k),0)/ks.length/MX():0;

/* ---------- radar ---------- */
export const ASSI={ossa:'Ossa',reperi:'Reperi',muscoli:'Muscoli',connessioni:'Connessioni',funzione:'Funzione',strutture:'Strutture',dove:'Posizione',lesione:'Lesioni',progetto:'Casi clinici'};
// assi del radar del corso c: [{id, n, v (0–1)}]
export function radar(c,modo){
 if(modo==='regioni')return P.pianeti(c).map(pl=>({id:pl.id,n:pl.nome,v:avg([...new Set(P.satelliti(pl).flatMap(P.satKeys))])}));
 const sats=P.satelliti(null,c),tipi=[];
 for(const s of sats)for(const ps of P.passi(s))if(!tipi.includes(ps.tipo))tipi.push(ps.tipo);
 return tipi.map(t=>{
  if(t==='progetto'){const L=sats.flatMap(s=>P.passi(s).filter(ps=>ps.tipo==='progetto'));return {id:t,n:ASSI[t],v:L.length?L.filter(P.stepDone).length/L.length:0};}
  const ks=new Set();for(const s of sats)for(const ps of P.passi(s))if(ps.tipo===t)for(const sid of P.usable(ps))ks.add(P.key(sid,ps.aspetto));
  return {id:t,n:ASSI[t]||t,v:avg([...ks])};
 });
}
const pct=v=>Math.round(v*100);
// disegno: anelli al 25, 50, 75 e 100%, poligono dei valori, etichette con la percentuale (si legge anche senza colori)
export function radarSvg(ax,label){
 const n=ax.length,R=62,ang=i=>-Math.PI/2+i*2*Math.PI/n,pt=(i,r)=>[Math.cos(ang(i))*r,Math.sin(ang(i))*r],f=x=>x.toFixed(1);
 if(n<3)return '';
 const ring=r=>`<polygon class="rg" points="${ax.map((_,i)=>pt(i,r).map(f).join(',')).join(' ')}"/>`;
 const axes=ax.map((_,i)=>{const [x,y]=pt(i,R);return `<line class="ra" x1="0" y1="0" x2="${f(x)}" y2="${f(y)}"/>`;}).join('');
 const poly=ax.map((a,i)=>pt(i,R*Math.max(.03,a.v)).map(f).join(',')).join(' ');
 const dots=ax.map((a,i)=>{const [x,y]=pt(i,R*Math.max(.03,a.v));return `<circle class="rd" cx="${f(x)}" cy="${f(y)}" r="3"/>`;}).join('');
 // etichette su due righe al massimo (nome lungo spezzato tra le parole), la percentuale sull'ultima
 const lines=t=>{const w=String(t).split(' '),L=[''];for(const x of w){const c=L[L.length-1];if(c&&(c+' '+x).length>14&&L.length<2)L.push(x);else L[L.length-1]=c?c+' '+x:x;}return L.map(l=>l.length>16?l.slice(0,15)+'…':l);};
 const labs=ax.map((a,i)=>{const [x,y]=pt(i,R+12),anc=Math.abs(x)<8?'middle':x>0?'start':'end',L=lines(a.n),h=11,y0=y<-R/2?y-(L.length-1)*h-2:y>R/2?y+10:y+4-(L.length-1)*h/2;
  return `<text class="rl" x="${f(x)}" y="${f(y0)}" text-anchor="${anc}">${L.map((l,j)=>`<tspan x="${f(x)}"${j?` dy="${h}"`:''}>${esc(l)}${j===L.length-1?`<tspan class="rp"> ${pct(a.v)}%</tspan>`:''}</tspan>`).join('')}</text>`;}).join('');
 return `<svg class="radar" viewBox="-165 -112 330 224" role="img" aria-label="${esc(label)}: ${ax.map(a=>esc(a.n)+' '+pct(a.v)+'%').join(', ')}">${[.25,.5,.75,1].map(k=>ring(R*k)).join('')}${axes}<polygon class="rv" points="${poly}"/>${dots}${labs}</svg>`;
}

/* ---------- sagoma ---------- */
// maestria di una parte della figura: nel corpo la chiave è l'id dell'osso (la stessa del percorso); nel cervello la più alta
// tra le voci di neurologia del corso che usano quella parte (n.<voce>)
function partMastery(c){
 if(c.modulo!=='cervello')return id=>P.mastery(id);
 const m=new Map();
 for(const s of P.satelliti(null,c))for(const ps of P.passi(s))if(ps.tipo==='strutture')for(const sid of ps.strutture||[])for(const id of P.nfig(sid))m.set(id,Math.max(m.get(id)||0,P.mastery(sid)));
 return id=>m.get(id)||0;
}
export const hasSagoma=c=>!!(c&&app.MODS[c.modulo]&&RP().viste[c.modulo]);
export function sagoma(c){
 const M=app.MODS[c.modulo],vs=RP().viste[c.modulo].filter(v=>M.views.includes(v)),W=M.W,H=M.H,mv=partMastery(c),min=RP().min_vis;
 const sats=P.satelliti(null,c),out=[],placed=[];
 // simbolo del satellite al centro delle sue parti nella vista in cui si vedono di più
 for(const s of sats){
  const ids=[...new Set(P.zoneBones(s))].map(id=>M.byId[id]).filter(Boolean);let best=null;
  vs.forEach((v,vi)=>{const L=ids.filter(b=>b.c?.[v]&&(b.vis?.[v]??1)>=min);const w=L.reduce((a,b)=>a+(b.vis?.[v]??1),0);
   if(L.length&&(!best||w>best.w)){const x=L.reduce((a,b)=>a+b.c[v][0]*(b.vis?.[v]??1),0)/w,y=L.reduce((a,b)=>a+b.c[v][1]*(b.vis?.[v]??1),0)/w;best={w,vi,x,y};}});
  if(!best)continue;
  // i simboli vicini si spostano di lato, così si toccano uno per uno
  let {x,y}=best;for(let k=0;k<6&&placed.some(p=>p.vi===best.vi&&Math.hypot(p.x-x,p.y-y)<26);k++)x+=(k%2?-1:1)*(k+1)*13;
  placed.push({vi:best.vi,x,y});
  const st=P.look(s);
  out.push(`<g class="zs" transform="translate(${(best.vi*W+x).toFixed(1)} ${y.toFixed(1)})" role="button" tabindex="0" data-pf="sat" data-id="${esc(s.id)}" aria-label="${esc(s.nome)}: ${P.STATI[st]}. Apri il satellite"><circle r="13" class="zbg"/>${sym(st,10)}</g>`);
 }
 const views=vs.map((v,vi)=>`<g transform="translate(${vi*W} 0)">`+M.B.filter(b=>b.s[v]&&!b.area).map(b=>`<g class="bone m${mv(b.id)}" data-pf="bone" data-id="${esc(b.id)}"${b.col?` style="--b:${b.col}"`:''}>${b.s[v]}</g>`).join('')+'</g>').join('');
 // riquadro: solo la parte disegnata (le viste stanno nello stesso spazio W×H, ognuna centrata)
 let y0=H,y1=0;for(const b of M.B)for(const v of vs){const q=b.sb?.[v];if(q){y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]+q[3]);}}
 if(y1<=y0){y0=0;y1=H;}
 const names=vs.map(v=>M.vnames[v]||v).join(' e ');
 return `<svg class="sag" viewBox="0 ${(y0-16).toFixed(0)} ${W*vs.length} ${(y1-y0+32).toFixed(0)}" role="group" aria-label="Sagoma: ${esc(names)}, colorata con la maestria; sopra ogni zona lo stato del suo satellite">${views}${out.join('')}</svg>`;
}
// elenco dei satelliti con il loro stato (per chi usa la tastiera o il lettore di schermo, e per leggere gli stati a parole)
export const satList=c=>P.satelliti(null,c).map(s=>({s,st:P.look(s)}));

/* ---------- titoli ---------- */
// titoli che si possono scegliere: {id, t, src}; il titolo scelto sta in S.prof.titolo {id, t} (nessuno = quello del livello)
export function titoli(){
 const {L}=level(),out=TITLES.slice(0,Math.min(L,TITLES.length)).map((t,i)=>({id:'liv:'+(i+1),t,src:'Livello '+(i+1)}));
 if(P.ready())for(const c of P.corsi())for(const pl of P.pianeti(c))if(P.examPassed(pl))out.push({id:'esp:'+pl.id,t:P.expertTitle(pl),src:'Esame di '+pl.nome});
 for(const b of BADGES)if(b.title&&S.badges?.[b.id])out.push({id:'badge:'+b.id,t:b.title,src:'Badge «'+b.name+'»'});
 return out;
}
// il titolo da mostrare: quello scelto, se si può ancora scegliere, altrimenti quello del livello
export function titolo(){const t=S.prof?.titolo;if(t&&t.id&&titoli().some(x=>x.id===t.id))return t.t;return level().title;}
