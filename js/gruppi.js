/* Pagina dei gruppi (v0.94.0, sezione 6 della specifica; file SQL 20261128090000_dextera_gruppi.sql):
   - voto di capo e vice in ogni casata (casata grande e casata del percorso): dal 1° al 7 del mese si vota un membro attivo;
     chiude il server (più voti = capo, secondo = vice, a parità a caso: qui si vede la moneta);
   - annuncio (al massimo 280 caratteri) e banner (galleria o immagine caricata) di casate ed equipaggi: li cambiano capo e vice;
   - «Segnala» su annunci, banner e copertine caricate: con 2 segnalazioni il contenuto si nasconde finché un amministratore
     non decide (riquadro «Controllo dei contenuti» nel Profilo, solo per chi è in dextera_admin).
   Tutto passa dalle funzioni dextera_* del server (dextera_gruppi() dà in una volta casate, capi, voto e bacheche).
   L'ultima copia resta in dextera-gruppi (si vede anche offline); senza il file SQL GR.ok = false e la Flotta lo dice.
   Testi degli utenti sempre con esc(). */
import {toast} from './util.js';
import {account as A,esc,online} from './account.js';

export const GR_SQL='supabase/migrations/20261128090000_dextera_gruppi.sql';
// galleria dei banner (stessi sfondi della copertina del profilo, ban-<id> in style.css); per il profilo alcuni si sbloccano col livello
export const GALLERIA=[['notte','Notte stellata'],['aurora','Aurora'],['tramonto','Tramonto'],['oceano','Oceano'],['foresta','Foresta'],['sole','Sole'],
 ['nebulosa','Nebulosa'],['ghiaccio','Ghiaccio'],['vulcano','Vulcano'],['galassia','Galassia'],['cometa','Cometa'],['eclissi','Eclissi']];
export const SBLOCCO={galassia:5,cometa:10,eclissi:15};
export const banId=b=>GALLERIA.some(x=>x[0]===b)?b:'notte';
const MAX_TXT=280;

