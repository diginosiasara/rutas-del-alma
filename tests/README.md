# Pruebas

| Comando | Qué comprueba |
|---|---|
| `python3 tests/e2e.py` | 17 pruebas de extremo a extremo con Chromium: ALMA (sin red por defecto, respuestas con cita y enlaces, mensaje de apoyo, continuación, fuera de tema, resumen, voz), «Mi lectura» y su persistencia, ayuda con palabras y sílabas, cuaderno (guardar, exportar, importar, borrar), resaltado de frase del lector, estructura de las 25 páginas, fichas, ejercicios y navegación de los capítulos, móvil sin desbordes y versión anterior (`noindex`). `-k texto` ejecuta solo las que contengan ese texto. Requiere `pip install playwright && playwright install chromium`. |
| `node tests/eval_recuperacion.js` | Evalúa el buscador de ALMA con `tests/preguntas.json` (61 preguntas) y lo compara con el algoritmo anterior. Sin dependencias. |
| `python3 tools/check_site.py` | Enlaces, anclas, IDs, títulos, alt, recursos y versión anterior. |

**Límites.** Las pruebas usan Chromium y voz/servidores simulados: no sustituyen las pruebas con lectores de pantalla (NVDA, JAWS, VoiceOver, TalkBack), navegadores y dispositivos reales, ni con personas. El conjunto de preguntas lo escribió el equipo de desarrollo, es pequeño y orientativo; ampliarlo con preguntas reales de lectores mejora la fiabilidad de la medición. La calidad de la búsqueda semántica con modelos de embeddings reales no está medida.
