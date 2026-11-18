/* Scheda Percorso (fase 1, sezioni 4 e 7 della specifica): «Continua» in cima, mappa universo → sistema → pianeta → satellite
   con le briciole di pane e l'interruttore Mappa / Elenco, i 6 passi del satellite, obiettivo del giorno e serie.
   La mappa è un SVG leggero: orbite ferme, movimento solo come animazione d'ingresso, ogni corpo celeste si tocca su almeno 44 pt.
   Le regole stanno in percorso.js, la lezione in lezione.js. Scelte dell'interfaccia in 'dextera-percorso-ui'. */
import {$,toast} from './util.js';
import {app,S,save,head} from './state.js';
import * as P from './percorso.js';
import {startLesson,renderLesson,lessonClick,lessonSubmit,setLessonExit} from './lezione.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UK='dextera-percorso-ui';
export const giorni=n=>(n||0)===1?'1 giorno di fila':`${n||0} giorni di fila`;
let ui={lvl:'sistema',p:'',s:'',mode:'mappa'};
try{ui={...ui,...JSON.parse(localStorage.getItem(UK)||'{}')};}catch(e){}
const keep=()=>{try{localStorage.setItem(UK,JSON.stringify(ui));}catch(e){}};
let hooks={useMod:()=>{},setTab:()=>{}};
// ui.js passa useMod e setTab (niente import circolari)
export function initPath(h){
 hooks=h;
 setLessonExit((mod,go)=>{
  if(mod==='corpo'){hooks.useMod('corpo');return;}
  if(go){ui.lvl='satellite';ui.s=go.sat.id;keep();}
  hooks.setTab('path');
 });
}

const PROB={ossa:'Riconoscerle sulla figura',reperi:'Riconoscerli e trovare il loro osso',muscoli:'Riconoscerli',connessioni:'Da dove partono e dove arrivano',funzione:'Cosa fanno',progetto:'Il caso clinico della regione'};
// simboli degli stati (oltre al colore e alla parola): cerchio vuoto, anello, pieno
function sym(st,r=9,cx=0,cy=0){
 if(st==='acceso')return `<circle class="sy acc" cx="${cx}" cy="${cy}" r="${r}"/>`;
 if(st==='orbita')return `<circle class="sy orb" cx="${cx}" cy="${cy}" r="${r-2}" stroke-width="4"/>`;
 return `<circle class="sy nuovo" cx="${cx}" cy="${cy}" r="${r-1}" stroke-width="2"/>`;
}
const symIcon=st=>`<svg class="si" viewBox="-11 -11 22 22" width="22" height="22" aria-hidden="true">${sym(st)}</svg>`;
// testo su più righe nell'SVG (al massimo ~16 caratteri per riga)
function lines(t,max=16){const w=String(t).split(' '),out=[''];for(const x of w){if((out.at(-1)+' '+x).trim().length>max&&out.at(-1))out.push(x);else out[out.length-1]=(out.at(-1)+' '+x).trim();}return out;}
const svgText=(x,y,t,cls,max)=>lines(t,max).map((l,i)=>`<text x="${x}" y="${y+i*14}" text-anchor="middle" class="${cls}">${esc(l)}</text>`).join('');

