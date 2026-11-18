/* Figura SVG: disegno, zoom e pan, marcature, origine e inserzione dei muscoli. */
import {$} from './util.js';
import {app,S,bone,members,itemOf,bonesName,saveGrp} from './state.js';

// Ogni vista (anteriore, laterale, dall'alto…) è un gruppo SVG con tutte le strutture singole; se ne vede una alla volta.
// Le marcature (selezione, risposte, pezzi del puzzle) valgono in tutte le viste, così cambiando vista restano.
// Le viste di zona (mano palmare e dorsale, piede dall'alto e dalla pianta) sono altri gruppi con solo le ossa di quella zona:
// le usano Ricomponi e Trova la struttura, poi si torna alla vista scelta nel menu.
// In alto: un pulsante per modulo (Corpo, Cervello) che apre il menu delle sue viste.
export const vName=(v,M=app.MOD)=>M.vnames[v]||M.zviews[v]?.n||v;
export const baseOf=()=>{const M=app.MOD,b=app.bases[M.id];return M.views.includes(b)?b:M.views[0];};
export const hasView=v=>app.MOD.views.includes(v)||!!app.MOD.zviews[v];
// pulsante di un modulo: quello aperto con nome e vista; gli altri solo con l'icona se lo spazio è poco (tre moduli su un telefono)
const mmLabel=k=>{const L=app.MODS[k].label,i=L.indexOf(' ');
 return k===app.MOD.id?`<span class="mi">${L}</span> · <span class="vn">${vName(app.view)}</span> ▾`:`${L.slice(0,i)}<span class="mn">${L.slice(i)}</span> ▾`;};
export function buildFig(){
 const {B,MODS,MOD,VB}=app;
 app.view=baseOf();
 const vs=[...MOD.views,...Object.keys(MOD.zviews)].map(v=>`<g class="view${(MOD.thin||[]).includes(v)?' thin':''}" data-v="${v}"${v===app.view?'':' display="none"'}>`+
  B.filter(b=>b.s[v]).map(b=>`<g class="bone m0" data-id="${b.id}"${b.col?` style="--b:${b.col}"`:''}><g>${b.s[v]}</g></g>`).join('')+'</g>').join('');
 const mm=Object.keys(MODS).map(k=>`<button data-mm="${k}" class="${k===MOD.id?'on':''}" aria-haspopup="menu" title="${MODS[k].label.slice(MODS[k].label.indexOf(' ')+1)}">${mmLabel(k)}</button>`).join('');
 const body=MOD.id==='corpo';
 const grp=`<button data-fg="1" class="${app.grp?'on':''}" title="Singole strutture o gruppi">${MOD.grpn?MOD.grpn[app.grp?1:0]:app.grp?(body?'Gruppi':'Lobi e aree'):(body?'Ossa singole':'Giri e solchi')}</button>`;
 $('fig').innerHTML=`<div class="tbar"><div class="mods mm">${mm}</div></div><div class="tbar t2"><div class="mods">${grp}</div><div class="zc"><button data-z="in" aria-label="Ingrandisci">＋</button><button data-z="out" aria-label="Riduci">－</button><button data-z="reset" aria-label="Vista intera">⟲</button></div></div><div id="vmenu" class="vmenu" role="menu" hidden></div><svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" role="img" aria-label="Figura anatomica"><defs><marker id="ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7c3aed"/></marker></defs>${vs}<g id="ov" pointer-events="none"></g></svg>`;
}
// Menu delle viste di un modulo, sotto il suo pulsante; con una vista di zona aperta mostra anche le due viste della zona.
export function viewMenu(id,btn){
 const m=$('vmenu');if(!m)return;
 if(!m.hidden&&m.dataset.mod===id){m.hidden=true;return;}
 const M=app.MODS[id],cur=id===app.MOD.id?app.view:null;
 const it=v=>`<button role="menuitem" data-vm="${id}:${v}" class="${v===cur?'on':''}">${vName(v,M)}</button>`;
 let h=M.views.map(it).join('');
 if(cur&&M.zviews[cur])h+=`<div class="vsep">Zona</div>`+[cur,M.zviews[cur].alt].map(it).join('');
 m.innerHTML=h;m.dataset.mod=id;m.hidden=false;
 m.style.left=Math.min(btn.offsetLeft,$('fig').clientWidth-m.offsetWidth-4)+'px';m.style.top=(btn.offsetTop+btn.offsetHeight+4)+'px';
}
export const closeViewMenu=()=>{const m=$('vmenu');if(m)m.hidden=true;};
// cambia vista senza ridisegnare (le marcature restano). temp: scelta di un gioco, non diventa la vista del menu
export function setView(v,temp){
 if(!hasView(v))return;
 if(!temp&&app.MOD.views.includes(v)){app.bases[app.MOD.id]=v;saveGrp();}
 app.view=v;$('fig').querySelectorAll('.view').forEach(g=>g.setAttribute('display',g.dataset.v===v?'inline':'none'));
 const b=$('fig').querySelector(`[data-mm="${app.MOD.id}"]`);if(b)b.innerHTML=mmLabel(app.MOD.id);
}
export const inZone=()=>!!app.MOD.zviews[app.view];
// torna alla vista scelta nel menu dopo una vista usata da un gioco
export function baseView(){if(app.view!==baseOf())setView(baseOf(),true);}
const activeView=()=>$('fig').querySelector(`.view[data-v="${app.view}"]`);
// la struttura si vede nella vista v (attuale se manca)? Almeno un quarto della sagoma del lato destro non deve essere
// coperto da altre ossa: il pisiforme da dietro o le falangi del piede di scorcio non si chiedono.
const MIN_VIS=.25;
export const visibleIn=(id,v)=>members(id).some(m=>{const b=bone(m);return b&&b.s[v]&&(b.vis[v]??1)>=MIN_VIS;});
export const visible=id=>visibleIn(id,app.view);
let tw=0;
export const svgEl=()=>$('fig').querySelector('svg');
export function svgPt(x,y){const s=svgEl(),p=s.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(s.getScreenCTM().inverse());}
function applyVB(){const s=svgEl(),VB=app.VB;if(s){s.setAttribute('viewBox',`${VB.x} ${VB.y} ${VB.w} ${VB.h}`);if(ovDraw)drawOv();}}
// segni sopra la figura (origine e inserzione): misure in pixel dello schermo, uguali con ogni zoom e su ogni schermo
let ovDraw=null;
function drawOv(){const s=svgEl(),o=$('ov');if(!s||!o||!ovDraw)return;const r=s.getBoundingClientRect(),VB=app.VB;
 const ppu=Math.min(r.width/VB.w,r.height/VB.h)||1;o.innerHTML=ovDraw(2.2/ppu);}
