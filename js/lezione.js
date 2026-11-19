/* Lezione del percorso (sezione 3 della specifica), prova «Lo so già» (sezione 4) e progetto del passo 6 (caso clinico con
   ipotesi o quiz finale). Si gioca sulla figura 2D del modulo corpo; numeri da content/regole.json.
   Una lezione è una fila di posti {sid, ps} (struttura e passo); il tipo di domanda si sceglie al momento dalla maestria attuale:
   0 → presentazione e poi scelta tra 4; 1 → richiamo con il tocco (o il nome se la struttura non si tocca nel 2D); 2–3 → nome.
   Almeno 3 domande su 8 non sono a scelta: se mancano, le ultime diventano richiami (tocchi sulle strutture appena presentate
   solo dopo almeno 4 domande). Una risposta giusta a scelta porta al massimo a 1, il tocco a 2, il nome a 3; un errore toglie 1. */
import {$,shuffle,pick} from './util.js';
import {app,S,save,head,queue,bonesName} from './state.js';
import {clearMarks,mark,refreshMastery,resetZoom,showMuscle,muscleHtml,focusItem,itemBox,setView,hasView,visibleIn,baseView} from './figure.js';
import * as P from './percorso.js';
import {openReport} from './segnala.js';
import {account} from './account.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let onExit=()=>{};export const setLessonExit=f=>{onExit=f;};
const live=t=>{const l=$('live');if(l){l.textContent='';setTimeout(()=>{l.textContent=t;},50);}};
const first=s=>{const t=String(s||'');const i=t.search(/[.;](\s|$)/);return i>0?t.slice(0,i+1):t;};
// nome mostrato di un repere: senza le parentesi della fonte (strutture incostanti)
const clean=s=>String(s||'').replace(/^\((.*)\)$/,'$1');

/* ---------- strutture: nomi, testi, figura ---------- */
const info=sid=>{
 if(sid.startsWith('o.')){const b=P.bone(sid);return {n:b.n,l:b.l,d:b.f||''};}
 if(sid.startsWith('r.')){const r=P.rep(sid);return {n:clean(r.n),l:clean(r.l),d:r.d};}
 const m=P.muscle(sid);return {n:m.n,l:m.l,d:m.a};
};
const canTap=(ps,sid)=>ps.tipo==='ossa'||ps.tipo==='connessioni'||(ps.tipo==='reperi'&&!!P.rep(sid).o);
// vista in cui un osso si vede: la vista di zona del suo gruppo (mano, piede, cranio) o una vista del corpo in cui è visibile
function boneView(id){
 const b=P.bone(id),g=b&&app.MOD.byId[b.g];
 if(g?.zv&&hasView(g.zv)&&visibleIn(id,g.zv))return g.zv;
 if(visibleIn(id,app.view))return app.view;
 return app.MOD.views.find(v=>visibleIn(id,v))||app.view;
}
function showBone(id,hl){
 const v=boneView(id);if(v!==app.view)setView(v,true);
 if(hl){mark(id,'sel');setTimeout(()=>focusItem(id,24),30);return;}
 // tocco: niente evidenza; se l'osso è piccolo la figura si ingrandisce sulla zona del suo gruppo
 const b=P.bone(id),p=itemBox(id);
 if(b&&p.length){const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);if(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<app.MOD.W*0.06)setTimeout(()=>focusItem(b.g,14,true),30);}
}
// muscolo: linea dall'origine all'inserzione nella prima vista in cui si può disegnare
function drawMuscle(m){
 if(showMuscle(m))return true;
 for(const v of app.MOD.views){if(v===app.view)continue;setView(v,true);if(showMuscle(m))return true;}
 baseView();return false;
}

/* ---------- risposte scritte: accenti, maiuscole, articoli e punteggiatura non contano ---------- */
const ART=/^(il|lo|la|i|gli|le|l|un|uno|una|muscolo|muscoli|m|osso|ossa|os|musculus)\s+/;
export function norm(s){
 let t=String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),p;
 do{p=t;t=t.replace(ART,'');}while(t!==p);
 return t;
}
// forme accettate di un nome: intero, senza la parte tra parentesi
const alts=n=>{const a=[n,String(n||'').replace(/\([^)]*\)/g,'')];return a.map(norm).filter(Boolean);};

