// Disegni 2D ricavati dal modello 3D (Z-Anatomy): proiezione ortografica con z-buffer, una etichetta per pixel,
// poi i contorni di ogni regione visibile diventano tracciati SVG. Niente pacchetti npm: legge da sé i .glb
// (con il decodificatore meshopt di atlante/vendor) e disegna in software.
// Uso: node atlante/build/proietta_2d.mjs <uscita.json>      (poi: python3 atlante/build/contenuti_2d.py)
// Viste: corpo anteriore (a) e posteriore (p); encefalo laterale (emisfero sinistro) e sagittale (faccia mediale del destro).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MeshoptDecoder} from '../vendor/addons/libs/meshopt_decoder.module.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || 'proiezioni.json';
await MeshoptDecoder.ready;

/* ---------- lettura dei .glb (EXT_meshopt_compression, KHR_mesh_quantization) ---------- */
function loadGlb(file) {
  const b = fs.readFileSync(path.join(DIR, file));
  const jl = b.readUInt32LE(12), J = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8);
  const views = J.bufferViews.map(v => {
    const ex = v.extensions && v.extensions.EXT_meshopt_compression;
    if (!ex) return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const out = new Uint8Array(ex.count * ex.byteStride);
    MeshoptDecoder.decodeGltfBuffer(out, ex.count, ex.byteStride, bin.subarray(ex.byteOffset || 0, (ex.byteOffset || 0) + ex.byteLength), ex.mode, ex.filter || 'NONE');
    return out;
  });
  const CT = {5120: [Int8Array, 127], 5121: [Uint8Array, 255], 5122: [Int16Array, 32767], 5123: [Uint16Array, 65535], 5125: [Uint32Array, 0], 5126: [Float32Array, 0]};
  const NC = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};
  function acc(i) {
    const a = J.accessors[i], v = J.bufferViews[a.bufferView], [T, norm] = CT[a.componentType], n = NC[a.type];
    const raw = views[a.bufferView], bs = T.BYTES_PER_ELEMENT, stride = (v.byteStride || n * bs) / bs;
    const src = new T(raw.buffer, raw.byteOffset + (a.byteOffset || 0), Math.floor((raw.byteLength - (a.byteOffset || 0)) / bs));
    const out = new Float32Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      let x = src[k * stride + c]; if (a.normalized && norm) x = Math.max(x / norm, -1); out[k * n + c] = x;
    }
    return out;
  }
  const parts = [];
  for (const nd of J.nodes) {
    if (nd.mesh == null) continue;
    const t = nd.translation || [0, 0, 0], s = nd.scale || [1, 1, 1], q = nd.rotation || [0, 0, 0, 1];
    const [qx, qy, qz, qw] = q;
    const R = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw),
      2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw),
      2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)];
    const tris = [], verts = [];
    for (const p of J.meshes[nd.mesh].primitives) {
      const P = acc(p.attributes.POSITION), I = p.indices != null ? acc(p.indices) : null;
      const W = new Float32Array(P.length);
      for (let k = 0; k < P.length; k += 3) {
        const x = P[k] * s[0], y = P[k + 1] * s[1], z = P[k + 2] * s[2];
        W[k] = R[0] * x + R[1] * y + R[2] * z + t[0]; W[k + 1] = R[3] * x + R[4] * y + R[5] * z + t[1]; W[k + 2] = R[6] * x + R[7] * y + R[8] * z + t[2];
      }
      const n = I ? I.length : P.length / 3, T = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { const v = I ? I[k] : k; T[k * 3] = W[v * 3]; T[k * 3 + 1] = W[v * 3 + 1]; T[k * 3 + 2] = W[v * 3 + 2]; }
      tris.push(T); verts.push(W);
    }
    parts.push({name: nd.name, tris: concat(tris), verts: concat(verts)});
  }
  return parts;
}
const concat = a => { if (a.length === 1) return a[0]; const o = new Float32Array(a.reduce((s, x) => s + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };

/* ---------- proiezione con z-buffer ---------- */
// view: proj(x,y,z) -> [u, v, profondità] (u a destra, v in basso, profondità più grande = più vicino)
// parts: [{tris, lab}] (lab = etichetta intera >0; oppure labOf(tri centro) per dividere una parte)
// frame: {u0, v0, w, h} per disegnare nello stesso riferimento di un'altra immagine (sagome intere delle singole ossa)
function render(parts, proj, pxPerM, frame) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, w, h;
  if (frame) ({u0, v0, w, h} = frame);
  else {
    for (const p of parts) for (let k = 0; k < p.tris.length; k += 3) {
      const [u, v] = proj(p.tris[k], p.tris[k + 1], p.tris[k + 2]);
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const pad = 0.01; u0 -= pad; v0 -= pad; u1 += pad; v1 += pad;
    w = Math.ceil((u1 - u0) * pxPerM); h = Math.ceil((v1 - v0) * pxPerM);
  }
  const L = new Int32Array(w * h), D = new Float32Array(w * h).fill(-Infinity);
  const P = new Float32Array(9);
  for (const p of parts) {
    const T = p.tris;
    for (let k = 0; k < T.length; k += 9) {
      for (let j = 0; j < 3; j++) { const [u, v, d] = proj(T[k + j * 3], T[k + j * 3 + 1], T[k + j * 3 + 2]); P[j * 3] = (u - u0) * pxPerM; P[j * 3 + 1] = (v - v0) * pxPerM; P[j * 3 + 2] = d; }
      const lab = p.labOf ? p.labOf(T[k] + T[k + 3] + T[k + 6], T[k + 1] + T[k + 4] + T[k + 7], T[k + 2] + T[k + 5] + T[k + 8]) : p.lab;
      const ax = P[0], ay = P[1], bx = P[3], by = P[4], cx = P[6], cy = P[7];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-9) continue;
      const xa = Math.max(0, Math.floor(Math.min(ax, bx, cx))), xb = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
      const ya = Math.max(0, Math.floor(Math.min(ay, by, cy))), yb = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = ya; y <= yb; y++) { const py = y + 0.5;
        for (let x = xa; x <= xb; x++) { const px = x + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const d = w0 * P[2] + w1 * P[5] + w2 * P[8], i = y * w + x;
          if (d > D[i]) { D[i] = d; L[i] = lab; }
        } }
    }
  }
  return {L, D, w, h, u0, v0, pxPerM};
}

