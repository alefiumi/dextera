/* Simulazione del test d'ingresso UCBM (fase 6), sempre aperta nel corso «Test d'ingresso UCBM».
   Come il test vero: domande a scelta tra 5, un solo tempo per tutta la prova, +1 giusta, −0,2 sbagliata, 0 in bianco, soglia
   di idoneità 12 su 60; si può saltare, lasciare in bianco e tornare indietro, le risposte giuste si vedono solo alla fine.
   20 domande per materia (regole.json → ucbm.simulazione). Finché alcune materie sono «in arrivo» la simulazione è parziale:
   solo le materie pronte, con lo stesso tempo per domanda del test vero (100 minuti / 60 domande) e la soglia in proporzione.
   Le domande vengono dai quesiti delle materie pronte (prima quelli del passo «Quesiti del test», poi gli altri), distribuite tra
   gli argomenti, senza ripetere quelle della simulazione precedente se ce ne sono abbastanza.
   Effetti: niente maestria (è una prova); una risposta giusta vale come richiamo per il ripasso, una sbagliata riporta il ripasso
   a domani; XP per ogni giusta. Storico sul telefono in S.ucbm {sim: [{d, pt, n, ok, ko}], last: [chiavi]}. */
import {$,shuffle} from './util.js';
import {app,S,save,head,queue} from './state.js';
import * as P from './percorso.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paras=t=>String(t||'').split(/\n+/).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join('');
const live=t=>{const l=$('live');if(l){l.textContent='';setTimeout(()=>{l.textContent=t;},50);}};
const R=()=>({per_materia:20,domande:60,minuti:100,giusta:1,sbagliata:-.2,vuota:0,soglia:12,xp_giusta:3,...(P.R().ucbm?.simulazione||{})});
const num=(x,d=1)=>(Math.round(x*10**d)/10**d).toLocaleString('it-IT',{maximumFractionDigits:d});
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');};
const durTxt=sec=>{const m=Math.floor(sec/60),s=Math.round(sec%60);return `${m} minut${m===1?'o':'i'}${s?` e ${s} second${s===1?'o':'i'}`:''}`;};
let exitTo=()=>{};export const setSimExit=f=>{exitTo=f;};
const U=()=>S.ucbm||(S.ucbm={sim:[],last:[]});

/* ---------- materie e domande ---------- */
const corsoU=()=>app.MAPPA?.corsi.find(P.isUcbm)||null;
// materie pronte (pianeti con quesiti) e in arrivo del corso
export function simInfo(){
 const c=corsoU();if(!c||c.in_arrivo)return null;
 const Rs=R(),pronte=c.pianeti.filter(p=>!p.in_arrivo),arrivo=c.pianeti.filter(p=>p.in_arrivo);
 const mat=pronte.map(pl=>({pl,n:Math.min(pl.domande_test||Rs.per_materia,pool(pl).length)})).filter(m=>m.n>0);
 const n=mat.reduce((a,m)=>a+m.n,0),sec=n*Rs.minuti*60/Rs.domande;
 return {mat,arrivo,n,sec,parziale:n<Rs.domande||arrivo.length>0,soglia:Rs.soglia*n/Rs.domande};
}
// quesiti usabili di una materia: {sid, ps, sat}
function pool(pl){
 const out=[],seen=new Set();
 for(const sat of pl.satelliti)for(const ps of sat.passi||[])for(const sid of P.usable(ps)){if(!seen.has(sid)){seen.add(sid);out.push({sid,ps,sat});}}
 return out;
}
// domande di una materia: a turno tra gli argomenti, prima i quesiti del test non usati nella simulazione precedente
function pickFor(pl,n){
 const last=new Set(U().last||[]),by=new Map();
 for(const x of shuffle(pool(pl))){const r=(last.has(x.sid)?2:0)+(x.ps.tipo==='test'?0:1);(by.get(x.sat)||by.set(x.sat,[]).get(x.sat)).push({...x,r});}
 const groups=shuffle([...by.values()].map(g=>g.sort((a,b)=>a.r-b.r))),out=[];
 // prima un giro con le domande migliori di ogni argomento, poi gli altri giri
 while(out.length<n&&groups.some(g=>g.length))for(const g of groups){if(out.length>=n)break;if(g.length)out.push(g.shift());}
 return shuffle(out);
}
export function startSim(){
 const I=simInfo();if(!I||!I.n)return false;
 const slots=I.mat.flatMap(m=>pickFor(m.pl,m.n).map(x=>({sid:x.sid,ps:x.ps,sat:x.sat,pl:m.pl})));
 const L={kind:'sim',screen:'intro',info:I,slots,opts:slots.map(x=>shuffle((P.qz(x.sid).o||[]).map((label,i)=>({id:String(i),label})))),
  ans:slots.map(()=>null),i:0,end:0,xp0:S.xp,cur:null,ups:[],si:0,pres:new Set(),presAt:{},wrong:[],up:[],tab:'path'};
 app.L=L;return true;
}

