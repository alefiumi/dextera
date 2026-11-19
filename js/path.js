/* Scheda Percorso (fase 1, sezioni 4 e 7 della specifica): «Continua» in cima, mappa universo → sistema → pianeta → satellite
   con le briciole di pane e l'interruttore Mappa / Elenco, i 6 passi del satellite, obiettivo del giorno e serie.
   La mappa è un SVG leggero: orbite ferme, movimento solo come animazione d'ingresso, ogni corpo celeste si tocca su almeno 44 pt.
   Le regole stanno in percorso.js, la lezione in lezione.js. Scelte dell'interfaccia in 'dextera-percorso-ui'. */
import {$,toast} from './util.js';
import {app,S,save,head} from './state.js';
import * as P from './percorso.js';
import {startLesson,startReview,startExam,renderLesson,lessonClick,lessonSubmit,setLessonExit} from './lezione.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UK='dextera-percorso-ui';
export const giorni=n=>(n||0)===1?'1 giorno di fila':`${n||0} giorni di fila`;
let ui={lvl:'sistema',p:'',s:'',mode:'mappa',c:''};
try{ui={...ui,...JSON.parse(localStorage.getItem(UK)||'{}')};}catch(e){}
P.setCorso(ui.c); // corso aperto (ui.c, '' = quello del percorso pubblicato)
const keep=()=>{try{localStorage.setItem(UK,JSON.stringify(ui));}catch(e){}};
let hooks={useMod:()=>{},setTab:()=>{},play3d:()=>{}};
// ui.js passa useMod e setTab (niente import circolari)
export function initPath(h){
 hooks=h;
 setLessonExit((mod,go)=>{
  if(mod){hooks.useMod(mod);return;}
  if(go){ui.lvl='satellite';ui.s=go.sat.id;keep();}
  hooks.setTab('path');
 });
}

// apre un satellite nella scheda Percorso (dal foglio della zona della Palestra)
export function openSat(id){ui.lvl='satellite';ui.s=id;keep();hooks.setTab('path');}

