/* Carica i contenuti da content/ e li trasforma nelle strutture usate dal gioco.
   Ogni modulo ha strutture singole (B: ossa, giri…) con le forme per ogni vista (s.a anteriore, s.p posteriore) e il gruppo (g),
   e gruppi (GR: ossa raggruppate, lobi e aree del cervello) con i membri (m). */
import {renderShape} from './shapes.js';

const getRaw=f=>fetch('content/'+f).then(r=>{if(!r.ok)throw new Error(f+': HTTP '+r.status);return r.json();});

export async function loadContent(){
 const idx=await getRaw('index.json');
 // ?v= dice al service worker di servire tutti i file della stessa versione dell'indice.
 const get=f=>getRaw(f+'?v='+encodeURIComponent(idx.version));
 const hasMap=(idx.files||[]).includes('mappa.json');
 const [mods,nc,mappa]=await Promise.all([Promise.all(idx.modules.map(id=>get(id+'.json'))),get(idx.nc),hasMap?get('mappa.json'):null]);
 const MODS={};
 for(const m of mods){
  const GR=m.groups.map(g=>({...g,group:true}));
  const gOf=Object.fromEntries(GR.filter(g=>!g.area).flatMap(g=>g.m.map(id=>[id,g])));
  const B=m.structures.map(x=>({...x,r:x.r||gOf[x.id]?.n||'',s:Object.fromEntries(Object.entries(x.s).map(([v,sh])=>[v,renderShape(sh)])),
   // s1: solo il primo tracciato (il lato destro per le ossa pari), per i pezzi del puzzle
   s1:Object.fromEntries(Object.entries(x.s).map(([v,sh])=>[v,renderShape(sh.slice(0,1))]))}));
  const byId=Object.fromEntries([...B,...GR].map(x=>[x.id,x]));
  MODS[m.id]={id:m.id,label:m.label,B,GR,byId,M:m.muscles||[],CASES:m.cases,W:m.W,H:m.H,views:m.views||['a']};
 }
 return {version:idx.version,MODS,NC:nc.items,MAPPA:mappa};
}
