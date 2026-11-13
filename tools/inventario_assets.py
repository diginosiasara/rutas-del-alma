#!/usr/bin/env python3
"""Genera docs/inventario-assets.csv: ruta, bytes, dimensiones, si está referenciado y duplicados.
NO borra nada. Revisa a mano antes de eliminar (algunas rutas pueden construirse desde JS)."""
import os, re, glob, csv, hashlib, collections
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
refs = ''.join(open(f, encoding='utf8', errors='ignore').read() for f in glob.glob('*.html') + glob.glob('css/*.css') + glob.glob('js/*.js'))
used = {os.path.basename(n) for n in re.findall(r'[\w./%-]+\.(?:webp|png|jpe?g|svg|gif|ico|mp3|mp4)', refs)}
files = [os.path.join(d, x) for d, _, fs in os.walk('assets') for x in fs]
h = collections.defaultdict(list)
for f in files: h[hashlib.md5(open(f, 'rb').read()).hexdigest()].append(f)
os.makedirs('docs', exist_ok=True)
with open('docs/inventario-assets.csv', 'w', newline='', encoding='utf8') as o:
    w = csv.writer(o); w.writerow(['ruta', 'bytes', 'ancho', 'alto', 'referenciado', 'duplicado_de'])
    for f in sorted(files):
        try: wd, ht = Image.open(f).size
        except Exception: wd = ht = ''
        d = [x for x in h[hashlib.md5(open(f, 'rb').read()).hexdigest()] if x != f]
        w.writerow([f, os.path.getsize(f), wd, ht, 'sí' if os.path.basename(f) in used else 'NO', ';'.join(d)])
print('escrito docs/inventario-assets.csv')