/* ---------- contorni: bordi tra pixel di etichetta diversa, concatenati in anelli, poi semplificati ---------- */
function trace(R, minArea = 6, tol = 0.75) {
  const {L, w, h} = R, W1 = w + 1, edges = new Map(); // etichetta -> Map(angolo -> [angoli])
  const add = (lab, a, b) => { let m = edges.get(lab); if (!m) edges.set(lab, m = new Map()); const l = m.get(a); if (l) l.push(b); else m.set(a, [b]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = L[y * w + x]; if (!a) continue;
    if (y === 0 || L[(y - 1) * w + x] !== a) add(a, y * W1 + x, y * W1 + x + 1);
    if (x === w - 1 || L[y * w + x + 1] !== a) add(a, y * W1 + x + 1, (y + 1) * W1 + x + 1);
    if (y === h - 1 || L[(y + 1) * w + x] !== a) add(a, (y + 1) * W1 + x + 1, (y + 1) * W1 + x);
    if (x === 0 || L[y * w + x - 1] !== a) add(a, (y + 1) * W1 + x, y * W1 + x);
  }
  const out = new Map();
  for (const [lab, m] of edges) {
    const loops = [];
    for (const start of [...m.keys()]) {
      while (m.has(start)) {
        const pts = []; let c = start;
        for (;;) {
          const l = m.get(c); if (!l) break;
          const n = l.pop(); if (!l.length) m.delete(c);
          pts.push([c % W1, Math.floor(c / W1)]); c = n; if (c === start) break;
        }
        // punti medi dei lati: toglie la scalettatura dei pixel
        const mid = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
        let ar = 0; for (let i = 0; i < mid.length; i++) { const p = mid[i], q = mid[(i + 1) % mid.length]; ar += p[0] * q[1] - q[0] * p[1]; }
        if (Math.abs(ar / 2) < minArea) continue;
        loops.push(simplify(mid, tol));
      }
    }
    out.set(lab, loops);
  }
  return out;
}
function simplify(pts, tol) { // Douglas-Peucker su anello chiuso
  if (pts.length < 8) return pts;
  let far = 0, fd = -1; for (let i = 1; i < pts.length; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const dp = (a) => {
    const keep = new Uint8Array(a.length); keep[0] = keep[a.length - 1] = 1; const st = [[0, a.length - 1]];
    while (st.length) { const [i, j] = st.pop(); let md = -1, mk = -1; const [x1, y1] = a[i], [x2, y2] = a[j], dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1e-12;
      for (let k = i + 1; k < j; k++) { const t = Math.max(0, Math.min(1, ((a[k][0] - x1) * dx + (a[k][1] - y1) * dy) / l2)); const d = (a[k][0] - x1 - t * dx) ** 2 + (a[k][1] - y1 - t * dy) ** 2; if (d > md) { md = d; mk = k; } }
      if (md > tol * tol) { keep[mk] = 1; st.push([i, mk], [mk, j]); } }
    return a.filter((_, k) => keep[k]);
  };
  const A = dp(pts.slice(0, far + 1)), B = dp([...pts.slice(far), pts[0]]);
  return [...A, ...B.slice(1, -1)];
}
// anelli in unità della figura -> tracciato SVG relativo con un decimale (ox, oy: spostamento in unità della figura)
function toPath(loops, k, ox = 0, oy = 0) {
  let s = '', px = 0, py = 0;
  for (const lp of loops) {
    lp.forEach((p, i) => {
      const x = Math.round((p[0] * k + ox) * 10), y = Math.round((p[1] * k + oy) * 10);
      if (i === 0) s += 'M' + (x / 10) + ' ' + (y / 10); else { const dx = (x - px) / 10, dy = (y - py) / 10; s += 'l' + dx + (dy < 0 ? '' : ' ') + dy; }
      px = x; py = y;
    });
    s += 'z';
  }
  return s.replace(/ -/g, '-');
}

/* ---------- etichette ---------- */
const side = n => n.endsWith('.r') ? 'r' : n.endsWith('.l') ? 'l' : '';
const base = n => n.replace(/\.(r|l)$/, '').trim();
function labeler() { const ids = new Map(), names = []; return {id(k) { if (!ids.has(k)) { ids.set(k, names.length + 1); names.push(k); } return ids.get(k); }, names}; }
// centri per etichetta e lato (in pixel), per etichette e linee dei muscoli
function centers(R, labSide) {
  const acc = new Map();
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const l = R.L[y * R.w + x]; if (!l) continue; const s = labSide ? labSide(l, x / R.w) : ''; const k = l + '|' + s; const a = acc.get(k) || [0, 0, 0]; a[0] += x; a[1] += y; a[2]++; acc.set(k, a); }
  return acc;
}

/* ---------- sagoma intera di un osso (senza ciò che lo copre), nello stesso riferimento di R ---------- */
// Serve per i pezzi del puzzle (una costa intera, non i tratti che si vedono tra le altre) e per sapere quanta
// parte dell'osso si vede in una vista (vis = pixel visibili / pixel della sagoma).
function solo(parts, proj, R) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) for (let k = 0; k < p.tris.length; k += 3) {
    const [u, v] = proj(p.tris[k], p.tris[k + 1], p.tris[k + 2]), x = (u - R.u0) * R.pxPerM, y = (v - R.v0) * R.pxPerM;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2;
  const w = Math.ceil(x1) - x0 + 3, h = Math.ceil(y1) - y0 + 3;
  const S = render(parts.map(p => ({tris: p.tris, lab: 1})), proj, R.pxPerM, {u0: R.u0 + x0 / R.pxPerM, v0: R.v0 + y0 / R.pxPerM, w, h});
  let n = 0; for (let i = 0; i < S.L.length; i++) if (S.L[i]) n++;
  return {loops: trace(S).get(1) || [], x0, y0, n};
}
function soloOut(parts, proj, R, k, ox, oy) {
  const so = solo(parts, proj, R), d = toPath(so.loops, k, so.x0 * k + ox, so.y0 * k + oy);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const lp of so.loops) for (const [x, y] of lp) { const X = (x + so.x0) * k + ox, Y = (y + so.y0) * k + oy; bx0 = Math.min(bx0, X); by0 = Math.min(by0, Y); bx1 = Math.max(bx1, X); by1 = Math.max(by1, Y); }
  return {d, b: [+bx0.toFixed(1), +by0.toFixed(1), +(bx1 - bx0).toFixed(1), +(by1 - by0).toFixed(1)], n: so.n};
}
// assi principali di una nuvola di punti (autovettori della covarianza, dal più lungo al più corto), metodo di Jacobi
function axes(V) {
  const m = [0, 0, 0], n = V.length / 3; for (let k = 0; k < V.length; k += 3) for (let c = 0; c < 3; c++) m[c] += V[k + c] / n;
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let k = 0; k < V.length; k += 3) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i][j] += (V[k + i] - m[i]) * (V[k + j] - m[j]) / n;
  const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(A[p][q]) < 1e-15) continue;
    const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), sn = t * c;
    for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - sn * b; A[k][q] = sn * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - sn * b; A[q][k] = sn * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = E[k][p], b = E[k][q]; E[k][p] = c * a - sn * b; E[k][q] = sn * a + c * b; }
  }
  return [0, 1, 2].map(i => ({l: A[i][i], v: [E[0][i], E[1][i], E[2][i]]})).sort((a, b) => b.l - a.l).map(a => a.v);
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const neg = a => a.map(x => -x);
const centroid = parts => { const m = [0, 0, 0]; let n = 0; for (const p of parts) for (let k = 0; k < p.verts.length; k += 3) { m[0] += p.verts[k]; m[1] += p.verts[k + 1]; m[2] += p.verts[k + 2]; n++; } return m.map(x => x / n); };

