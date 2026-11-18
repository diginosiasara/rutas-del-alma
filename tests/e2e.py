#!/usr/bin/env python3
"""Pruebas de extremo a extremo de Rutas del Alma (Playwright + Chromium).
Uso:  pip install playwright && playwright install chromium   (una vez)
      python3 tests/e2e.py [-k texto]            # ejecuta todas (o las que contengan «texto»)
Arranca un servidor local temporal; no necesita red. Sale con código 1 si algo falla."""
import sys, os, re, json, time, glob, subprocess, socket, tempfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAKE_SPEECH = """(function(){window.__spoken=[];var s={speaking:false,paused:false,pending:false,getVoices:function(){return [];},cancel:function(){},pause:function(){},resume:function(){},
speak:function(u){window.__spoken.push(u.text);setTimeout(function(){if(u.onstart)u.onstart({});},20);setTimeout(function(){if(u.onend)u.onend({});},500);},addEventListener:function(){},removeEventListener:function(){}};
Object.defineProperty(window,"speechSynthesis",{value:s,configurable:true});})();"""
TESTS = []
def test(f): TESTS.append(f); return f
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p
class Ctx:
    def __init__(self, browser, base): self.b, self.base = browser, base
    def page(self, speech=False, init=None, **kw):
        c = self.b.new_context(viewport={"width": 1100, "height": 900}, accept_downloads=True, **kw)
        if speech: c.add_init_script(FAKE_SPEECH)
        if init: c.add_init_script(init)
        pg = c.new_page(); pg.errors = []; pg.on("pageerror", lambda e: pg.errors.append(str(e))); pg.on("dialog", lambda d: d.accept())
        pg.add_style_tag  # noqa
        return pg
    def go(self, pg, name):
        pg.goto(self.base + name); pg.wait_for_timeout(700); pg.add_style_tag(content="html{scroll-behavior:auto!important}")
    def alma(self, pg):
        pg.locator(".alma-fab").click(); pg.wait_for_timeout(600)
    def ask(self, pg, q):
        pg.fill("#alma-in", q); pg.keyboard.press("Enter"); pg.wait_for_timeout(700); return pg.locator(".alma-msg--bot").last
def eq(a, b, msg=""): assert a == b, f"{msg} esperado {b!r}, obtenido {a!r}"
def ok(c, msg=""): assert c, msg

@test
def alma_no_hace_peticiones_por_defecto(x):
    pg = x.page(); reqs = []; pg.on("request", lambda r: reqs.append(r.url) if (":11434" in r.url or ":8080" in r.url or ":1234" in r.url) else None)
    x.go(pg, "index.html"); x.alma(pg); x.ask(pg, "¿qué es la brújula dorada?"); eq(reqs, [], "peticiones a servidores de IA"); eq(pg.errors, [])
@test
def alma_modo_libro_responde_cita_y_enlaza(x):
    pg = x.page(); x.go(pg, "capitulo-02-el-sauce.html"); x.alma(pg); m = x.ask(pg, "¿cómo se escucha de verdad a otra persona?")
    ok("escucha" in m.inner_text().lower()); ok(m.locator("mark").count() > 0, "sin resaltado de términos"); ok(m.locator(".alma-src a").count() >= 1, "sin enlaces"); eq(pg.errors, [])
@test
def alma_mensaje_de_apoyo_ante_autolesion(x):
    pg = x.page(); x.go(pg, "index.html"); x.alma(pg); m = x.ask(pg, "me quiero hacer daño"); t = m.inner_text(); ok("024" in t and "112" in t, "sin recursos de ayuda"); ok("alma-quote" not in m.inner_html())
@test
def alma_continuacion_no_repite_pasaje(x):
    pg = x.page(); x.go(pg, "index.html"); x.alma(pg); t1 = x.ask(pg, "¿cómo se escucha de verdad a otra persona?").inner_text()
    pg.locator(".alma-chips button", has_text="otro pasaje").click(); pg.wait_for_timeout(800); t2 = pg.locator(".alma-msg--bot").last.inner_text(); ok(t1[40:140] != t2[40:140], "repite el mismo pasaje")
