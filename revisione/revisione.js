/* Pagina di revisione dei testi anatomici (sezione 12 della specifica). Legge testi/*.json e content/mappa.json,
   mostra ogni dato con fonte e stato, diviso per satellite; il docente segna Giusto/Sbagliato e scrive la correzione.
   Le risposte restano in questo browser (localStorage, chiave dextera-revisione) e si esportano in CSV per
   atlante/build/importa_revisione.py. Nessun account, nessun invio in rete. */
const TIPI=['ossa','reperi','muscoli','encefalo','nervi-cranici','torace','gruppi','casi','neuro','correzioni'];
const STATI=['da verificare','verificato','corretto','segnalato'];
const FONTI=['Z-Anatomy','TA2','AI','docente','lezione'];   // lezione: materiale del corso (guida e slide del docente)
const SEP=' | ';           // valori che sono elenchi (opzioni dei casi, membri dei gruppi)
const KEY='dextera-revisione';
const PAG=40;              // voci mostrate per volta
const FUORI={enc:'Encefalo, midollo e nervi cranici',tor:'Cuore, vasi e polmoni',altro:'Altri dati (fuori dai satelliti)',corr:'Correzioni alla fonte'};
const TIPO_IT={'inverti_aree':'Origine e inserzione scambiate','aree_origine':'Aree segnate come origine','sposta_aree':'Area spostata','refuso':'Refuso di TA2','specchia':'Parte speculare'};

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const slug=s=>s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const testo=v=>Array.isArray(v)?v.join(SEP):(v==null?'':String(v));
const norm=s=>String(s).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();

