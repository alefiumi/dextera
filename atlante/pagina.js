/* Pagina dell'atlante: dentro l'app (iframe) toglie la propria intestazione; freccia sul bordo della scheda che la
   abbassa (resta una striscia, il modello si allarga) e la rialza, scelta salvata. File a parte e non script in linea,
   così la Content-Security-Policy può vietare gli script in linea. */
if(window.parent!==window)document.body.classList.add('emb');
document.addEventListener('DOMContentLoaded',()=>{const w=document.getElementById('pw'),b=document.getElementById('fold');
 const set=f=>{w.classList.toggle('fold',f);b.title=f?'Rialza la scheda':'Abbassa la scheda';b.setAttribute('aria-label',b.title);try{localStorage.setItem('dextera-fold3d',f?'1':'');}catch(e){}};
 try{set(!!localStorage.getItem('dextera-fold3d'));}catch(e){}
 b.addEventListener('click',()=>set(!w.classList.contains('fold')));});