// proporzioni del riquadro sullo schermo e riquadro più largo ammesso (tutta la figura dentro lo schermo)
const scrAsp=()=>{const r=svgEl()?.getBoundingClientRect();return r&&r.width>0&&r.height>0?r.height/r.width:app.MOD.H/app.MOD.W;};
const maxW=()=>Math.max(app.MOD.W,app.MOD.H/scrAsp());
// il riquadro resta sulla figura; se è più grande della figura, la figura sta al centro
const clampT=t=>{const {W,H}=app.MOD;return {...t,x:t.w>=W?(W-t.w)/2:Math.max(0,Math.min(W-t.w,t.x)),y:t.h>=H?(H-t.h)/2:Math.max(0,Math.min(H-t.h,t.y))};};
export function setVB(t,anim){
 const id=++tw;t=clampT(t);lastT=t;
 if(!anim){app.VB=t;applyVB();return;}
 const s0={...app.VB},t0=performance.now();
 (function f(n){if(id!==tw)return;const k=Math.min(1,(n-t0)/260),e=k*(2-k);
  app.VB={x:s0.x+(t.x-s0.x)*e,y:s0.y+(t.y-s0.y)*e,w:s0.w+(t.w-s0.w)*e,h:s0.h+(t.h-s0.h)*e};applyVB();if(k<1)requestAnimationFrame(f);})(t0);
}
// vista intera: il disegno della vista attuale riempie il riquadro (la vista dall'alto non resta un puntino in mezzo)
export function resetZoom(anim){
 const g=activeView(),b=g&&g.getBBox();
 if(b&&b.width>0)focusPts([[b.x,b.y],[b.x+b.width,b.y+b.height]],6,anim,0);else setVB({x:0,y:0,w:app.MOD.W,h:app.MOD.H},anim);
 homeT=lastT;
}
// ultimo riquadro chiesto e quello della vista intera: se la finestra cambia forma e la figura era intera, si riadatta
let lastT=null,homeT=null;
const atHome=()=>{const V=app.VB,h=homeT;return h&&Math.abs(V.x-h.x)+Math.abs(V.y-h.y)+Math.abs(V.w-h.w)<1;};
// doppio tocco: ingrandisce 2,5 volte centrando il punto toccato; se il passo dopo andrebbe oltre l'ingrandimento utile
// (meno di 1/12 della larghezza della figura), torna alla vista intera
export function doubleTapZoom(x,y){
 const {MOD,VB}=app,p=svgPt(x,y);
 if(VB.w/2.5<MOD.W/12){resetZoom(true);return;}
 const w=VB.w/2.5,h=w*scrAsp();
 setVB({x:p.x-w/2,y:p.y-h/2,w,h},true);
}
export function zoomAt(k,cx,cy){
 const {MOD,VB}=app;
 const w=Math.max(MOD.W/24,Math.min(maxW(),VB.w/k)),h=w*scrAsp(),fx=(cx-VB.x)/VB.w,fy=(cy-VB.y)/VB.h;
 setVB({x:cx-fx*w,y:cy-fy*h,w,h},false);
}
// Riquadro sui punti con le proporzioni del riquadro sullo schermo (non della figura intera, molto più alta): una zona
// larga come le dita del piede riempie la larghezza invece di restare piccola in mezzo. minW: ingrandimento massimo.
export function focusPts(pts,pad,anim=true,minW=app.MOD.W/5){
 const asp=scrAsp();
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 const w=Math.min(Math.max(x1-x0+2*pad,(y1-y0+2*pad)/asp,minW),maxW()),h=w*asp;
 setVB({x:(x0+x1)/2-w/2,y:(y0+y1)/2-h/2,w,h},anim);
 return w;
}
// riquadro di una voce (membri) nella vista attuale, per portarla in primo piano
// first: solo il primo tracciato di ogni struttura (il lato destro per le ossa pari)
export function itemBox(id,first){
 const pts=[];for(const g of els(id,true)){const e=first?g.querySelector('.f')||g:g,b=e.getBBox();if(b.width||b.height)pts.push([b.x,b.y],[b.x+b.width,b.y+b.height]);}
 return pts;
}
export const focusItem=(id,pad=12,first)=>{const p=itemBox(id,first);if(p.length)focusPts(p,pad);};
export function boneAt(x,y){
 const test=(px,py)=>{const el=document.elementFromPoint(px,py),g=el&&el.closest&&el.closest('.bone');return g&&$('fig').contains(g)?g:null;};
 let g=test(x,y);if(g)return g;
 for(const r of [8,16,24])for(let a=0;a<8;a++){const t=a*Math.PI/4;g=test(x+r*Math.cos(t),y+r*Math.sin(t));if(g)return g;}
 return null;
}