/* ---------- più viste di un insieme di parti, nello stesso spazio ---------- */
// parts: [{tris, verts, key (nome della struttura), side ('r', 'l' o '')}]; views: {v: {proj, prim (lato principale), keep?}}
// Ogni lato è un'etichetta a sé, così i due lati di una struttura pari hanno tracciati separati: il primo è quello del
// lato principale della vista (il destro, o il sinistro guardando da sinistra), usato per i pezzi del puzzle.
// Tutte le viste hanno la stessa scala (la più larga occupa 300 unità) e stanno al centro di uno spazio 300×H.
const SIDES = (prim) => [prim, prim === 'r' ? 'l' : 'r', ''];
function project(parts, views, px, minArea = 6, tol = 0.75, label = 'viste') {
  const lb = labeler();
  for (const p of parts) p.lab2 = lb.id(p.key + '|' + p.side);
  for (const p of parts) if (p.split) { const a = p.lab2, b = lb.id(p.split.key + '|' + p.side), f = p.split.f; p.labOf = (x, y, z) => f(x / 3, y / 3, z / 3) ? b : a; }
  const info = {};
  for (const [v, V] of Object.entries(views)) {
    const ps = V.keep ? parts.filter(V.keep) : parts;
    info[v] = {...V, ps, R: render(ps.map(p => ({tris: p.tris, lab: p.lab2, labOf: p.labOf})), V.proj, px)};
  }
  const k = 300 / Math.max(...Object.values(info).map(i => i.R.w)), H = Math.round(Math.max(...Object.values(info).map(i => i.R.h)) * k);
  const out = {W: 300, H, views: {}};
  for (const [v, I] of Object.entries(info)) {
    const R = I.R; I.k = k; I.ox = (300 - R.w * k) / 2; I.oy = (H - R.h * k) / 2;
    const loops = trace(R, minArea, tol), C = centers(R), res = {};
    const byName = {};
    for (const [lab, lp] of loops) { const [name, sd] = lb.names[lab - 1].split('|'); (byName[name] ||= {})[sd] = {lab, lp}; }
    for (const [name, bySide] of Object.entries(byName)) {
      const order = SIDES(I.prim).filter(sd => bySide[sd]);
      const cnt = sd => (C.get(bySide[sd].lab + '|') || [0, 0, 0])[2];
      // lato della sagoma intera e della quota visibile: il principale se la struttura ce l'ha, altrimenti l'altro
      const have = SIDES(I.prim).filter(sd => I.ps.some(p => p.key === name && p.side === sd));
      const sd0 = have[0], mine = I.ps.filter(p => p.key === name && p.side === sd0);
      const cs = order.find(sd => cnt(sd) > 20) || order[0], a = C.get(bySide[cs].lab + '|');
      const d = order.map(sd => toPath(bySide[sd].lp, k, I.ox, I.oy));
      // una parte ricavata dividendone un'altra (Wernicke) non ha una sagoma propria: vale quella disegnata
      const full = mine.length ? soloOut(mine, I.proj, R, k, I.ox, I.oy) : null;
      res[name] = {d, c: [+(a[0] / a[2] * k + I.ox).toFixed(1), +(a[1] / a[2] * k + I.oy).toFixed(1)],
        full: full ? {d: full.d, b: full.b} : null, vis: full ? +Math.min(1, (bySide[sd0] ? cnt(sd0) : 0) / Math.max(1, full.n)).toFixed(2) : 1};
    }
    out.views[v] = res;
    console.log(label, v, R.w + '×' + R.h, Object.keys(res).length, 'strutture visibili');
  }
  return {out, info};
}

