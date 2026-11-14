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