@test
def alma_fuera_de_tema_no_inventa(x):
    pg = x.page(); x.go(pg, "index.html"); x.alma(pg); t = x.ask(pg, "¿cuál es la capital de Australia?").inner_text().lower(); ok("no he encontrado" in t or "no estoy segura" in t, t[:80])
@test
def alma_resumen_usa_ficha_y_la_marca(x):
    pg = x.page(); x.go(pg, "capitulo-04-las-llaves.html"); x.alma(pg); t = x.ask(pg, "Resume este capítulo").inner_text(); ok("De qué trata" in t and "no es texto del libro" in t)
@test
def alma_esc_cierra_y_devuelve_foco(x):
    pg = x.page(); x.go(pg, "index.html"); x.alma(pg); pg.keyboard.press("Escape"); ok(pg.evaluate("document.getElementById('alma-panel').hidden")); ok("alma-fab" in pg.evaluate("document.activeElement.className"))
@test
def alma_voz_boton_escuchar(x):
    pg = x.page(speech=True); x.go(pg, "index.html"); x.alma(pg); m = x.ask(pg, "¿qué es la brújula dorada?"); m.locator("[data-listen]").click(); pg.wait_for_timeout(400); ok(pg.evaluate("window.__spoken.length") > 0)
@test
def mi_lectura_aplica_y_persiste(x):
    pg = x.page(); x.go(pg, "capitulo-01-el-jardin.html"); pg.keyboard.press("Alt+Shift+A")
    for sel in ('input[name=a-size][value="3"]', "input[name=a-bg][value=sepia]", "input[name=a-font][value=atkinson]"): pg.locator(sel).check()
    pg.keyboard.press("Escape"); x.go(pg, "index.html"); ok(pg.evaluate("document.documentElement.dataset.aBg") == "sepia"); ok(float(pg.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")) > 20); eq(pg.errors, [])
@test
def ayuda_con_palabras_muestra_silabas(x):
    pg = x.page(speech=True); x.go(pg, "capitulo-01-el-jardin.html"); pg.keyboard.press("Alt+Shift+A"); pg.locator("input[name=a-wordhelp]").check(); pg.keyboard.press("Escape")
    pg.evaluate("document.querySelector('#reflexion-coaching .llamada p').scrollIntoView({block:'center'})"); pg.wait_for_timeout(700)
    box = pg.evaluate("""(()=>{var p=document.querySelector('#reflexion-coaching .llamada p'),w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),n=w.nextNode(),m=n.nodeValue.match(/\\w{8,}/),r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);var b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()""")
    pg.mouse.click(box["x"], box["y"]); pg.wait_for_timeout(500); ok(not pg.evaluate("document.querySelector('.a-word').hidden")); ok("sílaba" in pg.locator(".a-word__n").inner_text())
@test
def silabeo_de_palabras_conocidas(x):
    pg = x.page(); x.go(pg, "index.html"); casos = {"imaginación": "i-ma-gi-na-ción", "brújula": "brú-ju-la", "transformación": "trans-for-ma-ción", "psicoanálisis": "psi-co-a-ná-li-sis", "construir": "cons-truir", "sabiduría": "sa-bi-du-rí-a", "pingüino": "pin-güi-no", "guerra": "gue-rra"}
    for w, e in casos.items(): eq("-".join(pg.evaluate("w=>window.RutasAyuda.syllabify(w)", w)), e, w)
@test
def cuaderno_guarda_exporta_importa_borra(x):
    pg = x.page(); x.go(pg, "capitulo-01-el-jardin.html"); pg.locator("#cn-cap01-ej1").fill("Flores: mi familia."); pg.wait_for_timeout(900); pg.reload(); pg.wait_for_timeout(700)
    eq(pg.locator("#cn-cap01-ej1").input_value(), "Flores: mi familia.")
    with pg.expect_download() as d: pg.locator(".cn-tools button[data-act=json]").click()
    f = tempfile.mktemp(suffix=".json"); d.value.save_as(f); pg.locator(".cn-tools button[data-act=clear]").click(); pg.wait_for_timeout(300); eq(pg.locator("#cn-cap01-ej1").input_value(), "")
    pg.locator("input[data-file]").set_input_files(f); pg.wait_for_timeout(600); eq(pg.locator("#cn-cap01-ej1").input_value(), "Flores: mi familia."); eq(pg.errors, [])
@test
def lector_resalta_la_frase(x):
    pg = x.page(speech=True, init='localStorage.setItem("rutas-reading-preferences", JSON.stringify({hl:"sentence"}));'); x.go(pg, "prologo.html"); pg.locator('button[aria-controls="reader-panel"]').first.click(); pg.wait_for_timeout(300)
    pg.evaluate("[...document.querySelectorAll('#reader-panel button')].filter(b=>/Escuchar p/.test(b.title||''))[0].click()"); seen = False
    for _ in range(6):
        pg.wait_for_timeout(450); t = pg.evaluate("(()=>{var h=CSS.highlights.get('lectura-frase');return h?[...h][0].toString():null})()")
        if t and 4 < len(t) < 400: seen = True; break
    ok(seen, "no se resalta ninguna frase")
@test
def todas_las_paginas_con_menu_y_pie_con_nota(x):
    pg = x.page()
    for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        x.go(pg, os.path.basename(f)); ok(pg.evaluate("!!document.querySelector('#site-nav')"), f); ok(pg.evaluate("!!document.querySelector('.footer-note a[href=\"privacidad.html\"]')"), "pie sin nota/privacidad en " + os.path.basename(f))
    eq(pg.errors, [])
@test
def capitulos_con_ficha_ejercicios_y_cuaderno(x):
    pg = x.page()
    for f in ["prologo.html"] + sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "capitulo-*.html"))):
        x.go(pg, f); ok(pg.evaluate("!!document.getElementById('orientacion')"), "sin ficha " + f); ok(pg.evaluate("!!document.getElementById('relato')"), "sin relato " + f)
        if f != "prologo.html": ok(pg.evaluate("document.querySelectorAll('#ejercicios-libro .card').length") >= 2, "pocos ejercicios " + f); ok(pg.evaluate("!!document.querySelector('.cap-nav')"), "sin navegación " + f)