const KEY='dextera-gruppi';
export const GR={uid:null,ok:null,d:null,at:0,seen:{}};
try{Object.assign(GR,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){}
const keep=()=>{try{const {uid,ok,d,at,seen}=GR;localStorage.setItem(KEY,JSON.stringify({uid,ok,d,at,seen}));}catch(e){}};
// scelte della schermata (non salvate): voto aperto, modifica in corso con la bozza, elenco del controllo
const UI={vote:null,edit:null,draft:null,mod:null,modBusy:false};
let HOOK={redraw:()=>{},reload:async()=>{}};
export const setGruppiHooks=o=>{HOOK={...HOOK,...o};};

const missingFn=e=>/PGRST202|42883|Could not find the function|dextera_gruppi|schema cache/i.test((e.code||'')+' '+(e.message||''));
export async function loadGruppi(sb,uid){
 const {data,error}=await sb.rpc('dextera_gruppi');
 if(error){if(missingFn(error)){GR.ok=false;GR.uid=uid;keep();return false;}throw error;}
 const d=data&&typeof data==='object'&&!Array.isArray(data)?data:{}; // forma attesa anche se il server risponde in modo strano
 Object.assign(GR,{ok:true,uid,d:{...d,casate:Array.isArray(d.casate)?d.casate:[],equipaggi:Array.isArray(d.equipaggi)?d.equipaggi:[],nomi:d.nomi||{}},at:Date.now()});keep();return true;
}
export function clearGruppi(){Object.assign(GR,{uid:null,ok:null,d:null,at:0});UI.mod=null;keep();}
const mine=()=>A.user&&GR.uid===A.user.id&&GR.d?GR.d:null;
export const isAdmin=()=>!!mine()?.admin;
export const fileMissing=()=>!!A.user&&GR.uid===A.user.id&&GR.ok===false;
const kOf=id=>(mine()?.casate||[]).find(x=>x.casata===id)||null;
const cOf=id=>(mine()?.equipaggi||[]).find(x=>x.crew===id)||null;
const nm=id=>(mine()?.nomi||{})[id]||'(senza nome)';
const dmy=d=>new Date(d+(String(d).length===10?'T12:00:00':'')).toLocaleDateString('it',{day:'numeric',month:'long'});

/* ---------- immagini ---------- */
// banner caricato: ritaglio 3:1 al centro, 960×320 JPEG, qualità che scende finché il testo resta sotto ~80 000 caratteri (circa 60 KB)
export function shrinkBanner(file){
 return new Promise((ok,ko)=>{
  if(!/^image\//.test(file.type||'')){ko(new Error('Scegli un\'immagine.'));return;}
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   const W=960,H=320,r=W/H;let sw=img.width,sh=img.height;if(sw/sh>r)sw=sh*r;else sh=sw/r;
   const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,W,H);
   g.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,0,0,W,H);URL.revokeObjectURL(url);
   let q=.82,out=c.toDataURL('image/jpeg',q);while(out.length>80000&&q>.35){q-=.08;out=c.toDataURL('image/jpeg',q);}
   out.length>118000?ko(new Error('Immagine troppo pesante: provane un\'altra.')):ok(out);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);ko(new Error('Immagine non leggibile.'));};img.src=url;
 });
}
const IMG_OK=/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const safeImg=s=>typeof s==='string'&&IMG_OK.test(s)?s:'';
// banner di un gruppo: sfondo della galleria con le stelle e, sopra, l'immagine caricata (se c'è)
export function bannerHtml(ban,img,label,cls='gban'){
 const i=safeImg(img);
 return `<div class="${cls} ban-${banId(ban)}">${i?`<img src="${esc(i)}" alt="${esc(label)}">`:''}</div>`;
}
export function galleryHtml(name,sel,lvl){
 return `<div class="banopts">${GALLERIA.map(([id,n])=>{const need=lvl!=null&&SBLOCCO[id]&&lvl<SBLOCCO[id];
  return `<label class="ban-${id}${need?' lock':''}"${need?` title="${esc(n)}: si sblocca al livello ${SBLOCCO[id]}"`:''}><input type="radio" name="${name}" value="${id}"${sel===id?' checked':''}${need?' disabled':''}><span class="sr">${esc(n)}${need?` (si sblocca al livello ${SBLOCCO[id]})`:''}</span>${need?'<i aria-hidden="true">🔒</i>':''}</label>`;}).join('')}</div>`;
}

