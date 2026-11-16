#!/usr/bin/env python3
"""Regenera chat-ia/indice.js (conocimiento de ALMA) a partir del texto oficial que ya está en las páginas.
Uso: python3 tools/generar_indice_alma.py     (ejecutar tras cambiar el texto de capítulos, cuaderno, glosario o galería)
Conserva los fragmentos de personajes y «sobre el libro» del índice anterior."""
import re, os, glob, json, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
def clean(t): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip()
chunks, chapters = [], []
def add(cap, titulo, seccion, url, texto):
    texto = clean(texto)
    if len(texto) > 25: chunks.append({"i": len(chunks), "cap": cap, "t": titulo, "s": seccion, "u": url, "x": texto})
def group(paras, limit=520):
    cur, out = '', []
    for p in paras:
        if cur and len(cur) + len(p) > limit: out.append(cur); cur = p
        else: cur = (cur + ' ' + p).strip()
    if cur: out.append(cur)
    return out
def section(s, sid):
    m = re.search(r'<section[^>]*\bid="%s"[^>]*>(.*?)</section>' % sid, s, re.S); return m.group(1) if m else ''
# --- conservar personajes (-1) y sobre el libro (-4) del índice anterior
old = []
if os.path.exists('chat-ia/indice.js'):
    t = open('chat-ia/indice.js', encoding='utf8').read(); m = re.search(r'window\.ALMA_INDEX=(\{.*\});', t, re.S)
    if m: old = json.loads(m.group(1))['chunks']
pages = [('prologo.html', 0)] + [(f, int(f.split('-')[1])) for f in sorted(glob.glob('capitulo-*.html'))]
for f, n in pages:
    s = open(f, encoding='utf8').read(); main = re.search(r'<main.*?</main>', s, re.S).group(0)
    title = clean(re.search(r'<h2 id="rel-title"[^>]*>(.*?)</h2>', main, re.S).group(1))
    ep = re.search(r'<p class="hero__lead">«(.*?)» <cite class="hero__cite">— (.*?)</cite>', main, re.S)
    label = ('Prólogo · ' + title) if n == 0 else f'Capítulo {n} · {title}'
    chapters.append({"n": n, "t": title, "f": f, "ep": clean(ep.group(1)) if ep else '', "epa": clean(ep.group(2)) if ep else ''})
    ori = section(main, 'orientacion')
    if ori:
        trata = re.search(r'<h3>De qué trata</h3><p>(.*?)</p>', ori, re.S); quien = re.search(r'<ul class="orient__tags">(.*?)</ul>', ori, re.S)
        ideas = re.search(r'<h3>Ideas que se trabajan</h3><ul>(.*?)</ul>', ori, re.S); rev = re.search(r'<details class="orient__rev">.*?<ul>(.*?)</ul>', ori, re.S)
        lis = lambda m: ', '.join(clean(x) for x in re.findall(r'<li>(.*?)</li>', m.group(1), re.S)) if m else ''
        add(n, label, 'Ficha de orientación (resumen de apoyo)', f + '#orientacion', f'De qué trata: {clean(trata.group(1)) if trata else ""} ¶ Quién aparece: {lis(quien)}. ¶ Ideas que se trabajan: {lis(ideas)}. ¶ Para recordar: {" ".join(clean(x) for x in re.findall(r"<li>(.*?)</li>", rev.group(1), re.S)) if rev else ""}')
    if ep: add(n, label, 'Epígrafe', f + '#inicio', f'Epígrafe del capítulo: «{clean(ep.group(1))}» — {clean(ep.group(2))}')
    rel = section(main, 'relato'); body = re.sub(r'<aside class="llevarte".*?</aside>', '', rel, flags=re.S)
    for g in group([clean(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)]): add(n, label, 'Relato', f + '#relato', g)
    ll = re.search(r'<aside class="llevarte".*?</aside>', rel, re.S)
    if ll: add(n, label, 'Para llevarte', f + '#relato', ' · '.join(re.findall(r'<li>(.*?)</li>', ll.group(0), re.S)))
    for h, p in re.findall(r'<h3>(.*?)</h3><p>(.*?)</p>', section(main, 'reflexion-coaching'), re.S): add(n, label, 'Reflexión del coaching ontológico', f + '#reflexion-coaching', f'{clean(h)}. {p}')
    for g in group([clean(p) for p in re.findall(r'<p>(.*?)</p>', section(main, 'mirada-psicoanalitica'), re.S)]): add(n, label, 'Mirada psicoanalítica', f + '#mirada-psicoanalitica', g)
    for h, p in re.findall(r'<li class="card"><h3><span class="ej-n">(\d+)</span> (.*?)</h3><p>(.*?)</p>', section(main, 'ejercicios-libro'), re.S) and []: pass
    for num, h, p in re.findall(r'<li class="card"><h3><span class="ej-n">(\d+)</span> (.*?)</h3><p>(.*?)</p>', section(main, 'ejercicios-libro'), re.S): add(n, label, f'Ejercicio {num}: {clean(h)}', f + '#ejercicios-libro', f'Ejercicio {num}. {clean(h)}. {p}')
