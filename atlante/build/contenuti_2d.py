"""Contenuti dei moduli 2D (content/corpo.json, cervello.json, cuore.json, polmoni.json) dalle proiezioni del modello 3D.

Uso: node atlante/build/proietta_2d.mjs /tmp/proiezioni.json
     python3 atlante/build/contenuti_2d.py /tmp/proiezioni.json

Dalla fonte (Z-Anatomy, via proietta_2d.mjs): forme e posizioni, ossa su cui stanno le aree di origine e inserzione.
Dai dati dell'atlante (atlante/dati.json, generato da testi.py): nomi, descrizioni e schede dei muscoli.
Da testi/ (via testi.py): gruppi di ossa e del cervello, casi clinici, voci che esistono solo nel 2D (denti, cartilagini
costali, area di Wernicke) e nomi delle strutture del cervello. Di solito si lancia da testi.py, che fa tutto.
Ogni struttura singola appartiene a un gruppo (g); i gruppi elencano i membri (m). I gruppi del cervello comprendono anche
aree che si sovrappongono ai lobi (Broca, Wernicke, giro precentrale…): la risposta è giusta se si tocca un membro.
"""
import json, re, sys, os, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
sys.path.insert(0, HERE)
import testi
P = D = NAMES = DESC = MUS = None
def load(p):
    global P, D, NAMES, DESC, MUS
    P = json.load(open(p)); D = json.load(open(os.path.join(ROOT, 'atlante/dati.json')))
    NAMES, DESC, MUS = D['names'], D['desc'], D['mus']

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def shape(d): return [{'poly': d}]

# ---------------------------------------------------------------- corpo
# voci che esistono solo nel 2D (denti e cartilagini costali come voce unica): testi/ossa.json, solo2d
EXTRA = {v['ref']: v for v in testi.carica('ossa') if v.get('solo2d')}
GROUPS_BODY = [  # (id, membri come regex sul nome inglese)
    ('cranio', r'^(Frontal|Parietal|Occipital|Temporal|Sphenoid|Ethmoid|Nasal|Lacrimal|Zygomatic|Palatine|Inferior nasal concha) bone$|^(Maxilla|Vomer)$'),
    ('mandibola', r'^Mandible$'), ('denti', r'^Teeth$'), ('ioide', r'^Hyoid bone$'),
    ('cervicali', r'^(Atlas|Axis)|^Vertebra C'), ('toraciche', r'^Vertebra T'), ('lombari', r'^Vertebra L'), ('sacro', r'^(Sacrum|Coccyx)$'),
    ('sterno', r'sternum$|^Xiphoid'), ('costole', r' rib$|^Costal cartilages$'),
    ('clavicola', r'^Clavicle$'), ('scapola', r'^Scapula$'), ('omero', r'^Humerus$'), ('radio', r'^Radius$'), ('ulna', r'^Ulna$'),
    ('carpo', r'^(Scaphoid|Lunate|Triquetrum|Pisiform|Trapezium|Trapezoid|Capitate|Hamate) bone$'),
    ('metacarpo', r'metacarpal bone$'), ('falangi-mano', r'phalanx of .* of hand$'),
    ('bacino', r'^Hip bone$'), ('femore', r'^Femur$'), ('rotula', r'^Patella$'), ('tibia', r'^Tibia$'), ('fibula', r'^Fibula$'),
    ('tarso', r'^(Talus|Calcaneus|Navicular bone|Cuboid bone|Medial cuneiform bone|Intermediate cuneiform bone|Lateral cuneiform bone)$'),
    ('metatarso', r'metatarsal bone$'), ('falangi-piede', r'phalanx of .* of foot$')]
# viste di zona (proietta_2d.mjs): nome sul pulsante e vista opposta a cui passa toccandolo
ZVIEWS = {'mp': {'n': 'Mano · palmare', 'alt': 'md'}, 'md': {'n': 'Mano · dorsale', 'alt': 'mp'},
          'pd': {'n': 'Piede · dorsale', 'alt': 'pp'}, 'pp': {'n': 'Piede · plantare', 'alt': 'pd'}}
