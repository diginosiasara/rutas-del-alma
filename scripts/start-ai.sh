#!/usr/bin/env bash
# Inicia un servidor local (llama.cpp) con el primer modelo .gguf de modelos-ia/gguf/. SIN PROBAR en todos los sistemas: revisa los parámetros de tu versión.
set -e
cd "$(dirname "$0")/.."
MODEL="$(ls modelos-ia/gguf/*.gguf 2>/dev/null | head -n 1 || true)"
[ -z "$MODEL" ] && { echo "No hay ningún .gguf en modelos-ia/gguf/. Copia uno y vuelve a ejecutar."; exit 1; }
command -v llama-server >/dev/null || { echo "Instala llama.cpp (llama-server) y añádelo al PATH."; exit 1; }
echo "Sirviendo $MODEL en http://127.0.0.1:8080 (solo tu equipo). Cierra con Ctrl+C."
echo "Después, añade el modelo en modelos-ia/manifest.json (clave «models») para que ALMA lo detecte."
exec llama-server -m "$MODEL" --host 127.0.0.1 --port 8080
