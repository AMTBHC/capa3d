#!/usr/bin/env bash
# Pasa los datos de tu PC al servidor: catálogo (productos y fotos), pedidos, cotizaciones y
# archivos de los clientes. Reemplaza los datos que tenga el servidor.
#
# 1. En tu PC (Windows, PowerShell, en la carpeta del proyecto), con el sitio apagado:
#      tar -czf datos.tar.gz -C api\data .
# 2. Súbelo al servidor:
#      scp datos.tar.gz usuario@IP-del-servidor:~/
# 3. En el servidor, desde la carpeta del proyecto:
#      sudo bash deploy/importar-datos.sh ~/datos.tar.gz
set -euo pipefail
cd "$(dirname "$0")"

archivo="${1:-}"
if [ -z "$archivo" ] || [ ! -f "$archivo" ]; then
  echo "Uso: sudo bash deploy/importar-datos.sh ruta/a/datos.tar.gz"; exit 1
fi
archivo="$(realpath "$archivo")"
if ! tar -tzf "$archivo" | grep -qE '(^|/)capa3d\.db$'; then
  echo "El archivo no trae capa3d.db: créalo con  tar -czf datos.tar.gz -C api\\data ."; exit 1
fi

echo "▶ Respaldo de lo que hay ahora en el servidor…"
bash ./respaldo.sh || echo "  (no había datos que respaldar)"

echo "▶ Deteniendo la API e importando…"
docker compose stop api
docker compose run --rm --no-deps --user root -v "$archivo:/importar.tar.gz:ro" --entrypoint sh api -c \
  'find /data -mindepth 1 -delete && tar -xzf /importar.tar.gz -C /data && chown -R capa3d /data'
docker compose up -d api

echo "✔ Datos importados. La API se reinició con tu catálogo, pedidos y archivos."