/* ---------- corpo: ossa in sei viste ---------- */
const SKIP = /(cells of ethmoid|Sinus of|Incus|Malleus|Stapes|cartilage(?! of .* rib)|Arytenoid|Corniculate|Cricoid|Thyroid|alar|Sesamoid)/i;
const ossa = loadGlb('ossa.glb').filter(p => !SKIP.test(p.name));
const bodyLab = labeler();
const keyOf = n => /(incisor|canine|premolar|molar)/i.test(n) ? 'Teeth' : /Costal cartilage/.test(n) ? 'Costal cartilages' : base(n);
for (const p of ossa) { p.lab = bodyLab.id(keyOf(p.name)); p.key = keyOf(p.name); p.side = side(p.name); }
const PX_BODY = 2200; // pixel per metro (2,2 per mm)
// u a destra, v in basso, profondità più grande = più vicino a chi guarda. Assi: Y in alto, +Z davanti, −X lato destro.
const VIEWS6 = {
  a: (x, y, z) => [x, -y, z],    // anteriore: il destro del corpo a sinistra
  p: (x, y, z) => [-x, -y, -z],  // posteriore
  ld: (x, y, z) => [z, -y, -x],  // dal lato destro: davanti a destra
  ls: (x, y, z) => [-z, -y, x],  // dal lato sinistro: davanti a sinistra
  s: (x, y, z) => [-x, -z, y],   // dall'alto: davanti in alto, destro a destra
  i: (x, y, z) => [x, -z, -y]};  // dal basso: davanti in alto, destro a sinistra
