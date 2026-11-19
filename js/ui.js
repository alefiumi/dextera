/* Cambio di modulo e di tab, gestione dei clic su figura, pannello e barra in basso. */
import {$} from './util.js';
import {app,S,save,saveGrp,head,touchStreak,bump,queue,itemOf} from './state.js';
import {buildFig,boneAt,slotAt,clearMarks,refreshMastery,resetZoom,zoomAt,showMuscle,muscleHtml,takePan,setView,focusItem,baseView,viewMenu,closeViewMenu,doubleTapZoom} from './figure.js';
import {renderExplore,showNc,selectBone} from './explore.js';
import {renderMenu,zoneTap,zoneClick,clearGhosts,startGame,nextQ,answerFind,answerMusc,answerBridge,answerFunc,answerNc,answerCase,bridgePrompt,casePanel} from './game.js';
import {placeAttempt,freeDrop} from './puzzle.js';
import {renderProg} from './progress.js';
import {renderSocial,loadSocial,setSocialOpen} from './social.js';
import {renderPath,initPath,pathClick,pathChange,pathSubmit} from './path.js';
import {lessonTap,lessonClick,lessonSubmit,leaveZone} from './lezione.js';
import {showInstall,promptInstall,installNow} from './install.js';
import * as P from './percorso.js';

export function useMod(id){
 const MOD=app.MODS[id];if(!MOD)return;
 app.MOD=MOD;app.B=MOD.B;app.GR=MOD.GR;app.M=MOD.M;app.CASES=MOD.CASES;app.VB={x:0,y:0,w:MOD.W,h:MOD.H};app.G=null;app.sel=null;
 buildFig();setTab(app.tab);
}
// Scheda Atlante: atlante 2D (figura e scheda, l'ex Esplora) o atlante 3D, scelti con i due pulsanti in alto (#asw).
// L'atlante 3D è una pagina a sé (atlante/index.html) in un iframe: si carica la prima volta che si apre e resta in
// memoria, così passando da una scheda all'altra non si perde la vista. La scelta 2D/3D resta salvata (dextera-atlante).
const AV='dextera-atlante';
try{app.av=localStorage.getItem(AV)==='3d'?'3d':'2d';}catch(e){app.av='2d';}
function showAtlas(on){
 $('fig').hidden=$('pw').hidden=on;$('atlas').hidden=!on;
 if(on&&!$('atlas').firstChild)$('atlas').innerHTML='<iframe src="atlante/index.html" title="Atlante 3D" allow="fullscreen"></iframe>';
}
function setAv(v){app.av=v;try{localStorage.setItem(AV,v);}catch(e){}if(app.tab==='atlas')setTab('atlas');}
$('asw').addEventListener('click',e=>{const b=e.target.closest('[data-av]');if(b&&b.dataset.av!==app.av)setAv(b.dataset.av);});
// Giochi 3D: la partita si svolge nell'atlante, che rimanda qui ogni risposta per XP, serie e maestria.
let atlasReady=false,pending3d=null;
const atlasWin=()=>$('atlas').querySelector('iframe')?.contentWindow;
// casi clinici e nervi cranici stanno nei contenuti dell'app: viaggiano con il messaggio
// neurologia: le voci da toccare (tutto il corso o i satelliti di una zona della Palestra) viaggiano con il messaggio
const gameMsg=(set,neuro)=>({bm:1,type:'game',set,cases:(app.MODS.corpo&&app.MODS.corpo.CASES)||[],nc:app.NC,neuro:neuro||[]});
function play3d(set,sat){
 const neuro=set==='neuro'?P.neuro3d(sat?[P.satById(sat)].filter(Boolean):null):null;
 app.av='3d';setTab('atlas');
 if(atlasReady)atlasWin().postMessage(gameMsg(set,neuro),location.origin);else pending3d=[set,neuro];
}
window.addEventListener('message',e=>{
 const d=e.data;if(e.origin!==location.origin||!d||!d.bm||e.source!==atlasWin())return;
 if(d.type==='ready'){atlasReady=true;if(pending3d){atlasWin().postMessage(gameMsg(...pending3d),location.origin);pending3d=null;}}
 else if(d.type==='res'){touchStreak();if(d.ok){S.xp+=10;S.ok++;bump(d.key,1);}else{S.ko++;bump(d.key,-1);}save();head();}
 else if(d.type==='end'){if(d.done)S.xp+=20;queue.add({module:'3d',mode:d.set,score:d.score|0,total:d.total|0,xp:d.gain|0});save();head();}
 else if(d.type==='menu')setTab('play');
});
/* Schede: Percorso (path), Palestra (play, l'ex Gioca), Atlante (atlas: 2D o 3D), Flotta (soc, l'ex Amici).
   Il Profilo (prog) non ha una scheda: si apre toccando la foto in alto (#me). */