/* ---------- posti vuoti del puzzle ---------- */
// Punti campione (in unità della figura) sul disegno di ogni struttura, calcolati una volta per modulo.
const samples=new Map();
function samplesOf(g){
 const key=app.MOD.id+'/'+app.view+'/'+g.dataset.id;
 if(samples.has(key))return samples.get(key);
 const pts=[],step=2,inner=g.firstElementChild;
 for(const el of inner.querySelectorAll('.l,.f')){
  if(el.tagName==='line'||el.tagName==='path'&&el.classList.contains('l')){
   const L=el.getTotalLength();for(let d=0;d<=L;d+=step){const p=el.getPointAtLength(d);pts.push([p.x,p.y]);}
  }else{
   const b=el.getBBox();
   for(let x=b.x;x<=b.x+b.width;x+=step)for(let y=b.y;y<=b.y+b.height;y+=step)
    if(el.isPointInFill(new DOMPoint(x,y)))pts.push([x,y]);
   pts.push([b.x+b.width/2,b.y+b.height/2]);
  }
 }
 samples.set(key,pts);
 return pts;
}
const SLOT_PX=28; // distanza massima, in pixel sullo schermo, tra il punto di rilascio e un posto vuoto
// Nel puzzle: il posto vuoto più vicino al punto (entro SLOT_PX), anche se coperto da altre ossa;
// entro 8 px dal più vicino vince quello del pezzo in mano (want). Se non ce n'è, la struttura sotto il dito.
export function slotAt(x,y,want){
 const svg=svgEl();if(!svg)return null;
 const r=svg.getBoundingClientRect();
 if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
 const ctm=svg.getScreenCTM(),p=svgPt(x,y),max=SLOT_PX/ctm.a;
 let best=null,bestD=Infinity,wantG=null,wantD=Infinity;
 for(const g of activeView().querySelectorAll('.bone.ghost')){
  let d=Infinity;for(const [sx,sy] of samplesOf(g)){const e=Math.hypot(sx-p.x,sy-p.y);if(e<d)d=e;}
  if(d<bestD){bestD=d;best=g;}
  if(itemOf(g.dataset.id)===want&&d<wantD){wantG=g;wantD=d;}
 }
 // vince il posto del pezzo in mano anche se un altro è più vicino di pochi pixel (coste sottili e vicine)
 if(wantG&&wantD<=max&&wantD<=bestD+8/ctm.a)return wantG;
 if(best&&bestD<=max)return best;
 return boneAt(x,y);
}
// elementi disegnati di una voce (singola o gruppo): in tutte le viste, o solo in quella attuale
export function els(id,onlyActive){
 const root=onlyActive?activeView():$('fig');if(!root)return [];
 return members(id).flatMap(m=>[...root.querySelectorAll(`.bone[data-id="${CSS.escape(m)}"]`)]);
}
const MARKS=['sel','org','ins','ok','bad','hov'];
export function clearMarks(){ovDraw=null;document.querySelectorAll('.bone').forEach(g=>g.classList.remove(...MARKS));const o=$('ov');if(o)o.innerHTML='';}
export const mark=(id,c)=>els(id).forEach(g=>g.classList.add(c));
// colore della maestria: della singola struttura, o del suo gruppo quando si gioca per gruppi
export function refreshMastery(){document.querySelectorAll('#fig .bone').forEach(g=>{const k=itemOf(g.dataset.id);g.classList.remove('m0','m1','m2','m3');g.classList.add('m'+(S.mastery[k]||0));});}
// centro di una struttura nella vista attuale (lato destro del corpo se è pari)
const ctr=id=>{for(const m of members(id)){const c=bone(m)?.c?.[app.view];if(c)return c;}return null;};
// Origine (O) e inserzione (I) sulla figura: i punti sono i centri delle aree della fonte visibili in questa vista
// (dello stesso lato del corpo); se un'area non si vede da qui si usa il centro dell'osso.
export function showMuscle(m){
 clearMarks();[m.o,...(m.oa||[])].forEach(x=>mark(itemOf(x),'org'));[m.i,...(m.ia||[])].forEach(x=>mark(itemOf(x),'ins'));
 const P=(m.pts||{})[app.view]||{o:[],i:[]},side=['r','l'].find(sd=>P.o.some(p=>p[2]===sd)&&P.i.some(p=>p[2]===sd))||'r';
 const pick=(L,id)=>{const q=L.filter(p=>p[2]===side);const l=q.length?q:L;if(l.length)return [l.reduce((s,p)=>s+p[0],0)/l.length,l.reduce((s,p)=>s+p[1],0)/l.length];return ctr(id);};
 const a=pick(P.o,m.o),b=pick(P.i,m.i);
 if(!a||!b){ovDraw=null;$('ov').innerHTML='';return false;}
 const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;
 ovDraw=u=>{const r=6.5*u,fs=6.5*u,down=dy>=0;
 const sx=a[0]+dx/d*(r+u),sy=a[1]+dy/d*(r+u),ex=b[0]-dx/d*(r+2.5*u),ey=b[1]-dy/d*(r+2.5*u);
 const lab=(p,txt,col,above)=>{const wd=txt.length*fs*.56+fs*1.4,hh=fs*1.7,y=above?p[1]-r-hh-u:p[1]+r+u;
  return `<rect x="${p[0]-wd/2}" y="${y}" width="${wd}" height="${hh}" rx="${hh/2}" fill="${col}"/><text x="${p[0]}" y="${y+hh*0.72}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff">${txt}</text>`;};
 const dot=(p,l,col)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${col}"/><text x="${p[0]}" y="${p[1]+fs*.36}" text-anchor="middle" font-size="${fs*1.1}" font-weight="700" fill="#fff">${l}</text>`;
 return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#7c3aed" stroke-width="${2.2*u}" stroke-dasharray="${5*u} ${4*u}" marker-end="url(#ar)"/>`+
  dot(a,'O','#2563eb')+dot(b,'I','#ea580c')+lab(a,'O: '+bone(itemOf(m.o)).n,'#2563eb',down)+lab(b,'I: '+bone(itemOf(m.i)).n,'#ea580c',!down);};
 focusPts([a,b],30);drawOv();
 return true;
}
export const muscleHtml=m=>`<div class="md"><b>${m.n}</b> <i class="mut">${m.l||''}</i><br><span class="tg o">ORIGINE</span> ${m.ot}${m.o?` <small class="mut">(${bonesName([m.o,...(m.oa||[])])})</small>`:''}<br><span class="tg i">INSERZIONE</span> ${m.it}${m.i?` <small class="mut">(${bonesName([m.i,...(m.ia||[])])})</small>`:''}<br><b>Azione</b>: ${m.a}${m.nv?`<br><b>Innervazione</b>: ${m.nv}`:''}${m.src?'<br><small class="mut">Ossa ricavate dal testo della scheda: nella fonte mancano le aree.</small>':''}</div>`;

