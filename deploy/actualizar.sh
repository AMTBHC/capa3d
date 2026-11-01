#!/usr/bin/env bash
# Trae la última versión del código y reinicia el sitio. Los datos (pedidos, archivos,
# catálogo) se conservan.   sudo bash deploy/actualizar.sh
set -euo pipefail
cd "$(dirname "$0")"
# El código es de tu usuario: git no actualiza como root una carpeta ajena ("dubious ownership").
dueno=$(stat -c %U ..)
if [ "$(id -un)" != "$dueno" ]; then
  sudo -u "$dueno" git -C .. pull --ff-only
else
  git -C .. pull --ff-only
fi
docker compose up -d --build
# Caddy lee su configuración al arrancar; se reinicia (un par de segundos) por si cambió.
docker compose restart caddy
docker image prune -f >/dev/null
echo "✔ Actualizado."
