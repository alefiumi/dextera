/* Prototipo: atlante 3D in stile cartoon a strati sovrapponibili (ossa, muscoli, legamenti, sistema nervoso, vasi, visceri),
   con reperi e aree di origine e inserzione. Modello e nomi: Z-Anatomy (CC BY-SA 4.0) e Terminologia Anatomica 2. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';

const $=id=>document.getElementById(id);
const view=$('view');

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
view.appendChild(renderer.domElement);
const effect=new OutlineEffect(renderer,{defaultThickness:0.003,defaultColor:[0.23,0.2,0.16],defaultAlpha:1});
let outline=true;

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(30,1,0.03,20);
scene.add(camera);
// luce attaccata alla camera: l'ombra cartoon resta coerente mentre si ruota
scene.add(new THREE.HemisphereLight(0xffffff,0x9a8f80,1.5));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-0.6,0.9,1.2);camera.add(sun);

// tre toni netti: è questo che dà l'effetto cartoon
const ramp=new THREE.DataTexture(new Uint8Array([120,120,120,255, 200,200,200,255, 255,255,255,255]),3,1,THREE.RGBAFormat);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
const colMat=new Map();
// thin = senza contorno: su nervi e vasi, che sono tubi sottili, il contorno coprirebbe il colore
const toon=(c,thin=false)=>{const k=c+(thin?'t':'');if(!colMat.has(k)){const m=new THREE.MeshToonMaterial({color:c,gradientMap:ramp});if(thin)m.userData.outlineParameters={visible:false};colMat.set(k,m);}return colMat.get(k);};
const M_SEL=toon(0x7dd3fc),M_O=toon(0x2563eb),M_E=toon(0xea580c);
// ossa trasparenti, per vedere gli strati che stanno dentro
const M_GHOST=new THREE.MeshToonMaterial({color:0xefe6d2,gradientMap:ramp,transparent:true,opacity:0.16,depthWrite:false});
M_GHOST.userData.outlineParameters={visible:false};

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.12;controls.rotateSpeed=0.9;controls.zoomSpeed=1.1;
controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};

/* ---------- dati e nomi ---------- */
const DATA=await fetch('dati.json').then(r=>r.json());
const baseOf=n=>n.replace(/\.(?:[oe]\d*[rl]|[rl]|[a-z])$/,'');
const sideOf=n=>(n.match(/\.(?:[oe]\d*)?([rl])$/)||[,''])[1];
// origine o inserzione: dai dati (corretti dove la fonte li scambia), altrimenti dal suffisso del nome
const KIND={};for(const d of Object.values(DATA.mus)){d.o.forEach(n=>KIND[n]='o');d.e.forEach(n=>KIND[n]='e');}
const kindOf=n=>KIND[n]||(n.match(/\.([oe])\d*[rl]$/)||[,''])[1];
const rootOf=b=>{b=b.replace(/^\(|\)$/g,'').replace(/['*]/g,'');const m=b.match(/^(.*?\b(?:head|part|belly|tendon|slip|layer|fibres|portion) of )(.+)$/);if(m)b=m[2];return b.replace(/ muscles?$/,'').trim().toLowerCase();};
const itOf=b=>(DATA.names[b]||[b])[0];
const laOf=b=>(DATA.names[b]||[,''])[1];
const sideName=s=>s==='r'?'destro':s==='l'?'sinistro':'';

/* ---------- strati ---------- */
// interruttore -> file che lo contiene, nome, colore di base (null = colore per gruppo)
const LAYERS={
 ossa:{file:'ossa',n:'Ossa',c:0xefe6d2},
 muscoli:{file:'muscoli',n:'Muscoli',c:0xc8553d},
 fasce:{file:'muscoli',n:'Fasce, tendini e borse',c:0xe9dcc9},
 legamenti:{file:'legamenti',n:'Legamenti e articolazioni',c:0xdfe8ee},
 inserzioni:{file:'inserzioni',n:'Aree di origine e inserzione',c:0x2563eb},
 encefalo:{file:'encefalo',n:'Encefalo',c:null},
 midollo:{file:'midollo',n:'Midollo spinale',c:0xf0d98a},
 nervi:{file:'nervi',n:'Nervi',c:0xf2c200},
 meningi:{file:'meningi',n:'Meningi',c:0xd9d2c3},
 sensi:{file:'sensi',n:'Occhio e orecchio',c:null},
 vasi:{file:'vasi',n:'Vasi sanguigni',c:null},
 visceri:{file:'visceri',n:'Visceri',c:null}};
const V={};for(const k in LAYERS)V[k]=false;
const FILES={};   // file -> {promise, loaded}
const meshes=[];  // tutte le parti caricate
const byName=new Map();
// colore pastello stabile per gruppo (lobi dell'encefalo, organi…), con alcune scelte fisse
const FIX={'Frontal lobe':0xf2a694,'Parietal lobe':0xf2d58a,'Temporal lobe':0xa3d69a,'Occipital lobe':0xa9d3f0,'Limbic lobe':0xc7a6e8,'Insula':0xf0a8c0,'Cerebellum':0xc9a0e6,
 'Cartilage':0xb8d8e6,'Ligament':0xdfe8ee,'Articular capsule':0xcfdbe3,'Bone':0xefe6d2,'White matter':0xf3efe6,'LCR':0x8fd0ea,
 // strutture profonde dell'encefalo: un colore ciascuna, per distinguerle nella scomposizione e nelle sezioni
 'Caudate nucleus':0xf5a623,'Putamen':0xe07b39,'Lentiform nucleus':0xeaa06a,'Globus pallidus':0xb94e1c,'Hippocampus':0x8e6bbf,'Amygdaloid body':0xd2384a,'Septal nuclei':0xd98bb5,
 // cuore e polmoni: cuore destro blu (sangue venoso), sinistro rosso; un colore per lobo
 'Right atrium':0x7fa6e3,'Right ventricle':0x9bbbeb,'Left atrium':0xe58a82,'Left ventricle':0xec9f97,
 'Superior lobe of right lung':0xf4b6c2,'Middle lobe of right lung':0xf7d08a,'Inferior lobe of right lung':0xb5d99c,'Superior lobe of left lung':0xa9cdee,'Inferior lobe of left lung':0xc9b3e6,
 'Trachea':0xe9dfc4,'Pleura':0xdce8f3,
 'Thalamus':0xf0a8c0,'Hypothalamus':0xf28b82,'Mamillary body':0xe0607a,'Fornix':0xc9a66b,'Corpus callosum':0xe9dcc0,'Red nucleus':0xc0392b,'Optic chiasm':0xf2c200,'Optic tract':0xf2c200};
function groupColor(u){
 const key=FIX[u.base]!==undefined?u.base:u.mat||u.g||u.base;
 if(FIX[u.base]!==undefined)return FIX[u.base];
 if(u.org==='vie')return 0xe9dfc4;if(u.org==='valvole')return /papillary/.test(u.base)?0xd46a6a:0xf3e1ae;
 if(u.layer==='vasi'){const s=(u.g+' '+u.base).toLowerCase();
  // circolo polmonare: le arterie portano sangue venoso (blu), le vene sangue ossigenato (rosso), come nei libri
  if(/pulmonary trunk|pulmonary arter|lobar artery|artery of (left|right) lung/.test(s)&&!/vein/.test(u.base.toLowerCase()))return 0x4a7fd4;
  if(/pulmonary vein|vein of (left|right) lung/.test(u.base.toLowerCase()))return 0xd9483b;
  return /vein|venous|vena|sinus/.test(s)?0x4a7fd4:0xd9483b;}
 if(FIX[key]!==undefined)return FIX[key];
 let h=0;for(const ch of key)h=(h*31+ch.charCodeAt(0))>>>0;
 return new THREE.Color().setHSL((h%360)/360,0.55,0.74).getHex();
}
// parti da sostituire con la copia speculare dell'altro lato (correzioni alla fonte: testi/correzioni.json, tipo specchia)
const MIRROR_FIX=DATA.specchia||{};
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
function loadFile(file){
 if(!FILES[file])FILES[file]={promise:new Promise((ok,ko)=>loader.load(file+'.glb',g=>{
  g.scene.traverse(o=>{
   if(!o.isMesh)return;o.geometry.computeVertexNormals();
   const name=o.userData.name||o.name,inf=DATA.objs[name]||[file,'',''],base=baseOf(name); // il caricatore toglie punti e spazi da o.name: il nome vero resta in userData
   const u={name,base,side:sideOf(name),layer:inf[0],mat:inf[1],g:inf[2],kind:kindOf(name),root:inf[0]==='muscoli'||inf[0]==='inserzioni'?rootOf(base):''};
   const L=LAYERS[u.layer]||LAYERS[file];
   u.own=u.layer==='inserzioni'?(u.kind==='e'?M_E:M_O):toon(u.mat==='Cartilage'&&u.layer!=='meningi'?FIX.Cartilage:L.c!==null?L.c:groupColor(u),u.layer==='nervi'||u.layer==='vasi');
   u.org=organOf(u);if(u.org)u.own=u.base==='Pleura'?M_PLEURA:toon(groupColor(u),u.layer==='vasi');
   u.st=stratumOf(u);o.userData=u;o.material=u.own;meshes.push(o);byName.set(name,o);
  });
  scene.add(g.scene);
  // parti esportate con una trasformazione sbagliata (il corpo ciliare sinistro diventava un anello di 2 m):
  // le rifaccio come copia speculare della parte destra, che è corretta
  for(const [n,twin] of Object.entries(MIRROR_FIX)){const bad=byName.get(n),ok=byName.get(twin);if(!bad||!ok||bad.userData.fixed)continue;
   ok.updateWorldMatrix(true,false);const src=ok.geometry.attributes.position,geo=new THREE.BufferGeometry(),f=new Float32Array(src.count*3);
   for(let i=0;i<src.count;i++){f[i*3]=src.getX(i);f[i*3+1]=src.getY(i);f[i*3+2]=src.getZ(i);} // le posizioni compresse (interi) non reggono le coordinate del mondo
   geo.setAttribute('position',new THREE.BufferAttribute(f,3));if(ok.geometry.index)geo.setIndex(Array.from(ok.geometry.index.array));
   geo.applyMatrix4(ok.matrixWorld).applyMatrix4(new THREE.Matrix4().makeScale(-1,1,1));
   if(geo.index){const ix=geo.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}} // lo specchio inverte il verso delle facce
   geo.computeVertexNormals();bad.removeFromParent();bad.geometry=geo;bad.position.set(0,0,0);bad.rotation.set(0,0,0);bad.scale.set(1,1,1);bad.userData.fixed=true;scene.add(bad);}
  FILES[file].loaded=true;wakeHook();
  if(FILES.encefalo&&FILES.encefalo.loaded&&FILES.meningi&&FILES.meningi.loaded)makeShells();
  ok();
 },undefined,e=>{
  // non scaricato (di solito: senza rete e strato non ancora salvato sul dispositivo). Si dimentica il tentativo,
  // così con la rete si riprova; intanto si avvisa invece di restare su «Carico…».
  delete FILES[file];S.loading=false;loadFail(file);ko(e);
 }))};
 return FILES[file].promise;
}
function loadFail(file){
 let m=$('lfail');if(!m){m=document.createElement('div');m.id='lfail';m.setAttribute('role','status');$('view').appendChild(m);}
 const off=!navigator.onLine;
 m.textContent=off?'Questo strato non è ancora salvato sul dispositivo: serve la connessione una volta. L\'app lo salva da sola appena torna la rete.'
  :'Non riesco a caricare questo strato: riprova tra poco.';
 m.hidden=false;clearTimeout(loadFail.t);loadFail.t=setTimeout(()=>{m.hidden=true;},7000);
 panel();
}

/* ---------- reperi: punta della linea di richiamo dell'etichetta nella fonte ---------- */
// i reperi delle ossa di destra valgono anche a sinistra: il modello è simmetrico
const LMS=[];
DATA.lm.forEach(([b,parent,p,d],i)=>{
 LMS.push({id:'r'+i,b,parent,p:new THREE.Vector3(...p),d:new THREE.Vector3(...d)});
 if(sideOf(parent)==='r')LMS.push({id:'l'+i,b,parent:parent.replace(/r$/,'l'),p:new THREE.Vector3(-p[0],p[1],p[2]),d:new THREE.Vector3(-d[0],d[1],d[2])});
});
const lmByParent=new Map();for(const l of LMS){if(!lmByParent.has(l.parent))lmByParent.set(l.parent,[]);lmByParent.get(l.parent).push(l);}
const MK={base:new THREE.MeshBasicMaterial({color:0x0f766e}),sel:new THREE.MeshBasicMaterial({color:0xfacc15})};
for(const k in MK)MK[k].userData.outlineParameters={visible:false};
const ball=new THREE.SphereGeometry(1,14,10);
const markers=new THREE.Group();scene.add(markers);
function markerOf(l){
 if(!l.mesh){l.mesh=new THREE.Mesh(ball,MK.base);l.mesh.position.copy(l.p).addScaledVector(l.d,0.001);markers.add(l.mesh);}
 return l.mesh;
}

/* ---------- muscoli: punti di origine (blu) e inserzione (arancione) uniti da una linea viola ---------- */
// il punto è il centro dell'area di origine o di inserzione della fonte, portato sulla sua superficie
const PL={o:new THREE.MeshBasicMaterial({color:0x2563eb,depthTest:false}),e:new THREE.MeshBasicMaterial({color:0xea580c,depthTest:false}),
 line:new THREE.MeshBasicMaterial({color:0x7c3aed,transparent:true,opacity:0.85,depthTest:false})};
for(const k in PL)PL[k].userData.outlineParameters={visible:false};
const cyl=new THREE.CylinderGeometry(1,1,1,8,1,true);
const pts=new THREE.Group();scene.add(pts);
const areaPt=new Map();
function areaPoint(m){
 if(areaPt.has(m))return areaPt.get(m);
 m.updateWorldMatrix(true,false);
 const a=m.geometry.attributes.position,v=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<a.count;i++)c.add(v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld));
 c.divideScalar(a.count);
 let best=c,bd=Infinity;
 for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);const d=v.distanceToSquared(c);if(d<bd){bd=d;best=v.clone();}}
 areaPt.set(m,best);return best;
}
function drawPoints(roots,side){
 while(pts.children.length)pts.remove(pts.children[0]);
 const out=[];
 for(const r of roots){
  const d=DATA.mus[r];if(!d)continue;
  const get=k=>d[k].filter(n=>!sideOf(n)||sideOf(n)===side).map(n=>byName.get(n)).filter(Boolean).map(areaPoint);
  const O=get('o'),E=get('e');
  const dot=(p,k)=>{const m=new THREE.Mesh(ball,PL[k]);m.position.copy(p);m.renderOrder=11;m.userData.dot=1;pts.add(m);out.push({p,k,r});};
  O.forEach(p=>dot(p,'o'));E.forEach(p=>dot(p,'e'));
  if(!O.length||!E.length)continue;
  const near=(p,L)=>L.reduce((a,b)=>a.distanceTo(p)<b.distanceTo(p)?a:b);
  const seg=new Set(),line=(a,b)=>{const k=a.toArray()+'|'+b.toArray();if(seg.has(k))return;seg.add(k);
   const m=new THREE.Mesh(cyl,PL.line),dd=b.clone().sub(a);m.position.copy(a).addScaledVector(dd,0.5);
   m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dd.clone().normalize());m.userData.len=dd.length();m.renderOrder=10;pts.add(m);};
  O.forEach(p=>line(p,near(p,E)));E.forEach(p=>{if(![...seg].some(s=>s.endsWith(p.toArray()+'')))line(near(p,O),p);});
 }
 return out;
}
// reperi della fonte vicini a un punto (entro 2,5 cm), per dare un nome alle zone di origine e inserzione
function lmNear(p,max=0.025){let best=null,bd=max;for(const l of LMS){const d=l.p.distanceTo(p);if(d<bd){bd=d;best=l;}}return best;}