/* ---------- Safari: ridisegno dopo un cambio di misura ---------- */
// Safari a volte non ridisegna l'svg quando cambia la sua altezza (scheda abbassata o rialzata) e lascia sullo schermo
// pezzi del disegno vecchio accanto a quello nuovo: a ogni cambio di misura lo si costringe a ridisegnare tutto.
if(window.ResizeObserver){let last='';new ResizeObserver(()=>{const s=svgEl();if(!s)return;const r=s.getBoundingClientRect(),k=Math.round(r.width)+'x'+Math.round(r.height);if(k===last)return;last=k;
 const home=atHome();s.style.transform='translateZ(0)';requestAnimationFrame(()=>{s.style.transform='';if(home)resetZoom(false);else applyVB();});}).observe($('fig'));}

/* ---------- pan, pizzico e rotella ---------- */
const ptrs=new Map();let pan=null,pinch=null,wasPan=false;
// Dice al gestore del clic se il gesto appena finito era un trascinamento (e lo azzera).
export function takePan(){if(!wasPan)return false;wasPan=false;return true;}
const fg=$('fig');
// Un dito: spostamento (con zoom attivo), con eventi pointer. Due dita: vedi il pizzico più sotto.
// Mouse e penna con due puntatori (raro) restano sugli eventi pointer.
fg.addEventListener('pointerdown',e=>{
 if(e.target.closest('.tbar,#vmenu'))return;
 ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});wasPan=false;
 if(ptrs.size===1)pan={x:e.clientX,y:e.clientY,vx:app.VB.x,vy:app.VB.y};
 else{pan=null;if(e.pointerType!=='touch'&&ptrs.size===2){const [a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}}
});
fg.addEventListener('pointermove',e=>{
 if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const s=svgEl();if(!s||tp)return;
 if(ptrs.size===2&&pinch){
  const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y),mid=svgPt((a.x+b.x)/2,(a.y+b.y)/2);
  wasPan=true;zoomAt(d/pinch,mid.x,mid.y);pinch=d;
 }else if(ptrs.size===1&&pan&&app.VB.w<app.MOD.W-1){
  const dx=e.clientX-pan.x,dy=e.clientY-pan.y;
  if(!wasPan&&Math.hypot(dx,dy)<7)return;
  wasPan=true;const sc=1/s.getScreenCTM().a;
  setVB({x:pan.vx-dx*sc,y:pan.vy-dy*sc,w:app.VB.w,h:app.VB.h},false);
 }
});
const endPtr=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(!ptrs.size)pan=null;};
fg.addEventListener('pointerup',endPtr);fg.addEventListener('pointercancel',endPtr);

