"""Testi anatomici verificabili: legge testi/ e li applica ai file generati.

Ogni dato anatomico (nome, descrizione, origine, inserzione, azione, innervazione, testi di gruppi e casi) sta in testi/,
con id stabile, valore, fonte e stato di verifica; le correzioni alla fonte stanno in testi/correzioni.json, ognuna con
il motivo. atlante/dati.json e content/ sono generati: non si correggono mai a mano.

Uso:  python3 atlante/build/testi.py
      1. applica testi e correzioni ad atlante/dati.json (nomi, descrizioni, schede dei muscoli, aree di origine e
         inserzione, gruppi di muscoli e strati dell'encefalo, parti da specchiare). Non serve Blender: si parte dal
         dati.json esistente e tutto è idempotente (si può rifare quante volte si vuole);
      2. scrive content/nervi-cranici.json, content/neuro-strutture.json e content/lezioni.json (dati del percorso:
         reperi con nome, descrizione e osso del 2D; per ogni struttura della mappa l'id della sua voce in testi/;
         stato dei dati già verificati, corretti o segnalati);
      3. rifà i moduli 2D (node proietta_2d.mjs, poi contenuti_2d.py) e aumenta le versioni dei file cambiati
         e quella di content/index.json.
Gli altri script (za_dati.py, contenuti_2d.py) importano questo modulo per leggere i testi.
"""
import json, re, os, sys, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
TESTI = os.path.join(ROOT, 'testi')
TIPI = ['muscoli', 'ossa', 'reperi', 'encefalo', 'torace', 'nervi-cranici', 'gruppi', 'casi', 'neuro']
STATI = ['da verificare', 'verificato', 'corretto', 'segnalato']
FONTI = ['Z-Anatomy', 'TA2', 'AI', 'docente', 'lezione']   # lezione: materiale del corso (guida e slide del docente)

_cache = {}
def carica(tipo):
    """voci di testi/<tipo>.json (con 'correzioni' le correzioni alla fonte)"""
    if tipo not in _cache: _cache[tipo] = json.load(open(os.path.join(TESTI, tipo + '.json')))
    return _cache[tipo]['voci']
def val(voce, campo, default=None):
    d = voce.get('dati', {}).get(campo)
    return d['valore'] if d else default
def per_ref(tipo):
    return {v['ref']: v for v in carica(tipo)}
def scrivi_file(tipo, obj):
    """riscrive testi/<tipo>.json nel formato del repository: una voce per riga di intestazione, un dato per riga"""
    L = ['{']
    for k, v in obj.items():
        if k != 'voci': L.append(' %s: %s,' % (json.dumps(k), json.dumps(v, ensure_ascii=False)))
    L.append(' "voci": [')
    for i, vo in enumerate(obj['voci']):
        fine = ',' if i < len(obj['voci']) - 1 else ''
        if 'dati' not in vo: L.append('  ' + json.dumps(vo, ensure_ascii=False) + fine); continue
        head = {k: v for k, v in vo.items() if k != 'dati'}
        L.append('  ' + json.dumps(head, ensure_ascii=False)[:-1] + ', "dati": {')
        items = list(vo['dati'].items())
        for j, (c, d) in enumerate(items):
            L.append('   %s: %s%s' % (json.dumps(c), json.dumps(d, ensure_ascii=False), ',' if j < len(items) - 1 else ''))
        L.append('  }}' + fine)
    L += [' ]', '}']
    open(os.path.join(TESTI, tipo + '.json'), 'w').write('\n'.join(L) + '\n')
    _cache.pop(tipo, None)
def file_intero(tipo):
    carica(tipo); return _cache[tipo]
def correzioni(tipo=None):
    return [c for c in carica('correzioni') if tipo is None or c['tipo'] == tipo]

# ---------------------------------------------------------------- correzioni alla fonte
def refuso(t):
    """refusi della traduzione italiana di TA2 (una sostituzione per testo, come prima)"""
    if not isinstance(t, str): return t
    for c in correzioni('refuso'):
        if c['cerca'] in t: return t.replace(c['cerca'], c['sostituisci'])
    return t