/* ---------- gruppi di muscoli e nomi comuni ---------- */
// gruppi di muscoli (nome, muscoli, vista dell'inserzione, testo): testi/gruppi.json (gruppo.muscoli.*), in dati.json
const COMBO=DATA.combo;
// abbreviazioni e nomi comuni -> nome inglese di un repere o di una parte, muscolo (mu:) o gruppo (#)
const SYN={'sias':['Anterior superior iliac spine'],'asis':['Anterior superior iliac spine'],'siai':['Anterior inferior iliac spine'],'aiis':['Anterior inferior iliac spine'],
 'sips':['Posterior superior iliac spine'],'psis':['Posterior superior iliac spine'],'sipi':['Posterior inferior iliac spine'],'piis':['Posterior inferior iliac spine'],
 "zampa d'oca":['#zampa','Anserine bursa'],'pes anserinus':['#zampa'],'anserin':['#zampa','Anserine bursa'],'ischiocrurali':['#ischio'],'hamstring':['#ischio'],'flessori del ginocchio':['#ischio'],
 'cuffia dei rotatori':['#cuffia'],'rotatori della spalla':['#cuffia'],'tricipite della sura':['#sura'],'polpaccio':['#sura'],'achille':['#sura','Calcaneal tuberosity'],
 'quadricipite':['#quadricipite'],'scm':['mu:sternocleidomastoid'],'scom':['mu:sternocleidomastoid'],'tfl':['mu:tensor fasciae latae'],'tensore':['mu:tensor fasciae latae'],
 'gerdy':['Tubercle of iliotibial tract'],'lister':['Dorsal radial tubercle'],'louis':['Sternal angle'],'angolo di louis':['Sternal angle'],'pomo d\'adamo':['Laryngeal prominence'],
 'epitroclea':['Medial epicondyle of humerus'],'tabacchiera':['Scaphoid bone'],'astragalo':['Talus'],'perone':['Fibula'],'rotula':['Patella'],'scafoide':['Scaphoid bone','Navicular bone'],
 'piramidale':['Triquetrum bone'],'semilunare':['Lunate bone'],'uncinato':['Hamate bone'],'capitato':['Capitate bone'],'epistrofeo':['Axis (C2)'],'dente':['Dens axis'],
 'broca':['Opercular part of inferior frontal gyrus','Triangular part of inferior frontal gyrus'],'wernicke':['Superior temporal gyrus (Lateral part)','Temporal plane'],
 'rolando':['Central sulcus'],'silvio':['Lat_Fis-post','Aqueduct of midbrain'],'heschl':['Transverse temporal gyri'],'amigdala':['Amygdaloid body'],'corteccia motoria':['Precentral gyrus'],
 'corteccia sensitiva':['Postcentral gyrus'],'area visiva':['Calcarine sulcus'],'fusiforme':['Lateral occipitotemporal gyrus'],'nuclei della base':['Caudate nucleus','Putamen','Globus pallidus'],
 'tricuspide':['Septal leaflet of right atrioventricular valve'],'mitrale':['Posterior leaflet of left atrioventricular valve'],'bicuspide':['Posterior leaflet of left atrioventricular valve'],
 'valvola aortica':['Left coronary leaflet','Right coronary leaflet','Non-coronary leaflet'],'valvola polmonare':['Anterior semilunar leaflet of pulmonary valve'],
 'discendente anteriore':['Anterior interventricular artery'],'iva':['Anterior interventricular artery'],'circonflessa':['Circumflex artery of heart'],'carena':['Trachea'],
 'lingula':['Superior lobe of left lung'],'cuore':['Right ventricle','Left ventricle','Right atrium','Left atrium'],'botallo':['Pulmonary trunk'],
 'dura madre':['~dura','Falx cerebri','Tentorium cerebelli'],'aracnoide':['~aracnoide'],'falce':['Falx cerebri'],'tentorio':['Tentorium cerebelli']};
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’`´]/g,"'").trim();

/* ---------- apparato cardiovascolare (cuore e vasi) e respiratorio (polmoni) ---------- */
// le stesse regole di organo() in build/torace.py e in build/proietta_2d.mjs (che fanno il 2D): tenerle uguali
const CUORE_G=new Set(['Heart','Right ventricle','Left ventricle','Aortic valve','Pulmonary valve','Right atrioventricular valve','Arteries of heart','Left coronary artery','Right coronary artery','Anterior interventricular artery','Cardiac veins','Coronary sinus']);
const GRANDI=new Set(['Ascending aorta','Aortic arch','Thoracic aorta','Brachiocephalic trunk','Left common carotid artery','Left subclavian artery','Superior vena cava','Inferior vena cava (thoracic part)','Left brachiocephalic vein','Right brachiocephalic vein','Azygos vein']);
const PGRANDI=new Set(['Pulmonary trunk','Bifurcation of pulmonary trunk','Left pulmonary artery','Right pulmonary artery','Left superior pulmonary vein','Left inferior pulmonary vein','Right superior pulmonary vein','Right inferior pulmonary vein']);
const VALV_G=new Set(['Aortic valve','Pulmonary valve','Right atrioventricular valve']);
const VENA=/vein|venous|vena|sinus|plexus/i;
const isVein=u=>VENA.test(u.base+' '+u.g);
function organOf(u){
 const b=u.base;if(b.startsWith('?'))return null;
 if(u.layer==='vasi'){
  if(VALV_G.has(u.g)||/papillary/.test(b))return 'valvole';
  if(u.g==='Heart')return 'cuore';
  if(CUORE_G.has(u.g)||/^(Coronary sinus|Left coronary artery|Right coronary artery)$/.test(b))return 'coronarie';
  if(GRANDI.has(b))return 'grandi';
  if(PGRANDI.has(b))return 'pgrandi';
  if(/of (left|right) lung|lobar artery/.test(b))return 'vpolm';
  return isVein(u)?'vene':'arterie';
 }
 if(u.layer==='visceri'){
  if(b==='Pleura')return 'pleura';
  if(u.g==='Left lung'||u.g==='Right lung')return 'polmoni';
  if(b==='Trachea'||/bronch/i.test(b))return 'vie';
 }
 return null;
}
// che cosa è una parte, nel pannello
const ORGN={cuore:'Cuore',valvole:'Valvola o muscolo papillare',coronarie:'Vaso del cuore',grandi:'Grande vaso',pgrandi:'Vaso polmonare',vpolm:'Vaso polmonare',
 arterie:'Arteria',vene:'Vena',polmoni:'Polmone',vie:'Vie aeree',pleura:'Pleura'};
// i due apparati: strati (che parti mostrano), viste pronte, inquadratura. Strato = funzione della parte
// nomi e testi degli strati dei due apparati: testi/gruppi.json (gruppo.strato-cuore.*, gruppo.strato-polmoni.*), in DATA.sistemi
const SY=DATA.sistemi||{},TC=k=>SY.cuore?.[k]||{n:k,t:''},TP=k=>SY.polmoni?.[k]||{n:k,t:''};
const SYS={
 cuore:{n:'Cuore e vasi',ic:'🫀',fly:{tutto:'body',arterie:'body',vene:'body'},def:'tutto',
  L:{arterie:{...TC('arterie'),f:u=>u.org==='arterie'||(/grandi/.test(u.org)&&!isVein(u))},
   vene:{...TC('vene'),f:u=>u.org==='vene'||(/grandi/.test(u.org)&&isVein(u))},
   grandi:{...TC('grandi'),f:u=>/grandi/.test(u.org)},
   cuore:{...TC('cuore'),f:u=>u.org==='cuore'},
   coronarie:{...TC('coronarie'),f:u=>u.org==='coronarie'},
   valvole:{...TC('valvole'),f:u=>u.org==='valvole'}},
  P:{tutto:['arterie','vene','cuore','coronarie'],arterie:['arterie','cuore','coronarie'],vene:['vene','cuore','coronarie'],base:['grandi','cuore','coronarie'],solo:['cuore','coronarie'],dentro:['coronarie','valvole']},
  PN:{tutto:'Tutto il sistema',arterie:'Solo arterie',vene:'Solo vene',base:'Cuore e grandi vasi',solo:'Solo il cuore',dentro:'Dentro il cuore'},
  box:u=>u.org==='cuore',note:'Forme dalla fonte (Z-Anatomy); il pericardio non c\'è e della valvola mitrale c\'è solo il lembo posteriore. Testi dei vasi principali scritti dall\'AI (da verificare); degli altri vasi, da dove nascono o dove sboccano secondo la fonte.'},
 polmoni:{n:'Polmoni',ic:'🫁',fly:{},def:'tutto',
  L:{pleura:{...TP('pleura'),f:u=>u.org==='pleura'},
   polmoni:{...TP('polmoni'),f:u=>u.org==='polmoni'},
   vie:{...TP('vie'),f:u=>u.org==='vie'},
   vasi:{...TP('vasi'),f:u=>u.org==='vpolm'||u.org==='pgrandi'}},
  P:{tutto:['polmoni','vie'],pleura:['pleura','polmoni','vie'],vasi:['vie','vasi'],vie:['vie']},
  PN:{tutto:'Lobi e trachea',pleura:'Con la pleura',vasi:'Bronchi e vasi',vie:'Albero bronchiale'},
  box:u=>u.org==='polmoni',note:'Forme dalla fonte (Z-Anatomy). Testi scritti dall\'AI: da verificare.'}};
const sysOf=org=>['polmoni','vie','pleura','vpolm'].includes(org)?'polmoni':'cuore';
const M_PLEURA=new THREE.MeshToonMaterial({color:0xdce8f3,gradientMap:ramp,transparent:true,opacity:0.35,depthWrite:false});M_PLEURA.userData.outlineParameters={visible:false};
const sysBox={};
const boxSys=k=>sysBox[k]||(sysBox[k]=boxOf(meshes.filter(m=>m.userData.org&&SYS[k].box(m.userData))));

/* ---------- encefalo: strati dalla dura madre ai ventricoli ---------- */
// strati dell'encefalo, dalla dura madre ai ventricoli (nome e testo): testi/gruppi.json (gruppo.strato-encefalo.*), in dati.json
const ST=DATA.strati;
const CORTEX=['Frontal lobe','Parietal lobe','Temporal lobe','Occipital lobe','Limbic lobe','Insula','Interlobar sulci','Inferior frontal sulcus','Cerebellum'];
function stratumOf(u){
 if(u.layer==='meningi')return u.base==='Choroid plexus'?6:u.base==='Cranial arachnoid mater'?1:0;
 if(u.layer!=='encefalo')return -1;
 const b=u.base;
 if(u.mat==='LCR')return 8;
 if(b==='Lentiform nucleus')return 3; // contiene putamen e globo pallido: va via con la sostanza bianca per lasciarli vedere
 if(/^(Caudate nucleus|Putamen)$/.test(b))return 4;
 if(/^(Globus pallidus|Hippocampus|Amygdaloid body|Septal nuclei|Fornix|Stria terminalis|Hippocampal commissure)$/.test(b))return 5;
 if(/^(White matter of telencephalon|Corpus callosum|Anterior commissure|Septum pellucidum)$/.test(b))return 3;
 if(u.g==='Diencephalon'||u.g==='White matter of diencephalon')return 6;
 if(CORTEX.includes(u.g))return 2;
 if(u.g==='Anterior segment of eyeball')return 0;
 return 7;
}
// dura madre e aracnoide craniche non sono nella fonte: le genero avvolgendo la corteccia (forma schematica)
DATA.names['Cranial dura mater']=['Dura madre cranica','Dura mater cranialis'];
DATA.names['Cranial arachnoid mater']=['Aracnoide cranica','Arachnoidea mater cranialis'];
DATA.desc=DATA.desc||{};
DATA.desc['Cranial dura mater']=ST[0].t+' Forma schematica generata dall\'app attorno all\'encefalo: non viene dalla fonte.';
DATA.desc['Cranial arachnoid mater']=ST[1].t+' Forma schematica generata dall\'app attorno all\'encefalo: non viene dalla fonte.';
function makeShells(){
 if(byName.has('~dura'))return;
 const src=meshes.filter(m=>m.userData.layer==='encefalo'&&m.userData.st===2);if(!src.length)return;
 const c=boxOf(src).getCenter(new THREE.Vector3()),NU=96,NV=48,R=new Float32Array(NU*NV),v=new THREE.Vector3();
 const bin=(x,y,z,r)=>{const iu=Math.floor((Math.atan2(z,x)/(2*Math.PI)+0.5)*NU)%NU,iv=Math.min(NV-1,Math.floor(Math.acos(THREE.MathUtils.clamp(y/r,-1,1))/Math.PI*NV));return iv*NU+iu;};
 for(const m of src){m.updateWorldMatrix(true,false);const a=m.geometry.attributes.position;
  for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).sub(c);const r=v.length();const k=bin(v.x,v.y,v.z,r);if(r>R[k])R[k]=r;}}
 const nb=(k,f)=>{const iu=k%NU,iv=(k-iu)/NU;for(let dv=-1;dv<=1;dv++)for(let du=-1;du<=1;du++){const jv=iv+dv;if(jv<0||jv>=NV)continue;f(jv*NU+(iu+du+NU)%NU);}};
 for(let pass=0,empty=1;empty&&pass<200;pass++){empty=0;const T=R.slice();for(let k=0;k<R.length;k++)if(!R[k]){let s=0,n=0;nb(k,j=>{if(T[j]){s+=T[j];n++;}});if(n)R[k]=s/n;else empty=1;}}
 {const T=R.slice();for(let k=0;k<R.length;k++)nb(k,j=>{if(T[j]>R[k])R[k]=T[j];});}       // chiude i solchi
 for(let pass=0;pass<3;pass++){const T=R.slice();for(let k=0;k<R.length;k++){let s=0,n=0;nb(k,j=>{s+=T[j];n++;});R[k]=s/n;}} // leviga
 const at=(x,y,z)=>{const r=Math.hypot(x,y,z),fu=(Math.atan2(z,x)/(2*Math.PI)+0.5)*NU-0.5,fv=Math.acos(THREE.MathUtils.clamp(y/r,-1,1))/Math.PI*NV-0.5;
  const u0=Math.floor(fu),v0=Math.max(0,Math.min(NV-2,Math.floor(fv))),a=fu-u0,b=Math.max(0,Math.min(1,fv-v0)),g=(u,w)=>R[w*NU+((u%NU)+NU)%NU];
  return (g(u0,v0)*(1-a)+g(u0+1,v0)*a)*(1-b)+(g(u0,v0+1)*(1-a)+g(u0+1,v0+1)*a)*b;};
 const shell=(name,base,off,mat)=>{
  const geo=new THREE.SphereGeometry(1,128,64),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const r=at(v.x,v.y,v.z)+off;v.multiplyScalar(r).add(c);p.setXYZ(i,v.x,v.y,v.z);}
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat);m.userData={name,base,side:'',layer:'meningi',mat:'',g:'Cranial meninges',kind:'',root:'',own:mat};m.userData.st=stratumOf(m.userData);
  scene.add(m);meshes.push(m);byName.set(name,m);return m;};
 const ara=new THREE.MeshToonMaterial({color:0xdce8f3,gradientMap:ramp,transparent:true,opacity:0.55,depthWrite:false});ara.userData.outlineParameters={visible:false};
 shell('~aracnoide','Cranial arachnoid mater',0.0012,ara).renderOrder=2;
 shell('~dura','Cranial dura mater',0.0028,new THREE.MeshToonMaterial({color:0xcbb59a,gradientMap:ramp})); // fuori da colMat: nelle sezioni resta a una faccia, così l'interno non copre il taglio
}
// piani di sezione: si taglia tutta la scena con un piano che attraversa l'encefalo
const cutPlane=new THREE.Plane(),AX={axial:{n:[0,-1,0],i:1,v:'top',it:'Assiale'},coronal:{n:[0,0,-1],i:2,v:'front',it:'Coronale'},sagittal:{n:[1,0,0],i:0,v:'right',it:'Sagittale'}};
let brainBox=null;

/* ---------- camera ---------- */
let center=new THREE.Vector3(0,0.85,0),height=1.75;
const DIR={front:[0,0,1],back:[0,0,-1],right:[-1,0,0],left:[1,0,0],top:[0,1,0.001]};
let tween=null;
function fitDist(){const v=THREE.MathUtils.degToRad(camera.fov)/2,h=height*0.56/Math.tan(v);return Math.max(h,h/Math.min(1,camera.aspect*1.9));}
function setView(name,anim=true){
 // da lontano (o all'avvio) inquadra tutto il corpo; da vicino gira attorno al punto che si sta guardando
 const t=controls.target.clone(),d0=camera.position.distanceTo(t),far=d0>fitDist()*0.8||d0<0.1;
 const c=far?center.clone():t,dist=far?fitDist():d0;
 flyTo(c.clone().add(new THREE.Vector3(...DIR[name]).normalize().multiplyScalar(dist)),c,anim);
}
// vista iniziale: tutto il corpo da davanti, come all'apertura (pulsante ⟲)
function homeView(){flyTo(center.clone().add(new THREE.Vector3(0,0,fitDist())),center.clone());}
function flyTo(pos,target,anim=true){
 if(!anim){camera.position.copy(pos);controls.target.copy(target);controls.update();return;}
 tween={p0:camera.position.clone(),t0:controls.target.clone(),p1:pos,t1:target,s:performance.now()};
}
// inquadra un insieme di parti guardandole da fuori (dall'asse del corpo verso l'esterno)
function frameBox(box,minDist=0.25){
 const c=box.getCenter(new THREE.Vector3()),r=box.getSize(new THREE.Vector3()).length()/2;
 const out=new THREE.Vector3(c.x-center.x,0,c.z-0.02);if(Math.abs(out.x)<0.03)out.set(0,0,out.z<-0.03?-1:1);out.normalize();
 const dist=Math.max(minDist,r*1.35/Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/Math.min(1,camera.aspect));
 flyTo(c.clone().addScaledVector(out,dist).add(new THREE.Vector3(0,r*0.25,0)),c);
}
const boxOf=list=>{const b=new THREE.Box3();list.forEach(o=>b.expandByObject(o));return b;};

/* ---------- stato ---------- */
// part = parte selezionata; lm = repere; mus = muscolo aperto (radice del nome) sul lato side; bones = on | ghost | off
// combo = gruppo di muscoli aperto (zampa d'oca…); mv = vista del muscolo: both | shape | lines
// cut = piano di sezione {ax, t}; lev = strati dell'encefalo tolti (0 = tutti presenti)
const S={on:{cuore:false,polmoni:false},solo:null,lay:Object.fromEntries(Object.entries(SYS).map(([k,x])=>[k,Object.fromEntries(Object.keys(x.L).map(l=>[l,x.P[x.def].includes(l)]))])),cutOn:'brain',part:null,lm:null,mus:null,combo:null,side:'r',bones:'on',allLm:false,list:null,q:'',mv:'both',cut:{ax:null,t:0.5},lev:0};
let GAME=null; // partita in corso (gioco Trova la struttura nel 3D)
const musOf=m=>m&&m.userData.root&&DATA.mus[m.userData.root]?m.userData.root:null;
const roots=()=>S.combo?COMBO[S.combo].mus:S.mus?[S.mus]:[];
// parti del muscolo aperto: le sue forme e le sue aree (anche quelle condivise, come il tendine del quadricipite)
function inFocus(m){
 const u=m.userData,rs=roots();if(!rs.length||(u.side&&u.side!==S.side))return false;
 if(u.layer==='muscoli')return rs.includes(u.root);
 if(u.layer==='inserzioni')return rs.some(r=>{const d=DATA.mus[r];return d&&(d.o.includes(u.name)||d.e.includes(u.name));});
 return false;
}
function visible(m){
 const u=m.userData;if(u.hidden)return false;
 // "Solo questo": resta solo l'encefalo o un apparato, tutto il resto (scheletro, muscoli, altri strati) sparisce
 if(S.solo==='brain'&&u.layer!=='encefalo'&&u.layer!=='meningi')return false;
 if(SYS[S.solo]&&!(u.org&&sysOf(u.org)===S.solo))return false;
 if(u.layer==='ossa')return S.bones!=='off';
 if(u.org&&S.on[sysOf(u.org)]){const k=sysOf(u.org),X=SYS[k],on=S.lay[k];return Object.keys(X.L).some(l=>on[l]&&X.L[l].f(u));}
 if(S.lev&&u.st>=0&&u.st<S.lev)return false;
 return V[u.layer]||(inFocus(m)&&S.mv!=='lines'&&!(S.mv==='areas'&&u.layer==='muscoli')); // areas: solo aree e linee, senza la forma (gioco)
}
let wakeHook=()=>{};
function refresh(noPanel){
 wakeHook();
 const rs=roots();
 if(rs.length&&S.mv!=='shape')S.pts=drawPoints(rs,S.side);else{while(pts.children.length)pts.remove(pts.children[0]);S.pts=[];}
 for(const m of meshes){
  m.visible=visible(m);
  // parte nascosta: la sua copia nella memoria grafica si libera (si ricarica da sola, dai dati in memoria, quando torna visibile)
  if(!m.visible){if(m.userData.gpu){m.geometry.dispose();m.userData.gpu=false;}continue;}
  m.userData.gpu=true;
  const u=m.userData;
  m.material=m===S.part?M_SEL:u.layer==='ossa'&&S.bones==='ghost'?M_GHOST:u.layer==='muscoli'&&inFocus(m)?M_SEL:u.own;
 }
 // reperi: quelli dell'osso selezionato (o tutti, se richiesto) e quello aperto
 const want=new Set();
 if(S.bones==='on'&&!S.solo){
  if(S.allLm)LMS.forEach(l=>want.add(l));
  const bone=S.part&&S.part.userData.layer==='ossa'?S.part.userData.name:S.lm?S.lm.parent:null;
  if(bone)(lmByParent.get(bone)||[]).forEach(l=>want.add(l));
 }
 if(S.lm)want.add(S.lm);
 for(const l of LMS){if(!want.has(l)){if(l.mesh)l.mesh.visible=false;continue;}const k=markerOf(l);k.visible=true;k.material=l===S.lm?MK.sel:MK.base;}
 applyCut();
 if(!noPanel)panel();
}
function applyCut(){
 const box=SYS[S.cutOn]?boxSys(S.cutOn):S.cutOn==='body'?bodyBox():brainBox,ax=S.cut.ax&&box?AX[S.cut.ax]:null;
 if(ax){const p=box.min.clone().lerp(box.max,S.cut.t),n=new THREE.Vector3(...ax.n);cutPlane.setFromNormalAndCoplanarPoint(n,p);renderer.clippingPlanes=[cutPlane];}
 else renderer.clippingPlanes=[];
 // con il taglio si vede anche l'interno delle superfici: la sezione sembra piena
 const side=ax?THREE.DoubleSide:THREE.FrontSide;
 for(const m of [...colMat.values(),M_SEL,M_O,M_E])m.side=side;
}
const pickables=()=>meshes.filter(m=>m.visible&&!(m.userData.layer==='ossa'&&S.bones==='ghost'));

/* ---------- pannello ---------- */
const chip=(cls,attr,txt,small='')=>`<button class="chip ${cls}" ${attr}>${txt}${small?` <small>${small}</small>`:''}</button>`;
const FONTE='<p class="note">Modello: Z-Anatomy (CC BY-SA 4.0), derivato da BodyParts3D © DBCLS. Nomi: Terminologia Anatomica 2.</p>';
const TIPO={ossa:'Osso',muscoli:'Muscolo',fasce:'Fascia, tendine o borsa',legamenti:'Legamento o articolazione',inserzioni:'Area di inserzione',encefalo:'Encefalo',midollo:'Midollo spinale',
 nervi:'Nervo',meningi:'Meninge',sensi:'Organo di senso',vasi:'Vaso sanguigno',visceri:'Viscere'};
const AI='<p class="note">Testo scritto dall\'AI: da verificare su un atlante.</p>';
const descOf=b=>DATA.desc&&DATA.desc[b];
// viste del muscolo e reperi vicini ai punti di origine e inserzione
function musTools(){
 const on=(k,t)=>`<button class="chip${S.mv===k?' on':''}" data-mv="${k}">${t}</button>`;
 const near=[];for(const q of S.pts||[]){const l=lmNear(q.p);if(l&&!near.some(x=>x[0]===l&&x[1]===q.k))near.push([l,q.k]);}
 return `<div class="sub">Vista</div><div class="chips">${on('both','Entrambe')}${on('shape','Forma e aree')}${on('lines','Punti e linee')}</div>`+
  (near.length?`<div class="sub">Reperi vicini ai punti</div><div class="chips">${near.map(([l,k])=>chip(k==='o'?'o':'i',`data-lm="${l.id}"`,itOf(l.b),k==='o'?'origine':'inserzione')).join('')}</div>`:'');
}
function panel(){
 const p=$('panel');let h='';
 const bz=$('busy');if(bz)bz.hidden=!S.loading; // satellite che gira al centro del modello mentre si carica uno strato
 if(GAME){p.innerHTML=gamePanel();return;}
 if(S.combo){
  const c=COMBO[S.combo];
  h=`<div class="kick">Gruppo di muscoli</div><div class="h">${c.n} <i>lato ${sideName(S.side)}</i></div><div class="mut"><i>${c.la}</i></div><p>${c.t}</p>
   <div class="chips">${c.mus.map(r=>chip('',`data-mu="${r}"`,DATA.mus[r].n.replace(/^Muscol[oi] /,''))).join('')}</div>`+musTools()+
   `<div class="chips"><button class="chip" data-side="${S.side==='r'?'l':'r'}">Lato ${S.side==='r'?'sinistro':'destro'}</button><button class="chip" data-go="home">Chiudi</button></div>`+AI;
 }else if(S.mus){
  const m=DATA.mus[S.mus],c=m.card,has=k=>m[k].some(n=>sideOf(n)===S.side);
  h=`<div class="kick">Muscolo</div><div class="h">${m.n} <i>${sideName(S.side)}</i></div><div class="mut"><i>${m.la}</i></div>`+
   (m.parts.length>1?`<div class="row"><b>Parti</b>: ${m.parts.map(itOf).join(' · ')}</div>`:'')+
   `<div class="row"><span class="tg o">ORIGINE</span> ${c?c.ot:has('o')?'area blu sul modello':'non indicata nella fonte'}</div>
    <div class="row"><span class="tg i">INSERZIONE</span> ${c?c.it:has('e')?'area arancione sul modello':'non indicata nella fonte'}</div>`+
   (c?`<div class="row"><b>Azione</b>: ${c.a}</div><div class="row"><b>Innervazione</b>: ${c.nv}</div>${c.nota?`<p class="mut">${c.nota}</p>`:''}<p class="note">I testi di origine, inserzione, azione e innervazione sono scritti dall'AI: da verificare su un atlante. Le aree colorate sul modello vengono dalla fonte.</p>`
     :'<p class="mut">Per questo muscolo non c\'è ancora il testo con azione e innervazione.</p>')+
   (m.fix?'<p class="note">Nella fonte origine e inserzione di questo muscolo erano scambiate: qui sono corrette.</p>':'')+musTools()+
   `<div class="chips"><button class="chip" data-side="${S.side==='r'?'l':'r'}">Lato ${S.side==='r'?'sinistro':'destro'}</button><button class="chip" data-go="muscles">Tutti i muscoli</button><button class="chip" data-go="home">Chiudi</button></div>`;
 }else if(S.lm){
  const l=S.lm;
  const t=descOf(l.b),mus=musclesAt(l);
  h=`<div class="kick">Repere</div><div class="h">${itOf(l.b)}</div><div class="mut"><i>${laOf(l.b)}</i> · ${l.b}</div><div class="row">Su: <b>${itOf(baseOf(l.parent))}</b> <i>${sideName(sideOf(l.parent))}</i></div>`+
   (t?`<p>${t}</p>`:'<p class="mut">La descrizione di questo repere non è ancora scritta.</p>')+
   (mus.length?`<div class="sub">Muscoli con origine o inserzione qui vicino</div><div class="chips">${mus.map(([r,k])=>chip(k==='o'?'o':'i',`data-mu="${r}"`,DATA.mus[r].n.replace(/^Muscol[oi] /,''),k==='o'?'origine':'inserzione')).join('')}</div>`:'')+
   (DATA.objs[l.parent]?'':'<p class="mut">La forma di questa parte non è nel modello (licenza non commerciale nella fonte): resta solo il punto.</p>')+
   `<div class="chips">${DATA.objs[l.parent]?`<button class="chip" data-part="${l.parent}">Vai all'osso</button>`:''}<button class="chip" data-go="home">Chiudi</button></div>`+(t?AI:'')+FONTE;
 }else if(S.part){
  const u=S.part.userData,ls=u.layer==='ossa'?(lmByParent.get(u.name)||[]):[],t=descOf(u.base),brain=u.layer==='encefalo'||u.layer==='meningi';
  h=`<div class="kick">Atlante 3D</div><div class="h">${itOf(u.base)} <i>${sideName(u.side)}</i></div><div class="mut"><i>${laOf(u.base)}</i> · ${u.base}</div>
   <div class="row">${u.org?(u.org==='vene'&&/sinus/i.test(u.base)?'Seno venoso':ORGN[u.org]):TIPO[u.layer]||''}${u.g&&u.g!=='Cranial meninges'&&!u.org?' · '+itOf(u.g):''}${u.layer==='inserzioni'?' · '+(u.kind==='o'?'origine':'inserzione'):''}${brain&&u.st>=0?' · strato: '+ST[u.st].n.toLowerCase():''}</div>`+
   (t?`<p>${t}</p>`:'')+
   (ls.length?`<div class="sub">Reperi su questa parte (${ls.length})</div><div class="chips">${ls.map(l=>chip('',`data-lm="${l.id}"`,itOf(l.b))).join('')}</div>`:'')+
   `<div class="chips">${musOf(S.part)?`<button class="chip on" data-mu="${musOf(S.part)}">Scheda del muscolo</button>`:''}${brain?'<button class="chip on" data-go="brain">🧠 Sezioni e strati</button>':''}${u.org?`<button class="chip on" data-sys="${sysOf(u.org)}">${SYS[sysOf(u.org)].ic} ${SYS[sysOf(u.org)].n}</button>`:''}<button class="chip" data-hide="1">Nascondi</button><button class="chip" data-go="layers">Strati</button><button class="chip" data-go="home">Chiudi</button></div>`+(t?AI:'')+FONTE;
 }else if(S.list==='brain'){
  const on=(v,attr,txt)=>`<button class="chip${v?' on':''}" ${attr}>${txt}</button>`;
  h=`<div class="kick">Atlante 3D · sezioni e strati</div><div class="h">🧠 Encefalo</div>${S.loading?'<p class="mut">Carico encefalo e meningi…</p>':''}
   <div class="sub">Sezione sui piani anatomici</div><div class="chips">${on(!S.cut.ax,'data-cut="none"','Nessuna')}${Object.entries(AX).map(([k,a])=>on(S.cut.ax===k,`data-cut="${k}"`,a.it)).join('')}</div>`+
   (S.cut.ax?`<input type="range" id="cutr" aria-label="Posizione del piano di taglio" min="0" max="1000" value="${Math.round(S.cut.t*1000)}" style="width:100%"><div class="mut">${S.cut.ax==='axial'?'Sposta il piano dal basso in alto':S.cut.ax==='coronal'?'Sposta il piano da dietro in avanti':'Sposta il piano da destra a sinistra'}. Si vede la parte ${S.cut.ax==='axial'?'inferiore, dall\'alto':S.cut.ax==='coronal'?'posteriore, da davanti':'sinistra, dal lato destro'}.</div>`:'')+
   `<div class="sub">Scomposizione: togli uno strato alla volta</div><input type="range" id="levr" aria-label="Strati dell'encefalo da togliere" min="0" max="${ST.length-1}" step="1" value="${S.lev}" style="width:100%">
   <div class="chips"><button class="chip" data-levd="-1">− Rimetti</button><button class="chip" data-levd="1">Togli +</button></div>
   <div id="levt" class="row">${levText()}</div>
   <div class="chips">${ST.map((s,i)=>chip(i===S.lev?'on':'',`data-lev="${i}"`,`${i+1}. ${s.n}`)).join('')}</div>
   <p class="note">Dura madre e aracnoide craniche hanno una forma schematica generata dall'app (la fonte ha solo falce e tentorio). Testi scritti dall'AI: da verificare.</p>
   <div class="chips">${soloBtn('brain','l\'encefalo')}<button class="chip" data-go="layers">Strati</button><button class="chip" data-go="home">Chiudi</button></div>`;
 }else if(SYS[S.list]){
  const K=S.list,X=SYS[K],on=S.lay[K],b=(v,attr,txt)=>`<button class="chip${v?' on':''}" ${attr}>${txt}</button>`;
  const cur=Object.entries(X.P).find(([,l])=>Object.keys(X.L).every(k=>on[k]===l.includes(k)));
  h=`<div class="kick">Atlante 3D · apparato</div><div class="h">${X.ic} ${X.n}</div>${S.loading?'<p class="mut">Carico il modello…</p>':''}
   <div class="sub">Viste pronte</div><div class="chips">${Object.keys(X.P).map(k=>b(cur&&cur[0]===k,`data-spre="${k}"`,X.PN[k])).join('')}</div>
   <div class="sub">Strati: accendi e spegni</div><div class="chips">${Object.entries(X.L).map(([k,l])=>b(on[k],`data-slay="${k}"`,l.n)).join('')}</div>
   <div class="mut">${Object.entries(X.L).filter(([k])=>on[k]).map(([,l])=>`<b>${l.n}</b>: ${l.t}`).join('<br>')}</div>
   <div class="sub">Sezione sui piani anatomici</div><div class="chips">${b(!S.cut.ax,'data-cut="none"','Nessuna')}${Object.entries(AX).map(([k,a])=>b(S.cut.ax===k,`data-cut="${k}"`,a.it)).join('')}</div>`+
   (S.cut.ax?`<input type="range" id="cutr" aria-label="Posizione del piano di taglio" min="0" max="1000" value="${Math.round(S.cut.t*1000)}" style="width:100%"><div class="mut">${S.cut.ax==='axial'?'Sposta il piano dal basso in alto':S.cut.ax==='coronal'?'Sposta il piano da dietro in avanti':'Sposta il piano da destra a sinistra'}.${S.list==='cuore'?' Con la sezione coronale si vedono le camere e le valvole.':''}</div>`:'')+
   `<p class="note">${X.note}</p>
   <div class="chips">${soloBtn(K,X.n.toLowerCase())}${Object.entries(SYS).filter(([k])=>k!==K).map(([k,x])=>`<button class="chip${S.on[k]?' on':''}" data-sys="${k}">${S.on[k]?'Insieme a: ':'Aggiungi '}${x.ic} ${x.n}</button>`).join('')}<button class="chip" data-sysoff="1">Esci da ${X.n.toLowerCase()}</button><button class="chip" data-go="layers">Strati</button><button class="chip" data-go="home">Chiudi</button></div>`;
 }else if(S.list==='layers'){
  const on=(v,attr,txt)=>`<button class="chip${v?' on':''}" ${attr}>${txt}</button>`,lay=k=>on(V[k],`data-layer="${k}"`,LAYERS[k].n);
  h=`<div class="kick">Atlante 3D</div><div class="h">🧩 Strati</div>${S.loading?'<p class="mut">Carico lo strato…</p>':''}
   <div class="sub">Ossa</div><div class="chips">${on(S.bones==='on','data-bones="on"','Visibili')}${on(S.bones==='ghost','data-bones="ghost"','Trasparenti')}${on(S.bones==='off','data-bones="off"','Nascoste')}${on(S.allLm,'data-lmt="1"','Tutti i reperi')}</div>
   <div class="sub">Apparato locomotore</div><div class="chips">${lay('muscoli')}${lay('fasce')}${lay('legamenti')}${lay('inserzioni')}</div>
   <div class="sub">Sistema nervoso</div><div class="chips">${lay('encefalo')}${lay('midollo')}${lay('nervi')}${lay('meningi')}${lay('sensi')}<button class="chip" data-go="brain">🧠 Sezioni e strati</button></div>
   <div class="sub">Altri sistemi</div><div class="chips">${lay('vasi')}${lay('visceri')}${Object.entries(SYS).map(([k,x])=>`<button class="chip${S.on[k]?' on':''}" data-systog="${k}">${x.ic} ${x.n}</button>`).join('')}</div><p class="mut">Strati e sezioni di cuore e polmoni: pulsanti 🫀 e 🫁 nella barra in alto.</p>
   ${offlineHtml()}
   <div class="chips"><button class="chip" data-go="home">Chiudi</button></div>`;
 }else if(S.list==='muscles'){
  const q=S.q.toLowerCase(),all=Object.entries(DATA.mus).filter(([r,m])=>!q||m.n.toLowerCase().includes(q)||r.includes(q)).sort((a,b)=>a[1].n.localeCompare(b[1].n));
  const gs=[...new Set(all.map(([,m])=>m.g))].sort((a,b)=>itOf(a).localeCompare(itOf(b)));
  h=`<div class="kick">Atlante 3D · ${all.length} muscoli</div><div class="h">💪 Muscoli</div><input id="q" placeholder="Cerca un muscolo…" value="${S.q}">`+
   gs.map(g=>`<div class="sub">${itOf(g)||'Altri'}</div><div class="chips">${all.filter(([,m])=>m.g===g).map(([r,m])=>chip('',`data-mu="${r}"`,m.n.replace(/^Muscol[oi] /,''))).join('')}</div>`).join('')+
   `<p class="note">Testi di origine, inserzione, azione e innervazione scritti dall'AI: da verificare su un atlante.</p><div class="chips"><button class="chip" data-go="home">Chiudi</button></div>`;
 }else if(S.list==='search'){
  const q=norm(S.q),res=[],has=s=>norm(s).includes(q);
  if(q.length>1){
   // prima le abbreviazioni e i nomi comuni (SIAS, zampa d'oca…)
   const top=[],seenT=new Set(),add=(r,k)=>{if(!seenT.has(k)){seenT.add(k);top.push(r);}};
   for(const [k,ts] of Object.entries(SYN)){if(!(k.startsWith(q)||(q.length>3&&q.includes(k))))continue;
    for(const t of ts){
     if(t[0]==='#'){const c=COMBO[t.slice(1)];add([c.n,'gruppo di muscoli',`data-combo="${t.slice(1)}"`],t);}
     else if(t.startsWith('mu:')){const r=t.slice(3);if(DATA.mus[r])add([DATA.mus[r].n,'muscolo',`data-mu="${r}"`],t);}
     else if(t[0]==='~')add([itOf(t==='~dura'?'Cranial dura mater':'Cranial arachnoid mater'),'meninge (schematica)',`data-shell="${t}"`],t);
     else{const l=LMS.find(l=>l.id[0]==='r'&&l.b===t);if(l)add([itOf(t),'repere',`data-lm="${l.id}"`],t);
      const n=Object.keys(DATA.objs).find(n=>baseOf(n)===t&&sideOf(n)!=='l');if(n)add([itOf(t),TIPO[DATA.objs[n][0]]||'',`data-find="${n}"`],n);}
    }}
   const seen=new Set();
   for(const n in DATA.objs){const b=baseOf(n),k=b+'|'+DATA.objs[n][0];if(seen.has(k)||DATA.objs[n][0]==='inserzioni')continue;seen.add(k);if((has(itOf(b))||has(b))&&!seenT.has(n))res.push([itOf(b),TIPO[DATA.objs[n][0]]||'',`data-find="${n}"`]);}
   for(const l of LMS)if(l.id[0]==='r'&&(has(itOf(l.b))||has(l.b))&&!seenT.has(l.b))res.push([itOf(l.b),'repere',`data-lm="${l.id}"`]);
   for(const [k,c] of Object.entries(COMBO))if((has(c.n)||has(c.la))&&!seenT.has('#'+k))res.push([c.n,'gruppo di muscoli',`data-combo="${k}"`]);
   res.sort((a,b)=>a[0].length-b[0].length);res.unshift(...top);
  }
  h=`<div class="kick">Atlante 3D</div><div class="h">🔎 Cerca</div><input id="q" placeholder="Nome di un osso, muscolo, nervo, repere…" value="${S.q}">
   <div class="chips">${res.slice(0,40).map(r=>chip('',r[2],r[0],r[1])).join('')}</div>${q.length>1&&!res.length?'<p class="mut">Nessun risultato.</p>':''}
   <div class="chips"><button class="chip" data-go="home">Chiudi</button></div>`;
 }else{
  h=`<div class="kick">Atlante 3D</div><div class="h">Il corpo in 3D</div><p class="mut">Tocca una parte per vederne il nome. Un dito ruota, due dita ingrandiscono e spostano, doppio tocco avvicina.</p>
   <div class="chips hub"><button class="chip" data-go="layers">🧩 Strati</button><button class="chip" data-go="muscles">💪 Muscoli</button><button class="chip" data-go="brain">🧠 Encefalo</button><button class="chip" data-sys="cuore">🫀 Cuore e vasi</button><button class="chip" data-sys="polmoni">🫁 Polmoni</button><button class="chip" data-go="search">🔎 Cerca</button></div>`+cutHtml('body')+FONTE;
 }
 const keep=document.activeElement&&document.activeElement.id==='q';
 p.innerHTML=h;if(!keep)p.scrollTop=0;
 if(keep){const q=$('q');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}}
}

