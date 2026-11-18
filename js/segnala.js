/* «Segnala un errore» (sezioni 8 e 12 della specifica).
   Ogni segnalazione porta l'id del dato di testi/ (es. muscolo.semitendinosus.origine) e va nella coda 'dextera-segnalazioni':
   con l'account parte verso error_reports (account.js), senza account resta qui e parte quando l'utente accede.
   'dextera-segnalati' tiene l'ultimo elenco del server dei dati segnalati da almeno due persone {data_id: ultima segnalazione}:
   percorso.js toglie quei dati dalle lezioni finché un docente non li ricontrolla (data di verifica più recente). */
import {$,toast} from './util.js';

const QK='dextera-segnalazioni',FK='dextera-segnalati';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d;}catch(e){return d;}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
export const reports={
 all:()=>read(QK,[]),
 set:a=>write(QK,a.slice(-200)),
 add(r){const a=reports.all();a.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),creato_il:new Date().toISOString(),...r});reports.set(a);}
};
let flagged=null;
export const flaggedIds=()=>flagged||(flagged=read(FK,{rows:{}}).rows||{});
export function setFlagged(rows){flagged=rows;write(FK,{t:Date.now(),rows});}
export const flaggedAge=()=>Date.now()-(read(FK,{}).t||0);

/* ---------- finestra in basso (aria-modal, fuoco bloccato dentro, Esc chiude) ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let back=null,onSent=null;
// items: [{id, label, value}] i dati mostrati nella domanda; hasAccount: per dire quando parte
export function openReport(items,hasAccount,done){
 back=document.activeElement;onSent=done||null;
 let s=$('sheet');if(!s){s=document.createElement('div');s.id='sheet';document.body.append(s);}
 const one=items.length===1;
 s.innerHTML=`<div class="shbg" data-sh="close"></div><div class="shbox" role="dialog" aria-modal="true" aria-labelledby="shT">
  <div class="h" id="shT">Segnala un errore</div>
  <p class="mut">Il dato segnalato va all'autore e ai docenti che verificano i contenuti. Quando due persone segnalano lo stesso dato, esce dalle lezioni finché non viene ricontrollato.</p>
  <form id="shF"><fieldset><legend>${one?'Dato':'Quale dato è sbagliato?'}</legend>
  ${items.map((it,i)=>`<label class="shi"><input type="checkbox" name="d" value="${esc(it.id)}"${one||i===0?' checked':''}> <span><b>${esc(it.label)}</b>: ${esc(String(it.value).slice(0,160))}</span></label>`).join('')}
  </fieldset><label for="shN" class="shl">Cosa non va? (facoltativo)</label>
  <textarea id="shN" maxlength="500" rows="3" placeholder="Per esempio: l'inserzione giusta è…"></textarea>
  <p class="err" id="shE" role="alert"></p>
  <div class="shb"><button type="submit" class="btn">Invia</button><button type="button" class="btn alt" data-sh="close">Annulla</button></div></form>
  <p class="note">${hasAccount?'Parte appena c\'è la connessione.':'Senza account la segnalazione resta su questo telefono e parte quando accedi.'}</p></div>`;
 s.hidden=false;
 s.querySelector('input,textarea').focus();
 s.onclick=e=>{if(e.target.closest('[data-sh=close]'))close();};
 s.onkeydown=e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const f=[...s.querySelectorAll('input,textarea,button')].filter(x=>!x.disabled),a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
 };
 $('shF').onsubmit=e=>{
  e.preventDefault();
  const ids=[...s.querySelectorAll('input[name=d]:checked')].map(x=>x.value);
  if(!ids.length){$('shE').textContent='Scegli almeno un dato.';return;}
  const nota=$('shN').value.trim().slice(0,500);
  for(const id of ids){const it=items.find(x=>x.id===id);reports.add({data_id:id,nota,valore:String(it?.value??'').slice(0,1000)});}
  close();toast('Grazie: segnalazione salvata.'+(hasAccount?'':' Partirà quando accedi.'));onSent?.();
 };
}
function close(){const s=$('sheet');if(s){s.hidden=true;s.innerHTML='';}back?.focus?.();back=null;}
