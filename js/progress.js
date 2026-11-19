/* Scheda Profilo: foto, nome, ruolo e presentazione (modificabili), titolo scelto, statistiche, sagoma e radar delle competenze
   (fase 5, js/competenze.js), badge, account, maestria. */
import {$,toast} from './util.js';
import {app,S,level,items} from './state.js';
import {account as A,accountHtml,saveProfile,NAME_RE,NAME_RULE,esc,myData,deleteAccount,CONTATTO,online} from './account.js';
import {BADGES} from './badges.js';
import {fillVersion} from './install.js';
import * as P from './percorso.js';
import {openSat} from './path.js';
import {radar,radarSvg,sagoma,hasSagoma,satList,titoli,titolo,vetrinaMax} from './competenze.js';

let editing=false,draft=null,pmod=null; // pmod: modulo di cui si guarda la maestria (corpo o cervello)
const ROLES=['Studente di fisioterapia','Fisioterapista','Studente di medicina','Medico','Studente di scienze motorie','Chinesiologo','Altro'];
const avatar=(src,name,cls='av')=>src?`<img class="${cls}" src="${esc(src)}" alt="">`:`<div class="${cls}">${esc((name||'?').trim().charAt(0).toUpperCase()||'?')}</div>`;
// copertina del profilo (come la foto di copertina di Facebook): sfondi della galleria, sopra i badge scelti da mostrare.
// Con l'account vanno sul server con il titolo scelto (tabella dextera_profili, fase 5) e li vedono gli amici nella Flotta.
// S.prof.ct = ultima modifica di copertina, vetrina o titolo; S.prof.cu = da inviare.
export const BANNERS=[['notte','Notte stellata'],['aurora','Aurora'],['tramonto','Tramonto'],['oceano','Oceano'],['foresta','Foresta'],['sole','Sole']];
let SHOW_MAX=3;
// scelte della scheda: corso di sagoma e radar, vista del radar (passi o regioni); solo comodità del dispositivo
const PS={c:'',r:'passi'};
try{Object.assign(PS,JSON.parse(localStorage.getItem('dextera-profilo')||'{}'));}catch(e){}
const keepPS=()=>{try{localStorage.setItem('dextera-profilo',JSON.stringify(PS));}catch(e){}};
const banner=(p,got)=>{
 const b=BANNERS.some(x=>x[0]===p.banner)?p.banner:'notte',show=(p.show||[]).map(id=>got.find(x=>x.id===id)).filter(Boolean);
 return `<div class="pfban ban-${b}">`+(show.length?`<ul class="vetrina" aria-label="Badge in vetrina">${show.map(x=>`<li title="${esc(x.name)}"><span aria-hidden="true">${x.icon}</span><span class="sr">${esc(x.name)}</span></li>`).join('')}</ul>`
  :got.length&&!editing?'<button class="banhint" data-pf="edit">🏅 Scegli i badge da mostrare</button>':'')+'</div>';
};
const day=iso=>new Date(iso).toLocaleDateString('it',{day:'numeric',month:'short',year:'numeric'});