KIND = re.compile(r'\.([oe])\d*[rl]$')
def correggi_aree(mus, ordine):
    """Aree di origine (o) e inserzione (e) dei muscoli. Si riparte ogni volta dalla fonte (il tipo dell'area è nel suo
    nome: .o… origine, .e… inserzione) e si applicano le correzioni nell'ordine del file: così è idempotente.
    ordine: nomi delle parti nell'ordine del modello (per tenere le liste nello stesso ordine di sempre)."""
    pos = {n: i for i, n in enumerate(ordine)}
    cs = [c for c in correzioni() if c['tipo'] in ('inverti_aree', 'aree_origine', 'sposta_aree')]
    for r, m in mus.items():
        aree = sorted(set(m['o']) | set(m['e']), key=lambda a: pos.get(a, len(pos)))
        o = [a for a in aree if KIND.search(a).group(1) == 'o']; e = [a for a in aree if KIND.search(a).group(1) == 'e']; fix = False
        for c in cs:
            if c['muscolo'] != r: continue
            if c['tipo'] == 'inverti_aree': o, e = e, o; fix = True
            elif c['tipo'] == 'aree_origine':
                st = [a for a in e if a.startswith(c['prefisso'])]
                if st: e = [a for a in e if a not in st]; o = o + st; fix = True
            elif c['tipo'] == 'sposta_aree':
                for a, dove in c['aree'].items():
                    da, a_ = (e, o) if dove == 'o' else (o, e)
                    if a in da: da.remove(a); a_.append(a); fix = True
        m['o'], m['e'] = o, e
        if fix: m['fix'] = 1
        else: m.pop('fix', None)

# ---------------------------------------------------------------- applicazione ad atlante/dati.json
B = lambda n: re.sub(r'\.(?:[oe]\d*[rl]|[rl]|[a-z])$', '', n)

def card_of(v):
    c = {}
    for k, campo in (('ot', 'origine'), ('it', 'inserzione'), ('a', 'azione'), ('nv', 'innervazione'), ('nota', 'nota')):
        x = val(v, campo)
        if x: c[k] = x
    return c

def schede_muscoli(mus):
    """nome, nome latino e scheda (origine, inserzione, azione, innervazione) di ogni muscolo"""
    for v in carica('muscoli'):
        m = mus.get(v['ref'])
        if not m: continue
        if val(v, 'nome'): m['n'] = val(v, 'nome')
        m['la'] = val(v, 'latino', m.get('la', ''))
        c = card_of(v)
        if c: m['card'] = c

def nomi(D):
    """nomi italiani e latini di ossa, reperi, strutture dell'encefalo e del torace; poi i refusi di TA2 su tutti i nomi"""
    for tipo in ('ossa', 'reperi', 'encefalo', 'torace'):
        for v in carica(tipo):
            if v['ref'] in D['names'] and val(v, 'nome'):
                D['names'][v['ref']][0] = val(v, 'nome')
                if val(v, 'latino') is not None: D['names'][v['ref']][1] = val(v, 'latino')
    for v in D['names'].values(): v[0] = refuso(v[0])
    for m in D['mus'].values(): m['n'] = refuso(m['n'])

def descrizioni(D):
    """desc: testo breve per nome inglese senza lato (ossa, reperi, encefalo, midollo, meningi, cuore, vasi, polmoni). Una struttura
    dell'encefalo senza descrizione propria prende quella del suo gruppo nella fonte (gruppo.fonte.*)."""
    osso = {v['ref']: val(v, 'descrizione') for v in carica('ossa') if val(v, 'descrizione')}
    enc = {v['ref']: val(v, 'descrizione') for v in carica('encefalo') if val(v, 'descrizione')}
    rep = {v['ref']: val(v, 'descrizione') for v in carica('reperi') if val(v, 'descrizione')}
    fonte = {v['ref']: val(v, 'descrizione') for v in carica('gruppi') if v['id'].startswith('gruppo.fonte.')}
    tor = {v['ref']: val(v, 'descrizione') for v in carica('torace') if val(v, 'descrizione') and not v.get('solo2d')}
    desc = {}
    for n, v in D['objs'].items():
        b = B(n)
        if b in desc: continue
        if v[0] == 'ossa': t = osso.get(b)
        elif v[0] in ('encefalo', 'midollo', 'meningi'): t = enc.get(b) or fonte.get(v[2])
        elif v[0] in ('vasi', 'visceri'): t = tor.get(b) or enc.get(b)  # cuore, vasi, polmoni; ipofisi ed epifisi stanno nei visceri
        else: t = enc.get(b)
        if t: desc[b] = t
    for l in D['lm']:
        if l[0] in rep: desc[l[0]] = rep[l[0]]
        elif l[0] in enc: desc[l[0]] = enc[l[0]]
    D['desc'] = desc

