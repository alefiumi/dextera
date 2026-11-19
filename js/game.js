/* Scheda Palestra (l'ex Gioca): menu, quiz, Tendine-ponte, Caso clinico, fine partita. */
import {$,shuffle,pick} from './util.js';
import {app,S,bone,save,touchStreak,head,bump,queue,items,members,itemOf,itemSet,bonesName} from './state.js';
import {clearMarks,mark,refreshMastery,resetZoom,showMuscle,muscleHtml,visible,visibleIn,focusItem,focusPts,itemBox,setView,baseView,hasView} from './figure.js';
import {startPuzzle} from './puzzle.js';
import * as P from './percorso.js';
import {startZone,renderLesson,leaveZone,setPlayExit,lessonMod} from './lezione.js';
import {openSat} from './path.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Palestra per zone (fase 2, terzo rilascio; sezione 7 della specifica) ----------
   Figura 2D colorata per maestria: toccando un osso si apre il foglio della sua zona (= un satellite, app.Z) con i giochi solo su
   quella zona e «Vai al satellite»; «Allenati sulle zone deboli» allena le zone più deboli. I giochi della zona sono allenamenti
   con le regole della lezione (startZone in lezione.js): stesse chiavi di maestria per aspetto e stesso ripasso del Percorso. */
const TIPI=[['ossa','🦴','Ossa','Riconoscerle e trovarle sulla figura'],['reperi','📍','Reperi','Riconoscerli e trovare il loro osso'],
 ['muscoli','💪','Muscoli','Riconoscerli dal tracciato'],['connessioni','🎯','Origine e inserzione','Da dove partono e dove arrivano'],['funzione','⚙️','Funzione','Quale muscolo fa questa azione']];
// neurologia (figura del cervello): una zona è un satellite del corso, i tipi sono i suoi passi
const TIPIN=[['strutture','🧠','Strutture','Riconoscerle e trovarle sulla figura'],['dove','📍','Dove si trova','Riconoscerle dalla posizione'],
 ['funzione','⚙️','Funzione','Che cosa fanno'],['lesione','🩹','Se si danneggia','Che cosa succede con una lesione'],['connessioni','🔗','Connessioni e vie','Con che cosa sono collegate']];