export function renderProg(){
 SHOW_MAX=vetrinaMax();
 const p=S.prof,{L,title}=level(),tot=S.ok+S.ko,st=S.stats||{};
 const name=p.name||(A.user?'':'Ospite'),got=BADGES.filter(b=>S.badges[b.id]);
 const lo=30*(L-1)**2,hi=30*L**2,pct=Math.round((S.xp-lo)/(hi-lo)*100);
 const hero=editing?`<div class="card pfhero edit">${banner({...p,banner:draft.banner,show:draft.show},got)}<div class="kick">Modifica profilo</div>${editHtml(got)}</div>`:
  `<div class="card pfhero">${banner(p,got)}<div class="pf">${avatar(p.avatar,name)}<div class="pfi"><div class="kick">Profilo</div><h2>${esc(name)||'<span class="mut">Senza nome</span>'}</h2>
   <div class="ptit"><span aria-hidden="true">🎖️</span> ${esc(titolo())}</div><div class="mut">${p.role?esc(p.role):A.user?'':'Senza account: i progressi restano su questo dispositivo'}</div></div></div>${p.bio?`<p class="bio">${esc(p.bio)}</p>`:''}
   <div class="pflv"><b>Liv. ${L} · ${title}</b><span>${S.xp-lo}/${hi-lo} XP al livello ${L+1}</span></div>
   <div class="pbar" role="progressbar" aria-label="Avanzamento del livello" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
   <button class="btn alt wide" data-pf="edit">✏️ Modifica profilo</button></div>`;
 const stat=(i,v,l)=>`<div class="card"><i aria-hidden="true">${i}</i><b>${v}</b><span>${l}</span></div>`;
 const stats=`<div class="stats">${stat('⚡',S.xp,'XP')}${stat('🔥',S.streak,'giorni di fila')}${stat('🎯',tot?Math.round(S.ok/tot*100)+'%':'–','precisione')}${stat('🎮',st.games||0,'partite')}</div>`;
 const badges=`<div class="card pfb"><div class="kick">Badge e traguardi</div><h2>${got.length} su ${BADGES.length}</h2>${A.badgeMissing?`<p class="note">⚠️ ${esc(A.badgeMissing)}</p>`:''}
  <div class="pbar" aria-hidden="true"><i style="width:${Math.round(got.length/BADGES.length*100)}%"></i></div><div class="bdg">`+
  BADGES.map(b=>{const d=S.badges[b.id];return `<div class="b${d?'':' lock'}" title="${esc(b.desc)}"><i>${b.icon}</i><b>${esc(b.name)}</b><small>${d?day(d):esc(b.desc)}</small></div>`;}).join('')+'</div></div>';
 // maestria del modulo scelto qui (all'inizio quello aperto), singole o gruppi come nella figura
 const M=app.MODS[pmod]||app.MOD;pmod=M.id;
 const IL=(app.grp?M.GR:M.B).filter(b=>!b.area),mastered=IL.filter(b=>(S.mastery[b.id]||0)>=3).length;
 // in ordine di gruppo (dalla testa ai piedi per le ossa, per lobo nel cervello)
 const ord=Object.fromEntries(M.GR.map((g,i)=>[g.id,i]));
 const rows=IL.slice().sort((a,b)=>(ord[a.group?a.id:a.g]??99)-(ord[b.group?b.id:b.g]??99)).map(b=>{const m=S.mastery[b.id]||0;return `<div class="row" data-id="${b.id}" data-mod="${M.id}"><span>${b.n}</span><span class="dots" aria-label="maestria ${m} su 3">${'●'.repeat(m)}<span class="off">${'●'.repeat(3-m)}</span></span></div>`;}).join('');
 const seg=`<div class="chips pmods" role="group" aria-label="Modulo">`+Object.values(app.MODS).map(x=>`<button class="chip${x.id===M.id?' on':''}" aria-pressed="${x.id===M.id}" data-pf="mod" data-v="${x.id}">${esc(x.label)}</button>`).join('')+'</div>';
 const mast=`<div class="card pfm"><div class="kick">Maestria</div><h2>${mastered} su ${IL.length} ${app.grp?'gruppi':'strutture'}</h2><p class="mut">${app.grp?'Gruppi padroneggiati':'Strutture padroneggiate'}. ${tot?'Tocca una voce per aprirla nell\'Atlante.':'Gioca un round per iniziare a riempire i progressi.'}</p>
  <div class="pbar" aria-hidden="true"><i style="width:${IL.length?Math.round(mastered/IL.length*100):0}%"></i></div>${seg}<div class="mrows">${rows}</div></div>`;
 // due colonne sul computer; sul telefono una sola nell'ordine profilo, numeri, badge, account e privacy, maestria (order in style.css)
 const [sag,comp]=compHtml();
 $('panel').innerHTML=`<div class="prof"><div class="pcol">${hero}${sag}${badges}</div><div class="pcol">${stats}${comp}<div class="pfside">${accountHtml()}${privacyHtml()}</div>${mast}</div></div>`;
 fillVersion($('panel'));
}

