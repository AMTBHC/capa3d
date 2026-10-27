#!/usr/bin/env bash
# Arranca Capa3D en este computador (Mac o Linux): API en :8000 y sitio en :3000.
# La primera vez instala las dependencias; después arranca en segundos.
# Para cerrarlo, cierra esta ventana o presiona Ctrl+C.
set -e
cd "$(dirname "$0")"

abrir() { (command -v open >/dev/null && open "$1") || (command -v xdg-open >/dev/null && xdg-open "$1") || true; }
falta() { echo; echo "❌ Falta $1. Instálalo desde $2 y vuelve a abrir este archivo."; abrir "$2"; read -rp "Presiona Enter para salir"; exit 1; }

command -v node >/dev/null || falta "Node.js" "https://nodejs.org"
PY=$(command -v python3 || true)
[ -n "$PY" ] || falta "Python 3" "https://www.python.org/downloads/"

if [ ! -x api/.venv/bin/python ]; then
  echo "▶ Preparando la API (solo la primera vez)…"
  "$PY" -m venv api/.venv
  api/.venv/bin/python -m pip install --quiet --upgrade pip
  api/.venv/bin/python -m pip install --quiet -e api
fi

if [ ! -d web/node_modules ]; then
  echo "▶ Preparando el sitio (solo la primera vez)…"
  (cd web && npm install --no-audit --no-fund)
fi

# La web debe saber dónde está la API.
grep -q "^NEXT_PUBLIC_API_URL=http" web/.env.local 2>/dev/null || echo "NEXT_PUBLIC_API_URL=http://localhost:8000" >> web/.env.local

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

echo "▶ Iniciando el sitio… se abrirá en http://localhost:3000"
(sleep 6 && abrir http://localhost:3000) &
cd web && npm run dev