/* ---------- azioni ---------- */
// pulsante "Solo questo" (encefalo o un apparato) e sezioni sui piani anatomici (anche del corpo intero, nel pannello iniziale)
const soloBtn=(k,n)=>`<button class="chip${S.solo===k?' on':''}" data-solo="${k}">${S.solo===k?'👁 Rimetti il resto del corpo':'👁 Solo '+n}</button>`;
function cutHtml(on){
 const cur=S.cutOn===on?S.cut.ax:null,b=(v,attr,txt)=>`<button class="chip${v?' on':''}" ${attr}>${txt}</button>`;
 return `<div class="sub">Sezione del corpo intero</div><div class="chips">${b(!cur,'data-cutb="none"','Nessuna')}${Object.entries(AX).map(([k,a])=>b(cur===k,`data-cutb="${k}"`,a.it)).join('')}</div>`+
  (cur?`<input type="range" id="cutr" aria-label="Posizione del piano di taglio" min="0" max="1000" value="${Math.round(S.cut.t*1000)}" style="width:100%"><div class="mut">${cur==='axial'?'Sposta il piano dal basso in alto: si vede la parte inferiore, dall\'alto':cur==='coronal'?'Sposta il piano da dietro in avanti: si vede la parte posteriore, da davanti':'Sposta il piano da destra a sinistra: si vede la metà sinistra dal lato destro'}. Accendi gli strati (muscoli, visceri, encefalo…) per vederli tagliati.</div>`:'');
}
let bodyB=null;const bodyBox=()=>bodyB||(bodyB=boxOf(meshes.filter(m=>m.userData.layer==='ossa')));
function levText(){return `<b>Strato più esterno visibile: ${ST[S.lev].n}</b><br><span class="mut">${ST[S.lev].t}</span>`;}
function selectPart(m,fly=false){S.mus=S.combo=null;S.lm=null;S.part=m;S.list=null;if(m&&m.userData.side)S.side=m.userData.side;refresh();if(m&&fly)frameBox(boxOf([m]),0.2);}
// distanza di un punto dalla superficie di una parte (vertice più vicino)
function distTo(m,p){
 m.updateWorldMatrix(true,false);const a=m.geometry.attributes.position,v=new THREE.Vector3();let bd=Infinity;
 for(let i=0;i<a.count;i++){const d=v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).distanceToSquared(p);if(d<bd)bd=d;}
 return Math.sqrt(bd);
}
// osso (o cartilagine) più vicino al punto di un'area: serve per non confondere ossa vicine (laringe, cranio)
const boneOfArea=new Map();
function nearestBone(m){
 if(boneOfArea.has(m))return boneOfArea.get(m);
 const p=areaPoint(m);let best=null,bd=0.03;
 for(const b of meshes){if(b.userData.layer!=='ossa')continue;if(!b.userData.box)b.userData.box=new THREE.Box3().setFromObject(b);
  if(b.userData.box.distanceToPoint(p)>=bd)continue;const d=distTo(b,p);if(d<bd){bd=d;best=b;}}
 boneOfArea.set(m,best);return best;
}
// muscoli con un'area a meno di 2,5 cm dal repere e appoggiata sullo stesso osso del repere
function musclesAt(l){
 if(!FILES.inserzioni||!FILES.inserzioni.loaded)return [];
 const s=sideOf(l.parent)||'r',bone=byName.get(l.parent),out=[];
 const ok=n=>{if(sideOf(n)&&sideOf(n)!==s||!byName.has(n))return false;const m=byName.get(n);return areaPoint(m).distanceTo(l.p)<0.025&&(!bone||nearestBone(m)===bone);};
 for(const [r,d] of Object.entries(DATA.mus))for(const k of ['o','e'])
  if(!out.some(x=>x[0]===r&&x[1]===k)&&d[k].some(ok))out.push([r,k]);
 return out;
}
function showLandmark(l,fly=true){
 S.mus=S.combo=null;S.part=null;S.lm=l;S.list=null;refresh();if(fly)flyTo(l.p.clone().addScaledVector(l.d,0.3),l.p.clone());
 if(!FILES.inserzioni||!FILES.inserzioni.loaded)loadFile('inserzioni').then(()=>{if(S.lm===l)refresh();},()=>{});
}
async function showMuscle(root,side=S.side,fly=true,combo=null){
 S.mus=combo?null:root;S.combo=combo;S.side=side;S.part=null;S.lm=null;S.list=null;
 if(!FILES.muscoli||!FILES.muscoli.loaded||!FILES.inserzioni||!FILES.inserzioni.loaded){S.loading=true;panel();try{await Promise.all([loadFile('muscoli'),loadFile('inserzioni')]);}catch(e){return;}S.loading=false;}
 refresh();
 if(!fly)return;
 let list=meshes.filter(m=>inFocus(m));
 if(combo&&COMBO[combo].fly)list=list.filter(m=>m.userData.kind===COMBO[combo].fly);
 if(!list.length)return;
 if(combo&&COMBO[combo].fly){ // inserzione sul lato mediale (zampa d'oca): la guardo da davanti e dal lato interno
  const b=boxOf(list),c=b.getCenter(new THREE.Vector3()),dir=new THREE.Vector3(Math.sign(center.x-c.x),0,1.2).normalize();
  flyTo(c.clone().addScaledVector(dir,0.4),c);
 }else frameBox(boxOf(list));
}
const showCombo=(k,side=S.side,fly=true)=>showMuscle(null,side,fly,k);
// pannello dell'encefalo: carica encefalo e meningi, ossa trasparenti, avvicina la testa
async function openBrain(){
 S.mus=S.combo=S.lm=S.part=null;S.list='brain';if(S.solo&&S.solo!=='brain')S.solo=null;
 if(S.cutOn!=='brain'){S.cut.ax=null;S.cutOn='brain';}
 if(!FILES.encefalo||!FILES.encefalo.loaded||!FILES.meningi||!FILES.meningi.loaded){S.loading=true;panel();try{await Promise.all([loadFile('encefalo'),loadFile('meningi')]);}catch(e){return;}S.loading=false;}
 if(!brainBox)brainBox=boxOf(meshes.filter(m=>m.userData.layer==='encefalo'&&m.userData.st===2));
 const first=!V.encefalo;V.encefalo=true;V.meningi=true;if(S.bones==='on')S.bones='ghost';
 refresh();
 if(first)flyBrain(S.cut.ax?AX[S.cut.ax].v:'right');
}
// un apparato (cuore e vasi, polmoni): carica i suoi file, mostra solo le sue parti (strati scelti), ossa trasparenti
async function openSys(k){
 S.mus=S.combo=S.lm=S.part=null;S.list=k;if(S.solo&&S.solo!==k)S.solo=null;
 if(S.cutOn!==k){S.cut.ax=null;S.cutOn=k;}
 const files=k==='cuore'?['vasi']:['vasi','visceri'];
 if(files.some(f=>!FILES[f]||!FILES[f].loaded)){S.loading=true;panel();await Promise.all(files.map(loadFile));S.loading=false;}
 const first=!S.on[k];S.on[k]=true;if(S.bones==='on')S.bones='ghost';
 refresh();
 if(first)flySys(k);
}
// accende o spegne un apparato dal pannello Strati, come uno strato (senza aprire il suo pannello)
async function toggleSys(k){
 if(S.on[k]){S.on[k]=false;if(S.solo===k)S.solo=null;if(S.cutOn===k)S.cut.ax=null;refresh();return;}
 const files=k==='cuore'?['vasi']:['vasi','visceri'];
 if(files.some(f=>!FILES[f]||!FILES[f].loaded)){S.loading=true;panel();await Promise.all(files.map(loadFile));S.loading=false;}
 S.on[k]=true;refresh();
}
// inquadra l'apparato: tutto il corpo per i vasi di tutto il corpo, altrimenti l'organo
function flySys(K,v='front'){
 const X=SYS[K],cur=Object.entries(X.P).find(([,l])=>Object.keys(X.L).every(k=>S.lay[K][k]===l.includes(k)));
 if(cur&&X.fly[cur[0]]==='body'){setView(v);return;}
 const box=boxSys(K),c=box.getCenter(new THREE.Vector3()),r=box.getSize(new THREE.Vector3()).length()/2;
 const dist=r*(K==='cuore'?1.3:0.9)/Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/Math.min(1,camera.aspect);
 flyTo(c.clone().addScaledVector(new THREE.Vector3(...DIR[v]).normalize(),dist),c);
}
function flyBrain(v){
 const c=brainBox.getCenter(new THREE.Vector3()),r=brainBox.getSize(new THREE.Vector3()).length()/2;
 const dist=r*0.95/Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/Math.min(1,camera.aspect);
 flyTo(c.clone().addScaledVector(new THREE.Vector3(...DIR[v]).normalize(),dist),c);
}
function setCut(ax){
 S.cut.ax=ax==='none'?null:ax;
 if(S.cut.ax&&SYS[S.cutOn]){S.cut.t=0.5;flySys(S.cutOn,AX[S.cut.ax].v);}
 else if(S.cut.ax&&S.cutOn==='body'){S.cut.t=S.cut.ax==='sagittal'?0.502:0.5;setView(AX[S.cut.ax].v);}
 else if(S.cut.ax){S.cut.t=S.cut.ax==='axial'?0.6:S.cut.ax==='sagittal'?0.52:0.5;/* sagittale appena a lato della falce: si vede la faccia mediale */flyBrain(AX[S.cut.ax].v);}
 refresh();
}
function setLevel(n){S.lev=n;refresh(true);const r=$('levr');if(r)r.value=n;const t=$('levt');if(t)t.innerHTML=levText();
 document.querySelectorAll('#panel [data-lev]').forEach(b=>b.classList.toggle('on',+b.dataset.lev===n));}