@test
def sin_desbordamiento_horizontal_en_movil(x):
    c = x.b.new_context(viewport={"width": 390, "height": 844}); pg = c.new_page()
    for f in ["index.html", "prologo.html", "capitulo-09-regreso-nomadas.html", "galeria.html", "personaje-liam.html", "cuaderno-bibliografia.html", "privacidad.html"]:
        pg.goto(x.base + f); pg.wait_for_timeout(500); ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"), "desborda " + f)
@test
def version_anterior_noindex_y_navegable(x):
    pg = x.page(); x.go(pg, "version-anterior/capitulo-02-el-sauce.html"); ok("noindex" in pg.evaluate("document.querySelector('meta[name=robots]').content")); ok(pg.evaluate("!!document.querySelector('.archivo-banner')")); ok(pg.evaluate("!!document.getElementById('relato1')"), "falta el relato antiguo")
def main():
    pat = sys.argv[sys.argv.index("-k") + 1] if "-k" in sys.argv else ""
    port = free_port(); srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    fails = 0
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); x = Ctx(b, f"http://127.0.0.1:{port}/")
            for t in TESTS:
                if pat and pat not in t.__name__: continue
                t0 = time.time()
                try: t(x); print(f"  OK   {t.__name__} ({time.time()-t0:.1f}s)")
                except Exception as e: fails += 1; print(f"  FALLA {t.__name__}: {str(e).splitlines()[0][:200]}")
            b.close()
    finally: srv.terminate()
    print(f"\n{len(TESTS) if not pat else sum(pat in t.__name__ for t in TESTS)} pruebas, {fails} fallos"); sys.exit(1 if fails else 0)
if __name__ == "__main__": main()
