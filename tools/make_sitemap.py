#!/usr/bin/env python3
"""Genera sitemap.xml y robots.txt con tu dominio real. Uso: python3 tools/make_sitemap.py https://mi-dominio.com"""
import sys, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
if len(sys.argv) != 2 or not sys.argv[1].startswith('http'):
    sys.exit('Uso: python3 tools/make_sitemap.py https://mi-dominio.com')
base = sys.argv[1].rstrip('/')
pages = sorted(glob.glob('*.html'))
x = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for p in pages:
    loc = base + '/' + ('' if p == 'index.html' else p)
    x.append(f'  <url><loc>{loc}</loc></url>')
x.append('</urlset>')
open('sitemap.xml', 'w', encoding='utf8').write('\n'.join(x) + '\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n')
print(f'sitemap.xml ({len(pages)} URLs) y robots.txt creados')