const PROB={ossa:'Riconoscerle sulla figura',reperi:'Riconoscerli e trovare il loro osso',muscoli:'Riconoscerli',connessioni:'Da dove partono e dove arrivano',funzione:'Cosa fanno',progetto:'Il caso clinico della regione'};
// passi del corso di neurologia
const PROBN={strutture:'Riconoscerle e sapere che cosa sono',dove:'Dove si trovano',funzione:'Che cosa fanno',lesione:'Che cosa succede se si danneggiano',connessioni:'Con che cosa sono collegate',progetto:'Il caso clinico'};
const neuroC=c=>c.modulo==='cervello';
// passi dei corsi di cuore e vasi e del respiratorio (fase 6)
const PROBT={strutture:'Riconoscerle sulla figura',descrizione:'Riconoscerle da come sono fatte e da cosa fanno',progetto:'Il caso clinico'};
const probOf=c=>c.modulo==='cervello'?PROBN:c.modulo==='cuore'||c.modulo==='polmoni'?PROBT:PROB;
const ICO={corpo:'🦴',cervello:'🧠',cuore:'🫀',polmoni:'🫁'};
export const icoOf=c=>ICO[c?.modulo]||'🎓';
// nome del percorso aperto (catalogo di index.json)
const pName=()=>(P.percorsiCat().find(x=>x.id===P.percorsoId())||{nome:app.PERCORSO?.nome||'Percorso completo'}).nome;
// simboli degli stati (oltre al colore e alla parola): cerchio vuoto, anello, pieno; pieno con l'orologio (da ripassare),
// pieno con i raggi (brillante)
const RAYS=(cx,cy,r)=>[0,45,90,135,180,225,270,315].map(a=>{const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);return `<line x1="${(cx+c*(r+2)).toFixed(1)}" y1="${(cy+s*(r+2)).toFixed(1)}" x2="${(cx+c*(r+5)).toFixed(1)}" y2="${(cy+s*(r+5)).toFixed(1)}"/>`;}).join('');
const CLOCK=(cx,cy,r)=>`<path class="clk" d="M${cx} ${cy-r*.6}V${cy}l${r*.45} ${r*.3}" fill="none"/>`;
export function sym(st,r=9,cx=0,cy=0){
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
// colori dei pianeti: una famiglia per ogni sole (stesso ordine di SUNS), un tono diverso per ogni pianeta del corso; sempre colorati,
// anche «da iniziare» (solo più scuri). Corpo (sole giallo): toni caldi senza l'oro dei satelliti accesi; neurologia (sole lilla): viola
const PCS=[
 [['#fdba74','#ea580c'],['#fda4af','#e11d48'],['#f0b48a','#9a3412'],['#fcd34d','#b45309'],['#f9a8d4','#be185d']],
 [['#ddd6fe','#7c3aed'],['#f5d0fe','#a21caf'],['#c7d2fe','#4338ca'],['#f0c6e8','#9d2b7a'],['#e9d5ff','#6b21a8']],
 [['#fecaca','#dc2626'],['#fda4af','#be123c'],['#fdba74','#c2410c'],['#f9a8d4','#9d174d'],['#fca5a5','#7f1d1d']],
 [['#bfdbfe','#2563eb'],['#a5f3fc','#0891b2'],['#c7d2fe','#4f46e5'],['#99f6e4','#0f766e'],['#93c5fd','#1e3a8a']],
 [['#bbf7d0','#16a34a'],['#d9f99d','#65a30d'],['#99f6e4','#0d9488'],['#a7f3d0','#047857'],['#fef08a','#a16207']]];
// sole di ogni corso nel colore del suo satellite nel logo di avvio (COLORI in logo.js, stessa posizione in mappa.json): corpo giallo,
// neurologia viola, poi rosso, azzurro, verde
const SUNS=[['#fff3c4','#f6b93b','#e07b12'],['#ede9fe','#a78bfa','#6d28d9'],['#fee2e2','#f87171','#b91c1c'],['#dbeafe','#60a5fa','#1d4ed8'],['#d1fae5','#34d399','#047857']];
const sunIdx=c=>Math.max(0,app.MAPPA.corsi.indexOf(c))%SUNS.length;
const DEFS=`<defs>${SUNS.map(([a,b,c],i)=>`<radialGradient id="gsun${i}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient><radialGradient id="ghs${i}"><stop offset=".55" stop-color="${b}" stop-opacity=".35"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>`).join('')}
 <radialGradient id="ghalo"><stop offset=".55" stop-color="#f6b93b" stop-opacity=".35"/><stop offset="1" stop-color="#f6b93b" stop-opacity="0"/></radialGradient>
 <radialGradient id="glit" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f0b429"/></radialGradient>
 <radialGradient id="goff" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#6b7499"/><stop offset="1" stop-color="#363d5e"/></radialGradient>
 ${PCS.flatMap((F,f)=>F.map(([a,b],k)=>`<radialGradient id="gp${f}-${k}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient><radialGradient id="gh${f}-${k}"><stop offset=".45" stop-color="${a}" stop-opacity=".55"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>`)).join('')}</defs>`;
const svgOpen=(h,label)=>`<svg class="map" viewBox="0 0 360 ${h}" role="group" aria-label="${esc(label)}">${DEFS}${stars(360,h,260)}`;
// colore del pianeta: famiglia del sole del suo corso, tono dalla posizione nel corso
const pcol=pl=>{const c=P.corsoOf(pl),F=PCS[sunIdx(c)];return sunIdx(c)+'-'+Math.max(0,P.pianeti(c).indexOf(pl))%F.length;};
// pianeta con la sua luce (planetGlow in percorso.js): da iniziare colorato ma scuro (velo) e senza alone; poi l'alone cresce e
// il velo si toglie man mano che si avanza; dopo l'esame cala piano piano quando si avvicina il ripasso; orologio se da ripassare
function planetBody(pl,x,y,r){
 const g=P.planetGlow(pl),v=g.v,f=n=>n.toFixed(2),i=pcol(pl);
 const halo=v>0?`<circle cx="${x}" cy="${y}" r="${f(r*(1.35+.75*v))}" fill="url(#gh${i})" opacity="${f(.25+.75*v)}"/>`:'';
 const body=`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gp${i})"/>`;
 const veil=g.st==='nuovo'?.32:.4*(1-v),vl=veil>.01?`<circle cx="${x}" cy="${y}" r="${r}" fill="#05071a" opacity="${f(veil)}"/>`:'';
 const ring=g.st==='esperto'&&v>.9?`<circle cx="${x}" cy="${y}" r="${f(r+3)}" fill="none" stroke="#fde68a" stroke-opacity=".7" stroke-width="1.2"/>`:'';
 const cr=Math.max(5,r*.32),cx=f(x+r*.72),cy=f(y-r*.72);
 const clk=g.st==='ripassare'&&r>=10?`<circle cx="${cx}" cy="${cy}" r="${f(cr)}" class="sy rip"/>${CLOCK(+cx,+cy,cr-1)}`:'';
 return halo+body+vl+ring+clk;
}
// testo della luce di un pianeta per le etichette e il lettore di schermo
const glowTxt=g=>g.st==='corso'?`${P.PSTATI.corso} · ${Math.round(g.p*100)}%`:P.PSTATI[g.st];
const sun=(x,y,r,c)=>{const i=sunIdx(c);return `<circle cx="${x}" cy="${y}" r="${r*1.9}" fill="url(#ghs${i})"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gsun${i})"/>`;};

