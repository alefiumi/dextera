/* Scheda Percorso. Fase 0: segnaposto. Il percorso guidato (pianeti, satelliti, 6 passi) arriva con la fase 1;
   intanto mostra i pianeti e i satelliti di content/mappa.json, se c'è, e manda a Palestra e Atlante. */
import {$} from './util.js';
import {app} from './state.js';

const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function renderPath(){
 const M=app.MAPPA,corso=M&&M.corsi&&M.corsi[0];
 const map=corso?`<div class="sub">${esc(corso.nome)} · ${corso.pianeti.length} pianeti, ${corso.pianeti.reduce((n,p)=>n+p.satelliti.length,0)} satelliti</div>`+
  corso.pianeti.map(p=>`<div class="pl"><b>🪐 ${esc(p.nome)}</b><small>${p.satelliti.map(s=>esc(s.nome)).join(' · ')}</small></div>`).join(''):'';
 $('panel').innerHTML=`<div class="path"><div class="h">Il tuo percorso</div>
  <p class="mut">Qui arriverà il percorso guidato: ogni regione del corpo è un pianeta, ogni zona un satellite da accendere in 6 passi brevi (ossa, reperi, muscoli, connessioni, funzione, caso clinico). È in costruzione.</p>
  <p>Intanto puoi allenarti in <b>Palestra</b> con tutti i giochi e studiare nell'<b>Atlante</b> 2D e 3D.</p>
  <div class="chips"><button class="btn" data-go="play">🏋️ Vai in Palestra</button><button class="btn alt" data-go="atlas">🦴 Apri l'Atlante</button></div>
  ${map}</div>`;
}
