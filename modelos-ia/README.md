# Modelos de IA para ALMA (opcional)

ALMA funciona **sin ningún modelo**: en «modo libro» busca en el texto oficial y responde con fragmentos y enlaces. Un modelo local solo añade respuestas redactadas.

Este proyecto **no incluye modelos** (pesan varios GB y cada uno tiene su licencia). Usa el motor que ya tengas:

## Ollama
1. Instala Ollama e instala un modelo: `ollama pull qwen3:8b` (o uno más ligero como `gemma3:4b`).
2. Permite el origen de la web. Si la sirves con `python3 -m http.server 8000`:
   - Windows (PowerShell): `$env:OLLAMA_ORIGINS="http://localhost:8000"; ollama serve`
   - Linux/macOS: `OLLAMA_ORIGINS=http://localhost:8000 ollama serve`
3. En la web: botón de ALMA → ⚙ → «Automático» → «Probar conexión». ALMA detecta los modelos en `http://localhost:11434/api/tags`.

## LM Studio / llama.cpp / servidor compatible con OpenAI
En ⚙ elige «Servidor compatible con OpenAI», escribe su dirección (p. ej. `http://localhost:1234`) y el modelo.

## Privacidad
- Solo con el libro: nada sale del navegador.
- Con modelo local: las preguntas y los fragmentos del libro se envían únicamente al servidor que indiques. Si la dirección no es de tu equipo, ALMA lo avisa.
- La conversación no se guarda salvo que actives «Recordar la conversación» (queda en este dispositivo).

## Prioridad de selección (modo «Automático»)
1. **Paquete local** (`modelos-ia/`): si `manifest.json` lista modelos y su servicio responde. El navegador no puede ejecutar archivos GGUF por sí solo: hace falta un servicio local (llama.cpp). Scripts de arranque en `scripts/` (sin probar en todos los sistemas).
2. **Ollama** (`http://localhost:11434`).
3. **Antigravity**: se integra por MCP y no se detecta desde el navegador. Si expone una API compatible con OpenAI, configúrala como «Servidor local compatible».
4. **Otros servidores locales**: LM Studio (1234), llama.cpp / LocalAI (8080), 8000.
5. **Proveedor externo**: solo si se habilita expresamente en «Avanzado» y se confirma que los mensajes saldrán del equipo.

La búsqueda solo se hace tras aceptar un aviso y únicamente contra direcciones de tu propio equipo (salvo el proveedor externo habilitado).

## Ajustes «Para ti» y «Avanzado»
- **Para ti:** perfil de respuesta (narrativo, conversacional, analítico, resumido, investigador, didáctico, creativo), longitud, creatividad, instrucciones adicionales, voz y velocidad, lectura automática y recordar la conversación.
- **Avanzado:** proveedor, dirección, modelo, búsqueda de modelos y prueba de conexión. En una web estática no hay contraseña: para ocultarlo al público, define antes de cargar `alma.js`: `window.ALMA_CONFIG = { hideAdmin: true, allowExternal: false }`.
