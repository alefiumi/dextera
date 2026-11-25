/* Gestionale di Dextera (fase 3, rilascio 1): utenti e segnalazioni, solo per gli amministratori.
   Pagina a sé come revisione/, non è nella copia offline. Usa la stessa sessione dell'app (dextera-auth, stessa origine).
   La protezione vera è sul server: ogni funzione dextera_admin_* controlla private.e_admin() e un utente normale riceve
   un errore e nessun dato (file supabase/migrations/20261130090000_dextera_gestionale.sql). */
import {SUPABASE_URL,SUPABASE_KEY} from '../js/config.js';

const SQL='supabase/migrations/20261130090000_dextera_gestionale.sql';
const $=id=>document.getElementById(id);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=s=>{if(!s)return '—';const d=new Date(s);return isNaN(d)?esc(s):d.toLocaleString('it',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const day=s=>{if(!s)return '—';const d=new Date(s.length===10?s+'T12:00:00':s);return isNaN(d)?esc(s):d.toLocaleDateString('it',{day:'numeric',month:'short',year:'numeric'});};
const N=n=>Number(n||0).toLocaleString('it');

// scelte comode di chi usa la pagina (scheda e filtro): solo in questo browser
const PK='dextera-admin';
const pref=(()=>{try{return JSON.parse(localStorage.getItem(PK)||'{}');}catch(e){return {};}})();
const savePref=()=>{try{localStorage.setItem(PK,JSON.stringify({tab:V.tab,filt:V.filt}));}catch(e){}};

const V={sb:null,user:null,tab:pref.tab==='segn'?'segn':'utenti',filt:['aperta','risolta','scartata','tutte'].includes(pref.filt)?pref.filt:'aperta',
 q:'',res:null,sel:null,det:null,seg:null,conta:null,percorsi:{},busy:false};
const STATI={aperta:'Aperta',risolta:'Risolta',scartata:'Scartata'};
const FILT={aperta:'Aperte',risolta:'Risolte',scartata:'Scartate',tutte:'Tutte'};
const TIPI_G={annuncio:'Annuncio',banner:'Banner',copertina:'Copertina del profilo'};

const HINT={dextera_admin:'Solo gli amministratori possono farlo.',dextera_ricerca:'Scrivi almeno 2 caratteri (al massimo 100).',
 dextera_conferma:'Per confermare scrivi AZZERA.',dextera_ambito:'Scegli che cosa azzerare.',dextera_utente:'Questo utente non esiste più.',
 dextera_stato:'Stato non valido.',dextera_deciso:'Questa segnalazione è già stata decisa: la decisione non si cambia.',
 dextera_segnalazione:'Questa segnalazione non esiste più.',dextera_tipo:'Tipo di segnalazione non valido.'};
const ERRA={'Invalid login credentials':'Email o password sbagliate.','Email not confirmed':'Conferma prima l\'email: ti abbiamo mandato un link.'};
function errText(e){
 const m=(e&&e.message)||String(e||'');
 if(e&&HINT[e.hint])return HINT[e.hint];
 if(ERRA[m])return ERRA[m];
 if(/PGRST202|Could not find the function|schema cache/i.test(m+' '+(e&&e.code||'')))return 'Sul server manca il file '+SQL+': l\'autore deve applicarlo dallo SQL Editor di Supabase.';
 if(/fetch|network|load failed/i.test(m))return 'Server non raggiungibile: controlla la connessione e riprova.';
 return m||'Errore';
}
const status=(t,err)=>{const s=$('stato');s.textContent=t||'';s.className=err?'msg err':t?'mut':'mut';};
const say=t=>status(t,false); // annuncio per chi usa il lettore di schermo (role=status)

/* ---------- avvio e accesso ---------- */
async function start(){
 if(!SUPABASE_URL||!SUPABASE_KEY){status('Il progetto Supabase non è configurato (js/config.js).',true);return;}
 if(!window.supabase){status('Libreria di Supabase non caricata: ricarica la pagina.',true);return;}
 V.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:'dextera-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
 let session=null;
 try{session=(await V.sb.auth.getSession()).data.session;}catch(e){}
 if(!session){showLogin();return;}
 V.user=session.user;
 await checkStaff();
}
function showLogin(err){
 say('');
 $('vista').innerHTML=`<form class="box" id="login" aria-labelledby="login-t">
  <h2 id="login-t">Accedi</h2>
  <p>Questa pagina è solo per gli amministratori di Dextera. Usa lo stesso account dell'app.</p>
  ${err?`<p class="msg err" role="alert">${esc(err)}</p>`:''}
  <label class="f">Email<input type="email" name="email" autocomplete="username" required></label>
  <label class="f">Password<input type="password" name="pw" autocomplete="current-password" required></label>
  <div class="row"><button class="btn acc">Accedi</button></div>
  <p class="small mut">Entri con Google? Accedi dall'app in questo browser (<a href="../">apri l'app</a>) e poi torna qui.</p></form>`;
}
async function checkStaff(){
 say('Controllo il ruolo…');
 const {data,error}=await V.sb.rpc('dextera_staff');
 if(error){showNo(errText(error));return;}
 if(!data||data.ruolo!=='admin'){
  showNo(data&&data.ruolo==='revisore'?'Sei revisore: la tua area nel gestionale arriva con il prossimo rilascio. Intanto puoi usare la pagina di revisione.'
   :'Questa pagina è solo per gli amministratori di Dextera. Con il tuo account non puoi vedere nulla qui.');return;}
 say('');
 fetch('../content/index.json').then(r=>r.json()).then(d=>{for(const p of d.percorsi||[])V.percorsi[p.id]=p.nome;render();}).catch(()=>{});
 render();
 if(V.tab==='segn')loadSeg();else loadConta();
}
function showNo(t){
 say('');
 $('vista').innerHTML=`<div class="box"><h2>Accesso non consentito</h2><p>${esc(t)}</p>
  <p class="small mut">Account: ${esc(V.user&&V.user.email||'')}</p>
  <div class="row"><a class="btn" href="../revisione/">Pagina di revisione</a><button class="btn" data-a="out">Esci da questo account (anche dall'app in questo browser)</button></div></div>`;
}

/* ---------- disegno ---------- */
const pName=id=>id==='tutto'?'Tutto':V.percorsi[id]||id;
function render(){
 const c=V.conta||{},n=(c.errori||0)+(c.gruppi||0);
 $('vista').innerHTML=`<div class="seg" role="group" aria-label="Sezione">
   <button data-a="tab" data-v="utenti" aria-pressed="${V.tab==='utenti'}">Utenti</button>
   <button data-a="tab" data-v="segn" aria-pressed="${V.tab==='segn'}">Segnalazioni ${V.conta?`<span class="pill" aria-label="${n} aperte">${n}</span>`:''}</button></div>
  <div id="pan">${V.tab==='utenti'?usersHtml():segHtml()}</div>
  <p class="small mut">Account: ${esc(V.user&&V.user.email||'')} · <button class="btn" data-a="out" style="min-height:36px;padding:4px 10px">Esci (anche dall'app in questo browser)</button></p>`;
}

/* Utenti */
function usersHtml(){
 const res=V.res;
 return `<div class="cols"><div class="box">
   <h2>Utenti</h2>
   <form id="cerca" class="row" role="search">
    <label class="f">Cerca per nome utente o email<input type="search" name="q" value="${esc(V.q)}" minlength="2" maxlength="100" required autocomplete="off"></label>
    <button class="btn acc">Cerca</button></form>
   ${res==null?'<p class="mut small">Scrivi almeno 2 caratteri.</p>':!res.length?'<p class="mut">Nessun utente trovato.</p>':
    `<p class="small mut">${res.length===30?'Primi 30 risultati: scrivi di più per restringere.':res.length+(res.length===1?' utente':' utenti')}</p>
    <ul class="list">${res.map(u=>`<li><button data-a="user" data-id="${esc(u.id)}" aria-current="${V.sel===u.id}">
     <span><b>${esc(u.nome||'(senza nome)')}</b>${u.admin?' · admin':''}${u.cancellato_il?' · in cancellazione':''}<br><span class="small mut">${esc(u.email||'')}</span></span>
     <span class="small mut num">${N(u.xp)} XP</span></button></li>`).join('')}</ul>`}
  </div>
  <div id="det" tabindex="-1">${V.det?detHtml(V.det):V.sel?'<div class="box"><p class="mut">Carico…</p></div>':''}</div></div>`;
}
function detHtml(d){
 const p=d.profilo||{},c=d.comuni||{},pc=d.percorsi||[];
 const opts=[...new Set([...Object.keys(V.percorsi).filter(id=>!['fisioterapia','medicina'].includes(id)||pc.some(x=>x.percorso===id)),...pc.map(x=>x.percorso)])];
 return `<div class="box">
  <h2 id="det-t">${esc(p.nome||p.email||'Utente')}</h2>
  <dl class="kv"><dt>Email</dt><dd>${esc(p.email||'—')}</dd><dt>XP totali</dt><dd class="num">${N(p.xp)}</dd>
   <dt>Risposte</dt><dd class="num">${N(p.giuste)} giuste, ${N(p.sbagliate)} sbagliate</dd><dt>Serie</dt><dd class="num">${N(p.serie)} giorni (ultimo: ${day(p.ultimo_giorno)})</dd>
   <dt>Iscritto il</dt><dd>${day(p.iscritto_il)}</dd>${p.cancellato_il?`<dt>Account</dt><dd>In cancellazione dal ${day(p.cancellato_il)}</dd>`:''}${p.admin?'<dt>Ruolo</dt><dd>Amministratore</dd>':''}</dl>
  <h3>Progressi per percorso</h3>
  ${pc.length?`<div class="tw"><table><thead><tr><th scope="col">Percorso</th><th scope="col" class="n">XP</th><th scope="col" class="n">Passi fatti</th><th scope="col" class="n">Satelliti accesi ed esami</th><th scope="col">Ultimo progresso</th></tr></thead>
   <tbody>${pc.map(x=>`<tr><th scope="row">${esc(pName(x.percorso))}</th><td class="n">${x.xp==null?'—':N(x.xp)}</td><td class="n">${N(x.passi_fatti)}</td><td class="n">${N(x.nodi_accesi)}</td><td>${day(x.ultimo)}</td></tr>`).join('')}</tbody></table></div>`
   :'<p class="mut">Nessun progresso del percorso salvato online.</p>'}
  <h3>In comune tra i percorsi</h3>
  <dl class="kv"><dt>Maestria</dt><dd class="num">${N(c.maestria)} strutture (${N(c.maestria_piena)} al massimo)</dd><dt>Ripasso</dt><dd class="num">${N(c.ripasso)} nel calendario</dd>
   <dt>Partite</dt><dd class="num">${N(c.partite)} (ultima: ${day(c.ultima_partita)})</dd><dt>Badge</dt><dd class="num">${N(c.badge)}</dd>
   <dt>Punti Flotta</dt><dd class="num">${N(c.punti_flotta)}</dd><dt>Segnalazioni inviate</dt><dd class="num">${N(c.segnalazioni)}</dd></dl>
  ${(d.azzeramenti||[]).length?`<h3>Azzeramenti fatti</h3><ul>${d.azzeramenti.map(z=>`<li>${esc(pName(z.ambito))} · ${dt(z.il)}${z.da?' · da '+esc(z.da):''}</li>`).join('')}</ul>`:''}
  <div class="warnbox"><h3>Azzera i progressi</h3>
   <p class="small">Solo su richiesta della persona. Vale anche sui suoi telefoni: alla prossima sincronizzazione l'app cancella la stessa parte.</p>
   <div class="row"><label class="f">Che cosa azzerare<select id="amb">${opts.map(id=>`<option value="${esc(id)}">${esc(pName(id))}</option>`).join('')}<option value="tutto">Tutto (tutti i percorsi e i dati in comune)</option></select></label>
   <button class="btn bad" data-a="reset">Azzera…</button></div></div>
 </div>`;
}
function resetDialog(amb){
 const p=V.det.profilo||{},who=p.nome||p.email||'questo utente',tutto=amb==='tutto';
 const dlg=$('conferma');
 dlg.innerHTML=`<form method="dialog" id="conf-f">
  <h2 id="conf-t">Azzerare ${tutto?'tutti i progressi':'il percorso «'+esc(pName(amb))+'»'} di ${esc(who)}?</h2>
  <p>Si cancellano:</p>
  <ul>${tutto?'<li>XP, risposte giuste e sbagliate, serie di giorni</li><li>maestria e calendario del ripasso</li><li>passi, satelliti ed esami di tutti i percorsi</li><li>punti della Flotta, partite giocate e badge</li>'
   :`<li>satelliti accesi ed esami del percorso${amb==='base'?' e i passi fatti':''}</li><li>gli XP del percorso (tolti anche dal totale)</li>`}</ul>
  ${tutto?'':'<p class="small mut">Maestria e ripasso sono in comune tra i percorsi e restano: i passi già completati possono tornare fatti da soli.</p>'}
  <p>Restano account, nome, foto, amici, casate, equipaggi e impostazioni.${tutto?' Attenzione: XP, maestria, partite e badge sono in comune con BodyMania (stesso account) e si azzerano anche lì.':''}</p>
  <p><b>Non si può annullare.</b></p>
  <label class="f">Per confermare scrivi AZZERA<input type="text" id="conf-in" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
  <div class="row"><button class="btn" value="no" formnovalidate>Annulla</button><button class="btn bad" id="conf-ok" value="si" disabled>Azzera</button></div></form>`;
 const inp=$('conf-in'),okb=$('conf-ok');
 inp.addEventListener('input',()=>{okb.disabled=inp.value.trim()!=='AZZERA';});
 dlg.onclose=async()=>{if(dlg.returnValue!=='si'||inp.value.trim()!=='AZZERA'){$('det')?.querySelector('[data-a=reset]')?.focus();return;}
  say('Azzero…');
  const {data,error}=await V.sb.rpc('dextera_admin_azzera',{p_id:p.id,p_ambito:amb,p_conferma:'AZZERA'});
  if(error){status(errText(error),true);return;}
  await loadUser(p.id,true);
  say('Fatto: '+(tutto?'tutti i progressi':'il percorso «'+pName(amb)+'»')+' di '+who+' azzerati'+(data&&data.xp?' ('+N(data.xp)+' XP tolti)':'')+'.');
 };
 dlg.returnValue='';dlg.showModal();inp.focus();
}

/* Segnalazioni */
function segHtml(){
 const s=V.seg;
 return `<div class="box"><h2>Segnalazioni</h2>
  <div class="seg" role="group" aria-label="Filtra per stato">${Object.entries(FILT).map(([k,t])=>`<button data-a="filt" data-v="${k}" aria-pressed="${V.filt===k}">${t}</button>`).join('')}</div></div>
  ${s==null?'<p class="mut">Carico…</p>':`
  <section class="box" aria-labelledby="se-t"><h2 id="se-t">Errori nei contenuti <span class="pill">${s.errori.length}</span></h2>
   <p class="small mut">«Segnala un errore» nelle lezioni. Un dato segnalato da 2 persone esce dalle lezioni finché le segnalazioni restano aperte.</p>
   ${s.errori.length?s.errori.map(errHtml).join(''):'<p class="mut">Nessuna.</p>'}</section>
  <section class="box" aria-labelledby="sg-t"><h2 id="sg-t">Gruppi: annunci, banner e copertine <span class="pill">${s.gruppi.length}</span></h2>
   <p class="small mut">Con 2 segnalazioni il contenuto si nasconde. Risolta = rimosso per sempre; scartata = approvato, torna visibile e non si può più nascondere con le segnalazioni.</p>
   ${s.gruppi.length?s.gruppi.map(grHtml).join(''):'<p class="mut">Nessuna.</p>'}</section>`}`;
}
const noteHtml=x=>`<label class="f">Nota (la vedono solo gli amministratori)<textarea name="nota" maxlength="1000">${esc(x.nota_admin||'')}</textarea></label>
 ${x.nota_admin?`<p class="small mut">Nota di ${esc(x.nota_da||'?')} · ${dt(x.nota_il)}</p>`:''}`;
function errHtml(e){
 return `<form class="item" data-f="errore" data-id="${esc(e.id)}" aria-labelledby="e-${esc(e.id)}">
  <header><code id="e-${esc(e.id)}">${esc(e.dato)}</code><span class="tag ${esc(e.stato)}">${esc(STATI[e.stato]||e.stato)}</span></header>
  <p class="small mut">Da ${esc(e.autore||'utente senza nome')} · ${dt(e.creato_il)}${e.persone>1?` · ${N(e.persone)} persone segnalano questo dato`:''}</p>
  ${e.nota?`<p class="quote">${esc(e.nota)}</p>`:'<p class="small mut">Senza commento.</p>'}
  ${e.valore?`<details><summary class="small">Testo mostrato allo studente</summary><p class="quote">${esc(e.valore)}</p></details>`:''}
  <label class="f">Stato<select name="stato">${Object.entries(STATI).map(([k,t])=>`<option value="${k}"${k===e.stato?' selected':''}>${t}</option>`).join('')}</select></label>
  ${e.aperte_stesso_dato>0?`<label class="ck"><input type="checkbox" name="tutte" checked> Cambia anche ${e.aperte_stesso_dato==1?'l\'altra segnalazione aperta':'le altre '+N(e.aperte_stesso_dato)+' segnalazioni aperte'} su questo dato</label>`:''}
  ${noteHtml(e)}
  <div class="row"><button class="btn acc">Salva</button></div></form>`;
}
const isImg=s=>/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(s||'');
function grHtml(g){
 const open=g.stato==='aperta',mot=(g.motivi||[]).filter(Boolean);
 return `<form class="item" data-f="gruppi" data-id="${esc(g.id)}" aria-labelledby="g-${esc(g.id)}">
  <header><h3 id="g-${esc(g.id)}">${esc(TIPI_G[g.tipo]||g.tipo)} · ${esc(g.gruppo||'')}</h3><span class="tag ${esc(g.stato)}">${esc(STATI[g.stato]||g.stato)}</span></header>
  <p class="small mut">Messo da ${esc(g.autore||'?')} · segnalato il ${dt(g.creato_il)}${g.deciso_il?' · deciso il '+dt(g.deciso_il):''}${open?` · ${N(g.segnalazioni)} ${g.segnalazioni==1?'segnalazione':'segnalazioni'}`:''}${g.nascosto?' · <b>nascosto</b> finché non decidi':''}</p>
  ${mot.length?`<p class="small">Motivi: ${mot.map(esc).join(' · ')}</p>`:''}
  ${g.contenuto?(isImg(g.contenuto)?`<div class="quote"><img src="${g.contenuto}" alt="Immagine segnalata (${esc(TIPI_G[g.tipo]||g.tipo)})"></div>`:`<p class="quote">${esc(g.contenuto)}</p>`)
   :open?'<p class="small mut">Il contenuto non c\'è più (è stato cambiato o tolto).</p>':''}
  ${open?`<div class="row"><button class="btn bad" type="button" data-a="dec" data-v="risolta">Risolta: rimuovi per sempre</button>
   <button class="btn" type="button" data-a="dec" data-v="scartata">Scartata: approva e rimetti</button></div>`:''}
  ${noteHtml(g)}
  <div class="row"><button class="btn acc">Salva la nota</button></div></form>`;
}

/* ---------- dati ---------- */
async function search(q){
 V.q=q;V.busy=true;say('Cerco…');
 const {data,error}=await V.sb.rpc('dextera_admin_cerca',{p_q:q});
 V.busy=false;
 if(error){status(errText(error),true);return;}
 V.res=data||[];render();say(V.res.length?V.res.length+(V.res.length===1?' utente trovato.':' utenti trovati.'):'Nessun utente trovato.');
 document.querySelector('#cerca input')?.focus();
}
async function loadUser(id,keep){
 V.sel=id;if(!keep)V.det=null;render();
 const {data,error}=await V.sb.rpc('dextera_admin_utente',{p_id:id});
 if(error){status(errText(error),true);return;}
 V.det=data;render();
 if(!keep){const t=$('det-t');if(t){t.tabIndex=-1;t.focus();t.scrollIntoView({block:'start'});}}
}
async function loadConta(){
 const {data,error}=await V.sb.rpc('dextera_admin_segnalazioni',{p_stato:'aperta'});
 if(!error&&data){V.conta=data.conta;render();}
}
async function loadSeg(){
 V.seg=null;render();
 const {data,error}=await V.sb.rpc('dextera_admin_segnalazioni',{p_stato:V.filt});
 if(error){status(errText(error),true);V.seg={errori:[],gruppi:[]};render();return;}
 V.seg={errori:data.errori||[],gruppi:data.gruppi||[]};V.conta=data.conta;render();
}
async function saveReport(form,stato){
 const tipo=form.dataset.f,id=form.dataset.id,item=(V.seg[tipo==='errore'?'errori':'gruppi']||[]).find(x=>x.id===id)||{};
 const nota=form.elements.nota.value,st=stato||(form.elements.stato?form.elements.stato.value:null);
 const args={p_tipo:tipo,p_id:id,p_stato:st&&st!==item.stato?st:null,p_nota:nota.trim()===(item.nota_admin||'').trim()?null:nota,p_stesso_dato:!!(form.elements.tutte&&form.elements.tutte.checked)};
 if(args.p_stato==null&&args.p_nota==null){say('Niente da salvare.');return;}
 say('Salvo…');
 const {error}=await V.sb.rpc('dextera_admin_segnalazione',args);
 if(error){status(errText(error),true);return;}
 await loadSeg();
 say('Salvato'+(args.p_stato?': segnalazione '+STATI[args.p_stato].toLowerCase():'')+'.');
}
function decideDialog(form,stato){
 const dlg=$('conferma'),rim=stato==='risolta';
 dlg.innerHTML=`<form method="dialog"><h2 id="conf-t">${rim?'Rimuovere per sempre questo contenuto?':'Approvare questo contenuto?'}</h2>
  <p>${rim?'Il contenuto si toglie e non si potrà rimettere uguale.':'Il contenuto torna visibile e non si potrà più nascondere con le segnalazioni.'} La decisione non si cambia.</p>
  <div class="row"><button class="btn" value="no">Annulla</button><button class="btn ${rim?'bad':'acc'}" value="si">${rim?'Rimuovi':'Approva'}</button></div></form>`;
 dlg.onclose=()=>{if(dlg.returnValue==='si')saveReport(form,stato);else form.querySelector(`[data-a=dec][data-v=${stato}]`)?.focus();};
 dlg.returnValue='';dlg.showModal();dlg.querySelector('button[value=no]').focus();
}

/* ---------- eventi (delegati: la pagina si ridisegna spesso) ---------- */
document.addEventListener('submit',async e=>{
 const f=e.target;
 if(f.id==='login'){e.preventDefault();const b=f.querySelector('button');b.disabled=true;say('Accedo…');
  const {data,error}=await V.sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.pw.value});
  if(error){showLogin(errText(error));say('');return;}
  V.user=data.user;await checkStaff();return;}
 if(f.id==='cerca'){e.preventDefault();const q=f.q.value.trim();if(q.length<2){status(HINT.dextera_ricerca,true);return;}search(q);return;}
 if(f.dataset.f){e.preventDefault();saveReport(f);}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-a]');if(!b||b.closest('dialog'))return;
 const a=b.dataset.a;
 if(a==='tab'){V.tab=b.dataset.v;savePref();render();if(V.tab==='segn'&&!V.seg)loadSeg();document.querySelector(`[data-a=tab][data-v=${V.tab}]`)?.focus();}
 else if(a==='filt'){V.filt=b.dataset.v;savePref();await loadSeg();document.querySelector(`[data-a=filt][data-v=${V.filt}]`)?.focus();say(FILT[V.filt]+': '+V.seg.errori.length+' errori, '+V.seg.gruppi.length+' dei gruppi.');}
 else if(a==='user')loadUser(b.dataset.id);
 else if(a==='reset')resetDialog($('amb').value);
 else if(a==='dec')decideDialog(b.closest('form'),b.dataset.v);
 else if(a==='out'){await V.sb.auth.signOut({scope:'local'}).catch(()=>{});V.user=null;V.res=V.det=V.seg=null;showLogin();}
});

start().catch(e=>status(errText(e),true));