const prim6 = v => v === 'ls' ? 'l' : 'r';
const body = {names: bodyLab.names, areas: {}};
const BP = project(ossa, Object.fromEntries(Object.entries(VIEWS6).map(([v, proj]) => [v, {proj, prim: prim6(v)}])), PX_BODY, 6, 0.75, 'corpo');
Object.assign(body, {W: BP.out.W, H: BP.out.H, views: BP.out.views});
const bodyR = BP.info;

/* ---------- viste di zona: mano (palmare, dorsale) e piede (dall'alto, dal basso), solo il lato destro ---------- */
// Nella vista anteriore del corpo la mano e soprattutto il piede si vedono di scorcio (le dita del piede puntano verso
// chi guarda): per il puzzle e per le domande sulle ossa piccole si usa una vista perpendicolare alla zona, ricavata
// dagli assi principali delle sue ossa. Disegno centrato e ingrandito nello stesso spazio 300×H della figura.
body.zviews = {};
{
  const HAND = /^(Scaphoid|Lunate|Triquetrum|Pisiform|Trapezium|Trapezoid|Capitate|Hamate) bone$|metacarpal bone$|phalanx of .* of hand$/;
  const FOOT = /^(Talus|Calcaneus|Navicular bone|Cuboid bone|(Medial|Intermediate|Lateral) cuneiform bone)$|metatarsal bone$|phalanx of .* of foot$/;
  const PX_Z = 8000;
  for (const [zone, rx, proxRx, distRx, views] of [
    // mano: in alto il polso; palmare = da davanti nella posizione anatomica
    ['mano', HAND, / bone$/, /phalanx/, [['mp', n => n[2] > 0 ? n : neg(n)], ['md', n => n[2] > 0 ? neg(n) : n]]],
    // piede: in alto le dita; dall'alto (dorso) e dal basso (pianta)
    ['piede', FOOT, /^Calcaneus$/, /phalanx/, [['pd', n => n[1] > 0 ? n : neg(n)], ['pp', n => n[1] > 0 ? neg(n) : n]]]]) {
    const parts = ossa.filter(p => side(p.name) === 'r' && rx.test(base(p.name)));
    const ax = axes(concat(parts.map(p => p.verts)));
    const prox = centroid(parts.filter(p => proxRx.test(base(p.name)))), dist = centroid(parts.filter(p => distRx.test(base(p.name))));
    const toward = zone === 'mano' ? prox.map((x, i) => x - dist[i]) : dist.map((x, i) => x - prox[i]);
    const up = dot(ax[0], toward) > 0 ? ax[0] : neg(ax[0]);
    for (const [key, orient] of views) {
      const n = orient(ax[2]), right = cross(up, n);
      const proj = (x, y, z) => { const p = [x, y, z]; return [dot(p, right), -dot(p, up), dot(p, n)]; };
      const R = render(parts, proj, PX_Z), loops = trace(R), C = centers(R);
      const k = Math.min(270 / R.w, 300 / R.h), ox = (300 - R.w * k) / 2, oy = (body.H - R.h * k) / 2;
      const out = {};
      for (const [lab, lp] of loops) {
        const name = bodyLab.names[lab - 1], a = C.get(lab + '|'), full = soloOut(parts.filter(p => p.lab === lab), proj, R, k, ox, oy);
        out[name] = {d: toPath(lp, k, ox, oy), c: a ? [+(a[0] / a[2] * k + ox).toFixed(1), +(a[1] / a[2] * k + oy).toFixed(1)] : null, full: {d: full.d, b: full.b}, vis: +Math.min(1, (a ? a[2] : 0) / Math.max(1, full.n)).toFixed(2)};
      }
      body.zviews[key] = out;
      console.log('zona', key, R.w + '×' + R.h, Object.keys(out).length, 'ossa visibili, scala', k.toFixed(3));
    }
  }
}