const INSIDE=['encefalo','midollo','meningi','sensi','visceri']; // stanno dentro le ossa: accendendoli le rendo trasparenti
async function toggleLayer(k){
 const f=LAYERS[k].file;
 if(!FILES[f]||!FILES[f].loaded){S.loading=true;panel();try{await loadFile(f);}catch(e){S.loading=false;panel();return;}S.loading=false;}
 V[k]=!V[k];
 if(V[k]&&INSIDE.includes(k)&&S.bones==='on')S.bones='ghost';
 refresh();
}
async function findPart(name){
 const k=DATA.objs[name][0];
 // un muscolo cercato si apre da solo, con origine e inserzione: lo strato dei muscoli lo accende l'utente
 if(k==='muscoli'){const r=rootOf(baseOf(name));if(DATA.mus[r]){showMuscle(r,sideOf(name)||S.side);return;}}
 try{await loadFile(LAYERS[k].file);}catch(e){return;}
 if(k!=='ossa'&&!V[k]){V[k]=true;if(INSIDE.includes(k)&&S.bones==='on')S.bones='ghost';}
 const m=byName.get(name);if(m){m.userData.hidden=false;if(m.userData.st>=0&&m.userData.st<S.lev)S.lev=m.userData.st;selectPart(m,true);}
}