/* ---------- pezzi della pagina ---------- */
const keyOf=(k,c)=>c?'c:'+c:'k:'+k;
const at=(k,c)=>c?`data-c="${esc(c)}"`:`data-k="${esc(k)}"`;
function annHtml(g,k,c){
 if(!g.annuncio)return '';
 const mineA=g.annuncio_da===A.user?.id;
 return `<div class="gann"><div class="kick">📣 Annuncio di ${esc(nm(g.annuncio_da))}${g.annuncio_il?' · '+esc(new Date(g.annuncio_il).toLocaleDateString('it',{day:'numeric',month:'short'})):''}</div>
  <p>${esc(g.annuncio)}</p>${mineA?'':`<button class="linkb" data-gr="rep" data-t="annuncio" ${at(k,c)}>Segnala l'annuncio</button>`}</div>`;
}
function editHtml(g,k,c,label){
 const key=keyOf(k,c);
 if(UI.edit!==key)return `<div class="chips"><button class="chip" data-gr="edit" ${at(k,c)}>✏️ Annuncio e banner</button></div>`;
 const d=UI.draft,id='ge-'+key.replace(/[^a-z0-9]/gi,''),img=safeImg(d.img);
 return `<form class="gedit" data-gr="save" ${at(k,c)}><div class="sub">Annuncio e banner</div>
  <label class="fl" for="${id}">Annuncio (al massimo ${MAX_TXT} caratteri, lo leggono solo i membri)</label>
  <textarea id="${id}" class="soq" name="testo" maxlength="${MAX_TXT}" rows="3" data-gr="txt" aria-describedby="${id}-n">${esc(d.testo)}</textarea>
  <small class="mut" id="${id}-n" aria-live="polite">${d.testo.length}/${MAX_TXT}</small>
  <fieldset class="bansel"><legend>Banner della galleria</legend>${galleryHtml('gban',d.banner,null)}</fieldset>
  ${img?`<div class="sub">Immagine caricata</div>${bannerHtml(d.banner,img,'Anteprima del banner di '+label,'gban prev')}`:''}
  <div class="chips"><label class="chip">🖼️ ${img?'Cambia immagine':'Carica un\'immagine'}<input type="file" accept="image/*" data-gr="img" ${at(k,c)} hidden></label>${img?`<button type="button" class="chip" data-gr="noimg" ${at(k,c)}>Togli l'immagine</button>`:''}</div>
  <p class="note">L'immagine si ritaglia in formato 3:1 e si riduce sul telefono prima dell'invio. Usa solo immagini tue o libere. Annunci e immagini si possono segnalare: con 2 segnalazioni si nascondono finché un amministratore non li controlla.</p>
  <div class="pfbtn"><button class="btn"${online()?'':' disabled'}>Salva</button><button type="button" class="btn alt" data-gr="editx">Annulla</button></div></form>`;
}
function voteHtml(g,k){
 const v=g.voto||{};if(!v.aperto)return '';
 const open=UI.vote===k,c=v.candidati||[],my=v.mio;
 let body;
 if(!c.length)body=`<p class="mut">Nessun altro membro attivo da votare per ora (si votano i membri con punti negli ultimi 35 giorni).</p>`;
 else if(open)body=`<fieldset class="gvl"><legend class="sr">Scegli chi votare</legend>${c.map(p=>`<label class="gvo"><input type="radio" name="gv-${esc(k)}" value="${esc(p.id)}"${p.id===my?' checked':''}> ${esc(p.nome||'(senza nome)')}</label>`).join('')}</fieldset>
  <div class="chips"><button class="chip on" data-gr="votego" data-k="${esc(k)}"${online()?'':' disabled'}>Conferma il voto</button>${my?`<button class="chip" data-gr="unvote" data-k="${esc(k)}">Ritira il voto</button>`:''}<button class="chip" data-gr="vote" data-k="${esc(k)}">Annulla</button></div>`;
 else body=`<p class="mut">${my?`Hai votato <b>${esc(c.find(p=>p.id===my)?.nome||nm(my))}</b>. Puoi cambiare fino al ${esc(dmy(v.chiude))}.`:'Vota una persona della casata: chi prende più voti diventa capo, il secondo vice.'}</p>
  <div class="chips"><button class="chip${my?'':' on'}" data-gr="vote" data-k="${esc(k)}">${my?'Cambia voto':'🗳️ Vota'}</button></div>`;
 return `<div class="gvote"><div class="sub">🗳️ Voto di capo e vice · fino al ${esc(dmy(v.chiude))}</div>${body}</div>`;
}
function capiHtml(g,k,name){
 const r=g.capi,v=g.voto||{},s=mine()?.stagione;
 let out='';
 if(r&&r.stagione===s&&!GR.seen[k+':'+s]){ // presentazione dei nuovi eletti (con la moneta se c'è stata parità)
  out+=`<div class="gnew" role="status">${r.parita?'<div class="coin" aria-hidden="true">🪙</div>':''}<b>🎉 Eletti di ${esc(name)} per questo mese</b>
   ${r.parita?'<p class="mut">Parità di voti: il server ha lanciato la moneta.</p>':''}<p>👑 Capo: <b>${esc(nm(r.capo))}</b>${r.vice?` · ⭐ Vice: <b>${esc(nm(r.vice))}</b>`:''}</p>
   <button class="chip" data-gr="seen" data-k="${esc(k)}">Ok</button></div>`;
 }
 if(r&&(r.capo||r.vice))out+=`<p class="gcapi">${r.capo?`👑 Capo: <b>${esc(nm(r.capo))}</b>`:''}${r.vice?` · ⭐ Vice: <b>${esc(nm(r.vice))}</b>`:''}${r.stagione!==s?' <small class="mut">(eletti il mese scorso, fino al nuovo voto)</small>':''}</p>`;
 else if(!v.aperto)out+='<p class="mut gcapi">Nessun capo: questo mese nessuno ha votato. Si vota di nuovo dal 1° del mese prossimo.</p>';
 return out;
}
// parte alta della card di una casata: banner, capi, presentazione degli eletti, annuncio, voto, modifica (capo e vice)
export function houseTop(k){
 if(fileMissing())return '';
 const g=kOf(k.id);if(!g)return '';
 return bannerHtml(g.banner,g.banner_img,'Banner di '+k.nome)+(g.banner_img&&g.puo===false?`<button class="linkb gbrep" data-gr="rep" data-t="banner" data-k="${esc(k.id)}">Segnala l'immagine</button>`:'')+
  capiHtml(g,k.id,k.nome)+annHtml(g,k.id,null)+voteHtml(g,k.id)+(g.puo?editHtml(g,k.id,null,k.nome):'');
}
export function crewTop(c){
 if(fileMissing())return '';
 const g=cOf(c.id);if(!g)return '';
 return bannerHtml(g.banner,g.banner_img,'Banner di '+c.nome)+(g.banner_img&&!g.puo?`<button class="linkb gbrep" data-gr="rep" data-t="banner" data-c="${esc(c.id)}">Segnala l'immagine</button>`:'')+
  annHtml(g,null,c.id)+(g.puo?editHtml(g,null,c.id,c.nome):'');
}
export const missingNote=()=>fileMissing()?`<p class="note">⚠️ Voto di capo e vice, annunci e banner arrivano quando sul server c'è il file ${GR_SQL}.</p>`:'';
// riga nel riquadro Flotta del Profilo: annuncio della casata grande e voto aperto
export function profileLine(id){
 const g=kOf(id);if(!g)return '';
 const v=g.voto||{};
 return (g.annuncio?`<p class="pfann">📣 <b>${esc(nm(g.annuncio_da))}:</b> ${esc(g.annuncio)}</p>`:'')+
  (v.aperto&&!v.mio&&(v.candidati||[]).length?`<p class="pfann">🗳️ È aperto il voto di capo e vice, fino al ${esc(dmy(v.chiude))}.</p>`:'');
}