/* ---------- cronometro unico ---------- */
let TK=null;
const stopT=()=>{if(TK){clearInterval(TK);TK=null;}};
function tick(){
 const L=app.L;if(!L||L.kind!=='sim'||L.screen==='end'||L.screen==='intro'){stopT();return;}
 const left=L.end-Date.now(),el=$('stim');
 if(left<=0){stopT();live('Tempo scaduto: la prova è consegnata.');return finish(L,true);}
 if(el){el.querySelector('b').textContent=mmss(left);el.classList.toggle('warn',left<=5*60e3);}
 if(left<=5*60e3&&!L.warned){L.warned=1;live('Restano 5 minuti.');}
}
const startT=()=>{if(!TK)TK=setInterval(tick,500);tick();};

/* ---------- disegno ---------- */
const timer=L=>{const left=L.end-Date.now();return `<div class="ltim stim${left<=5*60e3?' warn':''}" id="stim" role="timer" aria-label="Tempo rimasto per tutta la prova"><span aria-hidden="true">⏱</span> <b>${mmss(left)}</b></div>`;};
const headH=L=>{const tot=L.slots.length,done=L.ans.filter(a=>a!==null).length;
 return `<div class="lh"><button class="lx" data-l="quit" aria-label="Esci dalla simulazione">✕</button>
  <div class="lbar" role="progressbar" aria-label="Risposte date" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${done}"><i style="width:${done/tot*100}%"></i></div><span class="pn">${done}/${tot}</span></div>`;};
const foot=L=>{const x=L.slots[L.i],v=P.voce(x.sid),vf=P.verifica(P.dataIds(x.sid,x.ps.tipo));
 return `<div class="lfoot"><span class="vtag${vf.ok?' ok':''}">${vf.ok?'✔ ':''}${esc(vf.txt)}</span>${v?'<button class="lnk" data-l="report">⚑ Segnala un errore</button>':''}</div>`;};