/* ---------- aree di origine e inserzione: osso su cui stanno e punto visibile in ogni vista ---------- */
{
  const grid = new Map(), G = 0.01; // griglia di 1 cm con i vertici delle ossa
  for (const p of ossa) { const V = p.verts; for (let k = 0; k < V.length; k += 3) { const key = Math.floor(V[k] / G) + ',' + Math.floor(V[k + 1] / G) + ',' + Math.floor(V[k + 2] / G); let c = grid.get(key); if (!c) grid.set(key, c = []); c.push(V[k], V[k + 1], V[k + 2], p.lab); } }
  const nearest = (x, y, z) => { let bd = 1e9, bl = 0; const gx = Math.floor(x / G), gy = Math.floor(y / G), gz = Math.floor(z / G);
    for (let r = 0; r <= 2 && bl === 0; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) { const c = grid.get((gx + i) + ',' + (gy + j) + ',' + (gz + k)); if (!c) continue; for (let m = 0; m < c.length; m += 4) { const d = (c[m] - x) ** 2 + (c[m + 1] - y) ** 2 + (c[m + 2] - z) ** 2; if (d < bd) { bd = d; bl = c[m + 3]; } } }
    return bl; };
  for (const p of loadGlb('inserzioni.glb')) {
    const V = p.verts, votes = new Map();
    for (let k = 0; k < V.length; k += 3) { const l = nearest(V[k], V[k + 1], V[k + 2]); if (l) votes.set(l, (votes.get(l) || 0) + 1); }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0]; if (!best) continue;
    const a = {bone: bodyLab.names[best[0] - 1], n: V.length / 3};
    for (const [v, {R, proj, k: kk, ox, oy}] of Object.entries(bodyR)) { // visibile = almeno un vertice non coperto (3 mm di tolleranza)
      let sx = 0, sy = 0, n = 0;
      for (let k = 0; k < V.length; k += 3) { const [u, w, d] = proj(V[k], V[k + 1], V[k + 2]); const x = Math.floor((u - R.u0) * R.pxPerM), y = Math.floor((w - R.v0) * R.pxPerM); if (x < 0 || y < 0 || x >= R.w || y >= R.h) continue; if (d >= R.D[y * R.w + x] - 0.003) { sx += x; sy += y; n++; } }
      if (n) a[v] = [+(sx / n * kk + ox).toFixed(1), +(sy / n * kk + oy).toFixed(1)];
    }
    body.areas[p.name] = a;
  }
  console.log('aree', Object.keys(body.areas).length);
}