// Sagoma e radar delle competenze (fase 5): corso scelto qui (all'inizio quello del percorso), radar per passo o per regione
function compHtml(){
 if(!P.ready())return ['',''];
 const cs=P.corsi(),c=cs.find(x=>x.id===PS.c)||P.corso();PS.c=c.id;
 const chips=cs.length>1?`<div class="chips pmods" role="group" aria-label="Corso">${cs.map(x=>`<button class="chip${x===c?' on':''}" aria-pressed="${x===c}" data-pf="pc" data-v="${esc(x.id)}">${esc(x.nome)}</button>`).join('')}</div>`:'';
 const ax=radar(c,PS.r),seg=`<div class="seg3" role="group" aria-label="Vista del radar">${[['passi','Per passo'],['regioni','Per regione']].map(([v,t])=>`<button data-pf="rm" data-v="${v}" aria-pressed="${PS.r===v}">${t}</button>`).join('')}</div>`;
 const tot=ax.length?Math.round(ax.reduce((a,x)=>a+x.v,0)/ax.length*100):0;
 const comp=`<div class="card pfc"><div class="kick">Competenze</div><h2>${esc(c.nome)} · ${tot}%</h2>${chips}${seg}${radarSvg(ax,'Radar delle competenze, '+(PS.r==='passi'?'per passo':'per regione'))}
  <p class="mut">Ogni asse è la maestria media di tutte le strutture del corso ${PS.r==='passi'?'per quel tipo di passo (i casi clinici: satelliti con il caso risolto)':'di quella regione'}, anche quelle non ancora iniziate.</p></div>`;
 if(!hasSagoma(c))return ['',comp];
 const L=satList(c),lit=L.filter(x=>x.st==='acceso'||x.st==='brillante'||x.st==='ripassare').length;
 const sag=`<div class="card pfs"><div class="kick">Sagoma</div><h2>${lit} su ${L.length} satelliti accesi</h2>${chips}<div class="sagw">${sagoma(c)}</div>
  <ul class="legend aleg" aria-label="Colori della maestria">${['da studiare','iniziato','in corso','padroneggiato'].map((t,i)=>`<li><span class="mdot m${i}" aria-hidden="true">${i}</span>${t}</li>`).join('')}</ul>
  <p class="mut">Tocca una zona o un simbolo per aprire il suo satellite nel Percorso.</p>
  <details class="sats"><summary>Stato dei satelliti</summary><ul>${L.map(({s,st})=>`<li><button class="srow" data-pf="sat" data-id="${esc(s.id)}"><span class="sn">${esc(s.nome)}</span><small>${P.STATI[st]}</small></button></li>`).join('')}</ul></details></div>`;
 return [sag,comp];
}

// Privacy e dati: informativa, copia dei propri dati, cancellazione dal dispositivo e dell'account
function privacyHtml(){
 return `<div class="acc"><div class="sub">Privacy e dati</div><p class="mut">Cosa raccogliamo, perché e i tuoi diritti: <a href="privacy.html" target="_blank" rel="noopener">informativa sulla privacy</a>. Regole d'uso: <a href="termini.html" target="_blank" rel="noopener">termini di servizio</a>.
  Gli altri iscritti vedono solo nome utente, foto, XP e serie; gli amici anche copertina, badge in vetrina e titolo; email, presentazione e ruolo restano privati.</p>
  <div class="chips"><button class="chip" data-pf="export">⬇️ Scarica i miei dati</button><button class="chip" data-pf="wipe">🧹 Cancella i dati da questo dispositivo</button>`+
  (A.user?`<button class="chip bad" data-pf="delacc"${online()?'':' disabled'}>🗑️ Elimina l'account</button>`:'')+`</div><p class="note" data-appv>Dextera alpha</p></div>`;
}
// toglie dal dispositivo tutto ciò che l'app ha salvato (progressi, profilo, sessione, coda, scelte) e riparte
function wipeDevice(){
 // solo le chiavi dextera- (sessione compresa, in dextera-auth): BodyMania sta sulla stessa origine e i suoi dati non si toccano
 try{for(const s of [localStorage,sessionStorage])for(const k of Object.keys(s))if(k.startsWith('dextera-'))s.removeItem(k);}catch(e){}
 location.reload();
}
async function exportData(){
 try{
  const data=await myData(),blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dextera-i-miei-dati.json';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);toast('File dei tuoi dati pronto.');
 }catch(e){toast('Non riuscito: riprova tra poco.');}
}