// Pizzico con due dita su telefoni e tablet: eventi touch, che funzionano anche su iPhone
// (lì il sistema annulla gli eventi pointer per fare lo zoom della pagina). Lo zoom resta centrato
// tra le due dita e, spostandole insieme, si sposta anche la figura.
let tp=null;
const twoFingers=t=>({x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2,d:Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY)});
fg.addEventListener('touchstart',e=>{
 if(e.touches.length!==2||!svgEl()||e.target.closest('.tbar,#vmenu'))return;
 e.preventDefault();tp=twoFingers(e.touches);pan=null;wasPan=true;
},{passive:false});
fg.addEventListener('touchmove',e=>{
 if(!tp||e.touches.length<2)return;
 e.preventDefault();
 const m=twoFingers(e.touches),s=svgEl();if(!s)return;
 if(tp.d>0&&m.d>0){const p=svgPt(m.x,m.y);zoomAt(m.d/tp.d,p.x,p.y);}
 const sc=1/s.getScreenCTM().a,VB=app.VB;
 setVB({x:VB.x-(m.x-tp.x)*sc,y:VB.y-(m.y-tp.y)*sc,w:VB.w,h:VB.h},false);
 tp=m;wasPan=true;
},{passive:false});
const endTouch=e=>{if(e.touches.length<2)tp=null;};
fg.addEventListener('touchend',endTouch);fg.addEventListener('touchcancel',endTouch);
// Safari: niente zoom della pagina quando si pizzica sulla figura
for(const ev of ['gesturestart','gesturechange'])fg.addEventListener(ev,e=>e.preventDefault());
fg.addEventListener('wheel',e=>{if(!svgEl())return;e.preventDefault();const p=svgPt(e.clientX,e.clientY);zoomAt(e.deltaY<0?1.2:1/1.2,p.x,p.y);},{passive:false});