def gruppi_atlante(D):
    """gruppi di muscoli (COMBO), strati dell'encefalo (ST) e parti da specchiare, letti da atlante.js"""
    G = carica('gruppi')
    D['combo'] = {v['ref']: {'n': val(v, 'nome'), 'la': val(v, 'latino'), 'mus': val(v, 'membri'), **({'fly': v['vista']} if v.get('vista') else {}), 't': val(v, 'descrizione')}
                  for v in G if v['id'].startswith('gruppo.muscoli.')}
    D['strati'] = [{'n': val(v, 'nome'), 't': val(v, 'descrizione')} for v in sorted((v for v in G if v['id'].startswith('gruppo.strato-encefalo.')), key=lambda v: v['ref'])]
    D['specchia'] = {c['parte']: c['da'] for c in correzioni('specchia')}
    # strati dei due apparati nell'atlante (SYS in atlante.js): nome e testo di ogni strato
    D['sistemi'] = {}
    for v in G:
        if v['id'].startswith('gruppo.strato-cuore.') or v['id'].startswith('gruppo.strato-polmoni.'):
            D['sistemi'].setdefault(v['sistema'], {})[v['ref']] = {'n': val(v, 'nome'), 't': val(v, 'descrizione')}

def applica(D):
    """tutti i testi e le correzioni su un dati.json (anche già generato: idempotente)"""
    schede_muscoli(D['mus'])
    nomi(D)
    descrizioni(D)
    correggi_aree(D['mus'], list(D['objs']))
    gruppi_atlante(D)

# ---------------------------------------------------------------- testi per i moduli 2D
def gruppo_ossa(g):
    v = next(x for x in carica('gruppi') if x['id'] == 'gruppo.ossa.' + g)
    return {'n': val(v, 'nome'), 'l': val(v, 'latino'), 'r': val(v, 'regione'), 'f': val(v, 'descrizione'), 'k': val(v, 'clinica')}
def gruppi_encefalo():
    out = {}
    for v in carica('gruppi'):
        if not v['id'].startswith('gruppo.encefalo.'): continue
        g = {'n': val(v, 'nome'), 'l': val(v, 'latino'), 'r': val(v, 'regione'), 'col': v['col']}
        if val(v, 'in_breve'): g['q'] = val(v, 'in_breve')
        g['f'] = val(v, 'descrizione'); g['k'] = val(v, 'clinica'); out[v['ref']] = g
    return out
def casi(modulo):
    out = []
    for v in carica('casi'):
        if v['modulo'] != modulo: continue
        c = {'id': v['caso'], 'clues': [val(v, 'indizio_%d' % i) for i in range(1, 10) if val(v, 'indizio_%d' % i)], 'a': val(v, 'risposta'), 'opts': list(val(v, 'opzioni'))}
        if v.get('muscolo'): c['mid'] = v['muscolo']
        if v.get('struttura'): c['bid'] = v['struttura']
        c['r'] = val(v, 'spiegazione'); out.append(c)
    return out
def gruppi_modulo(mod):
    """gruppi di un modulo 2D di apparato (cuore, polmoni): id → testi come nel contenuto (n, l, r, col, q, f, k)"""
    out = {}
    for v in carica('gruppi'):
        if v.get('modulo') != mod or not v['id'].startswith('gruppo.' + mod + '.'): continue
        g = {'n': val(v, 'nome'), 'l': val(v, 'latino'), 'r': val(v, 'regione'), 'col': v['col']}
        if val(v, 'in_breve'): g['q'] = val(v, 'in_breve')
        g['f'] = val(v, 'descrizione')
        if val(v, 'clinica'): g['k'] = val(v, 'clinica')
        out[v['ref']] = g
    return out
def desc_torace(n):
    v = per_ref('torace').get(n)
    return val(v, 'descrizione') if v else None
def nervi():
    return [{'n': v['numero'], 'nm': val(v, 'nome'), 't': val(v, 'tipo'), 'f': val(v, 'funzione')} for v in carica('nervi-cranici')]