/* ---------- tocco ---------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),tmp=new THREE.Vector3();
// con una sezione attiva il raggio salta la parte tagliata via (non disegnata): si tocca quello che si vede sul taglio
const kept=hs=>renderer.clippingPlanes.length?hs.filter(h=>cutPlane.distanceToPoint(h.point)>=0):hs;
function pickPart(x,y){const r=renderer.domElement.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const h=kept(ray.intersectObjects(pickables(),false))[0];return h?h.object:null;}
// il repere visibile più vicino al dito, entro 22 px e non coperto
function pickLandmark(x,y){
 const r=renderer.domElement.getBoundingClientRect();let best=null,bd=22;
 for(const l of LMS){
  if(!l.mesh||!l.mesh.visible)continue;
  tmp.copy(l.mesh.position).project(camera);if(tmp.z>1)continue;
  const d=Math.hypot((tmp.x+1)/2*r.width+r.left-x,(1-tmp.y)/2*r.height+r.top-y);
  if(d>=bd)continue;
  ray.set(camera.position,tmp.copy(l.mesh.position).sub(camera.position).normalize());
  const h=kept(ray.intersectObjects(pickables(),false))[0],dist=camera.position.distanceTo(l.mesh.position);
  if(h&&h.distance<dist-0.008)continue;
  bd=d;best=l;
 }
 return best;
}
let down=null,lastTap=0;
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};});
renderer.domElement.addEventListener('pointerup',e=>{
 if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;
 if(moved>8||dt>500)return;
 if(GAME){if(!GAME.over)gameTap(e.clientX,e.clientY);return;}
 const l=pickLandmark(e.clientX,e.clientY);
 if(l){showLandmark(l,false);lastTap=0;return;}
 const m=pickPart(e.clientX,e.clientY),now=performance.now();
 if(m&&now-lastTap<350){const b=boxOf([m]),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()).length(),dir=camera.position.clone().sub(controls.target).normalize();
  flyTo(c.clone().add(dir.multiplyScalar(Math.max(controls.minDistance,s*2.2))),c);} // doppio tocco: avvicina
 else if(m&&roots().length&&inFocus(m)){/* tocco sul muscolo già aperto: resta la scheda */}
 else if(m||(!roots().length&&S.list!=='brain'))selectPart(m);
 lastTap=now;
});

/* ---------- gioco: Trova la struttura nel 3D ---------- */
// L'app (scheda Palestra) manda {bm:'game',set}; qui si gioca e si rimandano all'app le risposte ({bm:'res'}) e la fine
// ({bm:'end'}), così XP, serie e maestria restano nel salvataggio dell'app. Domande solo su nomi e forme della fonte,
// e solo su strutture che si possono vedere dall'esterno ruotando il modello (vedi seenFrom).
const M_OK=toon(0x22c55e),M_BAD=toon(0xef4444);
const MKG={ok:new THREE.MeshBasicMaterial({color:0x22c55e}),bad:new THREE.MeshBasicMaterial({color:0xef4444}),tap:new THREE.MeshBasicMaterial({color:0x111827,depthTest:false})};
for(const k in MKG)MKG[k].userData.outlineParameters={visible:false};
const toApp=msg=>{if(window.parent!==window)window.parent.postMessage({bm:1,...msg},location.origin);};
const SETS={
 ossa:{n:'Ossa',ask:'Tocca l\'osso'},
 muscoli:{n:'Muscoli',ask:'Tocca il muscolo'},
 reperi:{n:'Reperi ossei',ask:'Tocca il repere'},
 oi:{n:'Origine e inserzione',ask:''},
 ricomponi:{n:'Ricomponi',ask:''},
 ponte:{n:'Tendine-ponte',ask:''},
 caso:{n:'Caso clinico',ask:'Tocca il muscolo'},
 nervi:{n:'Nervi cranici',ask:'Tocca il nervo'},
 cuore:{n:'Cuore',ask:'Tocca'},
 polmoni:{n:'Polmoni',ask:'Tocca'}};
// casi clinici e nervi cranici arrivano dall'app con il messaggio del gioco (stanno nei contenuti dell'app)
const EXTRA={cases:[],nc:[]};
// zone del gioco Ricomponi, dai gruppi della fonte (Terminologia Anatomica)
const ZONES=[
 {n:'Cranio e mandibola',g:/^(Bones of cranium|Frontal bone|Sphenoid bone|Ethmoid bone|Extracranial bones of head)$/},
 {n:'Colonna vertebrale',g:/^(Cervical vertebrae|Thoracic vertebrae|Lumbar vertebrae|Vertebral column)$/},
 {n:'Gabbia toracica',g:/^(True ribs|False ribs|Floating ribs|Sternum)$/},
 {n:'Spalla e braccio',g:/^Bones of pectoral girdle$/,b:/^(Humerus|Radius|Ulna)$/},
 {n:'Mano e polso',g:/^Bones of free part of upper limb$/,x:/^(Humerus|Radius|Ulna)$/},
 {n:'Bacino e arto inferiore',g:/^(Bones of pelvic girdle|Bones of free part of lower limb)$/},
 {n:'Piede',g:/^(Tarsal bones|Metatarsal bones|Phalanges of foot|Bones of foot)$/}];