/* ---------- controllo dei contenuti (amministratori, nel Profilo) ---------- */
const TIPI={annuncio:'Annuncio',banner:'Banner',copertina:'Copertina del profilo'};
export function adminCard(){
 if(!isAdmin())return '';
 const L=UI.mod;
 const items=!L?'':L.length?L.map(x=>{const img=x.tipo!=='annuncio'?safeImg(x.contenuto):'';
  return `<li class="gmod"><div class="kick">${esc(TIPI[x.tipo]||x.tipo)} · ${esc(x.gruppo||'')}</div>
   <p class="mut">${x.stato==='nascosto'?'Nascosto ('+(+x.segnalazioni||2)+' segnalazioni)':'Segnalato una volta, ancora visibile'} · di ${esc(x.autore||'account cancellato')}</p>
   ${x.tipo==='annuncio'?`<blockquote>${esc(x.contenuto||'(già sostituito)')}</blockquote>`:img?`<img class="gmimg" src="${esc(img)}" alt="Immagine segnalata">`:'<p class="mut">(immagine già sostituita)</p>'}
   ${(x.motivi||[]).length?`<p class="mut">Motivi: ${x.motivi.map(m=>'«'+esc(m)+'»').join(', ')}</p>`:''}
   <div class="chips"><button class="chip" data-gr="mok" data-id="${esc(x.id)}">✅ Rimetti visibile</button><button class="chip" data-gr="mrm" data-id="${esc(x.id)}">🗑️ Togli per sempre</button></div></li>`;}).join('')
  :'<p class="mut">Nessun contenuto da controllare.</p>';
 return `<div class="card pfmod"><div class="kick">Amministrazione</div><h2>🛡️ Controllo dei contenuti</h2>
  <p class="mut">Annunci, banner e copertine segnalati. Con 2 segnalazioni si nascondono da soli: «Rimetti visibile» li riporta (e non si possono più nascondere con le segnalazioni), «Togli per sempre» li cancella.</p>
  ${L?`<ul class="gmods">${items}</ul>`:''}<div class="chips"><button class="chip" data-gr="mlist"${online()&&!UI.modBusy?'':' disabled'}>${L?'Aggiorna l\'elenco':'Apri l\'elenco'}</button></div></div>`;
}