function editHtml(got){
 const d=draft,login=!!A.user;
 return `<form class="pfe" data-pf="save"><div class="pf">${avatar(d.avatar,d.name)}<div class="pfi">
   <label class="chip">📷 ${d.avatar?'Cambia foto':'Aggiungi foto'}<input type="file" accept="image/*" data-pf="photo" hidden></label>
   ${d.avatar?'<button type="button" class="chip" data-pf="nophoto">Togli foto</button>':''}</div></div>
  <label>Nome${login?' utente':''}<input name="name" value="${esc(d.name)}" maxlength="20" ${login?'pattern="[A-Za-z0-9_.]{3,20}" required':''} autocomplete="nickname"></label>
  ${login?`<p class="note">${NAME_RULE} Deve essere libero: è quello che vedono gli amici.</p>`:''}
  <label>Ruolo<input name="role" value="${esc(d.role)}" maxlength="40" list="roles" placeholder="Es. Studente di fisioterapia"></label>
  <datalist id="roles">${ROLES.map(r=>`<option value="${r}">`).join('')}</datalist>
  <label>Presentazione<textarea name="bio" maxlength="160" rows="2" placeholder="Due righe su di te (facoltativo)">${esc(d.bio)}</textarea></label>
  <label>Titolo<select name="titolo">${tsel(d.titolo)}</select></label>
  <p class="note">Compare sotto il tuo nome e nell'intestazione. Altri titoli arrivano con i livelli, gli esami dei pianeti e alcuni badge.</p>
  <fieldset class="bansel"><legend>Copertina</legend><div class="banopts">${BANNERS.map(([id,n])=>`<label class="ban-${id}"><input type="radio" name="ban" value="${id}"${d.banner===id?' checked':''}><span class="sr">${n}</span></label>`).join('')}</div></fieldset>
  <fieldset class="showsel"><legend>Badge in vetrina (fino a ${SHOW_MAX})</legend>${got.length?`<div class="chips">${got.map(b=>`<label class="chip"><input type="checkbox" name="show" value="${b.id}"${d.show.includes(b.id)?' checked':''}> ${b.icon} ${esc(b.name)}</label>`).join('')}</div>`:'<p class="note">Quando guadagni un badge puoi metterlo qui, sulla copertina.</p>'}</fieldset>
  ${A.err?`<p class="err">${esc(A.err)}</p>`:''}
  <div class="pfbtn"><button class="btn"${A.busy?' disabled':''}>${A.busy?'Salvo…':'Salva'}</button><button type="button" class="btn alt" data-pf="cancel">Annulla</button></div>
  ${login?'':'<p class="note">Senza account il profilo resta su questo dispositivo.</p>'}</form>`;
}

// titoli da scegliere, divisi per provenienza; vuoto = il titolo del livello
function tsel(cur){
 const T=titoli(),g=[['liv:','Livelli'],['esp:','Esami dei pianeti'],['badge:','Badge']],id=cur&&cur.id||'';
 return `<option value=""${id?'':' selected'}>Quello del livello (${esc(level().title)})</option>`+g.map(([p,n])=>{const L=T.filter(t=>t.id.startsWith(p));return L.length?`<optgroup label="${n}">${L.map(t=>`<option value="${esc(t.id)}"${t.id===id?' selected':''}>${esc(t.t)}</option>`).join('')}</optgroup>`:'';}).join('');
}
// foto: ritaglio quadrato al centro, 128×128 JPEG (circa 5–10 KB), così sta nel profilo e si vede anche offline
function shrink(file){
 return new Promise((ok,ko)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{const s=Math.min(img.width,img.height),c=document.createElement('canvas');c.width=c.height=128;
   c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,128,128);URL.revokeObjectURL(url);ok(c.toDataURL('image/jpeg',.82));};
  img.onerror=()=>{URL.revokeObjectURL(url);ko(new Error('Immagine non leggibile.'));};img.src=url;
 });
}
const formVals=()=>{const f=$('panel').querySelector('form.pfe');if(f){draft.name=f.elements.name.value.trim();draft.role=f.elements.role.value.trim();draft.bio=f.elements.bio.value.trim();draft.banner=(f.querySelector('input[name=ban]:checked')||{}).value||draft.banner;draft.show=[...f.querySelectorAll('input[name=show]:checked')].map(i=>i.value).slice(0,SHOW_MAX);
 const tv=f.elements.titolo?.value||'',t=titoli().find(x=>x.id===tv);draft.titolo=t?{id:t.id,t:t.t}:null;}};