const inZone=(z,u)=>(z.g.test(u.g)&&!(z.x&&z.x.test(u.base)))||(z.b&&z.b.test(u.base));
// numero del nervo cranico di una parte dello strato nervi (rami compresi: trigemino, facciale, vestibolococleare)
function crNum(u){
 const m=u.base.match(/\(([IVX]+)\)$/)||(u.g||'').match(/\(([IVX]+)\)$/);if(m)return m[1];
 return /mandibular nerve|inferior alveolar/i.test(u.g||'')?'V':null;
}
const slug=t=>t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const TEETH=/(incisor|canine|molar|premolar)/i,BONE_SKIP=/(cartilage|cells of ethmoid|Sinus of)/i,KEEP_CART=/^(Costal cartilage|Thyroid cartilage|Cricoid cartilage)/;
// famiglia di un nome (tutte le coste, tutte le falangi…): si sceglie prima la famiglia, così coste e falangi non dominano
const famOf=b=>b.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/gi,'#').replace(/\b[CTL]\d+\b/,'#').replace(/\b(Proximal|Middle|Distal)\b/,'#');
// quali candidati si vedono da fuori: disegno la scena da 26 direzioni con un colore per candidato e conto i pixel
function seenFrom(cands,occl,W=200){
 cands.forEach(m=>m.userData.gpu=true);occl.forEach(m=>m.userData.gpu=true); // disegnate qui: andranno liberate quando restano nascoste
 const H=W*2,rt=new THREE.WebGLRenderTarget(W,H),buf=new Uint8Array(W*H*4),cam=new THREE.PerspectiveCamera(30,W/H,0.03,20);
 const black=new THREE.MeshBasicMaterial({color:0}),saved=[],ids=new Map();
 scene.traverse(o=>{if(o.isMesh){saved.push([o,o.visible,o.material]);o.visible=false;}});
 cands.forEach((m,i)=>{const c=new THREE.Color().setRGB(((i+1)&255)/255,((i+1)>>8)/255,0,THREE.LinearSRGBColorSpace);m.material=new THREE.MeshBasicMaterial({color:c,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4});m.visible=true;ids.set(i+1,m);});
 occl.forEach(m=>{m.material=black;m.visible=true;});
 cands.forEach(m=>m.visible=true);
 const bg=scene.background,clip=renderer.clippingPlanes;scene.background=new THREE.Color(0);renderer.clippingPlanes=[];
 const seen=new Map(),dist=height*2.2;
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
  if(!x&&!y&&!z)continue;
  cam.position.copy(center).add(new THREE.Vector3(x,y,z).normalize().multiplyScalar(dist));cam.up.set(0,Math.abs(y)===1&&!x&&!z?0:1,Math.abs(y)===1&&!x&&!z?-1:0);cam.lookAt(center);
  renderer.setRenderTarget(rt);renderer.render(scene,cam);renderer.readRenderTargetPixels(rt,0,0,W,H,buf);
  const cnt=new Map();for(let i=0;i<buf.length;i+=4){const id=buf[i]+buf[i+1]*256;if(id)cnt.set(id,(cnt.get(id)||0)+1);}
  for(const [id,n] of cnt){const m=ids.get(id);if(m)seen.set(m,Math.max(seen.get(m)||0,n));}
 }
 renderer.setRenderTarget(null);scene.background=bg;renderer.clippingPlanes=clip;rt.dispose();
 cands.forEach(m=>m.material.dispose());
 saved.forEach(([m,v,mat])=>{m.visible=v;m.material=mat;});
 return seen;
}
const POOL={},LM_MIN=4; // pixel minimi (su 300×600) perché un repere conti come visibile da fuori
async function poolOf(set){
 if(POOL[set])return POOL[set];
 let items=[];  // {key, n, la, fam}
 const add=(key,b)=>items.push({key,n:clean(itOf(b)),la:clean(laOf(b)),fam:famOf(b)});
 if(set==='ossa'){
  const bones=meshes.filter(m=>m.userData.layer==='ossa'&&!TEETH.test(m.userData.base)&&(!BONE_SKIP.test(m.userData.base)||KEEP_CART.test(m.userData.base)));
  const seen=seenFrom(bones,[]),ok=new Set();for(const [m,n] of seen)if(n>=4)ok.add(m.userData.base);
  [...ok].forEach(b=>add(b,b));
 }else if(set==='muscoli'){
  await loadFile('muscoli');
  const mus=meshes.filter(m=>m.userData.layer==='muscoli'),bones=meshes.filter(m=>m.userData.layer==='ossa');
  const seen=seenFrom(mus,bones),ok=new Set();for(const [m,n] of seen)if(n>=4&&DATA.mus[m.userData.root])ok.add(m.userData.root);
  [...ok].forEach(r=>items.push({key:r,n:clean(DATA.mus[r].n),la:clean(DATA.mus[r].la),fam:r}));
 }else if(set==='oi'){
  // una domanda per muscolo e tipo (origine o inserzione), se almeno un'area di quel tipo si vede sullo scheletro
  await Promise.all([loadFile('muscoli'),loadFile('inserzioni')]);
  const bones=meshes.filter(m=>m.userData.layer==='ossa'),areas=meshes.filter(m=>m.userData.layer==='inserzioni');
  const seen=seenFrom(areas,bones,400),vis=new Set();for(const [m,n] of seen)if(n>=4)vis.add(m.userData.name); // risoluzione doppia: le aree di mano e piede sono piccole
  for(const [r,d] of Object.entries(DATA.mus))for(const k of ['o','e'])
   if(d[k].some(n=>vis.has(n)))items.push({key:r+'|'+k,root:r,k,n:clean(d.n),la:clean(d.la),fam:r,uq:r+'|'+k});
  return POOL[set]=items;
 }else if(set==='ponte'){
  // ossa di origine e di inserzione di ogni muscolo: l'osso più vicino alle sue aree (come nei giochi 2D)
  await Promise.all([loadFile('muscoli'),loadFile('inserzioni')]);
  const bonesOf=names=>[...new Set(names.filter(n=>sideOf(n)!=='l').map(n=>byName.get(n)).filter(Boolean).map(m=>nearestBone(m)).filter(Boolean).map(b=>b.userData.base))];
  for(const [r,d] of Object.entries(DATA.mus)){const ob=bonesOf(d.o),eb=bonesOf(d.e);if(ob.length&&eb.length)items.push({key:r,n:clean(d.n),la:clean(d.la),fam:d.g||r,ob,eb});}
  return POOL[set]=items;
 }else if(set==='cuore'||set==='polmoni'){
  // parti che si vedono da fuori: cuore con grandi vasi e coronarie; polmoni con trachea e bronchi principali
  // (gli altri bronchi stanno dentro i lobi: si vedrebbero solo dalle fessure tra le superfici della fonte)
  await Promise.all(set==='cuore'?[loadFile('vasi')]:[loadFile('vasi'),loadFile('visceri')]);
  const orgs=set==='cuore'?['cuore','coronarie','grandi','pgrandi']:['polmoni','vie'];
  const parts=meshes.filter(m=>orgs.includes(m.userData.org));
  const seen=seenFrom(parts,[],400),ok=new Set();for(const [m,n] of seen)if(n>=8&&(m.userData.org!=='vie'||/^(Trachea|Right main bronchus|Left main bronchus)$/.test(m.userData.base)))ok.add(m.userData.base);
  [...ok].forEach(b=>add(b,b));
 }else if(set==='caso'){
  // solo i casi il cui muscolo si vede da fuori (si risponde toccandolo)
  const vis=new Set((await poolOf('muscoli')).map(i=>i.key)),bySlug=Object.fromEntries(Object.keys(DATA.mus).map(r=>[slug(r),r]));
  for(const c of EXTRA.cases){const r=c.mid&&bySlug[c.mid];if(r&&vis.has(r))items.push({key:c.id,root:r,n:clean(DATA.mus[r].n),la:clean(DATA.mus[r].la),fam:c.id,c});}
  return items; // niente cache: i casi arrivano dall'app
 }else if(set==='nervi'){
  await loadFile('nervi');
  const have=new Set(meshes.filter(m=>m.userData.layer==='nervi').map(m=>crNum(m.userData)).filter(Boolean));
  for(const n of EXTRA.nc)if(have.has(n.n))items.push({key:n.n,n:'Nervo '+n.nm.toLowerCase()+' ('+n.n+')',fam:n.n,f:n.f,t:n.t,byF:Math.random()<.5});
  return items;
 }else if(set==='ricomponi'){
  // pezzi possibili: le ossa che si vedono da fuori (come in Trova l'osso), divise per zona
  const ok=new Set((await poolOf('ossa')).map(i=>i.key));
  return POOL[set]=ZONES.map(z=>({z,bases:[...new Set(meshes.filter(m=>m.userData.layer==='ossa'&&ok.has(m.userData.base)&&inZone(z,m.userData)).map(m=>m.userData.base))]})).filter(x=>x.bases.length>=3);
 }else{
  // reperi: pallini di 5 mm sulle ossa, contati come le ossa; esclusi i nomi che sono quelli di un osso intero
  const bones=meshes.filter(m=>m.userData.layer==='ossa'),boneNames=new Set(bones.map(m=>m.userData.base)),list=LMS.filter(l=>!boneNames.has(l.b)&&l.b!=='Vertebra');
  list.forEach(l=>{markerOf(l).scale.setScalar(0.005);});
  const seen=seenFrom(list.map(l=>l.mesh),bones,300),ok=new Set();for(const l of list)if((seen.get(l.mesh)||0)>=LM_MIN)ok.add(l.b);
  [...ok].forEach(b=>add(b,b));
 }
 // un nome che compare due volte (es. stesso repere su due ossa) vale una volta sola
 const u=new Map();items.forEach(i=>{if(!u.has(i.n))u.set(i.n,i);});
 return POOL[set]=[...u.values()];
}
const pickQ=()=>{const G=GAME,fams=[...new Set(G.pool.map(i=>i.fam))];let it,tries=0;
 do{const f=fams[Math.floor(Math.random()*fams.length)],c=G.pool.filter(i=>i.fam===f);it=c[Math.floor(Math.random()*c.length)];}while((G.used.has(it.key)||it.key===G.last)&&++tries<50);
 G.used.add(it.key);G.last=it.key;return it;};
// le parti che rispondono alla domanda (tutti e due i lati)
const targets=it=>GAME.set==='nervi'?meshes.filter(m=>m.userData.layer==='nervi'&&crNum(m.userData)===it.key):GAME.set==='caso'?meshes.filter(m=>m.userData.layer==='muscoli'&&m.userData.root===it.root):GAME.set==='muscoli'?meshes.filter(m=>m.userData.layer==='muscoli'&&m.userData.root===it.key):GAME.set==='ossa'?meshes.filter(m=>m.userData.layer==='ossa'&&m.userData.base===it.key):[];
const lmTargets=it=>LMS.filter(l=>l.b===it.key);
async function startGame(set,extra){
 if(!SETS[set])return;
 if(extra){if(extra.cases)EXTRA.cases=extra.cases;if(extra.nc)EXTRA.nc=extra.nc;}
 GAME={set,q:0,total:8,hearts:3,score:0,gain:0,cur:null,locked:false,used:new Set(),last:null,pool:null,marks:[]};
 document.body.classList.add('game');
 S.mus=S.combo=S.lm=S.part=null;S.list=null;S.cut.ax=null;S.lev=0;S.mv='both';
 for(const k in V)V[k]=false;S.bones='on';S.allLm=false;S.on={cuore:false,polmoni:false};S.solo=null;meshes.forEach(m=>m.userData.hidden=false);
 S.loading=true;refresh();
 try{GAME.pool=await poolOf(set);
 if(set==='oi'||set==='ponte')await Promise.all([loadFile('muscoli'),loadFile('inserzioni')]);
 if(set==='nervi')await Promise.all([loadFile('encefalo'),loadFile('nervi')]);}
 catch(e){GAME=null;document.body.classList.remove('game');S.loading=false;refresh();return;} // strato mancante offline: avviso in loadFail
 if(set==='muscoli')V.muscoli=true;
 if(set==='reperi')S.allLm=true;
 if(set==='caso')V.muscoli=true;
 if(set==='cuore'||set==='polmoni'){S.on[set]=true;const X=SYS[set];for(const k in X.L)S.lay[set][k]=X.P[set==='cuore'?'base':'tutto'].includes(k);S.bones='ghost';S.cut.ax=null;}
 if(set==='oi'||set==='ponte')await Promise.all([loadFile('muscoli'),loadFile('inserzioni')]);
 if(set==='nervi'){await loadFile('encefalo');V.nervi=true;V.encefalo=true;S.bones='ghost';
  meshes.forEach(m=>{if(m.userData.layer==='nervi'&&!crNum(m.userData))m.userData.hidden=true;}); // solo i 12 nervi cranici
  if(!brainBox)brainBox=boxOf(meshes.filter(m=>m.userData.layer==='encefalo'&&m.userData.st===2));}
 S.loading=false;
 if(!GAME.pool.length){GAME.empty=true;refresh();return;}
 if(set==='caso')GAME.total=Math.min(5,GAME.pool.length);
 if(set==='ricomponi')return startZone();
 nextGameQ();
}
/* Ricomponi: le ossa di una zona diventano trasparenti; si sceglie un pezzo e si tocca il suo posto sul modello */
function startZone(){
 const G=GAME,Z=G.pool[Math.floor(Math.random()*G.pool.length)];
 G.zone=Z.z.n;G.left=[...Z.bases].sort(()=>Math.random()-.5).slice(0,8);G.total=G.left.length;G.sel=null;G.msg='';G.cur={zone:true};
 G.ghosts=meshes.filter(m=>m.userData.layer==='ossa'&&G.left.includes(m.userData.base));
 refresh(true);gameMark(G.ghosts,M_GHOST);
 const right=G.ghosts.filter(m=>m.userData.side!=='l');frameBox(boxOf(right.length?right:G.ghosts),0.3);
 panel();
}
function zoneTap(x,y){
 const G=GAME,r=renderer.domElement.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
 // il posto vuoto (trasparente) sotto il dito, anche se un altro osso gli sta davanti
 const free=G.ghosts.filter(m=>G.left.includes(m.userData.base)),h=ray.intersectObjects(free,false)[0];
 if(!G.sel){G.msg='Prima scegli un pezzo qui sotto.';panel();return;}
 if(!h){G.msg='Tocca una delle parti trasparenti.';panel();return;}
 const base=h.object.userData.base,ok=base===G.sel,parts=G.ghosts.filter(m=>m.userData.base===(ok?G.sel:base));
 toApp({type:'res',ok,key:'3d:ricomponi:'+G.sel});
 if(ok){G.score++;G.q++;G.gain+=10;G.left=G.left.filter(b=>b!==G.sel);G.msg='✅ <b>'+clean(itOf(G.sel))+'</b> al suo posto.';G.sel=null;
  parts.forEach(m=>{m.material=M_OK;setTimeout(()=>{m.material=m.userData.own;},700);});
  G.marks=G.marks.filter(([m])=>!parts.includes(m));
  if(!G.left.length)return setTimeout(endGame,700);
 }else{G.hearts--;G.msg='❌ Non è qui: questo è il posto di <b>'+clean(itOf(base))+'</b>.';
  parts.forEach(m=>{m.material=M_BAD;setTimeout(()=>{if(G.left.includes(m.userData.base))m.material=M_GHOST;},700);});
  if(G.hearts<=0)return setTimeout(endGame,700);
 }
 panel();
}
/* Tendine-ponte: tocca l'osso di origine e poi quello di inserzione del muscolo */
function ponteTap(x,y){
 const G=GAME,h=boneHit(x,y);if(!h)return;
 const base=h.object.userData.base,want=G.step==='o'?G.cur.ob:G.cur.eb,ok=want.includes(base);
 const bonesNamed=list=>meshes.filter(m=>m.userData.layer==='ossa'&&list.includes(m.userData.base));
 if(ok&&G.step==='o'){G.step='e';G.first=base;gameMark(bonesNamed([base]),M_OK);G.hint='';panel();return;}
 G.locked=true;G.q++;G.hint='';
 if(ok){G.score++;G.gain+=10;}else G.hearts--;
 toApp({type:'res',ok,key:'3d:ponte:'+G.cur.key});
 clearGameMarks();gameMark(bonesNamed([...G.cur.ob,...G.cur.eb]),M_OK);if(!ok)gameMark([h.object],M_BAD);
 // le aree della fonte sul lato toccato, come in Origine e inserzione
 const side=h.object.userData.side||S.side;S.mus=G.cur.key;S.side=side;S.mv='areas';refresh(true);
 const d=DATA.mus[G.cur.key],all=[...d.o,...d.e].map(n=>byName.get(n)).filter(m=>m&&(!m.userData.side||m.userData.side===side));
 if(all.length)frameBox(boxOf(all),0.3);
 G.res={ok,hit:ok?null:clean(itOf(base)),wrongStep:ok?null:G.step};panel();
}
const gameDots=new THREE.Group();scene.add(gameDots);
function gameDot(p,mat){const m=new THREE.Mesh(ball,mat);m.position.copy(p);m.scale.setScalar(0.006);m.renderOrder=12;gameDots.add(m);}
// punto dell'osso sotto il dito
function boneHit(x,y){const r=renderer.domElement.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
 return kept(ray.intersectObjects(meshes.filter(m=>m.visible&&m.userData.layer==='ossa'),false))[0]||null;}
