/* Scheda Atlante, vista 2D (l'ex Esplora): scheda della struttura e nervi cranici. */
import {$} from './util.js';
import {app,bone,members,itemOf} from './state.js';
import {clearMarks,mark,visible,visibleIn,focusItem,vName} from './figure.js';
import {isStandalone} from './install.js';

// viste in cui la struttura si vede bene (almeno un quarto della sagoma), da suggerire quando nella vista attuale quasi non si vede
function seenIn(id){
 const vs=app.MOD.views.filter(v=>v!==app.view&&visibleIn(id,v)).map(v=>vName(v).toLowerCase());
 const part=members(id).some(m=>bone(m)?.s[app.view]);
 return (part?'In questa vista se ne vede solo una piccola parte.':'Non si vede in questa vista.')+(vs.length?' Si vede bene nella vista '+vs.join(', ')+'.':'');
}
// legenda dei colori della maestria, uguale ai pallini del Percorso
const LEG='<ul class="legend aleg"><li><i class="mdot" aria-hidden="true"></i>da studiare</li><li><i class="mdot m1" aria-hidden="true"></i>iniziato</li><li><i class="mdot m2" aria-hidden="true"></i>in corso</li><li><i class="mdot m3" aria-hidden="true"></i>padroneggiato</li></ul>';
export function renderExplore(){
 app.sel=null;const body=app.MOD.id==='corpo';
 const h=(app.MOD.expl?app.MOD.expl.h:body?'Atlante 2D · lo scheletro':'Atlante 2D · il cervello').replace(/^Atlante 2D · /,'');
 const t=app.MOD.expl?app.MOD.expl.t:body?'Tocca un osso per vedere nome, funzione e muscoli collegati; tocca un muscolo per vedere origine (O) e inserzione (I). In alto scegli la vista (anteriore, posteriore, laterali, superiore, inferiore) e ossa singole o gruppi.':'Tocca una struttura per vedere nome e funzione. In alto scegli la vista (laterali, mediale, anteriore, posteriore, superiore, inferiore o basale) e giri e solchi o lobi e aree.';
 $('panel').innerHTML=`<div class="atl"><div class="kick">Atlante 2D</div><h2>${h[0].toUpperCase()+h.slice(1)}</h2><p class="mut">${t}</p>`+
  '<p class="tip">🔍 Per ingrandire: ＋ −, pizzica o tocca due volte; con un dito sposti la figura ingrandita.</p>'+LEG+
  (app.MOD.id==='cervello'?'<button class="btn alt act wide" data-act="ncl">📖 I 12 nervi cranici</button>':'')+
  (isStandalone()?'':'<div class="card ainst"><b>📲 Usala come un\'app</b><p class="mut">Installata sul telefono si apre a tutto schermo e funziona anche senza rete.</p><button class="btn act" data-act="inst">Installa l\'app</button><button class="lnk act" data-act="insthelp">Altri telefoni e uso offline</button></div>')+
  '<p class="note">Forme ricavate dal modello 3D Z-Anatomy (CC BY-SA 4.0); testi scritti dall\'AI, da verificare.</p></div>';
}
export function showNc(){
 clearMarks();
 $('panel').innerHTML=`<div class="atl"><div class="kick">Atlante 2D · cervello</div><h2>I 12 nervi cranici</h2><ol class="ncl">`+app.NC.map(n=>`<li><div><b>${n.n}</b> ${n.nm} <span class="ntg">${n.t}</span></div><div class="mut">${n.f}</div></li>`).join('')+'</ol><button class="btn alt act wide" data-act="back">‹ Indietro</button></div>';
}
// id: struttura singola o gruppo. Con un gruppo si vedono i membri; con una singola il gruppo e i muscoli collegati.
export function selectBone(id){
 app.sel=id;clearMarks();mark(id,'sel');const b=bone(id);if(!b)return;
 if(!visible(id))setTimeout(()=>{},0);
 const mem=members(id),inMem=m=>[m.o,m.i,...(m.oa||[]),...(m.ia||[])].some(x=>mem.includes(x));
 const ms=app.M.filter(inMem);
 const role=m=>{const o=[m.o,...(m.oa||[])].some(x=>mem.includes(x)),i=[m.i,...(m.ia||[])].some(x=>mem.includes(x));return o&&i?'origine · inserzione':o?'origine':'inserzione';};
 const grp=b.group?null:bone(b.g),also=b.group?[]:app.GR.filter(g=>g.area&&g.m.includes(id));
 $('panel').innerHTML=`<div class="atl"><div class="kick">${b.group?(b.area?'Area':'Gruppo')+' · '+mem.length+' strutture':(grp&&grp.n!==b.n?'Gruppo · '+grp.n:app.MOD.id==='corpo'?'Osso':'Struttura')}${also.length?' · '+also.map(g=>g.n).join(', '):''}</div><h2>${b.n}</h2>${b.l?`<div class="lat">${b.l}</div>`:''}`+
  (b.f?`<p>${b.f}</p>`:'')+(b.k?`<p class="tip">🩺 ${b.k}</p>`:'')+
  (!visible(id)?`<p class="mut">${seenIn(id)}</p>`:'')+
  (b.group?`<div class="sub">Strutture del gruppo (tocca)</div><div class="chips">${mem.map(m=>`<button class="mc" data-sb="${m}">${bone(m).n}</button>`).join('')}</div>`:
   (grp&&grp.m.length>1?`<div class="chips"><button class="mc" data-sb="${grp.id}">Vedi il gruppo: ${grp.n}</button></div>`:''))+
  (ms.length?`<div class="sub">Muscoli collegati (tocca)</div><div class="chips">${ms.map(m=>`<button class="mc" data-m="${m.id}">${m.n} <small>${role(m)}</small></button>`).join('')}</div>`:'')+`<div id="mdet"></div></div>`;
}
