# Rutas del Alma

Libro digital ilustrado: sitio estático (HTML + CSS + JavaScript nativo), sin backend ni compilación.

## Estructura
- `index.html`, `prologo.html`, `capitulo-0X-*.html`: lectura.
- `personajes.html` + `personaje-*.html`: galería y fichas.
- `galeria.html`: mapas, escenas y personajes en acuarela / chibi / pixel art.
- `css/`: `styles.css` (base), `decor.css`, `scroll-fx.css`, `personajes.css`, `galeria.css` y una hoja por capítulo.
- `js/`: `main.js` (menú, lector, zoom…), `personajes.js`, `galeria.js`, `workbook.js` (cuaderno, guarda en localStorage).
- `assets/img/`: imágenes en WebP con variantes `-640`, `-800`, `-1200`; `assets/img/galeria/` para mapas, escenas y pixel art.
- `version-anterior/`: copia navegable y completa de la web antes de adoptar el manuscrito corregido (todas las páginas enlazadas entre sí, con aviso y `noindex`).
- `tools/`: scripts de calidad (ver abajo). `docs/`: inventario de assets.

## Ejecutar en local
`python3 -m http.server 8000` y abrir http://localhost:8000

## Comprobaciones antes de publicar
```
python3 tools/check_site.py           # IDs únicos, anclas, enlaces, títulos, alt, rel seguro, CSS repetido
python3 tools/inventario_assets.py    # docs/inventario-assets.csv (no borra nada)
python3 tools/make_sitemap.py https://TU-DOMINIO   # sitemap.xml y robots.txt
```
Al tener dominio, activa también `canonical` y `og:url`/`og:image` (están como comentario con `TU-DOMINIO` en cada `<head>`).

## Añadir contenido
- **Capítulo nuevo:** copia un capítulo existente, cambia `title`, `h1`, `og:*`, IDs únicos y su hoja `css/cap0X.css`; añádelo al menú (se repite en todas las páginas).
- **Personaje:** copia `personaje-*.html`, añade sus imágenes en `assets/img/galeria/personajes/` (`acuarela-`, `chibi-`, `pixel-`) y enlázalo en `personajes.html` y `galeria.html`.
- **Imágenes:** WebP, con `width`/`height`, `loading="lazy"` salvo la primera pantalla.