/* ---------- avvio ---------- */
// kind: 'lezione' | 'prova' | 'quiz' | 'caso'; pool: strutture da usare (lezione sulle sbagliate della prova)
export function startLesson(sat,ps,kind='lezione',pool){
 const Rl=P.R().lezione;
 const L={kind,sat,ps,slots:[],si:0,qn:0,hearts:kind==='prova'?0:(kind==='quiz'||kind==='caso'?P.R().progetto.cuori:Rl.cuori),
  ok:0,n:0,nonChoice:0,pres:new Set(),presAt:{},up:[],wrong:[],xp0:S.xp,screen:'q',cur:null};
 const kk=(sid,p)=>P.key(sid,p.aspetto);
 const weak=(L2)=>L2.slice().sort((a,b)=>P.mastery(kk(a.sid,a.ps))-P.mastery(kk(b.sid,b.ps))||((S.seen||{})[kk(a.sid,a.ps)]||0)-((S.seen||{})[kk(b.sid,b.ps)]||0));
 if(kind==='prova'){
  const L2=shuffle(P.usable(ps)).slice(0,P.R().prova.max_domande);L.slots=L2.map(sid=>({sid,ps}));L.screen='intro';
 }else if(kind==='quiz'){
  const steps=P.passi(sat).filter(p=>p.tipo!=='progetto'&&P.usable(p).length),per=Math.ceil(P.R().progetto.quiz_domande/Math.max(1,steps.length));
  L.slots=shuffle(steps.flatMap(p=>weak(P.usable(p).map(sid=>({sid,ps:p}))).slice(0,per))).slice(0,P.R().progetto.quiz_domande);L.screen='intro';
 }else if(kind==='caso'){
  L.caso=P.casoOf(sat);if(!L.caso)return false;L.stage='h1';L.clues=0;L.hyp=[];L.screen='caso';
 }else{
  const base=pool||P.usable(ps),pr=P.prio(ps.id).filter(x=>base.includes(x));
  const main=[...pr.map(sid=>({sid,ps})),...weak(base.filter(x=>!pr.includes(x)).map(sid=>({sid,ps})))];
  const prev=ps.n>=3&&!pool?P.passi(sat).filter(p=>p.n<ps.n&&p.tipo!=='progetto'&&P.stepDone(p)&&P.usable(p).length):[];
  const nMix=prev.length?Rl.ripasso_passi_fatti:0,nMain=Rl.domande-nMix;
  for(let i=0;main.length&&L.slots.length<nMain;i++)L.slots.push(main[i%main.length]);
  // dal passo 3: 2 domande sui passi già fatti dello stesso satellite, a un terzo e a due terzi della lezione
  const mix=weak(prev.flatMap(p=>P.usable(p).map(sid=>({sid,ps:p})))).slice(0,nMix);
  mix.forEach((m,j)=>L.slots.splice(Math.round((j+1)*L.slots.length/(nMix+1)),0,m));
 }
 P.setLast(sat.id);app.L=L;
 if(!L.slots.length&&kind!=='caso'){app.L=null;return false;}
 if(app.MOD.id!=='corpo'){onExit('corpo');return true;} // useMod('corpo') ridisegna la figura e torna qui (renderLesson)
 renderLesson();return true;
}
// Ripasso (fase 2, sezione 5): domande di richiamo (tocco o nome, mai a scelta), senza cuori. daily = «Ripasso del giorno»
// (finirlo vale un giorno di serie), altrimenti «Ripassa questo satellite» (sat). +2 XP per ogni ripasso fatto in tempo.
export function startReview(slots,{daily=false,sat=null}={}){
 const L={kind:'ripasso',daily,sat,ps:null,slots:shuffle(slots),si:0,qn:0,hearts:0,ok:0,n:0,nonChoice:0,pres:new Set(),presAt:{},up:[],wrong:[],xp0:S.xp,screen:'q',cur:null,rv:0};
 if(!L.slots.length)return false;
 app.L=L;if(sat)P.setLast(sat.id);
 if(app.MOD.id!=='corpo'){onExit('corpo');return true;}
 renderLesson();return true;
}
// Esame del pianeta (fase 2, sezione 4): 20 domande con 60 secondi ciascuna, senza aiuti né cuori (le strutture a maestria 2 o più
// mai a scelta), poi il caso clinico senza tempo. Domande e caso dell'ultimo tentativo non si ripetono (P.examSlots).
export function startExam(pl){
 if(!P.examOpen(pl))return false;
 const slots=P.examSlots(pl);if(!slots.length)return false;
 const cs=P.esameCasi(pl),lastC=P.examLast(pl)?.caso,cs2=cs.length>1?cs.filter(c=>c.id!==lastC):cs;
 const L={kind:'esame',pl,sat:null,ps:null,slots,si:0,qn:0,hearts:0,ok:0,n:0,nonChoice:0,pres:new Set(),presAt:{},up:[],wrong:[],xp0:S.xp,
  screen:'intro',cur:null,caso:cs2.length?pick(cs2):null,res:[]};
 app.L=L;
 if(app.MOD.id!=='corpo'){onExit('corpo');return true;}
 renderLesson();return true;
}
export const quitLesson=()=>{app.L=null;stopTick();clearMarks();baseView();onExit();};

/* ---------- cronometro dell'esame: scadenza per domanda (q.end); allo scadere la risposta conta come sbagliata ---------- */
let TK=null;
const stopTick=()=>{if(TK){clearInterval(TK);TK=null;}};
const secs=()=>P.R().esame.secondi;
function tick(){
 const L=app.L,q=L&&L.cur,el=$('ltim');
 // fuori dalla schermata della domanda (altra scheda, risposta data) il cronometro si ferma a schermo: la scadenza resta
 if(!L||L.kind!=='esame'||L.screen!=='q'||!q||q.done||!q.end||!el){stopTick();return;}
 const ms=Math.max(0,q.end-Date.now()),left=Math.ceil(ms/1000);
 el.querySelector('b').textContent=left;el.classList.toggle('warn',left<=10);
 const bar=el.querySelector('i');if(bar)bar.style.width=(ms/(secs()*1000)*100).toFixed(1)+'%';
 if(left<=10&&!q.warned){q.warned=1;live('Restano 10 secondi.');}
 if(ms<=0)timeout(L,q);
}
const startTick=()=>{if(!TK)TK=setInterval(tick,250);tick();};
function timeout(L,q){stopTick();if(q.done)return;q.timeout=true;q.picked=null;answer(L,q,false);}
const timerHtml=q=>{const left=Math.max(0,Math.ceil((q.end-Date.now())/1000));
 return `<div class="ltim${left<=10?' warn':''}" id="ltim" role="timer" aria-label="Tempo rimasto per questa domanda, in secondi"><span aria-hidden="true">⏱</span> <b>${left}</b> s<span class="ltb" aria-hidden="true"><i style="width:${(Math.max(0,q.end-Date.now())/(secs()*1000)*100).toFixed(1)}%"></i></span></div>`;};

/* ---------- tipo della domanda, scelto al momento ---------- */
function pickType(L,slot){
 const {sid,ps}=slot,k=P.key(sid,ps.aspetto),m=P.mastery(k),tc=canTap(ps,sid),Rl=P.R().lezione;
 if(L.kind==='prova'||L.kind==='ripasso')return tc&&Math.random()<.5?'tocco':'nome';
 // esame: niente presentazioni; a maestria 2 o più mai a scelta
 if(L.kind==='esame')return tc&&Math.random()<.5?'tocco':m>=P.R().maestria.passo_fatto?'nome':'scelta';
 if(m===0&&!L.pres.has(k))return 'pres';
 let t=m===0?'scelta':m===1?(tc?'tocco':'nome'):'nome';
 const justPres=L.pres.has(k)&&L.qn-L.presAt[k]<Rl.dopo_presentazione_min;
 if(justPres&&t==='nome')t=tc?'tocco':'scelta';
 // se le domande rimaste bastano appena per arrivare a 3 non a scelta, questa diventa un richiamo
 const left=L.slots.length-L.si,need=Rl.non_scelta_min-L.nonChoice;
 if(t==='scelta'&&need>=left)t=tc?'tocco':(justPres?'scelta':'nome');
 return t;
}