const ZC=()=>P.zoneCorso(),neu=()=>ZC()?.modulo==='cervello',tipi=()=>neu()?TIPIN:TIPI;
const zoneOn=()=>P.ready()&&!!ZC();
const avgTxt=a=>a.toFixed(1).replace('.',',');
const dot=a=>`<span class="mdot m${Math.min(3,Math.floor(a+1e-9))}" aria-hidden="true">${Math.min(3,Math.floor(a+1e-9))}</span>`;
// strutture usabili di un tipo di passo nella zona (chiavi diverse)
const zoneCount=(sat,tipo)=>new Set(P.passi(sat).filter(ps=>ps.tipo!=='progetto'&&(!tipo||ps.tipo===tipo)).flatMap(ps=>P.usable(ps).map(sid=>P.key(sid,ps.aspetto)))).size;
setPlayExit(()=>renderMenu());
// tocco su un osso della figura, fuori dai giochi: apre il foglio della sua zona
export function zoneTap(sid){
 if(!zoneOn())return false;const L=P.satsOf(sid,ZC()).filter(s=>P.satKeys(s).length);if(!L.length)return false;
 app.Z={id:L[0].id,alt:L.map(s=>s.id)};renderMenu();return true;
}
export function zoneClick(b){
 const a=b.dataset.z,sat=app.Z&&P.satById(app.Z.id);
 if(a==='open'){app.Z={id:b.dataset.id,alt:[b.dataset.id]};renderMenu();$('panel').querySelector('.zsheet h2')?.focus();}
 else if(a==='alt'&&app.Z){app.Z.id=b.dataset.id;renderMenu();}
 else if(a==='close'){app.Z=null;clearMarks();resetZoom(true);renderMenu();}
 else if(a==='weak'){const ws=P.weakZones(ZC());if(ws.length)startZone(ws,{label:ws.map(s=>s.nome).join(' e ')});}
 else if(a==='train'&&sat){const t=b.dataset.t||null,T=tipi().find(x=>x[0]===t);startZone([sat],{tipo:t,label:sat.nome+(T?' · '+T[2]:'')});}
 else if(a==='sat'&&sat){app.Z=null;openSat(sat.id);}
}
function zoneHead(){
 const ws=P.weakZones(ZC()),nn=neu();
 const pls=P.pianeti(ZC()).map(p=>{const ss=P.satelliti(p).filter(s=>P.satKeys(s).length);if(!ss.length)return '';
  return `<div class="zpl"><div class="sub">${esc(p.nome)}</div><div class="zlist">${ss.map(s=>{const a=P.zoneAvg(s);
   return `<button class="zchip" data-z="open" data-id="${esc(s.id)}" aria-label="${esc(s.nome)}: maestria media ${avgTxt(a)} su 3">${dot(a)}<span>${esc(s.nome)}</span></button>`;}).join('')}</div></div>`;}).join('');
 return `<div class="card zhead"><div class="kick">Allenamento per zone</div><h2>Tocca una zona per allenarti</h2>
  <p class="mut">${nn?'Tocca una parte del cervello: si apre la sua zona (un satellite del corso di neurologia), con i giochi solo su quella.':'La figura è colorata per maestria (da beige a oro). Tocca un osso: si apre la sua zona, con i giochi solo su quella.'} Tutto fa salire la stessa maestria del Percorso.</p>
  ${ws.length?`<button class="btn" data-z="weak">💪 Allenati sulle zone deboli</button><p class="mut zweak">${ws.length>1?'Le zone':'La zona'} più ${ws.length>1?'deboli':'debole'}: <b>${ws.map(s=>esc(s.nome)).join('</b> e <b>')}</b></p>`:''}
  <details class="zall"><summary>Tutte le zone</summary>${pls}</details></div>`;
}
function zoneSheet(sat){
 const pl=P.planetOf(sat),a=P.zoneAvg(sat),st=P.look(sat);
 const tl=(t,i,n,x)=>{const c=zoneCount(sat,t);return c?`<button class="mode tile" data-z="train"${t?` data-t="${t}"`:''}><span class="ti" aria-hidden="true">${i}</span><b>${n}</b><small>${x} · ${c} ${c===1?'struttura':'strutture'}</small></button>`:'';};
 const alt=app.Z.alt.length>1?`<p class="mut">${neu()?'La struttura toccata':'L\'osso toccato'} sta anche in: ${app.Z.alt.filter(id=>id!==sat.id).map(id=>`<button class="lnk" data-z="alt" data-id="${esc(id)}">${esc(P.satById(id).nome)}</button>`).join(', ')}</p>`:'';
 return `<div class="card zsheet"><div class="zsh"><div><div class="kick">Zona · ${esc(pl?.nome||'')}</div><h2 tabindex="-1">${esc(sat.nome)}</h2></div><button class="lx" data-z="close" aria-label="Chiudi la zona">✕</button></div>
  <p class="zst">${dot(a)} Maestria media <b>${avgTxt(a)}</b> su 3 · ${esc(P.STATI[st]||'')}</p>${alt}
  <div class="tiles">${tl(null,'🔀','Allenamento misto',"Un po' di tutto, dalle più deboli")}${tipi().map(([t,i,n,x])=>tl(t,i,n,x)).join('')}</div>
  <div class="zbtns"><button class="btn alt" data-z="sat">Vai al satellite</button></div></div>`;
}
// evidenzia la zona sulla figura (le sue ossa) e la porta in primo piano
function showZone(sat){
 const bs=P.zoneBones(sat);bs.forEach(id=>mark(id,'sel'));
 const pts=bs.flatMap(id=>itemBox(id,true));if(pts.length)setTimeout(()=>focusPts(pts,14),30);
}

