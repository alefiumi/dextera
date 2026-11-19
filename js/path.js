/* Scheda Percorso (fase 1, sezioni 4 e 7 della specifica): «Continua» in cima, mappa universo → sistema → pianeta → satellite
   con le briciole di pane e l'interruttore Mappa / Elenco, i 6 passi del satellite, obiettivo del giorno e serie.
   La mappa è un SVG leggero: orbite ferme, movimento solo come animazione d'ingresso, ogni corpo celeste si tocca su almeno 44 pt.
   Le regole stanno in percorso.js, la lezione in lezione.js. Scelte dell'interfaccia in 'dextera-percorso-ui'. */
import {$,toast} from './util.js';
import {app,S,save,head} from './state.js';
import * as P from './percorso.js';
import {startLesson,startReview,renderLesson,lessonClick,lessonSubmit,setLessonExit} from './lezione.js';

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
// simboli degli stati (oltre al colore e alla parola): cerchio vuoto, anello, pieno; pieno con l'orologio (da ripassare),
// pieno con i raggi (brillante)
const RAYS=(cx,cy,r)=>[0,45,90,135,180,225,270,315].map(a=>{const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);return `<line x1="${(cx+c*(r+2)).toFixed(1)}" y1="${(cy+s*(r+2)).toFixed(1)}" x2="${(cx+c*(r+5)).toFixed(1)}" y2="${(cy+s*(r+5)).toFixed(1)}"/>`;}).join('');
const CLOCK=(cx,cy,r)=>`<path class="clk" d="M${cx} ${cy-r*.6}V${cy}l${r*.45} ${r*.3}" fill="none"/>`;
function sym(st,r=9,cx=0,cy=0){
 if(st==='brillante')return `<g class="rays">${RAYS(cx,cy,r-3)}</g><circle class="sy acc" cx="${cx}" cy="${cy}" r="${r-3}"/>`;
 if(st==='ripassare')return `<circle class="sy rip" cx="${cx}" cy="${cy}" r="${r}"/>${CLOCK(cx,cy,r)}`;
 if(st==='acceso')return `<circle class="sy acc" cx="${cx}" cy="${cy}" r="${r}"/>`;
 if(st==='orbita')return `<circle class="sy orb" cx="${cx}" cy="${cy}" r="${r-2}" stroke-width="4"/>`;
 return `<circle class="sy nuovo" cx="${cx}" cy="${cy}" r="${r-1}" stroke-width="2"/>`;
}
const symIcon=st=>`<svg class="si" viewBox="-11 -11 22 22" width="22" height="22" aria-hidden="true">${sym(st)}</svg>`;
// testo su più righe nell'SVG (al massimo ~16 caratteri per riga)
function lines(t,max=16){const w=String(t).split(' '),out=[''];for(const x of w){if((out.at(-1)+' '+x).trim().length>max&&out.at(-1))out.push(x);else out[out.length-1]=(out.at(-1)+' '+x).trim();}return out;}
const svgText=(x,y,t,cls,max)=>lines(t,max).map((l,i)=>`<text x="${x}" y="${y+i*14}" text-anchor="middle" class="${cls}">${esc(l)}</text>`).join('');

/* ---------- disegno ----------
   Due zone: .pmain (briciole e mappa, o l'elenco) e .pside (Continua, giorno, riquadro del livello o i passi del satellite).
   Telefono: una sotto l'altra, la mappa intera nello schermo. Computer in orizzontale: mappa a sinistra, riquadro a destra. */
// stelle del fondo: sempre le stesse (generatore pseudo-casuale con seme fisso), niente movimento; anche fuori dal viewBox,
// così sul computer (riquadro più largo del disegno) il cielo riempie tutto il riquadro
function stars(w,h,n,seed=7){let x=seed,o='';const r=()=>(x=(x*16807)%2147483647)/2147483647;
 for(let i=0;i<n;i++)o+=`<circle cx="${(r()*w*3-w).toFixed(1)}" cy="${(r()*h*1.6-h*.3).toFixed(1)}" r="${(r()*1.1+.3).toFixed(2)}" opacity="${(r()*.6+.25).toFixed(2)}"/>`;
 return `<g class="stars" aria-hidden="true">${o}</g>`;}