/* ---------- domande: testo, opzioni, controllo ---------- */
const mu=sid=>P.muscle(sid);
function satStruct(tipo,sat=app.L.sat){const ps=sat&&P.passi(sat).find(p=>p.tipo===tipo);return ps?P.usable(ps):[];}
function options(slot){
 const {sid,ps}=slot,n=P.R().lezione.opzioni-1,lab=id=>info(id).n,st=t=>satStruct(t,slot.sat||app.L.sat);
 const fill=(right,pools,label)=>{const out=[right],seen=new Set([norm(label(right))]);
  for(const pool of pools)for(const id of shuffle(pool)){if(out.length>n)break;const k=norm(label(id));if(!seen.has(k)){seen.add(k);out.push(id);}}
  return shuffle(out).map(id=>({id,label:label(id)}));};
 if(ps.tipo==='ossa')return fill(sid,[st('ossa').filter(x=>x!==sid),P.bone(sid)?(app.MOD.byId[P.bone(sid).g]?.m||[]).filter(x=>x!==sid):[],app.MOD.B.map(b=>b.id).filter(x=>x!==sid)],lab);
 if(ps.tipo==='reperi'){const all=st('reperi').filter(x=>x!==sid),o=P.rep(sid).o;return fill(sid,[all.filter(x=>P.rep(x).o===o),all,Object.keys(app.LEZ.reperi).filter(x=>x!==sid)],lab);}
 if(ps.tipo==='muscoli')return fill(sid,[st('muscoli').filter(x=>x!==sid),app.MOD.M.map(m=>m.id).filter(x=>x!==sid)],lab);
 if(ps.tipo==='funzione'){const a=mu(sid).a,ok=x=>x!==sid&&mu(x)?.a&&mu(x).a!==a;return fill(sid,[st('funzione').filter(ok),app.MOD.M.map(m=>m.id).filter(ok)],lab);}
 // connessioni: ossa di origine o inserzione
 const m=mu(sid),good=goodBones(m,slot.role),bad=x=>!good.includes(x);
 const sb=slot.sat||app.L.sat,satBones=sb&&P.passi(sb).find(p=>p.tipo==='ossa');
 return fill(good[0],[(satBones?P.usable(satBones):[]).filter(bad),app.MOD.B.map(b=>b.id).filter(bad)],id=>P.bone(id).n);
}
const goodBones=(m,role)=>[m[role],...(m[role+'a']||[])].filter(Boolean);
const roleName=r=>r==='o'?'origine':'inserzione';
// testo della domanda (e la figura da preparare)
function prompt(q){
 const {sid,ps}=q.slot,I=info(sid),t=q.t;
 if(ps.tipo==='ossa'){showBone(sid,t!=='tocco');
  return t==='tocco'?`Tocca sulla figura:<br><b>${esc(I.n)}</b>`:t==='scelta'?'Come si chiama l\'osso evidenziato sulla figura?':'Scrivi il nome dell\'osso evidenziato sulla figura.';}
 if(ps.tipo==='reperi'){const r=P.rep(sid);
  if(t==='tocco'){showBone(r.o,false);return `Su quale osso si trova <b>${esc(I.n)}</b>? Toccalo sulla figura.`;}
  if(r.o)showBone(r.o,true);
  return `${t==='scelta'?'Quale repere è descritto?':'Scrivi il nome del repere descritto.'}<div class="clue">${esc(mask(r.d,[r.n,r.l]))}</div>${r.o?`<small class="mut">Sull'osso evidenziato: ${esc(P.bone(r.o).n)}</small>`:''}`;}
 if(ps.tipo==='muscoli'){const m=mu(sid),drawn=drawMuscle(m);
  const ctx=drawn?'Il muscolo va dall\'origine (O) all\'inserzione (I) segnate sulla figura.':`<span class="tg o">ORIGINE</span> ${esc(m.ot)} · <span class="tg i">INSERZIONE</span> ${esc(m.it)}`;
  return `${t==='scelta'?'Quale muscolo è?':'Scrivi il nome del muscolo.'}<div class="clue">${ctx}</div>`;}
 if(ps.tipo==='funzione'){const m=mu(sid);
  return `${t==='scelta'?'Quale muscolo fa questa azione?':'Completa: è il muscolo che fa questa azione.'}<div class="clue">${esc(m.a)}</div>`;}
 const m=mu(sid),r=roleName(q.slot.role);
 if(t==='tocco')return `Tocca sulla figura l'osso di <b>${r}</b> di:<br><b>${esc(m.n)}</b>`;
 if(t==='scelta')return `Qual è l'osso di <b>${r}</b> di <b>${esc(m.n)}</b>?`;
 return `Completa la frase:<br><b>${esc(m.n)}</b> ${q.slot.role==='o'?'ha origine da':'si inserisce su'} ___`;
}
// toglie dalla descrizione il nome della struttura (la parte prima dei due punti e le parole del nome)
function mask(d,names){
 let t=String(d||'').replace(/^[^:]{2,80}:\s*/,'');
 for(const n of names.map(clean).filter(x=>x&&x.length>3))t=t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'___');
 return t.charAt(0).toUpperCase()+t.slice(1);
}
function accepted(q){
 const {sid,ps}=q.slot;
 if(ps.tipo==='connessioni'){const m=mu(sid);return [...goodBones(m,q.slot.role).flatMap(id=>[...alts(P.bone(id).n),...alts(P.bone(id).l)]),...alts(q.slot.role==='o'?m.ot:m.it)];}
 if(ps.tipo==='funzione'){const a=mu(sid).a;return app.MOD.M.filter(m=>m.a===a).flatMap(m=>[...alts(m.n),...alts(m.l)]);}
 const I=info(sid);return [...alts(I.n),...alts(I.l)];
}
// dati della domanda per l'etichetta di verifica e per «Segnala un errore»
function dataItems(slot){
 const {sid,ps}=slot,v=P.voce(sid),I=info(sid),m=sid.startsWith('o.')||sid.startsWith('r.')?null:mu(sid);
 const val={nome:I.n,latino:I.l,descrizione:I.d,azione:m?.a,origine:m?.ot,inserzione:m?.it};
 const lab={nome:'Nome',latino:'Nome latino',descrizione:'Descrizione',azione:'Azione',origine:'Origine',inserzione:'Inserzione'};
 return v?(P.CAMPI[ps.tipo]||[]).map(c=>({id:v+'.'+c,label:lab[c],value:val[c]||''})):[];
}
function foot(slot){
 const vf=P.verifica(P.dataIds(slot.sid,slot.ps.tipo));
 return `<div class="lfoot"><span class="vtag${vf.ok?' ok':''}">${vf.ok?'✔ ':''}${esc(vf.txt)}</span><button class="lnk" data-l="report">⚑ Segnala un errore</button></div>`;
}