ZONE_PAIRS = {'cranio': [('ld', 'ld')]} | {g: [('mp', 'md')] for g in ('carpo', 'metacarpo', 'falangi-mano')} | {g: [('pd', 'pp')] for g in ('tarso', 'metatarso', 'falangi-piede')}

def full(s, v, x):
    """sagoma intera del lato principale (pezzi del puzzle), il suo riquadro e la quota che se ne vede in quella vista"""
    if x.get('full'): s.setdefault('sf', {})[v] = x['full']['d']; s.setdefault('sb', {})[v] = x['full']['b']
    s.setdefault('vis', {})[v] = x['vis']

def put(s, v, x):
    """forme di una vista (proietta_2d.mjs): prima il lato principale, poi l'altro; centro; sagoma intera"""
    s['s'][v] = [{'poly': d} for d in x['d']]; s['c'][v] = x['c']; full(s, v, x)

# viste del corpo e del cervello: chiave -> nome nel menu
# nomi delle viste con i termini dell'anatomia (quelli dei libri e degli esami)
BODY_VIEWS = {'a': 'Anteriore', 'p': 'Posteriore', 'ld': 'Laterale destra', 'ls': 'Laterale sinistra', 's': 'Superiore (craniale)', 'i': 'Inferiore (caudale)'}
BRAIN_VIEWS = {'ls': 'Laterale sinistra', 'ld': 'Laterale destra', 'm': 'Mediale (sagittale)', 'f': 'Anteriore (frontale)', 'p': 'Posteriore (occipitale)',
               's': 'Superiore (dorsale)', 'i': 'Inferiore (basale)'}