// distanza di un punto da un'area (triangoli nel mondo); prima scarta le aree lontane con il riquadro
const triA=new THREE.Vector3(),triB=new THREE.Vector3(),triC=new THREE.Vector3(),tri=new THREE.Triangle(),cp=new THREE.Vector3(),abox=new THREE.Box3();
function distToArea(m,p,max){
 abox.setFromObject(m);if(abox.distanceToPoint(p)>max)return Infinity;
 m.updateWorldMatrix(true,false);const a=m.geometry.attributes.position,ix=m.geometry.index;let best=Infinity;
 const n=ix?ix.count:a.count;
 for(let i=0;i<n;i+=3){const i0=ix?ix.getX(i):i,i1=ix?ix.getX(i+1):i+1,i2=ix?ix.getX(i+2):i+2;
  triA.fromBufferAttribute(a,i0).applyMatrix4(m.matrixWorld);triB.fromBufferAttribute(a,i1).applyMatrix4(m.matrixWorld);triC.fromBufferAttribute(a,i2).applyMatrix4(m.matrixWorld);
  tri.set(triA,triB,triC).closestPointToPoint(p,cp);const d=cp.distanceTo(p);if(d<best)best=d;}
 return best;
}
const OI_TOL=0.012; // 1,2 cm: il dito non è preciso e i bordi delle aree della fonte sono approssimati
function oiTap(x,y){
 const G=GAME,h=boneHit(x,y);if(!h)return;
 const d=DATA.mus[G.cur.root],names=d[G.cur.k],areas=names.map(n=>byName.get(n)).filter(Boolean);
 let near=null,nd=Infinity;for(const m of areas){const dd=distToArea(m,h.point,OI_TOL*4);if(dd<nd){nd=dd;near=m;}}
 const ok=nd<=OI_TOL;
 // se sbagliato: cosa c'è nel punto toccato (l'area di un altro muscolo, se ce n'è una vicina)
 let other=null;
 if(!ok){let od=OI_TOL;for(const m of meshes){if(m.userData.layer!=='inserzioni')continue;const dd=distToArea(m,h.point,od);if(dd<od){od=dd;other=m;}}}
 G.locked=true;G.hint='';G.q++;
 if(ok){G.score++;G.gain+=10;}else G.hearts--;
 toApp({type:'res',ok,key:'3d:oi:'+G.cur.key});
 // risposta: il muscolo con le sue aree e la linea, sul lato toccato
 const side=h.object.userData.side||(near&&near.userData.side)||S.side;
 S.mus=G.cur.root;S.side=side;S.mv='areas';refresh(true);
 gameDot(h.point,ok?MKG.ok:MKG.tap); // nero, non rosso: il rosso si confonderebbe con l'arancione dell'inserzione
 // inquadra tutte le aree del muscolo (origine e inserzione) sul lato toccato, giusta o sbagliata che sia la risposta
 const all=[...d.o,...d.e].map(n=>byName.get(n)).filter(m=>m&&(!m.userData.side||m.userData.side===side));
 if(all.length)frameBox(boxOf(all),0.3);
 const oth=other&&(()=>{const r=other.userData.root,dd=DATA.mus[r];if(!dd)return null;const k=dd.o.includes(other.userData.name)?'o':dd.e.includes(other.userData.name)?'e':other.userData.kind;
  return (k==='o'?"l'origine":"l'inserzione")+' di: '+clean(dd.n);})();
 G.res={ok,hit:ok?null:oth?'un punto dove c\'è '+oth:nd<Infinity?'a circa '+Math.max(2,Math.round(nd*100))+' cm dall\'area giusta':'lontano dall\'area giusta'};
 panel();
}
const clean=t=>(t||'').replace(/^\((.*)\)$/,'$1');
function clearGameMarks(){while(gameDots.children.length)gameDots.remove(gameDots.children[0]);for(const [m,mat] of GAME.marks)m.material=mat;GAME.marks=[];}
function gameMark(list,mat){for(const m of list){GAME.marks.push([m,m.material]);m.material=mat;}}
function nextGameQ(){
 const G=GAME;
 if(G.hearts<=0||G.q>=G.total)return endGame();
 G.locked=false;G.cur=pickQ();G.res=null;G.step='o';G.first=null;G.clues=1;S.mus=null;S.mv='both';refresh();clearGameMarks();
 if(G.set==='nervi'){ // la base dell'encefalo vista da davanti e un po' dal basso, dove escono i nervi
  const c=brainBox.getCenter(new THREE.Vector3()),r=brainBox.getSize(new THREE.Vector3()).length()/2,dist=r*1.1/Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/Math.min(1,camera.aspect);
  flyTo(c.clone().addScaledVector(new THREE.Vector3(0,-0.55,1).normalize(),dist),c);
 }else if(G.set==='cuore'||G.set==='polmoni')flySys(G.set,'front');
 else flyTo(center.clone().add(new THREE.Vector3(0,0,1).multiplyScalar(fitDist())),center.clone());
}
function gameTap(x,y){
 const G=GAME;if(!G||G.locked||!G.cur)return;
 if(G.set==='oi')return oiTap(x,y);
 if(G.set==='ricomponi')return zoneTap(x,y);
 if(G.set==='ponte')return ponteTap(x,y);
 let ok,hit;
 if(G.set==='nervi'){
  const m=pickPart(x,y);if(!m)return;const u=m.userData;
  if(u.layer!=='nervi'){G.hint='Hai toccato '+(u.layer==='encefalo'?'l\'encefalo':'un\'altra struttura')+': tocca un nervo.';panel();return;}
  const n=crNum(u);hit={n:n?'Nervo '+((EXTRA.nc.find(x=>x.n===n)||{}).nm||'').toLowerCase()+' ('+n+')':clean(itOf(u.base))+' (non è un nervo cranico)',m};ok=n===G.cur.key;
 }else if(G.set==='caso'){
  const m=pickPart(x,y);if(!m)return;const u=m.userData;
  if(u.layer!=='muscoli'){G.hint='Hai toccato un osso: tocca un muscolo.';panel();return;}
  hit={n:(DATA.mus[u.root]||{n:itOf(u.base)}).n,m};ok=u.root===G.cur.root;
 }else if(G.set==='reperi'){
  const l=pickLandmark(x,y);if(!l)return;hit={n:itOf(l.b),l};ok=l.b===G.cur.key;
 }else{
  const m=pickPart(x,y);if(!m)return;const u=m.userData;
  if(G.set==='muscoli'&&u.layer!=='muscoli'){G.hint='Hai toccato un osso: tocca un muscolo.';panel();return;}
  hit={n:G.set==='muscoli'?(DATA.mus[u.root]||{n:itOf(u.base)}).n:itOf(u.base),m};
  ok=G.set==='muscoli'?u.root===G.cur.key:u.base===G.cur.key;
 }
 G.locked=true;G.hint='';G.q++;
 if(ok){G.score++;G.gain+=10;}else G.hearts--;
 toApp({type:'res',ok,key:'3d:'+G.set+':'+G.cur.key});
 // colori: verde la risposta giusta (tutti e due i lati), rosso quella toccata se sbagliata
 if(G.set==='reperi'){
  const tl=lmTargets(G.cur);tl.forEach(l=>{const k=markerOf(l);k.visible=true;});gameMark(tl.map(l=>l.mesh),MKG.ok);if(!ok)gameMark([hit.l.mesh],MKG.bad);
  if(!ok){const near=tl.reduce((a,b)=>a.p.distanceTo(hit.l.p)<b.p.distanceTo(hit.l.p)?a:b);flyTo(near.p.clone().addScaledVector(near.d,0.35),near.p.clone());}
 }else{
  const t=targets(G.cur);gameMark(t,M_OK);if(!ok)gameMark([hit.m],M_BAD);
  if(!ok){const side=hit.m.userData.side,same=t.filter(m=>!side||m.userData.side===side);frameBox(boxOf(same.length?same:t),0.3);}
 }
 G.res={ok,hit:ok?null:hit.n};panel();
}
function endGame(){
 const G=GAME,done=G.hearts>0&&G.q>=G.total;if(done)G.gain+=20;
 toApp({type:'end',done,set:G.set,score:G.score,total:G.q,gain:G.gain});G.over=true;G.cur=null;clearGameMarks();S.mus=null;refresh();
}
function quitGame(){if(GAME){clearGameMarks();if(SYS[GAME.set])S.on[GAME.set]=false;}GAME=null;S.mus=null;S.mv='both';S.bones='on';meshes.forEach(m=>m.userData.hidden=false);document.body.classList.remove('game');for(const k in V)V[k]=false;S.allLm=false;S.list=null;refresh();setView('front');}
// risposta del gioco origine e inserzione: aree in blu (origine) e arancione (inserzione), testo della scheda
function oiAnswer(G){
 const d=DATA.mus[G.cur.root],c=d.card,t=G.cur.k==='o'?c&&c.ot:c&&c.it;
 return (G.res.ok?'':`<p>Hai toccato ${G.res.hit}.</p>`)+
  `<p><b>${G.cur.n}</b>: <span class="tg o">O</span> origine, <span class="tg i">I</span> inserzione; il pallino ${G.res.ok?'verde':'nero'} è dove hai toccato.</p>`+
  (t?`<p>${G.cur.k==='o'?'Origine':'Inserzione'}: ${t}</p><p class="note">Testo scritto dall'AI: da verificare su un atlante. Le aree colorate vengono dalla fonte Z-Anatomy.</p>`:'')+
  (d.fix?'<p class="note">Nella fonte origine e inserzione di questo muscolo erano scambiate: qui sono corrette.</p>':'');
}
function ponteAnswer(G){
 const c=DATA.mus[G.cur.key].card||{},nm=l=>l.map(b=>clean(itOf(b))).join(', ');
 return (G.res.ok?'':`<p>Hai toccato: <b>${G.res.hit}</b> (${G.res.wrongStep==='o'?'origine':'inserzione'} sbagliata).</p>`)+
  `<p><b>${G.cur.n}</b><br><span class="tg o">O</span> ${nm(G.cur.ob)}<br><span class="tg i">I</span> ${nm(G.cur.eb)}</p>`+
  (c.ot?`<p class="mut">Origine: ${c.ot}. Inserzione: ${c.it}.</p><p class="note">Ossa dalle aree della fonte Z-Anatomy; testo della scheda scritto dall'AI, da verificare.</p>`:'');
}
function gamePanel(){
 const G=GAME,hearts=`<div class="gh"><span>${'❤️'.repeat(Math.max(0,G.hearts))}${'🖤'.repeat(3-Math.max(0,G.hearts))}</span><span>${SETS[G.set].n} · ${Math.min(G.q+(G.res?0:1),G.total)}/${G.total}</span></div>`;
 if(G.over){const st=G.score/G.q>=.9?3:G.score/G.q>=.6?2:1;
  return `<div class="res"><div class="big">${'⭐'.repeat(st)}${'☆'.repeat(3-st)}</div><div class="h">${G.score}/${G.q} corrette</div><p>+${G.gain} XP${G.hearts>0&&G.q>=G.total?' (bonus round +20)':''}</p>
   ${G.hearts<=0?'<p class="mut">Cuori finiti: ripassa esplorando il modello e riprova.</p>':''}
   <div class="chips" style="justify-content:center"><button class="chip on" data-g="again">Rigioca</button><button class="chip" data-g="menu">Cambia sfida</button><button class="chip" data-g="quit">Esplora il modello</button></div></div>`;}
 if(G.empty)return `<p>${G.set==='nervi'||G.set==='caso'?'Questa sfida si apre dalla Palestra dell\'app.':'Nessuna domanda disponibile.'}</p><div class="chips"><button class="chip" data-g="quit">Esci</button></div>`;
 if(G.set==='ricomponi'&&G.cur)return hearts.replace(/\d+\/\d+/,(G.total-G.left.length)+'/'+G.total)+`<div class="q">Zona: <b>${G.zone}</b></div><p class="mut">${G.msg||'Scegli un pezzo, poi tocca il suo posto sul modello (le ossa trasparenti). Ruota e ingrandisci come vuoi: vale tutti e due i lati.'}</p>`+
  `<div class="chips">${G.left.map(b=>`<button class="chip${G.sel===b?' on':''}" data-pc="${b}">${clean(itOf(b))}</button>`).join('')}</div><div class="chips"><button class="chip" data-g="quit">Esci</button></div>`;
 if(!G.cur)return `<p class="mut">${S.loading?(G.set==='muscoli'&&!FILES.muscoli?.loaded?'Carico i muscoli…':'Preparo le domande…'):''}</p>`;
 const ask=G.set==='oi'?`Tocca sull'osso ${G.cur.k==='o'?"l'<b>origine</b>":"l'<b>inserzione</b>"} di`:G.set==='ponte'?(G.step==='o'?"Tocca l'osso di <b>origine</b> di":"✅ Origine giusta. Ora tocca l'osso di <b>inserzione</b> di"):SETS[G.set].ask;
 let q=`<div class="q">${ask}:<br><b>${G.cur.n}</b> ${G.cur.la?`<i>${G.cur.la}</i>`:''}</div>`;
 if(G.set==='nervi'&&G.cur.byF)q=`<div class="q">Tocca il nervo cranico che serve per:<br><b>${G.cur.f}</b></div>`;
 if(G.set==='caso'){const c=G.cur.c;q=`<div class="q"><small>Caso clinico</small></div>`+c.clues.slice(0,G.res?c.clues.length:G.clues).map(t=>`<div class="row">• ${t}</div>`).join('')+
  (G.res?'':`<p><b>Tocca sul modello il muscolo coinvolto.</b></p>`+(G.clues<c.clues.length?'<div class="chips"><button class="chip" data-g="clue">Altro indizio</button></div>':''));}
 if(!G.res)return hearts+q+`<p class="mut">${G.hint||'Ruota e ingrandisci il modello come vuoi: vale tutti e due i lati.'}</p><div class="chips"><button class="chip" data-g="quit">Esci</button></div>`;
 const last=G.hearts<=0||G.q>=G.total;
 return hearts+`<div class="h">${G.res.ok?'✅ Esatto! +10 XP':'❌ Non proprio'}</div>`+
  (G.set==='oi'?oiAnswer(G):G.set==='ponte'?ponteAnswer(G):G.set==='caso'?`<p>${G.res.ok?'':'Hai toccato: <b>'+G.res.hit+'</b>. '}In verde: <b>${G.cur.n}</b>.</p><p>${G.cur.c.r}</p><p class="note">Caso scritto dall'AI: da verificare.</p>`:
   G.set==='nervi'?`<p>${G.res.ok?'':'Hai toccato: <b>'+G.res.hit+'</b>. '}In verde: <b>${G.cur.n}</b> (${G.cur.t}): ${G.cur.f}.</p>`:G.res.ok?`<p><b>${G.cur.n}</b> ${G.cur.la?`<i>${G.cur.la}</i>`:''}</p>`:`<p>Hai toccato: <b>${G.res.hit}</b>. In verde: <b>${G.cur.n}</b>.</p>`)+
  `<div class="chips"><button class="chip on" data-g="next">${last?'Vedi risultato':'Avanti'}</button></div>`;
}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||!e.data||!e.data.bm)return;
 if(e.data.type==='game')startGame(e.data.set,e.data);
 else if(e.data.type==='theme')setTheme(e.data.theme,false);
});

