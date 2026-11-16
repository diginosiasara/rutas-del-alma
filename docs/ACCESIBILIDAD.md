# Accesibilidad y lectura — estado

## Implementado (14/11/2026)
- **Panel «Mi lectura»** (botón «Aa», atajo Alt+Mayús+A): tamaño de letra (5 niveles), tipografía (original/Verdana/Arial), interlineado, espaciado de letras y palabras, ancho de lectura, fondos (crema, sepia, gris, oscuro, alto contraste), acentos para daltonismo (azul y naranja, monocromo), subrayado de enlaces, justificado opcional, modo sin distracciones, regla de lectura y reducción de animaciones. Se guarda en `localStorage` (`rutas-reading-preferences`), solo en el dispositivo. Código: `js/accesibilidad.js`, `css/accesibilidad.css`.
- **Texto alineado a la izquierda por defecto** (antes justificado en escritorio).
- **Continuidad de lectura** (`js/progreso.js`): «Continuar leyendo (n %)» en la portada, capítulos marcados como leídos en el menú.
- **Navegación anterior/siguiente** al final del prólogo y de cada capítulo.
- **Portada** con botones «Comenzar a leer» y «Explorar el universo».
- **Cuaderno personal** (`js/cuaderno.js`, `css/cuaderno.css`): cada ejercicio oficial tiene su campo «Mis notas» con contador, guardado automático (aviso «Guardado a las HH:MM»), descarga en .txt, copia de seguridad .json, importación, impresión y borrado con confirmación; la página del cuaderno muestra «Mi progreso» (n de 26). Aviso de privacidad y de almacenamiento bloqueado incluidos.
- **Resaltado del lector de voz por frase** (CSS Custom Highlight API, sin tocar el HTML): opciones Frase / Párrafo / Ninguno en «Mi lectura». Si el navegador no la soporta, se mantiene el resaltado de párrafo. Corregida además la lectura de títulos formados por varios `<span>` (se leían pegados).
- **Ayuda con palabras** (`js/ayuda-lectura.js`): al activarla en «Mi lectura», tocar una palabra muestra sus sílabas (separación silábica del español, validada con 60 palabras), permite escucharla entera o por sílabas, da un significado sencillo de ~40 términos del libro y enlaza dónde aparece. Atajo Alt+Mayús+W sobre una palabra seleccionada, o botón «Consultar la palabra seleccionada».
- **Fuentes para dislexia**: Atkinson Hyperlegible y OpenDyslexic (SIL OFL 1.1) alojadas en `assets/fonts/` con sus licencias y glifos del español verificados; solo se descargan al elegirlas en «Mi lectura». Hay que valorarlas con usuarios: no hay evidencia sólida de que una fuente concreta ayude a todas las personas.
- **Fichas de orientación** en el prólogo y los 9 capítulos (de qué trata, quién aparece, ideas, «Repasar lo leído»), editables en `docs/fichas-orientacion.json` y aplicables con `tools/aplicar_fichas.py`. Marcadas como resumen de apoyo, no texto del libro; ALMA las usa para «Resume este capítulo».
- **Impresión limpia** (`css/print.css`): sin menús, animaciones ni controles.
- **Lector de voz**: panel identificado como región con nombre accesible.
- **Vídeos** de YouTube con subtítulos en español activados por defecto.
- **Contraste**: los tokens base cumplen WCAG AA (ink 13,5:1; ink-soft 9,2:1; muted 6,1:1; gold-text 5,9:1; modo oscuro ≥ 7,9:1). Los colores de acento por capítulo no superaban 4,5:1 como texto (luz 2,9:1, legado 3,2:1, grano 3,8:1, jardín 4,1:1, sauce 4,2:1); los textos usan ahora variantes oscurecidas (`--mot-text`, `--c-text`) que superan 4,5:1.

## Pendiente (requiere pruebas con personas o decisiones)
- Pruebas reales con NVDA, JAWS, VoiceOver y TalkBack; medición completa WCAG 2.2 AA (Lighthouse, axe).
- Lector de voz: anuncio de cambios de apartado, explicación de las limitaciones en segundo plano; el resaltado por frase depende de CSS Custom Highlight API (Chrome/Edge 105+, Safari 17.2+, Firefox 140+).
- Dislexia: mostrar sílabas en todo el texto; revisar con la autora el glosario y las fichas de orientación.
- Audio/LSE: transcripciones y subtítulos propios, vídeos en lengua de signos.
- Chat IA «ALMA»: hecha la v2 (perfiles, voz, detección por prioridad). Pendiente: búsqueda semántica con embeddings, servidor MCP/Antigravity, TTS local (Piper), pruebas de estrés con modelos reales y probar los scripts de arranque en Windows/Linux/macOS.
- Modularizar `main.js`, plantillas de componentes comunes, PWA, canonical/sitemap con el dominio real.