export function renderMenu(){
 // allenamento per zone in corso: continua se la figura è quella che serve, altrimenti (cambiato modulo) si chiude
 if(app.L?.tab==='play'){if(app.MOD.id===lessonMod(app.L)){app.G=null;renderLesson();return;}leaveZone();}
 app.G=null;clearGhosts();baseView();const body=app.MOD.id==='corpo';
 const zon=zoneOn(),zsat=zon&&app.Z&&P.satelliti(null,ZC()).find(s=>s.id===app.Z.id);if(app.Z&&!zsat)app.Z=null; // la zona deve essere del corso della figura aperta
 // riquadri a due colonne come nel prototipo: icona, nome, una riga di spiegazione; le sezioni dicono se si gioca in 2D o sul modello 3D
 const mb=(m,i,t,x)=>`<button class="mode tile" data-mode="${m}"><span class="ti" aria-hidden="true">${i}</span><b>${t}</b><small>${x}</small></button>`;
 const sec=(k,t,n)=>`<h3 class="gsec"><span class="tag">${k}</span>${t}</h3><div class="tiles">${n}</div>`;
 const brain=app.MOD.id==='cervello',M=app.MOD;
 const what=M.grpn?(app.grp?'per <b>gruppi</b>':'sulle <b>strutture singole</b>'):app.grp?(body?'per <b>gruppi</b> di ossa':'per <b>lobi e aree</b>'):(body?'sulle <b>ossa singole</b>':'su <b>giri e solchi</b>');
 $('panel').innerHTML=`<div class="gym">${zsat?zoneSheet(zsat):zon?zoneHead():''}<div class="card ghead"><div class="kick">Palestra</div><h2>${zon?'Giochi liberi':'Scegli una sfida'}</h2><p class="mut">3 cuori a round. Ogni risposta giusta dà XP e fa salire la maestria (da beige a oro). Ora giochi ${what}: cambia in alto, dove scegli anche la vista.</p></div>`+
  sec('2D','Puzzle',
  mb('puzzle','🧩','Ricomponi','Rimetti al posto i pezzi mancanti')+
  mb('build','🧱','Componi','Collega i pezzi su schermo vuoto')+
  (body?mb('bridge','🌉','Tendine-ponte',"Dall'osso di origine a quello di inserzione"):'')+
  (M.CASES&&M.CASES.length?mb('case','🩺','Caso clinico','Indizi progressivi: meno ne usi, più XP'):''))+
  sec('2D','Quiz',mb('find','🎯','Trova la struttura','Tocca quella giusta sulla figura')+
  (body?mb('musc','💪','Origine e inserzione','Collega ogni muscolo al suo osso'):mb('func',brain?'🧠':'❤️','Funzione → struttura','Quale struttura svolge questa funzione?')+(brain?mb('nc','🔢','Nervi cranici','Nome, numero e funzione dei 12 nervi'):''))+
  mb('mix','🔀','Misto',"Un po' di tutto"))+
  // giochi sul modello 3D: si giocano nella scheda Atlante, vista 3D (vedi play3d in ui.js)
  sec('3D','Sul modello 3D',mb('3d-ossa','🦴','Trova l\'osso','Tocca l\'osso giusto sul modello')+
  mb('3d-muscoli','💪','Trova il muscolo','Tra quelli visibili da fuori')+
  mb('3d-reperi','📍','Trova il repere','SIAS, epicondili, malleoli…')+
  mb('3d-oi','🎯','Origine e inserzione','Il punto esatto dove si attacca')+
  mb('3d-ricomponi','🧩','Ricomponi','Le ossa di mano, piede, cranio…')+
  mb('3d-ponte','🌉','Tendine-ponte','Osso di origine, poi di inserzione')+
  mb('3d-caso','🩺','Caso clinico','Leggi gli indizi, tocca il muscolo')+
  mb('3d-nervi','🔢','Nervi cranici','Alla base dell\'encefalo')+
  mb('3d-cuore','🫀','Cuore e grandi vasi','Camere, coronarie, grandi vasi')+
  mb('3d-polmoni','🫁','Polmoni','Lobi e bronchi'))+'</div>';
 clearMarks();if(zsat)showZone(zsat);
}
export const clearGhosts=()=>{document.querySelectorAll('.bone.ghost,.bone.gone,.bone.placed').forEach(g=>g.classList.remove('ghost','gone','placed'));
 document.querySelectorAll('#fig .view.bare').forEach(v=>{v.classList.remove('bare');v.removeAttribute('transform');});};