export function simRender(L){
 if(L.screen==='intro')return intro(L);
 if(L.screen==='end')return results(L);
 if(L.screen==='check')return check(L);
 if(Date.now()>=L.end)return finish(L,true);
 const x=L.slots[L.i],Q=P.qz(x.sid),a=L.ans[L.i],n=L.slots.length;
 L.cur={slot:x};
 const opts=L.opts[L.i].map((o,j)=>`<button class="opt${a===o.id?' sel':''}" data-l="sopt" data-id="${esc(o.id)}" aria-pressed="${a===o.id}"><span class="ol" aria-hidden="true">${'ABCDE'[j]||''}</span>${esc(o.label)}</button>`).join('');
 const grid=L.slots.map((s,j)=>`<button class="sg${L.ans[j]!==null?' on':''}${j===L.i?' cur':''}" data-l="sgo" data-i="${j}" aria-label="Domanda ${j+1}${L.ans[j]!==null?', risposta data':', senza risposta'}"${j===L.i?' aria-current="true"':''}>${j+1}</button>`).join('');
 $('panel').innerHTML=headH(L)+timer(L)+`<div class="q qz" id="lq" tabindex="-1"><small>Simulazione · domanda ${L.i+1} di ${n} · ${esc(x.pl.nome)}</small><div class="qq">${paras(Q.d)}</div></div>
  <div class="sopts" role="group" aria-label="Risposte">${opts}</div>
  <div class="snav"><button class="btn alt" data-l="sprev"${L.i?'':' disabled'}>‹ Precedente</button>${a!==null?'<button class="btn alt" data-l="sclear">Lascia in bianco</button>':''}<button class="btn${L.i<n-1?'':' alt'}" data-l="snext"${L.i<n-1?'':' disabled'}>Successiva ›</button></div>
  <details class="sgrid"><summary>Tutte le domande (${L.ans.filter(v=>v!==null).length} con risposta)</summary><div>${grid}</div></details>
  <button class="btn" data-l="scheck">Consegna</button>`+foot(L);
 try{$('lq').focus({preventScroll:true});}catch(e){}
 startT();
}
function intro(L){
 const I=L.info,Rs=R(),mat=I.mat.map(m=>`${esc(m.pl.nome)} (${m.n})`).join(', '),u=U(),best=u.sim?.length?Math.max(...u.sim.map(s=>s.pt/s.n)):null;
 $('panel').innerHTML=`<div class="lh"><button class="lx" data-l="quit" aria-label="Esci dalla simulazione">✕</button></div><div class="q" id="lq" tabindex="-1"><small>Simulazione del test UCBM</small></div>
  ${I.parziale?`<p class="party">Simulazione parziale: per ora ${I.mat.length===1?'c\'è solo':'ci sono solo'} ${mat}${I.arrivo.length?`; ${esc(I.arrivo.map(p=>p.nome).join(' e '))} in arrivo`:''}.</p>`:''}
  <p>${I.n} domande a scelta tra 5${I.parziale?'':' ('+I.mat.map(m=>`${esc(m.pl.nome)} ${m.n}`).join(', ')+')'}, ${durTxt(I.sec)} in tutto${I.parziale?`: lo stesso tempo per domanda del test vero (${Rs.minuti} minuti per ${Rs.domande} domande)`:''}.</p>
  <ul><li>Risposta giusta: +${num(Rs.giusta,2)} · sbagliata: ${num(Rs.sbagliata,2)} · in bianco: 0.</li>
  <li>Puoi saltare, lasciare in bianco e tornare indietro. Nel dubbio, lasciare in bianco non toglie punti.</li>
  <li>Soglia di idoneità del test: ${Rs.soglia} su ${Rs.domande}${I.parziale?` (qui, in proporzione, ${num(I.soglia)} su ${I.n})`:''}.</li>
  <li>Le risposte giuste e le spiegazioni si vedono alla fine.</li></ul>
  <p class="mut">Domande scritte dall'AI, da verificare con un docente: non sono quesiti ufficiali.${best!==null?` Il tuo miglior risultato: ${num(best*100,0)}% dei punti.`:''}</p>
  <button class="btn" data-l="sgo0">Inizia la simulazione</button>`;
 try{$('lq').focus({preventScroll:true});}catch(e){}
}
function check(L){
 const n=L.slots.length,d=L.ans.filter(a=>a!==null).length,left=L.end-Date.now();
 $('panel').innerHTML=headH(L)+timer(L)+`<div class="q" id="lq" tabindex="-1"><small>Consegna</small><br><b>Vuoi consegnare?</b></div>
  <p>Hai risposto a ${d} domande su ${n}${n-d?`; ${n-d} ${n-d===1?'è':'sono'} in bianco (valgono 0)`:''}. Restano ${mmss(left)}.</p>
  <button class="btn" data-l="sdone">Consegna</button><button class="btn alt" data-l="sback">Torna alle domande</button>`;
 try{$('lq').focus({preventScroll:true});}catch(e){}
 startT();
}