/* ---------- encefalo: sei viste ---------- */
// esclusi: occhio e i nuclei profondi (nuclei della base, nuclei dei nervi cranici…), che in una vista di superficie
// o in una sezione mediana non si vedono: dove la fonte lascia spazi tra le superfici comparirebbero per errore
const DEEP = /(eyeball|nucleus|Vestibular nuclei|Putamen|Globus pallidus|Amygdaloid|Stria terminalis)/i;
// ipofisi ed epifisi nella fonte stanno tra i visceri (ghiandole endocrine)
const enc = [...loadGlb('encefalo.glb').filter(p => !DEEP.test(p.name)), ...loadGlb('visceri.glb').filter(p => /^(Adenohypophysis|Neurohypophysis|Pineal gland)$/.test(p.name))];
for (const p of enc) { p.key = base(p.name); p.side = side(p.name); }
{
  // Area di Wernicke: terzo posteriore del giro temporale superiore sinistro (confine approssimato, la fonte non la separa)
  const stg = enc.find(p => p.name === 'Superior temporal gyrus (Lateral part).l');
  let z0 = Infinity, z1 = -Infinity; for (let k = 2; k < stg.tris.length; k += 3) { z0 = Math.min(z0, stg.tris[k]); z1 = Math.max(z1, stg.tris[k]); }
  const zW = z0 + (z1 - z0) / 3;
  stg.split = {key: 'Wernicke area', f: (x, y, z) => z < zW};
}
// ls/ld: emisfero sinistro o destro visto di lato; m: faccia mediale dell'emisfero destro (sezione sagittale, come prima);
// f: da davanti; p: da dietro; s: dall'alto; i: dal basso. Nelle viste con i due emisferi il lato principale è il sinistro (linguaggio).
const brainP = project(enc, {
  ls: {proj: VIEWS6.ls, prim: 'l'}, ld: {proj: VIEWS6.ld, prim: 'r'},
  m: {proj: VIEWS6.ls, prim: 'r', keep: p => p.side !== 'l'},
  f: {proj: VIEWS6.a, prim: 'l'}, p: {proj: VIEWS6.p, prim: 'l'}, s: {proj: VIEWS6.s, prim: 'l'}, i: {proj: VIEWS6.i, prim: 'l'}}, 5000, 4, 0.7, 'encefalo');
const brain = brainP.out;

