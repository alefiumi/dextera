// Strutture che si vedono da fuori ruotando il modello (come nei giochi 3D: seenFrom in atlante.js).
// Apre l'atlante in Chrome senza finestra, chiede all'atlante le serie ossa, muscoli, reperi e origini/inserzioni
// e scrive atlante/build/visibili.json, che usa mappa.py per i passi dei satelliti. Da rifare quando cambiano i .glb.
// Uso: npx serve -l 8765 .   (in un altro terminale, dalla cartella del repository)
//      node atlante/build/visibili.mjs [http://localhost:8765/atlante/index.html]
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const URL_ = process.argv[2] || 'http://localhost:8765/atlante/index.html';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'visibili-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', '--user-data-dir=' + prof, '--no-first-run', '--window-size=900,900', 'about:blank'], {stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:9334/json/version')).json(); break; } catch { await sleep(250); } }
  const page = (await (await fetch('http://127.0.0.1:9334/json')).json()).find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({id: i, method, params})); });
  const ev = async e => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result.result.value; };
  await send('Page.navigate', {url: URL_});
  for (let i = 0; i < 120 && !(await ev('!!(window.__proto&&window.__proto.meshes.length)')); i++) await sleep(500);
  const out = await ev(`(async()=>{const p=window.__proto,r={};
    r.ossa=(await p.poolOf('ossa')).map(i=>i.key).sort();
    r.muscoli=(await p.poolOf('muscoli')).map(i=>i.key).sort();
    r.reperi=(await p.poolOf('reperi')).map(i=>i.key).sort();
    r.oi=(await p.poolOf('oi')).map(i=>i.key).sort();
    return r;})()`);
  const file = path.join(path.dirname(new URL(import.meta.url).pathname), 'visibili.json');
  fs.writeFileSync(file, JSON.stringify({nota: 'Generato da visibili.mjs: strutture visibili da fuori nel modello 3D (seenFrom di atlante.js).', ...out}, null, 1) + '\n');
  console.log('scritto', file, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
  ws.close();
} finally { chrome.kill(); }
