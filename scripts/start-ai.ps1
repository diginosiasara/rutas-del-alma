# Inicia un servidor local (llama.cpp) con el primer modelo .gguf de modelos-ia\gguf\. SIN PROBAR: revisa los parámetros de tu versión.
Set-Location (Join-Path $PSScriptRoot "..")
$model = Get-ChildItem "modelos-ia\gguf\*.gguf" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $model) { Write-Host "No hay ningún .gguf en modelos-ia\gguf\. Copia uno y vuelve a ejecutar."; exit 1 }
if (-not (Get-Command llama-server -ErrorAction SilentlyContinue)) { Write-Host "Instala llama.cpp (llama-server) y añádelo al PATH."; exit 1 }
Write-Host "Sirviendo $($model.Name) en http://127.0.0.1:8080 (solo tu equipo). Cierra con Ctrl+C."
Write-Host "Después, añade el modelo en modelos-ia\manifest.json (clave «models») para que ALMA lo detecte."
& llama-server -m $model.FullName --host 127.0.0.1 --port 8080