/* ---------- apparato cardiovascolare e respiratorio: due moduli ---------- */
// stesse regole di organo() in torace.py e organOf() in atlante.js. Esclusi dal 2D: pleura (coprirebbe i lobi) e valvole
// (sono dentro il cuore); i vasi polmonari e i bronchi segmentari stanno nei lobi e si vedono nelle viste dell'albero bronchiale.
const DATI = JSON.parse(fs.readFileSync(path.join(DIR, 'dati.json')));
const CUORE_G = new Set(['Heart', 'Right ventricle', 'Left ventricle', 'Aortic valve', 'Pulmonary valve', 'Right atrioventricular valve', 'Arteries of heart', 'Left coronary artery', 'Right coronary artery', 'Anterior interventricular artery', 'Cardiac veins', 'Coronary sinus']);
const GRANDI = new Set(['Ascending aorta', 'Aortic arch', 'Thoracic aorta', 'Brachiocephalic trunk', 'Left common carotid artery', 'Left subclavian artery', 'Superior vena cava', 'Inferior vena cava (thoracic part)', 'Left brachiocephalic vein', 'Right brachiocephalic vein', 'Azygos vein']);
const PGRANDI = new Set(['Pulmonary trunk', 'Bifurcation of pulmonary trunk', 'Left pulmonary artery', 'Right pulmonary artery', 'Left superior pulmonary vein', 'Left inferior pulmonary vein', 'Right superior pulmonary vein', 'Right inferior pulmonary vein']);
const VALV_G = new Set(['Aortic valve', 'Pulmonary valve', 'Right atrioventricular valve']);
const VENA = /vein|venous|vena|sinus|plexus/i;
function organo(b, layer, g) {
  if (b.startsWith('?')) return null;
  if (layer === 'vasi') {
    if (VALV_G.has(g) || /papillary/.test(b)) return 'valvole';
    if (g === 'Heart') return 'cuore';
    if (CUORE_G.has(g) || /^(Coronary sinus|Left coronary artery|Right coronary artery)$/.test(b)) return 'coronarie';
    if (GRANDI.has(b)) return 'grandi';
    if (PGRANDI.has(b)) return 'pgrandi';
    if (/of (left|right) lung|lobar artery/.test(b)) return 'vpolm';
    return VENA.test(b + ' ' + g) ? 'vene' : 'arterie';
  }
  if (layer === 'visceri') {
    if (b === 'Pleura') return 'pleura';
    if (g === 'Left lung' || g === 'Right lung') return 'polmoni';
    if (b === 'Trachea' || /bronch/i.test(b)) return 'vie';
  }
  return null;
}
const parts2 = [...loadGlb('vasi.glb'), ...loadGlb('visceri.glb')].filter(p => {
  const o = DATI.objs[p.name]; p.key = base(p.name); p.side = side(p.name);
  p.org = o && organo(p.key, o[0], o[2]); p.vena = o && VENA.test(p.key + ' ' + o[2]);
  return p.org && p.org !== 'pleura' && p.org !== 'valvole';
});
// regione del corpo di un vaso (gruppi del modulo 2D): dal centro della parte rispetto a sterno, omero e femore
const bbox = rx => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const p of ossa) if (rx.test(p.name)) for (let k = 0; k < p.tris.length; k += 3) for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], p.tris[k + a]); b[a + 3] = Math.max(b[a + 3], p.tris[k + a]); } return b; };
const neckY = bbox(/^Manubrium of sternum/)[4], shX = Math.abs(bbox(/^Humerus\.r$/)[3]) - 0.03, hipY = bbox(/^Femur/)[4];
// sotto l'anca le mani stanno più in fuori delle gambe
const legX = Math.max(...['Femur', 'Tibia', 'Fibula', 'Calcaneus'].map(n => { const b = bbox(new RegExp('^' + n + '\\.r$')); return Math.max(Math.abs(b[0]), Math.abs(b[3])); }));
const region = {};
for (const p of parts2) {
  let x = 0, y = 0, n = 0; for (let k = 0; k < p.tris.length; k += 3) { x += p.tris[k]; y += p.tris[k + 1]; n++; } x = Math.abs(x / n); y /= n;
  const r = y > neckY && x < shX ? 'testa' : x >= shX && y > hipY ? 'arto-sup' : y < hipY && x > legX + 0.02 ? 'arto-sup' : y < hipY - 0.04 ? 'arto-inf' : 'tronco';
  region[p.key] ??= /axillary|subclavian/i.test(p.key) ? 'arto-sup' : r; // ascellari e succlavie: vasi dell'arto superiore
}
const heartP = p => ['cuore', 'coronarie', 'grandi', 'pgrandi'].includes(p.org);
const onlyHeart = p => ['cuore', 'coronarie'].includes(p.org);
const arter = p => p.org === 'cuore' || p.org === 'arterie' || (/grandi/.test(p.org) && !p.vena);
const venae = p => p.org === 'cuore' || p.org === 'vene' || (/grandi/.test(p.org) && p.vena);
const cuoreP = project(parts2.filter(p => p.org !== 'polmoni' && p.org !== 'vie' && p.org !== 'vpolm'), {
  a: {proj: VIEWS6.a, prim: 'r', keep: heartP}, p: {proj: VIEWS6.p, prim: 'r', keep: heartP},
  ld: {proj: VIEWS6.ld, prim: 'r', keep: heartP}, ls: {proj: VIEWS6.ls, prim: 'l', keep: heartP},
  c: {proj: VIEWS6.a, prim: 'r', keep: onlyHeart}, cp: {proj: VIEWS6.p, prim: 'r', keep: onlyHeart},
  ar: {proj: VIEWS6.a, prim: 'r', keep: arter}, ve: {proj: VIEWS6.a, prim: 'r', keep: venae}}, 6000, 3, 0.7, 'cuore');
const cuore = {...cuoreP.out, region};
const outer = p => p.org === 'polmoni' || p.org === 'vie';
const tree = p => p.org === 'vie' || p.org === 'vpolm' || p.org === 'pgrandi';
const polmP = project(parts2.filter(p => ['polmoni', 'vie', 'vpolm', 'pgrandi'].includes(p.org)), {
  a: {proj: VIEWS6.a, prim: 'r', keep: outer}, p: {proj: VIEWS6.p, prim: 'r', keep: outer},
  ld: {proj: VIEWS6.ld, prim: 'r', keep: outer}, ls: {proj: VIEWS6.ls, prim: 'l', keep: outer},
  b: {proj: VIEWS6.a, prim: 'r', keep: tree}, bt: {proj: VIEWS6.a, prim: 'r', keep: p => p.org === 'vie'}}, 4000, 4, 0.7, 'polmoni');
const polmoni = polmP.out;

fs.writeFileSync(OUT, JSON.stringify({body, brain, cuore, polmoni}));
console.log('scritto', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
