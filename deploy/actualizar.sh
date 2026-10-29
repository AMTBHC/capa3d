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
docker image prune -f >/dev/null
echo "✔ Actualizado."
