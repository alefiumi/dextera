/* Logo della schermata di avvio con i corsi (v0.80.0): ogni corso iniziato è un satellite sull'orbita del logo, nel suo colore;
   il primo corso è il satellite giallo di sempre (c'è anche prima di cominciare). Un corso completato (tutti i pianeti con l'esame
   superato) ha intorno un anello. Lo stato viene da S.logo, calcolato in percorso.js prima di ogni salvataggio: così il logo si
   disegna subito all'avvio, senza aspettare i contenuti. Durante il caricamento i satelliti girano (animazione lgorb in style.css,
   sfasati con animation-delay); da fermi stanno nei loro punti sull'orbita, davanti o dietro il pianeta. */
import {S} from './state.js';

export const COLORI=['#fbbf24','#a78bfa','#f87171','#60a5fa','#34d399'];
const NS='http://www.w3.org/2000/svg';
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
// satellite (con l'anello se il corso è completato), centrato nell'origine: la posizione la dà transform
function moon(cls,col,done){
 const g=el('g',{class:cls});
 if(done)g.append(el('circle',{r:44,fill:'none',stroke:col,'stroke-width':8,'stroke-opacity':.75}));
 g.append(el('circle',{r:28,fill:col}));
 return g;
}
export function drawLogo(svg){
 if(!svg)return;
 const L=(Array.isArray(S.logo)?S.logo:[]).map((c,i)=>({col:COLORI[i%COLORI.length],st:c&&c.st||''}));
 // il primo corso c'è sempre; gli altri solo se iniziati o completati
 const show=L.length?L.filter((c,i)=>i===0||c.st):[{col:COLORI[0],st:''}];
 if(show.length===1&&!show[0].st)return;   // logo di sempre
 const go=svg.querySelectorAll('.lgm-go'),st=svg.querySelector('.lgm-st');
 if(go.length<2||!st)return;
 const back=go[0].parentNode,front=go[1].parentNode,stPar=st.parentNode;
 go.forEach(e=>e.remove());st.remove();
 const n=show.length;
 show.forEach((c,k)=>{
  const ph=31+k*360/n,t=ph*Math.PI/180,x=256+190*Math.cos(t),y=256+62*Math.sin(t),done=c.st==='completato';
  // in movimento: copia dietro il pianeta e copia davanti (tagliata sulla metà davanti), sfasate sull'orbita
  for(const par of [back,front]){const m=moon('lgm-go',c.col,done);m.style.animationDelay=`-${(ph/360).toFixed(3)}s`;par.append(m);}
  // fermo: davanti o dietro il pianeta secondo il punto dell'orbita
  const s=moon('lgm-st',c.col,done);s.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  (y>=256?stPar:back).append(s);
 });
}