// sfumature dei corpi celesti (luce dall'alto a sinistra) e alone
const PC=[['#93c5fd','#2563eb'],['#f9a8d4','#db2777'],['#6ee7b7','#059669'],['#fdba74','#ea580c']];
const DEFS=`<defs><radialGradient id="gsun" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff3c4"/><stop offset=".55" stop-color="#f6b93b"/><stop offset="1" stop-color="#e07b12"/></radialGradient>
 <radialGradient id="ghalo"><stop offset=".55" stop-color="#f6b93b" stop-opacity=".35"/><stop offset="1" stop-color="#f6b93b" stop-opacity="0"/></radialGradient>
 <radialGradient id="glit" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f0b429"/></radialGradient>
 <radialGradient id="goff" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#6b7499"/><stop offset="1" stop-color="#363d5e"/></radialGradient>
 ${PC.map(([a,b],i)=>`<radialGradient id="gp${i}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`).join('')}</defs>`;
const svgOpen=(h,label)=>`<svg class="map" viewBox="0 0 360 ${h}" role="group" aria-label="${esc(label)}">${DEFS}${stars(360,h,260)}`;
const halo=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".18"/>`;
const sun=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r*1.9}" fill="url(#ghalo)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gsun)"/>`;

export function renderPath(){
 if(!P.ready()){$('panel').innerHTML=`<div class="path"><div class="h">Il tuo percorso</div><p class="mut">I contenuti del percorso non sono ancora su questo telefono: apri l'app una volta con la connessione.</p></div>`;return;}
 if(app.L){if(app.MOD.id!=='corpo'){hooks.useMod('corpo');return;}renderLesson();return;}
 const rw=P.checkProgress();if(rw.length){save();head();toast(rw.map(r=>r.t==='satellite'?`🌟 ${r.sat.nome} acceso! +${r.xp} XP`:`🎉 ${r.ps.nome} (${r.sat.nome}) fatto! +${r.xp} XP`).join(' · '));}
 const g=P.guide(),C=P.corso();
 const sat=ui.s&&P.satById(ui.s),pl=ui.p&&P.pianeti().find(p=>p.id===ui.p);
 if(ui.lvl==='satellite'&&!sat)ui.lvl='sistema';if(ui.lvl==='pianeta'&&!pl)ui.lvl='sistema';
 const crumbs=ui.lvl==='universo'?[['universo','Universo']]:[['universo','Universo'],['sistema',C.nome]];
 const curP=ui.lvl==='satellite'?P.planetOf(sat):pl;
 if(ui.lvl==='pianeta'||ui.lvl==='satellite')crumbs.push(['pianeta',curP.nome,curP.id]);
 if(ui.lvl==='satellite')crumbs.push(['satellite',sat.nome,sat.id]);
 const bc=`<div class="crumbs" role="navigation" aria-label="Dove sei">${crumbs.map(([l,n,id],i)=>i===crumbs.length-1?`<span aria-current="page">${esc(n)}</span>`:`<button class="lnk" data-p="lvl" data-lvl="${l}"${id?` data-id="${esc(id)}"`:''}>${esc(n)}</button><span aria-hidden="true"> › </span>`).join('')}</div>`;
 const IC={mappa:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4.2" fill="none" transform="rotate(-20 12 12)"/></svg>',elenco:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none"/></svg>'};
 const tog=`<div class="seg2" role="group" aria-label="Vista">${[['mappa','Mappa'],['elenco','Elenco']].map(([v,n])=>`<button data-p="mode" data-v="${v}" aria-pressed="${ui.mode===v}" title="${n}">${IC[v]}<span class="sr">${n}</span></button>`).join('')}</div>`;
 // nel satellite la mappa mostra il suo pianeta con il satellite evidenziato (sul telefono è nascosta: contano i passi)
 const mapBody=ui.mode==='elenco'?`<div class="lcard">${listHtml(g)}</div>`:ui.lvl==='universo'?universeSvg():ui.lvl==='sistema'?systemSvg(g):planetSvg(curP,g,ui.lvl==='satellite'?sat:null);
 const side=ui.lvl==='satellite'?satHtml(sat,g):infoHtml(g,curP);
 // pulsante Indietro: sale di un livello (nell'app installata su iPhone non c'è il tasto del browser)
 const up=ui.lvl==='satellite'?['pianeta',curP.id]:ui.lvl==='pianeta'?['sistema']:ui.lvl==='sistema'?['universo']:null;
 const back=up?`<button class="pback" data-p="lvl" data-lvl="${up[0]}"${up[1]?` data-id="${esc(up[1])}"`:''} aria-label="Indietro">‹</button>`:'';
 $('panel').innerHTML=`<div class="path pv-${ui.lvl}"><section class="pmain" aria-label="Mappa del percorso"><div class="phead">${back}${bc}${tog}</div>${mapBody}</section>
  <div class="pside">${ui.lvl==='satellite'?side+topHtml(g):topHtml(g)+side}${glossary()}</div></div>`;
 // briciole lunghe sul telefono: si vede la fine (dove sei)
 const cr=$('panel').querySelector('.crumbs');if(cr)cr.scrollLeft=cr.scrollWidth;
}
// «Ripasso del giorno» (fase 2): accanto a Continua; con dei ripassi da fare oggi ha lui la stella guida
const ripDue=()=>P.dailyLeft().length;
function ripHtml(){
 const n=ripDue(),more=P.moreAvail(),done=S.day&&S.day.d===P.today()&&S.day.rip;
 if(!n&&!more&&!Object.keys(S.rev||{}).length)return '';
 const sub=n?`${n} ${n===1?'struttura':'strutture'} da richiamare · +${P.R().ripasso.xp_puntuale} XP ciascuna`:done?'Fatto per oggi ✓':more?'Fatto per oggi ✓ · altre in attesa':'Niente da ripassare oggi';
 return `<button class="cont rip${n?'':' quiet'}" data-p="rip"${n||more?'':' disabled'}><span class="ci" aria-hidden="true">${n?'★':'↻'}</span><span class="ct"><span class="cs">Ripasso del giorno</span><b>${n?'Ripassa ora':more?`Altre ${Math.min(P.R().ripasso.altre,more)}`:'Tutto in ordine'}</b><small>${sub}</small></span><span class="cg" aria-hidden="true">›</span></button>`;
}
function topHtml(g){
 const day=S.day&&S.day.d===P.today()?S.day:{xp:0},goal=P.goal(),pct=Math.min(1,(day.xp||0)/goal);
 const ring=`<div class="ring" role="img" aria-label="Obiettivo del giorno: ${day.xp||0} XP su ${goal}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="rb"/><circle cx="18" cy="18" r="15" class="rf" stroke-dasharray="${(pct*94.2).toFixed(1)} 94.2"/></svg><span>${day.xp||0}/${goal}</span></div>`;
 const opts=P.R().obiettivo.scelte.map(v=>`<option value="${v}"${v===goal?' selected':''}>${v} XP · ${v===30?'leggero':v===60?'normale':'intenso'}</option>`).join('');
 const rd=ripDue();
 return `<div class="today">${rd?ripHtml():''}<button class="cont${rd?' quiet':''}" data-p="cont"><span class="ci" aria-hidden="true">${ripDue()?'›':'★'}</span><span class="ct"><span class="cs">Continua</span><b>${esc(g.sat.nome)} · passo ${g.ps.n}</b><small>${esc(g.ps.nome)}</small></span><span class="cg" aria-hidden="true">›</span></button>
  ${rd?'':ripHtml()}<div class="dayrow">${ring}<span class="dst"><b>Oggi</b><span>🔥 ${giorni(S.streak)}${S.shields?` · 🛡 ${S.shields}`:''}</span></span>
  <label class="goal"><span>Obiettivo del giorno</span><select data-p="goal">${opts}</select></label></div></div>`;
}
const legend=()=>`<ul class="legend" aria-label="Legenda">${Object.entries(P.STATI).filter(([k])=>k!=='brillante'&&k!=='ripassare'||Object.keys(S.rev||{}).length).map(([k,v])=>`<li>${symIcon(k)}${esc(v)}</li>`).join('')}<li><span class="star" aria-hidden="true">★</span>Consigliato</li></ul>`;
const pbar=(n,t)=>`<div class="pbar" role="img" aria-label="${n} su ${t}"><i style="width:${t?Math.round(100*n/t):0}%"></i></div>`;
function infoHtml(g,pl){
 const C=P.corso(),all=P.satelliti(),lit=all.filter(s=>P.lit(s)).length;
 if(ui.lvl==='pianeta'){
  const L=P.satelliti(pl),pl_lit=L.filter(s=>P.lit(s)).length;
  return `<div class="card info"><div class="kick">Pianeta</div><h2>${esc(pl.nome)}</h2>
   <p class="mut">${L.length} satelliti. Le linee uniscono quelli che hanno strutture in comune: impararle in uno fa avanzare anche l'altro.</p>
   ${pbar(pl_lit,L.length)}<p class="pn">${pl_lit} accesi su ${L.length}</p>
   <ul class="sl">${L.map(s=>srow(s,g)).join('')}</ul>${legend()}</div><div class="card info">${examHtml(pl)}</div>`;
 }
 if(ui.lvl==='universo')return `<div class="card info"><div class="kick">Universo</div><h2>Cosa studi?</h2>
  <p class="mut">Ogni percorso è lo stesso universo visto con lenti diverse: i progressi valgono in tutti. Ogni corso è un sistema solare: i pianeti sono le regioni del corpo, i satelliti le zone da studiare.</p>
  <label class="psel"><span class="kick">Percorso</span><select data-p="percorso">${PERCORSI.map(([id,n])=>`<option value="${id}"${id===(app.PERCORSO.id||'base')?' selected':id!=='base'?' disabled':''}>${esc(n)}${id!=='base'?' (in arrivo)':''}</option>`).join('')}</select></label>
  ${pbar(lit,all.length)}<p class="pn">${esc(C.nome)}: ${lit} satelliti accesi su ${all.length}</p></div>`;
 return `<div class="card info"><div class="kick">Sistema · ${esc((PERCORSI.find(x=>x[0]===(app.PERCORSO.id||'base'))||PERCORSI[0])[1])}</div><h2>${esc(C.nome)}</h2>
  <p class="mut">${P.pianeti().length} pianeti e ${all.length} satelliti, tutti aperti: parti dalla regione che stai studiando a lezione. Tocca un pianeta per vedere i suoi satelliti.</p>
  ${pbar(lit,all.length)}<p class="pn">${lit} satelliti accesi su ${all.length}</p>${legend()}</div>`;
}
// piccole lune intorno a un pianeta: una per satellite, nel colore del suo stato
function moons(x,y,ss,rr=29){
 return ss.map((s,k)=>{const a=(-90+k*360/ss.length)*Math.PI/180,mx=x+rr*Math.cos(a),my=y+rr*Math.sin(a),st=P.look(s);
  return st==='ripassare'?`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" class="sy rip"/>`:st==='acceso'||st==='brillante'?`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" fill="url(#glit)"/>`:st==='orbita'?`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.5" class="sy orb" stroke-width="2.2"/>`:`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4" class="moon"/>`;}).join('');
}
// percorsi della specifica (fase 6): stesso universo visto con lenti diverse; per ora c'è solo il percorso completo
const PERCORSI=[['base','Percorso completo'],['fisioterapia','Fisioterapia'],['medicina','Medicina'],['mcb','MCB']];
function universeSvg(){
 const C=P.corso(),pl=P.pianeti(),lit=P.satelliti().filter(s=>P.lit(s)).length,n=P.satelliti().length;
 // ogni corso è un piccolo sistema: il sole e i suoi pianeti (con le lune dei satelliti); gli altri corsi (fase 6) spenti
 const mini=(x,y,k,col)=>[...Array(k)].map((_,i)=>{const r=30+i*9,a=(-60+i*97)*Math.PI/180;return `<circle cx="${x}" cy="${y}" r="${r}" class="orbit"/><circle cx="${(x+r*Math.cos(a)).toFixed(1)}" cy="${(y+r*Math.sin(a)).toFixed(1)}" r="4.5" fill="${col?col[i%col.length]:'#7d86ad'}"/>`;}).join('');
 const altri=[['Neuroanatomia','#a78bfa',268,98],['Cuore e vasi','#f87171',92,272],['Respiratorio','#60a5fa',268,272]];
 return `${svgOpen(390,'Universo dei corsi')}<g class="enter">
  <a href="#" data-p="lvl" data-lvl="sistema" role="button" aria-label="${esc(C.nome)}: ${pl.length} pianeti, ${n} satelliti, ${lit} accesi">
  <circle cx="92" cy="98" r="66" class="hit"/>${pl.map((p,i)=>{const r=34+i*10,a=(-110+i*95)*Math.PI/180,x=92+r*Math.cos(a),y=98+r*Math.sin(a);return `<circle cx="92" cy="98" r="${r}" class="orbit"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="url(#gp${i%4})"/>`;}).join('')}
  ${sun(92,98,20)}${svgText(92,180,C.nome,'lab',20)}<text x="92" y="${180+14*lines(C.nome,20).length}" text-anchor="middle" class="wd">${pl.length} pianeti · ${n} satelliti</text></a>
  ${altri.map(([t,c,x,y])=>`<g class="off" aria-hidden="true">${mini(x,y,3)}<circle cx="${x}" cy="${y}" r="17" fill="${c}" opacity=".5"/>${svgText(x,y+70,t,'lab dim',16)}<text x="${x}" y="${y+84}" text-anchor="middle" class="wd">in arrivo</text></g>`).join('')}
  </g><text x="12" y="382" class="wd">Tocca un corso</text></svg>`;
}
function systemSvg(g){
 // posizioni fisse; ogni pianeta ha intorno le lune dei suoi satelliti. Etichette sopra i pianeti della metà alta, sotto gli altri
 const L=P.pianeti(),cx=180,cy=228,R=[78,116,150,172],ang=[-90,160,35,-128],gp=P.planetOf(g.sat);
 const orbits=L.map((p,i)=>`<circle cx="${cx}" cy="${cy}" r="${R[i%4]}" class="orbit"/>`).join('');
 const bodies=L.map((p,i)=>{const r=R[i%4],a=ang[i%4]*Math.PI/180,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a),up=y<cy;
  const ss=P.satelliti(p),lit=ss.filter(s=>P.lit(s)).length,orb=ss.filter(s=>P.satState(s)!=='nuovo').length,rp=ss.filter(s=>P.look(s)==='ripassare').length,nl=lines(p.nome,14).length;
  const wd=`${ss.length} satelliti · ${lit} accesi${orb>lit?` · ${orb-lit} in orbita`:''}${rp?` · ${rp} da ripassare`:''}`;
  const ty=up?y-46-14*nl:y+48,wy=up?y-44:y+48+14*nl;
  return `<a href="#" data-p="planet" data-id="${esc(p.id)}" role="button" aria-label="${esc(p.nome)}: ${ss.length} satelliti, ${lit} accesi${p===gp?', consigliato':''}">
   <circle cx="${x}" cy="${y}" r="38" class="hit"/>${halo(x,y,22,PC[i%4][1])}<circle cx="${x}" cy="${y}" r="16" fill="url(#gp${i%4})"/>${moons(x,y,ss)}${p===gp?`<text x="${x+10}" y="${y-8}" class="star" aria-hidden="true">★</text>`:''}
   ${svgText(x,ty,p.nome,'lab',14)}<text x="${x}" y="${wy}" text-anchor="middle" class="wd">${wd}</text></a>`;}).join('');
 return `${svgOpen(440,'Sistema: '+P.corso().nome)}<g class="enter">${orbits}${sun(cx,cy,22)}${bodies}</g><text x="12" y="432" class="wd">Tocca un pianeta</text></svg>`;
}
// satelliti dello stesso pianeta che condividono strutture (linee sulla mappa)
function shared(a,b){const set=x=>new Set(P.passi(x).flatMap(ps=>Array.isArray(ps.strutture)?ps.strutture:[]));const A=set(a);for(const id of set(b))if(A.has(id))return true;return false;}
// satellite: acceso = pieno dorato, in orbita = anello verde acqua, da iniziare = pieno grigio con bordo (forma diversa oltre al colore)
function satBody(st,x,y,r,sel){
 const ring=sel?`<circle cx="${x}" cy="${y}" r="${r+7}" class="selr"/>`:'';
 if(st==='brillante')return `${ring}<circle cx="${x}" cy="${y}" r="${r+10}" fill="url(#ghalo)"/><g class="rays big">${RAYS(x,y,r+1)}</g><circle cx="${x}" cy="${y}" r="${r}" fill="url(#glit)"/>`;
 if(st==='ripassare')return `${ring}<circle cx="${x}" cy="${y}" r="${r}" class="sy rip"/>${CLOCK(x,y,r-3)}`;
 if(st==='acceso')return `${ring}<circle cx="${x}" cy="${y}" r="${r+8}" fill="url(#ghalo)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#glit)"/>`;
 if(st==='orbita')return `${ring}<circle cx="${x}" cy="${y}" r="${r}" fill="#121833"/><circle cx="${x}" cy="${y}" r="${r-2}" class="sy orb" stroke-width="4"/>`;
 return `${ring}<circle cx="${x}" cy="${y}" r="${r-2}" fill="url(#goff)" stroke="#9aa5cf" stroke-width="1.5"/>`;
}
function planetSvg(pl,g,selSat){
 const L=P.satelliti(pl),n=L.length,cx=180,cy=190,r=n>4?125:115,pi=P.pianeti().indexOf(pl);
 const pos=L.map((s,i)=>{const a=(-90+i*360/n)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
 const links=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(shared(L[i],L[j]))links.push(`<line x1="${pos[i][0]}" y1="${pos[i][1]}" x2="${pos[j][0]}" y2="${pos[j][1]}" class="link"/>`);
 const bodies=L.map((s,i)=>{const [x,y]=pos[i],st=P.look(s),done=P.passi(s).filter(P.stepDone).length,tot=P.passi(s).length;
  return `<a href="#" data-p="sat" data-id="${esc(s.id)}" role="button"${s===selSat?' aria-current="true"':''} aria-label="${esc(s.nome)}: ${P.STATI[st]}, ${done} passi fatti su ${tot}${s===g.sat?', consigliato':''}">
   <circle cx="${x}" cy="${y}" r="28" class="hit"/>${satBody(st,x,y,15,s===selSat)}${s===g.sat?`<text x="${x+14}" y="${y-13}" class="star" aria-hidden="true">★</text>`:''}
   ${svgText(x,y+32,s.nome,'lab',15)}<text x="${x}" y="${y+32+14*lines(s.nome,15).length}" text-anchor="middle" class="wd">${P.STATI[st]} · ${done}/${tot}</text></a>`;}).join('');
 return `${svgOpen(400,'Pianeta '+pl.nome)}<g class="enter"><circle cx="${cx}" cy="${cy}" r="${r}" class="orbit"/>${links.join('')}
  ${halo(cx,cy,44,PC[pi%4][1])}<circle cx="${cx}" cy="${cy}" r="34" fill="url(#gp${pi%4})"/>${svgText(cx,cy+4-7*(lines(pl.nome,12).length-1),pl.nome,'lab in',12)}${bodies}</g><text x="12" y="390" class="wd">Tocca un satellite</text></svg>`;
}
const srow=(s,g)=>{const st=P.look(s),done=P.passi(s).filter(P.stepDone).length,tot=P.passi(s).length;
 return `<li><button class="srow" data-p="sat" data-id="${esc(s.id)}">${symIcon(st)}<span class="sn">${esc(s.nome)}${s===g.sat?' <span class="star" aria-label="consigliato">★</span>':''}</span><small>${P.STATI[st]} · ${done}/${tot} passi</small></button></li>`;};
function listHtml(g){
 return P.pianeti().map(p=>`<h3 class="lp">🪐 ${esc(p.nome)}</h3><ul class="sl">`+P.satelliti(p).map(s=>srow(s,g)).join('')+'</ul>').join('');
}
function satHtml(sat,g){
 const st=P.look(sat),L=P.passi(sat),caso=P.casoOf(sat),pl=P.planetOf(sat);
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
  return `<li class="step ${i%2?'zr':'zl'}${done?' done':''}${open?' open':' lock'}${isG?' guide':''}"><div class="sc" aria-hidden="true">${done?'✓':open?ps.n:'🔒'}</div>
   <div class="sb"><b>${ps.n}. ${esc(ps.nome)}${isG?' <span class="star" aria-label="consigliato">★</span>':''}</b><small>${PROB[ps.tipo]||''}</small>
   <small class="mut">${state}${pct}${stars?` · <span aria-label="${stars} stelle su 3">${'⭐'.repeat(stars)}</span>`:''}</small>${act}</div></li>`;
 }).join('');
 const skip=sat.passi.filter(p=>p.salta).map(p=>p.nome).join(', '),nd=L.filter(P.stepDone).length;
 return `<div class="card info sat"><div class="kick">${esc(pl.nome)} · satellite</div><div class="sath"><h2>${esc(sat.nome)}</h2><span class="badge s-${st}">${symIcon(st)}${P.STATI[st]} · ${nd}/${L.length}</span></div>
  ${pbar(nd,L.length)}${satRev(sat)}
  ${skip?`<p class="mut">Passi saltati in questo satellite (non ci sono strutture): ${esc(skip)}.</p>`:''}<ol class="steps">${steps}</ol></div>`;
}
// luce del satellite e «Ripassa questo satellite» (solo con strutture nel calendario del ripasso)
function satRev(sat){
 const ks=P.satReview(sat);if(!ks.length)return '';
 const lt=P.lit(sat)?Math.round(P.light(sat)*100):null,od=ks.filter(k=>P.daysTo(P.rev(k).due)<=0).length;
 return `<div class="srev">${lt!==null?`<p class="pn">Luce ${lt}%${lt<Math.round(P.R().ripasso.luce_min*100)?' · sotto il 70%: ripassa per riaccenderlo':''}</p>`:''}
  <button class="btn alt" data-p="ripsat">↻ Ripassa questo satellite</button><small class="mut">${ks.length} domande sulle strutture più deboli${od?` · ${od} da ripassare oggi`:''}</small></div>`;
}
// data d'esame del pianeta (facoltativa): i ripassi delle sue strutture si avvicinano
function examHtml(pl){
 const d=P.exams()[pl.id]||'',left=d?P.daysTo(d):null,min=new Date(Date.now()+864e5).toISOString().slice(0,10);
 return `<label class="exd"><span class="kick">Data dell'esame (facoltativa)</span><input type="date" data-p="exam" data-id="${esc(pl.id)}" value="${esc(d)}" min="${min}"></label>
  <p class="mut">${d&&left>0?`Esame tra ${left===1?'1 giorno':left+' giorni'}: i ripassi di questo pianeta si avvicinano, così ogni struttura si ripassa almeno 2 volte prima.`:d?'La data dell\'esame è passata: i ripassi tornano normali.':'Con una data, i ripassi di questo pianeta si accorciano per arrivare pronti all\'esame.'}</p>`;
}
function glossary(){
 const G=[['Pianeta','una regione del corpo (arto inferiore, colonna e tronco…)'],['Satellite','una zona da studiare in 6 passi, come un piccolo progetto'],
  ['Passo','un problema piccolo: ossa, reperi, muscoli, connessioni, funzione, caso clinico'],['Maestria','quanto conosci una struttura, da 0 a 3, separata per nome, origine e inserzione, funzione'],
  ['Passo fatto','tutte le sue strutture almeno a maestria 2'],['In orbita','satellite con almeno un passo fatto'],['Acceso','satellite con tutti i passi fatti'],
  ['Stella guida ★','il passo che ti consigliamo adesso (prima il ripasso del giorno, se c\'è)'],
  ['Ripasso','una struttura a maestria 2 torna dopo 1, 3, 7, 14, 30 e 60 giorni; se sbagli riparte da 1 giorno'],
  ['Ripasso del giorno','al massimo 10 strutture al giorno, le più in ritardo; finirlo vale un giorno di serie'],
  ['Luce','quota delle strutture di un satellite acceso non in ritardo; sotto il 70% è da ripassare'],
  ['Brillante','satellite acceso con tutte le strutture a un intervallo di 30 giorni o più'],['Lo so già','una prova per saltare un passo che conosci già (una al giorno per passo)'],
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
 else if(a==='rip'){let ks=P.dailyLeft();if(!ks.length){ks=P.moreDaily();save();}keep();if(!startReview(P.slotsOf(ks),{daily:true})){toast('Niente da ripassare adesso.');renderPath();return;}return hooks.setTab('path');}
 else if(a==='ripsat'){const sat=P.satById(ui.s);keep();if(!startReview(P.slotsOf(P.satReview(sat)),{sat})){toast('Niente da ripassare in questo satellite.');renderPath();return;}return hooks.setTab('path');}
 else if(a==='go'){const sat=P.satById(ui.s),ps=P.passi(sat).find(p=>p.id===b.dataset.id);keep();return go(sat,ps,b.dataset.k);}
 keep();renderPath();
 if(a==='lvl'||a==='planet'||a==='sat')$('panel').scrollTop=0;
 const f=$('panel').querySelector('.crumbs [aria-current]');f?.setAttribute('tabindex','-1');
}
function go(sat,ps,kind){
 if(!startLesson(sat,ps,kind)){toast('Nessuna domanda disponibile per questo passo.');renderPath();return;}
 hooks.setTab('path');
}
export function pathChange(e){
 const x=e.target.closest('input[data-p=exam]');
 if(x){const v=/^\d{4}-\d{2}-\d{2}$/.test(x.value)&&P.daysTo(x.value)>0?x.value:'';P.setExam(x.dataset.id,v);save();renderPath();toast(v?'Data dell\'esame salvata':'Data dell\'esame tolta');return;}
 const s=e.target.closest('select[data-p=goal]');if(!s)return;
 P.setGoal(+s.value);save();renderPath();
}
export function pathSubmit(e){if(app.L)lessonSubmit(e);}