/* ---------- disegno ---------- */
function headHtml(L){
 const tot=L.slots.length||1,done=Math.min(L.si,tot),h=!L.hearts0?'':`<span aria-label="Cuori: ${L.hearts} su ${L.maxH||L.hearts0}">${'❤️'.repeat(Math.max(0,L.hearts))}${'🖤'.repeat(Math.max(0,(L.hearts0||0)-L.hearts))}</span>`;
 return `<div class="lh"><button class="lx" data-l="quit" aria-label="Esci dalla lezione">✕</button>
  <div class="lbar" role="progressbar" aria-label="Avanzamento" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${done}"><i style="width:${done/tot*100}%"></i></div>${h}</div>`;
}
const title=L=>L.kind==='esame'?'Esame · '+esc(L.pl.nome):L.kind==='ripasso'?(L.daily?'Ripasso del giorno':'Ripasso · '+esc(L.sat?.nome||'')):({lezione:'Lezione',prova:'Lo so già: mettimi alla prova',quiz:'Quiz finale',caso:'Caso clinico'}[L.kind])+' · '+esc(L.ps.nome);
export function renderLesson(){
 const L=app.L;if(!L)return;
 if(L.hearts0==null)L.hearts0=L.hearts;
 clearMarks();
 if(L.screen==='intro')return intro(L);
 if(L.screen==='end')return endScreen(L);
 if(L.screen==='caso')return casoScreen(L);
 if(!L.cur||L.cur.slotI!==L.si){
  if(L.hearts0&&L.hearts<=0||L.si>=L.slots.length)return finish();
  const slot=L.slots[L.si];if(slot.ps.tipo==='connessioni')slot.role=Math.random()<.5?'o':'i';
  const t=pickType(L,slot);
  if(t==='pres'){const k=P.key(slot.sid,slot.ps.aspetto);L.pres.add(k);L.presAt[k]=L.qn;L.cur={slotI:L.si,slot,t:'pres'};}
  else L.cur={slotI:L.si,slot,t,opts:t==='scelta'?options(slot):null,right:slot.ps.tipo==='connessioni'?goodBones(mu(slot.sid),slot.role)[0]:slot.sid};
 }
 const q=L.cur;
 if(q.t==='pres')return presScreen(L,q);
 if(q.done)return feedback(L,q);
 if(L.kind==='esame'){if(!q.end)q.end=Date.now()+secs()*1000;else if(Date.now()>=q.end)return timeout(L,q);}
 const body=prompt(q);
 let ans='';
 if(q.t==='scelta')ans=q.opts.map(o=>`<button class="opt" data-l="opt" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('');
 else if(q.t==='nome')ans=`<form class="lname" data-l="form"><label for="lin" class="sr">Risposta</label><input id="lin" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Scrivi qui"><button class="btn" type="submit">Controlla</button></form><p class="mut">Accenti, maiuscole e articoli non contano.</p>`;
 else ans=`<p class="mut">Tocca la figura qui sopra. Doppio tocco per ingrandire.</p>`;
 $('panel').innerHTML=headHtml(L)+(L.kind==='esame'?timerHtml(q):'')+`<div class="q" id="lq" tabindex="-1"><small>${title(L)}</small><br>${body}</div>${ans}`+foot(q.slot);
 focusQ();
 if(L.kind==='esame')startTick();
}
const focusQ=()=>{const e=$('lin')||$('lq');try{e?.focus({preventScroll:true});}catch(x){}};
function intro(L){
 const n=L.slots.length,E=P.R().esame;
 const txt=L.kind==='esame'?`${n} domande sui satelliti di ${L.pl.nome}, con ${E.secondi} secondi per ognuna: il tempo rimasto si vede in alto e allo scadere la risposta conta come sbagliata. Niente aiuti e niente cuori. ${L.caso?'Poi un caso clinico, senza tempo: risolvilo entro il '+E.caso_indizio_max+'° indizio con al massimo '+(E.caso_errori_max===1?'un errore':E.caso_errori_max+' errori')+'. ':''}Per superarlo servono almeno ${examNeed(n)} risposte giuste${L.caso?' e il caso risolto':''}: diventi «${P.expertTitle(L.pl)}» e guadagni ${E.xp} XP. A ogni tentativo le domande cambiano.`
  :L.kind==='prova'?`Una domanda di richiamo per ogni struttura (${n}), da toccare sulla figura o da scrivere, senza cuori. Le strutture che indovini salgono a maestria 2. Con almeno il ${Math.round(P.R().prova.soglia*100)}% di risposte giuste il passo è fatto. Un tentativo al giorno.`
  :`${n} domande dai passi 1–5 del satellite, con ${L.hearts} cuori. Con almeno l'${Math.round(P.R().progetto.quiz_soglia*100)}% di risposte giuste il satellite si accende. Il caso clinico di questo satellite non è ancora stato scritto: per ora il progetto è questo quiz.`;
 $('panel').innerHTML=headHtml(L)+`<div class="q" id="lq" tabindex="-1"><small>${title(L)}</small></div><p>${txt}</p><button class="btn" data-l="go">Inizia</button>`;
 focusQ();
}
function presScreen(L,q){
 const {sid,ps}=q.slot,I=info(sid);
 if(ps.tipo==='ossa')showBone(sid,true);else if(ps.tipo==='reperi'&&P.rep(sid).o)showBone(P.rep(sid).o,true);else drawMuscle(mu(sid));
 const extra=ps.tipo==='reperi'&&P.rep(sid).o?`<br><small class="mut">Sull'osso evidenziato: ${esc(P.bone(P.rep(sid).o).n)}</small>`:'';
 const line=ps.tipo==='funzione'||ps.tipo==='muscoli'?`<b>Azione</b>: ${esc(mu(sid).a)}`:esc(first(I.d));
 $('panel').innerHTML=headHtml(L)+`<div class="q" id="lq" tabindex="-1"><small>Nuova struttura</small><br><b>${esc(I.n)}</b> <i>${esc(I.l)}</i></div><p>${line}${extra}</p><button class="btn" data-l="next">Ho capito</button>`+foot(q.slot);
 focusQ();
}

/* ---------- risposta ---------- */
export function lessonTap(sid){
 const L=app.L;if(!L||!L.cur||L.cur.t!=='tocco'||L.cur.done)return;
 const q=L.cur,{ps}=q.slot,s=q.slot.sid;
 let ok;
 if(ps.tipo==='ossa')ok=sid===s;else if(ps.tipo==='reperi')ok=sid===P.rep(s).o;else ok=goodBones(mu(s),q.slot.role).includes(sid);
 q.picked=sid;answer(L,q,ok);
}
const examNeed=n=>Math.ceil(n*P.R().esame.soglia/P.R().esame.domande);
function answer(L,q,ok){
 if(L.kind==='esame'){stopTick();if(!q.timeout&&q.end&&Date.now()>q.end+500){q.timeout=true;q.picked=null;ok=false;}}
 const {sid,ps}=q.slot,k=P.key(sid,ps.aspetto),m=P.mastery(k),M=P.R().maestria,X=P.R().xp;
 const cap={scelta:M.scelta_max,tocco:M.tocco_max,nome:M.nome_max}[q.t];
 let nm=ok?(m<cap?m+1:m):Math.max(0,m+M.errore);
 if(L.kind==='prova'&&ok)nm=Math.max(nm,M.passo_fatto);
 S.mastery[k]=nm;(S.seen||(S.seen={}))[k]=Date.now();
 // ripasso: una risposta di richiamo giusta su una struttura che scade entro 1 giorno la porta all'intervallo successivo
 if(P.reviewAnswer(k,ok,q.t!=='scelta')&&L.kind==='ripasso'){L.rv++;P.gain(P.R().ripasso.xp_puntuale,false);}
 const mmax=S.mmax||(S.mmax={}),reached=mmax[k]??m;
 if(ok){S.ok++;L.ok++;P.gain(m>=M.max?X.giusta_gia_3:X.giusta,false);}else{S.ko++;if(L.hearts0)L.hearts--;L.wrong.push(sid);}
 if(nm>reached){mmax[k]=nm;P.gain(X.livello_nuovo,true);}
 if(nm>m)L.up.push({k,sid,nm});
 if(q.t!=='scelta')L.nonChoice++;
 if(L.kind==='esame')L.res.push({sat:q.slot.sat,ok});
 L.n++;L.qn++;L.si++;q.done=true;q.ok=ok;
 save();head();refreshMastery();
 live(ok?'Esatto.':(q.timeout?'Tempo scaduto. ':'Non è giusto. ')+'La risposta è '+rightName(q)+'.');
 feedback(L,q);
}
const rightName=q=>{const {sid,ps}=q.slot;if(ps.tipo==='connessioni')return bonesName(goodBones(mu(sid),q.slot.role));if(ps.tipo==='reperi'&&q.t==='tocco')return P.bone(P.rep(sid).o).n;return info(sid).n;};
function feedback(L,q){
 const {sid,ps}=q.slot,I=info(sid),ok=q.ok,last=(L.hearts0&&L.hearts<=0)||L.si>=L.slots.length;
 const said=ok?'':q.timeout?'Tempo scaduto. ':null;
 const picked=q.picked?(q.t==='nome'?`«${esc(q.picked)}»`:esc(ps.tipo==='connessioni'||q.t==='tocco'?P.bone(q.picked)?.n||q.picked:info(q.picked).n)):'';
 let why='';
 if(ps.tipo==='ossa'){showBone(sid,false);mark(sid,'ok');if(!ok&&q.picked&&P.bone(q.picked))mark(q.picked,'bad');
  why=`<p>${said??`Hai indicato ${picked}. `}<b>${esc(I.n)}</b> <i>${esc(I.l)}</i> – ${esc(I.d)}</p>`;}
 else if(ps.tipo==='reperi'){const r=P.rep(sid);if(r.o){showBone(r.o,false);mark(r.o,'ok');}if(!ok&&q.t==='tocco'&&P.bone(q.picked))mark(q.picked,'bad');
  const alt=!ok&&q.t==='scelta'&&P.rep(q.picked)?`<p class="mut">${picked} invece: ${esc(first(P.rep(q.picked).d))}</p>`:'';
  why=`<p>${said??`Hai indicato ${picked}. `}<b>${esc(I.n)}</b>${r.o?` (sull'osso ${esc(P.bone(r.o).n)})`:''}: ${esc(r.d)}</p>${alt}`;}
 else if(ps.tipo==='muscoli'||ps.tipo==='funzione'){const m=mu(sid);drawMuscle(m);
  const alt=!ok&&q.t==='scelta'&&mu(q.picked)?`<p class="mut">${picked} invece: ${esc(mu(q.picked).a)}</p>`:'';
  why=`<p>${said??`Hai indicato ${picked}. `}È <b>${esc(m.n)}</b>.</p>${alt}`+muscleHtml(m);}
 else{const m=mu(sid),good=goodBones(m,q.slot.role),r=roleName(q.slot.role);drawMuscle(m);if(!ok&&q.t==='tocco'&&P.bone(q.picked))mark(q.picked,'bad');
  why=`<p><b>${esc(m.n)}</b>: ${r} su <b>${esc(bonesName(good))}</b> (${esc(q.slot.role==='o'?m.ot:m.it)})${ok?'':q.timeout?' · tempo scaduto':`, non su ${picked}`}.</p>`+muscleHtml(m);}
 $('panel').innerHTML=headHtml(L)+`<div class="h ${ok?'okh':'koh'}" id="lq" tabindex="-1">${ok?'✅ Esatto!':q.timeout?'⏱ Tempo scaduto':'❌ Non è giusto'}</div>${why}<button class="btn" data-l="next">${last?(L.kind==='esame'&&L.caso?'Al caso clinico':'Vedi risultato'):'Avanti'}</button>`+foot(q.slot);
 focusQ();
}

/* ---------- fine ---------- */
function finish(){
 if(app.L.kind==='esame')return examNext(app.L);
 const L=app.L,Rg=P.R(),acc=L.n?L.ok/L.n:0,stars=acc>=Rg.stelle.tre?3:acc>=Rg.stelle.due?2:1,now=new Date().toISOString();
 const completed=L.si>=L.slots.length&&!(L.hearts0&&L.hearts<=0);
 L.stars=completed?stars:0;L.msg='';L.next=null;
 if(L.kind==='ripasso'){
  if(L.daily&&completed){if(S.day&&S.day.d===P.today())S.day.rip=true;else S.day={d:P.today(),xp:0,goal:false,rip:true};}
  L.msg=L.rv?`${L.rv} ${L.rv===1?'struttura ripassata':'strutture ripassate'} in tempo: +${L.rv*P.R().ripasso.xp_puntuale} XP.`:'';
  if(L.daily&&completed)L.msg+=(L.msg?' ':'')+'Il ripasso di oggi vale per la serie.';
 }
 else if(L.kind==='lezione'){if(completed){P.gain(Rg.xp.lezione_con_cuori,false);P.setNode(L.ps.id,{stato:'iniziato',stelle:stars});}}
 else if(L.kind==='prova'){
  P.setProva(L.ps.id);const wrong=[...new Set(L.wrong)];
  if(acc>=Rg.prova.soglia){
   if(!['fatto','acceso'].includes(P.node(L.ps.id)?.stato)){P.setNode(L.ps.id,{stato:'fatto',stelle:stars,fatto_il:now});P.gain(Rg.xp.passo_fatto,true);L.msg=`🎉 Passo fatto con la prova! +${Rg.xp.passo_fatto} XP`;}
   P.setPrio(L.ps.id,wrong);if(wrong.length)L.next={kind:'lezione',pool:wrong,label:'Lezione sulle sbagliate'};
  }else{P.setPrio(L.ps.id,wrong);L.msg='Le prossime lezioni partono dalle strutture sbagliate.';}
 }else if(L.kind==='quiz'){
  if(completed&&acc>=Rg.progetto.quiz_soglia)P.setNode(L.ps.id,{stato:'fatto',stelle:stars,fatto_il:now});
  else L.msg=`Serve almeno l'${Math.round(Rg.progetto.quiz_soglia*100)}% con i cuori rimasti: riprova quando vuoi.`;
 }
 L.rewards=P.checkProgress();
 queue.add({module:'percorso',mode:L.kind,score:L.ok,total:L.n,xp:Math.max(0,S.xp-L.xp0)});
 save();head();refreshMastery();
 L.gain=Math.max(0,S.xp-L.xp0);L.screen='end';endScreen(L);
}
function endScreen(L){
 const day=S.day||{xp:0},g=P.goal(),pct=Math.min(1,(day.xp||0)/g),done=!!L.ps&&['fatto','acceso'].includes(P.node(L.ps.id)?.stato);
 const ups=L.up.filter((u,i,a)=>a.findIndex(x=>x.k===u.k)===i).map(u=>{const lv=P.mastery(u.k);return `<li><span class="mdot m${lv}" aria-hidden="true">${lv}</span> ${esc(info(u.sid).n)} <small class="mut">maestria ${lv}</small></li>`;}).join('');
 const rw=(L.rewards||[]).map(r=>`<p class="party">${r.t==='satellite'?`🌟 ${esc(r.sat.nome)} acceso! +${r.xp} XP`:`🎉 ${esc(r.ps.nome)} (${esc(r.sat.nome)}): passo fatto! +${r.xp} XP`}</p>`).join('');
 const nextStep=L.ps&&P.passi(L.sat).find(p=>!P.stepDone(p)),ex=L.kind==='esame';
 const ring=`<div class="ring" role="img" aria-label="Obiettivo del giorno: ${day.xp||0} XP su ${g}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="rb"/><circle cx="18" cy="18" r="15" class="rf" stroke-dasharray="${(pct*94.2).toFixed(1)} 94.2"/></svg><span>${day.xp||0}/${g}</span></div>`;
 const stars=L.kind==='prova'||L.kind==='ripasso'||(ex&&!L.passed)?'':`<div class="big" aria-label="${L.stars} stelle su 3">${'⭐'.repeat(L.stars)}${'☆'.repeat(3-L.stars)}</div>`;
 const btns=(L.next?`<button class="btn" data-l="again" data-k="${L.next.kind}">${esc(L.next.label)}</button>`:'')+
  (done&&nextStep&&nextStep.id!==L.ps.id?`<button class="btn" data-l="step" data-id="${esc(nextStep.id)}">Prossimo passo</button>`:'')+
  (!done&&L.kind==='lezione'?`<button class="btn" data-l="again" data-k="lezione">Ancora una lezione</button>`:'')+
  (L.kind==='quiz'&&!done?`<button class="btn" data-l="again" data-k="quiz">Riprova</button>`:'')+
  (L.kind==='ripasso'&&L.daily&&P.moreAvail()?`<button class="btn" data-l="more">Altre ${Math.min(P.R().ripasso.altre,P.moreAvail())}</button>`:'')+
  (ex&&L.weak?L.weak.map(s=>`<button class="btn" data-l="exrev" data-id="${esc(s.id)}">↻ Ripassa ${esc(s.nome)}</button>`).join(''):'')+
  `<button class="btn alt" data-l="quit">${ex?'Torna al pianeta':L.kind==='ripasso'&&!L.sat?'Torna al percorso':'Torna al satellite'}</button>`;
 const exh=ex?`<p class="party ${L.passed?'okh':'koh'}">${L.passed?'✅ Esame superato':'❌ Esame non superato'}</p>${L.caso?`<p>Caso clinico: ${L.solved?'risolto':'non risolto'}</p>`:''}`+
  (!L.passed?`<p>${L.ok<L.need?`Servivano almeno ${L.need} risposte giuste. `:''}${L.weak?.length?`I satelliti più deboli: <b>${L.weak.map(s=>esc(s.nome)).join('</b> e <b>')}</b>. Ripassali e poi riprova: le domande saranno diverse.`:''}</p>`:''):'';
 $('panel').innerHTML=`<div class="res"><div class="h" id="lq" tabindex="-1">${title(L)}</div>${exh}${stars}<p>${L.ok}/${L.n} giuste · <b>+${L.gain} XP</b>${L.hearts0&&L.hearts<=0?' · cuori finiti':''}</p>
  ${L.msg?`<p>${esc(L.msg)}</p>`:''}${rw}${done&&!rw&&L.kind==='lezione'?'<p class="party">✅ Passo fatto</p>':''}
  ${ups?`<div class="sub">Strutture salite di livello</div><ul class="ups">${ups}</ul>`:''}
  <div class="dayrow">${ring}<span>🔥 ${(S.streak||0)===1?'1 giorno di fila':(S.streak||0)+' giorni di fila'}${S.shields?` · 🛡 ${S.shields} scud${S.shields>1?'i':'o'}`:''}</span></div>${btns}</div>`;
 focusQ();
}

/* ---------- caso clinico del progetto (ipotesi prima di ogni indizio, si risponde con le opzioni del caso) ---------- */
function casoScreen(L){
 const c=L.caso,sat=L.csat||L.sat,cases=c.clues,ex=L.kind==='esame',maxC=ex?Math.min(cases.length,P.R().esame.caso_indizio_max):cases.length;
 const m=c.mid?mu(c.mid):null;
 if(L.stage==='h1'||L.stage==='h2'){
  if(!L.hq||L.hq.stage!==L.stage){
   if(L.stage==='h1'){const others=shuffle(P.satelliti().filter(s=>s.id!==sat.id)).slice(0,3);L.hq={stage:'h1',q:'Quale distretto è coinvolto?',right:sat.nome,opts:shuffle([sat.nome,...others.map(s=>s.nome)])};}
   else{const a=m?.a||c.a,pool=shuffle(app.MOD.M.filter(x=>x.a&&x.a!==a).map(x=>x.a)).filter((x,i,arr)=>arr.indexOf(x)===i).slice(0,3);L.hq={stage:'h2',q:'Quale funzione è compromessa?',right:a,opts:shuffle([a,...pool])};}
  }
  const h=L.hq;
  $('panel').innerHTML=headHtml(L)+`<div class="q" id="lq" tabindex="-1"><small>${ex?'Caso clinico dell\'esame · ipotesi (non conta come errore)':'Caso clinico · ipotesi (non costa cuori)'}</small><br>${esc(h.q)}</div>`+cluesHtml(L)+h.opts.map((o,i)=>`<button class="opt" data-l="hyp" data-i="${i}">${esc(o)}</button>`).join('')+casoFoot(L);
  return focusQ();
 }
 if(L.stage==='end'){
  const ok=L.solved,wrongH=L.hyp.filter(x=>!x).length;
  $('panel').innerHTML=headHtml(L)+`<div class="h ${ok?'okh':'koh'}" id="lq" tabindex="-1">${ok?'✅ Caso risolto':'❌ Caso non risolto'}</div>
   <div class="chain"><div><b>Segno</b>: ${esc(cases[0])}</div><div><b>Struttura</b>: ${esc(c.a)}</div><div><b>Perché</b>: ${esc(c.r)}</div></div>${m?muscleHtml(m):''}
   <button class="btn" data-l="casoend">Vedi risultato</button>`+casoFoot(L);
  if(m)drawMuscle(m);
  return focusQ();
 }
 // indizi e risposta
 $('panel').innerHTML=headHtml(L)+`<div class="q" id="lq" tabindex="-1"><small>${ex?'Caso clinico dell\'esame · senza tempo':'Caso clinico'}</small><br>Chi è coinvolto?</div>`+cluesHtml(L)+
  (L.fb?`<p class="koh" role="status">${esc(L.fb)}</p>`:'')+
  shuffleOnce(L).map((o,i)=>`<button class="opt" data-l="cans" data-i="${i}">${esc(o)}</button>`).join('')+
  (L.clues<maxC?`<button class="btn alt" data-l="clue">Altro indizio</button>`:'')+casoFoot(L);
 focusQ();
}
const shuffleOnce=L=>L.copts||(L.copts=shuffle(L.caso.opts));
const cluesHtml=L=>L.caso.clues.slice(0,L.clues).map((x,i)=>`<div class="clue"><b>Indizio ${i+1}.</b> ${esc(x)}</div>`).join('');
function casoFoot(L){
 const id='caso.corpo.'+L.caso.id,vf=P.verifica(['indizio_1','indizio_2','indizio_3','risposta','spiegazione'].map(c=>id+'.'+c));
 return `<div class="lfoot"><span class="vtag${vf.ok?' ok':''}">${esc(vf.txt)}</span><button class="lnk" data-l="report">⚑ Segnala un errore</button></div>`;
}
function casoHyp(i){const L=app.L,h=L.hq;L.hyp.push(h.opts[i]===h.right);live(h.opts[i]===h.right?'Ipotesi giusta.':'Ipotesi sbagliata: era '+h.right+'.');L.clues++;L.stage=L.stage==='h1'?'h2':'ans';L.hq=null;casoScreen(L);}
function casoAns(i){
 const L=app.L,o=shuffleOnce(L)[i],ok=o===L.caso.a;
 if(L.kind==='esame'){
  const E=P.R().esame;
  if(ok){L.solved=L.clues<=E.caso_indizio_max;L.stage='end';live('Esatto.');}
  else{L.cerr=(L.cerr||0)+1;live('Non è giusto.');
   if(L.cerr>E.caso_errori_max){L.solved=false;L.stage='end';}else L.fb=`${o}: no. Un altro errore e il caso non è risolto.`;}
  return casoScreen(L);
 }
 if(ok){L.solved=true;L.stage='end';live('Esatto.');}
 else{L.hearts--;L.fb=`${o}: no. ${L.hearts>0?'Riprova o chiedi un altro indizio.':''}`;live('Non è giusto.');if(L.hearts<=0){L.solved=false;L.stage='end';}}
 casoScreen(L);
}
function casoEnd(){
 if(app.L.kind==='esame'){app.L.cdone=true;return examNext(app.L);}
 const L=app.L,wrongH=L.hyp.filter(x=>!x).length,stars=wrongH===0?3:wrongH===1?2:1,now=new Date().toISOString();
 L.n=1;L.ok=L.solved?1:0;L.stars=L.solved?stars:0;L.msg=L.solved?'':'Riprova il caso quando vuoi.';
 if(L.solved)P.setNode(L.ps.id,{stato:'fatto',stelle:stars,fatto_il:now});
 L.rewards=P.checkProgress();
 queue.add({module:'percorso',mode:'caso',score:L.ok,total:1,xp:Math.max(0,S.xp-L.xp0)});
 save();head();L.gain=Math.max(0,S.xp-L.xp0);L.screen='end';
 if(!L.solved)L.next={kind:'caso',label:'Riprova il caso'};
 endScreen(L);
}

/* ---------- clic nel pannello ---------- */
export function lessonClick(e){
 const L=app.L;if(!L)return false;
 const b=e.target.closest('[data-l]');if(!b)return true;
 const a=b.dataset.l;
 if(a==='quit'){quitLesson();return true;}
 if(a==='report'){const items=L.screen==='caso'?casoItems(L):L.cur?dataItems(L.cur.slot):[];if(items.length)openReport(items,!!account.user);return true;}
 if(L.screen==='caso'){if(a==='hyp')casoHyp(+b.dataset.i);else if(a==='cans')casoAns(+b.dataset.i);else if(a==='clue'){L.clues++;L.fb='';casoScreen(L);}else if(a==='casoend')casoEnd();return true;}
 if(a==='go'){if(L.kind==='esame'){P.examStart(L.pl,L.slots,L.caso);save();}L.screen='q';renderLesson();}
 else if(a==='exrev'){const sat=P.satById(b.dataset.id);if(!sat||!startReview(P.slotsOf(P.satReview(sat)),{sat}))quitLesson();}
 else if(a==='next'){if(L.cur&&L.cur.t==='pres'){L.cur=null;}renderLesson();}
 else if(a==='opt'&&L.cur&&!L.cur.done){const q=L.cur,id=b.dataset.id;q.picked=id;answer(L,q,id===q.right);}
 else if(a==='more'){const add=P.moreDaily();save();if(!startReview(P.slotsOf(add),{daily:true}))quitLesson();}
 else if(a==='again'){const k=b.dataset.k;startLesson(L.sat,L.ps,k,k==='lezione'&&L.next?.pool?L.next.pool:undefined);}
 else if(a==='step'){const ps=P.passi(L.sat).find(p=>p.id===b.dataset.id);app.L=null;onExit(null,{sat:L.sat,ps});}
 return true;
}
/* ---------- fine dell'esame: dopo le 20 domande il caso (se c'è), poi il risultato ---------- */
function examNext(L){
 stopTick();
 if(L.caso&&!L.cdone){
  if(L.screen!=='caso'){L.screen='caso';L.stage='h1';L.clues=0;L.hyp=[];L.cerr=0;L.fb='';L.csat=P.caseSat(L.pl,L.caso);}
  return casoScreen(L);
 }
 const E=P.R().esame,n=L.res.length,ok=L.res.filter(r=>r.ok).length,acc=n?ok/n:0,Rg=P.R();
 L.need=examNeed(n);L.passed=n>0&&ok>=L.need&&(!L.caso||!!L.solved);
 L.stars=L.passed?(acc>=Rg.stelle.tre?3:acc>=Rg.stelle.due?2:1):0;L.msg='';L.next=null;L.weak=null;
 if(L.passed)L.msg=P.examPass(L.pl,L.stars)?`🏅 Ora sei «${P.expertTitle(L.pl)}»! +${E.xp} XP`:`Hai superato di nuovo l'esame: il titolo «${P.expertTitle(L.pl)}» resta tuo.`;
 else L.weak=P.weakSats(L.pl,L.res);
 P.examDone(L.pl,ok);
 L.rewards=P.checkProgress();
 queue.add({module:'percorso',mode:'esame',score:ok+(L.solved?1:0),total:n+(L.caso?1:0),xp:Math.max(0,S.xp-L.xp0)});
 save();head();refreshMastery();
 L.gain=Math.max(0,S.xp-L.xp0);L.screen='end';endScreen(L);
}
function casoItems(L){
 const id='caso.corpo.'+L.caso.id,c=L.caso;
 return [...c.clues.map((x,i)=>({id:id+'.indizio_'+(i+1),label:'Indizio '+(i+1),value:x})),{id:id+'.risposta',label:'Risposta giusta',value:c.a},{id:id+'.spiegazione',label:'Spiegazione',value:c.r}];
}
export function lessonSubmit(e){
 const L=app.L;if(!L||!L.cur||L.cur.t!=='nome'||L.cur.done)return;
 e.preventDefault();const v=$('lin').value;if(!norm(v))return;
 const q=L.cur;q.picked=v.slice(0,80);answer(L,q,accepted(q).includes(norm(v)));
}