export function wireProfile(panel){
 panel.addEventListener('click',e=>{
  const b=e.target.closest('[data-pf]');if(!b||b.tagName==='FORM'||b.tagName==='INPUT')return;const k=b.dataset.pf;
  if(k==='edit'){editing=true;A.err='';A.msg='';draft={name:S.prof.name||'',role:S.prof.role||'',bio:S.prof.bio||'',avatar:S.prof.avatar||'',banner:S.prof.banner||'notte',show:(S.prof.show||[]).slice(),titolo:S.prof.titolo||null};renderProg();}
  else if(k==='cancel'){editing=false;A.err='';renderProg();}
  else if(k==='nophoto'){formVals();draft.avatar='';renderProg();}
  else if(k==='mod'){pmod=b.dataset.v;renderProg();}
  else if(k==='pc'){PS.c=b.dataset.v;keepPS();renderProg();}
  else if(k==='rm'){PS.r=b.dataset.v==='regioni'?'regioni':'passi';keepPS();renderProg();panel.querySelector(`[data-pf=rm][data-v=${PS.r}]`)?.focus();}
  else if(k==='sat'){if(P.satById(b.dataset.id))openSat(b.dataset.id);}
  else if(k==='bone'){const c=P.corsi().find(x=>x.id===PS.c)||P.corso(),s=P.satsOf(b.dataset.id,c)[0];if(s)openSat(s.id);}
  else if(k==='export')exportData();
  else if(k==='wipe'){if(confirm(A.user?'Cancellare da questo dispositivo progressi, profilo e accesso? Il tuo account e i dati sul server restano: li ritrovi accedendo di nuovo.':'Cancellare da questo dispositivo tutti i progressi e il profilo? Senza account non si possono recuperare.'))wipeDevice();}
  else if(k==='delacc'){
   if(prompt('Eliminare l\'account? Viene bloccato subito, sparisce da classifiche e amicizie e dopo 30 giorni è cancellato per sempre con profilo, progressi e badge. Entro i 30 giorni puoi chiederne il ripristino scrivendo a '+CONTATTO+'.\nScrivi ELIMINA per confermare.')!=='ELIMINA')return;
   deleteAccount().then(()=>{if(A.deleted){alert('Account eliminato: sarà cancellato per sempre tra 30 giorni. Ora tolgo anche i dati da questo dispositivo.');wipeDevice();}else renderProg();});
  }
 });
 // simboli della sagoma: si aprono anche con Invio e Spazio
 panel.addEventListener('keydown',e=>{if(app.tab!=='prog'||(e.key!=='Enter'&&e.key!==' '))return;const g=e.target.closest('[data-pf][role=button]');if(g&&g===e.target){e.preventDefault();g.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 panel.addEventListener('change',async e=>{
  // copertina e vetrina: anteprima subito; al massimo SHOW_MAX badge
  if(e.target.name==='ban'||e.target.name==='show'){
   const f=e.target.form,on=[...f.querySelectorAll('input[name=show]:checked')];
   if(on.length>SHOW_MAX){e.target.checked=false;toast('Al massimo '+SHOW_MAX+' badge in vetrina.');return;}
   const id=e.target.name+':'+e.target.value;formVals();renderProg();$('panel').querySelector(`input[name=${id.split(':')[0]}][value="${id.split(':')[1]}"]`)?.focus();return;
  }
  const i=e.target.closest('input[data-pf="photo"]');if(!i||!i.files[0])return;
  formVals();try{draft.avatar=await shrink(i.files[0]);}catch(x){toast(x.message);}renderProg();
 });
 panel.addEventListener('submit',async e=>{
  const f=e.target.closest('form[data-pf="save"]');if(!f)return;e.preventDefault();formVals();
  // copertina, vetrina o titolo cambiati: da inviare a dextera_profili (li vedono gli amici)
  const card=x=>JSON.stringify([x.banner||'notte',x.show||[],(x.titolo&&x.titolo.id)||'']);
  if(card(draft)!==card(S.prof)){draft.ct=Date.now();draft.cu=1;}
  if(A.user&&!NAME_RE.test(draft.name)){A.err=NAME_RULE;renderProg();return;}
  await saveProfile({...draft});
  if(!A.err){editing=false;toast('Profilo salvato.');}
  renderProg();
 });
}
// il profilo si ridisegna quando cambia l'account: durante la modifica si tengono i campi già scritti
export function refreshProg(){if(app.tab!=='prog')return;if(editing)formVals();renderProg();}
