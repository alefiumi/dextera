"""Importa in testi/ le risposte dei docenti esportate dalla pagina revisione/ (file CSV).

Uso:
  python3 atlante/build/importa_revisione.py risposte.csv            mostra le differenze, non cambia niente
  python3 atlante/build/importa_revisione.py risposte.csv --applica  scrive testi/ e poi rifà i contenuti (testi.py)
  aggiungi --senza-nomi per non salvare il nome del docente (va salvato solo con il suo consenso)

Per ogni riga con un esito:
  giusto                    → stato «verificato»
  sbagliato con correzione  → valore nuovo, fonte «docente», stato «corretto» (il valore di prima resta in verifica.prima)
  sbagliato senza correzione → stato «segnalato», da rivedere
verifica = {"chi", "quando", "nota"}. Se il valore nel CSV non è più quello di testi/ (il file è cambiato dopo
l'esportazione) la riga si salta e si segnala. Le righe senza esito si ignorano.
"""
import csv, io, os, re, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import testi

SEP = ' | '  # come la pagina mostra ed esporta i valori che sono elenchi

def testo(v):
    return SEP.join(map(str, v)) if isinstance(v, list) else ('' if v is None else str(v))

def leggi_csv(path):
    raw = open(path, encoding='utf-8-sig').read()
    dialect = csv.Sniffer().sniff(raw.split('\n', 1)[0], delimiters=';,\t')
    return list(csv.DictReader(io.StringIO(raw), dialect=dialect))

def indice():
    """id di un dato → (tipo, voce, campo o None per le correzioni)"""
    idx = {}
    for t in testi.TIPI + ['correzioni']:
        for v in testi.carica(t):
            if 'dati' in v:
                for c in v['dati']: idx[v['id'] + '.' + c] = (t, v, c)
            elif t == 'correzioni': idx[v['id']] = (t, v, None)
    return idx

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: raise SystemExit(__doc__)
    applica, senza_nomi = '--applica' in sys.argv, '--senza-nomi' in sys.argv
    righe = leggi_csv(args[0]); idx = indice()
    cambiati, salta, n = set(), [], {'giusto': 0, 'sbagliato': 0, 'segnalato': 0}
    for r in righe:
        esito = (r.get('esito') or '').strip().lower()
        if not esito: continue
        if esito not in ('giusto', 'sbagliato'): salta.append(f"{r['id']}: esito «{esito}» sconosciuto"); continue
        if r['id'] not in idx: salta.append(f"{r['id']}: non c'è in testi/"); continue
        t, voce, campo = idx[r['id']]
        d = voce['dati'][campo] if campo else voce
        attuale = testo(d.get('valore', d.get('motivo')))
        if r.get('valore', '').strip() != attuale.strip():
            salta.append(f"{r['id']}: il valore è cambiato dopo l'esportazione\n      CSV:    {r.get('valore')}\n      testi/: {attuale}"); continue
        verifica = {'chi': '' if senza_nomi else (r.get('revisore') or '').strip(), 'quando': (r.get('data') or '').strip(),
                    'nota': (r.get('nota') or '').strip()}
        corr = (r.get('correzione') or '').strip()
        prima = dict(d)
        if esito == 'giusto':
            d['stato'] = 'verificato'; n['giusto'] += 1
        elif corr and campo:
            vecchio = d['valore']
            d['valore'] = [x.strip() for x in corr.split('|') if x.strip()] if isinstance(vecchio, list) else corr
            if campo == 'scritta':  # quesiti UCBM: i numeri restano numeri (si confrontano con la tolleranza)
                d['valore'] = [float(x.replace(',', '.')) if re.fullmatch(r'[-+]?\d+([.,]\d+)?', x) else x for x in d['valore']]
            d['fonte'] = 'docente'; d['stato'] = 'corretto'; verifica['prima'] = vecchio; n['sbagliato'] += 1
        else:
            d['stato'] = 'segnalato'; n['segnalato'] += 1
            if corr: verifica['nota'] = (verifica['nota'] + ' — proposta: ' + corr).strip(' —')
        d['verifica'] = verifica
        if d != prima:
            cambiati.add(t)
            print(f"{r['id']}  [{prima['stato']} → {d['stato']}]")
            if d.get('valore') != prima.get('valore'): print(f"    prima: {testo(prima['valore'])}\n    dopo:  {testo(d['valore'])}")
            if verifica['nota']: print(f"    nota:  {verifica['nota']}")
    print(f"\n{n['giusto']} giusti, {n['sbagliato']} corretti, {n['segnalato']} segnalati; file toccati: {', '.join(sorted(cambiati)) or 'nessuno'}")
    if salta: print(f"\nRighe saltate ({len(salta)}):\n  " + '\n  '.join(salta))
    if not applica:
        print('\nNiente è stato scritto. Per applicare: aggiungi --applica'); return
    for t in sorted(cambiati):
        F = testi.file_intero(t); F['version'] += 1; testi.scrivi_file(t, F)
    if cambiati:
        print('\nScritto testi/. Rifaccio i contenuti con testi.py…')
        subprocess.run([sys.executable, os.path.join(HERE, 'testi.py')], check=True)

if __name__ == '__main__':
    main()
