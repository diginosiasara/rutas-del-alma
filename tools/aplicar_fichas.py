#!/usr/bin/env python3
"""Inserta (o actualiza) la «Ficha de orientación» en el prólogo y los capítulos a partir de docs/fichas-orientacion.json,
y la añade al índice del capítulo y al submenú. Después regenera el conocimiento de ALMA.
Uso: python3 tools/aplicar_fichas.py"""
import re, os, glob, json, html, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
E = lambda s: html.escape(s, quote=True)
data = json.load(open('docs/fichas-orientacion.json', encoding='utf8'))
pages = {'prologo.html': 'prologo'}
for f in glob.glob('capitulo-*.html'): pages[f] = str(int(f.split('-')[1]))
def ficha(d):
    li = lambda xs, cls='': ''.join(f'<li{cls}>{E(x)}</li>' for x in xs)
    return ('<section id="orientacion" class="section section--plain" aria-labelledby="ori-t"><div class="container--read">'
            '<div class="section__head section__head--center"><span class="eyebrow">Resumen de apoyo · no es texto del libro</span><h2 id="ori-t" class="title title--sm">Ficha de orientación</h2></div>'
            f'<div class="orient"><div><h3>De qué trata</h3><p>{E(d["trata"])}</p></div>'
            f'<div><h3>Quién aparece</h3><ul class="orient__tags">{li(d["personajes"])}</ul></div>'
            f'<div><h3>Ideas que se trabajan</h3><ul>{li(d["conceptos"])}</ul></div>'
            f'<details class="orient__rev"><summary>Repasar lo leído</summary><ul>{li(d["recuerda"])}</ul></details>'
            '<p class="orient__note">Resumen escrito para esta web a partir del capítulo. No sustituye su lectura.</p></div></div></section>\n')
for f, k in pages.items():
    s = open(f, encoding='utf8').read(); d = data[k]; new = ficha(d)
    if 'id="orientacion"' in s: s = re.sub(r'<section id="orientacion".*?</section>\n?', new, s, count=1, flags=re.S)
    else:
        m = re.search(r'<section id="(?:personajes-capitulo|personajes|guardianes)"', s); assert m, f
        s = s[:m.start()] + new + s[m.start():]
    # índice del capítulo
    if 'href="#orientacion"' not in s:
        s = s.replace('<li><a class="chapter-toc__top" href="#personajes', '<li><a class="chapter-toc__top" href="#orientacion">Ficha de orientación</a></li><li><a class="chapter-toc__top" href="#personajes', 1)
    open(f, 'w', encoding='utf8').write(s)
# submenú del libro en todas las páginas
n = 0
for f in glob.glob('*.html'):
    s = open(f, encoding='utf8').read(); o = s
    for t in pages:
        pat = re.compile(r'(<a class="menu__top" href="' + re.escape(t) + r'"[^>]*>.*?</a><details class="menu__sub"[^>]*><summary>Apartados <span class="menu__count">\()(\d+)(\)</span></summary><ul>)(.*?)(</ul></details>)', re.S)
        def fix(m):
            body = m.group(4)
            if 'orientacion' in body: return m.group(0)
            pre = '' if t == f else t
            li = f'<li><a href="{pre}#orientacion">Ficha de orientación</a></li>'
            mm = re.search(r'<li><a href="[^"]*#(?:personajes-capitulo|guardianes|personajes)"', body)
            body = body[:mm.start()] + li + body[mm.start():] if mm else li + body
            return m.group(1) + str(int(m.group(2)) + 1) + m.group(3) + body + m.group(5)
        s = pat.sub(fix, s)
    if s != o: open(f, 'w', encoding='utf8').write(s); n += 1
print('fichas aplicadas a', len(pages), 'páginas; submenús actualizados en', n)
subprocess.run([sys.executable, 'tools/generar_indice_alma.py'], check=True)