def body():
    B = P['body']; V = B['views']; areas = B['areas']
    names = sorted(set().union(*(V[v] for v in BODY_VIEWS)))
    gid = {}
    for n in names:
        for g, rx in GROUPS_BODY:
            if re.search(rx, n): gid[n] = g; break
        else: raise SystemExit('osso senza gruppo: ' + n)
    groups = {g: testi.gruppo_ossa(g) for g, _ in GROUPS_BODY}
    sid = lambda n: 'o.' + slug(n)
    structures = []
    for n in names:
        it, la = ([testi.val(EXTRA[n], 'nome'), testi.val(EXTRA[n], 'latino')] if n in EXTRA else NAMES.get(n) or [n, n])
        f = testi.val(EXTRA[n], 'descrizione') if n in EXTRA else DESC.get(n, '')
        s = {'id': sid(n), 'n': it[:1].upper() + it[1:], 'l': la, 'g': gid[n], 'f': f, 's': {}, 'c': {}}
        for v in BODY_VIEWS:
            if n in V[v]: put(s, v, V[v][n])
        # viste di zona (mano, piede): solo il lato destro, già nello spazio della figura
        for v, Z in B['zviews'].items():
            if n in Z: s['s'][v] = shape(Z[n]['d']); s['c'][v] = Z[n]['c']; full(s, v, Z[n])
        structures.append(s)
    out_groups = []
    vis = {x['id']: x['vis'] for x in structures}
    for g, _ in GROUPS_BODY:
        m = [sid(n) for n in names if gid[n] == g]
        if not m: continue
        G = {'id': g, **groups[g], 'm': m}
        # vista di zona preferita: quella delle due in cui si vedono meglio i membri (a pari merito la prima)
        for pair in ZONE_PAIRS.get(g, []):
            G['zv'] = max(pair, key=lambda v: sum(min(vis[x].get(v, 0), .5) for x in m))
        out_groups.append(G)
    # muscoli: ossa di origine e inserzione dalle aree della fonte; se mancano, dal testo della scheda
    known = {n: sid(n) for n in names}
    muscles, nofonte = [], 0
    for key, mu in MUS.items():
        card = mu.get('card') or {}
        def bones(lst):
            w = {}
            for a in lst:
                ar = areas.get(a)
                if ar and ar['bone'] in known: w[known[ar['bone']]] = w.get(known[ar['bone']], 0) + ar['n']
            return [b for b, _ in sorted(w.items(), key=lambda x: -x[1])]
        o, i = bones(mu['o']), bones(mu['e'])
        src = 'fonte'
        piede = bool(re.search(r'piede|plantar|alluce|pedis|fibular|perone|tibial|digitorum (longus|brevis)|hallucis', (mu.get('n') or '') + ' ' + key + ' ' + (mu.get('la') or ''), re.I)) and 'manus' not in (mu.get('la') or '')
        if not o: o = from_text(card.get('ot', ''), piede); src = 'testo' if o else src
        if not i: i = from_text(card.get('it', ''), piede); src = 'testo' if i else src
        if src == 'testo': nofonte += 1
        pts = {}
        for v in BODY_VIEWS:
            po = [[*areas[a][v], a[-1]] for a in mu['o'] if a in areas and v in areas[a]]
            pi = [[*areas[a][v], a[-1]] for a in mu['e'] if a in areas and v in areas[a]]
            if po or pi: pts[v] = {'o': po, 'i': pi}
        n = re.sub(r'^Muscolo ', '', mu.get('n') or key); n = n[:1].upper() + n[1:]
        m = {'id': slug(key), 'n': n, 'l': mu.get('la', ''), 'ot': card.get('ot', ''), 'it': card.get('it', ''), 'a': card.get('a', ''), 'nv': card.get('nv', ''),
             'o': o[0] if o else None, 'oa': o[1:], 'i': i[0] if i else None, 'ia': i[1:], 'pts': pts}
        if src == 'testo': m['src'] = 'testo'
        muscles.append(m)
    cases = testi.casi('corpo')
    for c in cases:
        if c.get('mid'): c['mid'] = slug(c['mid'])
    path = os.path.join(ROOT, 'content/corpo.json')
    out = {'id': 'corpo', 'label': '🦴 Corpo', 'W': B['W'], 'H': B['H'], 'views': list(BODY_VIEWS), 'vnames': BODY_VIEWS, 'zviews': ZVIEWS,
           'fonte': 'Forme proiettate dal modello 3D Z-Anatomy (CC BY-SA 4.0), vedi atlante/CREDITI.md',
           'structures': structures, 'groups': out_groups, 'muscles': muscles, 'cases': cases}
    changed = testi.scrivi_versionato(path, out)
    both = sum(1 for m in muscles if m['o'] and m['i'])
    print('corpo:', len(structures), 'ossa,', len(out_groups), 'gruppi,', len(muscles), 'muscoli (', both, 'con origine e inserzione;', nofonte, 'completati dal testo )', '' if changed else '(invariato)')
    return changed