export function setTab(t){
 if(t!=='play'&&app.L?.tab==='play')leaveZone(); // allenamento della Palestra lasciato a metà: si chiude (torna la lezione messa da parte)
 app.tab=t;document.body.classList.toggle('pg',t==='prog'||t==='soc'||(t==='path'&&!app.L)); // percorso (fuori dalla lezione), profilo e flotta: tutto lo schermo, senza figura
 document.querySelectorAll('body>nav button').forEach(b=>{b.classList.toggle('on',b.dataset.t===t);b.setAttribute('aria-selected',b.dataset.t===t);});
 if(t!=='prog')$('pw').setAttribute('aria-labelledby','tab-'+t);
 $('me').classList.toggle('on',t==='prog');
 $('asw').hidden=t!=='atlas';$('asw').querySelectorAll('[data-av]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.av===app.av));
 const a3=t==='atlas'&&app.av==='3d';showAtlas(a3);if(a3)return;
 clearGhosts();clearMarks();baseView();resetZoom(false);refreshMastery();({path:renderPath,atlas:renderExplore,play:renderMenu,prog:renderProg,soc:renderSocial})[t]();if(t==='soc')loadSocial();
}
$('me').addEventListener('click',()=>setTab('prog'));
setSocialOpen(()=>app.tab==='soc');
/* Freccia sul bordo della scheda sotto la figura: la abbassa (resta una striscia con l'inizio del testo, la figura si allarga)
   e la rialza. La scelta resta salvata (dextera-fold). */
const FOLD='dextera-fold';
function setFold(f){$('pw').classList.toggle('fold',f);const t=f?'Rialza la scheda':'Abbassa la scheda';$('fold').title=t;$('fold').setAttribute('aria-label',t);try{localStorage.setItem(FOLD,f?'1':'');}catch(e){}}
try{setFold(!!localStorage.getItem(FOLD));}catch(e){setFold(false);}
$('fold').addEventListener('click',()=>setFold(!$('pw').classList.contains('fold')));
document.addEventListener('click',e=>{if(!e.target.closest('#vmenu,[data-mm]'))closeViewMenu();});
document.querySelector('body>nav').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.t);});
$('fig').addEventListener('click',e=>{
 const zb=e.target.closest('.zc button');
 if(zb){const k=zb.dataset.z,VB=app.VB;if(k==='reset')resetZoom(true);else zoomAt(k==='in'?1.5:1/1.5,VB.x+VB.w/2,VB.y+VB.h/2);return;}
 // menu Corpo / Cervello: si apre con il pulsante del modulo, la voce scelta cambia modulo e vista
 const mmb=e.target.closest('[data-mm]');if(mmb){viewMenu(mmb.dataset.mm,mmb);return;}
 const vm=e.target.closest('[data-vm]');
 if(vm){closeViewMenu();const [id,v]=vm.dataset.vm.split(':');
  if(id!==app.MOD.id){app.bases[id]=v;saveGrp();useMod(id);return;}
  setView(v);if(!(app.tab==='play'&&app.G&&app.G.focus))resetZoom(true);
  if(app.tab==='atlas'&&app.sel)selectBone(app.sel);
  // in gioco, con la figura ingrandita su una zona, la si ritrova anche nell'altra vista (la mano dorsale è speculare)
  else if(app.tab==='play'&&app.G&&app.G.focus)setTimeout(()=>focusItem(app.G.focus,(app.G.mode==='puzzle'||app.G.mode==='build')?10:14,true),30);return;}
 if(e.target.closest('#vmenu'))return;
 closeViewMenu();
 // singole o gruppi: cambia le voci dei giochi, quindi la partita in corso ricomincia dal menu
 if(e.target.closest('[data-fg]')){app.grp=!app.grp;saveGrp();const t=app.tab;buildFig();setTab(t);return;}
 if(e.target.closest('.tbar'))return;
 if(takePan())return;
 // Doppio tocco: ingrandisce il punto (o torna alla vista intera). Il tocco singolo vale dopo DBL ms senza un secondo tocco
 // vicino, così chi vuole ingrandire durante un gioco non risponde per sbaglio.
 const x=e.clientX,y=e.clientY,now=Date.now();
 if(tap&&now-tap.t<DBL&&Math.hypot(x-tap.x,y-tap.y)<40){clearTimeout(tap.timer);tap=null;doubleTapZoom(x,y);return;}
 if(tap)clearTimeout(tap.timer);
 tap={t:now,x,y,timer:setTimeout(()=>{tap=null;tapAt(x,y);},DBL)};
});
const DBL=260;let tap=null;
function tapAt(x,y){
 // sid: struttura singola toccata; con i gruppi la voce è il suo gruppo
 if(app.tab==='play'&&app.G&&app.G.mode==='build'){if(app.G.sel)freeDrop(x,y);return;} // Componi: si mette il pezzo scelto dove si tocca
 const G=app.G,g=app.tab==='play'&&G&&G.mode==='puzzle'&&G.sel?slotAt(x,y,G.sel):boneAt(x,y);if(!g)return;const sid=g.dataset.id;
 // lezione del percorso o allenamento per zone della Palestra (app.L.tab='play'): sempre la struttura singola
 if(app.L&&(app.L.tab||'path')===app.tab)lessonTap(sid);
 else if(app.tab==='atlas')selectBone(itemOf(sid));
 else if(app.tab==='play'&&G){
  if(G.mode==='puzzle')placeAttempt(itemOf(sid));
  else if(G.cur&&G.cur.t==='find')answerFind(sid);
  else if(G.cur&&G.cur.t==='bridge')answerBridge(sid);
 }
 else if(app.tab==='play'&&!G)zoneTap(sid); // fuori dai giochi: il foglio della zona di quell'osso
}
$('panel').addEventListener('click',e=>{
 if(app.tab==='path'){pathClick(e);return;} // scheda Percorso e lezioni: path.js e lezione.js
 if(app.tab==='play'&&app.L?.tab==='play'){if(!e.target.closest('form'))lessonClick(e);return;} // allenamento per zone
 const zb=e.target.closest('[data-z]');if(zb&&app.tab==='play'){zoneClick(zb);return;}
 const t=e.target.closest('button,.row');if(!t)return;
 const G=app.G;
 if(t.classList.contains('mc')&&t.dataset.sb){selectBone(t.dataset.sb);focusItem(t.dataset.sb,20);}
 else if(t.classList.contains('mc')){const m=app.M.find(x=>x.id===t.dataset.m);const ok=showMuscle(m);$('mdet').innerHTML=muscleHtml(m)+(ok?'':'<p class="mut">Da questa vista i punti di attacco non si vedono: prova l\'altra vista.</p>');}
 else if(t.classList.contains('mode')){const m=t.dataset.mode;if(m.startsWith('3d-'))play3d(m.slice(3),t.dataset.sat);else startGame(m);}
 else if(t.classList.contains('opt')&&G&&G.cur.t==='musc')answerMusc(t.dataset.id);
 else if(t.classList.contains('opt')&&G&&G.cur.t==='func')answerFunc(t.dataset.id);
 else if(t.classList.contains('opt')&&G&&G.cur.t==='nc')answerNc(t.dataset.k);
 else if(t.classList.contains('act')){const a=t.dataset.act;if(a==='ncl')showNc();else if(a==='inst')installNow();else if(a==='insthelp')showInstall();else if(a==='prompt')promptInstall();else renderExplore();}
 else if(t.classList.contains('opt')&&G&&G.cur.t==='case')answerCase(t.dataset.o);
 else if(t.classList.contains('more')&&G&&G.cur.t==='case'){G.cur.clues++;casePanel();}
 else if(t.classList.contains('undo')&&G&&G.cur.t==='bridge'){G.cur.step=0;G.cur.first=null;clearMarks();bridgePrompt();}
 else if(t.classList.contains('next'))nextQ();
 else if(t.classList.contains('again'))startGame(G.mode);
 else if(t.classList.contains('menu'))renderMenu();
 else if(t.classList.contains('row')){app.av='2d';if(t.dataset.mod&&t.dataset.mod!==app.MOD.id){app.tab='atlas';useMod(t.dataset.mod);}setTab('atlas');selectBone(t.dataset.id);}
 else if(t.dataset.go){if(t.dataset.go==='atlas')app.av='2d';setTab(t.dataset.go);}
});
// scheda Percorso: scelta dell'obiettivo del giorno e risposte scritte delle lezioni
$('panel').addEventListener('change',e=>{if(app.tab==='path')pathChange(e);});
// mappa del percorso: i corpi celesti (link SVG con role=button) si aprono anche con Invio e Spazio
$('panel').addEventListener('keydown',e=>{const a=(e.key==='Enter'||e.key===' ')&&e.target.closest?.('svg a[role=button]');if(a){e.preventDefault();a.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
$('panel').addEventListener('submit',e=>{if(app.tab==='path')pathSubmit(e);else if(app.tab==='play'&&app.L?.tab==='play')lessonSubmit(e);});
initPath({useMod,setTab});
