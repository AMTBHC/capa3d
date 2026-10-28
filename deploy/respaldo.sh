#!/usr/bin/env bash
# Copia de seguridad de los datos (pedidos, archivos de clientes, catálogo y base de datos) en
# deploy/respaldos/. Para hacerla cada noche:  sudo crontab -e  y agrega:
#   15 3 * * * bash /ruta/a/capa3d/deploy/respaldo.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p respaldos
archivo="respaldos/capa3d-$(date +%Y-%m-%d-%H%M).tar.gz"
docker compose exec -T api tar -czf - -C /data . > "$archivo"
# Se guardan los últimos 14.
ls -1t respaldos/capa3d-*.tar.gz | tail -n +15 | xargs -r rm --
echo "✔ Respaldo: deploy/$archivo"
