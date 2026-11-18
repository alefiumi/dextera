# Apparato cardiovascolare (cuore e vasi sanguigni) e apparato respiratorio (polmoni e vie aeree): regole per classificare
# le parti del modello. I testi (nomi corretti, descrizioni, gruppi, casi clinici) stanno in testi/torace.json, testi/gruppi.json
# (gruppo.cuore.*, gruppo.polmoni.*, gruppo.strato-cuore.*, gruppo.strato-polmoni.*) e testi/casi.json, letti da testi.py.
# Le stesse regole di organo() stanno in atlante.js (organOf) e in proietta_2d.mjs.
import re

CUORE_G = {'Heart', 'Right ventricle', 'Left ventricle', 'Aortic valve', 'Pulmonary valve', 'Right atrioventricular valve',
           'Arteries of heart', 'Left coronary artery', 'Right coronary artery', 'Anterior interventricular artery', 'Cardiac veins', 'Coronary sinus'}
GRANDI = {'Ascending aorta', 'Aortic arch', 'Thoracic aorta', 'Brachiocephalic trunk', 'Left common carotid artery', 'Left subclavian artery',
          'Superior vena cava', 'Inferior vena cava (thoracic part)', 'Left brachiocephalic vein', 'Right brachiocephalic vein', 'Azygos vein'}
PGRANDI = {'Pulmonary trunk', 'Bifurcation of pulmonary trunk', 'Left pulmonary artery', 'Right pulmonary artery',
           'Left superior pulmonary vein', 'Left inferior pulmonary vein', 'Right superior pulmonary vein', 'Right inferior pulmonary vein'}
VALVOLE_G = {'Aortic valve', 'Pulmonary valve', 'Right atrioventricular valve'}
VENA = re.compile(r'vein|venous|vena|sinus|plexus', re.I)

def organo(base, layer, g):
    """parte di uno dei due apparati: cuore, valvole, coronarie, grandi (vasi della base del cuore), pgrandi (tronco, arterie e vene
    polmonari principali), vpolm (loro rami nei polmoni), arterie e vene (del resto del corpo), polmoni, vie, pleura; altrimenti None"""
    if base.startswith('?'): return None
    if layer == 'vasi':
        if g in VALVOLE_G or 'papillary' in base: return 'valvole'
        if g == 'Heart': return 'cuore'
        if g in CUORE_G or base in ('Coronary sinus', 'Left coronary artery', 'Right coronary artery'): return 'coronarie'
        if base in GRANDI: return 'grandi'
        if base in PGRANDI: return 'pgrandi'
        if re.search(r'of (left|right) lung|lobar artery', base): return 'vpolm'
        return 'vene' if VENA.search(base + ' ' + g) else 'arterie'
    if layer == 'visceri':
        if base == 'Pleura': return 'pleura'
        if g in ('Left lung', 'Right lung'): return 'polmoni'
        if base == 'Trachea' or 'bronch' in base.lower(): return 'vie'
    return None

# testo dei vasi del corpo che non ne hanno uno scritto: da dove nasce l'arteria o dove sbocca la vena, secondo la gerarchia della
# fonte (Z-Anatomy/TA2), non scritto dall'AI

# ---------------------------------------------------------------- moduli 2D cuore e polmoni
# gruppi: (id, membri come regex sul nome inglese; None = vasi del resto del corpo, per regione, decisi in contenuti_2d.py)
GRUPPI_CUORE = [
 ('cuore-destro', '^Right (atrium|ventricle)$'),
 ('cuore-sinistro', '^Left (atrium|ventricle)$'),
 ('coronarie', 'coronary artery|interventricular artery|Circumflex artery|inferolateral branch'),
 ('vene-cuore', 'Coronary sinus|cardiac vein|vein of left ventricle'),
 ('aorta', 'aorta|Aortic arch|Brachiocephalic trunk|Left common carotid|Left subclavian artery'),
 ('vene-cave', 'vena cava|brachiocephalic vein|Azygos'),
 ('arterie-polmonari', 'Pulmonary trunk|pulmonary trunk|^(Left|Right) pulmonary artery$'),
 ('vene-polmonari', '^(Left|Right) (superior|inferior) pulmonary vein$'),
 ('arterie-testa', None),
 ('arterie-arto-sup', None),
 ('arterie-tronco', None),
 ('arterie-arto-inf', None),
 ('vene-testa', None),
 ('vene-arto-sup', None),
 ('vene-tronco', None),
 ('vene-arto-inf', None),
]
GRUPPI_POLMONI = [
 ('polmone-destro', 'lobe of right lung'),
 ('polmone-sinistro', 'lobe of left lung'),
 ('vie-aeree', 'Trachea|bronch'),
 ('rami-arterie-polmonari', 'lobar artery|artery of (left|right) lung|Pulmonary trunk|pulmonary trunk|pulmonary artery'),
 ('rami-vene-polmonari', 'pulmonary vein|vein of (left|right) lung'),
]