# ---------------------------------------------------------------- scrittura con versioni
def _senza_versione(o): return {k: v for k, v in o.items() if k != 'version'} if isinstance(o, dict) else o
def scrivi_versionato(path, obj, **dump):
    """scrive obj; se il contenuto è cambiato aumenta 'version' (altrimenti tiene quella di prima). True se cambiato."""
    try: old = json.load(open(path))
    except Exception: old = None
    changed = old is None or _senza_versione(old) != _senza_versione(obj)
    obj = {'version': ((old or {}).get('version', 0) + 1) if changed else old.get('version', 1), **_senza_versione(obj)}
    if changed: json.dump(obj, open(path, 'w'), ensure_ascii=False, **(dump or {'separators': (',', ':')}))
    return changed

def contenuti_piccoli():
    a = scrivi_versionato(os.path.join(ROOT, 'content/nervi-cranici.json'), {'items': nervi()}, indent=1)
    b = scrivi_versionato(os.path.join(ROOT, 'content/neuro-strutture.json'), {'items': gruppi_encefalo()}, indent=1)
    return a or b

def lezioni():
    """content/lezioni.json: ciò che le lezioni del percorso leggono oltre a content/corpo.json (sezioni 3 e 12)"""
    p = os.path.join(ROOT, 'content/mappa.json')
    if not os.path.exists(p): return False
    M = json.load(open(p)); C = json.load(open(os.path.join(ROOT, 'content/corpo.json')))
    ossa2d = {s['id'] for s in C['structures']}
    usati = set()
    for pl in M['corsi'][0]['pianeti']:
        for s in pl['satelliti']:
            for ps in s['passi']:
                if isinstance(ps['strutture'], list): usati |= set(ps['strutture'])
    voci = {}
    rep = {v['id']: v for v in carica('reperi')}
    oss = {v['id']: v for v in carica('ossa')}; enc = {v['id']: v for v in carica('encefalo')}
    reperi = {}
    for i in sorted(usati):
        if i.startswith('r.'):
            v = rep.get('repere.' + i[2:])
            if not v: continue
            src = v
            if v.get('vedi'): src = oss.get(v['vedi']) or enc.get(v['vedi']) or v
            ref = re.sub(r'\.[rl]$', '', v.get('osso') or '')
            o = 'o.teeth' if 'tooth' in ref.lower() else 'o.' + slug(ref)
            nome = val(src, 'nome') or v['ref']
            reperi[i] = {'n': nome, 'l': val(src, 'latino') or '', 'd': val(src, 'descrizione') or '', 'o': o if o in ossa2d else None}
            voci[i] = src['id']
        elif i.startswith('o.'): voci[i] = 'osso.' + i[2:]
        else: voci[i] = 'muscolo.' + i
    stati = {}
    for t in TIPI:
        for v in carica(t):
            for c, d in v.get('dati', {}).items():
                if d['stato'] != 'da verificare':
                    q = (d.get('verifica') or {}).get('quando')
                    stati[v['id'] + '.' + c] = [d['stato'], q] if q else [d['stato']]
    return scrivi_versionato(os.path.join(ROOT, 'content/lezioni.json'), {'voci': voci, 'reperi': reperi, 'stati': stati})

def controlla_percorsi():
    """ogni nodo di content/percorsi/*.json esiste nella mappa, i passi sono del satellite, il caso esiste"""
    d = os.path.join(ROOT, 'content/percorsi')
    if not os.path.isdir(d): return
    M = json.load(open(os.path.join(ROOT, 'content/mappa.json'))); C = json.load(open(os.path.join(ROOT, 'content/corpo.json')))
    casi = {c['id'] for c in C['cases']}; err = []; nodi = {}
    for co in M['corsi']:
        nodi[co['id']] = 'corso'
        for pl in co['pianeti']:
            nodi[pl['id']] = 'pianeta'
            for s in pl['satelliti']: nodi[s['id']] = {ps['id'] for ps in s['passi']}
    for f in sorted(os.listdir(d)):
        P = json.load(open(os.path.join(d, f)))
        for n in P['nodi']:
            if n['id'] not in nodi: err.append(f"{f}: nodo {n['id']}"); continue
            if n['tipo'] == 'satellite':
                err += [f"{f}: passo {x}" for x in n.get('passi', []) if x not in nodi[n['id']]]
                if n.get('caso') and n['caso'] not in casi: err.append(f"{f}: caso {n['caso']}")
    if err: raise SystemExit('content/percorsi non valido:\n  ' + '\n  '.join(err[:30]))
    print('content/percorsi: nodi validi')