/* ---------- sfondo chiaro o scuro (stessa scelta dell'app: localStorage 'dextera-theme') ---------- */
const THEME_KEY='dextera-theme',sysDark=matchMedia('(prefers-color-scheme: dark)');
const isDark=()=>document.documentElement.dataset.theme?document.documentElement.dataset.theme==='dark':sysDark.matches;
function themeBtn(){const d=isDark();$('theme').textContent=d?'☀️ Chiaro':'🌙 Scuro';}
function setTheme(t,store=true){
 if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
 if(store)try{localStorage.setItem(THEME_KEY,t);}catch(e){}
 themeBtn();
}
$('theme').addEventListener('click',()=>setTheme(isDark()?'light':'dark'));
// scelta cambiata nell'app (o in un'altra finestra): l'evento storage arriva qui
window.addEventListener('storage',e=>{if(e.key===THEME_KEY)setTheme(e.newValue,false);});
sysDark.addEventListener('change',themeBtn);themeBtn();

/* ---------- copia offline degli strati ---------- */
// Il service worker dell'app salva tutti gli strati da solo, in sottofondo, appena c'è la rete (fillModels in sw.js);
// qui si vede quanti sono già salvati e si può chiedere di scaricarli subito.
const OFF={files:[...new Set(Object.values(LAYERS).map(l=>l.file))],saved:null,busy:false,err:false};
const offUrl=f=>new URL(f+'.glb',location.href).href;
const hasSW=()=>'caches' in window&&navigator.serviceWorker&&navigator.serviceWorker.controller;
async function offlineCheck(){
 if(!hasSW())return;
 const s=new Set();for(const f of OFF.files)if(await caches.match(offUrl(f)))s.add(f);
 OFF.saved=s;if(S.list==='layers'&&!S.mus&&!S.part)panel();
}
function offlineHtml(){
 if(!hasSW()||!OFF.saved)return '';
 const n=OFF.saved.size,t=OFF.files.length,mb=n===t?'':' (circa 8 MB in tutto)';
 return `<div class="sub">Uso senza connessione</div><p class="mut">Strati salvati sul dispositivo: ${n} di ${t}.${OFF.err?' Download interrotto: serve la connessione.':''}</p>
  ${n<t?`<div class="chips"><button class="chip" data-offall="1"${OFF.busy?' disabled':''}>${OFF.busy?'Scarico…':'⬇️ Scarica tutto per offline'+mb}</button></div>`:''}`;
}
async function offlineAll(){
 OFF.busy=true;OFF.err=false;panel();
 for(const f of OFF.files){
  if(OFF.saved.has(f))continue;
  try{const r=await fetch(offUrl(f));if(!r.ok)throw 0;await r.arrayBuffer();OFF.saved.add(f);}catch(e){OFF.err=true;break;}
  if(S.list==='layers')panel();
 }
 OFF.busy=false;await offlineCheck();panel();
}

/* ---------- pulsanti ---------- */
$('bar').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.v)setView(b.dataset.v);
 else if(b.id==='home')homeView();
 else if(b.id==='outline'){outline=!outline;b.classList.toggle('on',outline);}
 else if(b.id==='layers'){S.mus=S.combo=S.lm=S.part=null;S.list='layers';refresh();offlineCheck();}
 else if(b.id==='brain')openBrain();
 else if(b.dataset.sys)openSys(b.dataset.sys);
});
$('panel').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.pc&&GAME){GAME.sel=GAME.sel===d.pc?null:d.pc;GAME.msg='';panel();return;}
 if(d.g==='clue'){GAME.clues++;panel();return;}
 if(d.g){if(d.g==='next')nextGameQ();else if(d.g==='again')startGame(GAME.set);else if(d.g==='menu'){quitGame();toApp({type:'menu'});}else quitGame();}
 else if(d.mu)showMuscle(d.mu);
 else if(d.offall){if(!OFF.busy)offlineAll();}
 else if(d.combo)showCombo(d.combo);
 else if(d.mv){S.mv=d.mv;refresh();}
 else if(d.lm)showLandmark(LMS.find(l=>l.id===d.lm));
 else if(d.part){const m=byName.get(d.part);if(m)selectPart(m,true);}
 else if(d.find)findPart(d.find);
 else if(d.shell){openBrain().then(()=>{const m=byName.get(d.shell);if(m){S.lev=0;selectPart(m,true);}});}
 else if(d.side){if(S.combo)showCombo(S.combo,d.side);else showMuscle(S.mus,d.side);}
 else if(d.cut)setCut(d.cut);
 else if(d.lev!==undefined)setLevel(+d.lev);
 else if(d.levd)setLevel(Math.max(0,Math.min(ST.length-1,S.lev+ +d.levd)));
 else if(d.go==='brain')openBrain();
 else if(d.sys)openSys(d.sys);
 else if(d.slay){S.lay[S.list][d.slay]=!S.lay[S.list][d.slay];refresh();}
 else if(d.spre){const X=SYS[S.list];for(const k in X.L)S.lay[S.list][k]=X.P[d.spre].includes(k);refresh();flySys(S.list);}
 else if(d.sysoff){S.on[S.list]=false;if(S.solo===S.list)S.solo=null;if(S.cutOn===S.list)S.cut.ax=null;S.list='layers';refresh();}
 else if(d.solo){S.solo=S.solo===d.solo?null:d.solo;if(SYS[S.solo])S.on[S.solo]=true;refresh();}
 else if(d.systog)toggleSys(d.systog);
 else if(d.cutb){S.cutOn='body';setCut(d.cutb);}
 else if(d.go){S.mus=S.combo=S.lm=S.part=null;S.q='';S.list=d.go==='home'?null:d.go;refresh();if(d.go==='layers')offlineCheck();}
 else if(d.hide){if(S.part)S.part.userData.hidden=true;S.part=null;refresh();}
 else if(d.bones){S.bones=d.bones;refresh();}
 else if(d.lmt){S.allLm=!S.allLm;refresh();}
 else if(d.layer)toggleLayer(d.layer);
});
$('panel').addEventListener('input',e=>{
 if(e.target.id==='q'){S.q=e.target.value;panel();}
 else if(e.target.id==='cutr'){S.cut.t=e.target.value/1000;applyCut();}   // senza ridisegnare il pannello: il cursore resta in mano
 else if(e.target.id==='levr')setLevel(+e.target.value);
});

/* ---------- avvio e ciclo di disegno ---------- */
function resize(){
 const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;
 renderer.setSize(w,h,false);effect.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);resize();
try{await loadFile('ossa');}catch(e){$('msg').textContent='Non riesco a caricare il modello: '+e.message;throw e;}
{const box=boxOf(meshes);box.getCenter(center);height=box.getSize(new THREE.Vector3()).y;}
controls.minDistance=height*0.04;controls.maxDistance=height*3.2;
setView('front',false);$('msg').remove();refresh();
toApp({type:'ready'}); // l'app può mandare la richiesta di una partita
// ?vedi=<nome nella fonte> (dalla pagina revisione/): apre il muscolo, il repere o l'osso; per il resto cerca il nome
{const ref=new URLSearchParams(location.search).get('vedi');
 if(ref){const ossa=[...byName.keys()].filter(k=>k===ref||k.replace(/\.[rl]$/,'')===ref),l=LMS.find(l=>l.b===ref);
  if(DATA.mus[ref])showMuscle(ref,'r');else if(l)showLandmark(l);else if(ossa.length)selectPart(byName.get(ossa.find(k=>/\.r$/.test(k))||ossa[0]),true);
  else{S.list='search';S.q=(DATA.names[ref]||[ref])[0];refresh();}}}
let frames=0,last=performance.now();
/* Disegno solo quando serve: prima si ridisegnava 60 volte al secondo anche a modello fermo, e il telefono si scaldava
   (e poi rallentava tutto, anche le altre app). Ora si disegna mentre si tocca o la vista si muove e per 1,5 s dopo ogni
   cambiamento (strati, pannello, partite, caricamenti); con l'app in secondo piano il ciclo si ferma del tutto. */
let awake=0;const wake=(ms=1500)=>{awake=Math.max(awake,performance.now()+ms);};
for(const ev of ['pointerdown','pointermove','pointerup','wheel','keydown','touchstart','touchmove','message','storage'])addEventListener(ev,()=>wake(),{passive:true});
controls.addEventListener('change',()=>wake());new ResizeObserver(()=>wake()).observe(view);
wakeHook=wake;wake(3000);
function loop(now){
 // scheda dell'app nascosta: niente disegno; dopo 20 s si libera anche la memoria grafica
 if(!view.clientHeight){if(!idleSince)idleSince=now;else if(now-idleSince>20000)freeGPU();return;}
 idleSince=0;if(freed){freed=false;for(const m of meshes)if(m.visible)m.userData.gpu=true;} // tornato visibile: le parti si ricaricano al disegno
 if(tween){const k=Math.min(1,(now-tween.s)/450),e=k*k*(3-2*k);
  camera.position.lerpVectors(tween.p0,tween.p1,e);controls.target.lerpVectors(tween.t0,tween.t1,e);if(k>=1)tween=null;wake(300);}
 const moved=controls.update();
 if(!moved&&now>awake){frames=0;last=now;return;} // fermo: niente da ridisegnare
 // i reperi tengono una dimensione leggibile a qualsiasi zoom
 const px=2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/view.clientHeight;
 // con tutti i reperi accesi (o nel gioco) i pallini restano piccoli, sennò a corpo intero coprono lo scheletro
 const many=S.allLm||(GAME&&GAME.set==='reperi');
 for(const l of LMS)if(l.mesh&&l.mesh.visible){const d=camera.position.distanceTo(l.mesh.position);l.mesh.scale.setScalar(many&&l!==S.lm?Math.min(0.004,Math.max(0.001,d*px*2.6)):Math.max(0.0012,d*px*(l===S.lm?7:4.5)));}
 for(const m of pts.children){const d=camera.position.distanceTo(m.position);
  if(m.userData.dot)m.scale.setScalar(Math.max(0.0015,d*px*6));else{const r=Math.max(0.0006,d*px*1.6);m.scale.set(r,m.userData.len,r);}}
 // con una sezione il contorno (facce posteriori ingrandite) riempirebbe di scuro il taglio: lo spengo
 if(outline&&!S.cut.ax)effect.render(scene,camera);else renderer.render(scene,camera);
 frames++;
 if(now-last>=1000){$('fps').textContent=`${Math.round(frames*1000/(now-last))} fps · ${Math.round(renderer.info.render.triangles/1000)}k triangoli`;frames=0;last=now;}
}
renderer.setAnimationLoop(loop);
// memoria grafica: con l'app in secondo piano (o l'atlante non in uso da 20 s) si libera tutta; i modelli restano in memoria
// normale e al primo disegno si ricaricano solo le parti visibili. Così l'app pesa meno sugli altri programmi del telefono.
let idleSince=0,freed=false;
function freeGPU(){if(freed)return;for(const m of meshes){m.geometry.dispose();m.userData.gpu=false;}renderer.renderLists.dispose();freed=true;}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){renderer.setAnimationLoop(null);freeGPU();}
 else{renderer.setAnimationLoop(loop);for(const m of meshes)if(m.visible)m.userData.gpu=true;freed=false;wake();}
});
window.__proto={DATA,S,V,LAYERS,meshes,byName,LMS,poolOf,camera,controls,renderer,refresh,toggleLayer,showMuscle,showCombo,showLandmark,selectPart,findPart,pickPart,pickLandmark,setView,openBrain,setCut,setLevel,pts,startGame,gameTap,poolOf,boneHit,distToArea,get GAME(){return GAME;}};
