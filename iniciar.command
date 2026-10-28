#!/usr/bin/env bash
# Arranca Capa3D en este computador (Mac o Linux): API en :8000 y sitio en :3000.
# La primera vez instala las dependencias; después arranca en segundos.
# Para cerrarlo, cierra esta ventana o presiona Ctrl+C.
set -e
cd "$(dirname "$0")"

abrir() { (command -v open >/dev/null && open "$1") || (command -v xdg-open >/dev/null && xdg-open "$1") || true; }
falta() { echo; echo "❌ Falta $1. Instálalo desde $2 y vuelve a abrir este archivo."; abrir "$2"; read -rp "Presiona Enter para salir"; exit 1; }

command -v node >/dev/null || falta "Node.js" "https://nodejs.org"
# Se prefiere un Python estable: las versiones recién salidas a veces no tienen todas las librerías.
PY=$(command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3 || true)
[ -n "$PY" ] || falta "Python 3" "https://www.python.org/downloads/"

# La marca .listo solo se escribe si la instalación terminó bien; si falta, se rehace.
if [ ! -f api/.venv/.listo ]; then
  echo "▶ Preparando la API (solo la primera vez)…"
  rm -rf api/.venv
  "$PY" -m venv api/.venv
  api/.venv/bin/python -m pip install --quiet --upgrade pip
  api/.venv/bin/python -m pip install --quiet -e api
  touch api/.venv/.listo
fi

if [ ! -f web/node_modules/.listo ]; then
  echo "▶ Preparando el sitio (solo la primera vez)…"
  (cd web && npm install --no-audit --no-fund)
  touch web/node_modules/.listo
fi

# Configuración de la API con una clave para el panel de pedidos.
[ -f api/.env ] || cp api/.env.example api/.env
grep -q "^CAPA3D_ADMIN_TOKEN=." api/.env || api/.venv/bin/python -c "import secrets; print('CAPA3D_ADMIN_TOKEN=' + secrets.token_urlsafe(9))" >> api/.env
ADMIN=$(grep "^CAPA3D_ADMIN_TOKEN=." api/.env | tail -1 | cut -d= -f2-)

# La web debe saber dónde está la API.
grep -q "^NEXT_PUBLIC_API_URL=http" web/.env.local 2>/dev/null || echo "NEXT_PUBLIC_API_URL=http://localhost:8000" >> web/.env.local

# Cierra una API o sitio de una vez anterior que haya quedado abierto: si siguen ocupando
# los puertos, la versión nueva no arranca y responde la vieja.
for port in 8000 3000; do
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
done

echo "▶ Iniciando la API…"
(cd api && .venv/bin/python -m uvicorn capa3d_api.main:create_app --factory --port 8000) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

for _ in $(seq 1 30); do
  curl -s http://localhost:8000/api/health >/dev/null 2>&1 && break
  sleep 1
done
if curl -s http://localhost:8000/api/health | grep -q '"slicer":null'; then
  echo
  echo "⚠️  No encontramos PrusaSlicer: verás el precio estimado, no el laminado, y los STEP no abrirán."
  echo "   Instálalo desde https://www.prusa3d.com/page/prusaslicer_424/ y vuelve a abrir este archivo."
  echo
fi

echo
echo "▶ Iniciando el sitio… se abrirá en http://localhost:3000"
echo "  Panel de pedidos: http://localhost:3000/admin   Clave: $ADMIN"
echo
(sleep 6 && abrir http://localhost:3000 && abrir http://localhost:3000/admin) &
# Sin la compilación anterior: tras actualizar el código, el navegador recibiría la versión vieja.
rm -rf web/.next
cd web && npm run dev
