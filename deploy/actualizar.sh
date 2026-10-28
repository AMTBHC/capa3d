#!/usr/bin/env bash
# Trae la última versión del código y reinicia el sitio. Los datos (pedidos, archivos,
# catálogo) se conservan.   sudo bash deploy/actualizar.sh
set -euo pipefail
cd "$(dirname "$0")"
git -C .. pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
echo "✔ Actualizado."
