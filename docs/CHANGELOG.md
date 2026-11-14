# Registro de cambios

## 2026-11-13
- Nueva página `galeria.html` (mapas, escenas, personajes en 3 estilos, lugares y objetos en pixel art) y entrada en el menú.
- Estampas pixel por capítulo y sección «Otras miradas» en cada ficha de personaje.
- Informe técnico: H-01/H-02 IDs duplicados (capítulos 5 y 6) renombrados a `*-bloque`; H-03/H-04/H-05 títulos de capítulos 7, 8 y 9; H-06 CSS repetido eliminado.
- Anclas `#galeria`/`#apariciones` del menú ahora apuntan a `personajes.html#…` en las fichas.
- Añadidos `tools/check_site.py`, `tools/inventario_assets.py`, `tools/make_sitemap.py`, README y este registro.

## 2026-11-13 (informe editorial n.º 1, fase de terminología)
- «Compás Dorado» → «Brújula Dorada» en las 23 páginas y en el comentario de `cap-07.css` (con concordancia de género: la, una, esta, dorada…).
- Identidad: obra «Rutas del Alma», subtítulo «Viajes Internos y Despertar Colectivo», colección «Ecos y Sombras» (portada, título, og:title, JSON-LD, menú y pie). «Ruta del Alma» → «Rutas del Alma» en todo el sitio; se conservan sin tocar los títulos de los vídeos de YouTube.
- Capítulo 4: «Los siete sombreros» → «Los seis sombreros para pensar».
- Nota al lector (texto del manuscrito) en la portada y aviso breve con enlace en el pie de todas las páginas.
- Pendiente: sincronizar el texto del relato con el manuscrito (ver informe n.º 2).

## 2026-11-13 (personajes y animaciones)
- Capítulos 2–9: la sección de personajes usa ahora las tarjetas grandes («Dramatis Personae») del prólogo y el capítulo 1, colocada antes del relato y enlazada desde el índice del capítulo. Si el número de personajes es impar, la última tarjeta se centra.
- `css/escenas.css`: una escena animada temática en la cabecera de cada página (capas `.deco.fx`, solo transform/opacity, pausadas fuera de pantalla y desactivadas con `prefers-reduced-motion`): lámparas y chispas (portada, galería de personajes, Liam), mapa con ruta y chinchetas (galería), rayos de luz (cap. 3), sombreros (cap. 4 y Consejero), páginas flotantes (cap. 5 y María), grano y paja con agua (cap. 6 y Tomás), brújula con aguja y símbolos (cap. 7), nubes, estrellas y puerta (cap. 8), banderines, farolillos y confeti (cap. 9), volutas violeta (Elara), hojas (Aides), vapor (Callum), destellos de constelación (Javier), huellas (Conejo) y brasas (Sabios Nómadas).

## 2026-11-13 (textos oficiales = manuscrito corregido)
- Prólogo y capítulos 1–9: relato, «Para llevarte», epígrafes con su atribución, reflexión desde el coaching ontológico, mirada psicoanalítica y ejercicios sustituidos por el texto del manuscrito corregido (verificado párrafo a párrafo).
- Todo lo propio de la web (clasificaciones de edad, ampliaciones teóricas, ejercicios y cuadernos adicionales, reflexiones ilustradas, objetos, vídeos e ilustraciones del relato anterior) queda dentro de «Material complementario de la web», con aviso de que no forma parte del libro.
- Los relatos anteriores de la web se conservan sin cambios en `docs/archivo-textos-web-anteriores/`.
- Nueva página `cuaderno-bibliografia.html` (cuaderno de práctica y bibliografía del manuscrito) y entrada de menú.
- Portada: texto de contraportada oficial (se elimina «cuatro entregas» y «Casa de los Placeres»).
- Prólogo: contadores corregidos (9 capítulos, 26 ejercicios). Índices y submenús de capítulo regenerados.

## 2026-11-14 (llamadas animadas por capítulo)
- `css/llamadas.css`: citas de cierre, tarjetas de idea (reflexión), lecturas psicoanalíticas, avisos, «Para llevarte» y ejercicios con diseño y animación propios de cada capítulo (lámpara, brote, ondas, sol, llave, libro, espiga, brújula, luna y carpa con bombillas). Se adaptan al tema con la clase `theme-*` del `<body>`; solo usan transform/opacity y se desactivan con `prefers-reduced-motion`.
- Letra capitular y hilo de luz animado en las fábulas del relato.

## 2026-11-14 (menú y versión anterior)
- Menú rediseñado (`css/menu.css`): grupos (El libro / El viaje / Personajes y atlas / Para llevar contigo), insignias con icono y color por capítulo, hilo que une prólogo y capítulos, página actual destacada, subapartados compactos y entrada escalonada. Se respeta `prefers-reduced-motion`.
- `version-anterior/`: la web tal como estaba antes del manuscrito, completa y con todos sus enlaces internos; sustituye a los fragmentos de `docs/archivo-textos-web-anteriores/`. Enlazada desde el menú y desde el material complementario de cada capítulo.

## 2026-11-14 (accesibilidad y continuidad de lectura)
- Panel «Mi lectura», continuidad de lectura, navegación anterior/siguiente, CTA en portada, impresión limpia, texto sin justificar por defecto, contraste de acentos y subtítulos de vídeo (detalle en `docs/ACCESIBILIDAD.md`).