export function startGame(mode){
 baseView();app.G={mode,q:0,total:mode==='case'?6:8,hearts:3,score:0,gain:0,last:null,cur:null,locked:false,used:[],att:0,left:[]};
 if(mode==='puzzle'||mode==='build')return startPuzzle();
 nextQ();
}
export const gh=()=>{const G=app.G;return `<div class="gh"><span>${'❤️'.repeat(G.hearts)}${'🖤'.repeat((G.maxH||3)-G.hearts)}</span><span>${Math.min(G.q+1,G.total)}/${G.total}</span></div>`;};
export function nextQ(){
 const G=app.G,{B,M,CASES,NC}=app;
 clearMarks();baseView();
 if(G.hearts<=0||G.q>=G.total)return endGame();
 const t=G.mode==='mix'?pick(app.MOD.id==='corpo'?['find','musc','bridge']:app.MOD.id==='cervello'?['find','func','nc']:['find','func','case']):G.mode;G.locked=false;resetZoom(true);
 if(t==='find'){
  const b=pickItem(G);G.cur={t,id:b.id};
  $('panel').innerHTML=gh()+`<div class="q">Tocca sulla figura:<br><b>${b.n}</b> <i>${b.l}</i></div>`+(G.zoomed?'<p class="mut">La figura è ingrandita sulla zona giusta: le strutture sono piccole.</p>':'');
 }else if(t==='func'){
  // le funzioni sono scritte per lobi e aree: si usano quelle anche quando si gioca sulle singole strutture
  const Q=app.GR.filter(x=>x.q);let b;do{b=pick(Q);}while(b.id===G.last&&Q.length>1);G.last=b.id;
  const opts=shuffle([...shuffle(Q.filter(x=>x.id!==b.id&&x.q!==b.q)).slice(0,3).map(x=>x.id),b.id]);G.cur={t,id:b.id};
  $('panel').innerHTML=gh()+`<div class="q"><small>Funzione</small><br><b>${b.q}</b><br>Quale struttura?</div>`+opts.map(id=>`<button class="opt" data-id="${id}">${bone(id).n}</button>`).join('');
 }else if(t==='nc'){
  const n=pick(NC),dir=Math.random()<.5,opts=shuffle([...shuffle(NC.filter(x=>x!==n)).slice(0,3),n]);G.cur={t,n};
  $('panel').innerHTML=gh()+(dir?`<div class="q"><small>Nervo cranico</small><br><b>${n.n} – ${n.nm}</b><br>Qual è la sua funzione?</div>`+opts.map(o=>`<button class="opt" data-k="${o.n}">${o.f}</button>`).join(''):`<div class="q"><small>Funzione</small><br><b>${n.f}</b><br>Quale nervo cranico?</div>`+opts.map(o=>`<button class="opt" data-k="${o.n}">${o.n} – ${o.nm}</button>`).join(''));
 }else if(t==='bridge'){
  G.cur={t,m:pickMuscle(G),step:0,first:null};bridgePrompt();
 }else if(t==='case'){
  let c;do{c=pick(CASES);}while(G.used.includes(c.id)&&G.used.length<CASES.length);G.used.push(c.id);
  G.cur={t,c,clues:1,opts:shuffle(c.opts)};casePanel();
 }else{
  const m=pickMuscle(G),role=Math.random()<.5?'o':'i',good=itemSet([m[role],...(m[role+'a']||[])]),ans=itemOf(m[role]);
  // distrattori: niente ossa che siano anche giuste, e possibilmente della stessa regione del corpo per renderla difficile
  const pool=items().filter(b=>!good.has(b.id)&&!b.area);
  const opts=shuffle([...shuffle(pool).slice(0,3).map(b=>b.id),ans]);
  G.cur={t,m,role,ans,good};
  $('panel').innerHTML=gh()+`<div class="q"><small>Muscolo</small><br><b>${m.n}</b><br>Qual è la sua ${role==='o'?'origine':'inserzione'}?</div>`+opts.map(id=>`<button class="opt" data-id="${id}">${bone(id).n}</button>`).join('');
 }
}
// Voce da trovare: tra quelle visibili nella vista attuale; con le singole prima si sceglie il gruppo (così non escono
// sempre falangi e vertebre). Le ossa di mano e piede si chiedono nella vista di zona del loro gruppo (palmare, dall'alto…);
// se la struttura è piccola, la figura si ingrandisce sulla sua zona.
function pickItem(G){
 let b,n=0;
 const zv=g=>!app.grp&&g.zv&&hasView(g.zv)?g.zv:app.view;
 do{
  if(app.grp)b=pick(app.GR.filter(x=>visible(x.id)));
  else{const g=pick(app.GR.filter(x=>!x.area&&x.m.some(m=>visibleIn(m,zv(x)))));b=bone(pick(g.m.filter(m=>visibleIn(m,zv(g)))));}
 }while((b.id===G.last||(G.used.includes(b.id)&&n<30))&&++n<60);
 G.last=b.id;G.used.push(b.id);G.zoomed=false;G.focus=null;
 const gz=!app.grp&&bone(b.g);if(gz&&zv(gz)!==app.view){setView(zv(gz),true);setTimeout(()=>focusItem(b.g,14,true),30);G.zoomed=true;G.focus=b.g;return b;}
 const p=itemBox(b.id);
 if(p.length){const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]),size=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  if(size<app.MOD.W*0.06&&!app.grp){setTimeout(()=>focusItem(b.g,14,true),30);G.zoomed=true;G.focus=b.g;}}
 return b;
}
// muscoli con origine e inserzione su ossa note
function pickMuscle(G){const L=app.M.filter(m=>m.o&&m.i);let m,n=0;do{m=pick(L);}while(G.used.includes(m.id)&&++n<30);G.used.push(m.id);return m;}
function settle(ok,target,extra,xp=10){
 const G=app.G;
 G.locked=true;touchStreak();
 if(ok){G.score++;G.gain+=xp;S.xp+=xp;S.ok++;bump(target,1);}else{G.hearts--;S.ko++;bump(target,-1);}
 G.q++;save();head();refreshMastery();
 const last=G.hearts<=0||G.q>=G.total;
 $('panel').innerHTML=gh()+`<div class="h">${ok?'✅ Esatto! +'+xp+' XP':'❌ Non proprio'}</div>${extra}<button class="next">${last?'Vedi risultato':'Avanti'}</button>`;
}
// sid: struttura singola toccata. Giusto se fa parte della voce chiesta (un'area come Broca può stare dentro un lobo).
export function answerFind(sid){
 const G=app.G;
 if(G.locked)return;const t=bone(G.cur.id),ok=members(t.id).includes(sid),id=ok?t.id:itemOf(sid);
 mark(id,ok?'ok':'bad');if(!ok){mark(t.id,'ok');setTimeout(()=>{if(!visibleNow(t.id))return;focusItem(t.id,20);},60);}
 settle(ok,t.id,`<p>${ok?'':'Hai toccato: <b>'+bone(id).n+'</b>. '}<b>${t.n}</b> – ${t.f||''}</p>`+(t.k?`<p class="tip">🩺 ${t.k}</p>`:'')+(t.group?'':`<p class="mut">Gruppo: ${bone(t.g)?.n||''}</p>`));
}
const visibleNow=id=>visible(id);
export function answerMusc(id){
 const G=app.G;
 if(G.locked)return;const c=G.cur,ok=c.good.has(id);
 showMuscle(c.m);
 settle(ok,c.ans,(ok?'':`<p>Hai scelto: <b>${bone(id).n}</b>.</p>`)+muscleHtml(c.m));
}
export function endGame(){
 const G=app.G;
 clearGhosts();clearMarks();
 const pz=G.mode==='puzzle'||G.mode==='build',n=pz?G.att:G.q,done=G.hearts>0&&(pz?!G.left.length:G.q>=G.total),bonus=done?20:0;S.xp+=bonus;G.gain+=bonus;
 queue.add({module:app.MOD.id,mode:G.mode,score:G.score,total:n,xp:G.gain});save();head();
 const acc=n?G.score/n:0,st=acc>=.9?3:acc>=.6?2:1;
 $('panel').innerHTML=`<div class="res"><div class="big">${'⭐'.repeat(st)}${'☆'.repeat(3-st)}</div><div class="h">${G.score}/${n} corrette</div><p>+${G.gain} XP${done?' (bonus round +20)':''}</p>${G.hearts<=0?'<p class="mut">Cuori finiti: ripassa nella sezione Esplora e riprova.</p>':''}<button class="btn again">Rigioca</button><button class="btn alt menu">Cambia sfida</button></div>`;
}