for c in old:
    if c['cap'] == -1: add(-1, c['t'], c['s'], c['u'], c['x'])
cb = open('cuaderno-bibliografia.html', encoding='utf8').read()
sc = section(cb, 'cuaderno'); lead = re.search(r'<p class="lead">(.*?)</p>', sc, re.S)
if lead: add(-2, 'Cuaderno de práctica', 'Introducción', 'cuaderno-bibliografia.html#cuaderno', lead.group(1))
for num, h, p in re.findall(r'<li class="card"><h3><span class="ej-n">(\d+)</span> (.*?)</h3><p>(.*?)</p>', sc, re.S): add(-2, 'Cuaderno de práctica', f'Ejercicio {num}: {clean(h)}', 'cuaderno-bibliografia.html#cuaderno', f'Ejercicio {num}. {clean(h)}. {p}')
for li in re.findall(r'<li>(.*?)</li>', section(cb, 'bibliografia'), re.S): add(-3, 'Bibliografía sugerida', 'Lectura sugerida', 'cuaderno-bibliografia.html#bibliografia', li)
for c in old:
    if c['cap'] == -4: add(-4, c['t'], c['s'], c['u'], c['x'])
# --- glosario (definiciones generales, NO texto del libro) y lugares del pueblo
seen = set()
for k, t, d in re.findall(r'\b(\w+): \["([^"]+)", "([^"]+)"\]', open('js/ayuda-lectura.js', encoding='utf8').read()):
    if t not in seen: seen.add(t); add(-5, 'Glosario', 'Glosario: ' + t, 'index.html', f'{t}. Definición general y sencilla (no es texto del libro): {d}')
gal = open('galeria.html', encoding='utf8').read()
for cap in re.findall(r'<figcaption>(.*?)</figcaption>', section(gal, 'lugares'), re.S): add(-6, 'Lugares del pueblo', 'Lugar: ' + clean(cap), 'galeria.html#lugares', f'Lugar ilustrado del libro: {clean(cap)}. Puedes verlo en la galería de lugares del pueblo.')
os.makedirs('chat-ia', exist_ok=True)
open('chat-ia/indice.js', 'w', encoding='utf8').write('/* Índice del texto oficial de Rutas del Alma para ALMA (generado por tools/generar_indice_alma.py). */\nwindow.ALMA_INDEX=' + json.dumps({"version": 2, "chapters": chapters, "chunks": chunks}, ensure_ascii=False, separators=(',', ':')) + ';\n')
from collections import Counter
print(len(chunks), 'fragmentos;', {k: v for k, v in sorted(Counter(c['cap'] for c in chunks).items())})