/* ---------- azioni ---------- */
const HINTS={dextera_voto_chiuso:'Il voto è chiuso.',dextera_non_membro:'Non sei in questo gruppo.',dextera_voto_se:'Non puoi votare te stesso.',
 dextera_candidato:'Questa persona non si può votare (non è nella casata o non ha punti negli ultimi 35 giorni).',dextera_non_capo:'Solo capo e vice possono cambiarlo.',
 dextera_lungo:'L\'annuncio è troppo lungo (al massimo 280 caratteri).',dextera_rimosso:'Questo contenuto è stato tolto da un amministratore: non si può rimettere.',
 dextera_nulla:'Non c\'è più niente da segnalare.',dextera_tuo:'È un tuo contenuto.',dextera_admin:'Solo per gli amministratori.',dextera_deciso:'Già deciso da un altro amministratore.'};
async function rpc(fn,args,okMsg){
 if(!online()||!A.sb){toast('Serve la connessione.');return null;}
 const {data,error}=await A.sb.rpc(fn,args);
 if(error){const h=Object.keys(HINTS).find(k=>((error.hint||'')+(error.message||'')).includes(k));toast(h?HINTS[h]:missingFn(error)?'Sul server manca il file '+GR_SQL+'.':'Non riuscito: riprova tra poco.');return null;}
 if(okMsg)toast(okMsg);return data??'ok';
}
const refresh=async()=>{try{await loadGruppi(A.sb,A.user.id);}catch(e){}HOOK.redraw();};
const target=b=>({k:b.dataset.k||null,c:b.dataset.c||null});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,KID=/^[a-z0-9-]{1,40}$/;
const validT=({k,c})=>(c?UUID.test(c):KID.test(k||''));
export async function report(tipo,{k=null,c=null,u=null}){
 const m=prompt('Perché lo segnali? (facoltativo)\nCon 2 segnalazioni di persone diverse si nasconde finché un amministratore non lo controlla.');
 if(m===null)return;
 const r=await rpc('dextera_segnala',{p_tipo:tipo,p_casata:k,p_crew:c,p_utente:u,p_motivo:m.slice(0,200)});
 if(r)toast(r==='nascosto'?'Segnalato: ora è nascosto finché un amministratore non lo controlla.':r==='approvato'?'Un amministratore l\'ha già controllato e lasciato visibile.':r==='rimosso'?'Già tolto.':'Segnalazione inviata: grazie.');
 if(r&&tipo!=='copertina')await refresh();
 return r;
}
export function wireGruppi(panel){
 panel.addEventListener('click',async e=>{
  const b=e.target.closest('[data-gr]');if(!b||!A.user||b.tagName==='FORM'||b.tagName==='INPUT'||b.tagName==='TEXTAREA')return;
  const a=b.dataset.gr,t=target(b);
  if(['vote','votego','unvote','seen','edit','editx','noimg','rep'].includes(a)&&!validT(t))return;
  if(a==='vote'){UI.vote=UI.vote===t.k?null:t.k;HOOK.redraw();panel.querySelector(`[data-gr="${UI.vote?'votego':'vote'}"][data-k="${t.k}"]`)?.focus();}
  else if(a==='votego'){const ch=b.closest('.gvote')?.querySelector('input[type=radio]:checked');if(!ch||!UUID.test(ch.value)){toast('Scegli una persona.');return;}
   if(await rpc('dextera_vota',{p_casata:t.k,p_candidato:ch.value},'Voto registrato: puoi cambiarlo fino alla chiusura.')){UI.vote=null;await refresh();}}
  else if(a==='unvote'){if(await rpc('dextera_vota',{p_casata:t.k,p_candidato:null},'Voto ritirato.')){UI.vote=null;await refresh();}}
  else if(a==='seen'){const s=mine()?.stagione;if(s){GR.seen[t.k+':'+s]=1;keep();}HOOK.redraw();}
  else if(a==='edit'){const g=t.c?cOf(t.c):kOf(t.k);if(!g)return;UI.edit=keyOf(t.k,t.c);UI.draft={testo:g.annuncio||'',banner:banId(g.banner),img:safeImg(g.banner_img)};HOOK.redraw();panel.querySelector('form.gedit textarea')?.focus();}
  else if(a==='editx'){UI.edit=null;UI.draft=null;HOOK.redraw();}
  else if(a==='noimg'){if(UI.draft){UI.draft.img='';HOOK.redraw();}}
  else if(a==='rep'){const tipo=b.dataset.t==='banner'?'banner':'annuncio';await report(tipo,t);}
  else if(a==='mlist'){UI.modBusy=true;HOOK.redraw();const L=await rpc('dextera_moderazione',{});UI.modBusy=false;if(L)UI.mod=Array.isArray(L)?L:[];HOOK.redraw();}
  else if(a==='mok'||a==='mrm'){const id=b.dataset.id;if(!UUID.test(id||''))return;
   if(a==='mrm'&&!confirm('Togliere per sempre questo contenuto? Non si potrà rimettere uguale.'))return;
   if(await rpc('dextera_modera',{p_id:id,p_azione:a==='mok'?'approva':'rimuovi'},a==='mok'?'Rimesso visibile.':'Tolto per sempre.')){UI.mod=(UI.mod||[]).filter(x=>x.id!==id);await refresh();}}
 });
 panel.addEventListener('input',e=>{const t=e.target;if(t.dataset?.gr!=='txt'||!UI.draft)return;UI.draft.testo=t.value.slice(0,MAX_TXT);const n=document.getElementById(t.id+'-n');if(n)n.textContent=UI.draft.testo.length+'/'+MAX_TXT;});
 panel.addEventListener('change',async e=>{
  const t=e.target;if(!UI.draft)return;
  if(t.name==='gban'){UI.draft.banner=banId(t.value);if(UI.draft.img)HOOK.redraw();return;}
  if(t.dataset?.gr==='img'&&t.files&&t.files[0]){try{UI.draft.img=await shrinkBanner(t.files[0]);}catch(x){toast(x.message);}HOOK.redraw();}
 });
 panel.addEventListener('submit',async e=>{
  const f=e.target.closest('form[data-gr="save"]');if(!f)return;e.preventDefault();
  const t=target(f);if(!validT(t)||!UI.draft)return;
  const g=t.c?cOf(t.c):kOf(t.k);if(!g)return;
  const d=UI.draft,txt=d.testo.trim();let ok=true;
  if(txt!==(g.annuncio||''))ok=!!(await rpc('dextera_annuncio',{p_casata:t.k,p_crew:t.c,p_testo:txt}));
  if(ok&&(d.banner!==banId(g.banner)||d.img!==safeImg(g.banner_img)))ok=!!(await rpc('dextera_banner',{p_casata:t.k,p_crew:t.c,p_banner:d.banner,p_img:d.img||null}));
  if(ok){UI.edit=null;UI.draft=null;toast('Salvato: lo vedono i membri.');await refresh();}
 });
}
