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
export function renderExplore(){
 app.sel=null;const body=app.MOD.id==='corpo';
 $('panel').innerHTML=`<div class="h">${app.MOD.expl?app.MOD.expl.h:body?'Atlante 2D · lo scheletro':'Atlante 2D · il cervello'}</div><p class="mut">${app.MOD.expl?app.MOD.expl.t:body?'Tocca un osso per vedere nome, funzione e muscoli collegati; tocca un muscolo per vedere origine (O) e inserzione (I). In alto scegli la vista (anteriore, posteriore, laterali, superiore, inferiore) e ossa singole o gruppi.':'Tocca una struttura per vedere nome e funzione. In alto scegli la vista (laterali, mediale, anteriore, posteriore, superiore, inferiore o basale) e giri e solchi o lobi e aree.'} Per ingrandire: ＋ −, pizzica o tocca due volte; con un dito sposti la figura ingrandita.</p>`+
  '<p class="mut">Forme ricavate dal modello 3D Z-Anatomy (CC BY-SA 4.0); testi scritti dall\'AI, da verificare.</p>'+(app.MOD.id==='cervello'?'<button class="btn alt act" data-act="ncl">📖 Nervi cranici</button>':'')+`<div class="leg">Colori: beige/pastello = da studiare · verde = in corso · oro = padroneggiato</div>`+
  (isStandalone()?'':'<button class="btn alt act" data-act="inst">📲 Installa l\'app</button><button class="lnk act" data-act="insthelp">Altri telefoni e uso offline</button>');
}
export function showNc(){
 clearMarks();
 $('panel').innerHTML=`<div class="h">I 12 nervi cranici</div>`+app.NC.map(n=>`<div class="nrow" style="display:flex;justify-content:space-between;padding-top:8px"><span><b>${n.n}</b> ${n.nm}</span><span class="mut">${n.t}</span></div><div class="mut" style="padding-bottom:6px;border-bottom:1px solid var(--line)">${n.f}</div>`).join('')+'<button class="btn alt act" data-act="back">Indietro</button>';
}
// id: struttura singola o gruppo. Con un gruppo si vedono i membri; con una singola il gruppo e i muscoli collegati.
export function selectBone(id){
 app.sel=id;clearMarks();mark(id,'sel');const b=bone(id);if(!b)return;
 if(!visible(id))setTimeout(()=>{},0);
 const mem=members(id),inMem=m=>[m.o,m.i,...(m.oa||[]),...(m.ia||[])].some(x=>mem.includes(x));
 const ms=app.M.filter(inMem);
 const role=m=>{const o=[m.o,...(m.oa||[])].some(x=>mem.includes(x)),i=[m.i,...(m.ia||[])].some(x=>mem.includes(x));return o&&i?'origine · inserzione':o?'origine':'inserzione';};
 const grp=b.group?null:bone(b.g),also=b.group?[]:app.GR.filter(g=>g.area&&g.m.includes(id));
 $('panel').innerHTML=`<div class="h">${b.n} <i>${b.l||''}</i></div><div class="mut">${b.group?(b.area?'Area':'Gruppo')+' · '+mem.length+' strutture':(grp?'Gruppo: '+grp.n:'')}${also.length?' · '+also.map(g=>g.n).join(', '):''}</div>`+
  (b.f?`<p>${b.f}</p>`:'')+(b.k?`<p class="tip">🩺 ${b.k}</p>`:'')+
  (!visible(id)?`<p class="mut">${seenIn(id)}</p>`:'')+
  (b.group?`<div class="sub">Strutture del gruppo (tocca)</div><div class="chips">${mem.map(m=>`<button class="mc" data-sb="${m}">${bone(m).n}</button>`).join('')}</div>`:
   (grp&&grp.m.length>1?`<div class="chips"><button class="mc" data-sb="${grp.id}">Vedi il gruppo: ${grp.n}</button></div>`:''))+
  (ms.length?`<div class="sub">Muscoli collegati (tocca)</div><div class="chips">${ms.map(m=>`<button class="mc" data-m="${m.id}">${m.n} <small>${role(m)}</small></button>`).join('')}</div>`:'')+`<div id="mdet"></div>`;
}
