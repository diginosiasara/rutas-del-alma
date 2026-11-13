#!/usr/bin/env python3
"""Validación rápida del sitio (sin dependencias). Uso: python3 tools/check_site.py
Comprueba: IDs únicos, anclas internas, referencias locales, title/H1 coherentes,
un único H1, meta description, alt en img, rel seguro en target=_blank y CSS repetido.
Sale con código 1 si hay errores."""
import re, glob, os, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
errors, warns = [], []
titles = collections.defaultdict(list)
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf8').read()
    s_nc = re.sub(r'<!--.*?-->', '', s, flags=re.S)  # sin comentarios
    ids = re.findall(r'\sid="([^"]+)"', s)
    for k, v in collections.Counter(ids).items():
        if v > 1: errors.append(f'{f}: id duplicado «{k}»')
    for a in set(re.findall(r'href="#([^"]+)"', s)):
        if a not in ids: errors.append(f'{f}: ancla #{a} sin destino')
    for ref in re.findall(r'(?:src|href)="((?:assets|css|js)/[^"#?]+)"', s):
        if not os.path.exists(ref): errors.append(f'{f}: no existe {ref}')
    for ss in re.findall(r'srcset="([^"]+)"', s):
        for part in ss.split(','):
            p = part.split()[0]
            if p.startswith('assets') and not os.path.exists(p): errors.append(f'{f}: srcset sin fichero {p}')
    for href in re.findall(r'href="([\w-]+\.html)(?:#([^"]*))?"', s):
        if not os.path.exists(href[0]): errors.append(f'{f}: enlace a página inexistente {href[0]}')
        elif href[1]:
            t = open(href[0], encoding='utf8').read()
            if f'id="{href[1]}"' not in t: errors.append(f'{f}: {href[0]}#{href[1]} sin destino')
    t = re.search(r'<title>(.*?)</title>', s, re.S)
    if not t: errors.append(f'{f}: falta <title>')
    else: titles[t.group(1).strip()].append(f)
    h1s = re.findall(r'<h1[\s>]', s)
    if len(h1s) != 1: errors.append(f'{f}: {len(h1s)} etiquetas h1 (debe haber 1)')
    if not re.search(r'<meta name="description" content="[^"]+"', s): errors.append(f'{f}: falta meta description')
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    if t and h1:
        n = re.search(r'Cap[ií]tulo (\d+)', re.sub(r'<[^>]+>', ' ', h1.group(1)))
        if n and f'Capítulo {n.group(1)}' not in t.group(1): errors.append(f'{f}: title no coincide con el H1 (Capítulo {n.group(1)})')
    if len(re.findall(r'<img(?![^>]*\salt=)', s)): errors.append(f'{f}: img sin atributo alt')
    for a in re.findall(r'<a[^>]*target="_blank"[^>]*>', s):
        if 'noopener' not in a: errors.append(f'{f}: target=_blank sin rel="noopener": {a[:60]}')
    css = re.findall(r'<link rel="stylesheet" href="(css/[^"]+)"', s)
    for k, v in collections.Counter(css).items():
        if v > 1: errors.append(f'{f}: CSS repetido {k}')
    if '<link rel="canonical"' not in s_nc: warns.append(f'{f}: sin canonical activo (pendiente de dominio)')
for t, fs in titles.items():
    if len(fs) > 1: errors.append(f'title repetido «{t}»: {", ".join(fs)}')
print(f'{len(glob.glob("*.html"))} páginas revisadas')
for w in sorted(set(w.split(': ',1)[1] for w in warns)): print('AVISO:', w, f'({len(warns)} páginas)')
for e in errors: print('ERROR:', e)
print('OK, sin errores' if not errors else f'{len(errors)} errores')
sys.exit(1 if errors else 0)
