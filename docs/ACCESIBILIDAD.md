# Accesibilidad y lectura — estado

## Implementado (14/11/2026)
- **Panel «Mi lectura»** (botón «Aa», atajo Alt+Mayús+A): tamaño de letra (5 niveles), tipografía (original/Verdana/Arial), interlineado, espaciado de letras y palabras, ancho de lectura, fondos (crema, sepia, gris, oscuro, alto contraste), acentos para daltonismo (azul y naranja, monocromo), subrayado de enlaces, justificado opcional, modo sin distracciones, regla de lectura y reducción de animaciones. Se guarda en `localStorage` (`rutas-reading-preferences`), solo en el dispositivo. Código: `js/accesibilidad.js`, `css/accesibilidad.css`.
- **Texto alineado a la izquierda por defecto** (antes justificado en escritorio).
- **Continuidad de lectura** (`js/progreso.js`): «Continuar leyendo (n %)» en la portada, capítulos marcados como leídos en el menú.
- **Navegación anterior/siguiente** al final del prólogo y de cada capítulo.
- **Portada** con botones «Comenzar a leer» y «Explorar el universo».
- **Impresión limpia** (`css/print.css`): sin menús, animaciones ni controles.
- **Lector de voz**: panel identificado como región con nombre accesible.
- **Vídeos** de YouTube con subtítulos en español activados por defecto.
- **Contraste**: los tokens base cumplen WCAG AA (ink 13,5:1; ink-soft 9,2:1; muted 6,1:1; gold-text 5,9:1; modo oscuro ≥ 7,9:1). Los colores de acento por capítulo no superaban 4,5:1 como texto (luz 2,9:1, legado 3,2:1, grano 3,8:1, jardín 4,1:1, sauce 4,2:1); los textos usan ahora variantes oscurecidas (`--mot-text`, `--c-text`) que superan 4,5:1.

## Pendiente (requiere pruebas con personas o decisiones)
- Pruebas reales con NVDA, JAWS, VoiceOver y TalkBack; medición completa WCAG 2.2 AA (Lighthouse, axe).
- Lector de voz: resaltado por frase, lectura por frases, anuncio de cambios de apartado, explicación de las limitaciones en segundo plano.
- Dislexia: separación silábica, glosario contextual, resúmenes de capítulo, fuente OpenDyslexic/Atkinson (hay que incluir los ficheros y revisar licencias).
- Audio/LSE: transcripciones y subtítulos propios, vídeos en lengua de signos.
- Cuaderno: exportar/importar respuestas, resumen por capítulo, indicador de guardado.
- Chat IA «ALMA»: requiere backend/agente local y decisión sobre modelos (ver informe).
- Modularizar `main.js`, plantillas de componentes comunes, PWA, canonical/sitemap con el dominio real.