let R={nome:'',esiti:{}};  // esiti: id del dato → {e:'giusto'|'sbagliato', c:correzione, n:nota, t:data}
try{R={...R,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(e){}
const salva=()=>{try{localStorage.setItem(KEY,JSON.stringify(R));}catch(e){}};

let SAT=[],SAT_BY={},VOCI=[],DATI=[],shown=PAG;

async function carica(){
 const get=f=>fetch(f,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(f+': HTTP '+r.status);return r.json();});
 const [mappa,...files]=await Promise.all([get('../content/mappa.json'),...TIPI.map(t=>get('../testi/'+t+'.json'))]);
 // satelliti e strutture di ogni satellite
 const dove={};  // id di content → satelliti
 const add=(id,s)=>{(dove[id]??=new Set()).add(s);};
 // tutti i corsi: il primo con i nomi dei pianeti, gli altri con il nome del corso davanti (es. «Neurologia · Encefalo»)
 mappa.corsi.forEach((co,ci)=>{for(const pl of co.pianeti)for(const s of pl.satelliti){
  SAT.push({id:s.id,nome:s.nome,pianeta:(ci?co.nome+' · ':'')+pl.nome,ordine:s.ordine});
  for(const p of s.passi){if(Array.isArray(p.strutture))p.strutture.forEach(id=>add(id,s.id));(p.casi||[]).forEach(c=>add('caso.neuro.'+c,s.id));}
  for(const g of s.ossa||[])add('g.'+g,s.id);
 }});
 SAT_BY=Object.fromEntries(SAT.map(s=>[s.id,s]));
 const satOf=ids=>[...new Set(ids.flatMap(id=>[...(dove[id]||[])]))];
 files.forEach((F,i)=>{
  const tipo=TIPI[i];
  for(const v of F.voci){
   if(v.vedi)continue;  // reperi con lo stesso nome di un osso: i dati sono nella voce dell'osso
   let sats=[],sez=null,nome=v.dati?.nome?.valore||v.ref||v.id,atl=null;
   if(tipo==='ossa'){sats=satOf(['o.'+v.id.slice(5)]);atl=v.ref;}
   else if(tipo==='reperi'){sats=satOf(['r.'+v.id.slice(7)]);if(!sats.length)sats=satOf(['o.'+slug(v.osso||'')]);atl=v.ref;}
   else if(tipo==='muscoli'){sats=satOf([slug(v.ref)]);atl=v.ref;}
   else if(tipo==='neuro'){sats=satOf(['n.'+v.id.slice(6)]);atl=v.ref||null;}
   else if(tipo==='casi'&&v.modulo==='neuro'){sats=satOf([v.id]);nome='Caso clinico '+v.caso+' ('+(v.dati.risposta?.valore||'')+')';}
   else if(tipo==='casi'){sats=v.modulo==='corpo'&&v.muscolo?satOf([slug(v.muscolo)]):[];if(!sats.length&&v.modulo!=='corpo')sez=['cuore','polmoni'].includes(v.modulo)?'tor':'enc';nome='Caso clinico '+v.caso+(v.muscolo?' ('+v.muscolo+')':'');}
   else if(tipo==='gruppi'){const [,k,r]=v.id.split('.');if(k==='ossa')sats=satOf(['g.'+r]);else if(k==='encefalo'||k==='strato-encefalo')sez='enc';else if(/^(strato-)?(cuore|polmoni)$/.test(k))sez='tor';}
   else if(tipo==='torace'){sez='tor';atl=v.ref;}
   else if(tipo==='encefalo'||tipo==='nervi-cranici'){sez='enc';if(tipo==='encefalo')atl=v.ref;if(tipo==='nervi-cranici')nome='Nervo '+v.numero+' – '+nome;}
   else if(tipo==='correzioni'){sez='corr';nome=(TIPO_IT[v.tipo]||v.tipo)+(v.muscolo?': '+v.muscolo:v.cerca?': «'+v.cerca+'»':v.parte?': '+v.parte:'');
    if(v.muscolo){sats=satOf([slug(v.muscolo)]);atl=v.muscolo;}}
   if(!sats.length&&!sez)sez='altro';
   const voce={id:v.id,tipo,nome,ref:v.ref,atl,sats,sez,lez:v.lezione||'',campi:F.campi||{motivo:'Motivo'},dati:[]};
   const dati=v.dati?Object.entries(v.dati):[['motivo',{valore:v.motivo,fonte:v.fonte,stato:v.stato,verifica:v.verifica}]];
   for(const [c,d] of dati){
    const id=v.dati?v.id+'.'+c:v.id;
    const x={id,voce,campo:c,etichetta:(F.campi||{})[c]||(c==='motivo'?'Motivo':c),valore:testo(d.valore),lista:Array.isArray(d.valore),fonte:d.fonte,stato:d.stato,verifica:d.verifica,nota:d.nota||''};
    voce.dati.push(x);DATI.push(x);
   }
   VOCI.push(voce);
  }
 });
}

// ---------------------------------------------------------------- filtri
function opzioni(){
 const pl=[...new Set(SAT.map(s=>s.pianeta))];
 $('f-sat').innerHTML='<option value="">Tutti i satelliti e gli altri dati</option>'+
  pl.map(p=>`<optgroup label="${esc(p)}">${SAT.filter(s=>s.pianeta===p).map(s=>`<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</optgroup>`).join('')+
  `<optgroup label="Fuori dal percorso">${Object.entries(FUORI).map(([k,n])=>`<option value="#${k}">${esc(n)}</option>`).join('')}</optgroup>`;
 $('f-stato').innerHTML='<option value="">Tutti</option>'+STATI.map(s=>`<option>${s}</option>`).join('');
 $('f-fonte').innerHTML='<option value="">Tutte</option>'+FONTI.map(s=>`<option>${s}</option>`).join('');
 let f={};try{f=JSON.parse(sessionStorage.getItem(KEY+'-filtri')||'{}');}catch(e){}
 $('f-sat').value=f.sat??SAT[0].id;$('f-stato').value=f.stato||'';$('f-fonte').value=f.fonte||'';$('f-q').value=f.q||'';$('f-todo').checked=!!f.todo;
}
const filtri=()=>({sat:$('f-sat').value,stato:$('f-stato').value,fonte:$('f-fonte').value,q:norm($('f-q').value.trim()),todo:$('f-todo').checked});
function datoOk(x,f){
 if(f.stato&&x.stato!==f.stato)return false;
 if(f.fonte&&x.fonte!==f.fonte)return false;
 if(f.todo&&R.esiti[x.id]?.e)return false;
 if(f.q&&!norm(x.valore+' '+x.id+' '+x.voce.nome).includes(f.q))return false;
 return true;
}
const inSez=(v,sat)=>!sat||(sat[0]==='#'?v.sez===sat.slice(1):v.sats.includes(sat));
// gruppi da mostrare: [{titolo, sottotitolo, voci:[{voce, dati}]}]
function gruppi(f){
 const out=[];
 const blocco=(titolo,sotto,test)=>{const voci=[];for(const v of VOCI)if(test(v)){const d=v.dati.filter(x=>datoOk(x,f));if(d.length)voci.push({voce:v,dati:d});}if(voci.length)out.push({titolo,sotto,voci});};
 if(f.sat&&f.sat[0]!=='#'){const s=SAT_BY[f.sat];blocco(s.nome,s.pianeta,v=>v.sats.includes(s.id));}
 else if(f.sat)blocco(FUORI[f.sat.slice(1)],'',v=>v.sez===f.sat.slice(1));
 else{for(const s of SAT)blocco(s.nome,s.pianeta,v=>v.sats.includes(s.id));for(const k in FUORI)blocco(FUORI[k],'Fuori dal percorso',v=>v.sez===k);}
 return out;
}

// ---------------------------------------------------------------- disegno
function datoHtml(x){
 const r=R.esiti[x.id]||{},ver=x.verifica&&x.verifica.quando?` · verificato il ${esc(x.verifica.quando)}`:'';
 return `<div class="dato ${r.e==='giusto'?'ok':r.e==='sbagliato'?'no':''}" data-id="${esc(x.id)}">
  <div class="k">${esc(x.etichetta)}</div>
  <div class="v"><div class="t"><span class="print-box"></span>${esc(x.valore)||'<i class="mut">(vuoto)</i>'}</div>
   ${x.nota?`<p class="nota">ℹ️ ${esc(x.nota)}</p>`:''}<div class="tags"><span class="tag">fonte: ${esc(x.fonte)}</span><span class="tag s-${slug(x.stato)}">${esc(x.stato)}${ver}</span>
    <span class="esito"><button class="ok" data-e="giusto" aria-pressed="${r.e==='giusto'}">Giusto</button><button class="no" data-e="sbagliato" aria-pressed="${r.e==='sbagliato'}">Sbagliato</button></span></div>
   <div class="corr">${r.e==='sbagliato'?corrHtml(x,r):''}</div></div></div>`;
}
const corrHtml=(x,r)=>`<textarea data-k="c" aria-label="Correzione" placeholder="${x.lista?'Valore giusto (elementi separati da |)':'Valore giusto, se lo sai'}">${esc(r.c??'')}</textarea>
 <textarea data-k="n" aria-label="Nota" placeholder="Nota o fonte (atlante, pagina…), facoltativa">${esc(r.n??'')}</textarea>`;
function voceHtml({voce,dati}){
 const link=voce.atl?`<a class="noprint small" href="../atlante/index.html?vedi=${encodeURIComponent(voce.atl)}" target="_blank" rel="noopener">Vedi nell'atlante</a>`:'';
 return `<article class="voce"><header><div><h3>${esc(voce.nome)}</h3><code>${esc(voce.id)}</code>${voce.lez?`<small class="mut"> · nel corso: ${esc(voce.lez)}</small>`:''}</div>${link}</header>${dati.map(datoHtml).join('')}</article>`;
}
function disegna(){
 const f=filtri();try{sessionStorage.setItem(KEY+'-filtri',JSON.stringify({...f,q:$('f-q').value}));}catch(e){}
 const G=gruppi(f);let n=0,h='';
 const tot=G.reduce((a,g)=>a+g.voci.length,0);
 for(const g of G){
  if(n>=shown)break;
  h+=`<h2>${esc(g.titolo)} <span class="num">${g.sotto?esc(g.sotto)+' · ':''}${g.voci.length} voci</span></h2>`;
  for(const v of g.voci){if(n++>=shown)break;h+=voceHtml(v);}
 }
 if(!tot)h='<p class="mut">Nessun dato con questi filtri.</p>';
 else if(tot>shown)h+=`<button class="btn more" id="more">Mostra altre voci (${Math.min(tot-shown,PAG)} di ${tot-shown})</button>`;
 $('lista').innerHTML=h;
 avanzamento();
}
function avanzamento(){
 const sat=$('f-sat').value,righe=[...SAT.map(s=>[s.id,s.nome,v=>v.sats.includes(s.id)]),...Object.entries(FUORI).map(([k,n])=>['#'+k,n,v=>v.sez===k])];
 let tg=0,tn=0,tt=0;
 $('prog').innerHTML=righe.map(([id,nome,test])=>{
  let g=0,no=0,t=0;for(const v of VOCI)if(test(v))for(const x of v.dati){t++;const e=R.esiti[x.id]?.e;if(e==='giusto')g++;else if(e==='sbagliato')no++;}
  return `<button data-sat="${id}" class="${id===sat?'on':''}"><span>${esc(nome)}</span><span class="num">${g+no} / ${t}</span>
   <span class="bar"><i class="i-ok" style="width:${t?g/t*100:0}%"></i><i class="i-no" style="width:${t?no/t*100:0}%"></i></span></button>`;
 }).join('');
 for(const x of DATI){tt++;const e=R.esiti[x.id]?.e;if(e==='giusto')tg++;else if(e==='sbagliato')tn++;}
 $('prog-tot').textContent=`· ${tg+tn} di ${tt} dati segnati`;
 $('conta').textContent=`${tg} giusti, ${tn} sbagliati`;
}

// ---------------------------------------------------------------- CSV
const COLS=['id','tipo','voce','campo','valore','fonte','stato','esito','correzione','nota','revisore','data'];
function csv(dati){
 const q=s=>{s=String(s??'');return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 const L=[COLS.join(';')];
 for(const x of dati){const r=R.esiti[x.id]||{};
  L.push([x.id,x.voce.tipo,x.voce.nome,x.etichetta,x.valore,x.fonte,x.stato,r.e||'',r.e==='sbagliato'?r.c||'':'',r.n||'',r.e?R.nome:'',r.t||''].map(q).join(';'));}
 return '﻿'+L.join('\r\n')+'\r\n';  // BOM e punto e virgola: Excel in italiano lo apre a colonne
}
function scarica(nome,txt){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));a.download=nome;
 document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
const oggi=()=>new Date().toISOString().slice(0,10);

// ---------------------------------------------------------------- eventi
$('lista').addEventListener('click',e=>{
 if(e.target.id==='more'){shown+=PAG;disegna();return;}
 const b=e.target.closest('[data-e]');if(!b)return;
 const row=b.closest('.dato'),id=row.dataset.id,x=DATI.find(d=>d.id===id),r=R.esiti[id]||{};
 if(r.e===b.dataset.e)delete R.esiti[id];else R.esiti[id]={...r,e:b.dataset.e,t:oggi()};
 salva();
 const nr=R.esiti[id]||{};
 row.className='dato '+(nr.e==='giusto'?'ok':nr.e==='sbagliato'?'no':'');
 row.querySelectorAll('[data-e]').forEach(k=>k.setAttribute('aria-pressed',String(nr.e===k.dataset.e)));
 row.querySelector('.corr').innerHTML=nr.e==='sbagliato'?corrHtml(x,nr):'';
 if(nr.e==='sbagliato')row.querySelector('textarea').focus();
 avanzamento();
});
$('lista').addEventListener('input',e=>{
 const k=e.target.dataset.k;if(!k)return;const id=e.target.closest('.dato').dataset.id;
 R.esiti[id]={...R.esiti[id],[k]:e.target.value};salva();
});
for(const id of ['f-sat','f-stato','f-fonte','f-todo'])$(id).addEventListener('change',()=>{shown=PAG;disegna();});
let tq;$('f-q').addEventListener('input',()=>{clearTimeout(tq);tq=setTimeout(()=>{shown=PAG;disegna();},250);});
$('prog').addEventListener('click',e=>{const b=e.target.closest('[data-sat]');if(!b)return;$('f-sat').value=b.dataset.sat;shown=PAG;disegna();$('lista').scrollIntoView({behavior:'smooth'});});
$('nome').addEventListener('input',e=>{R.nome=e.target.value.trim();salva();});
$('esporta').addEventListener('click',()=>{
 const d=DATI.filter(x=>R.esiti[x.id]?.e);
 if(!d.length){alert('Non hai ancora segnato nessun dato.');return;}
 scarica(`dextera-revisione-${oggi()}.csv`,csv(d));
});
$('esporta-tutto').addEventListener('click',()=>{
 const f=filtri(),seen=new Set(),d=[];
 for(const g of gruppi(f))for(const v of g.voci)for(const x of v.dati)if(!seen.has(x.id)){seen.add(x.id);d.push(x);}
 scarica(`dextera-elenco-${f.sat.replace('#','')||'tutto'}-${oggi()}.csv`,csv(d));
});
$('stampa').addEventListener('click',()=>{shown=1e9;disegna();setTimeout(()=>window.print(),50);});

carica().then(()=>{$('nome').value=R.nome||'';opzioni();disegna();})
 .catch(e=>{$('lista').innerHTML=`<p>Non riesco a caricare i dati: ${esc(e.message)}. Apri la pagina dal sito dell'app, con la connessione.</p>`;});