/* ---------- disegno ---------- */
export function renderPath(){
 if(!P.ready()){$('panel').innerHTML=`<div class="path"><div class="h">Il tuo percorso</div><p class="mut">I contenuti del percorso non sono ancora su questo telefono: apri l'app una volta con la connessione.</p></div>`;return;}
 if(app.L){if(app.MOD.id!=='corpo'){hooks.useMod('corpo');return;}renderLesson();return;}
 const rw=P.checkProgress();if(rw.length){save();head();toast(rw.map(r=>r.t==='satellite'?`🌟 ${r.sat.nome} acceso! +${r.xp} XP`:`🎉 ${r.ps.nome} (${r.sat.nome}) fatto! +${r.xp} XP`).join(' · '));}
 const g=P.guide(),C=P.corso();
 const sat=ui.s&&P.satById(ui.s),pl=ui.p&&P.pianeti().find(p=>p.id===ui.p);
 if(ui.lvl==='satellite'&&!sat)ui.lvl='sistema';if(ui.lvl==='pianeta'&&!pl)ui.lvl='sistema';
 const crumbs=[['universo','Universo'],['sistema',C.nome]];
 const curP=ui.lvl==='satellite'?P.planetOf(sat):pl;
 if(ui.lvl==='pianeta'||ui.lvl==='satellite')crumbs.push(['pianeta',curP.nome,curP.id]);
 if(ui.lvl==='satellite')crumbs.push(['satellite',sat.nome,sat.id]);
 const bc=`<div class="crumbs" role="navigation" aria-label="Dove sei">${crumbs.map(([l,n,id],i)=>i===crumbs.length-1?`<span aria-current="page">${esc(n)}</span>`:`<button class="lnk" data-p="lvl" data-lvl="${l}"${id?` data-id="${esc(id)}"`:''}>${esc(n)}</button><span aria-hidden="true"> › </span>`).join('')}</div>`;
 const tog=ui.lvl==='satellite'?'':`<div class="chips seg" role="group" aria-label="Vista"><button class="chip${ui.mode==='mappa'?' on':''}" data-p="mode" data-v="mappa" aria-pressed="${ui.mode==='mappa'}">🪐 Mappa</button><button class="chip${ui.mode==='elenco'?' on':''}" data-p="mode" data-v="elenco" aria-pressed="${ui.mode==='elenco'}">☰ Elenco</button></div>`;
 let body;
 if(ui.lvl==='satellite')body=satHtml(sat,g);
 else if(ui.mode==='elenco')body=listHtml(g);
 else body=ui.lvl==='universo'?universeSvg():ui.lvl==='pianeta'?planetSvg(pl,g):systemSvg(g);
 $('panel').innerHTML=`<div class="path">${topHtml(g)}${bc}${tog}${body}${glossary()}</div>`;
}
function topHtml(g){
 const day=S.day&&S.day.d===P.today()?S.day:{xp:0},goal=P.goal(),pct=Math.min(1,(day.xp||0)/goal);
 const ring=`<div class="ring" role="img" aria-label="Obiettivo del giorno: ${day.xp||0} XP su ${goal}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="rb"/><circle cx="18" cy="18" r="15" class="rf" stroke-dasharray="${(pct*94.2).toFixed(1)} 94.2"/></svg><span>${day.xp||0}/${goal}</span></div>`;
 const opts=P.R().obiettivo.scelte.map(v=>`<option value="${v}"${v===goal?' selected':''}>${v} XP${v===30?' (leggero)':v===60?' (normale)':' (intenso)'}</option>`).join('');
 return `<button class="cont" data-p="cont"><span class="cs">★ Continua</span><b>${esc(g.sat.nome)}, passo ${g.ps.n}</b><small>${esc(g.ps.nome)}</small></button>
  <div class="dayrow">${ring}<span>🔥 ${giorni(S.streak)}${S.shields?` · 🛡 ${S.shields}`:''}</span>
  <label class="goal">Obiettivo <select data-p="goal">${opts}</select></label></div>`;
}
function universeSvg(){
 const C=P.corso(),lit=P.satelliti().filter(s=>P.satState(s)==='acceso').length,n=P.satelliti().length;
 return `<svg class="map" viewBox="0 0 360 260" role="group" aria-label="Universo dei corsi">
  <g class="enter"><a href="#" data-p="lvl" data-lvl="sistema" role="button" aria-label="${esc(C.nome)}: ${lit} satelliti accesi su ${n}">
  <circle cx="180" cy="110" r="60" class="hit"/><circle cx="180" cy="110" r="44" class="sun"/>${svgText(180,190,C.nome,'lab',22)}<text x="180" y="224" text-anchor="middle" class="wd">${lit}/${n} satelliti accesi</text></a></g>
  <text x="180" y="250" text-anchor="middle" class="wd">Gli altri corsi arriveranno dopo.</text></svg>`;
}
function systemSvg(g){
 // posizioni fisse: le etichette dei pianeti nella metà alta stanno sopra il pianeta, così non coprono il sole
 const L=P.pianeti(),cx=180,cy=200,R=[80,115,150,175],ang=[-90,160,35,-130],gp=P.planetOf(g.sat);
 const orbits=L.map((p,i)=>`<circle cx="${cx}" cy="${cy}" r="${R[i%4]}" class="orbit"/>`).join('');
 const bodies=L.map((p,i)=>{const r=R[i%4],a=ang[i%4]*Math.PI/180,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a),up=y<cy;
  const ss=P.satelliti(p),lit=ss.filter(s=>P.satState(s)==='acceso').length,orb=ss.filter(s=>P.satState(s)!=='nuovo').length,nl=lines(p.nome,14).length;
  const wd=`${lit}/${ss.length} accesi${orb>lit?` · ${orb-lit} in orbita`:''}`;
  const ty=up?y-30-14*nl:y+32,wy=up?y-26:y+32+14*nl;
  return `<a href="#" data-p="planet" data-id="${esc(p.id)}" role="button" aria-label="${esc(p.nome)}: ${lit} satelliti accesi su ${ss.length}${p===gp?', consigliato':''}">
   <circle cx="${x}" cy="${y}" r="26" class="hit"/><circle cx="${x}" cy="${y}" r="17" class="pl pl${i}"/>${p===gp?`<text x="${x+16}" y="${y-12}" class="star" aria-hidden="true">★</text>`:''}
   ${svgText(x,ty,p.nome,'lab',14)}<text x="${x}" y="${wy}" text-anchor="middle" class="wd">${wd}</text></a>`;}).join('');
 return `<svg class="map" viewBox="0 0 360 400" role="group" aria-label="Sistema: ${esc(P.corso().nome)}"><g class="enter">${orbits}<circle cx="${cx}" cy="${cy}" r="22" class="sun"/>${bodies}</g></svg>
  <p class="mut">Tocca un pianeta per vedere i suoi satelliti. ★ è la stella guida: il passo consigliato.</p>`;
}
// satelliti dello stesso pianeta che condividono strutture (linee sulla mappa)
function shared(a,b){const set=x=>new Set(P.passi(x).flatMap(ps=>Array.isArray(ps.strutture)?ps.strutture:[]));const A=set(a);for(const id of set(b))if(A.has(id))return true;return false;}
function planetSvg(pl,g){
 const L=P.satelliti(pl),n=L.length,cx=180,cy=190,r=n>4?125:115;
 const pos=L.map((s,i)=>{const a=(-90+i*360/n)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
 const links=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(shared(L[i],L[j]))links.push(`<line x1="${pos[i][0]}" y1="${pos[i][1]}" x2="${pos[j][0]}" y2="${pos[j][1]}" class="link"/>`);
 const bodies=L.map((s,i)=>{const [x,y]=pos[i],st=P.satState(s),done=P.passi(s).filter(P.stepDone).length,tot=P.passi(s).length;
  return `<a href="#" data-p="sat" data-id="${esc(s.id)}" role="button" aria-label="${esc(s.nome)}: ${P.STATI[st]}, ${done} passi fatti su ${tot}${s===g.sat?', consigliato':''}">
   <circle cx="${x}" cy="${y}" r="26" class="hit"/><g transform="translate(${x} ${y})">${sym(st,15)}</g>${s===g.sat?`<text x="${x+16}" y="${y-12}" class="star" aria-hidden="true">★</text>`:''}
   ${svgText(x,y+30,s.nome,'lab',15)}<text x="${x}" y="${y+30+14*lines(s.nome,15).length}" text-anchor="middle" class="wd">${P.STATI[st]} · ${done}/${tot}</text></a>`;}).join('');
 return `<svg class="map" viewBox="0 0 360 400" role="group" aria-label="Pianeta ${esc(pl.nome)}"><g class="enter"><circle cx="${cx}" cy="${cy}" r="${r}" class="orbit"/>${links.join('')}
  <circle cx="${cx}" cy="${cy}" r="30" class="pl pl${P.pianeti().indexOf(pl)}"/>${svgText(cx,cy+4,pl.nome,'lab in',12)}${bodies}</g></svg>
  <p class="mut">Le linee uniscono i satelliti che hanno strutture in comune: impararle in uno fa avanzare anche l'altro.</p>`;
}
function listHtml(g){
 return P.pianeti().map(p=>`<h3 class="lp">🪐 ${esc(p.nome)}</h3><ul class="sl">`+P.satelliti(p).map(s=>{const st=P.satState(s),done=P.passi(s).filter(P.stepDone).length,tot=P.passi(s).length;
  return `<li><button class="srow" data-p="sat" data-id="${esc(s.id)}">${symIcon(st)}<span class="sn">${esc(s.nome)}${s===g.sat?' <span class="star" aria-label="consigliato">★</span>':''}</span><small>${P.STATI[st]} · ${done}/${tot} passi</small></button></li>`;}).join('')+'</ul>').join('');
}
function satHtml(sat,g){
 const st=P.satState(sat),L=P.passi(sat),caso=P.casoOf(sat);
 const steps=L.map((ps,i)=>{
  const open=P.stepOpen(sat,ps),done=P.stepDone(ps),nd=P.node(ps.id),use=P.usable(ps),stars=nd?.stelle||0,isG=ps===g.ps&&sat===g.sat;
  const prev=L.slice(0,i).filter(p=>!P.stepDone(p)).pop();
  let state=done?'Fatto':open?'Da fare':'Bloccato',act='';
  if(ps.tipo==='progetto'){
   act=open?`<button class="btn" data-p="go" data-id="${esc(ps.id)}" data-k="${caso?'caso':'quiz'}">${done?'Rifai':'Inizia'} ${caso?'il caso clinico':'il quiz finale'}</button>`:`<p class="mut">Si apre dopo i passi 1–5.</p>`;
  }else if(!use.length){act=`<p class="mut">Nessuna domanda disponibile ora (dati in verifica).</p>`;}
  else{
   const pv=P.provaOggi(ps.id);
   act=(open?`<button class="btn" data-p="go" data-id="${esc(ps.id)}" data-k="lezione">${done?'Ripeti lezione':'Inizia lezione'}</button>`:`<p class="mut">Dopo il passo ${prev?prev.n:ps.n-1} · oppure mettiti alla prova</p>`)+
    (done?'':`<button class="btn alt" data-p="go" data-id="${esc(ps.id)}" data-k="prova"${pv?' disabled':''}>Lo so già: mettimi alla prova</button>${pv?'<small class="mut">Prova già fatta oggi: riprova domani.</small>':''}`);
  }
  const pct=ps.tipo==='progetto'?'':` · ${Math.round(P.stepPct(ps)*use.length)}/${use.length} a maestria 2`;
  return `<li class="step ${i%2?'zr':'zl'}${done?' done':''}${open?'':' lock'}"><div class="sc" aria-hidden="true">${done?'✓':open?ps.n:'🔒'}</div>
   <div class="sb"><b>${ps.n}. ${esc(ps.nome)}${isG?' <span class="star" aria-label="consigliato">★</span>':''}</b><small>${PROB[ps.tipo]||''}</small>
   <small class="mut">${state}${pct}${stars?` · <span aria-label="${stars} stelle su 3">${'⭐'.repeat(stars)}</span>`:''}</small>${act}</div></li>`;
 }).join('');
 const skip=sat.passi.filter(p=>p.salta).map(p=>p.nome).join(', ');
 return `<div class="sath">${symIcon(st)}<div><div class="h">${esc(sat.nome)}</div><div class="mut">${P.STATI[st]} · ${L.filter(P.stepDone).length}/${L.length} passi fatti</div></div></div>
  ${skip?`<p class="mut">Passi saltati in questo satellite (non ci sono strutture): ${esc(skip)}.</p>`:''}<ol class="steps">${steps}</ol>`;
}
function glossary(){
 const G=[['Pianeta','una regione del corpo (arto inferiore, colonna e tronco…)'],['Satellite','una zona da studiare in 6 passi, come un piccolo progetto'],
  ['Passo','un problema piccolo: ossa, reperi, muscoli, connessioni, funzione, caso clinico'],['Maestria','quanto conosci una struttura, da 0 a 3, separata per nome, origine e inserzione, funzione'],
  ['Passo fatto','tutte le sue strutture almeno a maestria 2'],['In orbita','satellite con almeno un passo fatto'],['Acceso','satellite con tutti i passi fatti'],
  ['Stella guida ★','il passo che ti consigliamo adesso'],['Lo so già','una prova per saltare un passo che conosci già (una al giorno per passo)'],
  ['Cuori','3 per lezione: ogni errore ne toglie uno'],['Obiettivo del giorno','gli XP da fare oggi; con almeno 30 XP il giorno conta per la serie'],
  ['Scudo 🛡','uno ogni 7 giorni di serie (al massimo 2): salva la serie se salti un giorno'],['Da verificare','testo scritto dall\'AI, non ancora controllato da un docente']];
 return `<details class="gloss"><summary>Glossario: le parole dell'app</summary><dl>${G.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></details>`;
}

/* ---------- clic e scelte ---------- */
export function pathClick(e){
 if(app.L){const f=e.target.closest('form');if(!f)lessonClick(e);return;}
 const b=e.target.closest('[data-p]');if(!b||b.tagName==='SELECT')return;
 e.preventDefault();
 const a=b.dataset.p;
 if(a==='mode'){ui.mode=b.dataset.v;}
 else if(a==='lvl'){ui.lvl=b.dataset.lvl;if(ui.lvl==='pianeta')ui.p=b.dataset.id;}
 else if(a==='planet'){ui.lvl='pianeta';ui.p=b.dataset.id;}
 else if(a==='sat'){ui.lvl='satellite';ui.s=b.dataset.id;P.setLast(ui.s);save();}
 else if(a==='cont'){const g=P.guide();ui.lvl='satellite';ui.s=g.sat.id;keep();if(P.stepOpen(g.sat,g.ps)&&(g.ps.tipo!=='progetto'||P.passi(g.sat).slice(0,-1).every(P.stepDone)))return go(g.sat,g.ps,g.ps.tipo==='progetto'?(P.casoOf(g.sat)?'caso':'quiz'):'lezione');}
 else if(a==='go'){const sat=P.satById(ui.s),ps=P.passi(sat).find(p=>p.id===b.dataset.id);keep();return go(sat,ps,b.dataset.k);}
 keep();renderPath();
 const f=$('panel').querySelector('.crumbs [aria-current]');f?.setAttribute('tabindex','-1');
}
function go(sat,ps,kind){
 if(!startLesson(sat,ps,kind)){toast('Nessuna domanda disponibile per questo passo.');renderPath();return;}
 hooks.setTab('path');
}
export function pathChange(e){
 const s=e.target.closest('select[data-p=goal]');if(!s)return;
 P.setGoal(+s.value);save();renderPath();
}
export function pathSubmit(e){if(app.L)lessonSubmit(e);}