# parole della scheda -> osso (solo quando la fonte non ha l'area). piede: il muscolo è del piede (per falangi e dita)
TXT = [(r'clavicol', 'Clavicle'), (r'scapol|acromion|coracoid|glenoid|spina della scapola', 'Scapula'), (r'omer|epicondil|epitroclea|trochite|trochine|tubercolo (maggiore|minore)|tuberosit. deltoidea|solco intertubercolare', 'Humerus'),
       (r'\bradio\b|tuberosit. radiale|stiloide del radio', 'Radius'), (r'\bulna|olecran|coronoide', 'Ulna'),
       (r'femor|trocanter|linea aspra', 'Femur'), (r'rotul|patell', 'Patella'), (r'\btibi|zampa d.oca', 'Tibia'),
       (r'fibul|\bperone\b', 'Fibula'), (r'calcagn|tendine d.achille', 'Calcaneus'), (r'\bsacr', 'Sacrum'), (r'coccig', 'Coccyx'),
       (r'\bile|iliac|ischi|\bpub|acetabol', 'Hip bone'), (r'manubrio', 'Manubrium of sternum'), (r'stern', 'Body of sternum'), (r'xifoid', 'Xiphoid process'),
       (r'occipital|linea nucale', 'Occipital bone'), (r'mastoid|temporal', 'Temporal bone'), (r'mandibol', 'Mandible'), (r'mascellar', 'Maxilla'),
       (r'zigomat', 'Zygomatic bone'), (r'sfenoid|pterigoide', 'Sphenoid bone'), (r'ioide', 'Hyoid bone'), (r'osso frontale|\bfrontale\b', 'Frontal bone'), (r'parietale', 'Parietal bone'),
       (r'cuboid', 'Cuboid bone'), (r'navicolar', 'Navicular bone'), (r'cuneiforme mediale|primo cuneiforme', 'Medial cuneiform bone'), (r'cuneiforme intermedio', 'Intermediate cuneiform bone'),
       (r'cuneiforme laterale', 'Lateral cuneiform bone'), (r'\btal(o|ar)|astragal', 'Talus'),
       (r'pisiform', 'Pisiform bone'), (r'uncinat|hamat', 'Hamate bone'), (r'\btrapezio\b', 'Trapezium bone'), (r'trapezoide', 'Trapezoid bone'), (r'scafoid', 'Scaphoid bone'), (r'capitato', 'Capitate bone'),
       (r'prima costa', 'First rib'), (r'seconda costa', 'Second rib'), (r'\batlante\b', 'Atlas (C1)'), (r'epistrofeo', 'Axis (C2)')]
ORD = ['first', 'second', 'third', 'fourth', 'fifth']
NUM = {'1': 0, 'primo': 0, 'pollice': 0, 'alluce': 0, '2': 1, 'secondo': 1, 'indice': 1, '3': 2, 'terzo': 2, 'medio': 2, '4': 3, 'quarto': 3, 'anulare': 3, '5': 4, 'quinto': 4, 'mignolo': 4}
def fingers(t):
    """dita citate: «pollice», «5° dito», «dita 2–4»"""
    out = set()
    for a, b in re.findall(r'\b([1-5])\s*[–-]\s*([1-5])\b', t): out |= set(range(int(a) - 1, int(b)))
    for w in re.findall(r'\b(pollice|alluce|indice|anulare|mignolo|[1-5](?=°| dito| dita)|primo|secondo|terzo|quarto|quinto)\b', t): out.add(NUM[w])
    return sorted(out)