/* ---------- Tendine-ponte ---------- */
export function bridgePrompt(){
 const c=app.G.cur;
 $('panel').innerHTML=gh()+`<div class="q"><small>Costruisci il ponte</small><br><b>${c.m.n}</b><br>${c.step===0?'Tocca l\'osso di <b style="color:#2563eb">ORIGINE</b>':'Ora tocca l\'osso di <b style="color:#ea580c">INSERZIONE</b>'}</div>`+(c.step?'<button class="btn alt undo">Annulla</button>':'');
}
// sid: struttura singola toccata; con i gruppi vale il gruppo a cui appartiene
export function answerBridge(sid){
 const G=app.G;
 const c=G.cur;if(G.locked)return;const id=itemOf(sid);
 if(c.step===0){c.first=id;c.step=1;clearMarks();mark(id,'org');bridgePrompt();return;}
 if(id===c.first&&!app.grp)return;
 const m=c.m,O=itemSet([m.o,...(m.oa||[])]),I=itemSet([m.i,...(m.ia||[])]),okO=O.has(c.first),okI=I.has(id),ok=okO&&okI;
 bump(itemOf(m.i),ok?1:-1);const drawn=showMuscle(m);
 if(!okO&&!O.has(c.first)&&!I.has(c.first))mark(c.first,'bad');
 if(!okI&&!O.has(id)&&!I.has(id))mark(id,'bad');
 const nm=l=>bonesName(app.grp?[...new Set(l.filter(Boolean).map(itemOf))]:l);
 settle(ok,itemOf(m.o),`<div class="sol"><div><span class="tg o">ORIGINE</span> <b>${nm([m.o,...(m.oa||[])])}</b> ${okO?'✅':'❌ tu: '+bone(c.first).n}</div><div><span class="tg i">INSERZIONE</span> <b>${nm([m.i,...(m.ia||[])])}</b> ${okI?'✅':'❌ tu: '+bone(id).n}</div></div>`+muscleHtml(m)+(drawn?'':'<p class="mut">Da questa vista i punti di attacco non si vedono: prova l\'altra vista.</p>')+(ok?'':'<p class="mut">Sulla figura: blu = origine corretta, arancione = inserzione corretta, rosso = tua scelta sbagliata.</p>'));
}
export function answerFunc(id){
 const G=app.G;
 if(G.locked)return;const t=bone(G.cur.id),ok=id===t.id;
 mark(t.id,'ok');if(!ok)mark(id,'bad');
 settle(ok,t.id,`<p>${ok?'':'Hai scelto: <b>'+bone(id).n+'</b>. '}<b>${t.n}</b> – ${t.f}</p>`+(t.k?`<p class="tip">🩺 ${t.k}</p>`:''));
}
export function answerNc(k){
 const G=app.G;
 if(G.locked)return;const n=G.cur.n,ok=k===n.n;
 settle(ok,null,`<p><b>${n.n} – ${n.nm}</b> (${n.t}): ${n.f}.</p>`);
}

/* ---------- Caso clinico (scenari didattici: da verificare su fonti cliniche) ---------- */
export function casePanel(){
 const c=app.G.cur,cs=c.c;
 $('panel').innerHTML=gh()+`<div class="q"><small>Caso clinico</small><br>Chi o cosa è coinvolto?</div>`+cs.clues.slice(0,c.clues).map((x,i)=>`<div class="clue"><b>Indizio ${i+1}.</b> ${x}</div>`).join('')+c.opts.map(o=>`<button class="opt" data-o="${o}">${o}</button>`).join('')+(c.clues<cs.clues.length?'<button class="btn alt more">Altro indizio (−5 XP)</button>':'');
}
export function answerCase(o){
 const G=app.G;
 const c=G.cur,cs=c.c;if(G.locked)return;
 const ok=o===cs.a,xp=[0,15,10,5][c.clues],m=cs.mid?app.M.find(x=>x.id===cs.mid):null;
 if(m)showMuscle(m);else mark(cs.bid,'ok');
 settle(ok,m?itemOf(m.o):cs.bid,`<p><b>${cs.a}</b>. ${cs.r}</p>`+(m?muscleHtml(m):''),ok?xp:0);
}