/* ---------- consegna e risultato ---------- */
function finish(L,late){
 stopT();if(L.screen==='end')return;
 const Rs=R();let ok=0,ko=0,bl=0;const per=new Map(),bySat=new Map();
 L.res=L.slots.map((x,j)=>{const a=L.ans[j],r=a===null?'b':a==='0'?'ok':'ko';
  if(r==='ok')ok++;else if(r==='ko')ko++;else bl++;
  const m=per.get(x.pl)||per.set(x.pl,{ok:0,ko:0,b:0}).get(x.pl);m[r==='b'?'b':r]++;
  const s=bySat.get(x.sat)||bySat.set(x.sat,{n:0,err:0}).get(x.sat);s.n++;if(r!=='ok')s.err++;
  if(r!=='b')P.reviewAnswer(x.sid,r==='ok',true); // giusta = richiamo fatto; sbagliata = il ripasso torna domani
  return r;});
 const pt=ok*Rs.giusta+ko*Rs.sbagliata+bl*Rs.vuota;
 L.sum={ok,ko,bl,pt,per,late:!!late,pass:pt>=L.info.soglia-1e-9};
 L.weak=[...bySat.entries()].filter(([,v])=>v.err>0).sort((a,b)=>b[1].err/b[1].n-a[1].err/a[1].n||b[1].err-a[1].err).slice(0,3).map(([s])=>s);
 if(ok)P.gain(ok*Rs.xp_giusta,false);
 const u=U();u.sim=[...(u.sim||[]),{d:P.today(),pt:Math.round(pt*10)/10,n:L.slots.length,ok,ko}].slice(-20);u.last=L.slots.map(x=>x.sid);
 queue.add({module:'percorso',mode:'simulazione',score:ok,total:L.slots.length,xp:Math.max(0,S.xp-L.xp0)});
 save();head();
 L.gain=Math.max(0,S.xp-L.xp0);L.screen='end';L.cur=null;results(L);
}
function results(L){
 const s=L.sum,I=L.info,n=L.slots.length;
 const rows=[...s.per.entries()].map(([pl,m])=>{const p=m.ok*R().giusta+m.ko*R().sbagliata;return `<tr><th scope="row">${esc(pl.nome)}</th><td>${m.ok}</td><td>${m.ko}</td><td>${m.b}</td><td>${num(p)}</td></tr>`;}).join('');
 const item=(x,j)=>{const Q=P.qz(x.sid),a=L.ans[j],r=L.res[j],o=a===null?null:Q.o[+a];
  return `<li><details${r==='ok'?'':' open'}><summary><span aria-hidden="true">${r==='ok'?'✅':r==='ko'?'❌':'⚪'}</span> ${j+1}. ${esc(String(Q.d).split('\n')[0].slice(0,90))}${String(Q.d).length>90?'…':''} <span class="sr">${r==='ok'?'giusta':r==='ko'?'sbagliata':'in bianco'}</span></summary>
   <div class="qq">${paras(Q.d)}</div><p>${o===null?'Lasciata in bianco. ':r==='ok'?'':`Hai risposto «${esc(o)}». `}Risposta giusta: <b>${esc(Q.o[0])}</b>.</p>${Q.x?`<div class="qx">${paras(Q.x)}</div>`:''}<p class="mut">${esc(x.sat.nome)}</p></details></li>`;};
 const order=L.slots.map((x,j)=>j).sort((a,b)=>(L.res[a]==='ok')-(L.res[b]==='ok')||a-b);
 $('panel').innerHTML=`<div class="res"><div class="h" id="lq" tabindex="-1">Simulazione del test UCBM${I.parziale?' (parziale)':''}</div>
  ${s.late?'<p class="party">⏱ Tempo scaduto: la prova è stata consegnata così com\'era.</p>':''}
  <p class="big">${num(s.pt)} <small>punti su ${n}</small></p>
  <p class="party ${s.pass?'okh':'koh'}">${s.pass?'✅ Sopra la soglia di idoneità':'❌ Sotto la soglia di idoneità'} (${I.parziale?`${num(I.soglia)} su ${n}, in proporzione a ${R().soglia} su ${R().domande}`:`${R().soglia} su ${R().domande}`})</p>
  <p>${s.ok} giuste · ${s.ko} sbagliate · ${s.bl} in bianco · <b>+${L.gain} XP</b></p>
  <table class="stab"><caption class="sub">Per materia</caption><thead><tr><th scope="col">Materia</th><th scope="col">Giuste</th><th scope="col">Sbagliate</th><th scope="col">In bianco</th><th scope="col">Punti</th></tr></thead><tbody>${rows}</tbody></table>
  ${L.weak.length?`<div class="sub">Argomenti da ripassare</div><p class="mut">Dove hai sbagliato o lasciato in bianco di più.</p>${L.weak.map(t=>`<button class="btn alt" data-l="ssat" data-id="${esc(t.id)}">Studia «${esc(t.nome)}»</button>`).join('')}`:''}
  <div class="sub">Le domande, una per una</div><p class="mut">Prima quelle sbagliate e in bianco. Domande scritte dall'AI, da verificare.</p><ol class="srev">${order.map(j=>item(L.slots[j],j)).join('')}</ol>
  <button class="btn" data-l="sagain">Nuova simulazione</button><button class="btn alt" data-l="quit">Torna al percorso</button></div>`;
 try{$('lq').focus({preventScroll:true});}catch(e){}
}

/* ---------- clic ---------- */
export function simClick(L,a,b){
 if(a==='sgo0'){L.screen='q';L.end=Date.now()+L.info.sec*1000;}
 else if(L.screen==='end'){
  if(a==='sagain'){if(!startSim())return;}
  else if(a==='ssat'){const sat=P.satById(b.dataset.id);app.L=null;stopT();return exitTo(sat);}
  else return;
 }
 else if(a==='sopt')L.ans[L.i]=b.dataset.id; // si sceglie e basta: si passa avanti con «Successiva», come sul foglio del test
 else if(a==='sclear')L.ans[L.i]=null;
 else if(a==='sprev')L.i=Math.max(0,L.i-1);
 else if(a==='snext')L.i=Math.min(L.slots.length-1,L.i+1);
 else if(a==='sgo'){L.i=+b.dataset.i;L.screen='q';}
 else if(a==='scheck')L.screen='check';
 else if(a==='sback'){L.screen='q';const nx=L.ans.indexOf(null);if(nx>=0)L.i=nx;}
 else if(a==='sdone')return finish(L,false);
 else return;
 simRender(app.L);
}