def from_text(t, piede=False):
    """ossa citate nel testo, nell'ordine in cui compaiono (la prima diventa quella principale)"""
    t = t.lower(); found = []  # (posizione, nome)
    seq = ['c%d' % k for k in range(1, 8)] + ['t%d' % k for k in range(1, 13)] + ['l%d' % k for k in range(1, 6)]
    vname = lambda v: {'c1': 'Atlas (C1)', 'c2': 'Axis (C2)'}.get(v, 'Vertebra ' + v.upper())
    for mt in re.finditer(r'\b([ctl]\d{1,2})\s*(?:[–-]|a)\s*([ctl]\d{1,2})\b', t):  # intervalli di vertebre (C3–C6, da T12 a L5)
        a, b = mt.groups()
        if a in seq and b in seq: found += [(mt.start(), vname(v)) for v in seq[seq.index(a):seq.index(b) + 1]]
    found += [(mt.start(), vname(mt.group(1))) for mt in re.finditer(r'\b([ctl]\d{1,2})\b', t) if mt.group(1) in seq]
    limb = 'foot' if piede else 'hand'
    for kind, en in (('prossimal', 'Proximal'), ('medi', 'Middle'), ('distal', 'Distal')):
        mt = re.search(r'falang[ie] ' + kind, t)
        if mt: found += [(mt.start(), f'{en} phalanx of {ORD[f]} finger of {limb}') for f in (fingers(t) or [2]) if not (en == 'Middle' and f == 0)]
    mt = re.search(r'metacarp|metatars', t)
    if mt:
        meta = 'metatarsal' if piede or 'metatars' in t else 'metacarpal'
        fs = fingers(t) or ([1, 2, 3] if re.search(r'metacarpi|metatarsi|metacarpali\b|metatarsali\b', t) else [])
        found += [(mt.start(), f'{ORD[f].capitalize()} {meta} bone') for f in fs]
    for rx, n in TXT:
        mt = re.search(rx, t)
        if mt: found.append((mt.start(), n))
    mt = re.search(r'\bcost[ae]\b|costal', t)
    if mt and not re.search(r'prima costa|seconda costa', t):  # «coste» in generale: tutte (nel pannello diventa il gruppo)
        found += [(mt.start(), o + ' rib') for o in ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth']]
    V = P['body']['views']
    names = list(dict.fromkeys(n for _, n in sorted(found, key=lambda x: x[0]) if n in V['a'] or n in V['p']))
    return ['o.' + slug(n) for n in names]

# ---------------------------------------------------------------- cervello
LOBES = [  # (gruppo, regex) in ordine: vince la prima
    ('solchi', r'^(Central sulcus|Lat_Fis|Parieto-occipital sulcus)'),
    ('sostanza', r'^White matter'),
    ('cerebello', r'(?i:quadrangular|semilunar|biventral|gracile|central) lobule|vermis|^(Culmen|Declive|Flocculus|Peduncle of flocculus|Lingula of cerebellum|Central lobule|Tonsil|Superior cerebellar peduncle)'),
    ('ventricoli', r'ventricle|^Aqueduct'),
    ('tronco', r'^(Midbrain|Pons|Medulla|Pyramid of medulla|Olive|Base of peduncle|Interpeduncular|Superior colliculus|Inferior colliculus)'),
    ('ipofisi', r'hypophysis'),
    ('diencefalo', r'^(Thalamus|Hypothalamus|Habenula|Mamillary|.*geniculate|Stria medullaris|Pineal|Posterior commissure|Optic chiasm|Optic tract)'),
    ('commissure', r'^(Corpus callosum|Fornix|Septum pellucidum|Anterior commissure|Hippocampal commissure)'),
    ('limbico', r'Cingulate|Parahippocampal|^Hippocampus|^Septal nuclei'),
    ('insula', r'Insula|insula'),
    ('temporale', r'temporal|Temporal|occipitotemporal|Collateral sulcus|collateral sulcus|^Wernicke'),
    ('frontale', r'frontal|Precentral|Orbital|Straight gyrus|Olfactory sulcus|Paracentral|frontopolar'),
    ('parietale', r'Postcentral|parietal|Angular|Supramarginal|Precuneus|Intraparietal|Jensen'),
    ('occipitale', r'occipital|Occipital|Lingual|Calcarine|Cuneus|Lunate')]
AREAS = {'broca': r'^(Opercular|Triangular) part of inferior frontal gyrus', 'wernicke': r'^Wernicke', 'precentrale': r'^Precentral gyrus',
         'postcentrale': r'^Postcentral gyrus', 'solcocentrale': r'^Central sulcus', 'solcolaterale': r'^Lat_Fis', 'calloso': r'^Corpus callosum',
         'talamo': r'^Thalamus', 'ipotalamo': r'^Hypothalamus', 'epifisi': r'^Pineal', 'adeno': r'^Adenohypophysis', 'neuro': r'^Neurohypophysis',
         'mesencefalo': r'^(Midbrain|Base of peduncle|Interpeduncular|Superior colliculus|Inferior colliculus|Aqueduct)', 'ponte': r'^Pons', 'bulbo': r'^(Medulla|Pyramid of medulla|Olive)'}
# nomi e descrizioni delle strutture del cervello (anche quelle che mancano in TA2 o che nella fonte si ripetono,
# e l'area di Wernicke, che esiste solo nel 2D): testi/encefalo.json
def brain():
    """cervello: un modulo con sette viste (prima erano due moduli, laterale e sagittale); gli id b.* restano gli stessi"""
    B = P['brain']; cat = testi.gruppi_encefalo(); ENC = testi.per_ref('encefalo')
    sid = lambda n: 'b.' + slug(n)
    names = sorted(set().union(*(B['views'][v] for v in BRAIN_VIEWS)))
    structures, members = [], {}
    for n in names:
        g = next((g for g, rx in LOBES if re.search(rx, n)), None)
        if not g: raise SystemExit('struttura senza lobo: ' + n)
        tv = ENC.get(n) or ENC.get(n.strip())
        if n == 'Wernicke area': it, la, f = testi.val(tv, 'nome'), testi.val(tv, 'latino'), testi.val(tv, 'descrizione')
        else:
            it, la = ([testi.val(tv, 'nome'), testi.val(tv, 'latino', '')] if tv and testi.val(tv, 'nome') else None) or NAMES.get(n) or NAMES.get(n.strip()) or [n, n]
            f = DESC.get(n) or DESC.get(n.strip()) or (testi.val(tv, 'descrizione', '') if tv else '')
            if it == n: print('  nome non tradotto:', n)
            if not f: print('  senza descrizione:', n)
        st = {'id': sid(n), 'n': it[:1].upper() + it[1:], 'l': la, 'g': g, 'f': f, 'col': cat.get(g, {}).get('col'), 's': {}, 'c': {}}
        for v in BRAIN_VIEWS:
            if n in B['views'][v]: put(st, v, B['views'][v][n])
        structures.append(st)
        members.setdefault(g, []).append(sid(n))
        for a, rx in AREAS.items():
            if re.search(rx, n): members.setdefault(a, []).append(sid(n))
    groups = []
    for g, m in members.items():
        if g not in cat: raise SystemExit('gruppo senza testo in neuro-strutture.json: ' + g)
        groups.append({'id': g, **{k: v for k, v in cat[g].items()}, 'm': m, 'area': g in AREAS})
    path = os.path.join(ROOT, 'content/cervello.json')
    out = {'id': 'cervello', 'label': '🧠 Cervello', 'W': B['W'], 'H': B['H'], 'views': list(BRAIN_VIEWS), 'vnames': BRAIN_VIEWS,
           'fonte': 'Forme proiettate dal modello 3D Z-Anatomy (CC BY-SA 4.0), vedi atlante/CREDITI.md',
           'structures': structures, 'groups': groups, 'cases': testi.casi('lat') + testi.casi('sag')}
    changed = testi.scrivi_versionato(path, out)
    print('cervello:', len(structures), 'strutture,', len(groups), 'gruppi', '' if changed else '(invariato)')
    return changed

# ---------------------------------------------------------------- cuore e vasi, polmoni
import torace as TX
CUORE_VIEWS = {'a': 'Cuore e grandi vasi · anteriore', 'p': 'Cuore e grandi vasi · posteriore', 'ld': 'Cuore e grandi vasi · laterale destra',
               'ls': 'Cuore e grandi vasi · laterale sinistra', 'c': 'Solo il cuore · faccia anteriore (sternocostale)', 'cp': 'Solo il cuore · faccia posteriore (base)',
               'ar': 'Arterie di tutto il corpo', 've': 'Vene di tutto il corpo'}
POLM_VIEWS = {'a': 'Anteriore', 'p': 'Posteriore', 'ld': 'Laterale destra', 'ls': 'Laterale sinistra',
              'b': 'Bronchi e vasi polmonari', 'bt': 'Albero bronchiale'}
# colori come nell'atlante 3D: cuore destro blu, sinistro rosso, un colore per lobo
COL2 = {'Right atrium': '#7fa6e3', 'Right ventricle': '#9bbbeb', 'Left atrium': '#e58a82', 'Left ventricle': '#ec9f97',
        'Superior lobe of right lung': '#f4b6c2', 'Middle lobe of right lung': '#f7d08a', 'Inferior lobe of right lung': '#b5d99c',
        'Superior lobe of left lung': '#a9cdee', 'Inferior lobe of left lung': '#c9b3e6'}
VENA = re.compile(r'vein|venous|vena|sinus|plexus', re.I)
def module2(mid, label, X, VIEWS, REGOLE, pref, extra, groupof=None):
    """modulo 2D di un apparato: strutture dalle proiezioni, gruppi da torace.py (regex sul nome o groupof) con i testi
    di testi/gruppi.json, casi clinici da testi/casi.json, descrizioni da testi/torace.json"""
    T = testi.gruppi_modulo(mid); GRUPPI = [(g, rx, T[g]) for g, rx in REGOLE]; CASI = testi.casi(mid)
    sid = lambda n: pref + slug(n)
    names = sorted(set().union(*(X['views'][v] for v in VIEWS)))
    structures, members = [], {}
    for n in names:
        g = next((g for g, rx, _ in GRUPPI if rx and re.search(rx, n)), None) or (groupof and groupof(n))
        if not g: raise SystemExit(mid + ': struttura senza gruppo: ' + n)
        it, la = NAMES.get(n) or [n, n]; f = DESC.get(n) or testi.desc_torace(n) or ''
        if not f: print('  senza descrizione:', n)
        gc = next(t for gg, _, t in GRUPPI if gg == g)['col']
        st = {'id': sid(n), 'n': it[:1].upper() + it[1:], 'l': la, 'g': g, 'f': f, 'col': COL2.get(n, gc), 's': {}, 'c': {}}
        for v in VIEWS:
            if n in X['views'][v]: put(st, v, X['views'][v][n])
        structures.append(st); members.setdefault(g, []).append(sid(n))
    groups = [{'id': g, **t, 'm': members[g]} for g, _, t in GRUPPI if g in members]
    ids = {x['id'] for x in structures} | {x['id'] for x in groups}
    for c in CASI:
        if c['bid'] not in ids: raise SystemExit(mid + ': caso con risposta che non c\'è: ' + c['bid'])
    path = os.path.join(ROOT, f'content/{mid}.json')
    out = {'id': mid, 'label': label, 'W': X['W'], 'H': X['H'], 'views': list(VIEWS), 'vnames': VIEWS,
           'grpn': ['Strutture singole', 'Gruppi'], **extra,
           'fonte': 'Forme proiettate dal modello 3D Z-Anatomy (CC BY-SA 4.0), vedi atlante/CREDITI.md',
           'structures': structures, 'groups': groups, 'cases': CASI}
    changed = testi.scrivi_versionato(path, out)
    print(f'{mid}:', len(structures), 'strutture,', len(groups), 'gruppi,', len(CASI), 'casi', '' if changed else '(invariato)')
    return changed

def heart():
    X = P['cuore']; reg = X['region']
    return module2('cuore', '🫀 Cuore e vasi', X, CUORE_VIEWS, TX.GRUPPI_CUORE, 'c.',
            {'thin': ['ar', 've'], 'expl': {'h': 'Atlante 2D · cuore e vasi', 't': "Tocca una struttura per vedere nome e funzione. In alto scegli la vista: cuore e grandi vasi da quattro lati, solo il cuore (faccia anteriore e base) o le arterie e le vene di tutto il corpo; e strutture singole o gruppi."}},
            groupof=lambda n: ('vene-' if VENA.search(n + ' ' + (next((v[2] for k, v in D['objs'].items() if re.sub(r'\.[rl]$', '', k) == n), ''))) else 'arterie-') + reg.get(n, 'tronco'))

def lungs():
    return module2('polmoni', '🫁 Polmoni', P['polmoni'], POLM_VIEWS, TX.GRUPPI_POLMONI, 'p.',
            {'expl': {'h': 'Atlante 2D · i polmoni', 't': "Tocca una struttura per vedere nome e funzione. In alto scegli la vista: i polmoni da quattro lati, i bronchi con i vasi polmonari o l'albero bronchiale da solo; e strutture singole o gruppi."}})

def main(p):
    load(p)
    return any([body(), brain(), heart(), lungs()])

if __name__ == '__main__':
    main(sys.argv[1])