def controlla():
    """id unici, stati e fonti ammessi"""
    seen = set(); err = []
    for t in TIPI + ['correzioni']:
        for v in carica(t):
            if v['id'] in seen: err.append('id doppio: ' + v['id'])
            seen.add(v['id'])
            ds = v['dati'].values() if 'dati' in v else [v]
            for d in ds:
                if d['stato'] not in STATI: err.append(f"{v['id']}: stato '{d['stato']}'")
                if d['fonte'] not in FONTI: err.append(f"{v['id']}: fonte '{d['fonte']}'")
    if err: raise SystemExit('testi/ non valido:\n  ' + '\n  '.join(err[:30]))

def slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower(); return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def controlla_mappa():
    """ogni id di content/mappa.json esiste nei contenuti; ossa e muscoli del 2D tutti in almeno un satellite"""
    p = os.path.join(ROOT, 'content/mappa.json')
    if not os.path.exists(p): return
    M = json.load(open(p)); C = json.load(open(os.path.join(ROOT, 'content/corpo.json')))
    D = json.load(open(os.path.join(ROOT, 'atlante/dati.json')))
    ok = {s['id'] for s in C['structures']} | {m['id'] for m in C['muscles']} | {'r.' + slug(l[0]) for l in D['lm']}
    gr = {g['id'] for g in C['groups']}; usati = set(); err = []
    for pl in M['corsi'][0]['pianeti']:
        for s in pl['satelliti']:
            err += [f"{s['id']}: gruppo {g}" for g in s['ossa'] if g not in gr]
            for ps in s['passi']:
                ids = ps['strutture'] if isinstance(ps['strutture'], list) else []
                usati |= set(ids); err += [f"{ps['id']}: {i}" for i in ids if i not in ok]
    manca = sorted(({m['id'] for m in C['muscles']} | {i for g in C['groups'] for i in g['m']}) - usati)
    # corso di neurologia: strutture n.<voce di testi/neuro.json>, figure del cervello 2D esistenti, casi del modulo neuro
    B = json.load(open(os.path.join(ROOT, 'content/cervello.json')))
    fig = {s['id'] for s in B['structures']} | {'g:' + g['id'] for g in B['groups']}
    nv = {v['id'][6:]: v for v in carica('neuro')}; nc = {v['caso']: v for v in carica('casi') if v['modulo'] == 'neuro'}; nu = set()
    for co in M['corsi'][1:]:
        if co['id'] != 'neurologia': continue
        for pl in co['pianeti']:
            for s in pl['satelliti']:
                for ps in s['passi']:
                    ids = ps['strutture'] if isinstance(ps['strutture'], list) else []
                    nu |= {i[2:] for i in ids}; err += [f"{ps['id']}: {i}" for i in ids if not i.startswith('n.') or i[2:] not in nv]
                    err += [f"{ps['id']}: caso {c}" for c in ps.get('casi', []) if c not in nc]
    err += [f"{v['id']}: figura {f}" for v in nv.values() for f in v.get('figura', []) if f not in fig]
    err += [f"caso.neuro.{k}: struttura {v['struttura']}" for k, v in nc.items() if v['struttura'][2:] not in nv]
    manca += sorted('neuro.' + k for k in set(nv) - nu)
    if err or manca: raise SystemExit('content/mappa.json non valido:\n  ' + '\n  '.join((err + ['non in nessun satellite: ' + i for i in manca])[:30]))
    print('content/mappa.json: id validi')

def main():
    controlla()
    path = os.path.join(ROOT, 'atlante/dati.json')
    D = json.load(open(path)); before = json.dumps(D, sort_keys=True)
    applica(D)
    if json.dumps(D, sort_keys=True) != before:
        json.dump(D, open(path, 'w'), ensure_ascii=False, separators=(',', ':')); print('scritto atlante/dati.json')
    else: print('atlante/dati.json invariato')
    changed = contenuti_piccoli()
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, 'proiezioni.json')
        subprocess.run(['node', os.path.join(HERE, 'proietta_2d.mjs'), p], check=True, stdout=subprocess.DEVNULL)
        sys.argv = [sys.argv[0], p]
        import contenuti_2d
        changed = contenuti_2d.main(p) or changed
    changed = lezioni() or changed
    idx = os.path.join(ROOT, 'content/index.json')
    if changed:
        I = json.load(open(idx)); I['version'] += 1; json.dump(I, open(idx, 'w'), ensure_ascii=False, indent=1); open(idx, 'a').write('\n')
        print('contenuti cambiati: content/index.json alla versione', I['version'])
    else: print('contenuti invariati')
    controlla_mappa()
    controlla_percorsi()

if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