// avviso dei passi fatti e dei satelliti accesi: uno o due per nome, di più in un riassunto breve
function rwText(rw){
 if(rw.length<=2)return rw.map(r=>r.t==='satellite'?`🌟 ${r.sat.nome} acceso! +${r.xp} XP`:`🎉 ${r.ps.nome} (${r.sat.nome}) fatto! +${r.xp} XP`).join(' · ');
 const ns=rw.filter(r=>r.t==='satellite').length,np=rw.length-ns,xp=rw.reduce((a,r)=>a+r.xp,0);
 return `🎉 ${[np?`${np} ${np===1?'passo fatto':'passi fatti'}`:'',ns?`${ns} ${ns===1?'satellite acceso':'satelliti accesi'}`:''].filter(Boolean).join(' e ')}! +${xp} XP`;
}
export function renderPath(){
 if(!P.ready()){$('panel').innerHTML=`<div class="path"><div class="h">Il tuo percorso</div><p class="mut">I contenuti del percorso non sono ancora su questo telefono: apri l'app una volta con la connessione.</p></div>`;return;}
 if(app.L){renderLesson();return;} // renderLesson cambia figura se la domanda è di un altro corso
 if(!S.studio)return studioScreen(); // «Cosa studi?» alla prima apertura (fase 6)
 const rw=P.checkProgress();if(rw.length){save();head();toast(rwText(rw));}
 // il corso aperto segue il satellite (aperto dalla Palestra, dal ripasso o da un altro corso)
 const sat0=ui.lvl==='satellite'&&ui.s&&P.satById(ui.s);if(sat0&&P.corsoOf(sat0)!==P.corso()){ui.c=P.corsoOf(sat0).id;P.setCorso(ui.c);keep();}
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
   ${pbar(pl_lit,L.length)}<p class="pn">${pl_lit} accesi su ${L.length}</p>${glowHtml(pl)}
   <ul class="sl">${L.map(s=>srow(s,g)).join('')}</ul>${legend()}</div>${examCard(pl)}<div class="card info">${examHtml(pl)}</div>`;
 }
 if(ui.lvl==='universo')return (ui.arr?arrivoHtml(ui.arr):'')+`<div class="card info"><div class="kick">Universo</div><h2>Cosa studi?</h2>
  <p class="mut">Ogni percorso è lo stesso universo visto con lenti diverse: i progressi valgono in tutti. Ogni corso è un sistema solare: i pianeti sono le grandi parti della materia, i satelliti gli argomenti da studiare. I corsi che segni vengono prima e da loro partono Continua e il Ripasso del giorno.</p>
  ${studioForm(P.percorsoId(),S.studio?.corsi||[],false)}
  ${pbar(lit,all.length)}<p class="pn">${esc(C.nome)}: ${lit} satelliti accesi su ${all.length}</p></div>`;
 return `<div class="card info"><div class="kick">Sistema · ${esc(pName())}</div><h2>${esc(C.nome)}</h2>
  <p class="mut">${P.pianeti().length} pianeti e ${all.length} satelliti, tutti aperti: parti ${neuroC(C)?'dall\'argomento':'dalla regione'} che stai studiando a lezione. Tocca un pianeta per vedere i suoi satelliti.</p>${P.corsi().length>1?`<button class="lnk" data-p="lvl" data-lvl="universo">Cambia corso</button>`:''}
  ${pbar(lit,all.length)}<p class="pn">${lit} satelliti accesi su ${all.length}</p>${legend()}</div>`;
}
// riga sulla luce del pianeta nel suo riquadro: a parole cosa dice il disegno
function glowHtml(pl){
 const g=P.planetGlow(pl);
 const t={nuovo:'Il pianeta è spento: si accende man mano che fai i passi dei suoi satelliti.',
  corso:`Il pianeta si sta accendendo: ${Math.round(g.p*100)}% del percorso fatto.`,
  pronto:"Tutti i satelliti sono accesi: supera l'esame per dare al pianeta la luce piena.",
  esperto:g.f>=.99?'Luce piena: hai superato l\'esame e i ripassi sono in ordine.':'Il pianeta si scurisce piano piano quando si avvicina il ripasso: ripassa per tenerlo acceso.',
  ripassare:'Alcune strutture sono da ripassare: il pianeta si è scurito. Ripassa per riaccenderlo.'}[g.st];
 return `<p class="glow"><b>${esc(P.PSTATI[g.st])}.</b> ${esc(t)}</p>`;
}
// piccole lune intorno a un pianeta: una per satellite, nel colore del suo stato
function moons(x,y,ss,rr=29){
 return ss.map((s,k)=>{const a=(-90+k*360/ss.length)*Math.PI/180,mx=x+rr*Math.cos(a),my=y+rr*Math.sin(a),st=P.look(s);
  return st==='ripassare'?`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" class="sy rip"/>`:st==='acceso'||st==='brillante'?`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" fill="url(#glit)"/>`:st==='orbita'?`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.5" class="sy orb" stroke-width="2.2"/>`:`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4" class="moon"/>`;}).join('');
}
/* ---------- «Cosa studi?» (fase 6) ----------
   Scelta del percorso (catalogo di index.json: quelli senza file sono «in arrivo») e dei corsi. Alla prima apertura del Percorso a tutto
   schermo (studioScreen), poi nel riquadro dell'universo, dove ogni modifica vale subito. Salvata in S.studio → tabella dextera_studio. */
let draft=null; // scelta in corso nella schermata della prima apertura {percorso, corsi}
function studioForm(pid,sel,first){
 const cat=P.percorsiCat(),cs=P.corsiDi(pid),on=c=>!sel.length||sel.includes(c.id);
 return `<fieldset class="pstudio"><legend class="kick">Percorso</legend>${cat.map(x=>`<label class="popt${x.ok?'':' off'}"><input type="radio" name="spercorso" data-p="spercorso" value="${esc(x.id)}"${x.id===pid?' checked':''}${x.ok?'':' disabled'}>
   <span><b>${esc(x.nome)}</b>${x.bozza?' <small class="tag">bozza</small>':''}${x.ok?'':' <small class="mut">in arrivo</small>'}</span></label>`).join('')}</fieldset>
  ${materieHtml(pid)}<fieldset class="pstudio"><legend class="kick">I tuoi corsi</legend>${P.arrivoDi(pid).length?'<p class="mut">Già da studiare: l\'anatomia, che nel programma del test sta in Biologia («Anatomia e fisiologia dell\'uomo»).</p>':''}${cs.map(c=>`<label class="popt"><input type="checkbox" data-p="scorso" value="${esc(c.id)}"${on(c)?' checked':''}>
   <span>${icoOf(c)} <b>${esc(c.nome)}</b> <small class="mut">${P.pianeti(c).length||c.pianeti.length} pianeti</small></span></label>`).join('')}
</fieldset>`;
}
// materie di un corso «in arrivo» del percorso (Test UCBM): un riquadro apribile per materia con gli argomenti del programma
const MICO={'ucbm-biologia':'🧬','ucbm-chimica':'⚗️','ucbm-fisica':'🧲'};
function materieHtml(pid){
 return P.arrivoDi(pid).map(c=>`<fieldset class="pstudio materie"><legend class="kick">Le materie del test</legend>
  <p class="mut">${c.pianeti.map(pl=>esc(pl.nome)).join(', ')}${c.pianeti.every(pl=>pl.domande_test)?`: ${c.pianeti.map(pl=>pl.domande_test).join(' + ')} domande`:''}. Tocca una materia per vedere gli argomenti. Le domande arriveranno.</p>
  ${c.pianeti.map(pl=>`<details class="mat"><summary><span>${MICO[pl.id]||'🪐'} <b>${esc(pl.nome)}</b> <small class="mut">${pl.domande_test?pl.domande_test+' domande · ':''}${pl.satelliti.length} argomenti</small></span></summary>
   <ul class="sl arr">${pl.satelliti.map(s=>`<li><b>${esc(s.nome)}</b>${s.programma?`<br><small class="mut">${esc(s.programma)}</small>`:''}</li>`).join('')}</ul></details>`).join('')}
  ${c.fonte?`<p class="mut"><small>${esc(c.fonte)}</small></p>`:''}</fieldset>`).join('');
}
function studioScreen(){
 const d=draft||(draft={percorso:'base',corsi:[]});
 $('panel').innerHTML=`<div class="path pv-studio"><div class="card info studio"><div class="kick">Benvenuto nel percorso</div><h2 id="sth" tabindex="-1">Cosa studi?</h2>
  <p class="mut">Scegli il percorso e i corsi che ti interessano: vengono prima sulla mappa e da loro partono Continua, la stella guida e il Ripasso del giorno. Gli altri corsi restano aperti e i progressi valgono ovunque. Puoi cambiare quando vuoi dall'universo.</p>
  ${studioForm(d.percorso,d.corsi,true)}
  <button class="btn" data-p="sgo">Inizia</button><button class="btn alt" data-p="sskip">Decidi dopo</button></div></div>`;
 try{$('sth').focus({preventScroll:true});}catch(e){}
}
// riquadro di un corso «in arrivo» (test UCBM): pianeti e satelliti con il programma, senza domande
function arrivoHtml(id){
 const c=P.corsiArrivo().find(x=>x.id===id);if(!c)return '';
 return `<div class="card info arrivo"><div class="kick">In arrivo · ${esc(pName())}</div><h2>${esc(c.nome)}</h2>${c.nota?`<p class="mut">${esc(c.nota)}</p>`:''}
  ${c.pianeti.map(pl=>`<h3 class="lp">🪐 ${esc(pl.nome)}${pl.domande_test?` <span class="mut">· ${pl.domande_test} domande nel test</span>`:''}</h3><ul class="sl arr">${pl.satelliti.map(s=>`<li><b>${esc(s.nome)}</b>${s.programma?`<br><small class="mut">${esc(s.programma)}</small>`:''}</li>`).join('')}</ul>`).join('')}
  <button class="lnk" data-p="arrx">Chiudi</button></div>`;
}
function universeSvg(){
 const C=P.corso(),CS=P.corsi(),mine=CS.filter(P.isMine),rest=CS.filter(c=>!P.isMine(c)),AR=P.corsiArrivo();
 // ogni corso è un piccolo sistema (sole, pianeti, lune dei satelliti), due per riga: prima i corsi scelti, poi gli altri, poi quelli in arrivo
 const L=[...mine,...rest,...AR],rows=Math.ceil(L.length/2),H=Math.max(390,rows*176+64),pos=i=>[i%2?268:92,98+Math.floor(i/2)*176];
 const sys=(c,[X,Y])=>{const pl=P.pianeti(c),ss=P.satelliti(null,c),lit=ss.filter(s=>P.lit(s)).length;
  return `<a href="#" data-p="corso" data-id="${esc(c.id)}" role="button" aria-label="${esc(c.nome)}: ${pl.length} pianeti, ${ss.length} satelliti, ${lit} accesi${c===C?', aperto':''}${P.isMine(c)&&S.studio?.corsi?.length?', tra i tuoi corsi':''}"${c===C?' aria-current="true"':''}>
  <circle cx="${X}" cy="${Y}" r="66" class="hit"/>${pl.map((p,i)=>{const r=34+i*10,a=(-110+i*95)*Math.PI/180,x=X+r*Math.cos(a),y=Y+r*Math.sin(a);return `<circle cx="${X}" cy="${Y}" r="${r}" class="orbit"/>${planetBody(p,+x.toFixed(1),+y.toFixed(1),6)}`;}).join('')}
  ${sun(X,Y,20,c)}${svgText(X,Y+82,c.nome,P.isMine(c)?'lab':'lab dim',20)}<text x="${X}" y="${Y+82+14*lines(c.nome,20).length}" text-anchor="middle" class="wd">${pl.length} pianeti · ${ss.length} satelliti</text></a>`;};
 // corso in arrivo: pianeti spenti (senza luce: non ha passi), si tocca per vedere il programma
 const arr=(c,[X,Y])=>`<a href="#" data-p="arrivo" data-id="${esc(c.id)}" role="button" aria-label="${esc(c.nome)}: in arrivo, ${c.pianeti.length} pianeti. Tocca per vedere il programma"${ui.arr===c.id?' aria-current="true"':''}>
  <circle cx="${X}" cy="${Y}" r="66" class="hit"/>${c.pianeti.map((p,i)=>{const r=34+i*10,a=(-110+i*95)*Math.PI/180;return `<circle cx="${X}" cy="${Y}" r="${r}" class="orbit"/><circle cx="${(X+r*Math.cos(a)).toFixed(1)}" cy="${(Y+r*Math.sin(a)).toFixed(1)}" r="5" fill="#7d86ad" opacity=".75"/>`;}).join('')}
  ${sun(X,Y,17,c)}<circle cx="${X}" cy="${Y}" r="17" fill="#05071a" opacity=".35"/>${svgText(X,Y+82,c.nome,'lab dim',20)}<text x="${X}" y="${Y+82+14*lines(c.nome,20).length}" text-anchor="middle" class="wd">in arrivo</text></a>`;
 return `${svgOpen(H,'Universo dei corsi')}<g class="enter">${L.map((c,i)=>c.in_arrivo?arr(c,pos(i)):sys(c,pos(i))).join('')}</g><text x="12" y="${H-8}" class="wd">Tocca un corso</text></svg>`;
}
function systemSvg(g){
 // posizioni fisse; ogni pianeta ha intorno le lune dei suoi satelliti. Etichette sopra i pianeti della metà alta, sotto gli altri
 const L=P.pianeti(),cx=180,cy=228,R=[78,116,150,172],ang=[-90,160,35,-128],gp=P.planetOf(g.sat);
 const orbits=L.map((p,i)=>`<circle cx="${cx}" cy="${cy}" r="${R[i%4]}" class="orbit"/>`).join('');
 const bodies=L.map((p,i)=>{const r=R[i%4],a=ang[i%4]*Math.PI/180,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a),up=y<cy;
  const ss=P.satelliti(p),lit=ss.filter(s=>P.lit(s)).length,orb=ss.filter(s=>P.satState(s)!=='nuovo').length,rp=ss.filter(s=>P.look(s)==='ripassare').length,nl=lines(p.nome,14).length;
  const gl=P.planetGlow(p),wd=`${glowTxt(gl)} · ${lit}/${ss.length} accesi${rp?` · ${rp} da ripassare`:''}`;
  const ty=up?y-46-14*nl:y+48,wy=up?y-44:y+48+14*nl;
  return `<a href="#" data-p="planet" data-id="${esc(p.id)}" role="button" aria-label="${esc(p.nome)}: ${glowTxt(gl)}, ${ss.length} satelliti, ${lit} accesi${orb>lit?`, ${orb-lit} in orbita`:''}${p===gp?', consigliato':''}">
   <circle cx="${x}" cy="${y}" r="38" class="hit"/>${planetBody(p,x,y,16)}${moons(x,y,ss)}${p===gp?`<text x="${x+10}" y="${y-8}" class="star" aria-hidden="true">★</text>`:''}
   ${svgText(x,ty,p.nome,'lab',14)}<text x="${x}" y="${wy}" text-anchor="middle" class="wd">${wd}</text></a>`;}).join('');
 return `${svgOpen(440,'Sistema: '+P.corso().nome)}<g class="enter">${orbits}${sun(cx,cy,22,P.corso())}${bodies}</g><text x="12" y="432" class="wd">Tocca un pianeta</text></svg>`;
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
 const L=P.satelliti(pl),n=L.length,cx=180,cy=190,r=n>4?125:115;
 const pos=L.map((s,i)=>{const a=(-90+i*360/n)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
 const links=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(shared(L[i],L[j]))links.push(`<line x1="${pos[i][0]}" y1="${pos[i][1]}" x2="${pos[j][0]}" y2="${pos[j][1]}" class="link"/>`);
 const bodies=L.map((s,i)=>{const [x,y]=pos[i],st=P.look(s),done=P.passi(s).filter(P.stepDone).length,tot=P.passi(s).length;
  return `<a href="#" data-p="sat" data-id="${esc(s.id)}" role="button"${s===selSat?' aria-current="true"':''} aria-label="${esc(s.nome)}: ${P.STATI[st]}, ${done} passi fatti su ${tot}${s===g.sat?', consigliato':''}">
   <circle cx="${x}" cy="${y}" r="28" class="hit"/>${satBody(st,x,y,15,s===selSat)}${s===g.sat?`<text x="${x+14}" y="${y-13}" class="star" aria-hidden="true">★</text>`:''}
   ${svgText(x,y+32,s.nome,'lab',15)}<text x="${x}" y="${y+32+14*lines(s.nome,15).length}" text-anchor="middle" class="wd">${P.STATI[st]} · ${done}/${tot}</text></a>`;}).join('');
 return `${svgOpen(400,'Pianeta '+pl.nome)}<g class="enter"><circle cx="${cx}" cy="${cy}" r="${r}" class="orbit"/>${links.join('')}
  ${planetBody(pl,cx,cy,34)}${svgText(cx,cy+4-7*(lines(pl.nome,12).length-1),pl.nome,'lab in',12)}${bodies}</g><text x="12" y="390" class="wd">Tocca un satellite</text></svg>`;
}
const srow=(s,g)=>{const st=P.look(s),done=P.passi(s).filter(P.stepDone).length,tot=P.passi(s).length;
 return `<li><button class="srow" data-p="sat" data-id="${esc(s.id)}">${symIcon(st)}<span class="sn">${esc(s.nome)}${s===g.sat?' <span class="star" aria-label="consigliato">★</span>':''}</span><small>${P.STATI[st]} · ${done}/${tot} passi</small></button></li>`;};
function listHtml(g){
 return P.pianeti().map(p=>`<h3 class="lp">🪐 ${esc(p.nome)} <span class="mut">· ${esc(glowTxt(P.planetGlow(p)))}</span>${P.examPassed(p)?` <span class="mut">· 🏅 ${esc(P.expertTitle(p))}</span>`:''}</h3><ul class="sl">`+P.satelliti(p).map(s=>srow(s,g)).join('')+'</ul>').join('');
}
function satHtml(sat,g){
 const st=P.look(sat),L=P.passi(sat),caso=P.casoOf(sat),pl=P.planetOf(sat),PR=probOf(P.corsoOf(sat));
 const steps=L.map((ps,i)=>{
  const open=P.stepOpen(sat,ps),done=P.stepDone(ps),nd=P.node(ps.id),use=P.usable(ps),stars=nd?.stelle||0,isG=ps===g.ps&&sat===g.sat;
  const prev=L.slice(0,i).filter(p=>!P.stepDone(p)).pop();
  let state=done?'Fatto':open?'Da fare':'Bloccato',act='';
  if(ps.tipo==='progetto'){
   act=open?`<button class="btn" data-p="go" data-id="${esc(ps.id)}" data-k="${caso?'caso':'quiz'}">${done?'Rifai':'Inizia'} ${caso?'il caso clinico':'il quiz finale'}</button>`:`<p class="mut">Si apre dopo i passi 1–${L.length-1}.</p>`;
  }else if(!use.length){act=`<p class="mut">Nessuna domanda disponibile ora (dati in verifica).</p>`;}
  else{
   const pv=P.provaOggi(ps.id);
   act=(open?`<button class="btn" data-p="go" data-id="${esc(ps.id)}" data-k="lezione">${done?'Ripeti lezione':'Inizia lezione'}</button>`:`<p class="mut">Dopo il passo ${prev?prev.n:ps.n-1} · oppure mettiti alla prova</p>`)+
    (done?'':`<button class="btn alt" data-p="go" data-id="${esc(ps.id)}" data-k="prova"${pv?' disabled':''}>Lo so già: mettimi alla prova</button>${pv?'<small class="mut">Prova già fatta oggi: riprova domani.</small>':''}`);
  }
  // corso del corpo: ossa, reperi e muscoli si toccano anche sul modello 3D (la maestria è la stessa della lezione)
  const n3=open&&P.T3D[ps.tipo]&&P.corsoOf(sat).modulo==='corpo'?P.corpo3d([sat],ps.tipo).length:0;
  if(n3)act+=`<button class="btn alt" data-p="3d" data-id="${esc(ps.id)}">🧊 Tocca sul modello 3D</button>`;
  const pct=ps.tipo==='progetto'?'':` · ${Math.round(P.stepPct(ps)*use.length)}/${use.length} a maestria 2`;
  return `<li class="step ${i%2?'zr':'zl'}${done?' done':''}${open?' open':' lock'}${isG?' guide':''}"><div class="sc" aria-hidden="true">${done?'✓':open?ps.n:'🔒'}</div>
   <div class="sb"><b>${ps.n}. ${esc(ps.nome)}${isG?' <span class="star" aria-label="consigliato">★</span>':''}</b><small>${PR[ps.tipo]||''}</small>
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
// esame del pianeta (fase 2): si apre con tutti i satelliti accesi; superato dà il titolo «Esperto di…»
function examCard(pl){
 const E=P.R().esame,miss=P.examMissing(pl),pass=P.examPassed(pl),last=P.examLast(pl),T=P.expertTitle(pl);
 const head=`<div class="kick">Esame del pianeta</div>`;
 if(miss)return `<div class="card info exam">${head}<p class="pn">Esame: ${miss===1?'manca 1 satellite':`mancano ${miss} satelliti`}</p>
  <p class="mut">Si apre quando tutti i satelliti di ${esc(pl.nome)} sono accesi. Superato, diventi «${esc(T)}».</p></div>`;
 const tries=last&&last.n?`<p class="mut">Tentativi: ${last.n}${last.best!=null?` · miglior punteggio ${last.best}/${E.domande}`:''}</p>`:'';
 if(pass)return `<div class="card info exam done">${head}<p class="title">🏅 <b>${esc(T)}</b></p><p class="mut">Esame superato${P.examDate(pl)?' il '+esc(P.itDate(P.examDate(pl))):''}. Puoi rifarlo per allenarti: il titolo e gli XP restano quelli.</p>
  ${tries}<button class="btn alt" data-p="esame">Rifai l'esame</button></div>`;
 return `<div class="card info exam">${head}<h2>Pronto per l'esame</h2>
  <p class="mut">${E.domande} domande, ${E.secondi} secondi ciascuna, senza aiuti né cuori, poi un caso clinico senza tempo. Con almeno ${E.soglia} giuste e il caso risolto diventi «${esc(T)}» (+${E.xp} XP).</p>
  ${tries}<button class="btn" data-p="esame">Inizia l'esame</button></div>`;
}
// data d'esame del pianeta (facoltativa): i ripassi delle sue strutture si avvicinano
function examHtml(pl){
 const d=P.exams()[pl.id]||'',left=d?P.daysTo(d):null,min=new Date(Date.now()+864e5).toISOString().slice(0,10);
 return `<label class="exd"><span class="kick">Data dell'esame (facoltativa)</span><input type="date" data-p="exam" data-id="${esc(pl.id)}" value="${esc(d)}" min="${min}"></label>
  <p class="mut">${d&&left>0?`Esame tra ${left===1?'1 giorno':left+' giorni'}: i ripassi di questo pianeta si avvicinano, così ogni struttura si ripassa almeno 2 volte prima.`:d?'La data dell\'esame è passata: i ripassi tornano normali.':'Con una data, i ripassi di questo pianeta si accorciano per arrivare pronti all\'esame.'}</p>`;
}
function glossary(){
 const G=[['Pianeta','una regione del corpo (arto inferiore, colonna e tronco…) o una grande parte della materia (encefalo, midollo…)'],['Satellite','una zona da studiare in 6 passi, come un piccolo progetto'],
  ['Passo','un problema piccolo: ossa, reperi, muscoli, connessioni, funzione, caso clinico'],['Maestria','quanto conosci una struttura, da 0 a 3, separata per nome, origine e inserzione, funzione'],
  ['Passo fatto','tutte le sue strutture almeno a maestria 2'],['In orbita','satellite con almeno un passo fatto'],['Acceso','satellite con tutti i passi fatti'],
  ['Stella guida ★','il passo che ti consigliamo adesso (prima il ripasso del giorno, se c\'è)'],
  ['Ripasso','una struttura a maestria 2 torna dopo 1, 3, 7, 14, 30 e 60 giorni; se sbagli riparte da 1 giorno'],
  ['Ripasso del giorno','al massimo 10 strutture al giorno, le più in ritardo; finirlo vale un giorno di serie'],
  ['Luce','quota delle strutture di un satellite acceso non in ritardo; sotto il 70% è da ripassare'],
  ['Esame del pianeta',`${P.R().esame.domande} domande a tempo e un caso clinico; si apre con tutti i satelliti del pianeta accesi e superato dà il titolo «Esperto di…»`],
  ['Brillante','satellite acceso con tutte le strutture a un intervallo di 30 giorni o più'],['Lo so già','una prova per saltare un passo che conosci già (una al giorno per passo)'],
  ['Cuori','3 per lezione: ogni errore ne toglie uno'],['Obiettivo del giorno','gli XP da fare oggi; con almeno 30 XP il giorno conta per la serie'],
  ['Scudo 🛡','uno ogni 7 giorni di serie (al massimo 2): salva la serie se salti un giorno'],['Da verificare','testo scritto dall\'AI, non ancora controllato da un docente']];
 return `<details class="gloss"><summary>Glossario: le parole dell'app</summary><dl>${G.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></details>`;
}

/* ---------- clic e scelte ---------- */
export function pathClick(e){
 if(app.L){const f=e.target.closest('form');if(!f)lessonClick(e);return;}
 const b=e.target.closest('[data-p]');if(!b||b.tagName==='SELECT'||b.tagName==='INPUT')return;
 e.preventDefault();
 const a=b.dataset.p;
 if(a==='mode'){ui.mode=b.dataset.v;}
 else if(a==='lvl'){ui.lvl=b.dataset.lvl;if(ui.lvl==='pianeta')ui.p=b.dataset.id;}
 else if(a==='planet'){ui.lvl='pianeta';ui.p=b.dataset.id;}
 else if(a==='corso'){ui.c=b.dataset.id;P.setCorso(ui.c);ui.lvl='sistema';ui.arr='';}
 else if(a==='arrivo'){ui.arr=ui.arr===b.dataset.id?'':b.dataset.id;}
 else if(a==='arrx'){ui.arr='';}
 else if(a==='sgo'||a==='sskip'){const d=draft||{percorso:'base',corsi:[]};P.setStudio(a==='sgo'?d.percorso:'base',a==='sgo'?d.corsi:[]);draft=null;ui.lvl='universo';ui.c='';P.setCorso('');save();keep();renderPath();return;}
 else if(a==='sat'){ui.lvl='satellite';ui.s=b.dataset.id;P.setLast(ui.s);save();}
 else if(a==='cont'){const g=P.guide();ui.lvl='satellite';ui.s=g.sat.id;keep();if(P.stepOpen(g.sat,g.ps)&&(g.ps.tipo!=='progetto'||P.passi(g.sat).slice(0,-1).every(P.stepDone)))return go(g.sat,g.ps,g.ps.tipo==='progetto'?(P.casoOf(g.sat)?'caso':'quiz'):'lezione');}
 else if(a==='rip'){let ks=P.dailyLeft();if(!ks.length){ks=P.moreDaily();save();}keep();if(!startReview(P.slotsOf(ks),{daily:true})){toast('Niente da ripassare adesso.');renderPath();return;}return hooks.setTab('path');}
 else if(a==='ripsat'){const sat=P.satById(ui.s);keep();if(!startReview(P.slotsOf(P.satReview(sat)),{sat})){toast('Niente da ripassare in questo satellite.');renderPath();return;}return hooks.setTab('path');}
 else if(a==='esame'){const pl=P.pianeti().find(p=>p.id===ui.p);keep();if(!pl||!startExam(pl)){toast('L\'esame non è ancora disponibile.');renderPath();return;}return hooks.setTab('path');}
 else if(a==='3d'){const sat=P.satById(ui.s),ps=P.passi(sat).find(p=>p.id===b.dataset.id);if(sat&&ps){keep();return hooks.play3d(ps.tipo,sat.id);}}
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
 // «Cosa studi?»: nella prima apertura cambia la bozza, nell'universo vale subito
 const sp=e.target.closest('input[data-p=spercorso]'),sc=e.target.closest('input[data-p=scorso]');
 if(sp||sc){
  const box=e.target.closest('.card'),ids=[...box.querySelectorAll('input[data-p=scorso]')],pid=box.querySelector('input[data-p=spercorso]:checked')?.value||'base';
  let sel=ids.filter(x=>x.checked).map(x=>x.value);if(sel.length===ids.length)sel=[];
  if(sp){const ok=new Set(P.corsiDi(pid).map(c=>c.id));sel=sel.filter(x=>ok.has(x));}
  if(sc&&!ids.some(x=>x.checked)){sc.checked=true;toast('Tieni almeno un corso.');return;}
  if(!S.studio){draft={percorso:pid,corsi:sel};studioScreen();return;}
  P.setStudio(pid,sel);if(sp){ui.c='';P.setCorso('');}save();keep();renderPath();toast(sp?'Percorso: '+pName():'Corsi aggiornati');
  return;
 }
 const x=e.target.closest('input[data-p=exam]');
 if(x){const v=/^\d{4}-\d{2}-\d{2}$/.test(x.value)&&P.daysTo(x.value)>0?x.value:'';P.setExam(x.dataset.id,v);save();renderPath();toast(v?'Data dell\'esame salvata':'Data dell\'esame tolta');return;}
 const s=e.target.closest('select[data-p=goal]');if(!s)return;
 P.setGoal(+s.value);save();renderPath();
}
export function pathSubmit(e){if(app.L)lessonSubmit(e);}
